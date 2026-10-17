import { SourceCatalogUsageService } from './source-catalog-usage.service';
import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SourceCatalogService } from './source-catalog.service';
@UseGuards(JwtAuthGuard)
@Controller('bi/source-catalog')
export class SourceCatalogController {
  constructor(
    private readonly catalog: SourceCatalogService,
    private readonly usageService: SourceCatalogUsageService,
  ) {}
  @Post('read') async read(@Body() body: unknown, @Req() req) {
    return { status: 'SUCCESS', data: await this.catalog.read(body, req.user.accessKeyData.id) };
  }
  @Post('save') async save(@Body() body: unknown, @Req() req) {
    return { status: 'SUCCESS', data: await this.catalog.save(body, req.user.accessKeyData.id) };
  }
  @Post('history') async history(@Body() body: unknown, @Req() req) {
    return { status: 'SUCCESS', data: await this.catalog.history(body, req.user.accessKeyData.id) };
  }
  @Post('compare') async compare(@Body() body: unknown, @Req() req) {
    return { status: 'SUCCESS', data: await this.catalog.compare(body, req.user.accessKeyData.id) };
  }
  @Post('preview') async preview(@Body() body: unknown, @Req() req) {
    return { status: 'SUCCESS', data: await this.catalog.preview(body, req.user.accessKeyData.id) };
  }
  @Post('usage') async usage(@Body() body: unknown, @Req() req) {
    return {
      status: 'SUCCESS',
      data: await this.usageService.list(body, req.user.accessKeyData.id),
    };
  }
}
