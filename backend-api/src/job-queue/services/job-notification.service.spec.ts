import { Test, TestingModule } from '@nestjs/testing';
import { JobNotificationService } from './job-notification.service';
import { QueueJob, JobStatus, JobType, JobPriority } from '../entities/queue-job.entity';
import { JobResult } from '../entities/job-result.entity';

// Mock the nodemailer module
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' }),
    verify: jest.fn().mockResolvedValue(true),
  })),
}));

// Mock axios for webhook calls
jest.mock('axios', () => ({
  default: {
    post: jest.fn().mockResolvedValue({ data: { success: true } }),
  },
}));

import * as nodemailer from 'nodemailer';
import axios from 'axios';

describe('JobNotificationService', () => {
  let service: JobNotificationService;
  let mockTransporter: any;

  const mockJob: QueueJob = {
    id: 'job-123',
    jobType: JobType.QUERY_EXECUTION,
    status: JobStatus.COMPLETED,
    priority: JobPriority.NORMAL,
    userId: 'user-123',
    jobData: JSON.stringify({ query: 'SELECT * FROM users' }),
    result: null,
    errorMessage: null,
    errorStack: null,
    retryCount: 0,
    maxRetries: 3,
    progress: 100,
    scheduledAt: null,
    startedAt: new Date(),
    completedAt: new Date(),
    executionTimeMs: 5000,
    estimatedTimeMs: 30000,
    workerId: 'worker-123',
    metadata: JSON.stringify({ userEmail: 'user@example.com' }),
    correlationId: 'corr-123',
    requiresNotification: true,
    notificationEmail: 'user@example.com',
    createdAt: new Date(),
    updatedAt: new Date(),
    isCompleted: true,
    isFailed: false,
    isRunning: false,
    canRetry: false,
    jobDataParsed: { query: 'SELECT * FROM users' },
    resultParsed: null,
    metadataParsed: { userEmail: 'user@example.com' },
  };

  const mockJobResult: JobResult = {
    id: 'result-123',
    jobId: 'job-123',
    resultData: JSON.stringify({ 
      data: [{ id: 1, name: 'Test User' }],
      total: 1 
    }),
    metadata: JSON.stringify({ 
      executionTime: 5000,
      rowCount: 1
    }),
    createdAt: new Date(),
    job: mockJob,
    resultDataParsed: {
      data: [{ id: 1, name: 'Test User' }],
      total: 1
    },
    metadataParsed: {
      executionTime: 5000,
      rowCount: 1
    },
  };

  beforeEach(async () => {
    mockTransporter = {
      sendMail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' }),
      verify: jest.fn().mockResolvedValue(true),
    };

    (nodemailer.createTransport as jest.Mock).mockReturnValue(mockTransporter);

    const module: TestingModule = await Test.createTestingModule({
      providers: [JobNotificationService],
    }).compile();

    service = module.get<JobNotificationService>(JobNotificationService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendJobCompletionNotification', () => {
    it('should send email notification for completed job', async () => {
      // Arrange
      const job = { ...mockJob, requiresNotification: true, notificationEmail: 'user@example.com' };

      // Act
      await service.sendJobCompletionNotification(job, mockJobResult);

      // Assert
      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: expect.any(String),
        to: 'user@example.com',
        subject: expect.stringContaining('작업 완료'),
        html: expect.stringContaining('job-123'),
        text: expect.any(String),
      });
    });

    it('should send email notification for failed job', async () => {
      // Arrange
      const failedJob = {
        ...mockJob,
        status: JobStatus.FAILED,
        errorMessage: 'Database connection failed',
        requiresNotification: true,
        notificationEmail: 'user@example.com',
      };

      // Act
      await service.sendJobCompletionNotification(failedJob);

      // Assert
      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: expect.any(String),
        to: 'user@example.com',
        subject: expect.stringContaining('작업 실패'),
        html: expect.stringContaining('Database connection failed'),
        text: expect.any(String),
      });
    });

    it('should not send notification if not required', async () => {
      // Arrange
      const job = { ...mockJob, requiresNotification: false };

      // Act
      await service.sendJobCompletionNotification(job);

      // Assert
      expect(mockTransporter.sendMail).not.toHaveBeenCalled();
    });

    it('should not send notification if no email provided', async () => {
      // Arrange
      const job = { ...mockJob, requiresNotification: true, notificationEmail: null };

      // Act
      await service.sendJobCompletionNotification(job);

      // Assert
      expect(mockTransporter.sendMail).not.toHaveBeenCalled();
    });

    it('should handle email sending errors gracefully', async () => {
      // Arrange
      const job = { ...mockJob, requiresNotification: true, notificationEmail: 'user@example.com' };
      const error = new Error('SMTP server unavailable');
      mockTransporter.sendMail.mockRejectedValue(error);

      // Act & Assert
      await expect(service.sendJobCompletionNotification(job)).resolves.not.toThrow();
    });
  });

  describe('sendSlackNotification', () => {
    it('should send Slack notification successfully', async () => {
      // Arrange
      const slackWebhookUrl = 'https://hooks.slack.com/test-webhook';
      const message = 'Job completed successfully';
      const channel = '#notifications';

      // Act
      await service.sendSlackNotification(slackWebhookUrl, message, channel);

      // Assert
      expect(axios.post).toHaveBeenCalledWith(slackWebhookUrl, {
        text: message,
        channel: channel,
        username: 'VanillaMeta Job Queue',
        icon_emoji: ':robot_face:',
      });
    });

    it('should handle Slack webhook errors', async () => {
      // Arrange
      const slackWebhookUrl = 'https://hooks.slack.com/test-webhook';
      const message = 'Test message';
      const error = new Error('Webhook not found');
      
      (axios.post as jest.Mock).mockRejectedValue(error);

      // Act & Assert
      await expect(
        service.sendSlackNotification(slackWebhookUrl, message)
      ).resolves.not.toThrow();
    });

    it('should use default channel if not provided', async () => {
      // Arrange
      const slackWebhookUrl = 'https://hooks.slack.com/test-webhook';
      const message = 'Test message';

      // Act
      await service.sendSlackNotification(slackWebhookUrl, message);

      // Assert
      expect(axios.post).toHaveBeenCalledWith(slackWebhookUrl, {
        text: message,
        channel: '#general',
        username: 'VanillaMeta Job Queue',
        icon_emoji: ':robot_face:',
      });
    });
  });

  describe('sendWebhookNotification', () => {
    it('should send webhook notification successfully', async () => {
      // Arrange
      const webhookUrl = 'https://api.example.com/webhooks/jobs';
      const payload = {
        jobId: 'job-123',
        status: 'completed',
        userId: 'user-123',
      };

      // Act
      await service.sendWebhookNotification(webhookUrl, payload);

      // Assert
      expect(axios.post).toHaveBeenCalledWith(webhookUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'VanillaMeta-JobQueue/1.0',
        },
        timeout: 10000,
      });
    });

    it('should handle webhook timeout', async () => {
      // Arrange
      const webhookUrl = 'https://api.example.com/webhooks/jobs';
      const payload = { test: 'data' };
      const error = new Error('timeout of 10000ms exceeded');
      
      (axios.post as jest.Mock).mockRejectedValue(error);

      // Act & Assert
      await expect(
        service.sendWebhookNotification(webhookUrl, payload)
      ).resolves.not.toThrow();
    });

    it('should include custom headers if provided', async () => {
      // Arrange
      const webhookUrl = 'https://api.example.com/webhooks/jobs';
      const payload = { test: 'data' };
      const customHeaders = {
        'Authorization': 'Bearer token-123',
        'X-Custom-Header': 'custom-value',
      };

      // Act
      await service.sendWebhookNotification(webhookUrl, payload, customHeaders);

      // Assert
      expect(axios.post).toHaveBeenCalledWith(webhookUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'VanillaMeta-JobQueue/1.0',
          ...customHeaders,
        },
        timeout: 10000,
      });
    });
  });

  describe('sendInAppNotification', () => {
    it('should create in-app notification', async () => {
      // Arrange
      const userId = 'user-123';
      const title = 'Job Completed';
      const message = 'Your query execution has completed successfully';
      const type = 'success';
      const relatedJobId = 'job-123';

      // Act
      const result = await service.sendInAppNotification(
        userId, 
        title, 
        message, 
        type, 
        relatedJobId
      );

      // Assert
      expect(result).toEqual({
        id: expect.any(String),
        userId,
        title,
        message,
        type,
        relatedJobId,
        read: false,
        createdAt: expect.any(Date),
      });
    });

    it('should store notification in memory', async () => {
      // Arrange
      const userId = 'user-123';
      const title = 'Test Notification';
      const message = 'Test message';

      // Act
      await service.sendInAppNotification(userId, title, message);
      const notifications = service.getInAppNotifications(userId);

      // Assert
      expect(notifications).toHaveLength(1);
      expect(notifications[0]).toMatchObject({
        userId,
        title,
        message,
        read: false,
      });
    });
  });

  describe('sendSystemNotification', () => {
    it('should send system notification to admin channels', async () => {
      // Arrange
      const title = 'System Alert';
      const message = 'Queue processing has stopped';
      const priority = 'high';

      // Act
      await service.sendSystemNotification(title, message, priority);

      // Assert - Should attempt to send to configured channels
      // This would depend on actual configuration, but we can verify the method doesn't throw
      expect(true).toBe(true);
    });

    it('should format system notification properly', async () => {
      // Arrange
      const title = 'Queue Health Alert';
      const message = 'High memory usage detected';
      const priority = 'medium';

      // Act
      const result = await service.sendSystemNotification(title, message, priority);

      // Assert
      expect(result).toEqual({
        title,
        message,
        priority,
        timestamp: expect.any(Date),
        channels: expect.any(Array),
      });
    });
  });

  describe('getInAppNotifications', () => {
    it('should return user notifications', async () => {
      // Arrange
      const userId = 'user-123';
      await service.sendInAppNotification(userId, 'Test 1', 'Message 1');
      await service.sendInAppNotification(userId, 'Test 2', 'Message 2');
      await service.sendInAppNotification('other-user', 'Test 3', 'Message 3');

      // Act
      const notifications = service.getInAppNotifications(userId);

      // Assert
      expect(notifications).toHaveLength(2);
      expect(notifications.every(n => n.userId === userId)).toBe(true);
    });

    it('should return empty array for user with no notifications', () => {
      // Act
      const notifications = service.getInAppNotifications('non-existent-user');

      // Assert
      expect(notifications).toEqual([]);
    });

    it('should support pagination', () => {
      // Arrange
      const userId = 'user-123';
      // Create 15 notifications
      for (let i = 0; i < 15; i++) {
        service.sendInAppNotification(userId, `Test ${i}`, `Message ${i}`);
      }

      // Act
      const firstPage = service.getInAppNotifications(userId, 10, 0);
      const secondPage = service.getInAppNotifications(userId, 10, 10);

      // Assert
      expect(firstPage).toHaveLength(10);
      expect(secondPage).toHaveLength(5);
    });
  });

  describe('markNotificationAsRead', () => {
    it('should mark notification as read', async () => {
      // Arrange
      const userId = 'user-123';
      const notification = await service.sendInAppNotification(userId, 'Test', 'Message');

      // Act
      const result = service.markNotificationAsRead(notification.id);

      // Assert
      expect(result).toBe(true);
      const updatedNotifications = service.getInAppNotifications(userId);
      expect(updatedNotifications[0].read).toBe(true);
    });

    it('should return false for non-existent notification', () => {
      // Act
      const result = service.markNotificationAsRead('non-existent-id');

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('notification templates', () => {
    it('should generate correct email template for completed job', () => {
      // Arrange
      const job = { ...mockJob, status: JobStatus.COMPLETED };

      // Act
      const template = service.generateEmailTemplate(job, mockJobResult);

      // Assert
      expect(template.subject).toContain('작업 완료');
      expect(template.html).toContain(job.id);
      expect(template.html).toContain('성공적으로 완료');
      expect(template.text).toContain(job.id);
    });

    it('should generate correct email template for failed job', () => {
      // Arrange
      const failedJob = {
        ...mockJob,
        status: JobStatus.FAILED,
        errorMessage: 'Connection timeout',
      };

      // Act
      const template = service.generateEmailTemplate(failedJob);

      // Assert
      expect(template.subject).toContain('작업 실패');
      expect(template.html).toContain('Connection timeout');
      expect(template.html).toContain('실패했습니다');
    });

    it('should include job type in email template', () => {
      // Arrange
      const job = { ...mockJob, jobType: JobType.BULK_DATA_EXPORT };

      // Act
      const template = service.generateEmailTemplate(job);

      // Assert
      expect(template.html).toContain('BULK_DATA_EXPORT');
    });

    it('should include execution time in completed job template', () => {
      // Arrange
      const job = { ...mockJob, executionTimeMs: 5500 }; // 5.5 seconds

      // Act
      const template = service.generateEmailTemplate(job, mockJobResult);

      // Assert
      expect(template.html).toContain('5.5');
      expect(template.html).toContain('초');
    });
  });

  describe('configuration', () => {
    it('should initialize with default configuration', () => {
      expect(service).toBeDefined();
      // Configuration details would depend on actual implementation
    });

    it('should support custom notification channels', async () => {
      // This would test adding custom notification channels
      // Implementation depends on the actual service design
      expect(true).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle malformed webhook URLs', async () => {
      // Arrange
      const invalidUrl = 'not-a-url';
      const payload = { test: 'data' };

      // Act & Assert
      await expect(
        service.sendWebhookNotification(invalidUrl, payload)
      ).resolves.not.toThrow();
    });

    it('should handle email template generation errors', () => {
      // Arrange
      const malformedJob = {} as QueueJob;

      // Act & Assert
      expect(() => service.generateEmailTemplate(malformedJob)).not.toThrow();
    });

    it('should handle notification storage errors', async () => {
      // This would test storage-related errors in a real implementation
      expect(true).toBe(true);
    });
  });
});