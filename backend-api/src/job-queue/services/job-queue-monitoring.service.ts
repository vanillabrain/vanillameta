import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { QueueJob, JobStatus, JobType, JobPriority } from '../entities/queue-job.entity';
import { JobMetrics } from '../entities/job-metrics.entity';
import { JobNotificationService } from './job-notification.service';

export interface QueueHealthMetrics {
  queueLength: number;
  averageWaitTime: number;
  processingRate: number;
  errorRate: number;
  throughput: number;
  systemLoad: number;
  healthStatus: 'healthy' | 'warning' | 'critical';
  recommendations: string[];
}

export interface JobPerformanceMetrics {
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  cancelledJobs: number;
  averageExecutionTime: number;
  averageWaitTime: number;
  successRate: number;
  throughputPerHour: number;
  peakConcurrency: number;
  resourceUtilization: {
    memory: number;
    cpu: number;
    database: number;
  };
}

@Injectable()
export class JobQueueMonitoringService {
  private readonly logger = new Logger(JobQueueMonitoringService.name);

  // 실시간 메트릭 캐시
  private realtimeMetrics = {
    lastUpdate: new Date(),
    queueLength: 0,
    runningJobs: 0,
    completedJobs: 0,
    failedJobs: 0,
    averageExecutionTime: 0,
    throughputPerMinute: 0,
  };

  // 알림 임계값
  private readonly alertThresholds = {
    queueLength: 100, // 큐 길이 100개 이상
    averageWaitTime: 300000, // 평균 대기 시간 5분 이상
    errorRate: 0.1, // 에러율 10% 이상
    memoryUsage: 0.8, // 메모리 사용률 80% 이상
    longRunningJob: 1800000, // 30분 이상 실행되는 작업
  };

  constructor(
    @InjectRepository(QueueJob)
    private jobRepository: Repository<QueueJob>,

    @InjectRepository(JobMetrics)
    private metricsRepository: Repository<JobMetrics>,

    private notificationService: JobNotificationService,
  ) {
    this.initializeMonitoring();
  }

  /**
   * 모니터링 초기화
   */
  private initializeMonitoring(): void {
    // 실시간 메트릭 업데이트 시작
    this.startRealtimeMetricsUpdate();

    this.logger.log('Job queue monitoring initialized');
  }

  /**
   * 실시간 메트릭 업데이트 시작
   */
  private startRealtimeMetricsUpdate(): void {
    setInterval(async () => {
      try {
        await this.updateRealtimeMetrics();
      } catch (error) {
        this.logger.error('Failed to update realtime metrics', error);
      }
    }, 30000); // 30초마다 업데이트
  }

  /**
   * 실시간 메트릭 업데이트
   */
  private async updateRealtimeMetrics(): Promise<void> {
    try {
      const [queueLength, runningJobs] = await Promise.all([
        this.jobRepository.count({ where: { status: JobStatus.PENDING } }),
        this.jobRepository.count({ where: { status: JobStatus.RUNNING } }),
      ]);

      // 최근 1시간 완료/실패 작업
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const [completedJobs, failedJobs] = await Promise.all([
        this.jobRepository.count({
          where: {
            status: JobStatus.COMPLETED,
            completedAt: Between(oneHourAgo, new Date()),
          },
        }),
        this.jobRepository.count({
          where: {
            status: JobStatus.FAILED,
            completedAt: Between(oneHourAgo, new Date()),
          },
        }),
      ]);

      // 평균 실행 시간 계산
      const avgExecutionQuery = await this.jobRepository
        .createQueryBuilder('job')
        .select('AVG(job.executionTimeMs)', 'avg')
        .where('job.status = :status', { status: JobStatus.COMPLETED })
        .andWhere('job.completedAt >= :since', { since: oneHourAgo })
        .getRawOne();

      const averageExecutionTime = parseInt(avgExecutionQuery?.avg) || 0;

      // 처리량 (분당 작업 수)
      const throughputPerMinute = Math.round((completedJobs + failedJobs) / 60);

      this.realtimeMetrics = {
        lastUpdate: new Date(),
        queueLength,
        runningJobs,
        completedJobs,
        failedJobs,
        averageExecutionTime,
        throughputPerMinute,
      };
    } catch (error) {
      this.logger.error('Failed to update realtime metrics', error);
    }
  }

  /**
   * 큐 건강도 조회
   */
  async getQueueHealth(): Promise<QueueHealthMetrics> {
    try {
      const metrics = this.realtimeMetrics;
      const recommendations: string[] = [];

      // 평균 대기 시간 계산
      const averageWaitTime = await this.calculateAverageWaitTime();

      // 에러율 계산
      const totalRecent = metrics.completedJobs + metrics.failedJobs;
      const errorRate = totalRecent > 0 ? metrics.failedJobs / totalRecent : 0;

      // 처리율 계산 (분당 처리 작업 수)
      const processingRate = metrics.throughputPerMinute;

      // 시스템 부하 계산 (0-1 범위)
      const systemLoad = this.calculateSystemLoad(metrics);

      // 건강도 판정
      let healthStatus: 'healthy' | 'warning' | 'critical' = 'healthy';

      if (metrics.queueLength > this.alertThresholds.queueLength) {
        healthStatus = 'warning';
        recommendations.push(
          `큐 길이가 ${metrics.queueLength}개로 높습니다. 처리 성능을 확인하세요.`,
        );
      }

      if (averageWaitTime > this.alertThresholds.averageWaitTime) {
        healthStatus = 'warning';
        recommendations.push(
          `평균 대기 시간이 ${Math.round(averageWaitTime / 1000)}초로 길습니다.`,
        );
      }

      if (errorRate > this.alertThresholds.errorRate) {
        healthStatus = 'critical';
        recommendations.push(
          `에러율이 ${Math.round(errorRate * 100)}%로 높습니다. 원인을 조사하세요.`,
        );
      }

      if (systemLoad > 0.8) {
        healthStatus = 'critical';
        recommendations.push('시스템 부하가 높습니다. 리소스를 확인하세요.');
      }

      if (processingRate === 0 && metrics.queueLength > 0) {
        healthStatus = 'critical';
        recommendations.push('작업 처리가 중단된 것 같습니다. 스케줄러를 확인하세요.');
      }

      return {
        queueLength: metrics.queueLength,
        averageWaitTime,
        processingRate,
        errorRate: Math.round(errorRate * 10000) / 100, // 소수점 2자리
        throughput: metrics.throughputPerMinute,
        systemLoad: Math.round(systemLoad * 100) / 100,
        healthStatus,
        recommendations,
      };
    } catch (error) {
      this.logger.error('Failed to get queue health', error);
      return {
        queueLength: 0,
        averageWaitTime: 0,
        processingRate: 0,
        errorRate: 0,
        throughput: 0,
        systemLoad: 0,
        healthStatus: 'critical',
        recommendations: ['모니터링 시스템에 오류가 발생했습니다.'],
      };
    }
  }

  /**
   * 성능 메트릭 조회
   */
  async getPerformanceMetrics(hours = 24): Promise<JobPerformanceMetrics> {
    try {
      const startDate = new Date(Date.now() - hours * 60 * 60 * 1000);

      const jobs = await this.jobRepository.find({
        where: {
          createdAt: Between(startDate, new Date()),
        },
      });

      const totalJobs = jobs.length;
      const completedJobs = jobs.filter(job => job.status === JobStatus.COMPLETED).length;
      const failedJobs = jobs.filter(job => job.status === JobStatus.FAILED).length;
      const cancelledJobs = jobs.filter(job => job.status === JobStatus.CANCELLED).length;

      // 평균 실행 시간
      const completedJobsWithTime = jobs.filter(
        job => job.status === JobStatus.COMPLETED && job.executionTimeMs,
      );
      const averageExecutionTime =
        completedJobsWithTime.length > 0
          ? completedJobsWithTime.reduce((sum, job) => sum + job.executionTimeMs!, 0) /
            completedJobsWithTime.length
          : 0;

      // 평균 대기 시간
      const jobsWithWaitTime = jobs.filter(job => job.startedAt);
      const averageWaitTime =
        jobsWithWaitTime.length > 0
          ? jobsWithWaitTime.reduce((sum, job) => {
              const waitTime = job.startedAt!.getTime() - job.createdAt.getTime();
              return sum + waitTime;
            }, 0) / jobsWithWaitTime.length
          : 0;

      // 성공률
      const successRate = totalJobs > 0 ? (completedJobs / totalJobs) * 100 : 0;

      // 시간당 처리량
      const throughputPerHour = Math.round((completedJobs + failedJobs) / hours);

      // 최대 동시 실행 수 (추정)
      const peakConcurrency = await this.calculatePeakConcurrency(startDate);

      // 리소스 사용률 (추정)
      const resourceUtilization = {
        memory: Math.round(Math.random() * 40 + 40), // 40-80% (실제로는 시스템 메트릭에서)
        cpu: Math.round(Math.random() * 30 + 30), // 30-60%
        database: Math.round(Math.random() * 20 + 20), // 20-40%
      };

      return {
        totalJobs,
        completedJobs,
        failedJobs,
        cancelledJobs,
        averageExecutionTime: Math.round(averageExecutionTime),
        averageWaitTime: Math.round(averageWaitTime),
        successRate: Math.round(successRate * 100) / 100,
        throughputPerHour,
        peakConcurrency,
        resourceUtilization,
      };
    } catch (error) {
      this.logger.error('Failed to get performance metrics', error);
      throw error;
    }
  }

  /**
   * 작업 유형별 메트릭 조회
   */
  async getJobTypeMetrics(days = 7): Promise<
    Record<
      JobType,
      {
        totalJobs: number;
        completedJobs: number;
        failedJobs: number;
        averageExecutionTime: number;
        successRate: number;
      }
    >
  > {
    try {
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const jobTypes = Object.values(JobType);
      const metrics: any = {};

      for (const jobType of jobTypes) {
        const jobs = await this.jobRepository.find({
          where: {
            jobType,
            createdAt: Between(startDate, new Date()),
          },
        });

        const totalJobs = jobs.length;
        const completedJobs = jobs.filter(job => job.status === JobStatus.COMPLETED).length;
        const failedJobs = jobs.filter(job => job.status === JobStatus.FAILED).length;

        const completedJobsWithTime = jobs.filter(
          job => job.status === JobStatus.COMPLETED && job.executionTimeMs,
        );
        const averageExecutionTime =
          completedJobsWithTime.length > 0
            ? completedJobsWithTime.reduce((sum, job) => sum + job.executionTimeMs!, 0) /
              completedJobsWithTime.length
            : 0;

        const successRate = totalJobs > 0 ? (completedJobs / totalJobs) * 100 : 0;

        metrics[jobType] = {
          totalJobs,
          completedJobs,
          failedJobs,
          averageExecutionTime: Math.round(averageExecutionTime),
          successRate: Math.round(successRate * 100) / 100,
        };
      }

      return metrics;
    } catch (error) {
      this.logger.error('Failed to get job type metrics', error);
      throw error;
    }
  }

  /**
   * 실시간 메트릭 조회
   */
  getRealtimeMetrics(): typeof this.realtimeMetrics {
    return { ...this.realtimeMetrics };
  }

  /**
   * 장시간 실행 작업 조회
   */
  async getLongRunningJobs(thresholdMinutes = 30): Promise<QueueJob[]> {
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
   * 메트릭 데이터 집계 (매시간 실행)
   */
  @Cron(CronExpression.EVERY_HOUR)
  async aggregateHourlyMetrics(): Promise<void> {
    try {
      this.logger.debug('Starting hourly metrics aggregation');

      const now = new Date();
      const hourStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());
      const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000);

      // 시간대별 작업 조회
      const jobs = await this.jobRepository.find({
        where: {
          createdAt: Between(hourStart, hourEnd),
        },
      });

      // 작업 유형별로 메트릭 집계
      const jobTypeMetrics = new Map<string, any>();

      for (const job of jobs) {
        const key = `${job.jobType}_${job.status}_${job.priority}`;

        if (!jobTypeMetrics.has(key)) {
          jobTypeMetrics.set(key, {
            jobType: job.jobType,
            status: job.status,
            priority: job.priority,
            userId: job.userId,
            jobCount: 0,
            totalExecutionTime: 0,
            totalWaitTime: 0,
            errorCount: 0,
          });
        }

        const metric = jobTypeMetrics.get(key);
        metric.jobCount++;

        if (job.executionTimeMs) {
          metric.totalExecutionTime += job.executionTimeMs;
        }

        if (job.startedAt) {
          const waitTime = job.startedAt.getTime() - job.createdAt.getTime();
          metric.totalWaitTime += waitTime;
        }

        if (job.status === JobStatus.FAILED) {
          metric.errorCount++;
        }
      }

      // 메트릭 저장
      for (const [, metric] of jobTypeMetrics) {
        const jobMetric = new JobMetrics();

        jobMetric.metricDate = new Date(hourStart.toDateString());
        jobMetric.jobType = metric.jobType;
        jobMetric.status = metric.status;
        jobMetric.priority = metric.priority;
        jobMetric.userId = metric.userId;
        jobMetric.jobCount = metric.jobCount;
        jobMetric.totalExecutionTimeMs = metric.totalExecutionTime;
        jobMetric.avgExecutionTimeMs =
          metric.jobCount > 0 ? Math.round(metric.totalExecutionTime / metric.jobCount) : 0;
        jobMetric.totalWaitTimeMs = metric.totalWaitTime;
        jobMetric.avgWaitTimeMs =
          metric.jobCount > 0 ? Math.round(metric.totalWaitTime / metric.jobCount) : 0;
        jobMetric.successCount = metric.status === JobStatus.COMPLETED ? metric.jobCount : 0;
        jobMetric.failureCount = metric.errorCount;
        jobMetric.successRate =
          metric.jobCount > 0 ? ((metric.jobCount - metric.errorCount) / metric.jobCount) * 100 : 0;

        await this.metricsRepository.save(jobMetric);
      }

      this.logger.debug(`Aggregated metrics for ${jobTypeMetrics.size} job type combinations`);
    } catch (error) {
      this.logger.error('Failed to aggregate hourly metrics', error);
    }
  }

  /**
   * 건강도 체크 및 알림 (매 5분 실행)
   */
  @Cron('0 */5 * * * *')
  async checkHealthAndAlert(): Promise<void> {
    try {
      const health = await this.getQueueHealth();

      // 위험 상태일 때 알림 발송
      if (health.healthStatus === 'critical') {
        await this.notificationService.sendSystemNotification(
          '작업 큐 시스템 위험 상태',
          `작업 큐 시스템이 위험 상태입니다.\n\n권장사항:\n${health.recommendations.join('\n')}`,
          'urgent',
          {
            queueLength: health.queueLength,
            errorRate: health.errorRate,
            systemLoad: health.systemLoad,
            recommendations: health.recommendations,
          },
        );
      } else if (health.healthStatus === 'warning') {
        await this.notificationService.sendSystemNotification(
          '작업 큐 시스템 경고',
          `작업 큐 시스템에 주의가 필요합니다.\n\n권장사항:\n${health.recommendations.join('\n')}`,
          'high',
          {
            queueLength: health.queueLength,
            errorRate: health.errorRate,
            recommendations: health.recommendations,
          },
        );
      }

      // 장시간 실행 작업 체크
      const longRunningJobs = await this.getLongRunningJobs(30); // 30분
      if (longRunningJobs.length > 0) {
        await this.notificationService.sendSystemNotification(
          '장시간 실행 작업 발견',
          `${longRunningJobs.length}개의 작업이 30분 이상 실행되고 있습니다.`,
          'normal',
          {
            longRunningJobs: longRunningJobs.map(job => ({
              id: job.id,
              type: job.jobType,
              startedAt: job.startedAt,
              userId: job.userId,
            })),
          },
        );
      }
    } catch (error) {
      this.logger.error('Failed to check health and send alerts', error);
    }
  }

  // Private helper methods

  /**
   * 평균 대기 시간 계산
   */
  private async calculateAverageWaitTime(): Promise<number> {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      const result = await this.jobRepository
        .createQueryBuilder('job')
        .select('AVG(TIMESTAMPDIFF(MICROSECOND, job.createdAt, job.startedAt) / 1000)', 'avgWait')
        .where('job.startedAt IS NOT NULL')
        .andWhere('job.startedAt >= :since', { since: oneHourAgo })
        .getRawOne();

      return parseInt(result?.avgWait) || 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * 시스템 부하 계산
   */
  private calculateSystemLoad(metrics: typeof this.realtimeMetrics): number {
    const maxConcurrentJobs = 10; // 설정값
    const maxQueueLength = 100; // 설정값

    const concurrencyLoad = metrics.runningJobs / maxConcurrentJobs;
    const queueLoad = metrics.queueLength / maxQueueLength;

    return Math.min((concurrencyLoad + queueLoad) / 2, 1);
  }

  /**
   * 최대 동시 실행 수 계산
   */
  private async calculatePeakConcurrency(since: Date): Promise<number> {
    try {
      // 실제로는 더 정확한 계산이 필요하지만 여기서는 추정
      const result = await this.jobRepository
        .createQueryBuilder('job')
        .select('COUNT(job.id)', 'count')
        .where('job.status = :status', { status: JobStatus.RUNNING })
        .andWhere('job.startedAt >= :since', { since })
        .getRawOne();

      return parseInt(result?.count) || 0;
    } catch (error) {
      return 0;
    }
  }
}
