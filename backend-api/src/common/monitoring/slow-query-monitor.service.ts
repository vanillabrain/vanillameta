import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThan } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as crypto from 'crypto';
import { SlowQueryLog } from './entities/slow-query-log.entity';
import { QueryAnalysis } from './query-analyzer.service';

export interface SlowQueryMonitorConfig {
  enabled: boolean;
  threshold: number; // ms
  maxLogEntries: number;
  cleanupIntervalDays: number;
  alertThresholds: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
}

export interface SlowQueryStats {
  totalSlowQueries: number;
  avgExecutionTime: number;
  maxExecutionTime: number;
  mostFrequentQueries: Array<{
    queryHash: string;
    query: string;
    count: number;
    avgExecutionTime: number;
  }>;
  performanceByDatabase: Array<{
    databaseId: number;
    databaseEngine: string;
    count: number;
    avgExecutionTime: number;
  }>;
  severityDistribution: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  trendsLast24Hours: Array<{
    hour: string;
    count: number;
    avgExecutionTime: number;
  }>;
}

@Injectable()
export class SlowQueryMonitorService {
  private readonly logger = new Logger(SlowQueryMonitorService.name);

  private config: SlowQueryMonitorConfig = {
    enabled: true,
    threshold: 1000, // 1초
    maxLogEntries: 10000,
    cleanupIntervalDays: 30,
    alertThresholds: {
      low: 1000, // 1초
      medium: 3000, // 3초
      high: 10000, // 10초
      critical: 30000, // 30초
    },
  };

  constructor(
    @InjectRepository(SlowQueryLog)
    private slowQueryLogRepository: Repository<SlowQueryLog>,
  ) {}

  /**
   * 슬로우 쿼리 기록
   */
  async logSlowQuery(
    analysis: QueryAnalysis,
    metadata: {
      databaseId?: number;
      databaseEngine?: string;
      userId?: string;
      requestPath?: string;
      httpMethod?: string;
      clientIp?: string;
      userAgent?: string;
      requestId?: string;
      parameters?: any[];
    } = {},
  ): Promise<void> {
    if (
      !this.config.enabled ||
      !analysis.executionTime ||
      analysis.executionTime < this.config.threshold
    ) {
      return;
    }

    try {
      // 쿼리 해시 생성 (중복 방지용)
      const queryHash = this.generateQueryHash(analysis.query, metadata.parameters);

      // 심각도 결정
      const severity = this.determineSeverity(analysis.executionTime);

      const slowQueryLog = new SlowQueryLog();
      slowQueryLog.queryHash = queryHash;
      slowQueryLog.query = analysis.query;
      slowQueryLog.parameters = metadata.parameters ? JSON.stringify(metadata.parameters) : null;
      slowQueryLog.executionTime = analysis.executionTime;
      slowQueryLog.databaseId = metadata.databaseId;
      slowQueryLog.databaseEngine = metadata.databaseEngine;
      slowQueryLog.rowsExamined = analysis.rowsExamined;
      slowQueryLog.rowsReturned = analysis.rowsReturned;
      slowQueryLog.indexUsed = analysis.indexUsed || false;
      slowQueryLog.scanType = analysis.scanType;
      slowQueryLog.temporaryTable = analysis.temporaryTable || false;
      slowQueryLog.filesort = analysis.filesort || false;
      slowQueryLog.cost = analysis.cost;
      slowQueryLog.warnings = analysis.warnings ? JSON.stringify(analysis.warnings) : null;
      slowQueryLog.optimizationSuggestions = analysis.optimizationSuggestions
        ? JSON.stringify(analysis.optimizationSuggestions)
        : null;
      slowQueryLog.explainPlan = analysis.explainPlan;
      slowQueryLog.userId = metadata.userId;
      slowQueryLog.requestPath = metadata.requestPath;
      slowQueryLog.httpMethod = metadata.httpMethod;
      slowQueryLog.clientIp = metadata.clientIp;
      slowQueryLog.userAgent = metadata.userAgent;
      slowQueryLog.requestId = metadata.requestId;
      slowQueryLog.severity = severity;
      slowQueryLog.detectedAt = new Date();

      await this.slowQueryLogRepository.save(slowQueryLog);

      this.logger.warn({
        message: `Slow query detected [${severity}]`,
        executionTime: analysis.executionTime,
        queryHash,
        databaseId: metadata.databaseId,
        userId: metadata.userId,
        requestId: metadata.requestId,
      });

      // Critical 수준의 쿼리는 즉시 알림
      if (severity === 'CRITICAL') {
        await this.sendCriticalQueryAlert(slowQueryLog);
      }
    } catch (error) {
      this.logger.error(`Failed to log slow query: ${error.message}`, error.stack);
    }
  }

  /**
   * 슬로우 쿼리 통계 조회
   */
  async getSlowQueryStats(periodHours = 24): Promise<SlowQueryStats> {
    const startDate = new Date(Date.now() - periodHours * 60 * 60 * 1000);

    try {
      const [
        totalQueries,
        avgExecutionTime,
        maxExecutionTime,
        mostFrequentQueries,
        performanceByDatabase,
        severityDistribution,
        trends,
      ] = await Promise.all([
        this.getTotalSlowQueries(startDate),
        this.getAverageExecutionTime(startDate),
        this.getMaxExecutionTime(startDate),
        this.getMostFrequentQueries(startDate, 10),
        this.getPerformanceByDatabase(startDate),
        this.getSeverityDistribution(startDate),
        this.getTrends24Hours(),
      ]);

      return {
        totalSlowQueries: totalQueries,
        avgExecutionTime: avgExecutionTime || 0,
        maxExecutionTime: maxExecutionTime || 0,
        mostFrequentQueries,
        performanceByDatabase,
        severityDistribution,
        trendsLast24Hours: trends,
      };
    } catch (error) {
      this.logger.error(`Failed to get slow query stats: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 슬로우 쿼리 목록 조회 (페이징)
   */
  async getSlowQueries(
    page = 1,
    limit = 50,
    filters: {
      startDate?: Date;
      endDate?: Date;
      databaseId?: number;
      severity?: string;
      minExecutionTime?: number;
      maxExecutionTime?: number;
      resolved?: boolean;
    } = {},
  ): Promise<{ data: SlowQueryLog[]; total: number; page: number; limit: number }> {
    const query = this.slowQueryLogRepository.createQueryBuilder('sql');

    // 필터링
    if (filters.startDate) {
      query.andWhere('sql.detectedAt >= :startDate', { startDate: filters.startDate });
    }
    if (filters.endDate) {
      query.andWhere('sql.detectedAt <= :endDate', { endDate: filters.endDate });
    }
    if (filters.databaseId) {
      query.andWhere('sql.databaseId = :databaseId', { databaseId: filters.databaseId });
    }
    if (filters.severity) {
      query.andWhere('sql.severity = :severity', { severity: filters.severity });
    }
    if (filters.minExecutionTime) {
      query.andWhere('sql.executionTime >= :minExecutionTime', {
        minExecutionTime: filters.minExecutionTime,
      });
    }
    if (filters.maxExecutionTime) {
      query.andWhere('sql.executionTime <= :maxExecutionTime', {
        maxExecutionTime: filters.maxExecutionTime,
      });
    }
    if (filters.resolved !== undefined) {
      query.andWhere('sql.resolved = :resolved', { resolved: filters.resolved });
    }

    // 정렬 및 페이징
    query
      .orderBy('sql.detectedAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await query.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
    };
  }

  /**
   * 슬로우 쿼리 해결 처리
   */
  async resolveSlowQuery(id: number, resolutionNotes?: string): Promise<void> {
    await this.slowQueryLogRepository.update(id, {
      resolved: true,
      resolutionNotes,
      resolvedAt: new Date(),
    });

    this.logger.log(`Slow query ${id} marked as resolved`);
  }

  /**
   * 쿼리 해시 생성
   */
  private generateQueryHash(query: string, parameters?: any[]): string {
    const normalizedQuery = this.normalizeQuery(query);
    const paramString = parameters ? JSON.stringify(parameters) : '';
    return crypto
      .createHash('md5')
      .update(normalizedQuery + paramString)
      .digest('hex');
  }

  /**
   * 쿼리 정규화 (공백, 대소문자 등)
   */
  private normalizeQuery(query: string): string {
    return query.replace(/\s+/g, ' ').replace(/\n/g, ' ').trim().toLowerCase();
  }

  /**
   * 심각도 결정
   */
  private determineSeverity(executionTime: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (executionTime >= this.config.alertThresholds.critical) return 'CRITICAL';
    if (executionTime >= this.config.alertThresholds.high) return 'HIGH';
    if (executionTime >= this.config.alertThresholds.medium) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Critical 수준 쿼리 알림
   */
  private async sendCriticalQueryAlert(slowQueryLog: SlowQueryLog): Promise<void> {
    // 여기서 실제 알림 시스템 (이메일, Slack 등)과 연동
    this.logger.error({
      message: 'CRITICAL SLOW QUERY ALERT',
      queryHash: slowQueryLog.queryHash,
      executionTime: slowQueryLog.executionTime,
      databaseId: slowQueryLog.databaseId,
      userId: slowQueryLog.userId,
      query: slowQueryLog.query.substring(0, 200),
    });
  }

  /**
   * 전체 슬로우 쿼리 수 조회
   */
  private async getTotalSlowQueries(startDate: Date): Promise<number> {
    return this.slowQueryLogRepository.count({
      where: { detectedAt: Between(startDate, new Date()) },
    });
  }

  /**
   * 평균 실행 시간 조회
   */
  private async getAverageExecutionTime(startDate: Date): Promise<number> {
    const result = await this.slowQueryLogRepository
      .createQueryBuilder('sql')
      .select('AVG(sql.executionTime)', 'avg')
      .where('sql.detectedAt >= :startDate', { startDate })
      .getRawOne();

    return result?.avg ? parseFloat(result.avg) : 0;
  }

  /**
   * 최대 실행 시간 조회
   */
  private async getMaxExecutionTime(startDate: Date): Promise<number> {
    const result = await this.slowQueryLogRepository
      .createQueryBuilder('sql')
      .select('MAX(sql.executionTime)', 'max')
      .where('sql.detectedAt >= :startDate', { startDate })
      .getRawOne();

    return result?.max ? parseInt(result.max) : 0;
  }

  /**
   * 가장 빈번한 쿼리들 조회
   */
  private async getMostFrequentQueries(startDate: Date, limit: number): Promise<any[]> {
    const result = await this.slowQueryLogRepository
      .createQueryBuilder('sql')
      .select([
        'sql.queryHash',
        'sql.query',
        'COUNT(*) as count',
        'AVG(sql.executionTime) as avgExecutionTime',
      ])
      .where('sql.detectedAt >= :startDate', { startDate })
      .groupBy('sql.queryHash')
      .orderBy('count', 'DESC')
      .limit(limit)
      .getRawMany();

    return result.map(row => ({
      queryHash: row.sql_queryHash,
      query: row.sql_query.substring(0, 100) + '...',
      count: parseInt(row.count),
      avgExecutionTime: parseFloat(row.avgExecutionTime),
    }));
  }

  /**
   * 데이터베이스별 성능 조회
   */
  private async getPerformanceByDatabase(startDate: Date): Promise<any[]> {
    const result = await this.slowQueryLogRepository
      .createQueryBuilder('sql')
      .select([
        'sql.databaseId',
        'sql.databaseEngine',
        'COUNT(*) as count',
        'AVG(sql.executionTime) as avgExecutionTime',
      ])
      .where('sql.detectedAt >= :startDate', { startDate })
      .andWhere('sql.databaseId IS NOT NULL')
      .groupBy('sql.databaseId, sql.databaseEngine')
      .orderBy('count', 'DESC')
      .getRawMany();

    return result.map(row => ({
      databaseId: row.sql_databaseId,
      databaseEngine: row.sql_databaseEngine,
      count: parseInt(row.count),
      avgExecutionTime: parseFloat(row.avgExecutionTime),
    }));
  }

  /**
   * 심각도별 분포 조회
   */
  private async getSeverityDistribution(startDate: Date): Promise<any> {
    const result = await this.slowQueryLogRepository
      .createQueryBuilder('sql')
      .select(['sql.severity', 'COUNT(*) as count'])
      .where('sql.detectedAt >= :startDate', { startDate })
      .groupBy('sql.severity')
      .getRawMany();

    const distribution = { low: 0, medium: 0, high: 0, critical: 0 };

    result.forEach(row => {
      const severity = row.sql_severity.toLowerCase();
      distribution[severity] = parseInt(row.count);
    });

    return distribution;
  }

  /**
   * 지난 24시간 트렌드 조회
   */
  private async getTrends24Hours(): Promise<any[]> {
    const result = await this.slowQueryLogRepository
      .createQueryBuilder('sql')
      .select([
        'DATE_FORMAT(sql.detectedAt, "%Y-%m-%d %H:00:00") as hour',
        'COUNT(*) as count',
        'AVG(sql.executionTime) as avgExecutionTime',
      ])
      .where('sql.detectedAt >= DATE_SUB(NOW(), INTERVAL 24 HOUR)')
      .groupBy('hour')
      .orderBy('hour', 'ASC')
      .getRawMany();

    return result.map(row => ({
      hour: row.hour,
      count: parseInt(row.count),
      avgExecutionTime: parseFloat(row.avgExecutionTime),
    }));
  }

  /**
   * 주기적 정리 작업 (매일 03:00)
   */
  @Cron('0 3 * * *')
  async cleanupOldLogs(): Promise<void> {
    if (!this.config.enabled) return;

    const cutoffDate = new Date(Date.now() - this.config.cleanupIntervalDays * 24 * 60 * 60 * 1000);

    try {
      const result = await this.slowQueryLogRepository.delete({
        detectedAt: LessThan(cutoffDate),
      });

      this.logger.log(`Cleaned up ${result.affected} old slow query logs`);
    } catch (error) {
      this.logger.error(`Failed to cleanup old logs: ${error.message}`, error.stack);
    }
  }

  /**
   * 설정 업데이트
   */
  updateConfig(newConfig: Partial<SlowQueryMonitorConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.log('Slow query monitor config updated', this.config);
  }

  /**
   * 현재 설정 조회
   */
  getConfig(): SlowQueryMonitorConfig {
    return { ...this.config };
  }
}
