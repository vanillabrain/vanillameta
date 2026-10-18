import { SourceCatalogUsageService } from './source-catalog-usage.service';
import { Body, Controller, Header, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SourceCatalogService } from './source-catalog.service';
@UseGuards(JwtAuthGuard)
@Controller('bi/source-catalog')
export class SourceCatalogController {
  constructor(
    private readonly catalog: SourceCatalogService,
    private readonly usageService: SourceCatalogUsageService,
  ) {}
  @Header('Cache-Control', 'no-store')
  @Post('read')
  async read(@Body() body: unknown, @Req() req) {
    return {
      status: 'SUCCESS',
      data: await this.catalog.read(
        body,
        req.user.accessKeyData.id,
        req.user.accessKeyData.authVersion ?? 0,
      ),
    };
  }
  @Header('Cache-Control', 'no-store')
  @Post('save')
  async save(@Body() body: unknown, @Req() req) {
    return {
      status: 'SUCCESS',
      data: await this.catalog.save(
        body,
        req.user.accessKeyData.id,
        req.user.accessKeyData.authVersion ?? 0,
      ),
    };
  }
  @Header('Cache-Control', 'no-store')
  @Post('history')
  async history(@Body() body: unknown, @Req() req) {
    return {
      status: 'SUCCESS',
      data: await this.catalog.history(
        body,
        req.user.accessKeyData.id,
        req.user.accessKeyData.authVersion ?? 0,
      ),
    };
  }
  @Header('Cache-Control', 'no-store')
  @Post('compare')
  async compare(@Body() body: unknown, @Req() req) {
    return {
      status: 'SUCCESS',
      data: await this.catalog.compare(
        body,
        req.user.accessKeyData.id,
        req.user.accessKeyData.authVersion ?? 0,
      ),
    };
  }
  @Header('Cache-Control', 'no-store')
  @Post('preview')
  async preview(@Body() body: unknown, @Req() req) {
    return {
      status: 'SUCCESS',
      data: await this.catalog.preview(
        body,
        req.user.accessKeyData.id,
        req.user.accessKeyData.authVersion ?? 0,
      ),
    };
  }
  @Header('Cache-Control', 'no-store')
  @Post('usage')
  async usage(@Body() body: unknown, @Req() req) {
    return {
      status: 'SUCCESS',
      data: await this.usageService.list(body, req.user.accessKeyData.id),
    };
  }
}
