import { UserThrottle, UserThrottleGuard } from '../common/throttle/user-throttle.guard';
import { Body, Controller, Get, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StudioSampleService } from './studio-sample.service';
import { StudioCreationService } from './studio-creation.service';
@UseGuards(JwtAuthGuard, UserThrottleGuard)
@Controller('studio')
export class StudioCreationController {
  constructor(
    private readonly creation: StudioCreationService,
    private readonly samples: StudioSampleService,
  ) {}
  @Post('samples') sample(@Body() body: any, @Req() req) {
    return this.samples.sample(body, req.user?.accessKeyData?.id);
  }
  @UserThrottle('ai')
  @Post('proposals')
  async propose(@Body() body: any, @Req() req, @Res({ passthrough: true }) res) {
    const controller = new AbortController();
    const abort = () => controller.abort();
    const close = () => {
      if (!res.writableFinished) abort();
    };
    req.once('aborted', abort);
    res.once('close', close);
    if (req.aborted) abort();
    try {
      return await this.creation.propose(
        body,
        req.user?.accessKeyData?.id,
        controller.signal,
        req.user?.accessKeyData?.authVersion ?? 0,
      );
    } finally {
      req.off('aborted', abort);
      res.off('close', close);
    }
  }
  @Get('proposals/:id') proposal(
    @Param('id') id: string,
    @Query('sourceId') sourceId: string,
    @Req() req,
  ) {
    return this.creation.proposal(id, Number(sourceId), req.user?.accessKeyData?.id);
  }
  @Post('dashboards') create(@Body() body: any, @Req() req) {
    return this.creation.create(
      body,
      req.user?.accessKeyData?.id,
      req.user?.accessKeyData?.authVersion ?? 0,
    );
  }
}
