import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessMetricsService } from './business-metrics.service';
import { CloudWatchMetricsService } from './cloudwatch-metrics.service';
import { User } from '../../user/entities/user.entity';
import { Dashboard } from '../../dashboard/entities/dashboard.entity';
import { Widget } from '../../widget/entities/widget.entity';
import { TableQuery } from '../../widget/table-query/entity/table-query.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Dashboard, Widget, TableQuery])],
  providers: [BusinessMetricsService, CloudWatchMetricsService],
  exports: [BusinessMetricsService],
})
export class BusinessMetricsModule {}
