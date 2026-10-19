import { Body, Controller, Get, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StudioExecutionService } from './studio-execution.service';
@UseGuards(JwtAuthGuard)
@Controller('studio')
export class StudioExecutionController {
  constructor(private readonly executions: StudioExecutionService) {}
  @Post('executions')
  create(@Body() body: any, @Req() req, @Res({ passthrough: true }) res) {
    return this.withSignal(req, res, signal =>
      this.executions.create(
        body,
        req.user?.accessKeyData?.id,
        signal,
        req.user?.accessKeyData?.authVersion ?? 0,
      ),
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
  @Post('runs/:id/retry')
  retry(@Param('id') id: string, @Body() body: any, @Req() req, @Res({ passthrough: true }) res) {
    return this.withSignal(req, res, signal =>
      this.executions.retry(id, body, req.user?.accessKeyData?.id, signal),
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
  @Post('runs/:id/creation/message')
  creationMessage(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req,
    @Res({ passthrough: true }) res,
  ) {
    return this.withSignal(req, res, signal =>
      this.executions.creationMessage(id, body, req.user?.accessKeyData?.id, signal),
    );
  }
  @Post('runs/:id/creation/clarify')
  clarifyCreation(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req,
    @Res({ passthrough: true }) res,
  ) {
    return this.withSignal(req, res, signal =>
      this.executions.clarifyCreation(id, body, req.user?.accessKeyData?.id, signal),
    );
  }
  @Post('runs/:id/creation')
  saveCreation(@Param('id') id: string, @Body() body: any, @Req() req) {
    return this.executions.saveCreation(id, body, req.user?.accessKeyData?.id);
  }
  private async withSignal(req, res, run: (signal: AbortSignal) => Promise<any>) {
    const controller = new AbortController();
    const abort = () => controller.abort();
    const close = () => {
      if (!res.writableFinished) abort();
    };
    req.once('aborted', abort);
    res.once('close', close);
    if (req.aborted) abort();
    try {
      return await run(controller.signal);
    } finally {
      req.off('aborted', abort);
      res.off('close', close);
    }
  }
}
