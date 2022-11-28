import {MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ShareUrlService } from './share-url.service';
import { ShareUrlController } from './share-url.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserInfo } from '../user/entities/user-info.entity.js';
import { Dashboard } from '../dashboard/entities/dashboard.entity.js'
import { AuthService } from '../auth/auth.service';
import { JwtModule } from '@nestjs/jwt';
import { RefreshToken } from 'src/auth/entites/refresh_token.entity';
import { loginLoggerMiddleware } from 'src/middleware/middleware.login-logger';
import { LoginHistory } from 'src/middleware/entities/login-history.entity';

@Module({
  imports: [TypeOrmModule.forFeature([UserInfo, Dashboard, RefreshToken, LoginHistory]), JwtModule],
  controllers: [ShareUrlController],
  providers: [ShareUrlService, AuthService]
})
export class ShareUrlModule {}
