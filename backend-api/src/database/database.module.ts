import { Module } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { DatabaseController } from './database.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Database } from './entities/database.entity';
import { ConnectionModule } from '../connection/connection.module';
import { Dataset } from '../dataset/entities/dataset.entity';
import { TableQuery } from '../widget/table-query/entity/table-query.entity';
import { DatabaseType } from './entities/database_type.entity';
import { JwtService } from '@nestjs/jwt';

@Module({
  imports: [
    TypeOrmModule.forFeature([Database, Dataset, TableQuery, DatabaseType]),
    ConnectionModule,
  ],
  controllers: [DatabaseController],
  providers: [DatabaseService, JwtService],
})
export class DatabaseModule {}
