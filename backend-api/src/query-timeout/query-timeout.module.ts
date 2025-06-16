import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QueryTimeoutService } from './query-timeout.service';
import { QueryTimeoutController } from './query-timeout.controller';
import { TimeoutConfigurationService } from './services/timeout-configuration.service';
import { TimeoutMonitoringService } from './services/timeout-monitoring.service';
import { AdaptiveTimeoutService } from './services/adaptive-timeout.service';
import { Database } from '../database/entities/database.entity';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [TypeOrmModule.forFeature([Database]), CommonModule],
  controllers: [QueryTimeoutController],
  providers: [
    QueryTimeoutService,
    TimeoutConfigurationService,
    TimeoutMonitoringService,
    AdaptiveTimeoutService,
  ],
  exports: [
    QueryTimeoutService,
    TimeoutConfigurationService,
    TimeoutMonitoringService,
    AdaptiveTimeoutService,
  ],
})
export class QueryTimeoutModule {}
