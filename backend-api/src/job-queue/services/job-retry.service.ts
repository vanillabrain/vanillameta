import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QueueJob, JobStatus, JobType } from '../entities/queue-job.entity';
import { JobStatusTrackerService } from './job-status-tracker.service';

export interface RetryStrategy {
  calculateRetryDelay(retryCount: number, jobType: JobType): number;
  shouldRetry(job: QueueJob, error: any): boolean;
}

@Injectable()
export class JobRetryService {
  private readonly logger = new Logger(JobRetryService.name);

  // 재시도 전략
  private retryStrategies = new Map<JobType, RetryStrategy>();

  // 기본 재시도 설정
  private readonly defaultConfig = {
    maxRetries: 3,
    baseDelayMs: 5000, // 5초
    maxDelayMs: 300000, // 5분
    backoffMultiplier: 2,
    jitterPercentage: 0.1, // 10% 지터
  };

  constructor(
    @InjectRepository(QueueJob)
    private jobRepository: Repository<QueueJob>,
    private jobStatusTrackerService: JobStatusTrackerService,
  ) {
    this.initializeRetryStrategies();
  }

  /**
   * 재시도 전략 초기화
   */
  private initializeRetryStrategies(): void {
    // 쿼리 실행 작업 재시도 전략
    this.retryStrategies.set(JobType.QUERY_EXECUTION, new QueryExecutionRetryStrategy());

    // 대량 데이터 내보내기 재시도 전략
    this.retryStrategies.set(JobType.BULK_DATA_EXPORT, new BulkDataExportRetryStrategy());

    // 대시보드 생성 재시도 전략
    this.retryStrategies.set(JobType.DASHBOARD_GENERATION, new DashboardGenerationRetryStrategy());

    // 데이터 마이그레이션 재시도 전략
    this.retryStrategies.set(JobType.DATA_MIGRATION, new DataMigrationRetryStrategy());

    // 캐시 워밍업 재시도 전략
    this.retryStrategies.set(JobType.CACHE_WARMUP, new CacheWarmupRetryStrategy());

    // 리포트 생성 재시도 전략
    this.retryStrategies.set(JobType.REPORT_GENERATION, new ReportGenerationRetryStrategy());
  }

  /**
   * 작업 재시도 스케줄링
   */
  async scheduleRetry(job: QueueJob, error?: any): Promise<void> {
    try {
      if (!job.canRetry) {
        this.logger.warn(`Job ${job.id} cannot be retried (reached max retries)`);
        return;
      }

      const strategy = this.retryStrategies.get(job.jobType) || new DefaultRetryStrategy();

      // 재시도 가능 여부 확인
      if (!strategy.shouldRetry(job, error)) {
        this.logger.warn(`Job ${job.id} should not be retried according to strategy`);
        await this.markJobAsPermanentlyFailed(job, 'Strategy determined job should not be retried');
        return;
      }

      // 재시도 지연 시간 계산
      const retryDelay = strategy.calculateRetryDelay(job.retryCount, job.jobType);
      const retryAt = new Date(Date.now() + retryDelay);

      // 작업 상태 업데이트
      await this.jobRepository.update(job.id, {
        status: JobStatus.RETRY,
        retryCount: job.retryCount + 1,
        scheduledAt: retryAt,
        errorMessage: error?.message || job.errorMessage,
        errorStack: error?.stack || job.errorStack,
        updatedAt: new Date(),
      });

      // 상태 변경 기록
      await this.jobStatusTrackerService.recordStatusChange(
        job.id,
        JobStatus.RETRY,
        JobStatus.FAILED,
        `Scheduled for retry ${job.retryCount + 1}/${job.maxRetries}`,
        {
          retryDelay,
          retryAt: retryAt.toISOString(),
          error: error?.message,
          strategy: strategy.constructor.name,
        },
      );

      this.logger.log(
        `Job ${job.id} scheduled for retry in ${retryDelay}ms (attempt ${job.retryCount + 1}/${
          job.maxRetries
        })`,
      );
    } catch (retryError) {
      this.logger.error(`Failed to schedule retry for job ${job.id}`, retryError);
      await this.markJobAsPermanentlyFailed(job, `Retry scheduling failed: ${retryError.message}`);
    }
  }

  /**
   * 작업 재시도 실행
   */
  async retryJob(job: QueueJob): Promise<void> {
    try {
      if (!job.canRetry) {
        throw new Error(`Job ${job.id} cannot be retried`);
      }

      // 재시도를 위해 상태를 PENDING으로 변경
      await this.jobRepository.update(job.id, {
        status: JobStatus.PENDING,
        scheduledAt: null, // 즉시 실행
        startedAt: null,
        completedAt: null,
        executionTimeMs: null,
        workerId: null,
        progress: 0,
        updatedAt: new Date(),
      });

      // 상태 변경 기록
      await this.jobStatusTrackerService.recordStatusChange(
        job.id,
        JobStatus.PENDING,
        JobStatus.RETRY,
        'Job manually retried',
        { manualRetry: true },
      );

      this.logger.log(`Job ${job.id} manually retried`);
    } catch (error) {
      this.logger.error(`Failed to retry job ${job.id}`, error);
      throw error;
    }
  }

  /**
   * 재시도 통계 조회
   */
  async getRetryStatistics(days = 7): Promise<{
    totalRetries: number;
    retryByJobType: Record<JobType, number>;
    successfulRetries: number;
    failedRetries: number;
    averageRetryCount: number;
    retrySuccessRate: number;
    commonFailureReasons: Array<{ reason: string; count: number }>;
  }> {
    try {
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      // 재시도된 작업들 조회
      const retriedJobs = await this.jobRepository
        .createQueryBuilder('job')
        .where('job.retryCount > 0')
        .andWhere('job.updatedAt >= :startDate', { startDate })
        .getMany();

      const totalRetries = retriedJobs.reduce((sum, job) => sum + job.retryCount, 0);

      // 작업 유형별 재시도 수
      const retryByJobType: Record<JobType, number> = {
        [JobType.QUERY_EXECUTION]: 0,
        [JobType.BULK_DATA_EXPORT]: 0,
        [JobType.DASHBOARD_GENERATION]: 0,
        [JobType.DATA_MIGRATION]: 0,
        [JobType.CACHE_WARMUP]: 0,
        [JobType.REPORT_GENERATION]: 0,
      };

      let successfulRetries = 0;
      let failedRetries = 0;
      const failureReasons = new Map<string, number>();

      for (const job of retriedJobs) {
        retryByJobType[job.jobType] += job.retryCount;

        if (job.status === JobStatus.COMPLETED) {
          successfulRetries++;
        } else if (job.status === JobStatus.FAILED) {
          failedRetries++;

          // 실패 이유 집계
          const reason = this.categorizeFailureReason(job.errorMessage);
          failureReasons.set(reason, (failureReasons.get(reason) || 0) + 1);
        }
      }

      const averageRetryCount = retriedJobs.length > 0 ? totalRetries / retriedJobs.length : 0;

      const retrySuccessRate =
        successfulRetries + failedRetries > 0
          ? (successfulRetries / (successfulRetries + failedRetries)) * 100
          : 0;

      const commonFailureReasons = Array.from(failureReasons.entries())
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      return {
        totalRetries,
        retryByJobType,
        successfulRetries,
        failedRetries,
        averageRetryCount: Math.round(averageRetryCount * 100) / 100,
        retrySuccessRate: Math.round(retrySuccessRate * 100) / 100,
        commonFailureReasons,
      };
    } catch (error) {
      this.logger.error('Failed to get retry statistics', error);
      throw error;
    }
  }

  /**
   * 재시도 설정 업데이트
   */
  async updateRetryConfig(
    jobType: JobType,
    config: Partial<typeof this.defaultConfig>,
  ): Promise<void> {
    try {
      // 실제로는 DB나 설정 파일에 저장
      // 여기서는 로깅만 수행
      this.logger.log(`Retry config updated for ${jobType}:`, config);
    } catch (error) {
      this.logger.error(`Failed to update retry config for ${jobType}`, error);
      throw error;
    }
  }

  /**
   * 재시도 가능한 작업들 조회
   */
  async getRetriableJobs(): Promise<QueueJob[]> {
    try {
      return await this.jobRepository.find({
        where: {
          status: JobStatus.FAILED,
        },
        order: { updatedAt: 'DESC' },
        take: 100,
      });
    } catch (error) {
      this.logger.error('Failed to get retriable jobs', error);
      throw error;
    }
  }

  /**
   * 벌크 재시도
   */
  async bulkRetry(
    jobIds: string[],
    reason?: string,
  ): Promise<{
    successful: string[];
    failed: Array<{ jobId: string; error: string }>;
  }> {
    const successful: string[] = [];
    const failed: Array<{ jobId: string; error: string }> = [];

    for (const jobId of jobIds) {
      try {
        const job = await this.jobRepository.findOne({ where: { id: jobId } });

        if (!job) {
          failed.push({ jobId, error: 'Job not found' });
          continue;
        }

        if (!job.canRetry) {
          failed.push({ jobId, error: 'Job cannot be retried' });
          continue;
        }

        await this.retryJob(job);
        successful.push(jobId);
      } catch (error) {
        failed.push({ jobId, error: error.message });
      }
    }

    this.logger.log(
      `Bulk retry completed: ${successful.length} successful, ${failed.length} failed`,
    );

    return { successful, failed };
  }

  // Private helper methods

  /**
   * 작업을 영구 실패로 마킹
   */
  private async markJobAsPermanentlyFailed(job: QueueJob, reason: string): Promise<void> {
    try {
      await this.jobRepository.update(job.id, {
        status: JobStatus.FAILED,
        completedAt: new Date(),
        updatedAt: new Date(),
      });

      await this.jobStatusTrackerService.recordStatusChange(
        job.id,
        JobStatus.FAILED,
        job.status,
        `Permanently failed: ${reason}`,
        { permanentFailure: true },
      );
    } catch (error) {
      this.logger.error(`Failed to mark job as permanently failed: ${job.id}`, error);
    }
  }

  /**
   * 실패 이유 분류
   */
  private categorizeFailureReason(errorMessage?: string): string {
    if (!errorMessage) return 'Unknown';

    const message = errorMessage.toLowerCase();

    if (message.includes('timeout') || message.includes('timed out')) {
      return 'Timeout';
    }
    if (message.includes('connection') || message.includes('network')) {
      return 'Connection Error';
    }
    if (message.includes('memory') || message.includes('out of memory')) {
      return 'Memory Error';
    }
    if (message.includes('permission') || message.includes('unauthorized')) {
      return 'Permission Error';
    }
    if (message.includes('syntax') || message.includes('sql')) {
      return 'Query Error';
    }
    if (message.includes('resource') || message.includes('limit')) {
      return 'Resource Limit';
    }

    return 'Other';
  }
}

// 재시도 전략 구현

class DefaultRetryStrategy implements RetryStrategy {
  calculateRetryDelay(retryCount: number, jobType: JobType): number {
    const baseDelay = 5000; // 5초
    const maxDelay = 300000; // 5분
    const backoffMultiplier = 2;
    const jitterPercentage = 0.1;

    let delay = Math.min(baseDelay * Math.pow(backoffMultiplier, retryCount), maxDelay);

    // 지터 추가 (부하 분산을 위해)
    const jitter = delay * jitterPercentage * Math.random();
    delay += jitter;

    return Math.round(delay);
  }

  shouldRetry(job: QueueJob, error: any): boolean {
    if (!error) return true;

    const message = error.message?.toLowerCase() || '';

    // 재시도하지 않을 조건들
    const nonRetriableErrors = [
      'syntax error',
      'permission denied',
      'unauthorized',
      'forbidden',
      'invalid query',
      'bad request',
    ];

    return !nonRetriableErrors.some(pattern => message.includes(pattern));
  }
}

class QueryExecutionRetryStrategy extends DefaultRetryStrategy {
  calculateRetryDelay(retryCount: number): number {
    // 쿼리 실행은 빠른 재시도
    const baseDelay = 2000; // 2초
    const maxDelay = 60000; // 1분
    return Math.min(baseDelay * Math.pow(1.5, retryCount), maxDelay);
  }

  shouldRetry(job: QueueJob, error: any): boolean {
    if (!super.shouldRetry(job, error)) return false;

    const message = error?.message?.toLowerCase() || '';

    // 데이터베이스 연결 오류나 일시적 오류는 재시도
    return (
      message.includes('connection') || message.includes('timeout') || message.includes('temporary')
    );
  }
}

class BulkDataExportRetryStrategy extends DefaultRetryStrategy {
  calculateRetryDelay(retryCount: number): number {
    // 대량 데이터는 긴 재시도 간격
    const baseDelay = 30000; // 30초
    const maxDelay = 600000; // 10분
    return Math.min(baseDelay * Math.pow(2, retryCount), maxDelay);
  }

  shouldRetry(job: QueueJob, error: any): boolean {
    if (!super.shouldRetry(job, error)) return false;

    const message = error?.message?.toLowerCase() || '';

    // 메모리 부족 오류는 재시도하지 않음
    return !message.includes('out of memory') && !message.includes('memory limit');
  }
}

class DashboardGenerationRetryStrategy extends DefaultRetryStrategy {
  calculateRetryDelay(retryCount: number): number {
    // 대시보드 생성은 중간 재시도 간격
    const baseDelay = 10000; // 10초
    const maxDelay = 180000; // 3분
    return Math.min(baseDelay * Math.pow(1.8, retryCount), maxDelay);
  }
}

class DataMigrationRetryStrategy extends DefaultRetryStrategy {
  calculateRetryDelay(retryCount: number): number {
    // 데이터 마이그레이션은 매우 긴 재시도 간격
    const baseDelay = 60000; // 1분
    const maxDelay = 1800000; // 30분
    return Math.min(baseDelay * Math.pow(2.5, retryCount), maxDelay);
  }

  shouldRetry(job: QueueJob, error: any): boolean {
    if (!super.shouldRetry(job, error)) return false;

    // 데이터 무결성 오류는 재시도하지 않음
    const message = error?.message?.toLowerCase() || '';
    return (
      !message.includes('constraint') &&
      !message.includes('duplicate') &&
      !message.includes('integrity')
    );
  }
}

class CacheWarmupRetryStrategy extends DefaultRetryStrategy {
  calculateRetryDelay(retryCount: number): number {
    // 캐시 워밍업은 빠른 재시도
    const baseDelay = 5000; // 5초
    const maxDelay = 120000; // 2분
    return Math.min(baseDelay * Math.pow(1.5, retryCount), maxDelay);
  }

  shouldRetry(job: QueueJob, error: any): boolean {
    // 캐시 워밍업은 거의 모든 오류에서 재시도
    return true;
  }
}

class ReportGenerationRetryStrategy extends DefaultRetryStrategy {
  calculateRetryDelay(retryCount: number): number {
    // 리포트 생성은 중간 재시도 간격
    const baseDelay = 15000; // 15초
    const maxDelay = 300000; // 5분
    return Math.min(baseDelay * Math.pow(2, retryCount), maxDelay);
  }
}
