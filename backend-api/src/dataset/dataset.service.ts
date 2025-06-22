import { Injectable, Logger } from '@nestjs/common';
import { CreateDatasetDto } from './dto/create-dataset.dto';
import { UpdateDatasetDto } from './dto/update-dataset.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Dataset } from './entities/dataset.entity';
import { Database } from '../database/entities/database.entity';
import { ConnectionService } from '../connection/connection.service';
import { ResponseStatus } from '../common/enum/response-status.enum';
import { Widget } from '../widget/entities/widget.entity';
import { DatasetType } from '../common/enum/dataset-type.enum';
import { HybridCacheService } from '../common/optimization/hybrid-cache.service';
import { CustomLoggerService } from '../common/logger/logger.service';
import { BusinessMetricsService } from '../common/monitoring/business-metrics.service';
import { Readable } from 'stream';
import {
  PaginationService,
  CursorPaginationOptions,
  OffsetPaginationOptions,
  PaginatedResponse,
} from '../common/pagination';

@Injectable()
export class DatasetService {
  private readonly logger = new Logger(DatasetService.name);

  constructor(
    @InjectRepository(Dataset)
    private datasetRepository: Repository<Dataset>,
    @InjectRepository(Widget)
    private widgetRepository: Repository<Widget>,
    @InjectRepository(Database)
    private databaseRepository: Repository<Database>,
    private readonly connectionService: ConnectionService,
    private readonly hybridCache: HybridCacheService,
    private readonly customLogger: CustomLoggerService,
    private readonly businessMetrics: BusinessMetricsService,
    private readonly paginationService: PaginationService,
  ) {}

  /**
   * 데이터셋 추가
   * @param createDatasetDto
   */
  async create(createDataset: CreateDatasetDto) {
    // 쿼리를 돌려보고 문제가 있으면 저장 불가 안내
    const queryResult = await this.connectionService.executeQuery({
      id: createDataset.databaseId,
      query: createDataset.query,
    });
    if (queryResult.status === ResponseStatus.ERROR) {
      return { status: ResponseStatus.ERROR, message: queryResult.message };
    }

    // 쿼리에 문제가 없으면 저장
    return {
      status: ResponseStatus.SUCCESS,
      data: await this.datasetRepository.save(createDataset),
    };
  }

  /**
   * 데이터셋 전체 조회 (페이지네이션 지원)
   */
  async findAll(
    pagination?: CursorPaginationOptions | OffsetPaginationOptions,
  ): Promise<PaginatedResponse<Dataset> | Dataset[]> {
    // 페이지네이션이 없으면 기존 로직 사용 (하위 호환성)
    if (!pagination) {
      return await this.datasetRepository.find({
        order: {
          updatedAt: 'DESC',
          title: 'ASC',
        },
      });
    }

    // 페이지네이션 적용
    const queryBuilder = this.datasetRepository
      .createQueryBuilder('dataset')
      .select([
        'dataset.id',
        'dataset.title',
        'dataset.databaseId',
        'dataset.query',
        'dataset.createdAt',
        'dataset.updatedAt',
      ]);

    const paginatedResult = await this.paginationService.paginate(queryBuilder, pagination, {
      alias: 'dataset',
      defaultSortField: 'updatedAt',
      defaultSortDirection: 'DESC',
      includeTotalCount: true,
    });

    return paginatedResult;
  }

  /**
   * 데이터셋 단건 조회
   * @param id
   */
  async findOne(id: number) {
    let returnObj: any;
    const dataObj = await this.datasetRepository.findOne({ where: { id: id } });

    if (!dataObj)
      returnObj = { status: ResponseStatus.ERROR, message: `id ${id}의 값이 존재하지 않습니다.` };
    else returnObj = { status: ResponseStatus.SUCCESS, data: dataObj };
    return returnObj;
  }

  async update(id: number, updateDataset: UpdateDatasetDto) {
    const find_dataset = await this.datasetRepository.findOne({ where: { id: id } });
    if (!find_dataset) {
      return { status: ResponseStatus.ERROR, message: 'No exist dataset' };
    } else {
      // 변경할 쿼리 날려보고, 문제 없으면 저장
      const queryResult = await this.connectionService.executeQuery({
        id: find_dataset.databaseId,
        query: updateDataset.query,
      });
      if (queryResult.status === ResponseStatus.ERROR) {
        return { status: ResponseStatus.ERROR, message: queryResult.message };
      } else {
        if (updateDataset.title) {
          find_dataset.title = updateDataset.title;
        }
        if (updateDataset.query) {
          find_dataset.query = updateDataset.query;
        }

        const saveResult = await this.datasetRepository.save(find_dataset);
        return { status: ResponseStatus.SUCCESS, data: saveResult };
      }
    }
  }

  async remove(id: number) {
    const find_dataset = await this.datasetRepository.findOne({ where: { id: id } });

    if (!find_dataset) {
      return 'Not exist dataset';
    } else {
      await this.datasetRepository.delete(find_dataset.id);
      await this.widgetRepository.delete({
        datasetType: DatasetType.DATASET,
        datasetId: find_dataset.id,
      });
    }
    return `This action removes a #${id} dataset`;
  }

  /**
   * 데이터셋 스트리밍 쿼리 실행
   * @param id 데이터셋 ID
   * @param userId 사용자 ID (보안 로깅용)
   * @returns 스트림 객체와 메타데이터
   */
  async executeStreamingQuery(
    id: number,
    userId?: string,
  ): Promise<{
    stream: Readable;
    fields?: any[];
    error?: string;
    dataset?: Dataset;
  }> {
    // 데이터셋 조회
    const dataset = await this.datasetRepository.findOne({ where: { id } });

    if (!dataset) {
      throw new Error(`Dataset with id ${id} not found`);
    }

    // 스트리밍 쿼리 실행
    const result = await this.connectionService.executeStreamingQuery(
      {
        id: dataset.databaseId,
        query: dataset.query,
      },
      userId,
    );

    return {
      ...result,
      dataset,
    };
  }

  /**
   * 캐시된 데이터셋 쿼리 실행
   * @param id 데이터셋 ID
   * @param options 캐시 옵션
   * @returns 쿼리 결과와 캐시 메타데이터
   */
  async executeCachedQuery(
    id: number,
    options?: {
      forceRefresh?: boolean;
      customTtl?: number;
      useStreamingFallback?: boolean;
    },
  ): Promise<{
    status: ResponseStatus;
    data?: any;
    fields?: any[];
    message?: string;
    cache?: {
      hit: boolean;
      source: 'l1' | 'l2' | 'database';
      responseTime: number;
    };
  }> {
    const startTime = Date.now();
    const { forceRefresh = false, customTtl, useStreamingFallback = false } = options || {};

    try {
      // 데이터셋 조회
      const dataset = await this.datasetRepository.findOne({ where: { id } });
      if (!dataset) {
        return {
          status: ResponseStatus.ERROR,
          message: `Dataset with id ${id} not found`,
        };
      }

      // 데이터베이스 연결 정보 조회
      const dbConnection = await this.databaseRepository.findOne({
        where: { id: dataset.databaseId },
      });
      if (!dbConnection) {
        return {
          status: ResponseStatus.ERROR,
          message: 'Database connection not found',
        };
      }

      const engine = dbConnection.type || 'unknown';
      const databaseId = dataset.databaseId.toString();

      // 강제 새로고침이 아닐 때 캐시 확인
      if (!forceRefresh) {
        const cachedResult = await this.hybridCache.get(engine, databaseId, dataset.query);

        if (cachedResult) {
          this.customLogger.debug('Cached query result returned', 'DatasetService', {
            datasetId: id,
            engine,
            responseTime: Date.now() - startTime,
          });

          return {
            status: ResponseStatus.SUCCESS,
            data: cachedResult.data,
            fields: cachedResult.fields,
            cache: {
              hit: true,
              source: 'l1', // 정확한 소스는 HybridCacheService에서 로깅됨
              responseTime: Date.now() - startTime,
            },
          };
        }
      }

      // 캐시 미스 시 데이터베이스에서 쿼리 실행
      const queryStartTime = Date.now();
      const queryResult = await this.connectionService.executeQuery({
        id: dataset.databaseId,
        query: dataset.query,
      });
      const queryDuration = Date.now() - queryStartTime;

      // 쿼리 성능 메트릭 기록
      const rowCount = Array.isArray(queryResult.datas) ? queryResult.datas.length : 0;
      // TODO: recordQueryPerformance 메서드 구현 필요
      // await this.businessMetrics.recordQueryPerformance(
      //   databaseId,
      //   this.detectQueryType(dataset.query),
      //   queryDuration / 1000, // 초 단위로 변환
      //   rowCount,
      // );

      if (queryResult.status === ResponseStatus.ERROR) {
        return {
          status: ResponseStatus.ERROR,
          message: queryResult.message,
          cache: {
            hit: false,
            source: 'database',
            responseTime: Date.now() - startTime,
          },
        };
      }

      // 결과를 캐시에 저장
      await this.hybridCache.set(
        engine,
        databaseId,
        dataset.query,
        queryResult.datas,
        queryResult.fields || [],
        undefined,
        { ttl: customTtl },
      );

      this.customLogger.log('Query executed and cached', 'DatasetService', {
        datasetId: id,
        engine,
        dataSize: JSON.stringify(queryResult.datas || []).length,
        responseTime: Date.now() - startTime,
      });

      return {
        status: ResponseStatus.SUCCESS,
        data: queryResult.datas,
        fields: queryResult.fields,
        cache: {
          hit: false,
          source: 'database',
          responseTime: Date.now() - startTime,
        },
      };
    } catch (error) {
      this.logger.error('Cached query execution failed:', error);

      // 스트리밍 폴백 옵션이 활성화된 경우
      if (useStreamingFallback) {
        try {
          this.logger.log('Attempting streaming fallback...');
          const streamResult = await this.executeStreamingQuery(id);

          return {
            status: ResponseStatus.SUCCESS,
            data: 'STREAMING_RESPONSE',
            message: 'Fallback to streaming due to cache error',
            cache: {
              hit: false,
              source: 'database',
              responseTime: Date.now() - startTime,
            },
          };
        } catch (streamError) {
          this.logger.error('Streaming fallback also failed:', streamError);
        }
      }

      return {
        status: ResponseStatus.ERROR,
        message: error.message || 'Query execution failed',
        cache: {
          hit: false,
          source: 'database',
          responseTime: Date.now() - startTime,
        },
      };
    }
  }

  /**
   * 데이터셋 캐시 무효화
   * @param id 데이터셋 ID
   */
  async invalidateDatasetCache(id: number): Promise<void> {
    try {
      const dataset = await this.datasetRepository.findOne({ where: { id } });
      if (!dataset) {
        throw new Error(`Dataset with id ${id} not found`);
      }

      // 해당 데이터셋의 쿼리 기반 캐시 무효화
      const dbConnection = await this.databaseRepository.findOne({
        where: { id: dataset.databaseId },
      });
      if (dbConnection) {
        const engine = dbConnection.type || 'unknown';
        await this.hybridCache.invalidateByQuery(engine, dataset.query);
      }

      this.customLogger.info('Dataset cache invalidated', 'DatasetService', {
        datasetId: id,
      });
    } catch (error) {
      this.logger.error('Failed to invalidate dataset cache:', error);
      throw error;
    }
  }

  /**
   * 데이터베이스별 캐시 무효화
   * @param databaseId 데이터베이스 ID
   */
  async invalidateDatabaseCache(databaseId: number): Promise<void> {
    try {
      await this.hybridCache.invalidateByDatabase(databaseId.toString());

      this.customLogger.info('Database cache invalidated', 'DatasetService', {
        databaseId,
      });
    } catch (error) {
      this.logger.error('Failed to invalidate database cache:', error);
      throw error;
    }
  }

  /**
   * 데이터셋 캐시 통계 조회
   */
  async getCacheStats(engine?: string) {
    try {
      return await this.hybridCache.getHybridStats(engine);
    } catch (error) {
      this.logger.error('Failed to get cache stats:', error);
      return null;
    }
  }

  /**
   * 데이터셋 캐시 워밍업
   * @param datasetIds 워밍업할 데이터셋 ID 배열
   */
  async warmupDatasetCache(datasetIds: number[]): Promise<void> {
    this.logger.log(`Starting cache warmup for ${datasetIds.length} datasets`);

    for (const id of datasetIds) {
      try {
        const dataset = await this.datasetRepository.findOne({ where: { id } });
        if (!dataset) {
          this.logger.warn(`Dataset ${id} not found during warmup`);
          continue;
        }

        // 캐시된 쿼리 실행 (캐시 미스 시 데이터베이스에서 로드하여 캐시에 저장)
        await this.executeCachedQuery(id);

        this.logger.debug(`Cache warmed up for dataset ${id}`);
      } catch (error) {
        this.logger.error(`Cache warmup failed for dataset ${id}:`, error);
      }
    }

    this.logger.log('Cache warmup completed');
  }

  /**
   * 캐시 진단 정보 조회
   */
  async getCacheDiagnostics() {
    try {
      const diagnostics = await this.hybridCache.getDiagnostics();
      const optimizationSuggestions = await this.hybridCache.getOptimizationSuggestions();

      return {
        ...diagnostics,
        optimizationSuggestions,
      };
    } catch (error) {
      this.logger.error('Failed to get cache diagnostics:', error);
      return {
        timestamp: new Date(),
        error: error.message,
      };
    }
  }

  /**
   * 쿼리 타입 감지
   */
  private detectQueryType(query: string): string {
    const normalizedQuery = query.trim().toUpperCase();

    if (normalizedQuery.startsWith('SELECT')) {
      if (normalizedQuery.includes('JOIN')) {
        return 'SELECT_JOIN';
      }
      if (normalizedQuery.includes('GROUP BY')) {
        return 'SELECT_AGGREGATE';
      }
      return 'SELECT_SIMPLE';
    }

    if (normalizedQuery.startsWith('INSERT')) return 'INSERT';
    if (normalizedQuery.startsWith('UPDATE')) return 'UPDATE';
    if (normalizedQuery.startsWith('DELETE')) return 'DELETE';

    return 'OTHER';
  }
}
