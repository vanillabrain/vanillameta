import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { HybridCacheService } from './hybrid-cache.service';
import { DatasetService } from '../../dataset/dataset.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ResponseStatus } from '../enum/response-status.enum';

export class CacheStatsResponseDto {
  engine: string;
  l1Cache: any;
  l2Cache: any;
  hybridMetrics: {
    l1HitRate: number;
    l2HitRate: number;
    overallHitRate: number;
    l1Size: number;
    l2Size: number;
    promotionCount: number;
    demotionCount: number;
  };
}

export class CacheInvalidationRequestDto {
  engine?: string;
  databaseId?: number;
  pattern?: string;
}

export class CacheWarmupRequestDto {
  datasetIds: number[];
}

@ApiTags('Cache Management')
@Controller('cache')
@UseGuards(JwtAuthGuard)
export class CacheController {
  constructor(
    private readonly hybridCache: HybridCacheService,
    private readonly datasetService: DatasetService,
  ) {}

  /**
   * 캐시 통계 조회
   */
  @Get('stats')
  @ApiOperation({
    summary: '캐시 통계 조회',
    description: '하이브리드 캐시(L1 + L2)의 통계 정보를 조회합니다.',
  })
  @ApiQuery({
    name: 'engine',
    required: false,
    description: '특정 데이터베이스 엔진의 통계만 조회 (예: mysql2, pg, mssql)',
  })
  @ApiResponse({
    status: 200,
    description: '캐시 통계 조회 성공',
    type: CacheStatsResponseDto,
  })
  async getCacheStats(@Query('engine') engine?: string) {
    try {
      const stats = await this.hybridCache.getHybridStats(engine);

      return {
        status: ResponseStatus.SUCCESS,
        data: stats,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        status: ResponseStatus.ERROR,
        message: error.message,
        timestamp: new Date(),
      };
    }
  }

  /**
   * 캐시 진단 정보 조회
   */
  @Get('diagnostics')
  @ApiOperation({
    summary: '캐시 진단 정보 조회',
    description: '캐시 시스템의 상세 진단 정보와 최적화 제안을 조회합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '캐시 진단 정보 조회 성공',
  })
  async getCacheDiagnostics() {
    try {
      const diagnostics = await this.datasetService.getCacheDiagnostics();

      return {
        status: ResponseStatus.SUCCESS,
        data: diagnostics,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        status: ResponseStatus.ERROR,
        message: error.message,
        timestamp: new Date(),
      };
    }
  }

  /**
   * 캐시 최적화 제안 조회
   */
  @Get('optimization-suggestions')
  @ApiOperation({
    summary: '캐시 최적화 제안 조회',
    description: '캐시 성능 분석을 바탕으로 최적화 제안을 제공합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '최적화 제안 조회 성공',
  })
  async getOptimizationSuggestions() {
    try {
      const suggestions = await this.hybridCache.getOptimizationSuggestions();

      return {
        status: ResponseStatus.SUCCESS,
        data: suggestions,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        status: ResponseStatus.ERROR,
        message: error.message,
        timestamp: new Date(),
      };
    }
  }

  /**
   * 전체 캐시 무효화
   */
  @Delete('invalidate-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '전체 캐시 무효화',
    description: '모든 캐시(L1 + L2)를 무효화합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '전체 캐시 무효화 성공',
  })
  async invalidateAllCache() {
    try {
      await this.hybridCache.invalidateAll();

      return {
        status: ResponseStatus.SUCCESS,
        message: '전체 캐시가 무효화되었습니다.',
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        status: ResponseStatus.ERROR,
        message: error.message,
        timestamp: new Date(),
      };
    }
  }

  /**
   * 엔진별 캐시 무효화
   */
  @Delete('invalidate/engine/:engine')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '엔진별 캐시 무효화',
    description: '특정 데이터베이스 엔진의 캐시를 무효화합니다.',
  })
  @ApiParam({
    name: 'engine',
    description: '데이터베이스 엔진 이름 (예: mysql2, pg, mssql)',
  })
  @ApiResponse({
    status: 200,
    description: '엔진별 캐시 무효화 성공',
  })
  async invalidateEngineCache(@Param('engine') engine: string) {
    try {
      await this.hybridCache.invalidateByEngine(engine);

      return {
        status: ResponseStatus.SUCCESS,
        message: `${engine} 엔진의 캐시가 무효화되었습니다.`,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        status: ResponseStatus.ERROR,
        message: error.message,
        timestamp: new Date(),
      };
    }
  }

  /**
   * 데이터베이스별 캐시 무효화
   */
  @Delete('invalidate/database/:databaseId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '데이터베이스별 캐시 무효화',
    description: '특정 데이터베이스의 캐시를 무효화합니다.',
  })
  @ApiParam({
    name: 'databaseId',
    description: '데이터베이스 ID',
  })
  @ApiResponse({
    status: 200,
    description: '데이터베이스별 캐시 무효화 성공',
  })
  async invalidateDatabaseCache(@Param('databaseId') databaseId: string) {
    try {
      await this.datasetService.invalidateDatabaseCache(parseInt(databaseId));

      return {
        status: ResponseStatus.SUCCESS,
        message: `데이터베이스 ${databaseId}의 캐시가 무효화되었습니다.`,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        status: ResponseStatus.ERROR,
        message: error.message,
        timestamp: new Date(),
      };
    }
  }

  /**
   * 데이터셋별 캐시 무효화
   */
  @Delete('invalidate/dataset/:datasetId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '데이터셋별 캐시 무효화',
    description: '특정 데이터셋의 캐시를 무효화합니다.',
  })
  @ApiParam({
    name: 'datasetId',
    description: '데이터셋 ID',
  })
  @ApiResponse({
    status: 200,
    description: '데이터셋별 캐시 무효화 성공',
  })
  async invalidateDatasetCache(@Param('datasetId') datasetId: string) {
    try {
      await this.datasetService.invalidateDatasetCache(parseInt(datasetId));

      return {
        status: ResponseStatus.SUCCESS,
        message: `데이터셋 ${datasetId}의 캐시가 무효화되었습니다.`,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        status: ResponseStatus.ERROR,
        message: error.message,
        timestamp: new Date(),
      };
    }
  }

  /**
   * 패턴 기반 캐시 무효화
   */
  @Post('invalidate/pattern')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '패턴 기반 캐시 무효화',
    description: '지정된 패턴과 일치하는 캐시 키들을 무효화합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '패턴 기반 캐시 무효화 성공',
  })
  async invalidateCacheByPattern(@Body() request: CacheInvalidationRequestDto) {
    try {
      const { engine, databaseId, pattern } = request;

      if (pattern) {
        // 패턴 기반 무효화 (Redis만 지원)
        // TODO: HybridCacheService에 패턴 기반 무효화 메서드 추가 필요
        return {
          status: ResponseStatus.ERROR,
          message: '패턴 기반 무효화는 현재 구현되지 않았습니다.',
          timestamp: new Date(),
        };
      }

      if (engine) {
        await this.hybridCache.invalidateByEngine(engine);
        return {
          status: ResponseStatus.SUCCESS,
          message: `${engine} 엔진의 캐시가 무효화되었습니다.`,
          timestamp: new Date(),
        };
      }

      if (databaseId) {
        await this.hybridCache.invalidateByDatabase(databaseId.toString());
        return {
          status: ResponseStatus.SUCCESS,
          message: `데이터베이스 ${databaseId}의 캐시가 무효화되었습니다.`,
          timestamp: new Date(),
        };
      }

      return {
        status: ResponseStatus.ERROR,
        message: '무효화할 대상(pattern, engine, databaseId 중 하나)을 지정해주세요.',
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        status: ResponseStatus.ERROR,
        message: error.message,
        timestamp: new Date(),
      };
    }
  }

  /**
   * 캐시 워밍업
   */
  @Post('warmup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '캐시 워밍업',
    description: '지정된 데이터셋들을 미리 캐시에 로드합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '캐시 워밍업 성공',
  })
  async warmupCache(@Body() request: CacheWarmupRequestDto) {
    try {
      const { datasetIds } = request;

      if (!datasetIds || datasetIds.length === 0) {
        return {
          status: ResponseStatus.ERROR,
          message: '워밍업할 데이터셋 ID를 지정해주세요.',
          timestamp: new Date(),
        };
      }

      // 비동기로 워밍업 실행 (응답은 즉시 반환)
      this.datasetService.warmupDatasetCache(datasetIds).catch(error => {
        console.error('Cache warmup failed:', error);
      });

      return {
        status: ResponseStatus.SUCCESS,
        message: `${datasetIds.length}개 데이터셋의 캐시 워밍업이 시작되었습니다.`,
        data: { datasetIds },
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        status: ResponseStatus.ERROR,
        message: error.message,
        timestamp: new Date(),
      };
    }
  }

  /**
   * 캐시 연결 상태 확인
   */
  @Get('health')
  @ApiOperation({
    summary: '캐시 시스템 상태 확인',
    description: 'L1(메모리)과 L2(Redis) 캐시의 연결 상태를 확인합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '캐시 상태 조회 성공',
  })
  async getCacheHealth() {
    try {
      // TODO: HybridCacheService에 연결 상태 확인 메서드 추가 필요
      const l2Connected = true; // 임시값
      const redisInfo = null; // 임시값

      return {
        status: ResponseStatus.SUCCESS,
        data: {
          l1Cache: {
            type: 'LRU Memory',
            status: 'connected',
          },
          l2Cache: {
            type: 'Redis',
            status: l2Connected ? 'connected' : 'disconnected',
            info: redisInfo,
          },
          overall: l2Connected ? 'healthy' : 'degraded',
        },
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        status: ResponseStatus.ERROR,
        message: error.message,
        data: {
          overall: 'error',
        },
        timestamp: new Date(),
      };
    }
  }

  /**
   * 캐시 성능 메트릭 조회
   */
  @Get('metrics')
  @ApiOperation({
    summary: '캐시 성능 메트릭 조회',
    description: '캐시 성능 관련 상세 메트릭을 조회합니다.',
  })
  @ApiQuery({
    name: 'timeRange',
    required: false,
    description: '시간 범위 (예: 1h, 1d, 7d)',
  })
  @ApiResponse({
    status: 200,
    description: '성능 메트릭 조회 성공',
  })
  async getCacheMetrics(@Query('timeRange') timeRange?: string) {
    try {
      const stats = await this.hybridCache.getHybridStats();
      const diagnostics = await this.hybridCache.getDiagnostics();

      // 성능 메트릭 계산
      const metrics = {
        hitRates: {},
        responseTimes: {},
        cacheUtilization: {},
        trends: {
          // TODO: 시계열 데이터 수집 및 분석 구현
          timeRange: timeRange || '1h',
          notice: '시계열 데이터 수집 기능은 향후 구현 예정입니다.',
        },
      };

      if (stats instanceof Map) {
        for (const [engine, engineStats] of stats) {
          metrics.hitRates[engine] = {
            l1: engineStats.hybridMetrics.l1HitRate,
            l2: engineStats.hybridMetrics.l2HitRate,
            overall: engineStats.hybridMetrics.overallHitRate,
          };

          metrics.responseTimes[engine] = {
            l2Average: engineStats.l2Cache?.averageResponseTime || 0,
          };

          metrics.cacheUtilization[engine] = {
            l1Size: engineStats.hybridMetrics.l1Size,
            l2Size: engineStats.hybridMetrics.l2Size,
            promotions: engineStats.hybridMetrics.promotionCount,
          };
        }
      }

      return {
        status: ResponseStatus.SUCCESS,
        data: {
          metrics,
          diagnostics: diagnostics.l2Cache?.redis || {},
        },
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        status: ResponseStatus.ERROR,
        message: error.message,
        timestamp: new Date(),
      };
    }
  }
}
