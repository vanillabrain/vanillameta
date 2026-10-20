import {
  JobNotificationService,
  NotificationChannel,
  JobNotification,
} from './job-notification.service';
import { QueueJob, JobType, JobStatus } from '../entities/queue-job.entity';
import { JobResult } from '../entities/job-result.entity';

describe('JobNotificationService supported public dispatch contract', () => {
  let service: JobNotificationService;
  let channels: Map<string, { send: jest.Mock<Promise<void>, [JobNotification]> }>;
  const job = (overrides: Partial<QueueJob> = {}) =>
    Object.assign(
      new QueueJob(),
      {
        id: 'job',
        jobType: JobType.QUERY_EXECUTION,
        status: JobStatus.COMPLETED,
        userId: 'user',
        notificationEmail: 'synthetic@example.invalid',
        requiresNotification: true,
        executionTimeMs: 5000,
        retryCount: 0,
        maxRetries: 3,
        createdAt: new Date(),
        completedAt: new Date(),
      },
      overrides,
    );
  beforeEach(() => {
    service = new JobNotificationService();
    channels = new Map(
      ['email', 'slack', 'webhook', 'in-app'].map(name => [
        name,
        { send: jest.fn().mockResolvedValue(undefined) },
      ]),
    );
    // Replace every delivery adapter; these tests never invoke real message/network channels.
    Object.defineProperty(service, 'notificationChannels', {
      value: channels as Map<string, NotificationChannel>,
    });
  });
  it('does not send completion notifications unless requested', async () => {
    await service.sendJobCompletionNotification(job({ requiresNotification: false }));
    for (const channel of channels.values()) expect(channel.send).not.toHaveBeenCalled();
  });
  it('sends query completion by email with serialized result summary', async () => {
    const result = Object.assign(new JobResult(), {
      resultData: JSON.stringify({ rowCount: 3 }),
      downloadUrl: 'https://example.invalid/result',
      fileName: 'synthetic.csv',
    });
    await service.sendJobCompletionNotification(job(), result);
    expect(channels.get('email').send).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: 'job',
        status: JobStatus.COMPLETED,
        title: '쿼리 실행 완료',
        recipient: 'synthetic@example.invalid',
        priority: 'normal',
        message: expect.stringContaining('5초'),
        details: expect.objectContaining({
          resultSummary: '3개 행 조회됨',
          fileName: 'synthetic.csv',
        }),
      }),
    );
    expect(channels.get('slack').send).not.toHaveBeenCalled();
    expect(channels.get('webhook').send).not.toHaveBeenCalled();
    expect(channels.get('in-app').send).not.toHaveBeenCalled();
  });
  it.each([JobType.BULK_DATA_EXPORT, JobType.DATA_MIGRATION])(
    'routes important %s completions to email and slack',
    async type => {
      await service.sendJobCompletionNotification(job({ jobType: type }));
      expect(channels.get('email').send).toHaveBeenCalledTimes(1);
      expect(channels.get('slack').send).toHaveBeenCalledTimes(1);
    },
  );
  it('falls back to userId as recipient', async () => {
    await service.sendJobCompletionNotification(job({ notificationEmail: null }));
    expect(channels.get('email').send).toHaveBeenCalledWith(
      expect.objectContaining({ recipient: 'user' }),
    );
  });
  it('dispatches failures with real canRetry and error details even without completion opt-in', async () => {
    await service.sendJobFailureNotification(
      job({
        status: JobStatus.FAILED,
        errorMessage: 'Connection failed',
        requiresNotification: false,
        retryCount: 1,
      }),
    );
    for (const name of ['email', 'slack'])
      expect(channels.get(name).send).toHaveBeenCalledWith(
        expect.objectContaining({
          status: JobStatus.FAILED,
          priority: 'high',
          message: expect.stringContaining('재시도 가능: 1/3'),
          details: expect.objectContaining({ canRetry: true, errorMessage: 'Connection failed' }),
        }),
      );
  });
  it('does not claim exhausted failures can retry', async () => {
    await service.sendJobFailureNotification(job({ status: JobStatus.FAILED, retryCount: 3 }));
    expect(channels.get('email').send).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.objectContaining({ canRetry: false }),
        message: expect.not.stringContaining('재시도 가능'),
      }),
    );
  });
  it('dispatches delay notifications by email with current execution state', async () => {
    await service.sendJobDelayNotification(job({ status: JobStatus.RUNNING, progress: 40 }), 12);
    expect(channels.get('email').send).toHaveBeenCalledWith(
      expect.objectContaining({
        status: JobStatus.RUNNING,
        message: expect.stringContaining('12분'),
        details: expect.objectContaining({ delayMinutes: 12, currentProgress: 40 }),
      }),
    );
    expect(channels.get('slack').send).not.toHaveBeenCalled();
  });
  it('summarizes a bulk operation from actual job states', async () => {
    await service.sendBulkJobNotification(
      [job(), job({ id: 'failed', status: JobStatus.FAILED })],
      'Synthetic batch',
      'Finished',
      'batch@example.invalid',
    );
    expect(channels.get('email').send).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: 'bulk-operation',
        title: 'Synthetic batch',
        message: 'Finished',
        recipient: 'batch@example.invalid',
        details: { totalJobs: 2, completedJobs: 1, failedJobs: 1, jobIds: ['job', 'failed'] },
      }),
    );
  });
  it.each(['normal', 'high', 'urgent'] as const)(
    'routes %s system messages using existing priority rules',
    async priority => {
      await service.sendSystemNotification('Synthetic system', 'Test', priority, {
        queueLength: 3,
      });
      expect(channels.get('email').send).toHaveBeenCalledWith(
        expect.objectContaining({
          recipient: 'system-admin',
          priority,
          details: { queueLength: 3 },
        }),
      );
      expect(channels.get('slack').send).toHaveBeenCalledTimes(priority === 'normal' ? 0 : 1);
    },
  );
  it('isolates one channel failure and still dispatches the other channel', async () => {
    channels.get('email').send.mockRejectedValue(new Error('Adapter offline'));
    await expect(
      service.sendSystemNotification('Synthetic', 'Test', 'urgent'),
    ).resolves.toBeUndefined();
    expect(channels.get('slack').send).toHaveBeenCalledTimes(1);
  });
  it('keeps completion and delay delivery failures best-effort', async () => {
    channels.get('email').send.mockRejectedValue(new Error('Adapter offline'));
    await expect(service.sendJobCompletionNotification(job())).resolves.toBeUndefined();
    await expect(service.sendJobDelayNotification(job(), 1)).resolves.toBeUndefined();
  });
  it('tolerates missing configured channels', async () => {
    channels.clear();
    await expect(
      service.sendSystemNotification('Synthetic', 'Test', 'urgent'),
    ).resolves.toBeUndefined();
    await expect(
      service.sendJobFailureNotification(job({ status: JobStatus.FAILED })),
    ).resolves.toBeUndefined();
  });
});
