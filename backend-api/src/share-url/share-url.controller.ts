import { Controller, Get, Post, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ShareUrlService } from './share-url.service';
import { ShareUrlOnDto } from './dto/create-share-url.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

@Controller('share-url')
@ApiTags('url공유화 API')
export class ShareUrlController {
  constructor(private readonly shareUrlService: ShareUrlService) {}

  @UseGuards(JwtAuthGuard)
  @Post('share-on/:dashboardId')
  @ApiOperation({ summary: '공유 url On' })
  @ApiBearerAuth('AccessKey')
  checkShareUrlOn(@Req() req, @Param() params, @Body() shareUrlOnDto: ShareUrlOnDto) {
    const { userId } = req.user.accessKeyData;
    const { dashboardId } = params;
    return this.shareUrlService.checkShareUrlOn(userId, dashboardId, shareUrlOnDto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('share-off/:dashboardId')
  @ApiOperation({ summary: '공유 url Off' })
  @ApiBearerAuth('AccessKey')
  checkShareUrlOff(@Req() req, @Param() params, @Body() shareUrlOnDto: ShareUrlOnDto) {
    const { userId } = req.user.accessKeyData;
    const { dashboardId } = params;
    return this.shareUrlService.checkShareUrlOff(userId, dashboardId);
  }

  @Get('share-dashboard/:uuid')
  @ApiOperation({ summary: '공유 url 접속' })
  async shareDashboardInfo(@Param() param) {
    const { uuid } = param;
    return await this.shareUrlService.shareDashboardInfo(uuid);
  }
}
