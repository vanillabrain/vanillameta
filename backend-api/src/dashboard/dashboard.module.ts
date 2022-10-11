import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import {TypeOrmModule} from "@nestjs/typeorm";
import {Dashboard} from "./entities/dashboard.entity";
import {DashboardWidgetModule} from "../dashboard-widget/dashboard-widget.module";

@Module({
  imports: [TypeOrmModule.forFeature([Dashboard]), DashboardWidgetModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
