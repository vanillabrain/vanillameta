import { UserThrottle, UserThrottleGuard } from '../common/throttle/user-throttle.guard';
import { Body, Controller, Get, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StudioSampleService } from './studio-sample.service';
import { StudioCreationService } from './studio-creation.service';
import { serveRun } from '../common/ndjson-stream';
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
  propose(@Body() body: any, @Req() req, @Res({ passthrough: true }) res) {
    return serveRun(req, res, signal =>
      this.creation.propose(
        body,
        req.user?.accessKeyData?.id,
        signal,
        req.user?.accessKeyData?.authVersion ?? 0,
      ),
    );
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
