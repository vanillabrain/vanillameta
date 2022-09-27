import { Module } from '@nestjs/common';
import { WidgetService } from './widget.service';
import { WidgetController } from './widget.controller';
import {TypeOrmModule} from "@nestjs/typeorm";
import {Widget} from "./entities/widget.entity";

@Module({
  imports: [TypeOrmModule.forFeature([Widget])],
  controllers: [WidgetController],
  providers: [WidgetService],
})
export class WidgetModule {}
