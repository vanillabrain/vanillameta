import { Controller, Post, Body, Headers, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { CollectEventsDto, AnalyticsEventDto } from './dto/analytics-event.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthPublic } from '../auth/decorators/auth-public.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';

@ApiTags('Analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Post('events')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '사용자 이벤트 수집' })
  @ApiHeader({
    name: 'X-Session-ID',
    description: '세션 ID',
    required: true,
  })
  @ApiResponse({
    status: 204,
    description: '이벤트가 성공적으로 수집됨',
  })
  @ApiResponse({
    status: 400,
    description: '잘못된 이벤트 데이터',
  })
  async collectEvents(
    @Body() collectEventsDto: CollectEventsDto,
    @Headers('x-session-id') sessionId: string,
    @Headers('x-correlation-id') correlationId: string,
    @GetUser() user: any,
  ): Promise<void> {
    await this.analyticsService.collectEvents({
      ...collectEventsDto,
      sessionId,
      correlationId,
      userId: user?.id,
    });
  }

  @Post('events/anonymous')
  @HttpCode(HttpStatus.NO_CONTENT)
  @AuthPublic()
  @ApiOperation({ summary: '익명 사용자 이벤트 수집' })
  @ApiHeader({
    name: 'X-Session-ID',
    description: '세션 ID',
    required: true,
  })
  @ApiResponse({
    status: 204,
    description: '이벤트가 성공적으로 수집됨',
  })
  async collectAnonymousEvents(
    @Body() collectEventsDto: CollectEventsDto,
    @Headers('x-session-id') sessionId: string,
    @Headers('x-correlation-id') correlationId: string,
  ): Promise<void> {
    await this.analyticsService.collectEvents({
      ...collectEventsDto,
      sessionId,
      correlationId,
      isAnonymous: true,
    });
  }

  @Post('page-view')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '페이지뷰 추적' })
  @ApiResponse({
    status: 204,
    description: '페이지뷰가 기록됨',
  })
  async trackPageView(
    @Body()
    pageViewDto: {
      path: string;
      title?: string;
      referrer?: string;
    },
    @Headers('x-session-id') sessionId: string,
    @GetUser() user: any,
  ): Promise<void> {
    await this.analyticsService.trackPageView({
      ...pageViewDto,
      sessionId,
      userId: user?.id,
    });
  }

  @Post('performance')
  @HttpCode(HttpStatus.NO_CONTENT)
  @AuthPublic()
  @ApiOperation({ summary: '성능 메트릭 수집' })
  @ApiResponse({
    status: 204,
    description: '성능 메트릭이 기록됨',
  })
  async collectPerformanceMetrics(
    @Body()
    metricsDto: {
      metrics: Array<{
        name: string;
        value: number;
        unit: string;
        tags?: Record<string, string>;
      }>;
    },
    @Headers('x-session-id') sessionId: string,
  ): Promise<void> {
    await this.analyticsService.collectPerformanceMetrics({
      ...metricsDto,
      sessionId,
    });
  }
}
