import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ReportsService } from './reports.service';
import { ReportActor } from './report-contract';

type ReportRequest = { user: { accessKeyData: ReportActor } };
@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}
  @Get()
  @Header('Cache-Control', 'no-store')
  list(@Req() req: ReportRequest) {
    return this.reports.list(req.user.accessKeyData);
  }
  @Get('roots/:dashboardId')
  @Header('Cache-Control', 'no-store')
  root(@Param('dashboardId', ParseIntPipe) id: number, @Req() req: ReportRequest) {
    return this.reports.rootOptions(id, req.user.accessKeyData);
  }
  @Get(':id')
  @Header('Cache-Control', 'no-store')
  get(@Param('id') id: string, @Req() req: ReportRequest) {
    return this.reports.get(id, req.user.accessKeyData);
  }
  @Get(':id/outcome/:requestId')
  @Header('Cache-Control', 'no-store')
  outcome(
    @Param('id') id: string,
    @Param('requestId') requestId: string,
    @Query('dashboardId', ParseIntPipe) dashboardId: number,
    @Req() req: ReportRequest,
  ) {
    return this.reports.outcome(id, requestId, dashboardId, req.user.accessKeyData);
  }
  @Post(':id/preview')
  @Header('Cache-Control', 'no-store')
  preview(@Param('id') id: string, @Body() body: unknown, @Req() req: ReportRequest) {
    return this.reports.preview(id, body, req.user.accessKeyData);
  }
  @Post(':id/save')
  @Header('Cache-Control', 'no-store')
  save(@Param('id') id: string, @Body() body: unknown, @Req() req: ReportRequest) {
    return this.reports.save(id, body, req.user.accessKeyData);
  }
}
