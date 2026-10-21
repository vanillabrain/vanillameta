import { DashboardDeletionController } from './dashboard-deletion.controller';
import { DashboardDeletionService } from './dashboard-deletion.service';
import { DashboardDeleteReceipt } from './entities/dashboard-delete-receipt.entity';
import { PersonalLibraryController } from './personal-library.controller';
import { PersonalLibraryService } from './personal-library.service';
import { PersonalLibraryState } from './entities/personal-library-state.entity';
import { Module, forwardRef } from '@nestjs/common';
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
import { CacheModule } from '../common/optimization/cache.module';
import { PaginationModule } from '../common/pagination';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PersonalView } from './entities/personal-view.entity';
import { PersonalViewService } from './personal-view.service';

@Module({
  imports: [
    forwardRef(() => CacheModule),
    PaginationModule,
    TypeOrmModule.forFeature([
      DashboardDeleteReceipt,
      PersonalLibraryState,
      PersonalView,
      Dashboard,
      DashboardWidget,
      Widget,
      Component,
      User,
      UserMapping,
      DashboardShare,
      RefreshToken,
    ]),
  ],
  controllers: [DashboardDeletionController, PersonalLibraryController, DashboardController],
  providers: [
    DashboardDeletionService,
    PersonalLibraryService,
    DashboardService,
    DashboardCacheService,
    DashboardWidgetService,
    UserService,
    AuthService,
    JwtService,
    PersonalViewService,
  ],
  exports: [DashboardService, DashboardCacheService],
})
export class DashboardModule {}
