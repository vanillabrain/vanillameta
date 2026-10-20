import { MetricDeletionService } from './metric-deletion.service';
import { MetricDeletionController } from './metric-deletion.controller';
import { MetricDeleteReceipt } from './entities/metric-delete-receipt.entity';
import { Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConnectionService } from '../connection/connection.service';
import { Database } from '../database/entities/database.entity';
import { Metric } from './entities/metric.entity';
import { MetricController } from './metric.controller';
import { MetricService } from './metric.service';

@Module({
  imports: [TypeOrmModule.forFeature([Metric, Database, MetricDeleteReceipt])],
  controllers: [MetricDeletionController, MetricController],
  providers: [MetricDeletionService, MetricService, ConnectionService, JwtService],
})
export class MetricModule {}
