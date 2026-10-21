import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../../auth/auth.module';
import { Module, Global, forwardRef } from '@nestjs/common';
import { MemoryMonitorMiddleware } from './memory-monitor.middleware';
import { MemoryMonitorService } from './memory-monitor.service';
import { MemoryMonitorController } from './memory-monitor.controller';
import { LoggerModule } from '../logger/logger.module';
import { CloudWatchMetricsService } from './cloudwatch-metrics.service';

@Global()
@Module({
  imports: [ConfigModule, AuthModule, LoggerModule],
  providers: [MemoryMonitorMiddleware, MemoryMonitorService, CloudWatchMetricsService],
  controllers: [MemoryMonitorController],
  exports: [MemoryMonitorMiddleware, MemoryMonitorService],
})
export class MemoryMonitorModule {}
