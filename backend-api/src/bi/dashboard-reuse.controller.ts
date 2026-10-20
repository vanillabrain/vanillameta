import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DashboardReuseService } from './dashboard-reuse.service';
@UseGuards(JwtAuthGuard)
@Controller('bi/dashboards/:id/reuse')
export class DashboardReuseController {
  constructor(private readonly reuse: DashboardReuseService) {}
  @Get() async draft(@Param('id') id: string, @Req() req: any) {
    return {
      status: 'SUCCESS',
      data: await this.reuse.draft(
        id,
        req.user.accessKeyData.id,
        'owned',
        req.user.accessKeyData.authVersion ?? 0,
      ),
    };
  }
  @Post('preview') async preview(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return {
      status: 'SUCCESS',
      data: await this.reuse.preview(
        id,
        body,
        req.user.accessKeyData.id,
        'owned',
        req.user.accessKeyData.authVersion ?? 0,
      ),
    };
  }
  @Post() async save(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return {
      status: 'SUCCESS',
      data: await this.reuse.save(
        id,
        body,
        req.user.accessKeyData.id,
        'owned',
        req.user.accessKeyData.authVersion ?? 0,
      ),
    };
  }
}
