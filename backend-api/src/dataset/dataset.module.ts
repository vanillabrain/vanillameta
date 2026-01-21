import { Module, forwardRef } from '@nestjs/common';
import { DatasetService } from './dataset.service';
import { DatasetController } from './dataset.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Dataset } from './entities/dataset.entity';
import { ConnectionModule } from '../connection/connection.module';
import { Database } from '../database/entities/database.entity';
import { Widget } from '../widget/entities/widget.entity';
import { JwtService } from '@nestjs/jwt';
import { CacheModule } from '../common/optimization/cache.module';
import { BusinessMetricsModule } from '../common/monitoring/business-metrics.module';
import { PaginationModule } from '../common/pagination';

@Module({
  imports: [
    TypeOrmModule.forFeature([Dataset, Database, Widget]),
    ConnectionModule,
    forwardRef(() => CacheModule),
    BusinessMetricsModule,
    PaginationModule,
  ],
  controllers: [DatasetController],
  providers: [DatasetService, JwtService],
  exports: [DatasetService],
})
export class DatasetModule {}
