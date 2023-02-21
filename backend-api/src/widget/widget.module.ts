import { Module } from '@nestjs/common';
import { WidgetService } from './widget.service';
import { WidgetController } from './widget.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Widget } from './entities/widget.entity';
import { Component } from '../component/entities/component.entity';
import { TableQueryService } from './tabel-query/table-query.service';
import { TableQuery } from './tabel-query/entity/table-query.entity';
import { Database } from '../database/entities/database.entity';
import { JwtService } from '@nestjs/jwt';

@Module({
  imports: [TypeOrmModule.forFeature([Widget, Component, TableQuery, Database])],
  controllers: [WidgetController],
  providers: [WidgetService, TableQueryService, JwtService],
})
export class WidgetModule {}
