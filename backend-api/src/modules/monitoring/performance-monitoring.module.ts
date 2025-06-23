import { Module } from '@nestjs/common';
import { MonitoringController } from './monitoring.controller';
import { PerformanceMetricsService } from '../../common/services/performance-metrics.service';
import { CloudWatchIntegrationService } from '../../common/services/cloudwatch-integration.service';
import { Redis } from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';

/**
 * 성능 모니터링 모듈
 * 
 * API 성능 모니터링 관련 컨트롤러와 서비스를 제공합니다.
 */
@Module({
  imports: [EventEmitterModule.forRoot()],
  controllers: [MonitoringController],
  providers: [
    {
      provide: 'REDIS_CLIENT',
      useFactory: (configService: ConfigService) => {
        const redis = new Redis({
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
          password: configService.get<string>('REDIS_PASSWORD'),
          db: configService.get<number>('REDIS_DB', 0),
        });
        return redis;
      },
      inject: [ConfigService],
    },
    PerformanceMetricsService,
    CloudWatchIntegrationService,
  ],
  exports: [
    PerformanceMetricsService,
    CloudWatchIntegrationService,
  ],
})
export class PerformanceMonitoringModule {}