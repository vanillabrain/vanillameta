import { Module } from '@nestjs/common';
import { WidgetService } from './widget.service';
import { WidgetController } from './widget.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Widget } from './entities/widget.entity';
import { WidgetViewModule } from '../widget-view/widget-view.module';
import { Component } from '../component/entities/component.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Widget, Component]), WidgetViewModule],
  controllers: [WidgetController],
  providers: [WidgetService],
})
export class WidgetModule {}
