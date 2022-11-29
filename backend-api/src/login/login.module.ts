import {MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { LoginService } from './login.service';
import { LoginController } from './login.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../user/entities/user.entity';
import { UserInfo } from '../user/entities/user-info.entity.js';
import { RefreshToken } from '../auth/entites/refresh_token.entity.js'
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from 'src/auth/auth.service';
import { loginLoggerMiddleware } from 'src/middleware/middleware.login-logger';
import { LoginHistory } from 'src/middleware/entities/login-history.entity';
import { APP_INTERCEPTOR } from '@nestjs/core';

@Module({
  imports: [TypeOrmModule.forFeature([UserInfo, RefreshToken, User, LoginHistory]), JwtModule],
  controllers: [LoginController],
  providers: [LoginService, AuthService, {provide: APP_INTERCEPTOR, useClass: loginLoggerMiddleware}]
})
export class LoginModule   implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply( loginLoggerMiddleware ).forRoutes('login');
  }
}
