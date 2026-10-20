import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ExportJobsService } from './export-jobs.service';
@UseGuards(JwtAuthGuard)
@Controller('bi/export-jobs')
export class ExportJobsController {
  constructor(private readonly jobs: ExportJobsService) {}
  private id(raw: unknown) {
    if (typeof raw !== 'string' || !/^[1-9][0-9]*$/.test(raw) || !Number.isSafeInteger(Number(raw)))
      throw new BadRequestException('작업 번호를 확인해 주세요.');
    return Number(raw);
  }
  @Post() @Header('Cache-Control', 'no-store') create(@Body() body: unknown, @Req() req: any) {
    return this.jobs.create(
      body,
      req.user.accessKeyData.id,
      req.user.accessKeyData.authVersion ?? 0,
    );
  }
  @Get() @Header('Cache-Control', 'no-store') list(
    @Query('beforeId') before: unknown,
    @Req() req: any,
  ) {
    return this.jobs.list(
      req.user.accessKeyData.id,
      before === undefined ? undefined : this.id(before),
      req.user.accessKeyData.authVersion ?? 0,
    );
  }
  @Get(':id') @Header('Cache-Control', 'no-store') get(@Param('id') id: string, @Req() req: any) {
    return this.jobs.get(
      this.id(id),
      req.user.accessKeyData.id,
      req.user.accessKeyData.authVersion ?? 0,
    );
  }
  @Post(':id/run') @Header('Cache-Control', 'no-store') run(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: any,
  ) {
    return this.jobs.run(
      this.id(id),
      body,
      req.user.accessKeyData.id,
      true,
      req.user.accessKeyData.authVersion ?? 0,
    );
  }
  @Post(':id/cancel') @Header('Cache-Control', 'no-store') cancel(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: any,
  ) {
    return this.jobs.cancel(
      this.id(id),
      body,
      req.user.accessKeyData.id,
      req.user.accessKeyData.authVersion ?? 0,
    );
  }
  @Get(':id/file') @Header('Cache-Control', 'no-store') file(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    return this.jobs.file(
      this.id(id),
      req.user.accessKeyData.id,
      req.user.accessKeyData.authVersion ?? 0,
    );
  }
}
