import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { EnhancedQueryOptimizerService } from './enhanced-query-optimizer.service';
import { DatabaseSpecificOptimizationService } from './database-specific-optimization.service';
import { QueryCacheService } from './query-cache.service';
import { IndexRecommendationService } from './index-recommendation.service';
import { EnhancedConnectionPoolService } from './enhanced-connection-pool.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

export class OptimizeQueryDto {
  query: string;
  databaseId: number;
  parameters?: any[];
  sessionId?: string;
}

export class CacheConfigDto {
  engine: string;
  maxSize?: number;
  ttl?: number;
  enabled?: boolean;
}

export class IndexAnalysisDto {
  databaseId: number;
  tableName: string;
  queryPatterns: string[];
}

@ApiTags('Database Optimization')
@Controller('optimization')
@UseGuards(JwtAuthGuard)
export class OptimizationController {
  constructor(
    private readonly queryOptimizerService: EnhancedQueryOptimizerService,
    private readonly dbOptimizationService: DatabaseSpecificOptimizationService,
    private readonly queryCacheService: QueryCacheService,
    private readonly indexRecommendationService: IndexRecommendationService,
    private readonly connectionPoolService: EnhancedConnectionPoolService,
  ) {}

  @Post('query/optimize')
  @ApiOperation({ summary: '쿼리 최적화 실행' })
  @ApiResponse({ status: 200, description: '최적화된 쿼리와 분석 결과 반환' })
  async optimizeQuery(@Body() dto: OptimizeQueryDto) {
    // 실제 구현에서는 knex 인스턴스와 database 엔티티를 가져와야 함
    // 여기서는 API 인터페이스만 정의
    return {
      success: true,
      message: 'Query optimization endpoint - implementation needed',
      data: {
        originalQuery: dto.query,
        optimizedQuery: dto.query,
        appliedOptimizations: [],
        recommendations: [],
        analysis: {},
      },
    };
  }

  @Get('engines/:engine/config')
  @ApiOperation({ summary: '데이터베이스 엔진별 최적화 설정 조회' })
  @ApiParam({ name: 'engine', description: '데이터베이스 엔진 (pg, mysql2, mssql, etc.)' })
  @ApiResponse({ status: 200, description: '엔진별 최적화 설정 반환' })
  getOptimizationConfig(@Param('engine') engine: string) {
    const config = this.dbOptimizationService.getOptimizationConfig(engine);
    return {
      success: true,
      data: config,
    };
  }

  @Get('engines/:engine/pool-config')
  @ApiOperation({ summary: '데이터베이스 연결 풀 최적화 설정 조회' })
  @ApiParam({ name: 'engine', description: '데이터베이스 엔진' })
  @ApiQuery({ name: 'production', required: false, description: '프로덕션 환경 여부' })
  @ApiResponse({ status: 200, description: '최적화된 연결 풀 설정 반환' })
  getPoolConfig(
    @Param('engine') engine: string,
    @Query('production') production?: boolean,
  ) {
    const isProduction = production === 'true' || production === true;
    const config = this.dbOptimizationService.getOptimizedPoolConfig(
      engine,
      isProduction,
    );
    return {
      success: true,
      data: config,
    };
  }

  @Get('cache/stats')
  @ApiOperation({ summary: '쿼리 캐시 통계 조회' })
  @ApiQuery({ name: 'engine', required: false, description: '특정 엔진의 통계만 조회' })
  @ApiResponse({ status: 200, description: '캐시 통계 반환' })
  getCacheStats(@Query('engine') engine?: string) {
    const stats = this.queryCacheService.getStats(engine);
    return {
      success: true,
      data: stats instanceof Map ? Object.fromEntries(stats) : stats,
    };
  }

  @Post('cache/config')
  @ApiOperation({ summary: '캐시 설정 업데이트' })
  @ApiResponse({ status: 200, description: '캐시 설정 업데이트 완료' })
  async updateCacheConfig(@Body() dto: CacheConfigDto) {
    await this.queryCacheService.updateCacheConfig(dto.engine, {
      maxSize: dto.maxSize,
      ttl: dto.ttl,
      enabled: dto.enabled,
    });

    return {
      success: true,
      message: 'Cache configuration updated successfully',
    };
  }

  @Post('cache/clear')
  @ApiOperation({ summary: '캐시 삭제' })
  @ApiQuery({ name: 'engine', required: false, description: '특정 엔진의 캐시만 삭제' })
  @ApiResponse({ status: 200, description: '캐시 삭제 완료' })
  async clearCache(@Query('engine') engine?: string) {
    if (engine) {
      await this.queryCacheService.clearCache(engine);
    } else {
      this.queryCacheService.clearAllCaches();
    }

    return {
      success: true,
      message: engine ? `Cache cleared for ${engine}` : 'All caches cleared',
    };
  }

  @Get('cache/diagnostics')
  @ApiOperation({ summary: '캐시 진단 정보 조회' })
  @ApiResponse({ status: 200, description: '캐시 진단 정보 반환' })
  getCacheDiagnostics() {
    const diagnostics = this.queryCacheService.getDiagnostics();
    return {
      success: true,
      data: diagnostics,
    };
  }

  @Post('index/analyze')
  @ApiOperation({ summary: '인덱스 분석 및 추천' })
  @ApiResponse({ status: 200, description: '인덱스 분석 결과 및 추천사항 반환' })
  async analyzeIndexes(@Body() dto: IndexAnalysisDto) {
    // 실제 구현에서는 knex 인스턴스를 가져와야 함
    return {
      success: true,
      message: 'Index analysis endpoint - implementation needed',
      data: {
        tableName: dto.tableName,
        recommendations: [],
        redundantIndexes: [],
        missingIndexes: [],
        performanceImpact: {},
      },
    };
  }

  @Get('pool/stats')
  @ApiOperation({ summary: '연결 풀 통계 조회' })
  @ApiQuery({ name: 'databaseId', required: false, description: '특정 데이터베이스의 통계만 조회' })
  @ApiResponse({ status: 200, description: '연결 풀 통계 반환' })
  getPoolStats(@Query('databaseId') databaseId?: number) {
    if (databaseId) {
      const status = this.connectionPoolService.getPoolStatus(databaseId);
      return {
        success: true,
        data: status,
      };
    }

    const allStats = this.connectionPoolService.getAllPoolStats();
    return {
      success: true,
      data: Object.fromEntries(allStats),
    };
  }

  @Post('pool/:databaseId/refresh')
  @ApiOperation({ summary: '연결 풀 새로고침' })
  @ApiParam({ name: 'databaseId', description: '데이터베이스 ID' })
  @ApiResponse({ status: 200, description: '연결 풀 새로고침 완료' })
  async refreshPool(@Param('databaseId') databaseId: number) {
    await this.connectionPoolService.refreshPool(databaseId);
    return {
      success: true,
      message: `Connection pool refreshed for database ${databaseId}`,
    };
  }

  @Get('pool/:databaseId/performance')
  @ApiOperation({ summary: '연결 풀 성능 히스토리 조회' })
  @ApiParam({ name: 'databaseId', description: '데이터베이스 ID' })
  @ApiResponse({ status: 200, description: '성능 히스토리 반환' })
  getPoolPerformanceHistory(@Param('databaseId') databaseId: number) {
    const history = this.connectionPoolService.getPerformanceHistory(databaseId);
    return {
      success: true,
      data: history,
    };
  }

  @Get('sessions')
  @ApiOperation({ summary: '최적화 세션 통계 조회' })
  @ApiQuery({ name: 'sessionId', required: false, description: '특정 세션의 통계만 조회' })
  @ApiResponse({ status: 200, description: '세션 통계 반환' })
  getSessionStats(@Query('sessionId') sessionId?: string) {
    const stats = this.queryOptimizerService.getSessionStats(sessionId);
    return {
      success: true,
      data: stats instanceof Map ? Object.fromEntries(stats) : stats,
    };
  }

  @Get('reports/:databaseId')
  @ApiOperation({ summary: '종합 최적화 보고서 생성' })
  @ApiParam({ name: 'databaseId', description: '데이터베이스 ID' })
  @ApiResponse({ status: 200, description: '종합 최적화 보고서 반환' })
  async generateOptimizationReport(@Param('databaseId') databaseId: number) {
    const report = await this.queryOptimizerService.generateOptimizationReport(databaseId);
    return {
      success: true,
      data: report,
    };
  }

  @Get('engines/supported')
  @ApiOperation({ summary: '지원하는 데이터베이스 엔진 목록 조회' })
  @ApiResponse({ status: 200, description: '지원 엔진 목록 반환' })
  getSupportedEngines() {
    const engines = [
      {
        engine: 'pg',
        name: 'PostgreSQL',
        features: ['Advanced indexing (GIN, GIST)', 'JSON operations', 'Window functions', 'CTEs', 'Parallel query'],
        optimizations: ['Query hints', 'Index recommendations', 'Connection pooling', 'Query caching'],
      },
      {
        engine: 'mysql2',
        name: 'MySQL',
        features: ['InnoDB storage engine', 'Partitioning', 'Full-text indexing', 'JSON support'],
        optimizations: ['Force index hints', 'LIMIT optimization', 'Connection pooling', 'Query caching'],
      },
      {
        engine: 'mssql',
        name: 'SQL Server',
        features: ['Columnstore indexes', 'In-memory OLTP', 'Query store', 'Adaptive query processing'],
        optimizations: ['NOLOCK hints', 'Columnstore recommendations', 'Connection pooling', 'Query caching'],
      },
      {
        engine: 'oracledb',
        name: 'Oracle Database',
        features: ['Advanced analytics', 'Partitioning', 'Parallel execution', 'Result cache'],
        optimizations: ['Optimizer hints', 'Parallel processing', 'Connection pooling', 'Query caching'],
      },
      {
        engine: 'bigquery',
        name: 'Google BigQuery',
        features: ['Columnar storage', 'Automatic partitioning', 'Machine learning', 'Serverless'],
        optimizations: ['Partition pruning', 'SELECT optimization', 'Query caching'],
      },
      {
        engine: 'snowflake',
        name: 'Snowflake',
        features: ['Multi-cluster', 'Time travel', 'Zero-copy cloning', 'Automatic scaling'],
        optimizations: ['Warehouse optimization', 'Clustering hints', 'Query caching'],
      },
    ];

    return {
      success: true,
      data: engines,
    };
  }

  @Get('health')
  @ApiOperation({ summary: '최적화 시스템 헬스 체크' })
  @ApiResponse({ status: 200, description: '시스템 상태 정보 반환' })
  getHealthStatus() {
    return {
      success: true,
      data: {
        status: 'healthy',
        timestamp: new Date(),
        services: {
          queryOptimizer: 'active',
          queryCache: 'active',
          connectionPool: 'active',
          indexRecommendation: 'active',
        },
        version: '1.0.0',
      },
    };
  }
}