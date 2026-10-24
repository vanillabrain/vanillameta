import { Controller, ForbiddenException, Get, Req, UseGuards } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ResponseStatus } from '../common/enum/response-status.enum';
import { UserThrottle, UserThrottleGuard } from '../common/throttle/user-throttle.guard';
import { UserStorageService } from '../database/user-storage.service';
import { uploadLimits } from '../database/upload-limits';
import { AiQuotaService } from './ai-quota.service';

/** What the signed-in user has used of the beta limits. Only ever the caller's own numbers. */
@UseGuards(JwtAuthGuard, UserThrottleGuard)
@Controller('me')
export class UsageController {
  constructor(
    private readonly quota: AiQuotaService,
    private readonly storage: UserStorageService,
    @InjectDataSource() private readonly db: DataSource,
  ) {}

  // Reads the user's directories on disk, so it is limited per user as well as per IP.
  @UserThrottle('read')
  @Get('usage')
  async usage(@Req() req) {
    const id = req.user?.accessKeyData?.id;
    if (!Number.isSafeInteger(id) || id <= 0)
      throw new ForbiddenException('Current actor required.');
    const ai = await this.quota.summary(id);
    const stored = await this.storage.usage(this.db.manager, id);
    const limits = uploadLimits();
    return {
      status: ResponseStatus.SUCCESS,
      data: {
        ai,
        storage: {
          sources: { used: stored.sources, limit: limits.maxSources },
          bytes: { used: stored.bytes, limit: limits.maxBytes },
        },
      },
    };
  }
}
