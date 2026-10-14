import { SourceOwnershipGuard } from '../ownership/source-ownership.guard';
import { Body, Controller, Get, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { AiDashboardService } from './ai-dashboard.service';
import { AiService } from './ai.service';
import { RecommendChartDto } from './dto/recommend-chart.dto';
import { TextToSqlDto } from './dto/text-to-sql.dto';

@UseGuards(JwtAuthGuard, SourceOwnershipGuard)
@Controller('ai')
@ApiTags('ai')
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly dashboards: AiDashboardService,
  ) {}

  private async cancellable(req, res, run: (signal?: AbortSignal) => Promise<any>) {
    if (!res) return run();
    const controller = new AbortController();
    const aborted = () => controller.abort();
    const closed = () => {
      if (!res.writableFinished) controller.abort();
    };
    req.once('aborted', aborted);
    res.once('close', closed);
    if (req.aborted) controller.abort();
    try {
      return await run(controller.signal);
    } finally {
      req.off('aborted', aborted);
      res.off('close', closed);
    }
  }

  @Get('dashboard-metrics/:id')
  dashboardMetrics(@Param('id') id: string, @Req() req) {
    return this.dashboards.metricChoices(Number(id), req.user.accessKeyData.id);
  }

  @Post('metric-change/impact')
  metricImpact(@Body() body: any, @Req() req) {
    return this.dashboards.metricImpact(body, req.user.accessKeyData.id);
  }
  @Post('metric-change/batch-preview')
  metricBatchPreview(@Body() body: any, @Req() req) {
    return this.dashboards.metricBatchPreview(body, req.user.accessKeyData.id);
  }
  @Post('metric-change/batch-save')
  metricBatchSave(@Body() body: any, @Req() req) {
    return this.dashboards.metricBatchSave(body, req.user.accessKeyData.id);
  }
  @Post('metric-change/preview')
  metricChangePreview(@Body() body: any, @Req() req) {
    return this.dashboards.metricChangePreview(body, req.user.accessKeyData.id);
  }
  @Post('metric-change/save')
  metricChangeSave(@Body() body: any, @Req() req) {
    return this.dashboards.metricChangeSave(body, req.user.accessKeyData.id);
  }

  @Post('dashboard-draft')
  dashboardDraft(@Body() body: any, @Req() req, @Res({ passthrough: true }) res?) {
    return this.cancellable(req, res, signal =>
      signal
        ? this.dashboards.generate(body, req.user.accessKeyData.id, signal)
        : this.dashboards.generate(body, req.user.accessKeyData.id),
    );
  }

  @Post('dashboard-assistant')
  dashboardAssistant(@Body() body: any, @Req() req, @Res({ passthrough: true }) res?) {
    return this.cancellable(req, res, signal =>
      signal
        ? this.dashboards.assistant(body, req.user.accessKeyData.id, signal)
        : this.dashboards.assistant(body, req.user.accessKeyData.id),
    );
  }

  @Post('dashboard-preview')
  dashboardPreview(@Body() body: any, @Req() req) {
    return this.dashboards.preview(body, req.user.accessKeyData.id);
  }

  @Post('dashboard-save')
  dashboardSave(@Body() body: any, @Req() req) {
    return this.dashboards.save(body, req.user.accessKeyData.id);
  }

  @Post('dashboard-details')
  dashboardDetails(@Body() body: any, @Req() req) {
    return this.dashboards.details(body, req.user.accessKeyData.id);
  }

  @Get('dashboard-analysis/:id')
  dashboardAnalysis(@Param('id') id: string, @Req() req) {
    return this.dashboards.analysis(+id, req.user.accessKeyData.id, true);
  }

  /**
   * 자연어 → SQL 생성 (데이터셋 SQL 에디터 AI 어시스턴트)
   */
  @Post('text-to-sql')
  textToSql(@Body() textToSqlDto: TextToSqlDto) {
    return this.aiService.textToSql(+textToSqlDto.databaseId, textToSqlDto.prompt);
  }

  /**
   * 데이터셋 스키마/샘플 기반 차트 타입 추천
   */
  @Post('recommend-chart')
  recommendChart(@Body() recommendChartDto: RecommendChartDto) {
    return this.aiService.recommendChart(recommendChartDto);
  }

  /**
   * 대시보드 위젯 데이터 기반 AI 인사이트 요약
   */
  @Post('dashboard-insight/:id')
  dashboardInsight(@Param('id') id: string, @Req() req) {
    return this.aiService.dashboardInsight(+id, req.user.accessKeyData.id);
  }
}
