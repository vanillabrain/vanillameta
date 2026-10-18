import {
  BadRequestException,
  Controller,
  Get,
  Header,
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
  @Get() @Header('Cache-Control', 'no-store') list(
    @Req() req: any,
    @Query('beforeId') beforeId?: unknown,
  ) {
    return this.notifications.list(
      req.user.accessKeyData.id,
      beforeId === undefined ? undefined : this.id(beforeId),
      req.user.accessKeyData.authVersion ?? 0,
    );
  }
  @Post(':id/read') @Header('Cache-Control', 'no-store') read(
    @Req() req: any,
    @Param('id') id: string,
  ) {
    return this.notifications.mark(
      req.user.accessKeyData.id,
      this.id(id),
      'read',
      req.user.accessKeyData.authVersion ?? 0,
    );
  }
  @Post(':id/remove') @Header('Cache-Control', 'no-store') remove(
    @Req() req: any,
    @Param('id') id: string,
  ) {
    return this.notifications.mark(
      req.user.accessKeyData.id,
      this.id(id),
      'remove',
      req.user.accessKeyData.authVersion ?? 0,
    );
  }
}
