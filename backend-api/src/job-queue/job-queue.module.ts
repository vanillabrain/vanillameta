import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JobQueueController } from './job-queue.controller';
import { JobQueueService } from './job-queue.service';
import { JobProcessorService } from './services/job-processor.service';
import { JobSchedulerService } from './services/job-scheduler.service';
import { JobStatusTrackerService } from './services/job-status-tracker.service';
import { JobRetryService } from './services/job-retry.service';
import { JobPriorityService } from './services/job-priority.service';
import { JobQueueMonitoringService } from './services/job-queue-monitoring.service';
import { JobNotificationService } from './services/job-notification.service';
import { JobResourceManagerService } from './services/job-resource-manager.service';
import { QueueJob } from './entities/queue-job.entity';
import { JobResult } from './entities/job-result.entity';
import { JobStatusHistory } from './entities/job-status-history.entity';
import { JobMetrics } from './entities/job-metrics.entity';
import { ConnectionModule } from '../connection/connection.module';
import { CacheModule } from '../cache/cache.module';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      QueueJob,
      JobResult,
      JobStatusHistory,
      JobMetrics,
    ]),
    ConnectionModule,
    CacheModule,
    DatabaseModule,
  ],
  controllers: [JobQueueController],
  providers: [
    JobQueueService,
    JobProcessorService,
    JobSchedulerService,
    JobStatusTrackerService,
    JobRetryService,
    JobPriorityService,
    JobQueueMonitoringService,
    JobNotificationService,
    JobResourceManagerService,
  ],
  exports: [
    JobQueueService,
    JobStatusTrackerService,
    JobQueueMonitoringService,
  ],
})
export class JobQueueModule {}