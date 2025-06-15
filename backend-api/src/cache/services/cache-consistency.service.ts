import { Injectable, Logger, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { CacheInvalidationService } from './cache-invalidation.service';

interface ConsistencyRule {
  id: string;
  triggerPattern: string;
  invalidationPatterns: string[];
  priority: 'low' | 'medium' | 'high';
  description: string;
  enabled: boolean;
  createdAt: Date;
}

interface ConsistencyEvent {
  id: string;
  ruleId: string;
  triggerKey: string;
  invalidatedPatterns: string[];
  invalidatedCount: number;
  timestamp: Date;
  executionTimeMs: number;
  success: boolean;
  errorMessage?: string;
}

@Injectable()
export class CacheConsistencyService {
  private readonly logger = new Logger(CacheConsistencyService.name);

  // 일관성 규칙 저장
  private readonly consistencyRules = new Map<string, ConsistencyRule>();
  private readonly consistencyEvents: ConsistencyEvent[] = [];

  // 분산 락 및 동기화 설정
  private readonly consistencyConfig = {
    lockPrefix: 'cache_lock',
    lockTTL: 30000, // 30초 락 TTL
    maxLockWaitTime: 5000, // 5초 최대 대기 시간
    retryDelay: 100, // 100ms 재시도 간격
    eventHistoryLimit: 1000,
    // 데이터베이스별 종속성 매핑
    dependencyMapping: new Map<string, string[]>([
      ['users', ['user_sessions', 'user_preferences', 'user_dashboards']],
      ['dashboards', ['dashboard_widgets', 'dashboard_shares']],
      ['datasets', ['dataset_queries', 'dataset_cache']],
      ['widgets', ['widget_data', 'widget_configs']],
    ]),
  };

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly invalidationService: CacheInvalidationService,
  ) {
    this.initializeDefaultConsistencyRules();
  }

  /**
   * 분산 락 획득
   */
  async acquireDistributedLock(
    lockKey: string,
    ttlMs: number = this.consistencyConfig.lockTTL,
  ): Promise<{ success: boolean; lockId?: string }> {
    try {
      const lockId = this.generateLockId();
      const fullLockKey = `${this.consistencyConfig.lockPrefix}:${lockKey}`;

      // NX (if not exists) 옵션으로 락 설정 시도
      const lockAcquired = await this.setNX(fullLockKey, lockId, ttlMs);

      if (lockAcquired) {
        this.logger.debug('Distributed lock acquired', {
          lockKey,
          lockId,
          ttlMs,
        });

        return { success: true, lockId };
      }

      return { success: false };
    } catch (error) {
      this.logger.error('Failed to acquire distributed lock', {
        lockKey,
        error: error.message,
      });
      return { success: false };
    }
  }

  /**
   * 분산 락 해제
   */
  async releaseDistributedLock(lockKey: string, lockId: string): Promise<boolean> {
    try {
      const fullLockKey = `${this.consistencyConfig.lockPrefix}:${lockKey}`;
      const currentLockId = await this.cacheManager.get<string>(fullLockKey);

      if (currentLockId === lockId) {
        await this.cacheManager.del(fullLockKey);

        this.logger.debug('Distributed lock released', {
          lockKey,
          lockId,
        });

        return true;
      }

      this.logger.warn('Lock release failed: lock ID mismatch', {
        lockKey,
        expectedLockId: lockId,
        currentLockId,
      });

      return false;
    } catch (error) {
      this.logger.error('Failed to release distributed lock', {
        lockKey,
        lockId,
        error: error.message,
      });
      return false;
    }
  }

  /**
   * 락 대기 및 획득
   */
  async waitForLock(
    lockKey: string,
    maxWaitTimeMs: number = this.consistencyConfig.maxLockWaitTime,
  ): Promise<{ success: boolean; lockId?: string }> {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTimeMs) {
      const lockResult = await this.acquireDistributedLock(lockKey);

      if (lockResult.success) {
        return lockResult;
      }

      // 재시도 대기
      await this.sleep(this.consistencyConfig.retryDelay);
    }

    this.logger.warn('Lock acquisition timeout', {
      lockKey,
      maxWaitTimeMs,
      actualWaitTime: Date.now() - startTime,
    });

    return { success: false };
  }

  /**
   * 원자적 캐시 무효화 (분산 락 사용)
   */
  async atomicInvalidation(
    patterns: string[],
    reason: string,
    lockKey?: string,
  ): Promise<{
    success: boolean;
    invalidatedKeys: string[];
    lockAcquired: boolean;
  }> {
    const actualLockKey = lockKey || `invalidation_${Date.now()}`;
    let lockId: string | undefined;
    let lockAcquired = false;

    try {
      // 분산 락 획득
      const lockResult = await this.waitForLock(actualLockKey);
      if (!lockResult.success) {
        return {
          success: false,
          invalidatedKeys: [],
          lockAcquired: false,
        };
      }

      lockId = lockResult.lockId;
      lockAcquired = true;

      // 모든 패턴에 대해 무효화 수행
      const allInvalidatedKeys: string[] = [];

      for (const pattern of patterns) {
        const keys = await this.invalidationService.invalidateByPattern(pattern, reason);
        allInvalidatedKeys.push(...keys);
      }

      this.logger.log('Atomic invalidation completed', {
        patterns,
        invalidatedCount: allInvalidatedKeys.length,
        lockKey: actualLockKey,
        reason,
      });

      return {
        success: true,
        invalidatedKeys: allInvalidatedKeys,
        lockAcquired: true,
      };
    } catch (error) {
      this.logger.error('Atomic invalidation failed', {
        patterns,
        lockKey: actualLockKey,
        error: error.message,
      });

      return {
        success: false,
        invalidatedKeys: [],
        lockAcquired,
      };
    } finally {
      // 락 해제
      if (lockId) {
        await this.releaseDistributedLock(actualLockKey, lockId);
      }
    }
  }

  /**
   * 종속성 기반 캐시 무효화
   */
  async invalidateDependencies(
    triggerEntity: string,
    operation: 'INSERT' | 'UPDATE' | 'DELETE',
    entityId?: string,
  ): Promise<ConsistencyEvent> {
    const startTime = Date.now();
    const eventId = this.generateEventId();

    try {
      // 종속성 패턴 찾기
      const dependentEntities = this.consistencyConfig.dependencyMapping.get(triggerEntity) || [];
      const invalidationPatterns = [
        `*:${triggerEntity}*`,
        ...dependentEntities.map(entity => `*:${entity}*`),
      ];

      // 엔티티 ID가 있으면 더 구체적인 패턴 추가
      if (entityId) {
        invalidationPatterns.push(`*:${triggerEntity}_${entityId}*`);
      }

      // 원자적 무효화 실행
      const result = await this.atomicInvalidation(
        invalidationPatterns,
        `Dependency invalidation: ${triggerEntity} ${operation}`,
        `dependency_${triggerEntity}_${entityId || 'all'}`,
      );

      const event: ConsistencyEvent = {
        id: eventId,
        ruleId: 'dependency_rule',
        triggerKey: `${triggerEntity}:${operation}:${entityId || 'all'}`,
        invalidatedPatterns: invalidationPatterns,
        invalidatedCount: result.invalidatedKeys.length,
        timestamp: new Date(),
        executionTimeMs: Date.now() - startTime,
        success: result.success,
      };

      this.recordConsistencyEvent(event);

      this.logger.log('Dependency-based invalidation completed', {
        triggerEntity,
        operation,
        entityId,
        invalidatedCount: result.invalidatedKeys.length,
        success: result.success,
      });

      return event;
    } catch (error) {
      const event: ConsistencyEvent = {
        id: eventId,
        ruleId: 'dependency_rule',
        triggerKey: `${triggerEntity}:${operation}:${entityId || 'all'}`,
        invalidatedPatterns: [],
        invalidatedCount: 0,
        timestamp: new Date(),
        executionTimeMs: Date.now() - startTime,
        success: false,
        errorMessage: error.message,
      };

      this.recordConsistencyEvent(event);

      this.logger.error('Dependency-based invalidation failed', {
        triggerEntity,
        operation,
        entityId,
        error: error.message,
      });

      return event;
    }
  }

  /**
   * 일관성 규칙 추가
   */
  async addConsistencyRule(rule: Omit<ConsistencyRule, 'id' | 'createdAt'>): Promise<string> {
    try {
      const ruleId = this.generateRuleId();
      const newRule: ConsistencyRule = {
        ...rule,
        id: ruleId,
        createdAt: new Date(),
      };

      this.consistencyRules.set(ruleId, newRule);

      this.logger.log('Consistency rule added', {
        ruleId,
        triggerPattern: rule.triggerPattern,
        invalidationPatterns: rule.invalidationPatterns,
        priority: rule.priority,
      });

      return ruleId;
    } catch (error) {
      this.logger.error('Failed to add consistency rule', {
        rule,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * 일관성 규칙 실행
   */
  async executeConsistencyRule(
    ruleId: string,
    triggerKey: string,
  ): Promise<ConsistencyEvent | null> {
    const rule = this.consistencyRules.get(ruleId);
    if (!rule || !rule.enabled) {
      return null;
    }

    const startTime = Date.now();
    const eventId = this.generateEventId();

    try {
      // 원자적 무효화 실행
      const result = await this.atomicInvalidation(
        rule.invalidationPatterns,
        `Consistency rule: ${rule.description}`,
        `rule_${ruleId}_${Date.now()}`,
      );

      const event: ConsistencyEvent = {
        id: eventId,
        ruleId,
        triggerKey,
        invalidatedPatterns: rule.invalidationPatterns,
        invalidatedCount: result.invalidatedKeys.length,
        timestamp: new Date(),
        executionTimeMs: Date.now() - startTime,
        success: result.success,
      };

      this.recordConsistencyEvent(event);

      this.logger.debug('Consistency rule executed', {
        ruleId,
        triggerKey,
        invalidatedCount: result.invalidatedKeys.length,
        success: result.success,
      });

      return event;
    } catch (error) {
      const event: ConsistencyEvent = {
        id: eventId,
        ruleId,
        triggerKey,
        invalidatedPatterns: rule.invalidationPatterns,
        invalidatedCount: 0,
        timestamp: new Date(),
        executionTimeMs: Date.now() - startTime,
        success: false,
        errorMessage: error.message,
      };

      this.recordConsistencyEvent(event);

      this.logger.error('Consistency rule execution failed', {
        ruleId,
        triggerKey,
        error: error.message,
      });

      return event;
    }
  }

  /**
   * 일관성 상태 확인
   */
  async checkConsistency(): Promise<{
    status: 'consistent' | 'inconsistent' | 'unknown';
    issues: string[];
    details: {
      activeLocks: number;
      pendingOperations: number;
      recentFailures: number;
    };
  }> {
    try {
      const activeLocks = await this.getActiveLockCount();
      const recentEvents = this.consistencyEvents
        .filter(event => event.timestamp.getTime() > Date.now() - 300000) // 5분 이내
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      const recentFailures = recentEvents.filter(event => !event.success).length;
      const pendingOperations = activeLocks; // 간단한 추정

      const issues: string[] = [];
      let status: 'consistent' | 'inconsistent' | 'unknown' = 'consistent';

      if (recentFailures > 5) {
        status = 'inconsistent';
        issues.push(`High failure rate: ${recentFailures} failures in last 5 minutes`);
      }

      if (activeLocks > 10) {
        status = status === 'consistent' ? 'unknown' : 'inconsistent';
        issues.push(`High lock contention: ${activeLocks} active locks`);
      }

      if (pendingOperations > 20) {
        status = status === 'consistent' ? 'unknown' : 'inconsistent';
        issues.push(`High pending operations: ${pendingOperations} operations`);
      }

      return {
        status,
        issues,
        details: {
          activeLocks,
          pendingOperations,
          recentFailures,
        },
      };
    } catch (error) {
      this.logger.error('Failed to check consistency', error);
      return {
        status: 'unknown',
        issues: ['Consistency check failed'],
        details: {
          activeLocks: 0,
          pendingOperations: 0,
          recentFailures: 0,
        },
      };
    }
  }

  /**
   * 일관성 통계 조회
   */
  getConsistencyStatistics(): {
    totalRules: number;
    activeRules: number;
    totalEvents: number;
    successRate: number;
    averageExecutionTime: number;
  } {
    const totalRules = this.consistencyRules.size;
    const activeRules = Array.from(this.consistencyRules.values()).filter(
      rule => rule.enabled,
    ).length;

    const totalEvents = this.consistencyEvents.length;
    const successfulEvents = this.consistencyEvents.filter(event => event.success).length;
    const successRate = totalEvents > 0 ? (successfulEvents / totalEvents) * 100 : 0;

    const averageExecutionTime =
      totalEvents > 0
        ? this.consistencyEvents.reduce((sum, event) => sum + event.executionTimeMs, 0) /
          totalEvents
        : 0;

    return {
      totalRules,
      activeRules,
      totalEvents,
      successRate: Math.round(successRate * 100) / 100,
      averageExecutionTime: Math.round(averageExecutionTime),
    };
  }

  // Private helper methods

  /**
   * 기본 일관성 규칙 초기화
   */
  private initializeDefaultConsistencyRules(): void {
    const defaultRules = [
      {
        triggerPattern: '*:users:*',
        invalidationPatterns: ['*:user_*', '*:auth_*', '*:session_*'],
        priority: 'high' as const,
        description: 'User data consistency',
        enabled: true,
      },
      {
        triggerPattern: '*:dashboards:*',
        invalidationPatterns: ['*:dashboard_*', '*:widget_*'],
        priority: 'medium' as const,
        description: 'Dashboard consistency',
        enabled: true,
      },
      {
        triggerPattern: '*:datasets:*',
        invalidationPatterns: ['*:dataset_*', '*:query_*'],
        priority: 'medium' as const,
        description: 'Dataset consistency',
        enabled: true,
      },
    ];

    defaultRules.forEach(rule => {
      this.addConsistencyRule(rule).catch(error => {
        this.logger.error('Failed to add default consistency rule', {
          rule,
          error: error.message,
        });
      });
    });
  }

  /**
   * NX (if not exists) 구현
   */
  private async setNX(key: string, value: string, ttlMs: number): Promise<boolean> {
    try {
      // 캐시 매니저의 기본 구현은 NX를 지원하지 않을 수 있음
      // 실제 Redis 구현에서는 SET key value NX PX ttl 명령어 사용
      const existing = await this.cacheManager.get(key);
      if (existing === undefined || existing === null) {
        await this.cacheManager.set(key, value, ttlMs);
        return true;
      }
      return false;
    } catch (error) {
      this.logger.error('SetNX operation failed', { key, error: error.message });
      return false;
    }
  }

  /**
   * 활성 락 수 조회
   */
  private async getActiveLockCount(): Promise<number> {
    try {
      // 실제 구현에서는 Redis SCAN을 사용하여 락 키 개수 조회
      // 여기서는 간단한 추정값 반환
      return 0;
    } catch (error) {
      this.logger.error('Failed to get active lock count', error);
      return 0;
    }
  }

  /**
   * 일관성 이벤트 기록
   */
  private recordConsistencyEvent(event: ConsistencyEvent): void {
    this.consistencyEvents.push(event);

    // 이벤트 히스토리 크기 제한
    if (this.consistencyEvents.length > this.consistencyConfig.eventHistoryLimit) {
      this.consistencyEvents.shift();
    }
  }

  /**
   * 슬립 함수
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 락 ID 생성
   */
  private generateLockId(): string {
    return `lock_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * 규칙 ID 생성
   */
  private generateRuleId(): string {
    return `rule_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * 이벤트 ID 생성
   */
  private generateEventId(): string {
    return `event_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }
}
