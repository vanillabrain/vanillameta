import { AuthModule } from '../auth/auth.module';
import { DynamicModule, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BackgroundJobController } from './background-job.controller';
import { BackgroundJobService } from './background-job.service';
import { BackgroundJob } from './entities/background-job.entity';
import { JobResult } from './entities/job-result.entity';
import { QueryJobProcessor } from './processors/query-job.processor';
import { BackgroundJobScheduler } from './background-job.scheduler';
import { DatasetModule } from '../dataset/dataset.module';
import { DatabaseModule } from '../database/database.module';
import { ConnectionModule } from '../connection/connection.module';
import { LoggerModule } from '../common/logger/logger.module';
import { ScheduleModule } from '@nestjs/schedule';

/**
 * Redis is opt-in: set REDIS_URL, REDIS_HOST or REDIS_PORT in the server environment/.env.
 * With none configured, history APIs remain available and admission returns 503.
 * QA_REDIS_PORT must be mapped to REDIS_PORT by the launcher, never inferred here.
 */
@Module({})
class BackgroundJobRuntimeModule {}

export async function backgroundJobRuntime(): Promise<DynamicModule> {
  await ConfigModule.envVariablesLoaded;
  const enabled = !!(process.env.REDIS_URL || process.env.REDIS_HOST || process.env.REDIS_PORT);
  const queue = enabled
    ? [
        BullModule.registerQueueAsync({
          name: 'query-execution',
          imports: [ConfigModule],
          useFactory: async (config: ConfigService) => ({
            redis: config.get<string>('REDIS_URL') || {
              host: config.get<string>('REDIS_HOST') || '127.0.0.1',
              port: Number(config.get<string>('REDIS_PORT') || 6379),
              password: config.get<string>('REDIS_PASSWORD'),
              db: Number(config.get<string>('REDIS_DB') || 0),
            },
            defaultJobOptions: {
              removeOnComplete: false,
              removeOnFail: false,
              attempts: 3,
              backoff: { type: 'exponential', delay: 2000 },
            },
          }),
          inject: [ConfigService],
        }),
      ]
    : [];
  return {
    module: BackgroundJobRuntimeModule,
    imports: [
      AuthModule,
      TypeOrmModule.forFeature([BackgroundJob, JobResult]),
      ...queue,
      DatasetModule,
      DatabaseModule,
      ConnectionModule,
      LoggerModule,
      ScheduleModule.forRoot(),
    ],
    controllers: [BackgroundJobController],
    providers: [
      BackgroundJobService,
      BackgroundJobScheduler,
      ...(enabled ? [QueryJobProcessor] : []),
    ],
    exports: [BackgroundJobService],
  };
}

@Module({ imports: [backgroundJobRuntime()], exports: [BackgroundJobRuntimeModule] })
export class BackgroundJobModule {}
