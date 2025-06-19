import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthPublic } from '../auth/decorators/auth-public.decorator';
import { EventsService } from './events.service';
import { TrackEventDto } from './dto/track-event.dto';
import { TrackMetricDto } from './dto/track-metric.dto';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';
import { Request } from 'express';

@ApiTags('Events')
@Controller('v1/events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post('track')
  @HttpCode(HttpStatus.NO_CONTENT)
  @AuthPublic() // 프론트엔드에서 인증 없이도 이벤트 전송 가능
  @ApiOperation({ summary: '이벤트 추적' })
  @ApiResponse({ status: 204, description: '이벤트가 성공적으로 기록됨' })
  async trackEvents(
    @Body() trackEventDto: TrackEventDto,
    @Req() req: Request,
  ): Promise<void> {
    const clientIp = this.getClientIp(req);
    const userAgent = req.headers['user-agent'] || '';
    
    await this.eventsService.trackEvents(
      trackEventDto,
      clientIp,
      userAgent,
    );
  }

  @Post('metrics')
  @HttpCode(HttpStatus.NO_CONTENT)
  @AuthPublic()
  @ApiOperation({ summary: '성능 메트릭 추적' })
  @ApiResponse({ status: 204, description: '메트릭이 성공적으로 기록됨' })
  async trackMetrics(
    @Body() trackMetricDto: TrackMetricDto,
    @Req() req: Request,
  ): Promise<void> {
    const userAgent = req.headers['user-agent'] || '';
    
    await this.eventsService.trackMetrics(
      trackMetricDto,
      userAgent,
    );
  }

  @Get('analytics/summary')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '분석 요약 데이터 조회' })
  @ApiResponse({ status: 200, description: '분석 요약 데이터' })
  async getAnalyticsSummary(
    @Query() query: AnalyticsQueryDto,
    @Req() req: any,
  ) {
    const userId = req.user?.userId;
    return this.eventsService.getAnalyticsSummary(query, userId);
  }

  @Get('analytics/events')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '이벤트 목록 조회' })
  @ApiResponse({ status: 200, description: '이벤트 목록' })
  async getEvents(
    @Query() query: AnalyticsQueryDto,
    @Req() req: any,
  ) {
    const userId = req.user?.userId;
    return this.eventsService.getEvents(query, userId);
  }

  @Get('analytics/metrics')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '성능 메트릭 조회' })
  @ApiResponse({ status: 200, description: '성능 메트릭 데이터' })
  async getMetrics(
    @Query() query: AnalyticsQueryDto,
    @Req() req: any,
  ) {
    const userId = req.user?.userId;
    return this.eventsService.getMetrics(query, userId);
  }

  @Get('analytics/funnel')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '퍼널 분석 데이터 조회' })
  @ApiResponse({ status: 200, description: '퍼널 분석 데이터' })
  async getFunnelAnalysis(
    @Query('steps') steps: string,
    @Query() query: AnalyticsQueryDto,
    @Req() req: any,
  ) {
    const userId = req.user?.userId;
    const stepArray = steps ? steps.split(',') : [];
    return this.eventsService.getFunnelAnalysis(stepArray, query, userId);
  }

  @Get('analytics/retention')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '리텐션 분석 데이터 조회' })
  @ApiResponse({ status: 200, description: '리텐션 분석 데이터' })
  async getRetentionAnalysis(
    @Query() query: AnalyticsQueryDto,
    @Req() req: any,
  ) {
    const userId = req.user?.userId;
    return this.eventsService.getRetentionAnalysis(query, userId);
  }

  @Get('analytics/user-flow')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '사용자 플로우 분석' })
  @ApiResponse({ status: 200, description: '사용자 플로우 데이터' })
  async getUserFlow(
    @Query() query: AnalyticsQueryDto,
    @Req() req: any,
  ) {
    const userId = req.user?.userId;
    return this.eventsService.getUserFlow(query, userId);
  }

  private getClientIp(req: Request): string {
    // IP 추출 (프록시 고려)
    const forwarded = req.headers['x-forwarded-for'] as string;
    const ip = forwarded
      ? forwarded.split(',')[0].trim()
      : req.connection.remoteAddress || req.socket.remoteAddress || '';
    
    return ip;
  }
}