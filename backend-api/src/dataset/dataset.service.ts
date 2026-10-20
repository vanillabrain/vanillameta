import { createHash } from 'crypto';
import { User } from '../user/entities/user.entity';
import { SourceAccessService } from '../ownership/source-access.service';
import {
  ForbiddenException,
  UnauthorizedException,
  NotFoundException,
  HttpException,
} from '@nestjs/common';
import { lockDashboardWrite } from '../dashboard/dashboard-write-lock';
import { DashboardWidget } from '../dashboard/dashboard-widget/entities/dashboard-widget.entity';
import { metadataTransaction, serializeMetadataWork } from '../common/metadata-work';
import { lockMetricSources } from '../metric/metric-write-lock';
import {
  lockSourceActor,
  assertSourceOwner,
  sourceWriteFields,
  sourceWriteTransaction,
} from '../database/source-write-lock';
import { Database } from '../database/entities/database.entity';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { Injectable, Logger, Optional } from '@nestjs/common';
import { CreateDatasetDto } from './dto/create-dataset.dto';
import { UpdateDatasetDto } from './dto/update-dataset.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Dataset } from './entities/dataset.entity';
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
    private readonly connectionService: ConnectionService,
    @Optional() @InjectRepository(Database) private databaseRepository?: Repository<Database>,
    @Optional() private readonly hybridCache?: HybridCacheService,
    @Optional() private readonly customLogger?: CustomLoggerService,
    @Optional() private readonly businessMetrics?: BusinessMetricsService,
    @Optional() private readonly paginationService?: PaginationService,
    @Optional() private readonly sourceAccess?: SourceAccessService,
  ) {}

  /**
   * 데이터셋 추가
   * @param createDatasetDto
   */
  async create(createDataset: CreateDatasetDto, actor?: number, epoch?: number) {
    createDataset = sourceWriteFields(createDataset, ['title', 'databaseId', 'query']);
    // The existing Source Select submits decimal strings. Normalize at the request boundary;
    // parent-lock helpers continue to require canonical positive numeric IDs.
    const rawSourceId: unknown = createDataset.databaseId;
    const sourceId =
      typeof rawSourceId === 'string' && /^[1-9]\d*$/.test(rawSourceId)
        ? Number(rawSourceId)
        : rawSourceId;
    if (typeof sourceId !== 'number' || !Number.isSafeInteger(sourceId) || sourceId <= 0)
      throw new BadRequestException('invalid database id');
    createDataset = { ...createDataset, databaseId: sourceId };
    const basis = await this.datasetRepository.manager.findOne(Database, {
      where: { id: createDataset.databaseId },
    });
    assertSourceOwner(basis, actor);
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
      data: await metadataTransaction(this.datasetRepository.manager, async manager => {
        await lockSourceActor(manager, actor, epoch);
        const source = (await lockMetricSources(manager, [createDataset.databaseId])).get(
          createDataset.databaseId,
        );
        assertSourceOwner(source, actor);
        if (JSON.stringify(source) !== JSON.stringify(basis))
          throw new ConflictException('Source changed.');
        return manager.save(Dataset, createDataset);
      }),
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

  async update(id: number, updateDataset: UpdateDatasetDto, actor?: number, epoch?: number) {
    updateDataset = sourceWriteFields(updateDataset, ['title', 'query']);
    const find_dataset = await this.datasetRepository.findOne({ where: { id: id } });
    if (!find_dataset) {
      return { status: ResponseStatus.ERROR, message: 'No exist dataset' };
    } else {
      const basis = await this.datasetRepository.manager.findOne(Database, {
        where: { id: find_dataset.databaseId },
      });
      assertSourceOwner(basis, actor);
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

        const saveResult = await metadataTransaction(
          this.datasetRepository.manager,
          async manager => {
            await lockSourceActor(manager, actor, epoch);
            const source = (await lockMetricSources(manager, [find_dataset.databaseId])).get(
              find_dataset.databaseId,
            );
            assertSourceOwner(source, actor);
            if (JSON.stringify(source) !== JSON.stringify(basis))
              throw new ConflictException('Source changed.');
            const current = await manager.findOne(Dataset, { where: { id } });
            if (!current || current.databaseId !== find_dataset.databaseId)
              throw new ConflictException('Dataset source changed.');
            if (updateDataset.title) current.title = updateDataset.title;
            if (updateDataset.query) current.query = updateDataset.query;
            return manager.save(Dataset, current);
          },
        );
        return { status: ResponseStatus.SUCCESS, data: saveResult };
      }
    }
  }

  async remove(id: number, actor?: number, epoch?: number) {
    return sourceWriteTransaction(this.datasetRepository.manager, async manager => {
      await lockSourceActor(manager, actor, epoch);
      const dataset = await manager.findOne(Dataset, { where: { id } });
      if (!dataset) return { status: ResponseStatus.ERROR, message: 'No exist dataset' };
      const widgets = () =>
        manager.find(Widget, {
          where: { datasetType: DatasetType.DATASET, datasetId: id },
          order: { id: 'ASC' },
        });
      const before = await widgets();
      const ids = before.map(widget => widget.id);
      const links = () =>
        ids.length
          ? manager.find(DashboardWidget, { where: { widgetId: In(ids) } })
          : Promise.resolve([]);
      const parents = new Set((await links()).map(link => link.dashboardId));
      for (const parent of [...parents].sort((a, b) => a - b))
        await lockDashboardWrite(manager, parent);
      assertSourceOwner(
        (await lockMetricSources(manager, [dataset.databaseId])).get(dataset.databaseId),
        actor,
      );
      const lock = ['mysql', 'mariadb'].includes(manager.connection.options.type)
        ? { lock: { mode: 'pessimistic_write' as const } }
        : {};
      // Match bundle writers: sorted Widget children precede Dataset children.
      for (const widget of before) {
        const current = await manager.findOne(Widget, { where: { id: widget.id }, ...lock });
        if (!current || current.datasetType !== DatasetType.DATASET || current.datasetId !== id)
          throw new ConflictException('Dataset widgets changed.');
      }
      const current = await manager.findOne(Dataset, { where: { id }, ...lock });
      if (
        !current ||
        current.databaseId !== dataset.databaseId ||
        JSON.stringify((await widgets()).map(widget => widget.id)) !== JSON.stringify(ids) ||
        (await links()).some(link => !parents.has(link.dashboardId))
      )
        throw new ConflictException('Dataset source changed.');
      await manager.delete(Dataset, id);
      if (ids.length) await manager.delete(Widget, ids);
      return `This action removes a #${id} dataset`;
    });
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
  private async cachedQueryBasis(id: number, authorization?: { actor: number; epoch: number }) {
    return serializeMetadataWork(this.datasetRepository.manager.connection, async () => {
      const manager = this.datasetRepository.manager;
      if (authorization) {
        const { actor, epoch } = authorization;
        if (!Number.isSafeInteger(actor) || actor <= 0 || !Number.isSafeInteger(epoch) || epoch < 0)
          throw new UnauthorizedException('Current actor required.');
        const user = await manager.findOne(User, { where: { id: actor } });
        if (!user || user.active !== true || user.authVersion !== epoch)
          throw new UnauthorizedException('Current actor required.');
        if (!this.sourceAccess) throw new ForbiddenException('Source ownership required.');
        await this.sourceAccess.assert('dataset', id, actor, 'owner', manager);
      }
      const dataset = await this.datasetRepository.findOne({ where: { id } });
      if (!dataset) throw new NotFoundException('Dataset not found.');
      const source = await manager.findOne(Database, { where: { id: dataset.databaseId } });
      if (
        !source ||
        source.catalogActive === false ||
        (authorization && source.ownerId !== authorization.actor)
      )
        throw new ForbiddenException('Source ownership required.');
      const revisionContext = createHash('sha256')
        .update(
          JSON.stringify([
            authorization?.actor,
            authorization?.epoch,
            dataset.id,
            dataset.databaseId,
            dataset.query,
            source.id,
            source.ownerId,
            source.catalogVersion,
            source.engine,
            source.type,
            source.connectionConfig,
          ]),
        )
        .digest('hex');
      return { dataset, source, revisionContext };
    });
  }

  async executeCachedQuery(
    id: number,
    options?: {
      forceRefresh?: boolean;
      customTtl?: number;
      useStreamingFallback?: boolean;
    },
    authorization?: { actor: number; epoch: number },
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

    let initialRevision: string;
    const assertFresh = async () => {
      const current = await this.cachedQueryBasis(id, authorization);
      if (current.revisionContext !== initialRevision)
        throw new ConflictException('Source or dataset changed.');
    };
    try {
      const basis = await this.cachedQueryBasis(id, authorization);
      const { dataset, source: dbConnection, revisionContext } = basis;
      initialRevision = revisionContext;
      const engine = dbConnection.type || 'unknown';
      const databaseId = dataset.databaseId.toString();

      // 강제 새로고침이 아닐 때 캐시 확인
      if (!forceRefresh && authorization) {
        const cachedResult = await this.hybridCache.get(
          engine,
          databaseId,
          dataset.query,
          undefined,
          revisionContext,
        );

        await assertFresh();
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
      await assertFresh();
      const queryStartTime = Date.now();
      const queryResult = await this.connectionService.executeQuery({
        id: dataset.databaseId,
        query: dataset.query,
      });
      await assertFresh();
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
        { ttl: customTtl, revisionContext },
      );
      await assertFresh();

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
      if (error instanceof HttpException) throw error;
      this.logger.error('Cached query execution failed:', error);

      // 스트리밍 폴백 옵션이 활성화된 경우
      if (useStreamingFallback) {
        try {
          await assertFresh();
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
          if (streamError instanceof HttpException) throw streamError;
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
