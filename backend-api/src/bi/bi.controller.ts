import { Body, Controller, Get, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BiService } from './bi.service';
@UseGuards(JwtAuthGuard)
@Controller('bi')
export class BiController {
  constructor(private readonly bi: BiService) {}
  private actor(req: any) {
    return req.user.accessKeyData.id;
  }
  private success(data: any) {
    return { status: 'SUCCESS', data };
  }
  @Get('sources') async sources(@Req() req) {
    return this.success(await this.bi.sources(this.actor(req)));
  }
  @Get('sources/:id/profile') async profile(@Param('id') id: string, @Req() req) {
    return this.success(await this.bi.profile(id, this.actor(req)));
  }
  @Get('metrics') async metrics(@Query('sourceId') sourceId: string, @Req() req) {
    return this.success(await this.bi.metrics(sourceId, this.actor(req)));
  }
  @Post('metrics') async createMetric(@Body() body: any, @Req() req) {
    return this.success(await this.bi.createMetric(body, this.actor(req)));
  }
  @Post('formulas/preview') async previewFormula(@Body() body: any, @Req() req) {
    return this.success(await this.bi.previewFormula(body, this.actor(req)));
  }
  @Post('preview') async preview(@Body() body: any, @Req() req) {
    return this.success(await this.bi.preview(body, this.actor(req)));
  }
  @Post('dashboards') async save(@Body() body: any, @Req() req) {
    return this.success(await this.bi.save(body, this.actor(req)));
  }
  @Get('dashboards/:id/editor') async editor(@Param('id') id: string, @Req() req) {
    return this.success(await this.bi.editor(id, this.actor(req)));
  }
  @Post('dashboards/:id/editor/preview') async editorPreview(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req,
  ) {
    return this.success(await this.bi.editorPreview(id, body, this.actor(req)));
  }
  @Post('dashboards/:id/editor/ai') async editorAi(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req,
    @Res({ passthrough: true }) res,
  ) {
    const controller = new AbortController();
    const aborted = () => controller.abort();
    const closed = () => {
      if (!res.writableFinished) controller.abort();
    };
    req.once('aborted', aborted);
    res.once('close', closed);
    if (req.aborted) controller.abort();
    try {
      return this.success(await this.bi.editorAi(id, body, this.actor(req), controller.signal));
    } finally {
      req.off('aborted', aborted);
      res.off('close', closed);
    }
  }
  @Post('dashboards/:id/editor') async saveEditor(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req,
  ) {
    return this.success(await this.bi.saveEditor(id, body, this.actor(req)));
  }
}
