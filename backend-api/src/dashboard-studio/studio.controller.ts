import { Body, Controller, Get, Param, ParseIntPipe, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StudioService } from './studio.service';
@UseGuards(JwtAuthGuard)
@Controller('studio/dashboards')
export class StudioController {
  constructor(private readonly studio: StudioService) {}
  @Get(':id') get(@Param('id', ParseIntPipe) id: number, @Req() req) {
    return this.studio.get(id, req.user?.accessKeyData?.id);
  }
  @Post(':id/save') save(@Param('id', ParseIntPipe) id: number, @Body() body: any, @Req() req) {
    return this.studio.save(id, body, req.user?.accessKeyData?.id);
  }
}
