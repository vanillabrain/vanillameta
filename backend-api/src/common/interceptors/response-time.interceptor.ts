import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { CloudWatchMetricsService } from '../monitoring/cloudwatch-metrics.service';
import { BusinessMetricsService } from '../monitoring/business-metrics.service';

@Injectable()
export class ResponseTimeInterceptor implements NestInterceptor {
  constructor(
    private readonly cloudWatchMetrics: CloudWatchMetricsService,
    private readonly businessMetrics: BusinessMetricsService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const startTime = Date.now();
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    return next.handle().pipe(
      tap(async () => {
        const responseTime = Date.now() - startTime;
        const path = request.route?.path || request.url;
        const method = request.method;
        const statusCode = response.statusCode;

        // CloudWatch 메트릭 기록
        try {
          // 응답 시간 메트릭
          await this.cloudWatchMetrics.recordApiResponseTime(
            path,
            method,
            responseTime,
            statusCode,
          );

          // API 가용성 메트릭
          await this.businessMetrics.recordApiAvailability(
            path,
            method,
            statusCode,
          );

          // 사용자 활동 추적 (인증된 요청만)
          if (request.user?.id) {
            await this.businessMetrics.recordUserActivity(
              request.user.id,
              'api_request',
              'endpoint',
              { path, method, statusCode },
            );
          }
        } catch (error) {
          // 메트릭 전송 실패가 요청 처리를 방해하지 않도록 함
          console.error('Failed to record metrics:', error);
        }
      }),
    );
  }
}