import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { DashboardCacheService } from './dashboard-cache.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Dashboard } from './entities/dashboard.entity';
import { DashboardWidget } from './dashboard-widget/entities/dashboard-widget.entity';
import { DashboardWidgetService } from './dashboard-widget/dashboard-widget.service';
import { Widget } from '../widget/entities/widget.entity';
import { Component } from '../component/entities/component.entity';
import { UserService } from 'src/user/user.service';
import { AuthService } from 'src/auth/auth.service';
import { User } from 'src/user/entities/user.entity';
import { UserMapping } from 'src/user/entities/user-mapping.entity';
import { JwtService } from '@nestjs/jwt';
import { RefreshToken } from 'src/auth/entities/refresh_token.entity';
import { DashboardShare } from 'src/dashboard/entities/dashboard_share.entity';
import { PaginationModule } from '../common/pagination';
import { CacheModule } from '../common/optimization/cache.module';
import { EventEmitterModule } from '@nestjs/event-emitter';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Dashboard,
      DashboardWidget,
      Widget,
      Component,
      User,
      UserMapping,
      DashboardShare,
      RefreshToken,
    ]),
    PaginationModule,
    CacheModule,
    EventEmitterModule.forRoot(),
  ],
  controllers: [DashboardController],
  providers: [
    DashboardService,
    DashboardCacheService,
    DashboardWidgetService,
    UserService,
    AuthService,
    JwtService,
  ],
  exports: [DashboardService, DashboardCacheService],
})
export class DashboardModule {}
