import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { PerformanceMetricsService } from '../services/performance-metrics.service';

/**
 * 성능 모니터링 인터셉터
 * 
 * API 요청/응답 시간을 측정하고 성능 메트릭을 수집합니다.
 * 메모리 사용량, CPU 사용률, 동시 요청 수 등을 추적합니다.
 */
@Injectable()
export class PerformanceMonitoringInterceptor implements NestInterceptor {
  private readonly logger = new Logger(PerformanceMonitoringInterceptor.name);
  private activeRequests = 0;

  constructor(
    private readonly metricsService: PerformanceMetricsService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const startTime = Date.now();
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    
    // 요청 정보 추출
    const { method, url, headers, params, query, body } = request;
    const userAgent = headers['user-agent'] || 'unknown';
    const clientIp = request.ip || headers['x-forwarded-for'] || 'unknown';
    
    // 메모리 사용량 측정 시작
    const startMemory = process.memoryUsage();
    
    // 동시 요청 수 증가
    this.activeRequests++;
    this.metricsService.updateActiveRequests(this.activeRequests);
    
    // 요청 ID 생성
    const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // 요청 로깅
    this.logger.log({
      requestId,
      method,
      url,
      clientIp,
      userAgent,
      timestamp: new Date().toISOString(),
    });

    return next.handle().pipe(
      tap({
        next: (data) => {
          // 응답 처리 시간 계산
          const responseTime = Date.now() - startTime;
          const statusCode = response.statusCode;
          
          // 메모리 사용량 변화 계산
          const endMemory = process.memoryUsage();
          const memoryDelta = {
            heapUsed: endMemory.heapUsed - startMemory.heapUsed,
            external: endMemory.external - startMemory.external,
            arrayBuffers: endMemory.arrayBuffers - startMemory.arrayBuffers,
          };
          
          // CPU 사용률 계산
          const cpuUsage = process.cpuUsage();
          
          // 동시 요청 수 감소
          this.activeRequests--;
          this.metricsService.updateActiveRequests(this.activeRequests);
          
          // 메트릭 기록
          const metrics = {
            requestId,
            method,
            endpoint: this.extractEndpoint(url),
            url,
            statusCode,
            responseTime,
            memoryDelta,
            cpuUsage,
            activeRequests: this.activeRequests,
            timestamp: new Date(),
          };
          
          // 메트릭 서비스에 전송
          this.metricsService.recordRequestMetrics(metrics);
          
          // 응답 크기 계산 (대략적)
          const responseSize = this.calculateResponseSize(data);
          
          // 성능 임계값 체크
          if (responseTime > 1000) {
            this.logger.warn({
              message: 'Slow API response detected',
              requestId,
              url,
              responseTime,
              threshold: 1000,
            });
          }
          
          // 응답 헤더에 성능 정보 추가
          response.setHeader('X-Response-Time', `${responseTime}ms`);
          response.setHeader('X-Request-Id', requestId);
          
          // 성공 응답 로깅
          this.logger.log({
            requestId,
            statusCode,
            responseTime,
            responseSize,
            memoryDelta: memoryDelta.heapUsed,
          });
        },
        error: (error) => {
          // 에러 처리 시간 계산
          const responseTime = Date.now() - startTime;
          const statusCode = error.status || 500;
          
          // 동시 요청 수 감소
          this.activeRequests--;
          this.metricsService.updateActiveRequests(this.activeRequests);
          
          // 에러 메트릭 기록
          const metrics = {
            requestId,
            method,
            endpoint: this.extractEndpoint(url),
            url,
            statusCode,
            responseTime,
            error: error.message || 'Unknown error',
            errorStack: error.stack,
            activeRequests: this.activeRequests,
            timestamp: new Date(),
          };
          
          // 메트릭 서비스에 전송
          this.metricsService.recordErrorMetrics(metrics);
          
          // 에러 로깅
          this.logger.error({
            requestId,
            statusCode,
            responseTime,
            error: error.message,
            stack: error.stack,
          });
          
          // 에러를 다시 throw하여 NestJS가 처리하도록 함
          throw error;
        },
      }),
    );
  }
  
  /**
   * URL에서 엔드포인트 패턴 추출
   * 
   * @param url - 전체 URL
   * @returns 엔드포인트 패턴 (파라미터는 :param 형태로 변환)
   */
  private extractEndpoint(url: string): string {
    // 쿼리 파라미터 제거
    const path = url.split('?')[0];
    
    // 숫자 ID를 :id로 변환
    const endpoint = path.replace(/\/\d+/g, '/:id');
    
    // UUID를 :uuid로 변환
    const uuidPattern = /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
    return endpoint.replace(uuidPattern, '/:uuid');
  }
  
  /**
   * 응답 데이터 크기 계산 (대략적)
   * 
   * @param data - 응답 데이터
   * @returns 바이트 단위 크기
   */
  private calculateResponseSize(data: any): number {
    if (!data) return 0;
    
    try {
      // JSON으로 직렬화하여 크기 계산
      const jsonString = JSON.stringify(data);
      return Buffer.byteLength(jsonString, 'utf8');
    } catch (error) {
      // 직렬화 실패 시 0 반환
      return 0;
    }
  }
}