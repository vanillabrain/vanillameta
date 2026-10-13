import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BiExploreService } from './bi-explore.service';

@UseGuards(JwtAuthGuard)
@Controller('bi/explore')
export class BiExploreController {
  constructor(private readonly explore: BiExploreService) {}
  private actor(req: any) {
    return req.user.accessKeyData.id;
  }
  private success(data: any) {
    return { status: 'SUCCESS', data };
  }
  @Post('catalog') async catalog(@Body() body: any, @Req() req) {
    return this.success(await this.explore.catalog(body, this.actor(req)));
  }
  @Post('query') async query(@Body() body: any, @Req() req) {
    return this.success(await this.explore.query(body, this.actor(req)));
  }
  @Post('values') async values(@Body() body: any, @Req() req) {
    return this.success(await this.explore.values(body, this.actor(req)));
  }
}
