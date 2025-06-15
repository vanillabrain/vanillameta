import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { QueueJob, JobStatus, JobPriority } from '../entities/queue-job.entity';
import { JobProcessorService } from './job-processor.service';

@Injectable()
export class JobSchedulerService {
  private readonly logger = new Logger(JobSchedulerService.name);
  
  // 메모리 기반 스케줄링 큐 (간단한 우선순위 큐)
  private scheduledJobs = new Map<string, QueueJob>();
  private priorityQueue: QueueJob[] = [];
  private isProcessing = false;

  // 설정값들
  private readonly config = {
    maxConcurrentJobs: 10, // Lambda 환경 고려
    jobProcessingInterval: 5000, // 5초마다 체크
    batchSize: 5, // 한 번에 처리할 작업 수
    priorityWeights: {
      [JobPriority.URGENT]: 4,
      [JobPriority.HIGH]: 3,
      [JobPriority.NORMAL]: 2,
      [JobPriority.LOW]: 1,
    },
  };

  constructor(
    @InjectRepository(QueueJob)
    private jobRepository: Repository<QueueJob>,
    private jobProcessorService: JobProcessorService,
  ) {
    this.initializeScheduler();
  }

  /**
   * 스케줄러 초기화
   */
  private async initializeScheduler(): Promise<void> {
    try {
      // 기존 PENDING/RETRY 상태의 작업들을 메모리에 로드
      await this.loadPendingJobs();
      
      // 주기적 스케줄링 시작
      this.startJobProcessing();
      
      this.logger.log('Job scheduler initialized');
    } catch (error) {
      this.logger.error('Failed to initialize job scheduler', error);
    }
  }

  /**
   * DB에서 대기 중인 작업들을 메모리로 로드
   */
  private async loadPendingJobs(): Promise<void> {
    try {
      const pendingJobs = await this.jobRepository.find({
        where: [
          { status: JobStatus.PENDING },
          { status: JobStatus.RETRY },
        ],
        order: { priority: 'DESC', createdAt: 'ASC' },
      });

      for (const job of pendingJobs) {
        this.addToQueue(job);
      }

      this.logger.log(`Loaded ${pendingJobs.length} pending jobs`);
    } catch (error) {
      this.logger.error('Failed to load pending jobs', error);
    }
  }

  /**
   * 새 작업을 스케줄러에 추가
   */
  async scheduleJob(job: QueueJob): Promise<void> {
    try {
      this.addToQueue(job);
      this.logger.debug(`Job scheduled: ${job.id} (${job.jobType})`);
    } catch (error) {
      this.logger.error(`Failed to schedule job: ${job.id}`, error);
      throw error;
    }
  }

  /**
   * 작업을 스케줄러에서 제거
   */
  async removeJob(jobId: string): Promise<void> {
    try {
      this.scheduledJobs.delete(jobId);
      this.priorityQueue = this.priorityQueue.filter(job => job.id !== jobId);
      this.logger.debug(`Job removed from scheduler: ${jobId}`);
    } catch (error) {
      this.logger.error(`Failed to remove job: ${jobId}`, error);
    }
  }

  /**
   * 우선순위 큐에 작업 추가
   */
  private addToQueue(job: QueueJob): void {
    // 중복 방지
    if (this.scheduledJobs.has(job.id)) {
      return;
    }

    this.scheduledJobs.set(job.id, job);
    
    // 예약 시간이 있는 경우 현재 시간 이후인지 확인
    if (job.scheduledAt && job.scheduledAt > new Date()) {
      // 예약된 작업은 별도 처리
      this.scheduleDelayedJob(job);
      return;
    }

    // 우선순위 기반으로 삽입
    this.insertByPriority(job);
  }

  /**
   * 우선순위 기반 삽입
   */
  private insertByPriority(job: QueueJob): void {
    const jobScore = this.calculateJobScore(job);
    
    let insertIndex = 0;
    for (let i = 0; i < this.priorityQueue.length; i++) {
      const currentScore = this.calculateJobScore(this.priorityQueue[i]);
      if (jobScore <= currentScore) {
        insertIndex = i + 1;
      } else {
        break;
      }
    }
    
    this.priorityQueue.splice(insertIndex, 0, job);
  }

  /**
   * 작업 우선순위 점수 계산
   */
  private calculateJobScore(job: QueueJob): number {
    const priorityWeight = this.config.priorityWeights[job.priority];
    const ageInMinutes = (Date.now() - job.createdAt.getTime()) / (1000 * 60);
    const ageFactor = Math.min(ageInMinutes / 60, 2); // 최대 2시간까지 보정
    
    return priorityWeight + ageFactor;
  }

  /**
   * 예약된 작업 스케줄링
   */
  private scheduleDelayedJob(job: QueueJob): void {
    const delay = job.scheduledAt.getTime() - Date.now();
    
    setTimeout(() => {
      if (this.scheduledJobs.has(job.id)) {
        this.insertByPriority(job);
        this.logger.debug(`Delayed job activated: ${job.id}`);
      }
    }, delay);
  }

  /**
   * 주기적 작업 처리 시작
   */
  private startJobProcessing(): void {
    setInterval(async () => {
      if (!this.isProcessing && this.priorityQueue.length > 0) {
        await this.processJobs();
      }
    }, this.config.jobProcessingInterval);
  }

  /**
   * 큐에서 작업들을 처리
   */
  private async processJobs(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      const currentRunningJobs = await this.getCurrentRunningJobsCount();
      const availableSlots = this.config.maxConcurrentJobs - currentRunningJobs;

      if (availableSlots <= 0) {
        this.logger.debug('No available slots for new jobs');
        return;
      }

      const jobsToProcess = this.priorityQueue.splice(0, 
        Math.min(availableSlots, this.config.batchSize)
      );

      if (jobsToProcess.length === 0) {
        return;
      }

      // 병렬로 작업 처리 시작
      const processingPromises = jobsToProcess.map(job => 
        this.processJob(job).catch(error => {
          this.logger.error(`Failed to process job ${job.id}`, error);
        })
      );

      await Promise.allSettled(processingPromises);

      // 처리된 작업들을 스케줄러에서 제거
      jobsToProcess.forEach(job => {
        this.scheduledJobs.delete(job.id);
      });

      this.logger.debug(`Processed ${jobsToProcess.length} jobs`);
    } catch (error) {
      this.logger.error('Error in job processing', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * 개별 작업 처리
   */
  private async processJob(job: QueueJob): Promise<void> {
    try {
      // DB에서 최신 상태 확인
      const dbJob = await this.jobRepository.findOne({ 
        where: { id: job.id } 
      });

      if (!dbJob || dbJob.status !== JobStatus.PENDING) {
        this.logger.debug(`Job ${job.id} is no longer pending, skipping`);
        return;
      }

      // JobProcessorService에 위임하여 실제 작업 실행
      await this.jobProcessorService.processJob(dbJob);
      
    } catch (error) {
      this.logger.error(`Failed to process job ${job.id}`, error);
      
      // 작업 실패 처리
      await this.handleJobProcessingError(job, error);
    }
  }

  /**
   * 작업 처리 에러 핸들링
   */
  private async handleJobProcessingError(job: QueueJob, error: any): Promise<void> {
    try {
      await this.jobRepository.update(job.id, {
        status: JobStatus.FAILED,
        errorMessage: error.message,
        errorStack: error.stack,
        completedAt: new Date(),
      });
    } catch (updateError) {
      this.logger.error(`Failed to update job error status: ${job.id}`, updateError);
    }
  }

  /**
   * 현재 실행 중인 작업 수 조회
   */
  private async getCurrentRunningJobsCount(): Promise<number> {
    try {
      return await this.jobRepository.count({
        where: { status: JobStatus.RUNNING }
      });
    } catch (error) {
      this.logger.error('Failed to get running jobs count', error);
      return this.config.maxConcurrentJobs; // 안전을 위해 최대값 반환
    }
  }

  /**
   * 예약된 작업들을 활성화 (매분 실행)
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async activateScheduledJobs(): Promise<void> {
    try {
      const now = new Date();
      const scheduledJobs = await this.jobRepository.find({
        where: {
          status: JobStatus.PENDING,
          scheduledAt: LessThanOrEqual(now),
        },
        take: 100, // 한 번에 최대 100개
      });

      for (const job of scheduledJobs) {
        if (!this.scheduledJobs.has(job.id)) {
          this.addToQueue(job);
        }
      }

      if (scheduledJobs.length > 0) {
        this.logger.debug(`Activated ${scheduledJobs.length} scheduled jobs`);
      }
    } catch (error) {
      this.logger.error('Failed to activate scheduled jobs', error);
    }
  }

  /**
   * 좀비 작업 정리 (매 10분 실행)
   */
  @Cron('0 */10 * * * *')
  async cleanupZombieJobs(): Promise<void> {
    try {
      const zombieThreshold = new Date(Date.now() - 30 * 60 * 1000); // 30분 전
      
      const zombieJobs = await this.jobRepository.find({
        where: {
          status: JobStatus.RUNNING,
          startedAt: LessThanOrEqual(zombieThreshold),
        },
      });

      for (const job of zombieJobs) {
        await this.jobRepository.update(job.id, {
          status: JobStatus.FAILED,
          errorMessage: 'Job timed out (zombie process cleanup)',
          completedAt: new Date(),
        });
      }

      if (zombieJobs.length > 0) {
        this.logger.warn(`Cleaned up ${zombieJobs.length} zombie jobs`);
      }
    } catch (error) {
      this.logger.error('Failed to cleanup zombie jobs', error);
    }
  }

  /**
   * 스케줄러 상태 정보
   */
  getSchedulerStatus(): {
    queueLength: number;
    scheduledJobsCount: number;
    isProcessing: boolean;
    config: typeof this.config;
  } {
    return {
      queueLength: this.priorityQueue.length,
      scheduledJobsCount: this.scheduledJobs.size,
      isProcessing: this.isProcessing,
      config: this.config,
    };
  }

  /**
   * 스케줄러 설정 업데이트
   */
  updateConfig(newConfig: Partial<typeof this.config>): void {
    Object.assign(this.config, newConfig);
    this.logger.log('Scheduler configuration updated', newConfig);
  }
}