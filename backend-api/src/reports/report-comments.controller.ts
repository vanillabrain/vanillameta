import { Body, Controller, Get, Header, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ReportCommentService } from './report-comment.service';
import { ReportActor } from './report-contract';

type ReportRequest = { user: { accessKeyData: ReportActor } };
/** Comments and suggested edits on private reports (owner and current recipients). */
@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportCommentsController {
  constructor(private readonly comments: ReportCommentService) {}
  @Get(':id/comments')
  @Header('Cache-Control', 'no-store')
  list(@Param('id') id: string, @Req() req: ReportRequest) {
    return this.comments.list(id, req.user.accessKeyData);
  }
  @Post(':id/comments')
  @Header('Cache-Control', 'no-store')
  createThread(@Param('id') id: string, @Body() body: unknown, @Req() req: ReportRequest) {
    return this.comments.createThread(id, body, req.user.accessKeyData);
  }
  @Post(':id/comments/:threadId/replies')
  @Header('Cache-Control', 'no-store')
  reply(
    @Param('id') id: string,
    @Param('threadId') threadId: string,
    @Body() body: unknown,
    @Req() req: ReportRequest,
  ) {
    return this.comments.reply(id, threadId, body, req.user.accessKeyData);
  }
  @Post(':id/comments/:threadId/status')
  @Header('Cache-Control', 'no-store')
  setStatus(
    @Param('id') id: string,
    @Param('threadId') threadId: string,
    @Body() body: unknown,
    @Req() req: ReportRequest,
  ) {
    return this.comments.setThreadStatus(id, threadId, body, req.user.accessKeyData);
  }
  @Post(':id/comments/:threadId/visibility')
  @Header('Cache-Control', 'no-store')
  setVisibility(
    @Param('id') id: string,
    @Param('threadId') threadId: string,
    @Body() body: unknown,
    @Req() req: ReportRequest,
  ) {
    return this.comments.setThreadVisibility(id, threadId, body, req.user.accessKeyData);
  }
  @Post(':id/suggestions')
  @Header('Cache-Control', 'no-store')
  createSuggestion(@Param('id') id: string, @Body() body: unknown, @Req() req: ReportRequest) {
    return this.comments.createSuggestion(id, body, req.user.accessKeyData);
  }
  @Post(':id/suggestions/:suggestionId/dismiss')
  @Header('Cache-Control', 'no-store')
  dismiss(
    @Param('id') id: string,
    @Param('suggestionId') suggestionId: string,
    @Body() body: unknown,
    @Req() req: ReportRequest,
  ) {
    return this.comments.dismissSuggestion(id, suggestionId, body, req.user.accessKeyData);
  }
}
