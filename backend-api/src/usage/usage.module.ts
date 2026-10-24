import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserStorageService } from '../database/user-storage.service';
import { AiQuotaService } from './ai-quota.service';
import { UsageController } from './usage.controller';
import { AiUsageLedger } from './entities/ai-usage-ledger.entity';
import { UserQuota } from './entities/user-quota.entity';

@Module({
  // UsageController is behind JwtAuthGuard, which injects JwtService: without it every token fails.
  imports: [TypeOrmModule.forFeature([AiUsageLedger, UserQuota]), JwtModule],
  controllers: [UsageController],
  providers: [AiQuotaService, UserStorageService],
  exports: [AiQuotaService],
})
export class UsageModule {}
