import { Module } from '@nestjs/common';
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

@Module({
  imports: [
    TypeOrmModule.forFeature([BackgroundJob, JobResult]),
    BullModule.registerQueueAsync({
      name: 'query-execution',
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const nodeEnv = configService.get<string>('NODE_ENV') || 'local';

        // Lambda 환경에서는 SQS 사용을 권장하지만, 현재는 Bull 사용
        return {
          redis: {
            host: configService.get<string>('REDIS_HOST') || 'localhost',
            port: configService.get<number>('REDIS_PORT') || 6379,
            password: configService.get<string>('REDIS_PASSWORD'),
            db: configService.get<number>('REDIS_DB') || 0,
          },
          defaultJobOptions: {
            removeOnComplete: false, // 완료된 작업 보존
            removeOnFail: false, // 실패한 작업 보존
            attempts: 3, // 최대 재시도 횟수
            backoff: {
              type: 'exponential',
              delay: 2000, // 2초부터 시작
            },
          },
        };
      },
      inject: [ConfigService],
    }),
    DatasetModule,
    DatabaseModule,
    ConnectionModule,
    LoggerModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [BackgroundJobController],
  providers: [BackgroundJobService, QueryJobProcessor, BackgroundJobScheduler],
  exports: [BackgroundJobService],
})
export class BackgroundJobModule {}
