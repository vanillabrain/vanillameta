import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@liaoliaots/nestjs-redis';
import Redis from 'ioredis';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { CacheKeyService } from './cache-key.service';

export interface CacheInvalidationEvent {
  type: string;
  entityId: number;
  entityType: string;
  timestamp: Date;
  userId?: number;
}

@Injectable()
export class CacheInvalidationService {
  private readonly logger = new Logger(CacheInvalidationService.name);

  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly eventEmitter: EventEmitter2,
    private readonly cacheKeyService: CacheKeyService,
  ) {}

  /**
   * 패턴 기반 캐시 무효화
   */
  async invalidateByPattern(pattern: string): Promise<number> {
    try {
      const keys = await this.scanKeys(pattern);
      
      if (keys.length === 0) {
        this.logger.debug(`No keys found for pattern: ${pattern}`);
        return 0;
      }

      // 배치로 삭제 (파이프라인 사용)
      const pipeline = this.redis.pipeline();
      keys.forEach(key => pipeline.del(key));
      await pipeline.exec();

      this.logger.log(`Invalidated ${keys.length} keys for pattern: ${pattern}`);
      
      // 무효화 이벤트 발행
      this.eventEmitter.emit('cache.invalidated', {
        pattern,
        count: keys.length,
        timestamp: new Date(),
      });

      return keys.length;
    } catch (error) {
      this.logger.error(`Failed to invalidate cache by pattern: ${error.message}`);
      throw error;
    }
  }

  /**
   * 대시보드 관련 캐시 무효화
   */
  async invalidateDashboard(dashboardId: number): Promise<void> {
    const patterns = [
      `dashboard:${dashboardId}:*`,
      `*:dashboard:${dashboardId}:*`,
    ];

    for (const pattern of patterns) {
      await this.invalidateByPattern(pattern);
    }

    // 관련 사용자 캐시도 무효화
    await this.invalidateUserDashboardLists();
  }

  /**
   * 데이터셋 관련 캐시 무효화
   */
  async invalidateDataset(datasetId: number): Promise<void> {
    const patterns = [
      `dataset:${datasetId}:*`,
      `*:dataset:${datasetId}:*`,
    ];

    for (const pattern of patterns) {
      await this.invalidateByPattern(pattern);
    }

    // 이 데이터셋을 사용하는 대시보드 캐시도 무효화
    await this.invalidateDashboardsUsingDataset(datasetId);
  }

  /**
   * 위젯 관련 캐시 무효화
   */
  async invalidateWidget(dashboardId: number, widgetId: number): Promise<void> {
    const patterns = [
      `dashboard:${dashboardId}:widget:${widgetId}:*`,
      `*:widget:${widgetId}:*`,
    ];

    for (const pattern of patterns) {
      await this.invalidateByPattern(pattern);
    }

    // 대시보드 메타데이터도 무효화
    const dashboardKey = this.cacheKeyService.generateDashboardKey(dashboardId);
    await this.redis.del(dashboardKey);
  }

  /**
   * 사용자 관련 캐시 무효화
   */
  async invalidateUser(userId: number): Promise<void> {
    const pattern = `user:${userId}:*`;
    await this.invalidateByPattern(pattern);
  }

  /**
   * 사용자 대시보드 목록 캐시 무효화
   */
  private async invalidateUserDashboardLists(): Promise<void> {
    const pattern = 'user:*:dashboards:list:*';
    await this.invalidateByPattern(pattern);
  }

  /**
   * 특정 데이터셋을 사용하는 대시보드 캐시 무효화
   */
  private async invalidateDashboardsUsingDataset(datasetId: number): Promise<void> {
    // 데이터셋-대시보드 매핑을 Redis에서 조회
    const dashboardIds = await this.redis.smembers(`dataset:${datasetId}:dashboards`);
    
    for (const dashboardId of dashboardIds) {
      await this.invalidateDashboard(parseInt(dashboardId, 10));
    }
  }

  /**
   * 키 스캔 (대량 키 처리용)
   */
  private async scanKeys(pattern: string): Promise<string[]> {
    const keys: string[] = [];
    const stream = this.redis.scanStream({
      match: pattern,
      count: 100,
    });

    return new Promise((resolve, reject) => {
      stream.on('data', (resultKeys: string[]) => {
        keys.push(...resultKeys);
      });

      stream.on('end', () => resolve(keys));
      stream.on('error', reject);
    });
  }

  /**
   * 이벤트 핸들러: 대시보드 업데이트
   */
  @OnEvent('dashboard.updated')
  async handleDashboardUpdate(payload: { dashboardId: number }): Promise<void> {
    this.logger.debug(`Handling dashboard update event: ${payload.dashboardId}`);
    await this.invalidateDashboard(payload.dashboardId);
  }

  /**
   * 이벤트 핸들러: 대시보드 삭제
   */
  @OnEvent('dashboard.deleted')
  async handleDashboardDelete(payload: { dashboardId: number }): Promise<void> {
    this.logger.debug(`Handling dashboard delete event: ${payload.dashboardId}`);
    await this.invalidateDashboard(payload.dashboardId);
  }

  /**
   * 이벤트 핸들러: 데이터셋 업데이트
   */
  @OnEvent('dataset.updated')
  async handleDatasetUpdate(payload: { datasetId: number }): Promise<void> {
    this.logger.debug(`Handling dataset update event: ${payload.datasetId}`);
    await this.invalidateDataset(payload.datasetId);
  }

  /**
   * 이벤트 핸들러: 데이터셋 삭제
   */
  @OnEvent('dataset.deleted')
  async handleDatasetDelete(payload: { datasetId: number }): Promise<void> {
    this.logger.debug(`Handling dataset delete event: ${payload.datasetId}`);
    await this.invalidateDataset(payload.datasetId);
  }

  /**
   * 이벤트 핸들러: 위젯 업데이트
   */
  @OnEvent('widget.updated')
  async handleWidgetUpdate(payload: { dashboardId: number; widgetId: number }): Promise<void> {
    this.logger.debug(`Handling widget update event: ${payload.widgetId}`);
    await this.invalidateWidget(payload.dashboardId, payload.widgetId);
  }

  /**
   * 이벤트 핸들러: 위젯 삭제
   */
  @OnEvent('widget.deleted')
  async handleWidgetDelete(payload: { dashboardId: number; widgetId: number }): Promise<void> {
    this.logger.debug(`Handling widget delete event: ${payload.widgetId}`);
    await this.invalidateWidget(payload.dashboardId, payload.widgetId);
  }

  /**
   * 이벤트 핸들러: 사용자 권한 변경
   */
  @OnEvent('user.permissions.changed')
  async handleUserPermissionsChange(payload: { userId: number }): Promise<void> {
    this.logger.debug(`Handling user permissions change: ${payload.userId}`);
    await this.invalidateUser(payload.userId);
  }

  /**
   * 버전 기반 캐시 무효화
   */
  async invalidateByVersion(prefix: string, newVersion: number): Promise<void> {
    // 이전 버전의 모든 캐시 무효화
    for (let version = 1; version < newVersion; version++) {
      const pattern = `${prefix}:v${version}:*`;
      await this.invalidateByPattern(pattern);
    }
  }

  /**
   * 전체 캐시 초기화 (위험: 관리자 전용)
   */
  async flushAll(): Promise<void> {
    this.logger.warn('Flushing all cache data');
    await this.redis.flushdb();
    
    this.eventEmitter.emit('cache.flushed', {
      timestamp: new Date(),
    });
  }

  /**
   * 만료된 캐시 정리 (수동 실행)
   */
  async cleanupExpiredKeys(): Promise<number> {
    let cleaned = 0;
    const stream = this.redis.scanStream({
      match: '*',
      count: 100,
    });

    return new Promise((resolve, reject) => {
      stream.on('data', async (keys: string[]) => {
        for (const key of keys) {
          const ttl = await this.redis.ttl(key);
          // TTL이 없거나 음수인 키 삭제
          if (ttl === -1 || ttl === -2) {
            await this.redis.del(key);
            cleaned++;
          }
        }
      });

      stream.on('end', () => {
        this.logger.log(`Cleaned up ${cleaned} expired keys`);
        resolve(cleaned);
      });
      
      stream.on('error', reject);
    });
  }
}