import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ShareUrlService } from './share-url.service';
import { ShareUrlController } from './share-url.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../user/entities/user.entity.js';
import { Dashboard } from '../dashboard/entities/dashboard.entity.js';
import { AuthService } from '../auth/auth.service';
import { JwtModule } from '@nestjs/jwt';
import { RefreshToken } from 'src/auth/entites/refresh_token.entity';
import { LoginHistory } from 'src/middleware/entities/login-history.entity';
import { shareUrlLoggerMiddleware } from 'src/middleware/middleware-log/middleware.share-url-logger';
import { DashboardService } from 'src/dashboard/dashboard.service';
import { DashboardWidgetService } from 'src/dashboard/dashboard-widget/dashboard-widget.service';
import { DashboardWidget } from 'src/dashboard/dashboard-widget/entities/dashboard-widget.entity';
import { Widget } from 'src/widget/entities/widget.entity';
import { Component } from 'src/component/entities/component.entity';
import { UserService } from 'src/user/user.service';
import { UserMapping } from 'src/user/entities/user-mapping.entity';
import { DashboardShare } from 'src/dashboard/entities/dashboard_share';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Dashboard,
      RefreshToken,
      LoginHistory,
      DashboardWidget,
      UserMapping,
      Widget,
      Component,
      DashboardShare,
    ]),
    JwtModule,
  ],
  controllers: [ShareUrlController],
  providers: [ShareUrlService, AuthService, DashboardService, DashboardWidgetService, UserService],
})
export class ShareUrlModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(shareUrlLoggerMiddleware).forRoutes('share-url');
  }
}
