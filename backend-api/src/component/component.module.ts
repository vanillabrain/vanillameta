import { Module } from '@nestjs/common';
import { ComponentService } from './component.service';
import { ComponentController } from './component.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Component } from './entities/component.entity';
import { JwtService } from '@nestjs/jwt';
import { LoggerModule } from '../common/logger/logger.module';
import { CacheModule } from '../common/optimization/cache.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Component]),
    LoggerModule,
    CacheModule, // CacheModule import 추가 - @Global()이므로 자동으로 모든 캐시 서비스 사용 가능
  ],
  controllers: [ComponentController],
  providers: [
    ComponentService,
    JwtService,
    // 캐시 서비스들 제거 - CacheModule에서 전역적으로 제공됨
  ],
})
export class ComponentModule {}
