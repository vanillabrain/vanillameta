import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Database } from '../entities/database.entity';
import { ConnectionService } from '../connection/connection.service';
import { DatabaseService } from '../database.service';
import { Dataset } from '../../dataset/entities/dataset.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Database, Dataset])],
  providers: [ConnectionService, DatabaseService],
})
export class ConnectionModule {}
