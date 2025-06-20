import {
  Controller,
  Post,
  Body,
  Headers,
  Request,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { CreateEventDto } from './dto/create-event.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthPublic } from '../auth/decorators/auth-public.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';

@ApiTags('Analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Post('events')
  @HttpCode(HttpStatus.NO_CONTENT)
  @AuthPublic() // 인증 없이도 이벤트 수집 가능
  @ApiOperation({ summary: '사용자 이벤트 수집' })
  @ApiResponse({ status: 204, description: '이벤트가 성공적으로 수집됨' })
  @ApiResponse({ status: 400, description: '잘못된 요청' })
  async collectEvents(
    @Body() createEventDto: CreateEventDto,
    @Headers('x-correlation-id') correlationId: string,
    @Headers('user-agent') userAgent: string,
    @Headers('x-forwarded-for') forwardedFor: string,
    @Request() req: any,
  ): Promise<void> {
    const userId = req.user?.userId || null;
    const ipAddress = forwardedFor?.split(',')[0]?.trim() || req.ip;

    await this.analyticsService.collectEvents(createEventDto.events, {
      userId,
      correlationId,
      userAgent,
      ipAddress,
    });
  }

  @Post('events/batch')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '서버 사이드 이벤트 일괄 수집' })
  @ApiResponse({ status: 204, description: '이벤트가 성공적으로 수집됨' })
  async collectBatchEvents(
    @Body() createEventDto: CreateEventDto,
    @GetUser() user: any,
    @Headers('x-correlation-id') correlationId: string,
  ): Promise<void> {
    await this.analyticsService.collectEvents(createEventDto.events, {
      userId: user.userId,
      correlationId,
      userAgent: 'Server-Side',
      ipAddress: 'Internal',
    });
  }
}
