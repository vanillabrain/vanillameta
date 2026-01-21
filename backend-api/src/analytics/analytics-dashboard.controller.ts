import { Controller, Get, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';

@ApiTags('Analytics Dashboard')
@Controller('analytics/dashboard')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AnalyticsDashboardController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('user-events')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '사용자별 이벤트 조회' })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiResponse({ status: 200, description: '사용자 이벤트 목록' })
  async getUserEvents(
    @GetUser() user: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.analyticsService.getUserEvents(
      user.userId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  @Get('stats')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '이벤트 통계 조회' })
  @ApiQuery({ name: 'startDate', required: true, type: String })
  @ApiQuery({ name: 'endDate', required: true, type: String })
  @ApiResponse({ status: 200, description: '이벤트 통계' })
  async getEventStats(@Query('startDate') startDate: string, @Query('endDate') endDate: string) {
    return this.analyticsService.getEventStats(new Date(startDate), new Date(endDate));
  }

  @Get('popular-features')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '인기 기능 조회' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: '인기 기능 목록' })
  async getPopularFeatures(@Query('limit') limit = 10) {
    return this.analyticsService.getPopularFeatures(limit);
  }

  @Get('error-rate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '에러율 조회' })
  @ApiQuery({ name: 'startDate', required: true, type: String })
  @ApiQuery({ name: 'endDate', required: true, type: String })
  @ApiResponse({ status: 200, description: '에러율 통계' })
  async getErrorRate(@Query('startDate') startDate: string, @Query('endDate') endDate: string) {
    return this.analyticsService.getErrorRate(new Date(startDate), new Date(endDate));
  }

  @Get('performance-metrics')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '성능 메트릭 조회' })
  @ApiQuery({ name: 'startDate', required: true, type: String })
  @ApiQuery({ name: 'endDate', required: true, type: String })
  @ApiResponse({ status: 200, description: '성능 메트릭' })
  async getPerformanceMetrics(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.analyticsService.getPerformanceMetrics(new Date(startDate), new Date(endDate));
  }

  @Get('user-journey')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '사용자 여정 조회' })
  @ApiQuery({ name: 'sessionId', required: true, type: String })
  @ApiResponse({ status: 200, description: '세션별 사용자 여정' })
  async getUserJourney(@Query('sessionId') sessionId: string) {
    return this.analyticsService.getUserJourney(sessionId);
  }
}
