import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StudioService } from './studio.service';
@UseGuards(JwtAuthGuard)
@Controller('studio/dashboards')
export class StudioController {
  constructor(private readonly studio: StudioService) {}
  @Get(':id') get(@Param('id', ParseIntPipe) id: number, @Req() req) {
    return this.studio.get(id, req.user?.accessKeyData?.id);
  }
  @Get(':id/explore') explore(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: any,
    @Req() req,
  ) {
    return this.studio.exploreHandoff(id, query, req.user?.accessKeyData?.id);
  }
  @Post(':id/preview') preview(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: any,
    @Req() req,
  ) {
    return this.studio.prepare(id, body, req.user?.accessKeyData?.id);
  }
  @Post(':id/profile') profile(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: any,
    @Req() req,
  ) {
    return this.studio.profile(id, body, req.user?.accessKeyData?.id);
  }
  @Post(':id/save') save(@Param('id', ParseIntPipe) id: number, @Body() body: any, @Req() req) {
    return this.studio.save(id, body, req.user?.accessKeyData?.id);
  }
}
