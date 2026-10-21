import { SourceAccessService } from '../ownership/source-access.service';
import { Controller, Get, Post, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ShareUrlService } from './share-url.service';
import { ShareUrlOnDto } from './dto/create-share-url.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';

@ApiTags('공유')
@Controller('share-url')
export class ShareUrlController {
  constructor(
    private readonly shareUrlService: ShareUrlService,
    private readonly access: SourceAccessService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post('share-on/:dashboardId')
  @ApiOperation({ summary: '공유 url On' })
  @ApiBearerAuth('AccessKey')
  async checkShareUrlOn(@Req() req, @Param() params, @Body() shareUrlOnDto: ShareUrlOnDto) {
    const { userId } = req.user.accessKeyData;
    const { dashboardId } = params;
    await this.access.dashboard(dashboardId, req.user.accessKeyData.id);
    return this.shareUrlService.checkShareUrlOn(userId, +dashboardId, shareUrlOnDto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('share-off/:dashboardId')
  @ApiOperation({ summary: '공유 url Off' })
  @ApiBearerAuth('AccessKey')
  async checkShareUrlOff(@Req() req, @Param() params, @Body() shareUrlOnDto: ShareUrlOnDto) {
    const { userId } = req.user.accessKeyData;
    const { dashboardId } = params;
    await this.access.dashboardRevocation(dashboardId, req.user.accessKeyData.id);
    return this.shareUrlService.checkShareUrlOff(userId, +dashboardId);
  }

  @Get('share-dashboard/:uuid')
  @ApiOperation({
    summary: '공유 대시보드 조회',
    description: '공유 URL을 통해 대시보드를 조회합니다. 인증 없이 접근 가능합니다.',
  })
  @ApiParam({
    name: 'uuid',
    description: '공유 URL UUID',
    type: String,
    example: 'abc123-def456-ghi789',
  })
  @ApiResponse({
    status: 200,
    description: '공유 대시보드 정보가 반환되었습니다.',
    schema: {
      type: 'object',
      properties: {
        dashboard: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            title: { type: 'string' },
            description: { type: 'string' },
            widgets: { type: 'array', items: { type: 'object' } },
          },
        },
        shareInfo: {
          type: 'object',
          properties: {
            expiresAt: { type: 'string' },
            viewCount: { type: 'number' },
            isPublic: { type: 'boolean' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: '공유 URL을 찾을 수 없거나 만료되었습니다.',
  })
  @ApiResponse({
    status: 403,
    description: '비공개 대시보드이거나 접근이 차단되었습니다.',
  })
  async shareDashboardInfo(@Param() param) {
    const { uuid } = param;
    const result = await this.shareUrlService.shareDashboardInfo(uuid);
    await this.access.sharedDashboard(result.data.id);
    return result;
  }
}
