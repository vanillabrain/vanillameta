import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ExploreViewService } from './explore-view.service';

/** Private personal saved views for exploration, scoped to the acting source owner. */
@UseGuards(JwtAuthGuard)
@Controller('bi/explore/views')
export class BiExploreViewsController {
  constructor(private readonly views: ExploreViewService) {}
  private actor(req: any) {
    return req.user.accessKeyData.id;
  }
  @Post('list') async list(@Body() body: any, @Req() req) {
    return this.views.list(body, this.actor(req));
  }
  @Post('create') async create(@Body() body: any, @Req() req) {
    return this.views.create(body, this.actor(req));
  }
  @Post('load') async load(@Body() body: any, @Req() req) {
    return this.views.load(body, this.actor(req));
  }
  @Post('remove') async remove(@Body() body: any, @Req() req) {
    return this.views.remove(body, this.actor(req));
  }
}
