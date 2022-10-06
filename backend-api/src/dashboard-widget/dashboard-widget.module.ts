import { Module } from '@nestjs/common';
import { DashboardWidgetService } from './dashboard-widget.service';
import { DashboardWidgetController } from './dashboard-widget.controller';

@Module({
  controllers: [DashboardWidgetController],
  providers: [DashboardWidgetService, DashboardWidgetController],
  exports: [DashboardWidgetController]
})
export class DashboardWidgetModule {}
