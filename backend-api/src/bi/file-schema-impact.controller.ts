import { UserThrottle, UserThrottleGuard } from '../common/throttle/user-throttle.guard';
import { Body, Controller, Get, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FileSchemaImpactService } from './file-schema-impact.service';
import { FileSchemaDiagnosisService } from './file-schema-diagnosis.service';
import { requestEpoch } from '../ai/ai-caller';
@UseGuards(JwtAuthGuard, UserThrottleGuard)
@Controller('bi/sources/:id/file-refreshes/:requestId/impact')
export class FileSchemaImpactController {
  constructor(
    private readonly impacts: FileSchemaImpactService,
    private readonly diagnosis: FileSchemaDiagnosisService,
  ) {}
  @UserThrottle('ai')
  @Post('diagnosis')
  async diagnose(
    @Param('id') id: string,
    @Param('requestId') requestId: string,
    @Body() body: any,
    @Req() req: any,
    @Res({ passthrough: true }) res,
  ) {
    const controller = new AbortController();
    const abort = () => controller.abort();
    const close = () => {
      if (!res.writableFinished) abort();
    };
    req.once('aborted', abort);
    res.once('close', close);
    if (req.aborted) abort();
    try {
      return {
        status: 'SUCCESS',
        data: await this.diagnosis.diagnose(
          Number(id),
          requestId,
          body,
          req.user.accessKeyData.id,
          controller.signal,
          requestEpoch(req),
        ),
      };
    } finally {
      req.off('aborted', abort);
      res.off('close', close);
    }
  }
  @Get() async inspect(
    @Param('id') id: string,
    @Param('requestId') requestId: string,
    @Req() req: any,
  ) {
    return {
      status: 'SUCCESS',
      data: await this.impacts.inspect(id, requestId, req.user.accessKeyData.id),
    };
  }
}
