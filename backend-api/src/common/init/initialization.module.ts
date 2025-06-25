import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InitializationService } from './initialization.service';
import { User } from '../../user/entities/user.entity';
import { DatabaseType } from '../../database/entities/database_type.entity';
import { Component } from '../../component/entities/component.entity';
import { LoggerModule } from '../logger/logger.module';

@Module({
  imports: [TypeOrmModule.forFeature([User, DatabaseType, Component]), LoggerModule],
  providers: [InitializationService],
  exports: [InitializationService],
})
export class InitializationModule {}
