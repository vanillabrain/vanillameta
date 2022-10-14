import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Database } from '../database/entities/database.entity';
import { ConnectionService } from './connection.service';
import { DatabaseService } from '../database/database.service';
import { Dataset } from '../dataset/entities/dataset.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Database, Dataset])],
  providers: [ConnectionService],
})
export class ConnectionModule {}
