import { Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Component } from '../component/entities/component.entity';
import { ConnectionService } from '../connection/connection.service';
import { DashboardWidgetService } from '../dashboard/dashboard-widget/dashboard-widget.service';
import { Dashboard } from '../dashboard/entities/dashboard.entity';
import { DashboardWidget } from '../dashboard/dashboard-widget/entities/dashboard-widget.entity';
import { DatabaseService } from '../database/database.service';
import { UserStorageService } from '../database/user-storage.service';
import { DatabaseType } from '../database/entities/database_type.entity';
import { Database } from '../database/entities/database.entity';
import { Dataset } from '../dataset/entities/dataset.entity';
import { Widget } from '../widget/entities/widget.entity';
import { TableQuery } from '../widget/tabel-query/entity/table-query.entity';
import { AiController } from './ai.controller';
import { AiDashboardService } from './ai-dashboard.service';
import { DashboardShare } from '../dashboard/entities/dashboard_share.entity';
import { AiService } from './ai.service';
import { LlmGateway } from './llm-gateway.service';
import { UsageModule } from '../usage/usage.module';
import { UserMapping } from '../user/entities/user-mapping.entity';

@Module({
  imports: [
    UsageModule,
    TypeOrmModule.forFeature([
      Database,
      Dataset,
      TableQuery,
      DatabaseType,
      Component,
      Dashboard,
      DashboardShare,
      UserMapping,
      DashboardWidget,
      Widget,
    ]),
  ],
  controllers: [AiController],
  providers: [
    AiDashboardService,
    AiService,
    LlmGateway,
    ConnectionService,
    DatabaseService,
    UserStorageService,
    DashboardWidgetService,
    JwtService,
  ],
  exports: [AiService, AiDashboardService, LlmGateway],
})
export class AiModule {}
