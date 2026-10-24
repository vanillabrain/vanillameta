import { UserThrottle, UserThrottleGuard } from '../common/throttle/user-throttle.guard';
import { Body, Controller, Post, Req, Res, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StudioRunService } from './studio-run.service';
@UseGuards(JwtAuthGuard, UserThrottleGuard)
@UserThrottle('ai')
@Controller('studio/runs')
export class StudioRunController {
  constructor(private readonly runs: StudioRunService) {}
  @Post() async run(@Body() body: any, @Req() req, @Res({ passthrough: true }) res) {
    const controller = new AbortController();
    const abort = () => controller.abort();
    const close = () => {
      if (!res.writableFinished) abort();
    };
    req.once('aborted', abort);
    res.once('close', close);
    if (req.aborted) abort();
    try {
      return await this.runs.run(body, req.user?.accessKeyData?.id, controller.signal);
    } finally {
      req.off('aborted', abort);
      res.off('close', close);
    }
  }
}
