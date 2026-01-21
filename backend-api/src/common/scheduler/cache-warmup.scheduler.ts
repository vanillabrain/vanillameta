import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { Dataset } from '../../dataset/entities/dataset.entity';
import { Dashboard } from '../../dashboard/entities/dashboard.entity';
import { Widget } from '../../widget/entities/widget.entity';
import { DashboardWidget } from '../../dashboard/dashboard-widget/entities/dashboard-widget.entity';
import { DatasetService } from '../../dataset/dataset.service';
import { DashboardService } from '../../dashboard/dashboard.service';
import { DashboardCacheService } from '../../dashboard/dashboard-cache.service';
import { CustomLoggerService } from '../logger/logger.service';
import { DatasetType } from '../enum/dataset-type.enum';

/**
 * 캐시 워밍업 스케줄러
 * 인기 있는 데이터셋과 대시보드의 데이터를 미리 캐시에 로드합니다.
 */
@Injectable()
export class CacheWarmupScheduler {
  private readonly logger = new Logger(CacheWarmupScheduler.name);
  private isWarmingUp = false;

  constructor(
    @InjectRepository(Dataset)
    private readonly datasetRepository: Repository<Dataset>,
    @InjectRepository(Dashboard)
    private readonly dashboardRepository: Repository<Dashboard>,
    @InjectRepository(Widget)
    private readonly widgetRepository: Repository<Widget>,
    @InjectRepository(DashboardWidget)
    private readonly dashboardWidgetRepository: Repository<DashboardWidget>,
    private readonly datasetService: DatasetService,
    private readonly dashboardService: DashboardService,
    private readonly dashboardCacheService: DashboardCacheService,
    private readonly customLogger: CustomLoggerService,
  ) {}

  /**
   * 매일 새벽 3시에 인기 데이터셋 캐시 워밍
   */
  @Cron('0 3 * * *', {
    name: 'popular-datasets-warmup',
    timeZone: 'Asia/Seoul',
  })
  async warmupPopularDatasets() {
    if (this.isWarmingUp) {
      this.logger.warn('Cache warmup already in progress, skipping...');
      return;
    }

    this.isWarmingUp = true;
    const startTime = Date.now();

    try {
      this.customLogger.log('Starting popular datasets cache warmup', 'CacheWarmupScheduler');

      // 최근 7일간 가장 많이 사용된 데이터셋 조회
      const popularDatasets = await this.getPopularDatasets(7, 50);
      this.logger.log(`Found ${popularDatasets.length} popular datasets to warm up`);

      // 병렬로 캐시 워밍 (동시 실행 수 제한)
      const batchSize = 5;
      for (let i = 0; i < popularDatasets.length; i += batchSize) {
        const batch = popularDatasets.slice(i, i + batchSize);

        await Promise.allSettled(
          batch.map(async dataset => {
            try {
              await this.datasetService.executeCachedQuery(dataset.id, {
                forceRefresh: true,
                customTtl: 7200, // 2시간 TTL
              });

              this.customLogger.debug(
                `Warmed up dataset ${dataset.id}: ${dataset.title}`,
                'CacheWarmupScheduler',
              );
            } catch (error) {
              this.logger.error(`Failed to warm up dataset ${dataset.id}:`, error);
            }
          }),
        );
      }

      const duration = Date.now() - startTime;
      this.customLogger.log(
        `Popular datasets cache warmup completed in ${duration}ms`,
        'CacheWarmupScheduler',
        { datasetsCount: popularDatasets.length, duration },
      );
    } catch (error) {
      this.logger.error('Popular datasets cache warmup failed:', error);
    } finally {
      this.isWarmingUp = false;
    }
  }

  /**
   * 매시간 실시간 대시보드 데이터 갱신
   */
  @Cron(CronExpression.EVERY_HOUR, {
    name: 'realtime-dashboards-refresh',
    timeZone: 'Asia/Seoul',
  })
  async refreshRealtimeDashboards() {
    const startTime = Date.now();

    try {
      this.customLogger.log('Starting realtime dashboards refresh', 'CacheWarmupScheduler');

      // 실시간 또는 자주 업데이트되는 대시보드 조회
      const realtimeDashboards = await this.getRealtimeDashboards();
      this.logger.log(`Found ${realtimeDashboards.length} realtime dashboards to refresh`);

      for (const dashboard of realtimeDashboards) {
        try {
          // 대시보드의 위젯에서 사용하는 데이터셋 조회
          const datasetIds = await this.getWidgetDatasets(dashboard.id);

          if (datasetIds.length === 0) {
            continue;
          }

          // 데이터셋 캐시 갱신
          await Promise.allSettled(
            datasetIds.map(async datasetId => {
              try {
                await this.datasetService.executeCachedQuery(datasetId, {
                  forceRefresh: true,
                  customTtl: 300, // 5분 TTL (실시간 데이터)
                });
              } catch (error) {
                this.logger.error(
                  `Failed to refresh dataset ${datasetId} for dashboard ${dashboard.id}:`,
                  error,
                );
              }
            }),
          );

          this.customLogger.debug(
            `Refreshed ${datasetIds.length} datasets for dashboard ${dashboard.id}`,
            'CacheWarmupScheduler',
          );
        } catch (error) {
          this.logger.error(`Failed to refresh dashboard ${dashboard.id}:`, error);
        }
      }

      const duration = Date.now() - startTime;
      this.customLogger.log(
        `Realtime dashboards refresh completed in ${duration}ms`,
        'CacheWarmupScheduler',
        { dashboardsCount: realtimeDashboards.length, duration },
      );
    } catch (error) {
      this.logger.error('Realtime dashboards refresh failed:', error);
    }
  }

  /**
   * 매주 일요일 새벽 2시에 사용되지 않는 캐시 정리
   */
  @Cron('0 2 * * 0', {
    name: 'unused-cache-cleanup',
    timeZone: 'Asia/Seoul',
  })
  async cleanupUnusedCache() {
    try {
      this.customLogger.log('Starting unused cache cleanup', 'CacheWarmupScheduler');

      // 30일 이상 사용되지 않은 데이터셋 조회
      const unusedDatasets = await this.getUnusedDatasets(30);

      for (const dataset of unusedDatasets) {
        try {
          await this.datasetService.invalidateDatasetCache(dataset.id);
          this.customLogger.debug(
            `Cleaned up cache for unused dataset ${dataset.id}`,
            'CacheWarmupScheduler',
          );
        } catch (error) {
          this.logger.error(`Failed to cleanup cache for dataset ${dataset.id}:`, error);
        }
      }

      this.customLogger.log(
        `Unused cache cleanup completed. Cleaned ${unusedDatasets.length} datasets`,
        'CacheWarmupScheduler',
      );
    } catch (error) {
      this.logger.error('Unused cache cleanup failed:', error);
    }
  }

  /**
   * 인기 대시보드 워밍업
   */
  @Cron('0 4 * * *', {
    name: 'popular-dashboards-warmup',
    timeZone: 'Asia/Seoul',
  })
  async warmupPopularDashboards() {
    const startTime = Date.now();

    try {
      this.customLogger.log('Starting popular dashboards cache warmup', 'CacheWarmupScheduler');

      // 인기 대시보드 조회 (최근 7일간 업데이트된 대시보드)
      const popularDashboards = await this.getPopularDashboards(7, 20);
      this.logger.log(`Found ${popularDashboards.length} popular dashboards to warm up`);

      // 병렬로 캐시 워밍
      const batchSize = 3;
      for (let i = 0; i < popularDashboards.length; i += batchSize) {
        const batch = popularDashboards.slice(i, i + batchSize);

        await Promise.allSettled(
          batch.map(async dashboard => {
            try {
              await this.warmupDashboard(dashboard.id);

              this.customLogger.debug(
                `Warmed up dashboard ${dashboard.id}: ${dashboard.title}`,
                'CacheWarmupScheduler',
              );
            } catch (error) {
              this.logger.error(`Failed to warm up dashboard ${dashboard.id}:`, error);
            }
          }),
        );
      }

      const duration = Date.now() - startTime;
      this.customLogger.log(
        `Popular dashboards cache warmup completed in ${duration}ms`,
        'CacheWarmupScheduler',
        { dashboardsCount: popularDashboards.length, duration },
      );
    } catch (error) {
      this.logger.error('Popular dashboards cache warmup failed:', error);
    }
  }

  /**
   * 인기 대시보드 조회
   */
  private async getPopularDashboards(days: number, limit: number): Promise<Dashboard[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    // TODO: 실제 사용 통계 기반으로 조회하도록 개선 필요
    // 현재는 최근 업데이트된 대시보드를 기준으로 조회
    return this.dashboardRepository.find({
      where: {
        updatedAt: MoreThan(since),
      },
      order: {
        updatedAt: 'DESC',
      },
      take: limit,
    });
  }

  /**
   * 인기 데이터셋 조회
   */
  private async getPopularDatasets(days: number, limit: number): Promise<Dataset[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    // TODO: 실제 사용 통계 기반으로 조회하도록 개선 필요
    // 현재는 최근 업데이트된 데이터셋을 기준으로 조회
    return this.datasetRepository.find({
      where: {
        updatedAt: MoreThan(since),
      },
      order: {
        updatedAt: 'DESC',
      },
      take: limit,
    });
  }

  /**
   * 실시간 대시보드 조회
   */
  private async getRealtimeDashboards(): Promise<Dashboard[]> {
    // TODO: 대시보드에 실시간 플래그 추가 필요
    // 현재는 최근 1시간 내 업데이트된 대시보드 조회
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);

    return this.dashboardRepository.find({
      where: {
        updatedAt: MoreThan(oneHourAgo),
      },
      take: 20,
    });
  }

  /**
   * 대시보드의 위젯에서 사용하는 데이터셋 ID 조회
   */
  private async getWidgetDatasets(dashboardId: number): Promise<number[]> {
    // 대시보드에 연결된 위젯 찾기
    const dashboardWidgets = await this.dashboardWidgetRepository.find({
      where: { dashboardId },
    });
    const widgetIds = dashboardWidgets.map(dw => dw.widgetId);
    
    // 위젯의 데이터셋 정보 조회
    const widgets = await this.widgetRepository.find({
      where: widgetIds.map(widgetId => ({
        id: widgetId,
        datasetType: DatasetType.DATASET,
      })),
      select: ['datasetId'],
    });

    // 중복 제거
    const uniqueDatasetIds = [...new Set(widgets.map(w => w.datasetId).filter(id => id !== null))];

    return uniqueDatasetIds;
  }

  /**
   * 사용되지 않는 데이터셋 조회
   */
  private async getUnusedDatasets(days: number): Promise<Dataset[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    // updatedAt이 오래된 데이터셋 조회
    const oldDatasets = await this.datasetRepository
      .createQueryBuilder('dataset')
      .where('dataset.updatedAt < :since', { since })
      .leftJoin(
        'widget',
        'widget',
        'widget.datasetId = dataset.id AND widget.datasetType = :datasetType',
        { datasetType: DatasetType.DATASET },
      )
      .andWhere('widget.id IS NULL') // 위젯에서 사용하지 않는 데이터셋
      .limit(100)
      .getMany();

    return oldDatasets;
  }

  /**
   * 특정 데이터셋 수동 워밍업
   */
  async warmupDataset(datasetId: number, ttl?: number): Promise<void> {
    try {
      await this.datasetService.executeCachedQuery(datasetId, {
        forceRefresh: true,
        customTtl: ttl || 3600,
      });

      this.customLogger.log(`Dataset ${datasetId} warmed up successfully`, 'CacheWarmupScheduler');
    } catch (error) {
      this.logger.error(`Failed to warm up dataset ${datasetId}:`, error);
      throw error;
    }
  }

  /**
   * 대시보드 수동 워밍업
   */
  async warmupDashboard(dashboardId: number): Promise<void> {
    try {
      // 대시보드 메타데이터 캐싱
      const dashboardResult = await this.dashboardService.findOne(dashboardId);

      if (dashboardResult.status !== 'SUCCESS' || !dashboardResult.data) {
        throw new Error(`Dashboard ${dashboardId} not found`);
      }

      // 위젯에서 사용하는 데이터셋 워밍업
      const datasetIds = await this.getWidgetDatasets(dashboardId);

      await Promise.allSettled(datasetIds.map(datasetId => this.warmupDataset(datasetId)));

      this.customLogger.log(
        `Dashboard ${dashboardId} warmed up with ${datasetIds.length} datasets`,
        'CacheWarmupScheduler',
      );
    } catch (error) {
      this.logger.error(`Failed to warm up dashboard ${dashboardId}:`, error);
      throw error;
    }
  }
}
