import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  UseGuards,
  HttpException,
  HttpStatus,
  Body,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { HybridCacheService } from '../optimization/hybrid-cache.service';
import { QueryCacheService } from '../optimization/query-cache.service';
import { RedisCacheService } from '../optimization/redis-cache.service';
import { CacheWarmupScheduler } from '../scheduler/cache-warmup.scheduler';

/**
 * 캐시 메트릭 및 관리 API
 */
@ApiTags('캐시 관리')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('cache')
export class CacheMetricsController {
  constructor(
    private readonly hybridCache: HybridCacheService,
    private readonly l1Cache: QueryCacheService,
    private readonly l2Cache: RedisCacheService,
    private readonly cacheWarmup: CacheWarmupScheduler,
  ) {}

  /**
   * 전체 캐시 통계 조회
   */
  @Get('stats')
  @ApiOperation({
    summary: '전체 캐시 통계 조회',
    description: '모든 엔진의 L1, L2 캐시 통계를 조회합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '캐시 통계가 반환되었습니다.',
    schema: {
      type: 'object',
      properties: {
        summary: {
          type: 'object',
          properties: {
            totalEngines: { type: 'number', example: 5 },
            overallHitRate: { type: 'number', example: 85.5 },
            l1TotalSize: { type: 'number', example: 52428800 },
            l2TotalSize: { type: 'number', example: 104857600 },
            totalPromotions: { type: 'number', example: 1523 },
          },
        },
        engines: {
          type: 'object',
          additionalProperties: {
            type: 'object',
            properties: {
              engine: { type: 'string' },
              l1Cache: { type: 'object' },
              l2Cache: { type: 'object' },
              hybridMetrics: { type: 'object' },
            },
          },
        },
      },
    },
  })
  async getAllStats() {
    try {
      const hybridStats = await this.hybridCache.getHybridStats();
      
      if (!hybridStats || !(hybridStats instanceof Map)) {
        return {
          summary: {
            totalEngines: 0,
            overallHitRate: 0,
            l1TotalSize: 0,
            l2TotalSize: 0,
            totalPromotions: 0,
          },
          engines: {},
        };
      }

      // 전체 통계 계산
      let totalL1Size = 0;
      let totalL2Size = 0;
      let totalPromotions = 0;
      let totalHitRate = 0;
      let engineCount = 0;

      const enginesObj: Record<string, any> = {};

      for (const [engine, stats] of hybridStats) {
        enginesObj[engine] = stats;
        
        if (stats.l1Cache) {
          totalL1Size += stats.l1Cache.totalSize || 0;
        }
        
        if (stats.l2Cache) {
          totalL2Size += stats.l2Cache.totalSize || 0;
        }
        
        totalPromotions += stats.hybridMetrics.promotionCount || 0;
        totalHitRate += stats.hybridMetrics.overallHitRate || 0;
        engineCount++;
      }

      return {
        summary: {
          totalEngines: engineCount,
          overallHitRate: engineCount > 0 ? totalHitRate / engineCount : 0,
          l1TotalSize: totalL1Size,
          l2TotalSize: totalL2Size,
          totalPromotions: totalPromotions,
        },
        engines: enginesObj,
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: '캐시 통계 조회 중 오류가 발생했습니다.',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 특정 엔진의 캐시 통계 조회
   */
  @Get('stats/:engine')
  @ApiOperation({
    summary: '특정 엔진의 캐시 통계 조회',
    description: '지정된 데이터베이스 엔진의 캐시 통계를 조회합니다.',
  })
  @ApiParam({
    name: 'engine',
    description: '데이터베이스 엔진 타입',
    example: 'mysql',
    enum: ['mysql', 'postgresql', 'mssql', 'oracle', 'sqlite'],
  })
  @ApiResponse({
    status: 200,
    description: '엔진별 캐시 통계가 반환되었습니다.',
  })
  async getEngineStats(@Param('engine') engine: string) {
    try {
      const stats = await this.hybridCache.getHybridStats(engine);
      
      if (!stats) {
        throw new HttpException(
          {
            status: 'error',
            message: `엔진 '${engine}'의 캐시 통계를 찾을 수 없습니다.`,
          },
          HttpStatus.NOT_FOUND,
        );
      }

      return {
        status: 'success',
        data: stats,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      
      throw new HttpException(
        {
          status: 'error',
          message: '캐시 통계 조회 중 오류가 발생했습니다.',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 캐시 진단 정보 조회
   */
  @Get('diagnostics')
  @ApiOperation({
    summary: '캐시 진단 정보 조회',
    description: '캐시 시스템의 상태 진단 정보와 최적화 제안을 조회합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '캐시 진단 정보가 반환되었습니다.',
    schema: {
      type: 'object',
      properties: {
        timestamp: { type: 'string', format: 'date-time' },
        l1Cache: { type: 'object' },
        l2Cache: { type: 'object' },
        hybridStats: { type: 'object' },
        optimizationSuggestions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string' },
              engine: { type: 'string' },
              suggestion: { type: 'string' },
              priority: { type: 'string', enum: ['low', 'medium', 'high'] },
            },
          },
        },
      },
    },
  })
  async getDiagnostics() {
    try {
      const diagnostics = await this.hybridCache.getDiagnostics();
      const suggestions = await this.hybridCache.getOptimizationSuggestions();

      return {
        status: 'success',
        data: {
          ...diagnostics,
          optimizationSuggestions: suggestions,
        },
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: '캐시 진단 정보 조회 중 오류가 발생했습니다.',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 캐시 무효화 - 엔진별
   */
  @Delete('invalidate/engine/:engine')
  @ApiOperation({
    summary: '엔진별 캐시 무효화',
    description: '특정 데이터베이스 엔진의 모든 캐시를 무효화합니다.',
  })
  @ApiParam({
    name: 'engine',
    description: '데이터베이스 엔진 타입',
    example: 'mysql',
  })
  @ApiResponse({
    status: 200,
    description: '캐시가 성공적으로 무효화되었습니다.',
  })
  async invalidateByEngine(@Param('engine') engine: string) {
    try {
      await this.hybridCache.invalidateByEngine(engine);
      
      return {
        status: 'success',
        message: `엔진 '${engine}'의 모든 캐시가 무효화되었습니다.`,
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: '캐시 무효화 중 오류가 발생했습니다.',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 캐시 무효화 - 데이터베이스별
   */
  @Delete('invalidate/database/:databaseId')
  @ApiOperation({
    summary: '데이터베이스별 캐시 무효화',
    description: '특정 데이터베이스의 모든 캐시를 무효화합니다.',
  })
  @ApiParam({
    name: 'databaseId',
    description: '데이터베이스 ID',
    type: Number,
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: '캐시가 성공적으로 무효화되었습니다.',
  })
  async invalidateByDatabase(@Param('databaseId') databaseId: string) {
    try {
      await this.hybridCache.invalidateByDatabase(databaseId);
      
      return {
        status: 'success',
        message: `데이터베이스 ${databaseId}의 모든 캐시가 무효화되었습니다.`,
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: '캐시 무효화 중 오류가 발생했습니다.',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 전체 캐시 무효화
   */
  @Delete('invalidate/all')
  @ApiOperation({
    summary: '전체 캐시 무효화',
    description: '모든 캐시를 무효화합니다. 주의: 성능에 영향을 줄 수 있습니다.',
  })
  @ApiResponse({
    status: 200,
    description: '모든 캐시가 성공적으로 무효화되었습니다.',
  })
  async invalidateAll() {
    try {
      await this.hybridCache.invalidateAll();
      
      return {
        status: 'success',
        message: '모든 캐시가 무효화되었습니다.',
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: '캐시 무효화 중 오류가 발생했습니다.',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 캐시 워밍업 - 데이터셋
   */
  @Post('warmup/dataset/:id')
  @ApiOperation({
    summary: '데이터셋 캐시 워밍업',
    description: '특정 데이터셋의 캐시를 미리 로드합니다.',
  })
  @ApiParam({
    name: 'id',
    description: '데이터셋 ID',
    type: Number,
    example: 1,
  })
  @ApiQuery({
    name: 'ttl',
    required: false,
    description: '캐시 TTL (초 단위)',
    type: Number,
    example: 3600,
  })
  @ApiResponse({
    status: 200,
    description: '데이터셋 캐시 워밍업이 완료되었습니다.',
  })
  async warmupDataset(
    @Param('id') id: string,
    @Query('ttl') ttl?: string,
  ) {
    try {
      await this.cacheWarmup.warmupDataset(+id, ttl ? +ttl : undefined);
      
      return {
        status: 'success',
        message: `데이터셋 ${id}의 캐시 워밍업이 완료되었습니다.`,
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: '캐시 워밍업 중 오류가 발생했습니다.',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 캐시 워밍업 - 대시보드
   */
  @Post('warmup/dashboard/:id')
  @ApiOperation({
    summary: '대시보드 캐시 워밍업',
    description: '특정 대시보드에서 사용하는 모든 데이터셋의 캐시를 미리 로드합니다.',
  })
  @ApiParam({
    name: 'id',
    description: '대시보드 ID',
    type: Number,
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: '대시보드 캐시 워밍업이 완료되었습니다.',
  })
  async warmupDashboard(@Param('id') id: string) {
    try {
      await this.cacheWarmup.warmupDashboard(+id);
      
      return {
        status: 'success',
        message: `대시보드 ${id}의 캐시 워밍업이 완료되었습니다.`,
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: '캐시 워밍업 중 오류가 발생했습니다.',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 캐시 워밍업 - 일괄 처리
   */
  @Post('warmup/batch')
  @ApiOperation({
    summary: '일괄 캐시 워밍업',
    description: '여러 데이터셋의 캐시를 일괄적으로 미리 로드합니다.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        datasetIds: {
          type: 'array',
          items: { type: 'number' },
          example: [1, 2, 3, 4, 5],
        },
        ttl: {
          type: 'number',
          description: '캐시 TTL (초 단위)',
          example: 3600,
        },
      },
      required: ['datasetIds'],
    },
  })
  @ApiResponse({
    status: 200,
    description: '일괄 캐시 워밍업이 완료되었습니다.',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'success' },
        message: { type: 'string' },
        results: {
          type: 'object',
          properties: {
            success: { type: 'number', example: 4 },
            failed: { type: 'number', example: 1 },
            details: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  datasetId: { type: 'number' },
                  status: { type: 'string', enum: ['success', 'failed'] },
                  error: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  })
  async warmupBatch(
    @Body() body: { datasetIds: number[]; ttl?: number },
  ) {
    const { datasetIds, ttl } = body;
    const results = {
      success: 0,
      failed: 0,
      details: [] as any[],
    };

    for (const datasetId of datasetIds) {
      try {
        await this.cacheWarmup.warmupDataset(datasetId, ttl);
        results.success++;
        results.details.push({
          datasetId,
          status: 'success',
        });
      } catch (error) {
        results.failed++;
        results.details.push({
          datasetId,
          status: 'failed',
          error: error.message,
        });
      }
    }

    return {
      status: 'success',
      message: `일괄 캐시 워밍업 완료: 성공 ${results.success}개, 실패 ${results.failed}개`,
      results,
    };
  }

  /**
   * L1 캐시 상태 조회
   */
  @Get('l1/status')
  @ApiOperation({
    summary: 'L1 캐시 상태 조회',
    description: '메모리 캐시(L1)의 상태와 설정을 조회합니다.',
  })
  @ApiResponse({
    status: 200,
    description: 'L1 캐시 상태가 반환되었습니다.',
  })
  async getL1Status() {
    try {
      const diagnostics = this.l1Cache.getDiagnostics();
      
      return {
        status: 'success',
        data: diagnostics,
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: 'L1 캐시 상태 조회 중 오류가 발생했습니다.',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * L2 캐시 상태 조회
   */
  @Get('l2/status')
  @ApiOperation({
    summary: 'L2 캐시 상태 조회',
    description: 'Redis 캐시(L2)의 상태와 연결 정보를 조회합니다.',
  })
  @ApiResponse({
    status: 200,
    description: 'L2 캐시 상태가 반환되었습니다.',
  })
  async getL2Status() {
    try {
      const isConnected = this.l2Cache.isConnected();
      const diagnostics = isConnected ? await this.l2Cache.getDiagnostics() : null;
      
      return {
        status: 'success',
        data: {
          connected: isConnected,
          diagnostics,
        },
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: 'L2 캐시 상태 조회 중 오류가 발생했습니다.',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}