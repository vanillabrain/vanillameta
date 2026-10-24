import { UserThrottle, UserThrottleGuard } from '../common/throttle/user-throttle.guard';
import { Body, Controller, Post, Req, Res, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StudioRunService } from './studio-run.service';
import { requestEpoch } from '../ai/ai-caller';
@UseGuards(JwtAuthGuard, UserThrottleGuard)
@Controller('studio/runs')
export class StudioRunController {
  constructor(private readonly runs: StudioRunService) {}
  @UserThrottle('ai')
  @Post()
  async run(@Body() body: any, @Req() req, @Res({ passthrough: true }) res) {
    const controller = new AbortController();
    const abort = () => controller.abort();
    const close = () => {
      if (!res.writableFinished) abort();
    };
    req.once('aborted', abort);
    res.once('close', close);
    if (req.aborted) abort();
    try {
      return await this.runs.run(
        body,
        req.user?.accessKeyData?.id,
        controller.signal,
        requestEpoch(req),
      );
    } finally {
      req.off('aborted', abort);
      res.off('close', close);
    }
  }
}
