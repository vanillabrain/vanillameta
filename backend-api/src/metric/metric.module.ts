import { Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConnectionService } from '../connection/connection.service';
import { Database } from '../database/entities/database.entity';
import { Metric } from './entities/metric.entity';
import { MetricController } from './metric.controller';
import { MetricService } from './metric.service';

@Module({
  imports: [TypeOrmModule.forFeature([Metric, Database])],
  controllers: [MetricController],
  providers: [MetricService, ConnectionService, JwtService],
})
export class MetricModule {}
