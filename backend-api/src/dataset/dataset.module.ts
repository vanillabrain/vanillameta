import { Module } from '@nestjs/common';
import { DatasetService } from './dataset.service';
import { DatasetController } from './dataset.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Dataset } from './entities/dataset.entity';
import { ConnectionService } from '../connection/connection.service';
import { Database } from '../database/entities/database.entity';
import { Widget } from '../widget/entities/widget.entity';
import { JwtService } from '@nestjs/jwt';
import { CacheModule } from '../common/optimization/cache.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Dataset, Database, Widget]),
    CacheModule,
  ],
  controllers: [DatasetController],
  providers: [DatasetService, ConnectionService, JwtService],
  exports: [DatasetService],
})
export class DatasetModule {}
