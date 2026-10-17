import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SourceCatalogService } from './source-catalog.service';
@UseGuards(JwtAuthGuard)
@Controller('bi/source-catalog')
export class SourceCatalogController {
  constructor(private readonly catalog: SourceCatalogService) {}
  @Post('read') async read(@Body() body: unknown, @Req() req) {
    return { status: 'SUCCESS', data: await this.catalog.read(body, req.user.accessKeyData.id) };
  }
  @Post('save') async save(@Body() body: unknown, @Req() req) {
    return { status: 'SUCCESS', data: await this.catalog.save(body, req.user.accessKeyData.id) };
  }
}
