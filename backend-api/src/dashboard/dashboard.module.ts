import { PersonalLibraryController } from './personal-library.controller';
import { PersonalLibraryService } from './personal-library.service';
import { PersonalLibraryState } from './entities/personal-library-state.entity';
import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
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
import { RefreshToken } from 'src/auth/entites/refresh_token.entity';
import { DashboardShare } from 'src/dashboard/entities/dashboard_share.entity';
import { PersonalView } from './entities/personal-view.entity';
import { PersonalViewService } from './personal-view.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
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
  controllers: [PersonalLibraryController, DashboardController],
  providers: [
    PersonalLibraryService,
    DashboardService,
    DashboardWidgetService,
    UserService,
    AuthService,
    JwtService,
    PersonalViewService,
  ],
})
export class DashboardModule {}
