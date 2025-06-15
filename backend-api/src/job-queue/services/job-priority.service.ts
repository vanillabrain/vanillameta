import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QueueJob, JobPriority, JobType, JobStatus } from '../entities/queue-job.entity';

export interface PriorityRule {
  id: string;
  name: string;
  condition: PriorityCondition;
  priority: JobPriority;
  enabled: boolean;
  weight: number;
  createdAt: Date;
}

export interface PriorityCondition {
  jobType?: JobType[];
  userId?: string[];
  estimatedTimeRange?: { min: number; max: number };
  retryCount?: { min: number; max: number };
  timeOfDay?: { start: string; end: string };
  dayOfWeek?: number[];
  metadata?: Record<string, any>;
}

@Injectable()
export class JobPriorityService {
  private readonly logger = new Logger(JobPriorityService.name);
  
  // 우선순위 규칙들 (실제로는 DB에 저장)
  private priorityRules: PriorityRule[] = [];
  
  // 동적 우선순위 가중치
  private readonly dynamicWeights = {
    age: 0.3,           // 작업 대기 시간
    retryCount: 0.2,    // 재시도 횟수
    userType: 0.2,      // 사용자 타입 (premium vs standard)
    systemLoad: 0.1,    // 시스템 부하
    jobType: 0.2,       // 작업 유형
  };

  constructor(
    @InjectRepository(QueueJob)
    private jobRepository: Repository<QueueJob>,
  ) {
    this.initializeDefaultRules();
  }

  /**
   * 기본 우선순위 규칙 초기화
   */
  private initializeDefaultRules(): void {
    const defaultRules: Omit<PriorityRule, 'id' | 'createdAt'>[] = [
      {
        name: 'Critical System Operations',
        condition: {
          jobType: [JobType.DATA_MIGRATION, JobType.CACHE_WARMUP],
        },
        priority: JobPriority.URGENT,
        enabled: true,
        weight: 10,
      },
      {
        name: 'Large Data Exports',
        condition: {
          jobType: [JobType.BULK_DATA_EXPORT],
          estimatedTimeRange: { min: 300000, max: Infinity }, // 5분 이상
        },
        priority: JobPriority.LOW,
        enabled: true,
        weight: 1,
      },
      {
        name: 'Quick Queries',
        condition: {
          jobType: [JobType.QUERY_EXECUTION],
          estimatedTimeRange: { min: 0, max: 30000 }, // 30초 이내
        },
        priority: JobPriority.HIGH,
        enabled: true,
        weight: 8,
      },
      {
        name: 'Business Hours Boost',
        condition: {
          timeOfDay: { start: '09:00', end: '18:00' },
          dayOfWeek: [1, 2, 3, 4, 5], // Monday to Friday
        },
        priority: JobPriority.HIGH,
        enabled: true,
        weight: 5,
      },
      {
        name: 'Retry Priority Boost',
        condition: {
          retryCount: { min: 1, max: Infinity },
        },
        priority: JobPriority.HIGH,
        enabled: true,
        weight: 6,
      },
    ];

    this.priorityRules = defaultRules.map(rule => ({
      ...rule,
      id: `rule_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
      createdAt: new Date(),
    }));

    this.logger.log(`Initialized ${this.priorityRules.length} default priority rules`);
  }

  /**
   * 작업의 동적 우선순위 계산
   */
  async calculateDynamicPriority(job: QueueJob): Promise<{
    finalPriority: JobPriority;
    score: number;
    factors: Record<string, number>;
    appliedRules: string[];
  }> {
    try {
      const factors: Record<string, number> = {};
      const appliedRules: string[] = [];

      // 1. 기본 우선순위 점수
      let baseScore = this.getBasePriorityScore(job.priority);
      factors.basePriority = baseScore;

      // 2. 나이 팩터 (대기 시간)
      const ageScore = this.calculateAgeScore(job);
      factors.age = ageScore;

      // 3. 재시도 팩터
      const retryScore = this.calculateRetryScore(job);
      factors.retry = retryScore;

      // 4. 작업 유형 팩터
      const jobTypeScore = this.calculateJobTypeScore(job);
      factors.jobType = jobTypeScore;

      // 5. 시스템 부하 팩터
      const systemLoadScore = await this.calculateSystemLoadScore();
      factors.systemLoad = systemLoadScore;

      // 6. 사용자 유형 팩터
      const userTypeScore = await this.calculateUserTypeScore(job.userId);
      factors.userType = userTypeScore;

      // 7. 우선순위 규칙 적용
      const ruleScore = this.applyPriorityRules(job, appliedRules);
      factors.rules = ruleScore;

      // 최종 점수 계산
      const totalScore = 
        baseScore +
        (ageScore * this.dynamicWeights.age) +
        (retryScore * this.dynamicWeights.retryCount) +
        (jobTypeScore * this.dynamicWeights.jobType) +
        (systemLoadScore * this.dynamicWeights.systemLoad) +
        (userTypeScore * this.dynamicWeights.userType) +
        ruleScore;

      // 점수를 우선순위로 변환
      const finalPriority = this.scoreToJobPriority(totalScore);

      return {
        finalPriority,
        score: Math.round(totalScore * 100) / 100,
        factors,
        appliedRules,
      };

    } catch (error) {
      this.logger.error(`Failed to calculate dynamic priority for job ${job.id}`, error);
      
      // 에러 시 기본 우선순위 반환
      return {
        finalPriority: job.priority,
        score: this.getBasePriorityScore(job.priority),
        factors: {},
        appliedRules: [],
      };
    }
  }

  /**
   * 작업 우선순위 업데이트
   */
  async updateJobPriority(jobId: string, reason?: string): Promise<void> {
    try {
      const job = await this.jobRepository.findOne({ where: { id: jobId } });
      if (!job || job.status !== JobStatus.PENDING) {
        return;
      }

      const priorityResult = await this.calculateDynamicPriority(job);
      
      if (priorityResult.finalPriority !== job.priority) {
        await this.jobRepository.update(jobId, {
          priority: priorityResult.finalPriority,
          updatedAt: new Date(),
        });

        this.logger.debug(`Job priority updated: ${jobId} ${job.priority} -> ${priorityResult.finalPriority} (score: ${priorityResult.score})`);
      }

    } catch (error) {
      this.logger.error(`Failed to update job priority: ${jobId}`, error);
    }
  }

  /**
   * 벌크 우선순위 재계산
   */
  async recalculateAllPriorities(): Promise<{
    processed: number;
    updated: number;
    errors: number;
  }> {
    let processed = 0;
    let updated = 0;
    let errors = 0;

    try {
      // 대기 중인 작업들만 조회
      const pendingJobs = await this.jobRepository.find({
        where: { status: JobStatus.PENDING },
        take: 1000, // 한 번에 최대 1000개
      });

      for (const job of pendingJobs) {
        try {
          processed++;
          
          const priorityResult = await this.calculateDynamicPriority(job);
          
          if (priorityResult.finalPriority !== job.priority) {
            await this.jobRepository.update(job.id, {
              priority: priorityResult.finalPriority,
              updatedAt: new Date(),
            });
            updated++;
          }

        } catch (error) {
          errors++;
          this.logger.error(`Failed to recalculate priority for job ${job.id}`, error);
        }
      }

      this.logger.log(`Priority recalculation completed: ${processed} processed, ${updated} updated, ${errors} errors`);

    } catch (error) {
      this.logger.error('Failed to recalculate priorities', error);
      errors++;
    }

    return { processed, updated, errors };
  }

  /**
   * 우선순위 규칙 추가
   */
  addPriorityRule(rule: Omit<PriorityRule, 'id' | 'createdAt'>): string {
    const newRule: PriorityRule = {
      ...rule,
      id: `rule_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
      createdAt: new Date(),
    };

    this.priorityRules.push(newRule);
    this.logger.log(`Priority rule added: ${newRule.name}`);
    
    return newRule.id;
  }

  /**
   * 우선순위 규칙 제거
   */
  removePriorityRule(ruleId: string): boolean {
    const initialLength = this.priorityRules.length;
    this.priorityRules = this.priorityRules.filter(rule => rule.id !== ruleId);
    
    const removed = this.priorityRules.length < initialLength;
    if (removed) {
      this.logger.log(`Priority rule removed: ${ruleId}`);
    }
    
    return removed;
  }

  /**
   * 우선순위 통계 조회
   */
  async getPriorityStatistics(days: number = 7): Promise<{
    totalJobs: number;
    priorityDistribution: Record<JobPriority, number>;
    averageWaitTimeByPriority: Record<JobPriority, number>;
    priorityChanges: number;
    topAppliedRules: Array<{ ruleName: string; count: number }>;
  }> {
    try {
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      
      const jobs = await this.jobRepository.find({
        where: {
          createdAt: startDate,
        },
      });

      const totalJobs = jobs.length;
      
      // 우선순위별 분포
      const priorityDistribution: Record<JobPriority, number> = {
        [JobPriority.LOW]: 0,
        [JobPriority.NORMAL]: 0,
        [JobPriority.HIGH]: 0,
        [JobPriority.URGENT]: 0,
      };

      // 우선순위별 평균 대기 시간
      const waitTimes: Record<JobPriority, number[]> = {
        [JobPriority.LOW]: [],
        [JobPriority.NORMAL]: [],
        [JobPriority.HIGH]: [],
        [JobPriority.URGENT]: [],
      };

      for (const job of jobs) {
        priorityDistribution[job.priority]++;
        
        if (job.startedAt) {
          const waitTime = job.startedAt.getTime() - job.createdAt.getTime();
          waitTimes[job.priority].push(waitTime);
        }
      }

      // 평균 대기 시간 계산
      const averageWaitTimeByPriority: Record<JobPriority, number> = {
        [JobPriority.LOW]: 0,
        [JobPriority.NORMAL]: 0,
        [JobPriority.HIGH]: 0,
        [JobPriority.URGENT]: 0,
      };

      for (const [priority, times] of Object.entries(waitTimes)) {
        if (times.length > 0) {
          averageWaitTimeByPriority[priority as JobPriority] = 
            Math.round(times.reduce((sum, time) => sum + time, 0) / times.length);
        }
      }

      return {
        totalJobs,
        priorityDistribution,
        averageWaitTimeByPriority,
        priorityChanges: 0, // 실제로는 별도 추적 필요
        topAppliedRules: [], // 실제로는 별도 추적 필요
      };

    } catch (error) {
      this.logger.error('Failed to get priority statistics', error);
      throw error;
    }
  }

  // Private helper methods

  /**
   * 기본 우선순위 점수
   */
  private getBasePriorityScore(priority: JobPriority): number {
    switch (priority) {
      case JobPriority.LOW: return 1;
      case JobPriority.NORMAL: return 2;
      case JobPriority.HIGH: return 3;
      case JobPriority.URGENT: return 4;
      default: return 2;
    }
  }

  /**
   * 나이 점수 계산 (작업 대기 시간)
   */
  private calculateAgeScore(job: QueueJob): number {
    const ageInMinutes = (Date.now() - job.createdAt.getTime()) / (1000 * 60);
    
    // 10분마다 0.1점씩 증가, 최대 2점
    return Math.min(ageInMinutes / 10 * 0.1, 2);
  }

  /**
   * 재시도 점수 계산
   */
  private calculateRetryScore(job: QueueJob): number {
    // 재시도 횟수가 많을수록 높은 점수
    return Math.min(job.retryCount * 0.5, 2);
  }

  /**
   * 작업 유형별 점수 계산
   */
  private calculateJobTypeScore(job: QueueJob): number {
    const jobTypeScores = {
      [JobType.QUERY_EXECUTION]: 1.0,      // 기본
      [JobType.DASHBOARD_GENERATION]: 1.2, // 약간 높음
      [JobType.REPORT_GENERATION]: 1.1,    // 약간 높음
      [JobType.BULK_DATA_EXPORT]: 0.8,     // 낮음 (시간 오래 걸림)
      [JobType.DATA_MIGRATION]: 1.5,       // 높음 (중요)
      [JobType.CACHE_WARMUP]: 1.3,         // 높음 (성능에 영향)
    };

    return jobTypeScores[job.jobType] || 1.0;
  }

  /**
   * 시스템 부하 점수 계산
   */
  private async calculateSystemLoadScore(): Promise<number> {
    try {
      // 현재 실행 중인 작업 수 확인
      const runningJobs = await this.jobRepository.count({
        where: { status: JobStatus.RUNNING }
      });

      // 부하가 낮을수록 높은 점수 (역관계)
      const maxConcurrentJobs = 10; // 설정값
      const loadRatio = runningJobs / maxConcurrentJobs;
      
      return Math.max(0, 1 - loadRatio); // 0~1 범위
    } catch (error) {
      return 0.5; // 기본값
    }
  }

  /**
   * 사용자 유형 점수 계산
   */
  private async calculateUserTypeScore(userId?: string): Promise<number> {
    if (!userId) return 1.0;

    try {
      // 실제로는 사용자 서비스에서 사용자 타입 조회
      // const user = await userService.getUser(userId);
      // if (user.isPremium) return 1.5;
      
      return 1.0; // 기본 사용자
    } catch (error) {
      return 1.0;
    }
  }

  /**
   * 우선순위 규칙 적용
   */
  private applyPriorityRules(job: QueueJob, appliedRules: string[]): number {
    let totalRuleScore = 0;

    for (const rule of this.priorityRules) {
      if (!rule.enabled) continue;

      if (this.matchesCondition(job, rule.condition)) {
        totalRuleScore += rule.weight * 0.1; // 가중치 적용
        appliedRules.push(rule.name);
      }
    }

    return totalRuleScore;
  }

  /**
   * 조건 매칭 확인
   */
  private matchesCondition(job: QueueJob, condition: PriorityCondition): boolean {
    // 작업 유형 체크
    if (condition.jobType && !condition.jobType.includes(job.jobType)) {
      return false;
    }

    // 사용자 ID 체크
    if (condition.userId && !condition.userId.includes(job.userId || '')) {
      return false;
    }

    // 예상 실행 시간 체크
    if (condition.estimatedTimeRange && job.estimatedTimeMs) {
      const { min, max } = condition.estimatedTimeRange;
      if (job.estimatedTimeMs < min || job.estimatedTimeMs > max) {
        return false;
      }
    }

    // 재시도 횟수 체크
    if (condition.retryCount) {
      const { min, max } = condition.retryCount;
      if (job.retryCount < min || job.retryCount > max) {
        return false;
      }
    }

    // 시간대 체크
    if (condition.timeOfDay) {
      const now = new Date();
      const currentTime = now.toTimeString().substring(0, 5); // HH:MM
      const { start, end } = condition.timeOfDay;
      
      if (currentTime < start || currentTime > end) {
        return false;
      }
    }

    // 요일 체크
    if (condition.dayOfWeek) {
      const currentDay = new Date().getDay();
      if (!condition.dayOfWeek.includes(currentDay)) {
        return false;
      }
    }

    return true;
  }

  /**
   * 점수를 우선순위로 변환
   */
  private scoreToJobPriority(score: number): JobPriority {
    if (score >= 6) return JobPriority.URGENT;
    if (score >= 4) return JobPriority.HIGH;
    if (score >= 2) return JobPriority.NORMAL;
    return JobPriority.LOW;
  }
}