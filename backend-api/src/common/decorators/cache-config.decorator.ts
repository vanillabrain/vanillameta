import { SetMetadata } from '@nestjs/common';
import { Request } from 'express';

export const CACHE_CONFIG_KEY = 'cache:config';

export interface CacheConfig {
  /**
   * 캐시 TTL (초 단위)
   */
  ttl?: number;

  /**
   * 동적 TTL 계산 함수
   */
  dynamicTTL?: (request: Request) => number;

  /**
   * 캐시 키 접두사
   */
  prefix?: string;

  /**
   * 캐시 버전
   */
  version?: number;

  /**
   * 캐싱 비활성화 여부
   */
  disabled?: boolean;

  /**
   * 압축 사용 여부
   */
  compress?: boolean;

  /**
   * 캐시 키에 포함할 쿼리 파라미터
   */
  includeQuery?: string[] | boolean;

  /**
   * 캐시 키에 포함할 헤더
   */
  includeHeaders?: string[];

  /**
   * 사용자별 캐싱 여부
   */
  userSpecific?: boolean;

  /**
   * 캐시 무효화 이벤트
   */
  invalidateEvents?: string[];
}

/**
 * API 응답 캐싱 설정 데코레이터
 * 
 * @example
 * ```typescript
 * @CacheConfig({ ttl: 300, prefix: 'dashboard' })
 * @Get(':id')
 * async getDashboard(@Param('id') id: number) {
 *   return this.dashboardService.findOne(id);
 * }
 * ```
 */
export const CacheConfig = (config: CacheConfig) =>
  SetMetadata(CACHE_CONFIG_KEY, config);

/**
 * 캐싱 비활성화 데코레이터
 */
export const NoCache = () => CacheConfig({ disabled: true });

/**
 * 사용자별 캐싱 데코레이터
 */
export const UserCache = (ttl: number = 900) =>
  CacheConfig({ ttl, userSpecific: true });

/**
 * 정적 데이터 캐싱 데코레이터 (24시간)
 */
export const StaticCache = () => CacheConfig({ ttl: 86400 });

/**
 * 실시간 데이터 캐싱 데코레이터 (1분)
 */
export const RealtimeCache = () => CacheConfig({ ttl: 60 });