import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DashboardPivotService } from './dashboard-pivot.service';
@UseGuards(JwtAuthGuard)
@Controller('bi/dashboard/:dashboardId/pivots')
export class DashboardPivotController {
  constructor(private readonly pivots: DashboardPivotService) {}
  @Get() list(@Param('dashboardId') id: string, @Req() req: any) {
    return this.pivots.list(id, req.user.accessKeyData.id);
  }
  @Post() add(@Param('dashboardId') id: string, @Body() body: any, @Req() req: any) {
    return this.pivots.add(id, req.user.accessKeyData.id, body);
  }
  @Delete(':pivotId') remove(
    @Param('dashboardId') id: string,
    @Param('pivotId') pivotId: string,
    @Req() req: any,
  ) {
    return this.pivots.remove(id, pivotId, req.user.accessKeyData.id);
  }
}
