import { Module, Global } from '@nestjs/common';
import { MemoryMonitorMiddleware } from './memory-monitor.middleware';
import { MemoryMonitorService } from './memory-monitor.service';
import { MemoryMonitorController } from './memory-monitor.controller';
import { CustomLoggerModule } from '../logger/logger.module';

@Global()
@Module({
  imports: [CustomLoggerModule],
  providers: [MemoryMonitorMiddleware, MemoryMonitorService],
  controllers: [MemoryMonitorController],
  exports: [MemoryMonitorMiddleware, MemoryMonitorService],
})
export class MemoryMonitorModule {}