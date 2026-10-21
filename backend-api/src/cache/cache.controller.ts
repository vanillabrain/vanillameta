import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { QueryCacheService } from './services/query-cache.service';
import { CacheStatisticsService } from './services/cache-statistics.service';
import { CacheInvalidationService } from './services/cache-invalidation.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { ResponseStatus } from '../common/enum/response-status.enum';

@Controller('api/v1/cache')
@UseGuards(JwtAuthGuard)
export class CacheController {
  constructor(
    private readonly cacheService: QueryCacheService,
    private readonly statisticsService: CacheStatisticsService,
    private readonly invalidationService: CacheInvalidationService,
  ) {}

  /**
   * 전체 캐시 통계 조회
   */
  @Get('statistics')
  async getCacheStatistics(@Query('periodHours') periodHours = 24) {
    try {
      const statistics = await this.statisticsService.getCacheStatistics(Number(periodHours));
      const memoryInfo = this.statisticsService.getMemoryInfo();

      return {
        status: ResponseStatus.SUCCESS,
        data: {
          statistics,
          memoryInfo,
          periodHours: Number(periodHours),
        },
      };
    } catch (error) {
      return {
        status: ResponseStatus.ERROR,
        message: `Failed to get cache statistics: ${error.message}`,
      };
    }
  }

  /**
   * 데이터베이스별 캐시 통계 조회
   */
  @Get('statistics/database/:databaseId')
  async getDatabaseCacheStatistics(
    @Param('databaseId') databaseId: number,
    @Query('periodHours') periodHours = 24,
  ) {
    try {
      const statistics = await this.statisticsService.getDatabaseCacheStatistics(
        Number(databaseId),
        Number(periodHours),
      );

      return {
        status: ResponseStatus.SUCCESS,
        data: {
          statistics,
          databaseId: Number(databaseId),
          periodHours: Number(periodHours),
        },
      };
    } catch (error) {
      return {
        status: ResponseStatus.ERROR,
        message: `Failed to get database cache statistics: ${error.message}`,
      };
    }
  }

  /**
   * 사용자별 캐시 통계 조회
   */
  @Get('statistics/user')
  async getUserCacheStatistics(@GetUser() user: any, @Query('periodHours') periodHours = 24) {
    try {
      const statistics = await this.statisticsService.getUserCacheStatistics(
        user.userId,
        Number(periodHours),
      );

      return {
        status: ResponseStatus.SUCCESS,
        data: {
          statistics,
          userId: user.userId,
          periodHours: Number(periodHours),
        },
      };
    } catch (error) {
      return {
        status: ResponseStatus.ERROR,
        message: `Failed to get user cache statistics: ${error.message}`,
      };
    }
  }

  /**
   * 캐시 성능 트렌드 조회
   */
  @Get('trend')
  async getCachePerformanceTrend(@Query('periodHours') periodHours = 24) {
    try {
      const trend = await this.statisticsService.getCachePerformanceTrend(Number(periodHours));

      return {
        status: ResponseStatus.SUCCESS,
        data: trend,
      };
    } catch (error) {
      return {
        status: ResponseStatus.ERROR,
        message: `Failed to get cache performance trend: ${error.message}`,
      };
    }
  }

  /**
   * 패턴으로 캐시 무효화
   */
  @Post('invalidate/pattern')
  @HttpCode(HttpStatus.OK)
  async invalidateByPattern(
    @Body() body: { pattern: string; reason?: string },
    @GetUser() user: any,
  ) {
    try {
      const invalidatedKeys = await this.invalidationService.invalidateByPattern(
        body.pattern,
        body.reason || `Manual invalidation by user ${user.userId}`,
      );

      return {
        status: ResponseStatus.SUCCESS,
        data: {
          invalidatedKeys,
          invalidatedCount: invalidatedKeys.length,
          pattern: body.pattern,
          executedBy: user.userId,
        },
        message: `Successfully invalidated ${invalidatedKeys.length} cache entries`,
      };
    } catch (error) {
      return {
        status: ResponseStatus.ERROR,
        message: `Failed to invalidate cache: ${error.message}`,
      };
    }
  }

  /**
   * 데이터베이스 캐시 무효화
   */
  @Post('invalidate/database/:databaseId')
  @HttpCode(HttpStatus.OK)
  async invalidateDatabaseCache(
    @Param('databaseId') databaseId: number,
    @Body() body: { reason?: string },
    @GetUser() user: any,
  ) {
    try {
      const invalidatedKeys = await this.invalidationService.invalidateDatabaseCache(
        Number(databaseId),
        body.reason || `Database cache invalidation by user ${user.userId}`,
      );

      return {
        status: ResponseStatus.SUCCESS,
        data: {
          invalidatedKeys,
          invalidatedCount: invalidatedKeys.length,
          databaseId: Number(databaseId),
          executedBy: user.userId,
        },
        message: `Successfully invalidated ${invalidatedKeys.length} cache entries for database ${databaseId}`,
      };
    } catch (error) {
      return {
        status: ResponseStatus.ERROR,
        message: `Failed to invalidate database cache: ${error.message}`,
      };
    }
  }

  /**
   * 사용자 캐시 무효화
   */
  @Post('invalidate/user')
  @HttpCode(HttpStatus.OK)
  async invalidateUserCache(
    @Body() body: { userId?: string; reason?: string },
    @GetUser() user: any,
  ) {
    try {
      const targetUserId = body.userId || user.userId;
      const invalidatedKeys = await this.invalidationService.invalidateUserCache(
        targetUserId,
        body.reason || `User cache invalidation by user ${user.userId}`,
      );

      return {
        status: ResponseStatus.SUCCESS,
        data: {
          invalidatedKeys,
          invalidatedCount: invalidatedKeys.length,
          targetUserId,
          executedBy: user.userId,
        },
        message: `Successfully invalidated ${invalidatedKeys.length} cache entries for user ${targetUserId}`,
      };
    } catch (error) {
      return {
        status: ResponseStatus.ERROR,
        message: `Failed to invalidate user cache: ${error.message}`,
      };
    }
  }

  /**
   * 테이블 변경 기반 캐시 무효화
   */
  @Post('invalidate/table')
  @HttpCode(HttpStatus.OK)
  async invalidateByTableChange(
    @Body()
    body: {
      tableName: string;
      changeType: 'INSERT' | 'UPDATE' | 'DELETE';
      reason?: string;
    },
    @GetUser() user: any,
  ) {
    try {
      const invalidatedKeys = await this.invalidationService.invalidateByTableChange(
        body.tableName,
        body.changeType,
      );

      return {
        status: ResponseStatus.SUCCESS,
        data: {
          invalidatedKeys,
          invalidatedCount: invalidatedKeys.length,
          tableName: body.tableName,
          changeType: body.changeType,
          executedBy: user.userId,
        },
        message: `Successfully invalidated ${invalidatedKeys.length} cache entries for table ${body.tableName}`,
      };
    } catch (error) {
      return {
        status: ResponseStatus.ERROR,
        message: `Failed to invalidate cache by table change: ${error.message}`,
      };
    }
  }

  /**
   * 무효화 규칙 추가
   */
  @Post('invalidation-rules')
  async addInvalidationRule(
    @Body()
    body: {
      pattern: string;
      condition: 'time_based' | 'event_based' | 'manual';
      intervalMinutes?: number;
      tablesToWatch?: string[];
      priority: 'low' | 'medium' | 'high';
      description: string;
    },
    @GetUser() user: any,
  ) {
    try {
      const ruleId = await this.invalidationService.addInvalidationRule({
        ...body,
        description: `${body.description} (Created by ${user.userId})`,
      });

      return {
        status: ResponseStatus.SUCCESS,
        data: {
          ruleId,
          rule: body,
          createdBy: user.userId,
        },
        message: 'Invalidation rule created successfully',
      };
    } catch (error) {
      return {
        status: ResponseStatus.ERROR,
        message: `Failed to create invalidation rule: ${error.message}`,
      };
    }
  }

  /**
   * 무효화 규칙 목록 조회
   */
  @Get('invalidation-rules')
  async getInvalidationRules() {
    try {
      const rules = this.invalidationService.getInvalidationRules();

      return {
        status: ResponseStatus.SUCCESS,
        data: {
          rules,
          totalRules: rules.length,
        },
      };
    } catch (error) {
      return {
        status: ResponseStatus.ERROR,
        message: `Failed to get invalidation rules: ${error.message}`,
      };
    }
  }

  /**
   * 무효화 규칙 삭제
   */
  @Delete('invalidation-rules/:ruleId')
  async removeInvalidationRule(@Param('ruleId') ruleId: string, @GetUser() user: any) {
    try {
      await this.invalidationService.removeInvalidationRule(ruleId);

      return {
        status: ResponseStatus.SUCCESS,
        data: {
          ruleId,
          deletedBy: user.userId,
        },
        message: 'Invalidation rule deleted successfully',
      };
    } catch (error) {
      return {
        status: ResponseStatus.ERROR,
        message: `Failed to delete invalidation rule: ${error.message}`,
      };
    }
  }

  /**
   * 무효화 히스토리 조회
   */
  @Get('invalidation-history')
  async getInvalidationHistory(@Query('limit') limit = 100) {
    try {
      const history = this.invalidationService.getInvalidationHistory(Number(limit));

      return {
        status: ResponseStatus.SUCCESS,
        data: {
          history,
          totalEvents: history.length,
          limit: Number(limit),
        },
      };
    } catch (error) {
      return {
        status: ResponseStatus.ERROR,
        message: `Failed to get invalidation history: ${error.message}`,
      };
    }
  }

  /**
   * 무효화 통계 조회
   */
  @Get('invalidation-statistics')
  async getInvalidationStatistics() {
    try {
      const statistics = this.invalidationService.getInvalidationStatistics();

      return {
        status: ResponseStatus.SUCCESS,
        data: statistics,
      };
    } catch (error) {
      return {
        status: ResponseStatus.ERROR,
        message: `Failed to get invalidation statistics: ${error.message}`,
      };
    }
  }

  /**
   * 전체 캐시 상태 대시보드
   */
  @Get('dashboard')
  async getCacheDashboard(@Query('periodHours') periodHours = 24) {
    try {
      const [statistics, memoryInfo, trend, invalidationStats, recentInvalidations] =
        await Promise.all([
          this.statisticsService.getCacheStatistics(Number(periodHours)),
          this.statisticsService.getMemoryInfo(),
          this.statisticsService.getCachePerformanceTrend(Number(periodHours)),
          this.invalidationService.getInvalidationStatistics(),
          this.invalidationService.getInvalidationHistory(10),
        ]);

      return {
        status: ResponseStatus.SUCCESS,
        data: {
          overview: {
            hitRate: statistics.hitRate,
            totalRequests: statistics.totalHits + statistics.totalMisses,
            cacheEfficiency: statistics.cacheEfficiency,
            memoryUsage: memoryInfo.estimatedMemoryKB,
          },
          statistics,
          memoryInfo,
          trend,
          invalidationStats,
          recentInvalidations,
          periodHours: Number(periodHours),
        },
      };
    } catch (error) {
      return {
        status: ResponseStatus.ERROR,
        message: `Failed to get cache dashboard: ${error.message}`,
      };
    }
  }

  /**
   * 캐시 시스템 헬스체크
   */
  @Get('health')
  async healthCheck() {
    try {
      const memoryInfo = this.statisticsService.getMemoryInfo();
      const statistics = await this.statisticsService.getCacheStatistics(1); // 1시간
      const invalidationStats = this.invalidationService.getInvalidationStatistics();

      // 헬스 상태 판단
      let status = 'healthy';
      const issues: string[] = [];

      if (statistics.hitRate < 30) {
        status = 'degraded';
        issues.push('Low cache hit rate');
      }

      if (memoryInfo.estimatedMemoryKB > 50000) {
        // 50MB
        status = 'degraded';
        issues.push('High memory usage');
      }

      if (invalidationStats.averageInvalidationTime > 5000) {
        // 5초
        status = status === 'healthy' ? 'degraded' : 'unhealthy';
        issues.push('Slow invalidation performance');
      }

      return {
        status: ResponseStatus.SUCCESS,
        data: {
          healthStatus: status,
          issues,
          details: {
            hitRate: statistics.hitRate,
            memoryUsageKB: memoryInfo.estimatedMemoryKB,
            totalCacheEvents: statistics.totalHits + statistics.totalMisses,
            invalidationRules: invalidationStats.totalRules,
            averageInvalidationTime: invalidationStats.averageInvalidationTime,
          },
          timestamp: new Date(),
        },
      };
    } catch (error) {
      return {
        status: ResponseStatus.ERROR,
        message: `Cache health check failed: ${error.message}`,
        data: {
          healthStatus: 'unhealthy',
          issues: ['Health check system failure'],
          timestamp: new Date(),
        },
      };
    }
  }
}
