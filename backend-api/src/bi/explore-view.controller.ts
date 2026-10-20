import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ExploreViewService } from './explore-view.service';
@UseGuards(JwtAuthGuard)
@Controller('bi/explore/:sourceId/views')
export class ExploreViewController {
  constructor(private readonly views: ExploreViewService) {}
  @Get() list(@Param('sourceId') source: string, @Req() req: any) {
    return this.views.list(source, req.user.accessKeyData.id);
  }
  @Post() create(@Param('sourceId') source: string, @Body() body: any, @Req() req: any) {
    return this.views.create(source, req.user.accessKeyData.id, body);
  }
  @Get(':viewId') load(
    @Param('sourceId') source: string,
    @Param('viewId') view: string,
    @Req() req: any,
  ) {
    return this.views.load(source, view, req.user.accessKeyData.id);
  }
  @Delete(':viewId') remove(
    @Param('sourceId') source: string,
    @Param('viewId') view: string,
    @Req() req: any,
  ) {
    return this.views.remove(source, view, req.user.accessKeyData.id);
  }
}
