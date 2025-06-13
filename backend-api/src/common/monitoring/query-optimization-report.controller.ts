import { Controller, Get, UseGuards, Query as QueryParam } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { QueryAnalyzerService, QueryOptimizationReport } from './query-analyzer.service';
import { QueryCollector } from '../utils/query-collector';
import { Connection } from 'typeorm';
import { InjectConnection } from '@nestjs/typeorm';

interface AnalysisReportDto {
  collectedQueries: {
    totalQueries: number;
    slowQueries: number;
    averageExecutionTime: number;
    queryBySources: Record<string, number>;
    slowestQueries: any[];
  };
  optimizationReport?: QueryOptimizationReport;
  systemQueries?: any[];
}

@ApiTags('monitoring')
@Controller('monitoring/query-optimization')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class QueryOptimizationReportController {
  constructor(
    private readonly queryAnalyzerService: QueryAnalyzerService,
    private readonly queryCollector: QueryCollector,
    @InjectConnection() private connection: Connection,
  ) {}

  @Get('report')
  @ApiOperation({ summary: '쿼리 최적화 보고서 생성' })
  @ApiResponse({ status: 200, description: '쿼리 최적화 보고서' })
  @ApiQuery({ name: 'analyzeSystem', required: false, type: Boolean })
  async generateReport(
    @QueryParam('analyzeSystem') analyzeSystem?: boolean,
  ): Promise<AnalysisReportDto> {
    // 수집된 쿼리 통계
    const stats = this.queryCollector.getStatistics();

    const report: AnalysisReportDto = {
      collectedQueries: {
        ...stats,
        queryBySources: Object.fromEntries(stats.queryBySources),
      },
    };

    // 시스템 쿼리 분석 (선택적)
    if (analyzeSystem) {
      const systemQueries = await this.analyzeSystemQueries();
      report.systemQueries = systemQueries;
    }

    // 느린 쿼리들에 대한 최적화 보고서
    if (stats.slowestQueries.length > 0) {
      const queries = stats.slowestQueries.map(q => q.query);
      report.optimizationReport = await this.queryAnalyzerService.generateOptimizationReport(
        queries,
      );
    }

    return report;
  }

  @Get('collected-queries')
  @ApiOperation({ summary: '수집된 쿼리 목록 조회' })
  @ApiResponse({ status: 200, description: '수집된 쿼리 목록' })
  @ApiQuery({ name: 'source', required: false })
  @ApiQuery({ name: 'minExecutionTime', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getCollectedQueries(
    @QueryParam('source') source?: string,
    @QueryParam('minExecutionTime') minExecutionTime?: number,
    @QueryParam('limit') limit?: number,
  ) {
    let queries = this.queryCollector.getQueries({
      source,
      minExecutionTime: minExecutionTime ? Number(minExecutionTime) : undefined,
    });

    if (limit) {
      queries = queries.slice(0, Number(limit));
    }

    return {
      total: queries.length,
      queries: queries.map(q => ({
        ...q,
        query: q.query.substring(0, 500), // 쿼리 길이 제한
      })),
    };
  }

  @Get('query-patterns')
  @ApiOperation({ summary: '쿼리 패턴 분석' })
  @ApiResponse({ status: 200, description: '쿼리 패턴별 통계' })
  async analyzeQueryPatterns() {
    const patterns = this.queryCollector.identifyPatterns();

    const patternStats = Array.from(patterns.entries()).map(([pattern, queries]) => {
      const executionTimes = queries.filter(q => q.executionTime).map(q => q.executionTime!);

      return {
        pattern: pattern.substring(0, 200),
        count: queries.length,
        averageExecutionTime:
          executionTimes.length > 0
            ? executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length
            : 0,
        maxExecutionTime: executionTimes.length > 0 ? Math.max(...executionTimes) : 0,
        sources: [...new Set(queries.map(q => q.source))],
      };
    });

    // 실행 횟수 기준 정렬
    patternStats.sort((a, b) => b.count - a.count);

    return {
      totalPatterns: patternStats.length,
      patterns: patternStats.slice(0, 50), // 상위 50개 패턴
    };
  }

  @Get('clear-collection')
  @ApiOperation({ summary: '수집된 쿼리 초기화' })
  @ApiResponse({ status: 200, description: '초기화 완료' })
  async clearCollection() {
    this.queryCollector.clear();
    return { message: 'Query collection cleared' };
  }

  /**
   * 시스템 테이블 쿼리 분석
   */
  private async analyzeSystemQueries(): Promise<any[]> {
    const systemQueries = [
      // Dashboard 관련 주요 쿼리
      `SELECT d.*, ds.uuid FROM dashboard d 
       LEFT JOIN dashboard_share ds ON d.share_id = ds.id 
       WHERE d.id IN (1, 2, 3) 
       ORDER BY d.updated_at DESC`,

      // Widget 조회 쿼리
      `SELECT w.*, c.type as component_type, c.icon, c.title as component_title 
       FROM widget w 
       INNER JOIN component c ON c.id = w.component_id 
       ORDER BY w.updated_at DESC`,

      // Dashboard-Widget 조인 쿼리
      `SELECT dw.*, w.* FROM dashboard_widget dw 
       INNER JOIN widget w ON w.id = dw.widget_id 
       WHERE dw.dashboard_id = 1`,

      // User mapping 쿼리
      `SELECT um.*, u.* FROM user_mapping um 
       INNER JOIN user u ON u.id = um.user_info_id 
       WHERE um.dashboard_id IN (1, 2, 3)`,
    ];

    const analyses = [];
    for (const query of systemQueries) {
      try {
        const analysis = await this.queryAnalyzerService.analyzeQuery(query);
        analyses.push(analysis);
      } catch (error) {
        analyses.push({
          query: query.substring(0, 100),
          error: error.message,
        });
      }
    }

    return analyses;
  }
}
