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
import { ReportSharingService } from './report-sharing.service';
import { ReportsService } from './reports.service';
import { ReportActor } from './report-contract';

type ReportRequest = { user: { accessKeyData: ReportActor } };
@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly sharing: ReportSharingService,
  ) {}
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
  @Get('library')
  library(@Req() req: ReportRequest, @Query('afterId') afterId?: string) {
    return this.sharing.library(req.user.accessKeyData, afterId);
  }
  @Get(':id/reader')
  reader(@Param('id') id: string, @Req() req: ReportRequest) {
    return this.sharing.reader(id, req.user.accessKeyData);
  }
  @Get(':id/peers')
  peers(@Param('id') id: string, @Query() query: unknown, @Req() req: ReportRequest) {
    return this.sharing.peers(id, req.user.accessKeyData, query);
  }
  @Get(':id/shares')
  shares(@Param('id') id: string, @Req() req: ReportRequest, @Query('afterId') afterId?: string) {
    return this.sharing.shares(id, req.user.accessKeyData, afterId);
  }
  @Post(':id/shares')
  changeShares(@Param('id') id: string, @Body() body: unknown, @Req() req: ReportRequest) {
    return this.sharing.change(id, body, req.user.accessKeyData);
  }
  @Get(':id/shares/outcome/:requestId')
  shareOutcome(
    @Param('id') id: string,
    @Param('requestId') requestId: string,
    @Req() req: ReportRequest,
  ) {
    return this.sharing.outcome(id, requestId, req.user.accessKeyData);
  }
  @Get(':id')
  @Header('Cache-Control', 'no-store')
  get(@Param('id') id: string, @Req() req: ReportRequest, @Query('version') version?: string) {
    return this.reports.get(
      id,
      req.user.accessKeyData,
      version === undefined ? undefined : Number(version),
    );
  }
  @Get(':id/versions')
  @Header('Cache-Control', 'no-store')
  versions(@Param('id') id: string, @Req() req: ReportRequest) {
    return this.reports.versions(id, req.user.accessKeyData);
  }
  @Post(':id/suggest')
  @Header('Cache-Control', 'no-store')
  suggest(@Param('id') id: string, @Body() body: unknown, @Req() req: ReportRequest) {
    return this.reports.suggest(id, body, req.user.accessKeyData);
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
