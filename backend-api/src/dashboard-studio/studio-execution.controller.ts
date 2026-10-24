import { UserThrottle, UserThrottleGuard } from '../common/throttle/user-throttle.guard';
import { Body, Controller, Get, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StudioExecutionService } from './studio-execution.service';
import { requestEpoch } from '../ai/ai-caller';
import { serveRun } from '../common/ndjson-stream';
@UseGuards(JwtAuthGuard, UserThrottleGuard)
@Controller('studio')
export class StudioExecutionController {
  constructor(private readonly executions: StudioExecutionService) {}
  @UserThrottle('ai')
  @Post('executions')
  create(@Body() body: any, @Req() req, @Res({ passthrough: true }) res) {
    const actor = req.user?.accessKeyData?.id;
    return serveRun(
      req,
      res,
      signal =>
        this.executions.create(body, actor, signal, req.user?.accessKeyData?.authVersion ?? 0),
      { watch: emit => this.executions.watch(`req:${actor}:${body?.requestId}`, emit) },
    );
  }
  @Get('runs')
  list(@Query('dashboardId') dashboardId: string, @Req() req) {
    return this.executions.list(Number(dashboardId), req.user?.accessKeyData?.id);
  }
  @Get('runs/:id')
  get(@Param('id') id: string, @Req() req) {
    return this.executions.get(id, req.user?.accessKeyData?.id);
  }
  @UserThrottle('ai')
  @Post('runs/:id/retry')
  retry(@Param('id') id: string, @Body() body: any, @Req() req, @Res({ passthrough: true }) res) {
    return serveRun(
      req,
      res,
      signal =>
        this.executions.retry(id, body, req.user?.accessKeyData?.id, signal, requestEpoch(req)),
      { watch: emit => this.executions.watch(`run:${id}`, emit) },
    );
  }
  @Post('runs/:id/cancel')
  cancel(@Param('id') id: string, @Req() req) {
    return this.executions.cancel(id, req.user?.accessKeyData?.id);
  }
  @Post('runs/:id/remix')
  remix(@Param('id') id: string, @Body() body: any, @Req() req) {
    return this.executions.remix(
      id,
      body,
      req.user?.accessKeyData?.id,
      req.user?.accessKeyData?.authVersion ?? 0,
    );
  }
  @Get('runs/:id/creation')
  creationProposal(@Param('id') id: string, @Req() req) {
    return this.executions.creationProposal(id, req.user?.accessKeyData?.id);
  }
  @UserThrottle('ai')
  @Post('runs/:id/creation/message')
  creationMessage(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req,
    @Res({ passthrough: true }) res,
  ) {
    return serveRun(
      req,
      res,
      signal =>
        this.executions.creationMessage(
          id,
          body,
          req.user?.accessKeyData?.id,
          signal,
          requestEpoch(req),
        ),
      { watch: emit => this.executions.watch(`run:${id}`, emit) },
    );
  }
  @UserThrottle('ai')
  @Post('runs/:id/creation/clarify')
  clarifyCreation(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req,
    @Res({ passthrough: true }) res,
  ) {
    return serveRun(
      req,
      res,
      signal =>
        this.executions.clarifyCreation(
          id,
          body,
          req.user?.accessKeyData?.id,
          signal,
          requestEpoch(req),
        ),
      { watch: emit => this.executions.watch(`run:${id}`, emit) },
    );
  }
  @Post('runs/:id/creation')
  saveCreation(@Param('id') id: string, @Body() body: any, @Req() req) {
    return this.executions.saveCreation(id, body, req.user?.accessKeyData?.id);
  }
}
