import { Module } from '@nestjs/common';
import { DashboardWidgetService } from './dashboard-widget.service';
import { DashboardWidgetController } from './dashboard-widget.controller';
import {DashboardWidget} from "./entities/dashboard-widget.entity";
import {TypeOrmModule} from "@nestjs/typeorm";
import {Widget} from "../widget/entities/widget.entity";


@Module({
  imports: [TypeOrmModule.forFeature([DashboardWidget, Widget])],
  controllers: [DashboardWidgetController],
  providers: [DashboardWidgetService, DashboardWidgetController],
  exports: [DashboardWidgetController]
})
export class DashboardWidgetModule {}
