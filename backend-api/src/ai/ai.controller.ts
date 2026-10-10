import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { AiService } from './ai.service';
import { RecommendChartDto } from './dto/recommend-chart.dto';
import { TextToSqlDto } from './dto/text-to-sql.dto';

@UseGuards(JwtAuthGuard)
@Controller('ai')
@ApiTags('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

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
  dashboardInsight(@Param('id') id: string) {
    return this.aiService.dashboardInsight(+id);
  }
}
