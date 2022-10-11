import { Module } from '@nestjs/common';
import { WidgetService } from './widget.service';
import { WidgetController } from './widget.controller';
import {TypeOrmModule} from "@nestjs/typeorm";
import {Widget} from "./entities/widget.entity";
import {WidgetViewController} from "../widget-view/widget-view.controller";
import {WidgetView} from "../widget-view/entities/widget-view.entity";
import {WidgetViewModule} from "../widget-view/widget-view.module";


@Module({
  imports: [TypeOrmModule.forFeature([Widget]),
    WidgetViewModule],
  controllers: [WidgetController],
  providers: [WidgetService],
})
export class WidgetModule {}
