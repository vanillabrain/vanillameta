import {MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ShareUrlService } from './share-url.service';
import { ShareUrlController } from './share-url.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserInfo } from '../user/entities/user-info.entity.js';
import { Dashboard } from '../dashboard/entities/dashboard.entity.js'
import { AuthService } from '../auth/auth.service';
import { JwtModule } from '@nestjs/jwt';
import { RefreshToken } from 'src/auth/entites/refresh_token.entity';
import { loginLoggerMiddleware } from 'src/middleware/middleware-log/middleware.login-logger';
import { LoginHistory } from 'src/middleware/entities/login-history.entity';
import { shareUrlLoggerMiddleware } from 'src/middleware/middleware-log/middleware.share-url-logger';
import { DashboardService } from 'src/dashboard/dashboard.service';
import { DashboardWidgetService } from 'src/dashboard/dashboard-widget/dashboard-widget.service';
import { DashboardWidget } from 'src/dashboard/dashboard-widget/entities/dashboard-widget.entity';
import { Widget } from 'src/widget/entities/widget.entity';
import { Component } from 'src/component/entities/component.entity';
import { UserService } from 'src/user/user.service';
import { User } from 'src/user/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([UserInfo, Dashboard, RefreshToken, LoginHistory, DashboardWidget, User, Widget, Component]), JwtModule],
  controllers: [ShareUrlController],
  providers: [ShareUrlService, AuthService, DashboardService, DashboardWidgetService, UserService]
})
export class ShareUrlModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(shareUrlLoggerMiddleware).forRoutes('share-url');
  }
}