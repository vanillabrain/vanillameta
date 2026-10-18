import { Body, Controller, Get, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ConditionReportService } from './condition-report.service';
@UseGuards(JwtAuthGuard)
@Controller('bi/organizations/:orgId/dashboards/:dashboardId/reports')
export class ConditionReportController {
  constructor(private readonly reports: ConditionReportService) {}
  private actor(req: any) {
    return req.user?.accessKeyData?.id;
  }
  private result(res: any, data: unknown) {
    res.setHeader('Cache-Control', 'no-store');
    return { status: 'SUCCESS', data };
  }
  @Get() async list(
    @Param('orgId') org: string,
    @Param('dashboardId') dashboard: string,
    @Req() req,
    @Res({ passthrough: true }) res,
  ) {
    return this.result(
      res,
      await this.reports.list(Number(org), Number(dashboard), this.actor(req)),
    );
  }
  @Post() async create(
    @Param('orgId') org: string,
    @Param('dashboardId') dashboard: string,
    @Body() body: any,
    @Req() req,
    @Res({ passthrough: true }) res,
  ) {
    return this.result(
      res,
      await this.reports.create(Number(org), Number(dashboard), body, this.actor(req)),
    );
  }
  @Post(':id/stop') async stop(
    @Param('orgId') org: string,
    @Param('dashboardId') dashboard: string,
    @Param('id') id: string,
    @Body() body: any,
    @Req() req,
    @Res({ passthrough: true }) res,
  ) {
    return this.result(
      res,
      await this.reports.stop(Number(org), Number(dashboard), id, body, this.actor(req)),
    );
  }
  @Post(':id/evaluate') async evaluate(
    @Param('orgId') org: string,
    @Param('dashboardId') dashboard: string,
    @Param('id') id: string,
    @Body() body: any,
    @Req() req,
    @Res({ passthrough: true }) res,
  ) {
    return this.result(
      res,
      await this.reports.evaluate(Number(org), Number(dashboard), id, body, this.actor(req)),
    );
  }
}
