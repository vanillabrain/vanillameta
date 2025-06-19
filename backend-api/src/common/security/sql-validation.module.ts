import { Module } from '@nestjs/common';
import { SqlValidationService } from './sql-validation.service';
import { LoggerModule } from '../logger/logger.module';

@Module({
  imports: [LoggerModule],
  providers: [SqlValidationService],
  exports: [SqlValidationService],
})
export class SqlValidationModule {}
