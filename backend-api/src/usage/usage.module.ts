import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiQuotaService } from './ai-quota.service';
import { AiUsageLedger } from './entities/ai-usage-ledger.entity';
import { UserQuota } from './entities/user-quota.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AiUsageLedger, UserQuota])],
  providers: [AiQuotaService],
  exports: [AiQuotaService],
})
export class UsageModule {}
