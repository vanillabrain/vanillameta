import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccessController } from './access.controller';
import { AccessService } from './access.service';
import { InviteCode } from './entities/invite-code.entity';
import { InviteRedemption } from './entities/invite-redemption.entity';
import { WaitlistEntry } from './entities/waitlist-entry.entity';

@Module({
  imports: [TypeOrmModule.forFeature([InviteCode, InviteRedemption, WaitlistEntry])],
  controllers: [AccessController],
  providers: [AccessService],
  exports: [AccessService],
})
export class AccessModule {}
