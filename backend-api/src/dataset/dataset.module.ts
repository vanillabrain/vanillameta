import { Module } from '@nestjs/common';
import { DatasetService } from './dataset.service';
import { DatasetController } from './dataset.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Dataset } from './entities/dataset.entity';
import { ConnectionService } from '../connection/connection.service';
import { Database } from '../database/entities/database.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Dataset, Database])],
  controllers: [DatasetController],
  providers: [DatasetService, ConnectionService],
})
export class DatasetModule {}
