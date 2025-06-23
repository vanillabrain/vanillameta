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
import { Request } from 'express';
import { InjectRedis } from '@liaoliaots/nestjs-redis';
import Redis from 'ioredis';
import { CacheKeyService } from '../services/cache-key.service';
import { CacheMetricsService } from '../services/cache-metrics.service';
import { CACHE_CONFIG_KEY, CacheConfig } from '../decorators/cache-config.decorator';

@Injectable()
export class ApiCacheInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ApiCacheInterceptor.name);

  constructor(
    @InjectRedis() private readonly redis: Redis,
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
      const cachedData = await this.redis.get(cacheKey);

      if (cachedData) {
        // 캐시 히트
        const responseTime = Date.now() - startTime;
        await this.cacheMetricsService.recordCacheHit(cacheKey, responseTime);
        
        this.logger.debug(`Cache hit for key: ${cacheKey} (${responseTime}ms)`);
        
        // 캐시된 데이터 반환
        const data = JSON.parse(cachedData);
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
            await this.redis.setex(
              cacheKey,
              ttl,
              JSON.stringify(dataToCache),
            );

            const responseTime = Date.now() - startTime;
            this.logger.debug(
              `Cached response for key: ${cacheKey} with TTL: ${ttl}s (${responseTime}ms)`,
            );
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
}