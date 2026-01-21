import { Injectable, Logger } from '@nestjs/common';
import { HybridCacheService } from '../common/optimization/hybrid-cache.service';
import { CustomLoggerService } from '../common/logger/logger.service';
import { Dashboard } from './entities/dashboard.entity';
import { EventEmitter2 } from '@nestjs/event-emitter';

export interface CachedDashboard {
  dashboard: Dashboard;
  widgets?: any[];
  shareInfo?: any;
  cachedAt: number;
  ttl: number;
}

/**
 * 대시보드 캐싱 서비스
 * 대시보드 메타데이터, 레이아웃, 위젯 정보를 효율적으로 캐싱합니다.
 */
@Injectable()
export class DashboardCacheService {
  private readonly logger = new Logger(DashboardCacheService.name);
  private readonly DEFAULT_TTL = 3600; // 1시간
  private readonly USER_DASHBOARD_LIST_TTL = 300; // 5분
  private readonly SHARED_DASHBOARD_TTL = 7200; // 2시간

  // 캐시 키 프리픽스
  private readonly CACHE_KEY_PREFIX = {
    DASHBOARD: 'dashboard',
    USER_LIST: 'user_dashboards',
    SHARED: 'shared_dashboard',
    WIDGET_LIST: 'dashboard_widgets',
  };

  constructor(
    private readonly hybridCache: HybridCacheService,
    private readonly customLogger: CustomLoggerService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * 대시보드 캐시 키 생성
   */
  private generateDashboardKey(dashboardId: number): string {
    return `${this.CACHE_KEY_PREFIX.DASHBOARD}:${dashboardId}`;
  }

  /**
   * 사용자 대시보드 목록 캐시 키 생성
   */
  private generateUserListKey(userId: number): string {
    return `${this.CACHE_KEY_PREFIX.USER_LIST}:${userId}`;
  }

  /**
   * 공유 대시보드 캐시 키 생성
   */
  private generateSharedKey(shareId: string | number): string {
    return `${this.CACHE_KEY_PREFIX.SHARED}:${shareId}`;
  }

  /**
   * 대시보드 위젯 목록 캐시 키 생성
   */
  private generateWidgetListKey(dashboardId: number): string {
    return `${this.CACHE_KEY_PREFIX.WIDGET_LIST}:${dashboardId}`;
  }

  /**
   * 대시보드 메타데이터 캐싱
   */
  async cacheDashboard(
    dashboard: Dashboard,
    widgets?: any[],
    shareInfo?: any,
    ttl?: number,
  ): Promise<void> {
    const cacheKey = this.generateDashboardKey(dashboard.id);
    const cacheData: CachedDashboard = {
      dashboard,
      widgets,
      shareInfo,
      cachedAt: Date.now(),
      ttl: ttl || this.DEFAULT_TTL,
    };

    try {
      await this.hybridCache.set(
        'dashboard',
        dashboard.id.toString(),
        cacheKey,
        cacheData,
        [],
        undefined,
        { ttl: ttl || this.DEFAULT_TTL },
      );

      this.customLogger.debug('Dashboard cached successfully', 'DashboardCacheService', {
        dashboardId: dashboard.id,
        hasWidgets: !!widgets,
        hasShareInfo: !!shareInfo,
        ttl: ttl || this.DEFAULT_TTL,
      });

      // 캐시 완료 이벤트 발생
      this.eventEmitter.emit('dashboard.cached', {
        dashboardId: dashboard.id,
        timestamp: Date.now(),
      });
    } catch (error) {
      this.logger.error(`Failed to cache dashboard ${dashboard.id}:`, error);
    }
  }

  /**
   * 캐시된 대시보드 조회
   */
  async getCachedDashboard(dashboardId: number): Promise<CachedDashboard | null> {
    const cacheKey = this.generateDashboardKey(dashboardId);

    try {
      const cached = await this.hybridCache.get('dashboard', dashboardId.toString(), cacheKey);

      if (cached) {
        this.customLogger.debug('Dashboard cache hit', 'DashboardCacheService', {
          dashboardId,
          cachedAt: cached.data.cachedAt,
        });

        return cached.data as CachedDashboard;
      }

      return null;
    } catch (error) {
      this.logger.error(`Failed to get cached dashboard ${dashboardId}:`, error);
      return null;
    }
  }

  /**
   * 사용자 대시보드 목록 캐싱
   */
  async cacheUserDashboardList(
    userId: number,
    dashboards: Dashboard[],
    ttl?: number,
  ): Promise<void> {
    const cacheKey = this.generateUserListKey(userId);

    try {
      await this.hybridCache.set(
        'dashboard',
        `user_${userId}`,
        cacheKey,
        dashboards,
        [],
        undefined,
        { ttl: ttl || this.USER_DASHBOARD_LIST_TTL },
      );

      this.customLogger.debug('User dashboard list cached', 'DashboardCacheService', {
        userId: String(userId),
        dashboardCount: dashboards.length,
        ttl: ttl || this.USER_DASHBOARD_LIST_TTL,
      });
    } catch (error) {
      this.logger.error(`Failed to cache user dashboard list for user ${userId}:`, error);
    }
  }

  /**
   * 캐시된 사용자 대시보드 목록 조회
   */
  async getCachedUserDashboardList(userId: number): Promise<Dashboard[] | null> {
    const cacheKey = this.generateUserListKey(userId);

    try {
      const cached = await this.hybridCache.get('dashboard', `user_${userId}`, cacheKey);

      if (cached) {
        this.customLogger.debug('User dashboard list cache hit', 'DashboardCacheService', {
          userId: String(userId),
          dashboardCount: cached.data.length,
        });

        return cached.data as Dashboard[];
      }

      return null;
    } catch (error) {
      this.logger.error(`Failed to get cached user dashboard list for user ${userId}:`, error);
      return null;
    }
  }

  /**
   * 공유 대시보드 캐싱
   */
  async cacheSharedDashboard(
    shareId: string | number,
    dashboard: Dashboard,
    ttl?: number,
  ): Promise<void> {
    const cacheKey = this.generateSharedKey(shareId);

    try {
      await this.hybridCache.set(
        'dashboard',
        `share_${shareId}`,
        cacheKey,
        dashboard,
        [],
        undefined,
        { ttl: ttl || this.SHARED_DASHBOARD_TTL },
      );

      this.customLogger.debug('Shared dashboard cached', 'DashboardCacheService', {
        shareId,
        dashboardId: dashboard.id,
        ttl: ttl || this.SHARED_DASHBOARD_TTL,
      });
    } catch (error) {
      this.logger.error(`Failed to cache shared dashboard ${shareId}:`, error);
    }
  }

  /**
   * 캐시된 공유 대시보드 조회
   */
  async getCachedSharedDashboard(shareId: string | number): Promise<Dashboard | null> {
    const cacheKey = this.generateSharedKey(shareId);

    try {
      const cached = await this.hybridCache.get('dashboard', `share_${shareId}`, cacheKey);

      if (cached) {
        this.customLogger.debug('Shared dashboard cache hit', 'DashboardCacheService', {
          shareId,
        });

        return cached.data as Dashboard;
      }

      return null;
    } catch (error) {
      this.logger.error(`Failed to get cached shared dashboard ${shareId}:`, error);
      return null;
    }
  }

  /**
   * 대시보드 위젯 목록 캐싱
   */
  async cacheDashboardWidgets(dashboardId: number, widgets: any[], ttl?: number): Promise<void> {
    const cacheKey = this.generateWidgetListKey(dashboardId);

    try {
      await this.hybridCache.set(
        'dashboard',
        `widgets_${dashboardId}`,
        cacheKey,
        widgets,
        [],
        undefined,
        { ttl: ttl || this.DEFAULT_TTL },
      );

      this.customLogger.debug('Dashboard widgets cached', 'DashboardCacheService', {
        dashboardId,
        widgetCount: widgets.length,
        ttl: ttl || this.DEFAULT_TTL,
      });
    } catch (error) {
      this.logger.error(`Failed to cache widgets for dashboard ${dashboardId}:`, error);
    }
  }

  /**
   * 캐시된 대시보드 위젯 목록 조회
   */
  async getCachedDashboardWidgets(dashboardId: number): Promise<any[] | null> {
    const cacheKey = this.generateWidgetListKey(dashboardId);

    try {
      const cached = await this.hybridCache.get('dashboard', `widgets_${dashboardId}`, cacheKey);

      if (cached) {
        this.customLogger.debug('Dashboard widgets cache hit', 'DashboardCacheService', {
          dashboardId,
          widgetCount: cached.data.length,
        });

        return cached.data as any[];
      }

      return null;
    } catch (error) {
      this.logger.error(`Failed to get cached widgets for dashboard ${dashboardId}:`, error);
      return null;
    }
  }

  /**
   * 대시보드 캐시 무효화
   */
  async invalidateDashboard(dashboardId: number): Promise<void> {
    try {
      const keys = [
        this.generateDashboardKey(dashboardId),
        this.generateWidgetListKey(dashboardId),
      ];

      // 각 키에 대해 무효화
      await Promise.all(keys.map(key => this.hybridCache.invalidateByQuery('dashboard', key)));

      this.customLogger.log('Dashboard cache invalidated', 'DashboardCacheService', {
        dashboardId,
      });

      // 캐시 무효화 이벤트 발생
      this.eventEmitter.emit('dashboard.cache.invalidated', {
        dashboardId,
        timestamp: Date.now(),
      });
    } catch (error) {
      this.logger.error(`Failed to invalidate dashboard cache ${dashboardId}:`, error);
    }
  }

  /**
   * 사용자 대시보드 목록 캐시 무효화
   */
  async invalidateUserDashboardList(userId: number): Promise<void> {
    try {
      const cacheKey = this.generateUserListKey(userId);
      await this.hybridCache.invalidateByQuery('dashboard', cacheKey);

      this.customLogger.log('User dashboard list cache invalidated', 'DashboardCacheService', {
        userId: String(userId),
      });
    } catch (error) {
      this.logger.error(`Failed to invalidate user dashboard list for user ${userId}:`, error);
    }
  }

  /**
   * 공유 대시보드 캐시 무효화
   */
  async invalidateSharedDashboard(shareId: string | number): Promise<void> {
    try {
      const cacheKey = this.generateSharedKey(shareId);
      await this.hybridCache.invalidateByQuery('dashboard', cacheKey);

      this.customLogger.log('Shared dashboard cache invalidated', 'DashboardCacheService', {
        shareId,
      });
    } catch (error) {
      this.logger.error(`Failed to invalidate shared dashboard ${shareId}:`, error);
    }
  }

  /**
   * 대시보드 관련 모든 캐시 무효화
   */
  async invalidateAllDashboardCaches(dashboardId: number, userId?: number): Promise<void> {
    try {
      // 대시보드 자체 캐시 무효화
      await this.invalidateDashboard(dashboardId);

      // 사용자 대시보드 목록 캐시 무효화
      if (userId) {
        await this.invalidateUserDashboardList(userId);
      }

      this.customLogger.log('All dashboard caches invalidated', 'DashboardCacheService', {
        dashboardId,
        userId: userId ? String(userId) : undefined,
      });
    } catch (error) {
      this.logger.error('Failed to invalidate all dashboard caches:', error);
    }
  }

  /**
   * 캐시 통계 조회
   */
  async getCacheStats(): Promise<any> {
    try {
      const stats = await this.hybridCache.getHybridStats('dashboard');
      return stats;
    } catch (error) {
      this.logger.error('Failed to get dashboard cache stats:', error);
      return null;
    }
  }

  /**
   * 인기 대시보드 조회 (캐시 워밍업용)
   */
  async getPopularDashboardIds(limit = 20): Promise<number[]> {
    // TODO: 실제 사용 통계를 기반으로 인기 대시보드 조회
    // 현재는 캐시된 대시보드 중 히트율이 높은 것들을 반환
    try {
      const stats = await this.getCacheStats();
      if (!stats) return [];

      // 캐시 통계에서 자주 접근되는 대시보드 ID 추출
      // 실제 구현은 비즈니스 로직에 따라 달라질 수 있음
      return [];
    } catch (error) {
      this.logger.error('Failed to get popular dashboard IDs:', error);
      return [];
    }
  }
}
