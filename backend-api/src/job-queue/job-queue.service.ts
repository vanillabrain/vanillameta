import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, In } from 'typeorm';
import { QueueJob, JobStatus, JobType, JobPriority } from './entities/queue-job.entity';
import { JobResult } from './entities/job-result.entity';
import { CreateJobDto } from './dto/create-job.dto';
import { JobQueryDto, JobListResponseDto } from './dto/job-query.dto';
import { UpdateJobStatusDto, JobStatusResponseDto } from './dto/job-status.dto';
import { JobSchedulerService } from './services/job-scheduler.service';
import { JobStatusTrackerService } from './services/job-status-tracker.service';
import { JobRetryService } from './services/job-retry.service';
import { JobNotificationService } from './services/job-notification.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class JobQueueService {
  private readonly logger = new Logger(JobQueueService.name);

  constructor(
    @InjectRepository(QueueJob)
    private jobRepository: Repository<QueueJob>,
    
    @InjectRepository(JobResult)
    private jobResultRepository: Repository<JobResult>,
    
    private jobSchedulerService: JobSchedulerService,
    private jobStatusTrackerService: JobStatusTrackerService,
    private jobRetryService: JobRetryService,
    private jobNotificationService: JobNotificationService,
  ) {}

  /**
   * 새로운 작업을 큐에 추가
   */
  async createJob(createJobDto: CreateJobDto, userId?: string): Promise<QueueJob> {
    try {
      const job = new QueueJob();
      
      job.id = uuidv4();
      job.jobType = createJobDto.jobType;
      job.userId = userId;
      job.jobData = JSON.stringify(createJobDto.jobData);
      job.priority = createJobDto.priority || JobPriority.NORMAL;
      job.maxRetries = createJobDto.maxRetries || 3;
      job.estimatedTimeMs = createJobDto.estimatedTimeMs;
      job.correlationId = createJobDto.correlationId;
      job.metadata = createJobDto.metadata ? JSON.stringify(createJobDto.metadata) : null;
      job.requiresNotification = createJobDto.requiresNotification || false;
      job.notificationEmail = createJobDto.notificationEmail;

      // 예약 시간 설정
      if (createJobDto.scheduledAt) {
        job.scheduledAt = new Date(createJobDto.scheduledAt);
        
        // 과거 시간은 불가
        if (job.scheduledAt <= new Date()) {
          throw new BadRequestException('Scheduled time must be in the future');
        }
      }

      const savedJob = await this.jobRepository.save(job);

      // 스케줄러에 작업 등록
      await this.jobSchedulerService.scheduleJob(savedJob);

      // 상태 히스토리 기록
      await this.jobStatusTrackerService.recordStatusChange(
        savedJob.id,
        JobStatus.PENDING,
        null,
        'Job created and queued',
        { userId, priority: job.priority }
      );

      this.logger.log(`Job created: ${savedJob.id} (${savedJob.jobType})`);
      
      return savedJob;
    } catch (error) {
      this.logger.error('Failed to create job', error);
      throw error;
    }
  }

  /**
   * 작업 상태 업데이트
   */
  async updateJobStatus(
    jobId: string, 
    updateDto: UpdateJobStatusDto, 
    userId?: string
  ): Promise<JobStatusResponseDto> {
    try {
      const job = await this.jobRepository.findOne({ where: { id: jobId } });
      
      if (!job) {
        throw new NotFoundException(`Job not found: ${jobId}`);
      }

      const previousStatus = job.status;
      
      // 상태 변경 검증
      this.validateStatusTransition(previousStatus, updateDto.status);

      // 작업 정보 업데이트
      job.status = updateDto.status;
      job.workerId = updateDto.workerId || job.workerId;
      
      if (updateDto.progress !== undefined) {
        job.progress = updateDto.progress;
      }

      if (updateDto.errorMessage) {
        job.errorMessage = updateDto.errorMessage;
      }

      // 상태별 특별 처리
      switch (updateDto.status) {
        case JobStatus.RUNNING:
          if (!job.startedAt) {
            job.startedAt = new Date();
          }
          break;
          
        case JobStatus.COMPLETED:
          job.completedAt = new Date();
          if (job.startedAt) {
            job.executionTimeMs = job.completedAt.getTime() - job.startedAt.getTime();
          }
          break;
          
        case JobStatus.FAILED:
          job.completedAt = new Date();
          if (job.startedAt) {
            job.executionTimeMs = job.completedAt.getTime() - job.startedAt.getTime();
          }
          // 재시도 가능한지 확인하고 스케줄링
          if (job.canRetry) {
            await this.jobRetryService.scheduleRetry(job);
          }
          break;

        case JobStatus.CANCELLED:
          job.completedAt = new Date();
          break;
      }

      const updatedJob = await this.jobRepository.save(job);

      // 상태 히스토리 기록
      await this.jobStatusTrackerService.recordStatusChange(
        jobId,
        updateDto.status,
        previousStatus,
        updateDto.reason || `Status changed to ${updateDto.status}`,
        {
          workerId: updateDto.workerId,
          progress: updateDto.progress,
          errorMessage: updateDto.errorMessage,
          userId,
        }
      );

      // 완료/실패 시 알림 발송
      if ((updateDto.status === JobStatus.COMPLETED || updateDto.status === JobStatus.FAILED) 
          && job.requiresNotification) {
        await this.jobNotificationService.sendJobCompletionNotification(updatedJob);
      }

      this.logger.log(`Job status updated: ${jobId} ${previousStatus} -> ${updateDto.status}`);

      return this.mapToStatusResponse(updatedJob);
    } catch (error) {
      this.logger.error(`Failed to update job status: ${jobId}`, error);
      throw error;
    }
  }

  /**
   * 작업 목록 조회
   */
  async getJobs(queryDto: JobQueryDto, userId?: string): Promise<JobListResponseDto> {
    try {
      const whereClause: FindOptionsWhere<QueueJob> = {};

      // 필터 조건 구성
      if (queryDto.status) whereClause.status = queryDto.status;
      if (queryDto.jobType) whereClause.jobType = queryDto.jobType;
      if (queryDto.priority) whereClause.priority = queryDto.priority;
      if (queryDto.correlationId) whereClause.correlationId = queryDto.correlationId;
      if (queryDto.workerId) whereClause.workerId = queryDto.workerId;
      
      // 사용자별 필터링 (관리자가 아닌 경우)
      if (userId && !queryDto.userId) {
        whereClause.userId = userId;
      } else if (queryDto.userId) {
        whereClause.userId = queryDto.userId;
      }

      const queryBuilder = this.jobRepository.createQueryBuilder('job');

      // WHERE 조건 적용
      Object.entries(whereClause).forEach(([key, value]) => {
        queryBuilder.andWhere(`job.${key} = :${key}`, { [key]: value });
      });

      // 날짜 범위 필터
      if (queryDto.startDate) {
        queryBuilder.andWhere('job.createdAt >= :startDate', { 
          startDate: new Date(queryDto.startDate) 
        });
      }
      if (queryDto.endDate) {
        queryBuilder.andWhere('job.createdAt <= :endDate', { 
          endDate: new Date(queryDto.endDate) 
        });
      }

      // 총 개수 계산
      const total = await queryBuilder.getCount();

      // 정렬 및 페이징
      const sortBy = queryDto.sortBy || 'createdAt';
      const sortOrder = queryDto.sortOrder || 'DESC';
      const page = queryDto.page || 1;
      const limit = queryDto.limit || 20;
      const offset = (page - 1) * limit;

      queryBuilder
        .orderBy(`job.${sortBy}`, sortOrder)
        .skip(offset)
        .take(limit);

      const jobs = await queryBuilder.getMany();

      const totalPages = Math.ceil(total / limit);

      return {
        jobs: jobs.map(job => this.mapToJobResponse(job)),
        total,
        page,
        limit,
        totalPages,
        hasPrevious: page > 1,
        hasNext: page < totalPages,
      };
    } catch (error) {
      this.logger.error('Failed to get jobs', error);
      throw error;
    }
  }

  /**
   * 특정 작업 조회
   */
  async getJob(jobId: string, userId?: string): Promise<QueueJob> {
    try {
      const whereClause: FindOptionsWhere<QueueJob> = { id: jobId };
      
      // 사용자별 접근 제한
      if (userId) {
        whereClause.userId = userId;
      }

      const job = await this.jobRepository.findOne({
        where: whereClause,
        relations: ['jobResult'],
      });

      if (!job) {
        throw new NotFoundException(`Job not found: ${jobId}`);
      }

      return job;
    } catch (error) {
      this.logger.error(`Failed to get job: ${jobId}`, error);
      throw error;
    }
  }

  /**
   * 작업 취소
   */
  async cancelJob(jobId: string, reason?: string, userId?: string): Promise<void> {
    try {
      const job = await this.getJob(jobId, userId);

      if (job.status === JobStatus.COMPLETED || job.status === JobStatus.CANCELLED) {
        throw new BadRequestException('Cannot cancel completed or already cancelled job');
      }

      await this.updateJobStatus(jobId, {
        status: JobStatus.CANCELLED,
        reason: reason || 'Job cancelled by user',
      }, userId);

      // 스케줄러에서 제거
      await this.jobSchedulerService.removeJob(jobId);

      this.logger.log(`Job cancelled: ${jobId}`);
    } catch (error) {
      this.logger.error(`Failed to cancel job: ${jobId}`, error);
      throw error;
    }
  }

  /**
   * 작업 재시작
   */
  async retryJob(jobId: string, userId?: string): Promise<QueueJob> {
    try {
      const job = await this.getJob(jobId, userId);

      if (!job.canRetry) {
        throw new BadRequestException('Job cannot be retried');
      }

      await this.jobRetryService.retryJob(job);
      
      return await this.getJob(jobId, userId);
    } catch (error) {
      this.logger.error(`Failed to retry job: ${jobId}`, error);
      throw error;
    }
  }

  /**
   * 다음 실행할 작업 가져오기 (Worker에서 사용)
   */
  async getNextJob(workerId: string, jobTypes?: JobType[]): Promise<QueueJob | null> {
    try {
      const queryBuilder = this.jobRepository.createQueryBuilder('job');

      queryBuilder
        .where('job.status = :status', { status: JobStatus.PENDING })
        .andWhere('(job.scheduledAt IS NULL OR job.scheduledAt <= :now)', { now: new Date() });

      if (jobTypes && jobTypes.length > 0) {
        queryBuilder.andWhere('job.jobType IN (:...jobTypes)', { jobTypes });
      }

      queryBuilder
        .orderBy('job.priority', 'DESC')
        .addOrderBy('job.createdAt', 'ASC')
        .limit(1);

      const job = await queryBuilder.getOne();

      if (job) {
        // 작업을 RUNNING 상태로 변경
        await this.updateJobStatus(job.id, {
          status: JobStatus.RUNNING,
          workerId,
          reason: 'Job picked up by worker',
        });

        return job;
      }

      return null;
    } catch (error) {
      this.logger.error('Failed to get next job', error);
      throw error;
    }
  }

  /**
   * 벌크 상태 업데이트
   */
  async bulkUpdateStatus(
    jobIds: string[],
    status: JobStatus,
    reason?: string,
    userId?: string
  ): Promise<void> {
    try {
      await this.jobRepository.update(
        { id: In(jobIds) },
        { status, updatedAt: new Date() }
      );

      // 히스토리 기록
      for (const jobId of jobIds) {
        await this.jobStatusTrackerService.recordStatusChange(
          jobId,
          status,
          null,
          reason || `Bulk status update to ${status}`,
          { userId, bulkUpdate: true }
        );
      }

      this.logger.log(`Bulk status update: ${jobIds.length} jobs -> ${status}`);
    } catch (error) {
      this.logger.error('Failed to bulk update status', error);
      throw error;
    }
  }

  // Private helper methods

  private validateStatusTransition(from: JobStatus, to: JobStatus): void {
    const validTransitions: Record<JobStatus, JobStatus[]> = {
      [JobStatus.PENDING]: [JobStatus.RUNNING, JobStatus.CANCELLED],
      [JobStatus.RUNNING]: [JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED],
      [JobStatus.FAILED]: [JobStatus.RETRY, JobStatus.CANCELLED],
      [JobStatus.RETRY]: [JobStatus.RUNNING, JobStatus.CANCELLED],
      [JobStatus.COMPLETED]: [],
      [JobStatus.CANCELLED]: [],
    };

    if (!validTransitions[from].includes(to)) {
      throw new BadRequestException(`Invalid status transition: ${from} -> ${to}`);
    }
  }

  private mapToStatusResponse(job: QueueJob): JobStatusResponseDto {
    return {
      jobId: job.id,
      status: job.status,
      progress: job.progress || 0,
      errorMessage: job.errorMessage,
      estimatedCompletionTime: this.calculateEstimatedCompletion(job),
      createdAt: job.createdAt.toISOString(),
      startedAt: job.startedAt?.toISOString(),
      completedAt: job.completedAt?.toISOString(),
    };
  }

  private mapToJobResponse(job: QueueJob): any {
    return {
      id: job.id,
      jobType: job.jobType,
      status: job.status,
      priority: job.priority,
      progress: job.progress || 0,
      retryCount: job.retryCount,
      maxRetries: job.maxRetries,
      correlationId: job.correlationId,
      requiresNotification: job.requiresNotification,
      createdAt: job.createdAt.toISOString(),
      scheduledAt: job.scheduledAt?.toISOString(),
      startedAt: job.startedAt?.toISOString(),
      completedAt: job.completedAt?.toISOString(),
      executionTimeMs: job.executionTimeMs,
      estimatedTimeMs: job.estimatedTimeMs,
      workerId: job.workerId,
      errorMessage: job.errorMessage,
      metadata: job.metadataParsed,
    };
  }

  private calculateEstimatedCompletion(job: QueueJob): string | undefined {
    if (job.status !== JobStatus.RUNNING || !job.startedAt || !job.estimatedTimeMs) {
      return undefined;
    }

    const estimatedCompletionTime = new Date(
      job.startedAt.getTime() + job.estimatedTimeMs
    );

    return estimatedCompletionTime.toISOString();
  }
}