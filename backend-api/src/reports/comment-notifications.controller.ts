import { Body, Controller, Get, Header, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CommentNotificationService } from './comment-notification.service';
import { ReportActor } from './report-contract';

type ActorRequest = { user: { accessKeyData: ReportActor } };
/** The signed-in user's in-app comment notifications. */
@UseGuards(JwtAuthGuard)
@Controller('comment-notifications')
export class CommentNotificationsController {
  constructor(private readonly notifications: CommentNotificationService) {}
  @Get()
  @Header('Cache-Control', 'no-store')
  list(@Query('after') after: string | undefined, @Req() req: ActorRequest) {
    return this.notifications.list(req.user.accessKeyData, after || undefined);
  }
  @Get('unread-count')
  @Header('Cache-Control', 'no-store')
  unreadCount(@Req() req: ActorRequest) {
    return this.notifications.unreadCount(req.user.accessKeyData);
  }
  @Post('read')
  @Header('Cache-Control', 'no-store')
  markRead(@Body() body: unknown, @Req() req: ActorRequest) {
    return this.notifications.markRead(req.user.accessKeyData, body);
  }
}
