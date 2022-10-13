import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Dashboard } from './entities/dashboard.entity';
import { DashboardWidget } from './dashboard-widget/entities/dashboard-widget.entity';
import { DashboardWidgetService } from './dashboard-widget/dashboard-widget.service';
import { Widget } from 'src/widget/entities/widget.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Dashboard, DashboardWidget, Widget])],
  controllers: [DashboardController],
  providers: [DashboardService, DashboardWidgetService],
})
export class DashboardModule {}
