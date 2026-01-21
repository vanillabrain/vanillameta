import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { createHash } from 'crypto';
import { RedisCacheService } from '../optimization/redis-cache.service';
import { CacheKeyService } from '../services/cache-key.service';
import { CacheMetricsService } from '../services/cache-metrics.service';
import { CACHE_CONFIG_KEY, CacheConfig } from '../decorators/cache-config.decorator';

@Injectable()
export class ApiCacheInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ApiCacheInterceptor.name);

  constructor(
    private readonly redisCacheService: RedisCacheService,
    private readonly reflector: Reflector,
    private readonly cacheKeyService: CacheKeyService,
    private readonly cacheMetricsService: CacheMetricsService,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const startTime = Date.now();
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    
    // 캐시 설정 확인
    const cacheConfig = this.reflector.getAllAndOverride<CacheConfig>(
      CACHE_CONFIG_KEY,
      [context.getHandler(), context.getClass()],
    );

    // 캐싱이 비활성화된 경우
    if (!cacheConfig || cacheConfig.disabled) {
      return next.handle();
    }

    // POST, PUT, PATCH, DELETE 요청은 캐싱하지 않음
    if (!this.isCacheableMethod(request.method)) {
      return next.handle();
    }

    try {
      // 캐시 키 생성
      const cacheKey = this.cacheKeyService.generateKey(request, cacheConfig);

      // 캐시에서 데이터 조회
      const cachedData = await this.redisCacheService.getSimple(cacheKey);

      if (cachedData) {
        // 캐시 히트
        const responseTime = Date.now() - startTime;
        await this.cacheMetricsService.recordCacheHit(cacheKey, responseTime);
        
        this.logger.debug(`Cache hit for key: ${cacheKey} (${responseTime}ms)`);
        
        // 캐시된 데이터 파싱
        const data = JSON.parse(cachedData);
        
        // HTTP 캐싱 헤더 설정
        this.setHttpCacheHeaders(response, data, cacheConfig, true);
        
        return of(data);
      }

      // 캐시 미스
      await this.cacheMetricsService.recordCacheMiss(cacheKey);
      this.logger.debug(`Cache miss for key: ${cacheKey}`);

      // 실제 핸들러 실행 및 결과 캐싱
      return next.handle().pipe(
        tap(async (data) => {
          try {
            // TTL 계산
            const ttl = this.calculateTTL(cacheConfig, request);
            
            // 압축이 필요한 경우 처리
            const dataToCache = await this.prepareDataForCache(data, cacheConfig);
            
            // Redis에 캐싱
            await this.redisCacheService.setSimple(
              cacheKey,
              JSON.stringify(dataToCache),
              ttl,
            );

            const responseTime = Date.now() - startTime;
            this.logger.debug(
              `Cached response for key: ${cacheKey} with TTL: ${ttl}s (${responseTime}ms)`,
            );

            // HTTP 캐싱 헤더 설정
            this.setHttpCacheHeaders(response, data, cacheConfig, false);
          } catch (error) {
            // 캐싱 실패는 로그만 남기고 응답은 정상 반환
            this.logger.error(`Failed to cache response: ${error.message}`);
            await this.cacheMetricsService.recordCacheError(cacheKey);
          }
        }),
      );
    } catch (error) {
      // 캐시 관련 오류 발생 시 정상 처리 진행
      this.logger.error(`Cache interceptor error: ${error.message}`);
      return next.handle();
    }
  }

  /**
   * 캐싱 가능한 HTTP 메서드인지 확인
   */
  private isCacheableMethod(method: string): boolean {
    return ['GET', 'HEAD'].includes(method.toUpperCase());
  }

  /**
   * TTL 계산
   */
  private calculateTTL(config: CacheConfig, request: Request): number {
    // 동적 TTL 계산 로직
    if (config.dynamicTTL) {
      return config.dynamicTTL(request);
    }

    // 기본 TTL 반환
    return config.ttl || 3600; // 기본값 1시간
  }

  /**
   * 캐싱을 위한 데이터 준비
   */
  private async prepareDataForCache(
    data: any,
    config: CacheConfig,
  ): Promise<any> {
    // 압축이 필요한 경우
    if (config.compress && this.shouldCompress(data)) {
      // 압축 로직은 별도 서비스로 분리하여 구현
      return data;
    }

    return data;
  }

  /**
   * 압축이 필요한지 판단
   */
  private shouldCompress(data: any): boolean {
    const jsonString = JSON.stringify(data);
    return jsonString.length > 1024; // 1KB 이상
  }

  /**
   * HTTP 캐싱 헤더 설정
   */
  private setHttpCacheHeaders(
    response: Response,
    data: any,
    config: CacheConfig,
    isCacheHit: boolean,
  ): void {
    try {
      const ttl = config.ttl || 3600;
      
      // Cache-Control 헤더 설정
      const cacheControl = this.getCacheControlHeader(config, ttl);
      response.setHeader('Cache-Control', cacheControl);
      
      // ETag 생성 및 설정
      const etag = this.generateETag(data);
      response.setHeader('ETag', etag);
      
      // Last-Modified 헤더 설정 (현재 시간)
      response.setHeader('Last-Modified', new Date().toUTCString());
      
      // 캐시 히트 여부를 커스텀 헤더로 표시 (디버깅용)
      response.setHeader('X-Cache', isCacheHit ? 'HIT' : 'MISS');
      
      // TTL 정보 제공 (디버깅용)
      response.setHeader('X-Cache-TTL', ttl.toString());
      
    } catch (error) {
      this.logger.error(`Failed to set HTTP cache headers: ${error.message}`);
    }
  }

  /**
   * Cache-Control 헤더 생성
   */
  private getCacheControlHeader(config: CacheConfig, ttl: number): string {
    const directives = ['public']; // 기본적으로 public 캐시 허용
    
    // max-age 설정
    directives.push(`max-age=${ttl}`);
    
    // 사용자별 캐싱인 경우 private으로 변경
    if (config.userSpecific) {
      directives[0] = 'private';
    }
    
    // 정적 데이터인 경우 더 긴 캐시 허용
    if (ttl >= 3600) { // 1시간 이상
      directives.push('immutable');
    }
    
    return directives.join(', ');
  }

  /**
   * ETag 생성
   */
  private generateETag(data: any): string {
    const content = JSON.stringify(data);
    const hash = createHash('md5').update(content).digest('hex');
    return `"${hash}"`;
  }
}