import { Body, Controller, Get, Header, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ReportActor } from '../reports/report-contract';
import { DashboardCommentService } from './dashboard-comment.service';

type DashboardRequest = { user: { accessKeyData: ReportActor } };
/** Comments on a whole dashboard or one chart (read access writes, edit access manages). */
@UseGuards(JwtAuthGuard)
@Controller('dashboards')
export class DashboardCommentsController {
  constructor(private readonly comments: DashboardCommentService) {}
  @Get(':id/comments')
  @Header('Cache-Control', 'no-store')
  list(@Param('id') id: string, @Req() req: DashboardRequest) {
    return this.comments.list(id, req.user.accessKeyData);
  }
  @Post(':id/comments')
  @Header('Cache-Control', 'no-store')
  createThread(@Param('id') id: string, @Body() body: unknown, @Req() req: DashboardRequest) {
    return this.comments.createThread(id, body, req.user.accessKeyData);
  }
  @Post(':id/comments/:threadId/replies')
  @Header('Cache-Control', 'no-store')
  reply(
    @Param('id') id: string,
    @Param('threadId') threadId: string,
    @Body() body: unknown,
    @Req() req: DashboardRequest,
  ) {
    return this.comments.reply(id, threadId, body, req.user.accessKeyData);
  }
  @Post(':id/comments/:threadId/status')
  @Header('Cache-Control', 'no-store')
  setStatus(
    @Param('id') id: string,
    @Param('threadId') threadId: string,
    @Body() body: unknown,
    @Req() req: DashboardRequest,
  ) {
    return this.comments.setThreadStatus(id, threadId, body, req.user.accessKeyData);
  }
}
