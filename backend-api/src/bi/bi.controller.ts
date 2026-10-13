import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
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
  @Post('preview') async preview(@Body() body: any, @Req() req) {
    return this.success(await this.bi.preview(body, this.actor(req)));
  }
  @Post('dashboards') async save(@Body() body: any, @Req() req) {
    return this.success(await this.bi.save(body, this.actor(req)));
  }
}
