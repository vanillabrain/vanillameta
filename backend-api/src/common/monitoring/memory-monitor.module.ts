import { Module, Global, forwardRef } from '@nestjs/common';
import { MemoryMonitorMiddleware } from './memory-monitor.middleware';
import { MemoryMonitorService } from './memory-monitor.service';
import { MemoryMonitorController } from './memory-monitor.controller';
import { LoggerModule } from '../logger/logger.module';
import { CloudWatchMetricsService } from './cloudwatch-metrics.service';

@Global()
@Module({
  imports: [LoggerModule],
  providers: [MemoryMonitorMiddleware, MemoryMonitorService, CloudWatchMetricsService],
  controllers: [MemoryMonitorController],
  exports: [MemoryMonitorMiddleware, MemoryMonitorService],
})
export class MemoryMonitorModule {}
