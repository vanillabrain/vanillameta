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
  constructor(private readonly shareUrlService: ShareUrlService) {}

  @UseGuards(JwtAuthGuard)
  @Post('share-on/:dashboardId')
  @ApiOperation({
    summary: '대시보드 공유 활성화',
    description: '대시보드를 공유 가능한 상태로 변경하고 공유 URL을 생성합니다.',
  })
  @ApiBearerAuth('JWT-auth')
  @ApiParam({
    name: 'dashboardId',
    description: '대시보드 ID',
    type: Number,
    example: 1,
  })
  @ApiBody({
    type: ShareUrlOnDto,
    description: '공유 옵션',
  })
  @ApiResponse({
    status: 201,
    description: '공유 URL이 생성되었습니다.',
    schema: {
      type: 'object',
      properties: {
        shareUrl: { type: 'string', example: 'https://app.vanillameta.com/share/abc123-def456' },
        uuid: { type: 'string', example: 'abc123-def456' },
        expiresAt: { type: 'string', example: '2024-12-31T23:59:59Z' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: '대시보드를 찾을 수 없습니다.',
  })
  @ApiResponse({
    status: 403,
    description: '해당 대시보드를 공유할 권한이 없습니다.',
  })
  checkShareUrlOn(@Req() req, @Param() params, @Body() shareUrlOnDto: ShareUrlOnDto) {
    const { userId } = req.user.accessKeyData;
    const { dashboardId } = params;
    return this.shareUrlService.checkShareUrlOn(userId, dashboardId, shareUrlOnDto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('share-off/:dashboardId')
  @ApiOperation({
    summary: '대시보드 공유 비활성화',
    description: '대시보드 공유를 중단하고 공유 URL을 무효화합니다.',
  })
  @ApiBearerAuth('JWT-auth')
  @ApiParam({
    name: 'dashboardId',
    description: '대시보드 ID',
    type: Number,
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: '공유가 성공적으로 비활성화되었습니다.',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: '공유가 비활성화되었습니다.' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: '대시보드를 찾을 수 없습니다.',
  })
  @ApiResponse({
    status: 403,
    description: '해당 대시보드를 수정할 권한이 없습니다.',
  })
  checkShareUrlOff(@Req() req, @Param() params, @Body() shareUrlOnDto: ShareUrlOnDto) {
    const { userId } = req.user.accessKeyData;
    const { dashboardId } = params;
    return this.shareUrlService.checkShareUrlOff(userId, dashboardId);
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
    return await this.shareUrlService.shareDashboardInfo(uuid);
  }
}
