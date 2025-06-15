import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { JobStatusHistory } from '../entities/job-status-history.entity';
import { QueueJob, JobStatus } from '../entities/queue-job.entity';
import { v4 as uuidv4 } from 'uuid';

export interface StatusChangeEvent {
  jobId: string;
  status: JobStatus;
  previousStatus?: JobStatus;
  reason?: string;
  details?: any;
  changedBy?: string;
  timestamp: Date;
}

@Injectable()
export class JobStatusTrackerService {
  private readonly logger = new Logger(JobStatusTrackerService.name);
  
  // 메모리 기반 이벤트 스트림 (최근 1000개 이벤트 유지)
  private statusEvents: StatusChangeEvent[] = [];
  private readonly maxEventsInMemory = 1000;

  constructor(
    @InjectRepository(JobStatusHistory)
    private statusHistoryRepository: Repository<JobStatusHistory>,
    
    @InjectRepository(QueueJob)
    private jobRepository: Repository<QueueJob>,
  ) {}

  /**
   * 상태 변경 기록
   */
  async recordStatusChange(
    jobId: string,
    newStatus: JobStatus,
    previousStatus?: JobStatus,
    reason?: string,
    details?: any,
    changedBy?: string,
    progress?: number,
  ): Promise<void> {
    try {
      const timestamp = new Date();
      
      // DB에 히스토리 저장
      const statusHistory = new JobStatusHistory();
      statusHistory.id = uuidv4();
      statusHistory.jobId = jobId;
      statusHistory.status = newStatus;
      statusHistory.previousStatus = previousStatus;
      statusHistory.reason = reason;
      statusHistory.details = details ? JSON.stringify(details) : null;
      statusHistory.changedBy = changedBy;
      statusHistory.progress = progress;
      statusHistory.createdAt = timestamp;

      await this.statusHistoryRepository.save(statusHistory);

      // 메모리 이벤트 스트림에 추가
      const event: StatusChangeEvent = {
        jobId,
        status: newStatus,
        previousStatus,
        reason,
        details,
        changedBy,
        timestamp,
      };

      this.addToEventStream(event);

      this.logger.debug(`Status change recorded: ${jobId} ${previousStatus || 'none'} -> ${newStatus}`);
    } catch (error) {
      this.logger.error(`Failed to record status change for job: ${jobId}`, error);
      throw error;
    }
  }

  /**
   * 작업의 상태 히스토리 조회
   */
  async getJobStatusHistory(
    jobId: string,
    limit: number = 50
  ): Promise<JobStatusHistory[]> {
    try {
      return await this.statusHistoryRepository.find({
        where: { jobId },
        order: { createdAt: 'DESC' },
        take: limit,
      });
    } catch (error) {
      this.logger.error(`Failed to get status history for job: ${jobId}`, error);
      throw error;
    }
  }

  /**
   * 특정 기간의 상태 변경 통계
   */
  async getStatusChangeStatistics(
    startDate: Date,
    endDate: Date,
    jobIds?: string[]
  ): Promise<{
    totalChanges: number;
    statusBreakdown: Record<JobStatus, number>;
    timelineData: Array<{
      hour: string;
      statusChanges: Record<JobStatus, number>;
    }>;
    averageProgressTime: Record<string, number>; // status transition -> avg time
  }> {
    try {
      const query = this.statusHistoryRepository.createQueryBuilder('history')
        .where('history.createdAt BETWEEN :startDate AND :endDate', {
          startDate,
          endDate,
        });

      if (jobIds && jobIds.length > 0) {
        query.andWhere('history.jobId IN (:...jobIds)', { jobIds });
      }

      const statusChanges = await query
        .orderBy('history.createdAt', 'ASC')
        .getMany();

      // 통계 계산
      const totalChanges = statusChanges.length;
      const statusBreakdown: Record<JobStatus, number> = {
        [JobStatus.PENDING]: 0,
        [JobStatus.RUNNING]: 0,
        [JobStatus.COMPLETED]: 0,
        [JobStatus.FAILED]: 0,
        [JobStatus.CANCELLED]: 0,
        [JobStatus.RETRY]: 0,
      };

      // 시간대별 데이터
      const timelineData = new Map<string, Record<JobStatus, number>>();

      // 상태 전환 시간 계산
      const transitionTimes = new Map<string, number[]>();

      for (const change of statusChanges) {
        statusBreakdown[change.status]++;

        // 시간대별 통계
        const hour = change.createdAt.toISOString().substring(0, 13) + ':00:00Z';
        if (!timelineData.has(hour)) {
          timelineData.set(hour, {
            [JobStatus.PENDING]: 0,
            [JobStatus.RUNNING]: 0,
            [JobStatus.COMPLETED]: 0,
            [JobStatus.FAILED]: 0,
            [JobStatus.CANCELLED]: 0,
            [JobStatus.RETRY]: 0,
          });
        }
        timelineData.get(hour)![change.status]++;

        // 상태 전환 시간 계산
        if (change.previousStatus && change.executionTimeMs) {
          const transitionKey = `${change.previousStatus}->${change.status}`;
          if (!transitionTimes.has(transitionKey)) {
            transitionTimes.set(transitionKey, []);
          }
          transitionTimes.get(transitionKey)!.push(change.executionTimeMs);
        }
      }

      // 평균 상태 전환 시간 계산
      const averageProgressTime: Record<string, number> = {};
      for (const [transition, times] of transitionTimes) {
        averageProgressTime[transition] = Math.round(
          times.reduce((sum, time) => sum + time, 0) / times.length
        );
      }

      return {
        totalChanges,
        statusBreakdown,
        timelineData: Array.from(timelineData.entries()).map(([hour, statusChanges]) => ({
          hour,
          statusChanges,
        })),
        averageProgressTime,
      };
    } catch (error) {
      this.logger.error('Failed to get status change statistics', error);
      throw error;
    }
  }

  /**
   * 작업 진행 상황 추적
   */
  async trackJobProgress(
    jobId: string,
    progress: number,
    details?: any,
    changedBy?: string
  ): Promise<void> {
    try {
      const job = await this.jobRepository.findOne({ where: { id: jobId } });
      if (!job) {
        throw new Error(`Job not found: ${jobId}`);
      }

      // 진행률이 실제로 변경된 경우만 기록
      if (job.progress !== progress) {
        await this.recordStatusChange(
          jobId,
          job.status,
          job.status,
          `Progress updated to ${progress}%`,
          { ...details, progressChange: { from: job.progress, to: progress } },
          changedBy,
          progress
        );

        // 작업 테이블의 진행률도 업데이트
        await this.jobRepository.update(jobId, {
          progress,
          updatedAt: new Date(),
        });
      }
    } catch (error) {
      this.logger.error(`Failed to track job progress: ${jobId}`, error);
      throw error;
    }
  }

  /**
   * 실시간 상태 변경 이벤트 스트림 조회
   */
  getRecentStatusEvents(limit: number = 100): StatusChangeEvent[] {
    return this.statusEvents.slice(-limit).reverse();
  }

  /**
   * 특정 작업의 실시간 상태 이벤트 조회
   */
  getJobStatusEvents(jobId: string, limit: number = 50): StatusChangeEvent[] {
    return this.statusEvents
      .filter(event => event.jobId === jobId)
      .slice(-limit)
      .reverse();
  }

  /**
   * 상태별 작업 수 조회
   */
  async getJobCountsByStatus(): Promise<Record<JobStatus, number>> {
    try {
      const results = await this.jobRepository
        .createQueryBuilder('job')
        .select('job.status', 'status')
        .addSelect('COUNT(job.id)', 'count')
        .groupBy('job.status')
        .getRawMany();

      const counts: Record<JobStatus, number> = {
        [JobStatus.PENDING]: 0,
        [JobStatus.RUNNING]: 0,
        [JobStatus.COMPLETED]: 0,
        [JobStatus.FAILED]: 0,
        [JobStatus.CANCELLED]: 0,
        [JobStatus.RETRY]: 0,
      };

      for (const result of results) {
        counts[result.status as JobStatus] = parseInt(result.count);
      }

      return counts;
    } catch (error) {
      this.logger.error('Failed to get job counts by status', error);
      throw error;
    }
  }

  /**
   * 장시간 실행 중인 작업 조회
   */
  async getLongRunningJobs(thresholdMinutes: number = 30): Promise<QueueJob[]> {
    try {
      const thresholdTime = new Date(Date.now() - thresholdMinutes * 60 * 1000);

      return await this.jobRepository.find({
        where: {
          status: JobStatus.RUNNING,
          startedAt: Between(new Date(0), thresholdTime),
        },
        order: { startedAt: 'ASC' },
      });
    } catch (error) {
      this.logger.error('Failed to get long running jobs', error);
      throw error;
    }
  }

  /**
   * 작업 상태 전환 시간 분석
   */
  async analyzeStatusTransitionTimes(
    jobIds?: string[],
    days: number = 7
  ): Promise<{
    transitions: Array<{
      fromStatus: JobStatus;
      toStatus: JobStatus;
      averageTimeMs: number;
      minTimeMs: number;
      maxTimeMs: number;
      count: number;
    }>;
    recommendations: string[];
  }> {
    try {
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const query = this.statusHistoryRepository.createQueryBuilder('history')
        .where('history.createdAt >= :startDate', { startDate })
        .andWhere('history.previousStatus IS NOT NULL')
        .andWhere('history.executionTimeMs IS NOT NULL');

      if (jobIds && jobIds.length > 0) {
        query.andWhere('history.jobId IN (:...jobIds)', { jobIds });
      }

      const statusChanges = await query.getMany();

      // 상태 전환별 시간 데이터 수집
      const transitionData = new Map<string, number[]>();

      for (const change of statusChanges) {
        if (change.previousStatus && change.executionTimeMs) {
          const key = `${change.previousStatus}->${change.status}`;
          if (!transitionData.has(key)) {
            transitionData.set(key, []);
          }
          transitionData.get(key)!.push(change.executionTimeMs);
        }
      }

      // 통계 계산
      const transitions = [];
      const recommendations: string[] = [];

      for (const [transitionKey, times] of transitionData) {
        const [fromStatus, toStatus] = transitionKey.split('->') as [JobStatus, JobStatus];
        
        const averageTimeMs = Math.round(times.reduce((sum, time) => sum + time, 0) / times.length);
        const minTimeMs = Math.min(...times);
        const maxTimeMs = Math.max(...times);
        const count = times.length;

        transitions.push({
          fromStatus,
          toStatus,
          averageTimeMs,
          minTimeMs,
          maxTimeMs,
          count,
        });

        // 성능 권장사항 생성
        if (averageTimeMs > 5 * 60 * 1000) { // 5분 이상
          recommendations.push(
            `${fromStatus} -> ${toStatus} 전환이 평균 ${Math.round(averageTimeMs / 1000)}초로 느립니다. 최적화를 고려하세요.`
          );
        }
      }

      return { transitions, recommendations };
    } catch (error) {
      this.logger.error('Failed to analyze status transition times', error);
      throw error;
    }
  }

  /**
   * 메모리 이벤트 스트림에 이벤트 추가
   */
  private addToEventStream(event: StatusChangeEvent): void {
    this.statusEvents.push(event);
    
    // 메모리 사용량 제한
    if (this.statusEvents.length > this.maxEventsInMemory) {
      this.statusEvents = this.statusEvents.slice(-this.maxEventsInMemory);
    }
  }

  /**
   * 상태 히스토리 정리 (오래된 데이터 삭제)
   */
  async cleanupOldStatusHistory(retentionDays: number = 90): Promise<number> {
    try {
      const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
      
      const result = await this.statusHistoryRepository
        .createQueryBuilder()
        .delete()
        .where('createdAt < :cutoffDate', { cutoffDate })
        .execute();

      const deletedCount = result.affected || 0;
      
      if (deletedCount > 0) {
        this.logger.log(`Cleaned up ${deletedCount} old status history records`);
      }

      return deletedCount;
    } catch (error) {
      this.logger.error('Failed to cleanup old status history', error);
      throw error;
    }
  }
}