import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import {TypeOrmModule} from "@nestjs/typeorm";
import {Dashboard} from "./entities/dashboard.entity";

@Module({
  imports: [TypeOrmModule.forFeature([Dashboard])],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
