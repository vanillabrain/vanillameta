import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EnterpriseNotificationService } from './notification.service';

@UseGuards(JwtAuthGuard)
@Controller('enterprise/notifications')
export class EnterpriseNotificationController {
  constructor(private readonly notifications: EnterpriseNotificationService) {}
  private id(raw: unknown) {
    if (typeof raw !== 'string' || !/^[1-9][0-9]*$/.test(raw) || !Number.isSafeInteger(Number(raw)))
      throw new BadRequestException('알림 번호를 확인해 주세요.');
    return Number(raw);
  }
  @Get() list(@Req() req: any, @Query('beforeId') beforeId?: unknown) {
    return this.notifications.list(
      req.user.accessKeyData.id,
      beforeId === undefined ? undefined : this.id(beforeId),
    );
  }
  @Post(':id/read') read(@Req() req: any, @Param('id') id: string) {
    return this.notifications.mark(req.user.accessKeyData.id, this.id(id), 'read');
  }
  @Post(':id/remove') remove(@Req() req: any, @Param('id') id: string) {
    return this.notifications.mark(req.user.accessKeyData.id, this.id(id), 'remove');
  }
}
