import { Module } from '@nestjs/common';
import { MiddlewareService } from './middleware.service';
import { MiddlewareController } from './middleware.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoginHistory } from './entities/login-history.entity.js'
import { loginLoggerMiddleware } from './middleware-log/middleware.login-logger';

@Module({
  imports: [TypeOrmModule.forFeature([LoginHistory])],
  controllers: [MiddlewareController],
  providers: [MiddlewareService, loginLoggerMiddleware]
})
export class MiddlewareModule {}
