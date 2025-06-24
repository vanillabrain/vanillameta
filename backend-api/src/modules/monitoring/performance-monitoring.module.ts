import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { MonitoringController } from './monitoring.controller';
import { SLOMonitoringController } from './slo-monitoring.controller';
import { PerformanceMetricsService } from '../../common/services/performance-metrics.service';
import { CloudWatchIntegrationService } from '../../common/services/cloudwatch-integration.service';
import { XRayIntegrationService } from '../../common/services/xray-integration.service';
import { SLOTrackingService } from '../../common/services/slo-tracking.service';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';

/**
 * 성능 모니터링 모듈
 * 
 * API 성능 모니터링 관련 컨트롤러와 서비스를 제공합니다.
 */
@Module({
  imports: [
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(), // SLO 추적을 위한 스케줄러 활성화
  ],
  controllers: [MonitoringController, SLOMonitoringController],
  providers: [
    {
      provide: 'REDIS_CLIENT',
      useFactory: (configService: ConfigService) => {
        const nodeEnv = configService.get<string>('NODE_ENV');
        
        // 로컬 환경에서는 Redis Mock 사용
        if (nodeEnv === 'local') {
          return {
            get: () => Promise.resolve(null),
            set: () => Promise.resolve('OK'),
            del: () => Promise.resolve(1),
            incr: () => Promise.resolve(1),
            expire: () => Promise.resolve(1),
            exists: () => Promise.resolve(0),
            quit: () => Promise.resolve('OK'),
          };
        }
        
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
    XRayIntegrationService,
    SLOTrackingService,
  ],
  exports: [
    PerformanceMetricsService,
    CloudWatchIntegrationService,
    XRayIntegrationService,
    SLOTrackingService,
  ],
})
export class PerformanceMonitoringModule {}