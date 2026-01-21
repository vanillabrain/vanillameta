import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { AnalyticsEvent } from './entities/analytics-event.entity';
import { EventSession } from './entities/event-session.entity';
import { PerformanceMetric } from './entities/performance-metric.entity';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AnalyticsEvent, EventSession, PerformanceMetric]),
    CommonModule,
  ],
  controllers: [EventsController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
