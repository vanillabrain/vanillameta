import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { ShareUrlService } from './share-url.service';
import { ShareUrlOnDto } from './dto/create-share-url.dto';
import { UpdateShareUrlDto } from './dto/update-share-url.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@Controller('share-url')
export class ShareUrlController {
  constructor(private readonly shareUrlService: ShareUrlService) {}

  @UseGuards(JwtAuthGuard)
  @Post('share-on/:dashboardId')
  checkShareUrlOn(@Req() req, @Param() params, @Body() shareUrlOnDto: ShareUrlOnDto) {
    const { authorization } = req.headers;
    const { dashboardId } = params;
    return this.shareUrlService.checkShareUrlOn( authorization, dashboardId, shareUrlOnDto )
  }

  @UseGuards(JwtAuthGuard)
  @Post('share-off/:dashboardId')
  checkShareUrlOff(@Req() req, @Param() params, @Body() shareUrlOnDto: ShareUrlOnDto) {
    const { authorization } = req.headers;
    const { dashboardId } = params;
    return this.shareUrlService.checkShareUrlOff( authorization, dashboardId, shareUrlOnDto)
  }

  @Get('share-dashboard/:uuid')
  async shareDashboardInfo(@Param() param) {
    const { shareUrl } = param;
    return await this.shareUrlService.shareDashboardInfo(shareUrl)
  }
}
