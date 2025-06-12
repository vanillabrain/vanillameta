import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CustomLoggerService } from '../logger/logger.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { knexConnections } from '../../connection/connection.service';

export interface PoolMetrics {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  waitingRequests: number;
  connectionUtilization: number;
  timestamp: Date;
}

@Injectable()
export class ConnectionPoolMonitorService {
  private metricsHistory: PoolMetrics[] = [];
  private readonly maxHistorySize = 100;

  constructor(
    @InjectDataSource() private dataSource: DataSource,
    private readonly logger: CustomLoggerService,
  ) {}

  /**
   * TypeORM 연결 풀 메트릭 수집
   */
  async collectTypeOrmMetrics(): Promise<PoolMetrics | null> {
    try {
      const driver = this.dataSource.driver as any;
      const pool = driver.pool;

      if (!pool) {
        return null;
      }

      // MySQL2 드라이버의 경우
      if (pool._allConnections) {
        const metrics: PoolMetrics = {
          totalConnections: pool._allConnections.length,
          activeConnections: pool._activeConnections?.length || 0,
          idleConnections: pool._freeConnections?.length || 0,
          waitingRequests: pool._connectionQueue?.length || 0,
          connectionUtilization: 0,
          timestamp: new Date(),
        };

        // 연결 사용률 계산
        if (metrics.totalConnections > 0) {
          metrics.connectionUtilization =
            (metrics.activeConnections / metrics.totalConnections) * 100;
        }

        return metrics;
      }

      return null;
    } catch (error) {
      this.logger.error('Failed to collect TypeORM metrics', error.stack, 'ConnectionPoolMonitor');
      return null;
    }
  }

  /**
   * Knex 연결 풀 메트릭 수집
   */
  async collectKnexMetrics(knexInstance: any): Promise<PoolMetrics | null> {
    try {
      const pool = knexInstance.client.pool;

      if (!pool) {
        return null;
      }

      const metrics: PoolMetrics = {
        totalConnections: pool.numUsed() + pool.numFree(),
        activeConnections: pool.numUsed(),
        idleConnections: pool.numFree(),
        waitingRequests: pool.numPendingAcquires(),
        connectionUtilization: 0,
        timestamp: new Date(),
      };

      // 연결 사용률 계산
      if (metrics.totalConnections > 0) {
        metrics.connectionUtilization =
          (metrics.activeConnections / metrics.totalConnections) * 100;
      }

      return metrics;
    } catch (error) {
      this.logger.error('Failed to collect Knex metrics', error.stack, 'ConnectionPoolMonitor');
      return null;
    }
  }

  /**
   * 메트릭을 히스토리에 추가
   */
  private addToHistory(metrics: PoolMetrics): void {
    this.metricsHistory.push(metrics);

    // 최대 크기 유지
    if (this.metricsHistory.length > this.maxHistorySize) {
      this.metricsHistory.shift();
    }
  }

  /**
   * 모든 Knex 연결의 메트릭 수집
   */
  async collectAllKnexMetrics(): Promise<Map<number, PoolMetrics>> {
    const allMetrics = new Map<number, PoolMetrics>();

    for (const [dbId, knexInstance] of knexConnections) {
      const metrics = await this.collectKnexMetrics(knexInstance);
      if (metrics) {
        allMetrics.set(dbId, metrics);
      }
    }

    return allMetrics;
  }

  /**
   * 현재 메트릭 및 통계 반환
   */
  async getMetrics(): Promise<{
    current: PoolMetrics | null;
    knexPools: Map<number, PoolMetrics>;
    statistics: {
      avgUtilization: number;
      maxUtilization: number;
      avgActiveConnections: number;
      connectionReusability: number;
    };
  }> {
    const currentMetrics = await this.collectTypeOrmMetrics();

    if (currentMetrics) {
      this.addToHistory(currentMetrics);
    }

    // 통계 계산
    const recentMetrics = this.metricsHistory.slice(-20); // 최근 20개
    const statistics = {
      avgUtilization: 0,
      maxUtilization: 0,
      avgActiveConnections: 0,
      connectionReusability: 0,
    };

    if (recentMetrics.length > 0) {
      statistics.avgUtilization =
        recentMetrics.reduce((sum, m) => sum + m.connectionUtilization, 0) / recentMetrics.length;

      statistics.maxUtilization = Math.max(...recentMetrics.map(m => m.connectionUtilization));

      statistics.avgActiveConnections =
        recentMetrics.reduce((sum, m) => sum + m.activeConnections, 0) / recentMetrics.length;

      // 연결 재사용률 계산 (idle connections가 있는 비율)
      const withIdleConnections = recentMetrics.filter(m => m.idleConnections > 0).length;
      statistics.connectionReusability = (withIdleConnections / recentMetrics.length) * 100;
    }

    // Knex 연결 풀 메트릭도 수집
    const knexMetrics = await this.collectAllKnexMetrics();

    return {
      current: currentMetrics,
      knexPools: knexMetrics,
      statistics,
    };
  }

  /**
   * 주기적으로 메트릭 수집 및 로깅 (프로덕션에서만 활성화)
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async collectAndLogMetrics(): Promise<void> {
    if (process.env.NODE_ENV !== 'prod') {
      return;
    }

    const metrics = await this.getMetrics();

    if (metrics.current) {
      this.logger.info('Connection pool metrics', 'ConnectionPoolMonitor', {
        typeorm: metrics.current,
        knexPoolsCount: metrics.knexPools.size,
        statistics: metrics.statistics,
      });

      // 경고 조건 확인
      if (metrics.current.connectionUtilization > 80) {
        this.logger.warn('High connection pool utilization', 'ConnectionPoolMonitor', {
          utilization: metrics.current.connectionUtilization,
          activeConnections: metrics.current.activeConnections,
          totalConnections: metrics.current.totalConnections,
        });
      }

      if (metrics.current.waitingRequests > 0) {
        this.logger.warn('Connection pool has waiting requests', 'ConnectionPoolMonitor', {
          waitingRequests: metrics.current.waitingRequests,
          activeConnections: metrics.current.activeConnections,
        });
      }
    }
  }

  /**
   * 연결 풀 상태 확인 (헬스체크용)
   */
  async checkPoolHealth(): Promise<{
    isHealthy: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];
    const metrics = await this.getMetrics();

    if (!metrics.current) {
      issues.push('Unable to collect connection pool metrics');
      return { isHealthy: false, issues };
    }

    // 연결 사용률이 90% 이상
    if (metrics.current.connectionUtilization > 90) {
      issues.push(
        `Connection pool utilization is very high: ${metrics.current.connectionUtilization.toFixed(
          2,
        )}%`,
      );
    }

    // 대기 중인 요청이 있음
    if (metrics.current.waitingRequests > 0) {
      issues.push(`${metrics.current.waitingRequests} requests waiting for connections`);
    }

    // 연결 재사용률이 낮음 (50% 미만)
    if (metrics.statistics.connectionReusability < 50) {
      issues.push(
        `Low connection reusability: ${metrics.statistics.connectionReusability.toFixed(2)}%`,
      );
    }

    return {
      isHealthy: issues.length === 0,
      issues,
    };
  }
}
