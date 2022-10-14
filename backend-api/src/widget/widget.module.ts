import { Module } from '@nestjs/common';
import { WidgetService } from './widget.service';
import { WidgetController } from './widget.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Widget } from './entities/widget.entity';
import { Component } from '../component/entities/component.entity';
import { TableQueryService } from './tabel-query/table-query.service';
import { TableQuery } from './tabel-query/entity/table-query.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Widget, Component, TableQuery])],
  controllers: [WidgetController],
  providers: [WidgetService, TableQueryService],
})
export class WidgetModule {}
