import { Injectable, Logger } from '@nestjs/common';
import { CloudWatchMetricsService } from './cloudwatch-metrics.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Users } from '../../user/entities/users.entity';
import { Dashboard } from '../../dashboard/entities/dashboard.entity';
import { Widget } from '../../widget/entities/widget.entity';
import { TableQuery } from '../../dataset/entities/table-query.entity';

interface DailyActiveUsersResult {
  count: number;
  date: Date;
}

@Injectable()
export class BusinessMetricsService {
  private readonly logger = new Logger(BusinessMetricsService.name);
  private dailyActiveUsers = new Set<string>();
  private readonly metricsCache = new Map<string, number>();

  constructor(
    private readonly cloudWatchMetrics: CloudWatchMetricsService,
    @InjectRepository(Users)
    private readonly usersRepository: Repository<Users>,
    @InjectRepository(Dashboard)
    private readonly dashboardRepository: Repository<Dashboard>,
    @InjectRepository(Widget)
    private readonly widgetRepository: Repository<Widget>,
    @InjectRepository(TableQuery)
    private readonly tableQueryRepository: Repository<TableQuery>,
  ) {}

  /**
   * 사용자 활동 기록
   */
  async recordUserActivity(
    userId: string,
    action: string,
    resourceType: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    try {
      // DAU 추적
      this.dailyActiveUsers.add(userId);

      // CloudWatch 메트릭 전송
      await this.cloudWatchMetrics.recordUserActivity(userId, action, resourceType);

      // 특정 액션별 메트릭
      switch (action) {
        case 'dashboard_created':
          await this.recordDashboardCreation(metadata?.dashboardType || 'standard');
          break;
        case 'widget_created':
          await this.recordWidgetUsage(
            metadata?.widgetType || 'unknown',
            metadata?.chartType || 'unknown',
          );
          break;
        case 'query_executed':
          await this.recordQueryExecution(
            metadata?.databaseType || 'unknown',
            metadata?.queryComplexity || 'simple',
          );
          break;
      }

      this.logger.debug(`User activity recorded: ${action} by ${userId}`);
    } catch (error) {
      this.logger.error('Failed to record user activity:', error);
    }
  }

  /**
   * 대시보드 생성 메트릭
   */
  async recordDashboardCreation(dashboardType: string): Promise<void> {
    await this.cloudWatchMetrics.putMetric('DashboardCreated', 1, 'Count', [
      { Name: 'DashboardType', Value: dashboardType },
    ]);
  }

  /**
   * 위젯 사용 메트릭
   */
  async recordWidgetUsage(widgetType: string, chartType: string): Promise<void> {
    await this.cloudWatchMetrics.putMetric('WidgetUsage', 1, 'Count', [
      { Name: 'WidgetType', Value: widgetType },
      { Name: 'ChartType', Value: chartType },
    ]);
  }

  /**
   * 쿼리 실행 메트릭
   */
  async recordQueryExecution(
    databaseType: string,
    queryComplexity: 'simple' | 'moderate' | 'complex',
  ): Promise<void> {
    await this.cloudWatchMetrics.putMetric('QueryExecutions', 1, 'Count', [
      { Name: 'DatabaseType', Value: databaseType },
      { Name: 'QueryComplexity', Value: queryComplexity },
    ]);
  }

  /**
   * API 가용성 메트릭 계산 및 전송
   */
  async recordApiAvailability(
    endpoint: string,
    method: string,
    statusCode: number,
  ): Promise<void> {
    const isSuccess = statusCode >= 200 && statusCode < 400;
    
    // 성공/실패 카운트
    await this.cloudWatchMetrics.putMetric(
      isSuccess ? 'ApiSuccessCount' : 'ApiFailureCount',
      1,
      'Count',
      [
        { Name: 'Endpoint', Value: endpoint },
        { Name: 'Method', Value: method },
      ],
    );

    // 에러율 계산을 위한 상태 코드별 메트릭
    if (statusCode >= 400 && statusCode < 500) {
      await this.cloudWatchMetrics.putMetric('Http4xxErrors', 1, 'Count', [
        { Name: 'Endpoint', Value: endpoint },
        { Name: 'Method', Value: method },
        { Name: 'StatusCode', Value: statusCode.toString() },
      ]);
    } else if (statusCode >= 500) {
      await this.cloudWatchMetrics.putMetric('Http5xxErrors', 1, 'Count', [
        { Name: 'Endpoint', Value: endpoint },
        { Name: 'Method', Value: method },
        { Name: 'StatusCode', Value: statusCode.toString() },
      ]);
    }
  }

  /**
   * 쿼리 성능 메트릭
   */
  async recordQueryPerformance(
    databaseId: string,
    queryType: string,
    duration: number,
    rowCount: number,
  ): Promise<void> {
    // 쿼리 복잡도 계산
    const complexity = this.calculateQueryComplexity(duration, rowCount);

    await this.cloudWatchMetrics.putMetric('DatabaseQueryDuration', duration, 'Seconds', [
      { Name: 'DatabaseId', Value: databaseId },
      { Name: 'QueryType', Value: queryType },
      { Name: 'QueryComplexity', Value: complexity },
    ]);

    // 느린 쿼리 추적
    if (duration > 500) {
      await this.cloudWatchMetrics.putMetric('SlowQueryCount', 1, 'Count', [
        { Name: 'DatabaseId', Value: databaseId },
        { Name: 'QueryType', Value: queryType },
      ]);
    }
  }

  /**
   * Lambda Cold Start 추적
   */
  async recordLambdaColdStart(isColdStart: boolean): Promise<void> {
    if (isColdStart) {
      await this.cloudWatchMetrics.putMetric('LambdaColdStarts', 1, 'Count', [
        { Name: 'Function', Value: 'backend-api' },
      ]);
    }

    await this.cloudWatchMetrics.putMetric('LambdaInvocations', 1, 'Count', [
      { Name: 'Function', Value: 'backend-api' },
      { Name: 'StartType', Value: isColdStart ? 'Cold' : 'Warm' },
    ]);
  }

  /**
   * 일일 활성 사용자(DAU) 집계 및 전송
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async calculateAndSendDAU(): Promise<void> {
    try {
      const dauCount = this.dailyActiveUsers.size;
      
      await this.cloudWatchMetrics.putMetric('DailyActiveUsers', dauCount, 'Count', [
        { Name: 'MetricType', Value: 'DAU' },
      ]);

      this.logger.log(`DAU calculated and sent: ${dauCount} users`);
      
      // 다음 날을 위해 리셋
      this.dailyActiveUsers.clear();
    } catch (error) {
      this.logger.error('Failed to calculate DAU:', error);
    }
  }

  /**
   * 시간별 활성 사용자(HAU) 집계
   */
  @Cron(CronExpression.EVERY_HOUR)
  async calculateAndSendHAU(): Promise<void> {
    try {
      const hauCount = this.dailyActiveUsers.size;
      
      await this.cloudWatchMetrics.putMetric('HourlyActiveUsers', hauCount, 'Count', [
        { Name: 'MetricType', Value: 'HAU' },
      ]);
    } catch (error) {
      this.logger.error('Failed to calculate HAU:', error);
    }
  }

  /**
   * 비즈니스 메트릭 요약 통계
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async collectBusinessMetricsSummary(): Promise<void> {
    try {
      // 대시보드 통계
      const dashboardStats = await this.dashboardRepository
        .createQueryBuilder('dashboard')
        .select('COUNT(*)', 'total')
        .addSelect('SUM(CASE WHEN dashboard.createdAt > DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN 1 ELSE 0 END)', 'daily')
        .getRawOne();

      await this.cloudWatchMetrics.putMetric(
        'TotalDashboards',
        parseInt(dashboardStats.total),
        'Count',
        [{ Name: 'MetricType', Value: 'Total' }],
      );

      // 위젯 통계
      const widgetStats = await this.widgetRepository
        .createQueryBuilder('widget')
        .select('widget.componentId', 'componentId')
        .addSelect('COUNT(*)', 'count')
        .groupBy('widget.componentId')
        .getRawMany();

      for (const stat of widgetStats) {
        await this.cloudWatchMetrics.putMetric('WidgetCount', parseInt(stat.count), 'Count', [
          { Name: 'ComponentId', Value: stat.componentId },
        ]);
      }

      // 쿼리 통계
      const queryStats = await this.tableQueryRepository
        .createQueryBuilder('query')
        .select('COUNT(*)', 'total')
        .addSelect('AVG(CASE WHEN query.createdAt > DATE_SUB(NOW(), INTERVAL 1 HOUR) THEN 1 ELSE 0 END)', 'hourlyRate')
        .getRawOne();

      await this.cloudWatchMetrics.putMetric(
        'TotalQueries',
        parseInt(queryStats.total),
        'Count',
        [{ Name: 'MetricType', Value: 'Total' }],
      );

      this.logger.debug('Business metrics summary collected');
    } catch (error) {
      this.logger.error('Failed to collect business metrics summary:', error);
    }
  }

  /**
   * SLI/SLO 계산 및 전송
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async calculateSLIs(): Promise<void> {
    try {
      // 이 메서드는 CloudWatch Metrics Math를 사용하여
      // 대시보드에서 계산되는 것이 더 효율적이지만,
      // 여기서는 주요 SLI를 추적하기 위한 플래그만 전송
      
      await this.cloudWatchMetrics.putMetric('SLICalculationRun', 1, 'Count', [
        { Name: 'Type', Value: 'Availability' },
      ]);

      await this.cloudWatchMetrics.putMetric('SLICalculationRun', 1, 'Count', [
        { Name: 'Type', Value: 'Latency' },
      ]);

      await this.cloudWatchMetrics.putMetric('SLICalculationRun', 1, 'Count', [
        { Name: 'Type', Value: 'ErrorRate' },
      ]);
    } catch (error) {
      this.logger.error('Failed to calculate SLIs:', error);
    }
  }

  /**
   * 쿼리 복잡도 계산
   */
  private calculateQueryComplexity(duration: number, rowCount: number): string {
    if (duration < 50 && rowCount < 100) {
      return 'simple';
    } else if (duration < 200 && rowCount < 1000) {
      return 'moderate';
    } else {
      return 'complex';
    }
  }

  /**
   * 비즈니스 메트릭 상태 조회
   */
  async getMetricsSummary(): Promise<Record<string, any>> {
    return {
      dailyActiveUsers: this.dailyActiveUsers.size,
      cachedMetrics: Object.fromEntries(this.metricsCache),
      lastUpdate: new Date().toISOString(),
    };
  }
}