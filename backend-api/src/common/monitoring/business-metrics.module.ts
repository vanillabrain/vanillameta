import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessMetricsService } from './business-metrics.service';
import { CloudWatchMetricsService } from './cloudwatch-metrics.service';
import { Users } from '../../user/entities/users.entity';
import { Dashboard } from '../../dashboard/entities/dashboard.entity';
import { Widget } from '../../widget/entities/widget.entity';
import { TableQuery } from '../../dataset/entities/table-query.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Users, Dashboard, Widget, TableQuery]),
  ],
  providers: [BusinessMetricsService, CloudWatchMetricsService],
  exports: [BusinessMetricsService],
})
export class BusinessMetricsModule {}