import { Module } from '@nestjs/common';
import { ComponentService } from './component.service';
import { ComponentController } from './component.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Component } from './entities/component.entity';
import { JwtService } from '@nestjs/jwt';
import { HybridCacheService } from '../common/optimization/hybrid-cache.service';
import { QueryCacheService } from '../common/optimization/query-cache.service';
import { RedisCacheService } from '../common/optimization/redis-cache.service';
import { RedisModule } from '../common/redis/redis.module';
import { LoggerModule } from '../common/logger/logger.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Component]),
    RedisModule,
    LoggerModule,
  ],
  controllers: [ComponentController],
  providers: [
    ComponentService,
    JwtService,
    HybridCacheService,
    QueryCacheService,
    RedisCacheService,
  ],
})
export class ComponentModule {}
