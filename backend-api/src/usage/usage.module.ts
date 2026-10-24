import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserStorageService } from '../database/user-storage.service';
import { AiQuotaService } from './ai-quota.service';
import { UsageController } from './usage.controller';
import { AiUsageLedger } from './entities/ai-usage-ledger.entity';
import { UserQuota } from './entities/user-quota.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AiUsageLedger, UserQuota])],
  controllers: [UsageController],
  providers: [AiQuotaService, UserStorageService],
  exports: [AiQuotaService],
})
export class UsageModule {}
