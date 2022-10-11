import { Module } from '@nestjs/common';
import { WidgetViewService } from './widget-view.service';
import { WidgetViewController } from './widget-view.controller';
import {TypeOrmModule} from "@nestjs/typeorm";
import {WidgetView} from "./entities/widget-view.entity";

@Module({
  imports: [TypeOrmModule.forFeature([WidgetView])],
  controllers: [WidgetViewController],
  providers: [WidgetViewService, WidgetViewController],
  exports: [WidgetViewController]
})
export class WidgetViewModule {}
