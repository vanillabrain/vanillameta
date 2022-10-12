import { forwardRef, Module } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { DatabaseController } from './database.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Database } from './entities/database.entity';
import { ConnectionService } from './connection/connection.service';
import { ConnectionModule } from './connection/connection.module';
import { Dataset } from '../dataset/entities/dataset.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Database, Dataset]), forwardRef(() => ConnectionModule)],
  controllers: [DatabaseController],
  providers: [DatabaseService, ConnectionService],
})
export class DatabaseModule {}
