import { Module } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { DatabaseController } from './database.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Database } from './entities/database.entity';
import { ConnectionService } from '../connection/connection.service';
import { Dataset } from '../dataset/entities/dataset.entity';
import { TableQuery } from '../widget/tabel-query/entity/table-query.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Database, Dataset, TableQuery])],
  controllers: [DatabaseController],
  providers: [DatabaseService, ConnectionService],
})
export class DatabaseModule {}
