import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { ShareUrlService } from './share-url.service';
import { CreateShareUrlDto } from './dto/create-share-url.dto';
import { UpdateShareUrlDto } from './dto/update-share-url.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@Controller('share-url')
export class ShareUrlController {
  constructor(private readonly shareUrlService: ShareUrlService) {}

  @UseGuards(JwtAuthGuard)
  @Post('share-on/:dashboard_id')
  checkShareUrlOn(@Req() req, @Param() params, @Body() body) {
    const { user_id } = body;
    const { authorization } = req.headers;
    const { dashboard_id } = params;
    return this.shareUrlService.checkShareUrlOn( authorization, dashboard_id, user_id )
  }

  @UseGuards(JwtAuthGuard)
  @Post('share-off/:dashboard_id')
  checkShareUrlOff(@Req() req, @Param() params, @Body() body) {
    const { user_id } = body;
    const { authorization } = req.headers;
    const { dashboard_id } = params;
    return this.shareUrlService.checkShareUrlOff( authorization, dashboard_id, user_id )
  }

  @Get('share-dashboard/:shareUrl')
  async shareDashboardInfo(@Param() param) {
    const { shareUrl } = param;
    return await this.shareUrlService.shareDashboardInfo(shareUrl)
  }
}
