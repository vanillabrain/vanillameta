import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConnectionPoolMonitorService } from './connection-pool-monitor.service';
import { MonitoringController } from './monitoring.controller';
import { LoggerModule } from '../logger/logger.module';

@Module({
  imports: [ScheduleModule.forRoot(), LoggerModule],
  controllers: [MonitoringController],
  providers: [ConnectionPoolMonitorService],
  exports: [ConnectionPoolMonitorService],
})
export class MonitoringModule {}
