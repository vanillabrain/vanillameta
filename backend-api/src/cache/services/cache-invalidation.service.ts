import { Injectable, Logger, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Cron, CronExpression } from '@nestjs/schedule';

export interface InvalidationRule {
  id: string;
  pattern: string;
  condition: 'time_based' | 'event_based' | 'manual';
  intervalMinutes?: number;
  tablesToWatch?: string[];
  priority: 'low' | 'medium' | 'high';
  description: string;
  createdAt: Date;
  lastExecuted?: Date;
}

export interface InvalidationEvent {
  ruleId: string;
  pattern: string;
  invalidatedKeys: string[];
  reason: string;
  timestamp: Date;
  executionTimeMs: number;
}

@Injectable()
export class CacheInvalidationService {
  private readonly logger = new Logger(CacheInvalidationService.name);

  // 무효화 규칙 저장 (실제로는 DB에 저장 권장)
  private readonly invalidationRules = new Map<string, InvalidationRule>();
  private readonly invalidationHistory: InvalidationEvent[] = [];

  // 무효화 설정
  private readonly invalidationConfig = {
    maxHistorySize: 1000,
    defaultTTL: 300, // 5분
    batchInvalidationSize: 100, // 한 번에 무효화할 키 개수
    keyPrefix: 'query_cache',
    metadataPrefix: 'query_meta',
    cleanupIntervalHours: 24,
  };

  // 감시할 테이블 목록과 관련 캐시 패턴
  private readonly tableWatchList = new Map<string, string[]>([
    ['users', ['*:user_*', '*:db_*:*user*']],
    ['products', ['*:product_*', '*:db_*:*product*']],
    ['orders', ['*:order_*', '*:db_*:*order*']],
    ['dashboards', ['*:dashboard_*', '*:db_*:*dashboard*']],
    ['widgets', ['*:widget_*', '*:db_*:*widget*']],
    ['datasets', ['*:dataset_*', '*:db_*:*dataset*']],
  ]);

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {
    this.initializeDefaultRules();
  }

  /**
   * 캐시 무효화 규칙 추가
   */
  async addInvalidationRule(rule: Omit<InvalidationRule, 'id' | 'createdAt'>): Promise<string> {
    try {
      const ruleId = this.generateRuleId();
      const newRule: InvalidationRule = {
        ...rule,
        id: ruleId,
        createdAt: new Date(),
      };

      this.invalidationRules.set(ruleId, newRule);

      this.logger.log('Invalidation rule added', {
        ruleId,
        pattern: rule.pattern,
        condition: rule.condition,
        priority: rule.priority,
      });

      return ruleId;
    } catch (error) {
      this.logger.error('Failed to add invalidation rule', {
        pattern: rule.pattern,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * 특정 패턴으로 캐시 무효화
   */
  async invalidateByPattern(pattern: string, reason = 'Manual invalidation'): Promise<string[]> {
    try {
      const startTime = Date.now();
      const invalidatedKeys: string[] = [];

      // 실제 Redis 환경에서는 SCAN을 사용하여 패턴 매칭
      // 여기서는 간단한 구현으로 메타데이터 기반 무효화

      // 모든 캐시 키 스캔 (실제로는 Redis SCAN 사용)
      const allKeys = await this.getAllCacheKeys();
      const matchingKeys = allKeys.filter(key => this.matchPattern(key, pattern));

      // 배치 단위로 무효화
      for (let i = 0; i < matchingKeys.length; i += this.invalidationConfig.batchInvalidationSize) {
        const batch = matchingKeys.slice(i, i + this.invalidationConfig.batchInvalidationSize);
        await this.invalidateKeyBatch(batch);
        invalidatedKeys.push(...batch);
      }

      const executionTime = Date.now() - startTime;

      // 무효화 이벤트 기록
      const event: InvalidationEvent = {
        ruleId: 'manual',
        pattern,
        invalidatedKeys,
        reason,
        timestamp: new Date(),
        executionTimeMs: executionTime,
      };

      this.recordInvalidationEvent(event);

      this.logger.log('Cache invalidated by pattern', {
        pattern,
        invalidatedCount: invalidatedKeys.length,
        executionTime,
        reason,
      });

      return invalidatedKeys;
    } catch (error) {
      this.logger.error('Failed to invalidate cache by pattern', {
        pattern,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * 데이터베이스별 캐시 무효화
   */
  async invalidateDatabaseCache(
    databaseId: number,
    reason = 'Database cache invalidation',
  ): Promise<string[]> {
    const pattern = `${this.invalidationConfig.keyPrefix}:db_${databaseId}:*`;
    return await this.invalidateByPattern(pattern, reason);
  }

  /**
   * 사용자별 캐시 무효화
   */
  async invalidateUserCache(userId: string, reason = 'User cache invalidation'): Promise<string[]> {
    const userHash = this.hashString(userId);
    const pattern = `${this.invalidationConfig.keyPrefix}:*:user_${userHash}:*`;
    return await this.invalidateByPattern(pattern, reason);
  }

  /**
   * 테이블 변경 기반 캐시 무효화
   */
  async invalidateByTableChange(
    tableName: string,
    changeType: 'INSERT' | 'UPDATE' | 'DELETE',
  ): Promise<string[]> {
    try {
      const patterns = this.tableWatchList.get(tableName.toLowerCase()) || [];
      const invalidatedKeys: string[] = [];

      for (const pattern of patterns) {
        const keys = await this.invalidateByPattern(
          pattern,
          `Table ${tableName} ${changeType.toLowerCase()} operation`,
        );
        invalidatedKeys.push(...keys);
      }

      this.logger.log('Cache invalidated by table change', {
        tableName,
        changeType,
        totalInvalidated: invalidatedKeys.length,
        patterns,
      });

      return invalidatedKeys;
    } catch (error) {
      this.logger.error('Failed to invalidate cache by table change', {
        tableName,
        changeType,
        error: error.message,
      });
      return [];
    }
  }

  /**
   * TTL 기반 만료된 캐시 정리
   */
  @Cron(CronExpression.EVERY_HOUR)
  async cleanupExpiredCache(): Promise<void> {
    try {
      this.logger.debug('Starting expired cache cleanup');

      // Redis에서는 자동으로 만료된 키가 제거되므로
      // 여기서는 메타데이터 정리만 수행
      await this.cleanupExpiredMetadata();

      this.logger.debug('Expired cache cleanup completed');
    } catch (error) {
      this.logger.error('Failed to cleanup expired cache', error);
    }
  }

  /**
   * 시간 기반 무효화 규칙 실행
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async executeTimeBasedRules(): Promise<void> {
    try {
      const now = new Date();
      const timeBasedRules = Array.from(this.invalidationRules.values()).filter(
        rule => rule.condition === 'time_based' && rule.intervalMinutes,
      );

      for (const rule of timeBasedRules) {
        const shouldExecute = this.shouldExecuteTimeBasedRule(rule, now);
        if (shouldExecute) {
          await this.executeInvalidationRule(rule);
        }
      }
    } catch (error) {
      this.logger.error('Failed to execute time-based invalidation rules', error);
    }
  }

  /**
   * 무효화 규칙 삭제
   */
  async removeInvalidationRule(ruleId: string): Promise<void> {
    try {
      const removed = this.invalidationRules.delete(ruleId);
      if (removed) {
        this.logger.log('Invalidation rule removed', { ruleId });
      } else {
        this.logger.warn('Invalidation rule not found', { ruleId });
      }
    } catch (error) {
      this.logger.error('Failed to remove invalidation rule', {
        ruleId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * 무효화 규칙 목록 조회
   */
  getInvalidationRules(): InvalidationRule[] {
    return Array.from(this.invalidationRules.values());
  }

  /**
   * 무효화 히스토리 조회
   */
  getInvalidationHistory(limit = 100): InvalidationEvent[] {
    return this.invalidationHistory
      .slice(-limit)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * 캐시 무효화 통계
   */
  getInvalidationStatistics(): {
    totalRules: number;
    activeRules: number;
    totalInvalidations: number;
    averageInvalidationTime: number;
    mostActivePattern: string;
  } {
    const totalRules = this.invalidationRules.size;
    const activeRules = Array.from(this.invalidationRules.values()).filter(
      rule => rule.lastExecuted,
    ).length;
    const totalInvalidations = this.invalidationHistory.length;

    const averageInvalidationTime =
      totalInvalidations > 0
        ? this.invalidationHistory.reduce((sum, event) => sum + event.executionTimeMs, 0) /
          totalInvalidations
        : 0;

    // 가장 활발한 패턴 찾기
    const patternCounts = new Map<string, number>();
    this.invalidationHistory.forEach(event => {
      patternCounts.set(event.pattern, (patternCounts.get(event.pattern) || 0) + 1);
    });

    const mostActivePattern =
      Array.from(patternCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || 'None';

    return {
      totalRules,
      activeRules,
      totalInvalidations,
      averageInvalidationTime: Math.round(averageInvalidationTime),
      mostActivePattern,
    };
  }

  // Private helper methods

  /**
   * 기본 무효화 규칙 초기화
   */
  private initializeDefaultRules(): void {
    const defaultRules: Omit<InvalidationRule, 'id' | 'createdAt'>[] = [
      {
        pattern: `${this.invalidationConfig.keyPrefix}:*:*user*`,
        condition: 'time_based',
        intervalMinutes: 60, // 1시간마다
        priority: 'medium',
        description: 'Hourly user-related cache cleanup',
      },
      {
        pattern: `${this.invalidationConfig.keyPrefix}:*dashboard*`,
        condition: 'time_based',
        intervalMinutes: 30, // 30분마다
        priority: 'high',
        description: 'Dashboard cache refresh',
      },
      {
        pattern: `${this.invalidationConfig.keyPrefix}:*:*:query_*`,
        condition: 'time_based',
        intervalMinutes: 15, // 15분마다
        priority: 'low',
        description: 'General query cache cleanup',
      },
    ];

    defaultRules.forEach(rule => {
      this.addInvalidationRule(rule).catch(error => {
        this.logger.error('Failed to add default invalidation rule', {
          pattern: rule.pattern,
          error: error.message,
        });
      });
    });
  }

  /**
   * 규칙 ID 생성
   */
  private generateRuleId(): string {
    return `rule_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * 모든 캐시 키 조회 (Redis SCAN 시뮬레이션)
   */
  private async getAllCacheKeys(): Promise<string[]> {
    try {
      // 실제 Redis 환경에서는 SCAN 명령어 사용
      // 여기서는 간단한 구현
      return []; // Redis SCAN 결과로 대체
    } catch (error) {
      this.logger.error('Failed to get all cache keys', error);
      return [];
    }
  }

  /**
   * 패턴 매칭
   */
  private matchPattern(key: string, pattern: string): boolean {
    // 간단한 와일드카드 패턴 매칭
    const regexPattern = pattern.replace(/\*/g, '.*').replace(/\?/g, '.');

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(key);
  }

  /**
   * 키 배치 무효화
   */
  private async invalidateKeyBatch(keys: string[]): Promise<void> {
    try {
      const promises = keys.map(key => this.cacheManager.del(key));
      await Promise.all(promises);
    } catch (error) {
      this.logger.error('Failed to invalidate key batch', {
        batchSize: keys.length,
        error: error.message,
      });
    }
  }

  /**
   * 무효화 이벤트 기록
   */
  private recordInvalidationEvent(event: InvalidationEvent): void {
    this.invalidationHistory.push(event);

    // 히스토리 크기 제한
    if (this.invalidationHistory.length > this.invalidationConfig.maxHistorySize) {
      this.invalidationHistory.shift();
    }
  }

  /**
   * 시간 기반 규칙 실행 여부 판단
   */
  private shouldExecuteTimeBasedRule(rule: InvalidationRule, now: Date): boolean {
    if (!rule.intervalMinutes) return false;

    if (!rule.lastExecuted) return true;

    const timeSinceLastExecution = now.getTime() - rule.lastExecuted.getTime();
    const intervalMs = rule.intervalMinutes * 60 * 1000;

    return timeSinceLastExecution >= intervalMs;
  }

  /**
   * 무효화 규칙 실행
   */
  private async executeInvalidationRule(rule: InvalidationRule): Promise<void> {
    try {
      const invalidatedKeys = await this.invalidateByPattern(
        rule.pattern,
        `Time-based rule: ${rule.description}`,
      );

      // 실행 시간 업데이트
      rule.lastExecuted = new Date();
      this.invalidationRules.set(rule.id, rule);

      this.logger.debug('Invalidation rule executed', {
        ruleId: rule.id,
        pattern: rule.pattern,
        invalidatedCount: invalidatedKeys.length,
      });
    } catch (error) {
      this.logger.error('Failed to execute invalidation rule', {
        ruleId: rule.id,
        pattern: rule.pattern,
        error: error.message,
      });
    }
  }

  /**
   * 만료된 메타데이터 정리
   */
  private async cleanupExpiredMetadata(): Promise<void> {
    try {
      // 메타데이터 키 패턴으로 정리
      const metadataPattern = `${this.invalidationConfig.metadataPrefix}:*`;
      await this.invalidateByPattern(metadataPattern, 'Expired metadata cleanup');
    } catch (error) {
      this.logger.error('Failed to cleanup expired metadata', error);
    }
  }

  /**
   * 문자열 해시 생성
   */
  private hashString(input: string): string {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // 32비트 정수로 변환
    }
    return Math.abs(hash).toString(36);
  }
}
