import { SemanticCreationService } from './semantic-creation.service';
import { Body, Controller, Header, Post, Req, Res, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SemanticProposalService } from './semantic-proposal.service';

@UseGuards(JwtAuthGuard)
@Controller('bi/analysis-proposals')
export class SemanticProposalController {
  constructor(
    private readonly service: SemanticProposalService,
    private readonly creation: SemanticCreationService,
  ) {}
  @Header('Cache-Control', 'no-store')
  @Post()
  async propose(@Body() body: any, @Req() req, @Res({ passthrough: true }) res) {
    const controller = new AbortController();
    const abort = () => controller.abort();
    const close = () => {
      if (!res.writableFinished) controller.abort();
    };
    req.once('aborted', abort);
    res.once('close', close);
    if (req.aborted) abort();
    try {
      return {
        status: 'SUCCESS',
        data: await this.service.propose(
          body,
          req.user.accessKeyData.id,
          controller.signal,
          req.user.accessKeyData.authVersion ?? 0,
        ),
      };
    } finally {
      req.off('aborted', abort);
      res.off('close', close);
    }
  }
  @Header('Cache-Control', 'no-store')
  @Post('save')
  async save(@Body() body: any, @Req() req) {
    return {
      status: 'SUCCESS',
      data: await this.creation.save(
        body,
        req.user.accessKeyData.id,
        req.user.accessKeyData.authVersion ?? 0,
      ),
    };
  }
  @Header('Cache-Control', 'no-store')
  @Post('question')
  async question(@Body() body: any, @Req() req, @Res({ passthrough: true }) res) {
    const controller = new AbortController();
    const abort = () => controller.abort();
    const close = () => {
      if (!res.writableFinished) controller.abort();
    };
    req.once('aborted', abort);
    res.once('close', close);
    if (req.aborted) abort();
    try {
      return {
        status: 'SUCCESS',
        data: await this.service.question(
          body,
          req.user.accessKeyData.id,
          controller.signal,
          req.user.accessKeyData.authVersion ?? 0,
        ),
      };
    } finally {
      req.off('aborted', abort);
      res.off('close', close);
    }
  }
  @Header('Cache-Control', 'no-store')
  @Post('preview')
  async preview(@Body() body: any, @Req() req) {
    return {
      status: 'SUCCESS',
      data: await this.service.preview(
        body,
        req.user.accessKeyData.id,
        req.user.accessKeyData.authVersion ?? 0,
      ),
    };
  }
}
