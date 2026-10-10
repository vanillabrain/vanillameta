import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SampleService } from './sample.service';
import { Database } from '../database/entities/database.entity';
import { Dataset } from '../dataset/entities/dataset.entity';
import { Widget } from '../widget/entities/widget.entity';
import { Component } from '../component/entities/component.entity';
import { Dashboard } from '../dashboard/entities/dashboard.entity';
import { DashboardShare } from '../dashboard/entities/dashboard_share.entity';
import { DashboardWidget } from '../dashboard/dashboard-widget/entities/dashboard-widget.entity';
import { UserMapping } from '../user/entities/user-mapping.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Database,
      Dataset,
      Widget,
      Component,
      Dashboard,
      DashboardShare,
      DashboardWidget,
      UserMapping,
    ]),
  ],
  providers: [SampleService],
  exports: [SampleService],
})
export class SampleModule {}
