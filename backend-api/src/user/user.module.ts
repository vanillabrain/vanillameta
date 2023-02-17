import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { User } from './entities/user.entity.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from 'src/auth/auth.service';
import { JwtModule } from '@nestjs/jwt';
import { RefreshToken } from 'src/auth/entites/refresh_token.entity';
import { UserMapping } from './entities/user-mapping.entity.js';
import { Dashboard } from 'src/dashboard/entities/dashboard.entity';
import { LoginHistory } from 'src/middleware/entities/login-history.entity';
import { userLoggerMiddleware } from 'src/middleware/middleware-log/middleware.user-logger';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, RefreshToken, UserMapping, Dashboard, LoginHistory]),
    JwtModule,
  ],
  controllers: [UserController],
  providers: [UserService, AuthService],
})
export class UserModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(userLoggerMiddleware).forRoutes('user');
  }
}
