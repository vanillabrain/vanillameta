import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BiSeriesService } from './bi-series.service';

@UseGuards(JwtAuthGuard)
@Controller('bi/explore')
export class BiSeriesController {
  constructor(private readonly series: BiSeriesService) {}
  @Post('series-values') async values(@Body() body: any, @Req() req) {
    return { status: 'SUCCESS', data: await this.series.values(body, req.user.accessKeyData.id) };
  }
  @Post('series') async compare(@Body() body: any, @Req() req) {
    return { status: 'SUCCESS', data: await this.series.compare(body, req.user.accessKeyData.id) };
  }
}
