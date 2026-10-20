import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BiSegmentService } from './bi-segment.service';

@UseGuards(JwtAuthGuard)
@Controller('bi/explore')
export class BiSegmentController {
  constructor(private readonly segment: BiSegmentService) {}
  private actor(req: any) {
    return req.user.accessKeyData.id;
  }
  private success(data: any) {
    return { status: 'SUCCESS', data };
  }
  @Post('segments') async segments(@Body() body: any, @Req() req) {
    return this.success(await this.segment.segments(body, this.actor(req)));
  }
  @Post('segments/details') async details(@Body() body: any, @Req() req) {
    return this.success(await this.segment.details(body, this.actor(req)));
  }
  @Post('segments/export') async exportCsv(@Body() body: any, @Req() req) {
    return this.success(await this.segment.exportCsv(body, this.actor(req)));
  }
}
