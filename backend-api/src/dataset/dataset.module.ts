import { Module } from '@nestjs/common';
import { DatasetService } from './dataset.service';
import { DatasetController } from './dataset.controller';

@Module({
  controllers: [DatasetController],
  providers: [DatasetService]
})
export class DatasetModule {}
