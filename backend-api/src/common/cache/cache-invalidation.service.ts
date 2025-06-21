import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { HybridCacheService } from '../optimization/hybrid-cache.service';
import { DatasetService } from '../../dataset/dataset.service';
import { DashboardCacheService } from '../../dashboard/dashboard-cache.service';
import { CustomLoggerService } from '../logger/logger.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Widget } from '../../widget/entities/widget.entity';
import { Dataset } from '../../dataset/entities/dataset.entity';
import { DatasetType } from '../enum/dataset-type.enum';

/**
 * 캐시 무효화 정책
 */
export interface InvalidationPolicy {
  immediate: boolean; // 즉시 무효화
  cascade: boolean; // 연관된 캐시도 무효화
  async: boolean; // 비동기 처리
  batchSize?: number; // 배치 크기
}

/**
 * 캐시 무효화 이벤트
 */
export interface CacheInvalidationEvent {
  type: 'dataset' | 'dashboard' | 'widget' | 'database' | 'user';
  entityId: number | string;
  policy?: InvalidationPolicy;
  metadata?: Record<string, any>;
  timestamp: number;
}

/**
 * 중앙 집중식 캐시 무효화 서비스
 * 다양한 이벤트와 시나리오에 대한 캐시 무효화를 관리합니다.
 */
@Injectable()
export class CacheInvalidationService {
  private readonly logger = new Logger(CacheInvalidationService.name);
  private readonly DEFAULT_BATCH_SIZE = 100;
  private invalidationQueue: CacheInvalidationEvent[] = [];
  private isProcessing = false;

  constructor(
    private readonly hybridCache: HybridCacheService,
    private readonly datasetService: DatasetService,
    private readonly dashboardCacheService: DashboardCacheService,
    private readonly customLogger: CustomLoggerService,
    private readonly eventEmitter: EventEmitter2,
    @InjectRepository(Widget)
    private readonly widgetRepository: Repository<Widget>,
    @InjectRepository(Dataset)
    private readonly datasetRepository: Repository<Dataset>,
  ) {
    // 배치 처리 시작
    this.startBatchProcessor();
  }

  /**
   * 데이터셋 업데이트 이벤트 처리
   */
  @OnEvent('dataset.updated')
  async handleDatasetUpdate(payload: { datasetId: number; timestamp: number }) {
    this.customLogger.log('Handling dataset update event', 'CacheInvalidationService', {
      datasetId: payload.datasetId,
    });

    await this.invalidateDataset(payload.datasetId, {
      immediate: true,
      cascade: true,
      async: false,
    });
  }

  /**
   * 대시보드 업데이트 이벤트 처리
   */
  @OnEvent('dashboard.updated')
  async handleDashboardUpdate(payload: { dashboardId: number; timestamp: number }) {
    this.customLogger.log('Handling dashboard update event', 'CacheInvalidationService', {
      dashboardId: payload.dashboardId,
    });

    await this.invalidateDashboard(payload.dashboardId, {
      immediate: true,
      cascade: false,
      async: false,
    });
  }

  /**
   * 위젯 업데이트 이벤트 처리
   */
  @OnEvent('widget.updated')
  async handleWidgetUpdate(payload: { widgetId: number; dashboardId: number; timestamp: number }) {
    this.customLogger.log('Handling widget update event', 'CacheInvalidationService', {
      widgetId: payload.widgetId,
      dashboardId: payload.dashboardId,
    });

    await this.invalidateWidget(payload.widgetId, payload.dashboardId, {
      immediate: true,
      cascade: true,
      async: false,
    });
  }

  /**
   * 데이터베이스 연결 변경 이벤트 처리
   */
  @OnEvent('database.connection.updated')
  async handleDatabaseConnectionUpdate(payload: { databaseId: number; timestamp: number }) {
    this.customLogger.log('Handling database connection update event', 'CacheInvalidationService', {
      databaseId: payload.databaseId,
    });

    await this.invalidateDatabase(payload.databaseId, {
      immediate: false,
      cascade: true,
      async: true,
    });
  }

  /**
   * 데이터셋 캐시 무효화
   */
  async invalidateDataset(datasetId: number, policy?: InvalidationPolicy): Promise<void> {
    const effectivePolicy = this.getEffectivePolicy(policy);
    
    if (effectivePolicy.async) {
      this.queueInvalidation({
        type: 'dataset',
        entityId: datasetId,
        policy: effectivePolicy,
        timestamp: Date.now(),
      });
      return;
    }

    try {
      // 데이터셋 자체 캐시 무효화
      await this.datasetService.invalidateDatasetCache(datasetId);

      if (effectivePolicy.cascade) {
        // 이 데이터셋을 사용하는 위젯들 찾기
        const widgets = await this.widgetRepository.find({
          where: {
            datasetId,
            datasetType: DatasetType.DATASET,
          },
        });

        // 영향받는 대시보드들 찾기
        const dashboardIds = [...new Set(widgets.map(w => w.dashboardId))];
        
        // 각 대시보드 캐시 무효화
        for (const dashboardId of dashboardIds) {
          await this.dashboardCacheService.invalidateDashboard(dashboardId);
        }

        this.customLogger.log('Cascaded dataset cache invalidation completed', 'CacheInvalidationService', {
          datasetId,
          affectedDashboards: dashboardIds.length,
        });
      }

      // 무효화 완료 이벤트 발생
      this.eventEmitter.emit('cache.invalidated', {
        type: 'dataset',
        entityId: datasetId,
        cascade: effectivePolicy.cascade,
        timestamp: Date.now(),
      });
    } catch (error) {
      this.logger.error(`Failed to invalidate dataset cache ${datasetId}:`, error);
      throw error;
    }
  }

  /**
   * 대시보드 캐시 무효화
   */
  async invalidateDashboard(dashboardId: number, policy?: InvalidationPolicy): Promise<void> {
    const effectivePolicy = this.getEffectivePolicy(policy);
    
    if (effectivePolicy.async) {
      this.queueInvalidation({
        type: 'dashboard',
        entityId: dashboardId,
        policy: effectivePolicy,
        timestamp: Date.now(),
      });
      return;
    }

    try {
      // 대시보드 캐시 무효화
      await this.dashboardCacheService.invalidateDashboard(dashboardId);

      if (effectivePolicy.cascade) {
        // 위젯 캐시도 무효화
        const widgets = await this.widgetRepository.find({
          where: { dashboardId },
        });

        // 위젯이 사용하는 데이터셋 캐시 무효화 (선택적)
        const datasetIds = [...new Set(
          widgets
            .filter(w => w.datasetType === DatasetType.DATASET && w.datasetId)
            .map(w => w.datasetId)
        )];

        for (const datasetId of datasetIds) {
          await this.datasetService.invalidateDatasetCache(datasetId);
        }
      }

      // 무효화 완료 이벤트 발생
      this.eventEmitter.emit('cache.invalidated', {
        type: 'dashboard',
        entityId: dashboardId,
        cascade: effectivePolicy.cascade,
        timestamp: Date.now(),
      });
    } catch (error) {
      this.logger.error(`Failed to invalidate dashboard cache ${dashboardId}:`, error);
      throw error;
    }
  }

  /**
   * 위젯 캐시 무효화
   */
  async invalidateWidget(
    widgetId: number,
    dashboardId: number,
    policy?: InvalidationPolicy,
  ): Promise<void> {
    const effectivePolicy = this.getEffectivePolicy(policy);
    
    if (effectivePolicy.async) {
      this.queueInvalidation({
        type: 'widget',
        entityId: widgetId,
        policy: effectivePolicy,
        metadata: { dashboardId },
        timestamp: Date.now(),
      });
      return;
    }

    try {
      // 대시보드 캐시 무효화 (위젯이 변경되면 대시보드도 갱신 필요)
      await this.dashboardCacheService.invalidateDashboard(dashboardId);

      if (effectivePolicy.cascade) {
        // 위젯이 사용하는 데이터셋 캐시 무효화
        const widget = await this.widgetRepository.findOne({
          where: { id: widgetId },
        });

        if (widget && widget.datasetType === DatasetType.DATASET && widget.datasetId) {
          await this.datasetService.invalidateDatasetCache(widget.datasetId);
        }
      }

      // 무효화 완료 이벤트 발생
      this.eventEmitter.emit('cache.invalidated', {
        type: 'widget',
        entityId: widgetId,
        metadata: { dashboardId },
        cascade: effectivePolicy.cascade,
        timestamp: Date.now(),
      });
    } catch (error) {
      this.logger.error(`Failed to invalidate widget cache ${widgetId}:`, error);
      throw error;
    }
  }

  /**
   * 데이터베이스별 캐시 무효화
   */
  async invalidateDatabase(databaseId: number, policy?: InvalidationPolicy): Promise<void> {
    const effectivePolicy = this.getEffectivePolicy(policy);
    
    if (effectivePolicy.async) {
      this.queueInvalidation({
        type: 'database',
        entityId: databaseId,
        policy: effectivePolicy,
        timestamp: Date.now(),
      });
      return;
    }

    try {
      this.customLogger.log('Starting database cache invalidation', 'CacheInvalidationService', {
        databaseId,
        cascade: effectivePolicy.cascade,
      });

      // 데이터베이스별 캐시 무효화
      await this.datasetService.invalidateDatabaseCache(databaseId);

      if (effectivePolicy.cascade) {
        // 이 데이터베이스를 사용하는 모든 데이터셋 찾기
        const datasets = await this.datasetRepository.find({
          where: { databaseId },
        });

        // 배치로 데이터셋 캐시 무효화
        const batchSize = effectivePolicy.batchSize || this.DEFAULT_BATCH_SIZE;
        for (let i = 0; i < datasets.length; i += batchSize) {
          const batch = datasets.slice(i, i + batchSize);
          
          await Promise.all(
            batch.map(dataset => 
              this.invalidateDataset(dataset.id, {
                immediate: true,
                cascade: false, // 중복 cascade 방지
                async: false,
              })
            )
          );

          this.customLogger.debug(`Invalidated batch ${i / batchSize + 1}`, 'CacheInvalidationService', {
            databaseId,
            batchSize: batch.length,
          });
        }
      }

      // 무효화 완료 이벤트 발생
      this.eventEmitter.emit('cache.invalidated', {
        type: 'database',
        entityId: databaseId,
        cascade: effectivePolicy.cascade,
        timestamp: Date.now(),
      });
    } catch (error) {
      this.logger.error(`Failed to invalidate database cache ${databaseId}:`, error);
      throw error;
    }
  }

  /**
   * 사용자별 캐시 무효화
   */
  async invalidateUserCache(userId: number, policy?: InvalidationPolicy): Promise<void> {
    const effectivePolicy = this.getEffectivePolicy(policy);
    
    try {
      // 사용자 대시보드 목록 캐시 무효화
      await this.dashboardCacheService.invalidateUserDashboardList(userId);

      if (effectivePolicy.cascade) {
        // TODO: 사용자가 소유한 모든 대시보드 캐시 무효화
        // 필요시 구현
      }

      // 무효화 완료 이벤트 발생
      this.eventEmitter.emit('cache.invalidated', {
        type: 'user',
        entityId: userId,
        cascade: effectivePolicy.cascade,
        timestamp: Date.now(),
      });
    } catch (error) {
      this.logger.error(`Failed to invalidate user cache ${userId}:`, error);
      throw error;
    }
  }

  /**
   * 패턴 기반 캐시 무효화
   */
  async invalidateByPattern(pattern: string, engineType?: string): Promise<number> {
    try {
      const engine = engineType || 'dashboard';
      await this.hybridCache.invalidateByQuery(engine, pattern);
      
      this.customLogger.log('Pattern-based cache invalidation completed', 'CacheInvalidationService', {
        pattern,
        engine,
      });

      return 1; // 실제로는 영향받은 키 수를 반환해야 함
    } catch (error) {
      this.logger.error(`Failed to invalidate cache by pattern ${pattern}:`, error);
      throw error;
    }
  }

  /**
   * 전체 캐시 무효화 (주의: 성능에 큰 영향)
   */
  async invalidateAll(): Promise<void> {
    try {
      this.customLogger.warn('Starting full cache invalidation', 'CacheInvalidationService');
      
      await this.hybridCache.invalidateAll();
      
      this.customLogger.log('Full cache invalidation completed', 'CacheInvalidationService');

      // 전체 무효화 이벤트 발생
      this.eventEmitter.emit('cache.invalidated.all', {
        timestamp: Date.now(),
      });
    } catch (error) {
      this.logger.error('Failed to invalidate all caches:', error);
      throw error;
    }
  }

  /**
   * 효과적인 무효화 정책 결정
   */
  private getEffectivePolicy(policy?: InvalidationPolicy): InvalidationPolicy {
    return {
      immediate: policy?.immediate ?? true,
      cascade: policy?.cascade ?? false,
      async: policy?.async ?? false,
      batchSize: policy?.batchSize ?? this.DEFAULT_BATCH_SIZE,
    };
  }

  /**
   * 비동기 무효화를 위한 큐에 추가
   */
  private queueInvalidation(event: CacheInvalidationEvent): void {
    this.invalidationQueue.push(event);
    
    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  /**
   * 배치 프로세서 시작
   */
  private startBatchProcessor(): void {
    setInterval(() => {
      if (this.invalidationQueue.length > 0 && !this.isProcessing) {
        this.processQueue();
      }
    }, 5000); // 5초마다 체크
  }

  /**
   * 큐 처리
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.invalidationQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const batch = this.invalidationQueue.splice(0, this.DEFAULT_BATCH_SIZE);
    
    try {
      for (const event of batch) {
        await this.processInvalidationEvent(event);
      }
    } catch (error) {
      this.logger.error('Error processing invalidation queue:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * 개별 무효화 이벤트 처리
   */
  private async processInvalidationEvent(event: CacheInvalidationEvent): Promise<void> {
    const syncPolicy = { ...event.policy, async: false };
    
    switch (event.type) {
      case 'dataset':
        await this.invalidateDataset(event.entityId as number, syncPolicy);
        break;
      case 'dashboard':
        await this.invalidateDashboard(event.entityId as number, syncPolicy);
        break;
      case 'widget':
        await this.invalidateWidget(
          event.entityId as number,
          event.metadata?.dashboardId,
          syncPolicy,
        );
        break;
      case 'database':
        await this.invalidateDatabase(event.entityId as number, syncPolicy);
        break;
      case 'user':
        await this.invalidateUserCache(event.entityId as number, syncPolicy);
        break;
    }
  }

  /**
   * 무효화 통계 조회
   */
  async getInvalidationStats(): Promise<{
    queueSize: number;
    isProcessing: boolean;
    stats: Record<string, number>;
  }> {
    return {
      queueSize: this.invalidationQueue.length,
      isProcessing: this.isProcessing,
      stats: {
        // TODO: 실제 통계 구현
        totalInvalidations: 0,
        cascadedInvalidations: 0,
        failedInvalidations: 0,
      },
    };
  }
}