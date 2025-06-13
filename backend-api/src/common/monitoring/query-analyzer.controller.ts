import { Controller, Post, Body, UseGuards, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import {
  QueryAnalyzerService,
  QueryAnalysis,
  QueryOptimizationReport,
} from './query-analyzer.service';

export class AnalyzeQueryDto {
  query: string;
  databaseId?: number;
}

export class AnalyzeQueriesDto {
  queries: string[];
  databaseId?: number;
}

@ApiTags('query-analyzer')
@Controller('query-analyzer')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class QueryAnalyzerController {
  constructor(private readonly queryAnalyzerService: QueryAnalyzerService) {}

  @Post('analyze')
  @ApiOperation({ summary: '단일 쿼리 실행 계획 분석' })
  @ApiResponse({ status: 200, description: '쿼리 분석 결과' })
  async analyzeQuery(@Body() dto: AnalyzeQueryDto): Promise<QueryAnalysis> {
    return this.queryAnalyzerService.analyzeQuery(dto.query, dto.databaseId);
  }

  @Post('analyze-batch')
  @ApiOperation({ summary: '다중 쿼리 일괄 분석 및 최적화 보고서 생성' })
  @ApiResponse({ status: 200, description: '쿼리 최적화 보고서' })
  async analyzeQueries(@Body() dto: AnalyzeQueriesDto): Promise<QueryOptimizationReport> {
    return this.queryAnalyzerService.generateOptimizationReport(dto.queries);
  }

  @Post('measure-performance')
  @ApiOperation({ summary: '쿼리 실행 시간 측정' })
  @ApiResponse({ status: 200, description: '쿼리 성능 측정 결과' })
  async measurePerformance(@Body() dto: AnalyzeQueryDto): Promise<QueryAnalysis> {
    return this.queryAnalyzerService.measureQueryPerformance(dto.query, [], dto.databaseId);
  }
}
