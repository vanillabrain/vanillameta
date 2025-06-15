import { Injectable, Logger } from '@nestjs/common';
import { QueueJob, JobStatus, JobType } from '../entities/queue-job.entity';
import { JobResult } from '../entities/job-result.entity';

export interface NotificationChannel {
  send(notification: JobNotification): Promise<void>;
}

export interface JobNotification {
  jobId: string;
  jobType: JobType;
  status: JobStatus;
  title: string;
  message: string;
  details?: any;
  recipient: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  timestamp: Date;
}

@Injectable()
export class JobNotificationService {
  private readonly logger = new Logger(JobNotificationService.name);
  
  // 알림 채널들
  private notificationChannels = new Map<string, NotificationChannel>();
  
  constructor() {
    this.initializeNotificationChannels();
  }

  /**
   * 알림 채널 초기화
   */
  private initializeNotificationChannels(): void {
    // 이메일 알림 채널
    this.notificationChannels.set('email', new EmailNotificationChannel());
    
    // 슬랙 알림 채널 (선택적)
    this.notificationChannels.set('slack', new SlackNotificationChannel());
    
    // 웹훅 알림 채널
    this.notificationChannels.set('webhook', new WebhookNotificationChannel());
    
    // 인앱 알림 채널
    this.notificationChannels.set('in-app', new InAppNotificationChannel());
  }

  /**
   * 작업 완료 알림 발송
   */
  async sendJobCompletionNotification(job: QueueJob, result?: JobResult): Promise<void> {
    try {
      if (!job.requiresNotification) {
        return;
      }

      const notification = this.createCompletionNotification(job, result);
      
      // 기본 채널들로 알림 발송
      const channels = this.getNotificationChannels(job);
      
      const sendPromises = channels.map(channel => 
        this.sendNotification(channel, notification)
      );

      await Promise.allSettled(sendPromises);

      this.logger.log(`Completion notification sent for job: ${job.id}`);
    } catch (error) {
      this.logger.error(`Failed to send completion notification for job: ${job.id}`, error);
    }
  }

  /**
   * 작업 실패 알림 발송
   */
  async sendJobFailureNotification(job: QueueJob): Promise<void> {
    try {
      const notification = this.createFailureNotification(job);
      
      // 실패 알림은 우선순위가 높은 채널로만 발송
      const channels = ['email', 'slack']; // 중요한 채널들만
      
      const sendPromises = channels.map(channelName => {
        const channel = this.notificationChannels.get(channelName);
        return channel ? this.sendNotification(channel, notification) : Promise.resolve();
      });

      await Promise.allSettled(sendPromises);

      this.logger.log(`Failure notification sent for job: ${job.id}`);
    } catch (error) {
      this.logger.error(`Failed to send failure notification for job: ${job.id}`, error);
    }
  }

  /**
   * 작업 지연 알림 발송
   */
  async sendJobDelayNotification(job: QueueJob, delayMinutes: number): Promise<void> {
    try {
      const notification = this.createDelayNotification(job, delayMinutes);
      
      // 지연 알림은 이메일만
      const emailChannel = this.notificationChannels.get('email');
      if (emailChannel) {
        await this.sendNotification(emailChannel, notification);
      }

      this.logger.log(`Delay notification sent for job: ${job.id} (${delayMinutes} minutes)`);
    } catch (error) {
      this.logger.error(`Failed to send delay notification for job: ${job.id}`, error);
    }
  }

  /**
   * 벌크 작업 완료 알림
   */
  async sendBulkJobNotification(
    jobs: QueueJob[],
    title: string,
    summary: string,
    recipient: string
  ): Promise<void> {
    try {
      const notification: JobNotification = {
        jobId: 'bulk-operation',
        jobType: JobType.BULK_DATA_EXPORT, // 임시
        status: JobStatus.COMPLETED,
        title,
        message: summary,
        details: {
          totalJobs: jobs.length,
          completedJobs: jobs.filter(j => j.status === JobStatus.COMPLETED).length,
          failedJobs: jobs.filter(j => j.status === JobStatus.FAILED).length,
          jobIds: jobs.map(j => j.id),
        },
        recipient,
        priority: 'normal',
        timestamp: new Date(),
      };

      const emailChannel = this.notificationChannels.get('email');
      if (emailChannel) {
        await this.sendNotification(emailChannel, notification);
      }

      this.logger.log(`Bulk notification sent for ${jobs.length} jobs`);
    } catch (error) {
      this.logger.error('Failed to send bulk job notification', error);
    }
  }

  /**
   * 시스템 알림 발송 (큐 상태 등)
   */
  async sendSystemNotification(
    title: string,
    message: string,
    priority: 'low' | 'normal' | 'high' | 'urgent' = 'normal',
    details?: any
  ): Promise<void> {
    try {
      const notification: JobNotification = {
        jobId: 'system-notification',
        jobType: JobType.QUERY_EXECUTION, // 임시
        status: JobStatus.COMPLETED,
        title,
        message,
        details,
        recipient: 'system-admin', // 설정에서 가져올 값
        priority,
        timestamp: new Date(),
      };

      // 우선순위에 따라 채널 선택
      const channels = priority === 'urgent' || priority === 'high' 
        ? ['email', 'slack'] 
        : ['email'];

      const sendPromises = channels.map(channelName => {
        const channel = this.notificationChannels.get(channelName);
        return channel ? this.sendNotification(channel, notification) : Promise.resolve();
      });

      await Promise.allSettled(sendPromises);

      this.logger.log(`System notification sent: ${title}`);
    } catch (error) {
      this.logger.error('Failed to send system notification', error);
    }
  }

  // Private helper methods

  /**
   * 완료 알림 생성
   */
  private createCompletionNotification(job: QueueJob, result?: JobResult): JobNotification {
    const executionTime = job.executionTimeMs 
      ? Math.round(job.executionTimeMs / 1000) 
      : 0;

    const title = this.getJobTypeDisplayName(job.jobType) + ' 완료';
    let message = `작업이 성공적으로 완료되었습니다.`;
    
    if (executionTime > 0) {
      message += ` (실행 시간: ${executionTime}초)`;
    }

    const details: any = {
      jobId: job.id,
      jobType: job.jobType,
      createdAt: job.createdAt,
      completedAt: job.completedAt,
      executionTimeMs: job.executionTimeMs,
    };

    // 결과 관련 정보 추가
    if (result) {
      if (result.downloadUrl) {
        message += `\n\n다운로드: ${result.downloadUrl}`;
        details.downloadUrl = result.downloadUrl;
        details.fileName = result.fileName;
      }
      
      if (result.resultDataParsed) {
        details.resultSummary = this.createResultSummary(result.resultDataParsed, job.jobType);
      }
    }

    return {
      jobId: job.id,
      jobType: job.jobType,
      status: JobStatus.COMPLETED,
      title,
      message,
      details,
      recipient: job.notificationEmail || job.userId || 'unknown',
      priority: 'normal',
      timestamp: new Date(),
    };
  }

  /**
   * 실패 알림 생성
   */
  private createFailureNotification(job: QueueJob): JobNotification {
    const title = this.getJobTypeDisplayName(job.jobType) + ' 실패';
    let message = `작업이 실패했습니다.`;
    
    if (job.errorMessage) {
      message += `\n\n오류: ${job.errorMessage}`;
    }

    if (job.canRetry) {
      message += `\n\n재시도 가능: ${job.retryCount}/${job.maxRetries}`;
    }

    return {
      jobId: job.id,
      jobType: job.jobType,
      status: JobStatus.FAILED,
      title,
      message,
      details: {
        jobId: job.id,
        errorMessage: job.errorMessage,
        retryCount: job.retryCount,
        maxRetries: job.maxRetries,
        canRetry: job.canRetry,
        createdAt: job.createdAt,
        failedAt: job.completedAt,
      },
      recipient: job.notificationEmail || job.userId || 'unknown',
      priority: 'high',
      timestamp: new Date(),
    };
  }

  /**
   * 지연 알림 생성
   */
  private createDelayNotification(job: QueueJob, delayMinutes: number): JobNotification {
    const title = this.getJobTypeDisplayName(job.jobType) + ' 지연';
    const message = `작업이 예상보다 오래 실행되고 있습니다. (${delayMinutes}분 경과)`;

    return {
      jobId: job.id,
      jobType: job.jobType,
      status: job.status,
      title,
      message,
      details: {
        jobId: job.id,
        delayMinutes,
        startedAt: job.startedAt,
        estimatedTimeMs: job.estimatedTimeMs,
        currentProgress: job.progress,
      },
      recipient: job.notificationEmail || job.userId || 'unknown',
      priority: 'normal',
      timestamp: new Date(),
    };
  }

  /**
   * 작업 유형 표시명 반환
   */
  private getJobTypeDisplayName(jobType: JobType): string {
    const displayNames = {
      [JobType.QUERY_EXECUTION]: '쿼리 실행',
      [JobType.BULK_DATA_EXPORT]: '대량 데이터 내보내기',
      [JobType.DASHBOARD_GENERATION]: '대시보드 생성',
      [JobType.DATA_MIGRATION]: '데이터 마이그레이션',
      [JobType.CACHE_WARMUP]: '캐시 워밍업',
      [JobType.REPORT_GENERATION]: '리포트 생성',
    };

    return displayNames[jobType] || jobType;
  }

  /**
   * 결과 요약 생성
   */
  private createResultSummary(resultData: any, jobType: JobType): string {
    switch (jobType) {
      case JobType.QUERY_EXECUTION:
        return `${resultData.rowCount || 0}개 행 조회됨`;
      
      case JobType.BULK_DATA_EXPORT:
        return `${resultData.rowCount || 0}개 행 내보내기 완료`;
      
      case JobType.DASHBOARD_GENERATION:
        return `${resultData.dashboardData?.totalWidgets || 0}개 위젯 생성됨`;
      
      case JobType.DATA_MIGRATION:
        return `${resultData.migrationResult?.migratedRows || 0}개 행 마이그레이션됨`;
      
      case JobType.CACHE_WARMUP:
        return `${resultData.warmupResult?.successfulQueries || 0}개 쿼리 캐시 워밍업됨`;
      
      case JobType.REPORT_GENERATION:
        return `${resultData.sectionCount || 0}개 섹션 리포트 생성됨`;
      
      default:
        return '작업 완료';
    }
  }

  /**
   * 작업별 알림 채널 결정
   */
  private getNotificationChannels(job: QueueJob): string[] {
    // 작업 유형별로 다른 채널 사용 가능
    const baseChannels = ['email'];
    
    // 중요한 작업은 추가 채널 사용
    if (job.jobType === JobType.DATA_MIGRATION || 
        job.jobType === JobType.BULK_DATA_EXPORT) {
      baseChannels.push('slack');
    }

    return baseChannels;
  }

  /**
   * 알림 발송
   */
  private async sendNotification(
    channel: NotificationChannel, 
    notification: JobNotification
  ): Promise<void> {
    try {
      await channel.send(notification);
    } catch (error) {
      this.logger.error(`Failed to send notification via ${channel.constructor.name}`, error);
    }
  }
}

// 알림 채널 구현

class EmailNotificationChannel implements NotificationChannel {
  private readonly logger = new Logger(EmailNotificationChannel.name);

  async send(notification: JobNotification): Promise<void> {
    try {
      // 실제로는 이메일 서비스 (Nodemailer, SES 등) 사용
      const emailData = {
        to: notification.recipient,
        subject: notification.title,
        html: this.generateEmailHtml(notification),
      };

      // 임시 구현 - 실제로는 이메일 전송
      this.logger.log(`EMAIL: ${notification.title} to ${notification.recipient}`);
      
      // await emailService.send(emailData);
    } catch (error) {
      this.logger.error('Failed to send email notification', error);
      throw error;
    }
  }

  private generateEmailHtml(notification: JobNotification): string {
    const statusColor = notification.status === JobStatus.COMPLETED ? 'green' : 
                       notification.status === JobStatus.FAILED ? 'red' : 'orange';

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: ${statusColor}; color: white; padding: 20px; text-align: center;">
          <h1>${notification.title}</h1>
        </div>
        
        <div style="padding: 20px; background-color: #f9f9f9;">
          <p><strong>작업 ID:</strong> ${notification.jobId}</p>
          <p><strong>작업 유형:</strong> ${notification.jobType}</p>
          <p><strong>상태:</strong> ${notification.status}</p>
          <p><strong>시간:</strong> ${notification.timestamp.toLocaleString('ko-KR')}</p>
        </div>
        
        <div style="padding: 20px;">
          <h3>상세 내용</h3>
          <p>${notification.message.replace(/\n/g, '<br>')}</p>
          
          ${notification.details ? `
            <h3>추가 정보</h3>
            <pre style="background-color: #f5f5f5; padding: 10px; overflow-x: auto;">
              ${JSON.stringify(notification.details, null, 2)}
            </pre>
          ` : ''}
        </div>
        
        <div style="padding: 20px; background-color: #e9e9e9; text-align: center; font-size: 12px; color: #666;">
          VanillaMeta Job Queue System
        </div>
      </div>
    `;
  }
}

class SlackNotificationChannel implements NotificationChannel {
  private readonly logger = new Logger(SlackNotificationChannel.name);

  async send(notification: JobNotification): Promise<void> {
    try {
      const slackMessage = {
        text: notification.title,
        attachments: [
          {
            color: this.getSlackColor(notification.status),
            fields: [
              { title: 'Job ID', value: notification.jobId, short: true },
              { title: 'Type', value: notification.jobType, short: true },
              { title: 'Status', value: notification.status, short: true },
              { title: 'Time', value: notification.timestamp.toISOString(), short: true },
            ],
            text: notification.message,
          },
        ],
      };

      // 실제로는 Slack webhook 또는 API 사용
      this.logger.log(`SLACK: ${notification.title}`);
      
      // await slackClient.send(slackMessage);
    } catch (error) {
      this.logger.error('Failed to send Slack notification', error);
      throw error;
    }
  }

  private getSlackColor(status: JobStatus): string {
    switch (status) {
      case JobStatus.COMPLETED: return 'good';
      case JobStatus.FAILED: return 'danger';
      case JobStatus.RUNNING: return 'warning';
      default: return '#808080';
    }
  }
}

class WebhookNotificationChannel implements NotificationChannel {
  private readonly logger = new Logger(WebhookNotificationChannel.name);

  async send(notification: JobNotification): Promise<void> {
    try {
      const webhookPayload = {
        event: 'job_notification',
        data: notification,
        timestamp: notification.timestamp.toISOString(),
      };

      // 실제로는 HTTP POST 요청
      this.logger.log(`WEBHOOK: ${notification.title}`);
      
      // await httpClient.post(webhookUrl, webhookPayload);
    } catch (error) {
      this.logger.error('Failed to send webhook notification', error);
      throw error;
    }
  }
}

class InAppNotificationChannel implements NotificationChannel {
  private readonly logger = new Logger(InAppNotificationChannel.name);

  async send(notification: JobNotification): Promise<void> {
    try {
      // 실제로는 WebSocket이나 Server-Sent Events 사용
      this.logger.log(`IN-APP: ${notification.title} for ${notification.recipient}`);
      
      // await websocketService.sendToUser(notification.recipient, notification);
    } catch (error) {
      this.logger.error('Failed to send in-app notification', error);
      throw error;
    }
  }
}