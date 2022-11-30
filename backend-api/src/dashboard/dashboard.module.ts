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
import { UserInfo } from 'src/user/entities/user-info.entity';
import { User } from 'src/user/entities/user.entity';
import { JwtService } from '@nestjs/jwt';
import { RefreshToken } from 'src/auth/entites/refresh_token.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Dashboard, DashboardWidget, Widget, Component, UserInfo, User, RefreshToken])],
  controllers: [DashboardController],
  providers: [DashboardService, DashboardWidgetService, UserService, AuthService, JwtService],
})
export class DashboardModule {}
