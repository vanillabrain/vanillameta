import { metadataTransaction, serializeMetadataWork } from '../common/metadata-work';
import { lockMetricSources, lockMetricWrite } from './metric-write-lock';
import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { User } from '../user/entities/user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { ResponseStatus } from '../common/enum/response-status.enum';
import { YesNo } from '../common/enum/yn.enum';
import { ConnectionService } from '../connection/connection.service';
import { assertSafeIdentifier } from '../utils/query-guard.util';
import { CreateMetricDto, MetricFilter, UpdateMetricDto } from './dto/metric.dto';
import { Metric, MetricAggregation } from './entities/metric.entity';

const ALLOWED_OPS = new Set(['=', '!=', '>', '>=', '<', '<=', 'LIKE', 'IN']);
const MAX_GROUP_ROWS = 500;

@Injectable()
export class MetricService {
  constructor(
    @InjectRepository(Metric) private metricRepository: Repository<Metric>,
    private readonly connectionService: ConnectionService,
  ) {}

  private writeInput<T extends CreateMetricDto | UpdateMetricDto>(input: T): T {
    const fields = [
      'name',
      'description',
      'databaseId',
      'tableName',
      'aggregation',
      'expression',
      'groupBy',
      'filters',
      'definition',
    ];
    if (
      !input ||
      typeof input !== 'object' ||
      Array.isArray(input) ||
      Object.keys(input).some(key => !fields.includes(key))
    )
      throw new BadRequestException('메트릭 요청 항목을 확인해 주세요.');
    // Copy only the checked own fields. Runtime extras must never reach an ORM update/save.
    return Object.fromEntries(Object.keys(input).map(key => [key, input[key]])) as T;
  }

  private async currentActor(manager: EntityManager, actor: number, epoch: number) {
    const user = await manager.findOne(User, {
      where: { id: actor },
      ...(manager.connection.options.type !== 'sqlite'
        ? { lock: { mode: 'pessimistic_write' as const } }
        : {}),
    });
    if (
      !user ||
      user.active !== true ||
      !Number.isSafeInteger(epoch) ||
      epoch < 0 ||
      user.authVersion !== epoch
    )
      throw new ForbiddenException('Current actor required.');
  }
  private sourceOwner(source: { ownerId: number; catalogActive: boolean }, actor: number) {
    if (source.ownerId !== actor || source.catalogActive === false)
      throw new ForbiddenException('Source ownership required.');
  }

  async findAll() {
    return serializeMetadataWork(this.metricRepository.manager.connection, async () => {
      const metrics = await this.metricRepository.find({ where: { useYn: YesNo.YES } });
      return { status: ResponseStatus.SUCCESS, data: metrics.map(m => this.parseFilters(m)) };
    });
  }

  async findOne(id: number) {
    return serializeMetadataWork(this.metricRepository.manager.connection, async () => {
      const metric = await this.metricRepository.findOne({ where: { id } });
      if (!metric || metric.useYn === YesNo.NO)
        return { status: ResponseStatus.ERROR, message: '메트릭을 찾을 수 없습니다.' };
      return { status: ResponseStatus.SUCCESS, data: this.parseFilters(metric) };
    });
  }

  async create(
    dto: CreateMetricDto,
    actor?: number,
    expectedEpoch = 0,
  ): Promise<{ status: ResponseStatus; data?: any; message?: string }> {
    if (!Number.isSafeInteger(actor) || actor <= 0)
      throw new ForbiddenException('Current actor required.');
    dto = this.writeInput(dto);
    return serializeMetadataWork(this.metricRepository.manager.connection, async () => {
      if (Object.prototype.hasOwnProperty.call(dto, 'definition'))
        return {
          status: ResponseStatus.ERROR,
          message: '정의 snapshot은 제작 API에서만 저장합니다.',
        };
      try {
        this.validateDefinition(dto);
        // name 유니크 제약이 soft-delete 행에도 적용되므로, 삭제된 메트릭이면 재활성화
        const existing = await this.metricRepository.findOne({ where: { name: dto.name } });
        return await metadataTransaction(this.metricRepository.manager, async manager => {
          await this.currentActor(manager, actor, expectedEpoch);
          const sources = await lockMetricSources(manager, [
            dto.databaseId,
            ...(existing ? [existing.databaseId] : []),
          ]);
          for (const source of sources.values()) this.sourceOwner(source, actor);
          const repo = manager.getRepository(Metric);
          const named = await repo.findOne({ where: { name: dto.name } });
          if (named?.id !== existing?.id)
            throw new Error('메트릭이 변경되었습니다. 다시 불러와 주세요.');
          const current = existing
            ? await lockMetricWrite(manager, existing.id, { allowInactive: true })
            : undefined;
          if (current && current.databaseId !== existing.databaseId)
            throw new Error('메트릭 소스가 변경되었습니다. 다시 불러와 주세요.');
          if (current) {
            if (current.definition)
              return {
                status: ResponseStatus.ERROR,
                message: '저장한 제작 지표는 새 정의로 만들어 주세요.',
              };
            if (current.useYn === YesNo.YES) {
              return { status: ResponseStatus.ERROR, message: '이미 존재하는 메트릭명입니다.' };
            }
            await repo.update(current.id, {
              ...dto,
              description: dto.description ?? null,
              groupBy: dto.groupBy ?? null,
              filters: dto.filters ? JSON.stringify(dto.filters) : null,
              useYn: YesNo.YES,
            });
            return {
              status: ResponseStatus.SUCCESS,
              data: this.parseFilters({
                ...current,
                ...dto,
                description: dto.description ?? null,
                groupBy: dto.groupBy ?? null,
                useYn: YesNo.YES,
                filters: dto.filters ? JSON.stringify(dto.filters) : null,
              }),
            };
          }
          const metric = repo.create({
            ...dto,
            filters: dto.filters ? JSON.stringify(dto.filters) : null,
          });
          const saved = await repo.save(metric);
          return { status: ResponseStatus.SUCCESS, data: this.parseFilters(saved) };
        });
      } catch (e) {
        if (e instanceof ForbiddenException) throw e;
        return { status: ResponseStatus.ERROR, message: e.message };
      }
    });
  }

  async update(id: number, dto: UpdateMetricDto, actor?: number, expectedEpoch = 0) {
    if (!Number.isSafeInteger(actor) || actor <= 0)
      throw new ForbiddenException('Current actor required.');
    dto = this.writeInput(dto);
    return serializeMetadataWork(this.metricRepository.manager.connection, async () => {
      if (Object.prototype.hasOwnProperty.call(dto, 'definition'))
        return {
          status: ResponseStatus.ERROR,
          message: '정의 snapshot은 제작 API에서만 저장합니다.',
        };
      const metric = await this.metricRepository.findOne({ where: { id } });
      if (!metric || metric.useYn === YesNo.NO)
        return { status: ResponseStatus.ERROR, message: '메트릭을 찾을 수 없습니다.' };
      if (metric.definition)
        return {
          status: ResponseStatus.ERROR,
          message: '저장한 제작 지표는 변경하지 않습니다. 새 지표를 만들어 적용해 주세요.',
        };
      try {
        const merged = { ...this.parseFilters(metric), ...dto };
        this.validateDefinition(merged as CreateMetricDto);
        return await metadataTransaction(this.metricRepository.manager, async manager => {
          await this.currentActor(manager, actor, expectedEpoch);
          const sources = await lockMetricSources(manager, [
            metric.databaseId,
            ...(dto.databaseId === undefined ? [] : [dto.databaseId]),
          ]);
          for (const source of sources.values()) this.sourceOwner(source, actor);
          const current = await lockMetricWrite(manager, id);
          if (current.databaseId !== metric.databaseId || current.definition !== metric.definition)
            throw new Error('메트릭이 변경되었습니다. 다시 불러와 주세요.');
          this.validateDefinition({ ...this.parseFilters(current), ...dto } as CreateMetricDto);
          await manager.update(Metric, id, {
            ...dto,
            ...(dto.filters === undefined
              ? {}
              : { filters: dto.filters ? JSON.stringify(dto.filters) : null }),
          } as any);
          return { status: ResponseStatus.SUCCESS, data: { id } };
        });
      } catch (e) {
        if (e instanceof ForbiddenException) throw e;
        return { status: ResponseStatus.ERROR, message: e.message };
      }
    });
  }

  /**
   * 메트릭 평가: 검증된 식별자 + 화이트리스트 집계함수 + 파라미터 바인딩 필터만 허용
   * groupBy 지정 시 그룹별 시리즈, 아니면 단일 값 반환
   */
  async evaluate(id: number) {
    const metric = await serializeMetadataWork(this.metricRepository.manager.connection, () =>
      this.metricRepository.findOne({ where: { id } }),
    );
    if (!metric || metric.useYn === YesNo.NO)
      return { status: ResponseStatus.ERROR, message: '메트릭을 찾을 수 없습니다.' };

    try {
      const { selectExpr, whereClause, bindings } = this.buildQuery(metric);
      const groupByCol = metric.groupBy || null;
      const selectCols = groupByCol
        ? `${groupByCol}, ${selectExpr} AS value`
        : `${selectExpr} AS value`;
      const sql = `SELECT ${selectCols} FROM ${metric.tableName}${whereClause}${
        groupByCol ? ` GROUP BY ${groupByCol} LIMIT ${MAX_GROUP_ROWS}` : ''
      }`;

      let result: any;
      if (await this.connectionService.isDuckDB?.(metric.databaseId)) {
        result = (await this.connectionService.queryDuckDB(metric.databaseId, sql, bindings)).datas;
      } else {
        const knex = await this.connectionService.getKnex(metric.databaseId);
        const timeoutMs = parseInt(process.env.QUERY_TIMEOUT_MS) || 60000;
        let rawQuery = knex.raw(sql, bindings);
        try {
          rawQuery = rawQuery.timeout(timeoutMs) as any;
        } catch {
          // timeout 미지원 드라이버는 그대로 실행
        }
        result = await rawQuery;
      }

      // 드라이버별 결과 형태 정규화
      const rows = Array.isArray(result)
        ? Array.isArray(result[0])
          ? result[0]
          : result
        : result?.rows ?? [];
      return {
        status: ResponseStatus.SUCCESS,
        data: { metric: this.parseFilters(metric), result: rows },
      };
    } catch (e) {
      console.error(e);
      return { status: ResponseStatus.ERROR, message: e.sqlMessage || e.message };
    }
  }

  /**
   * 메트릭 정의를 안전한 SQL 조각으로 변환.
   * 모든 식별자는 assertSafeIdentifier 통과 필수, 필터 값은 바인딩 처리.
   */
  private buildQuery(metric: Metric): { selectExpr: string; whereClause: string; bindings: any[] } {
    assertSafeIdentifier(metric.tableName);
    if (!Object.values(MetricAggregation).includes(metric.aggregation)) {
      throw new Error(`unsupported aggregation: ${metric.aggregation}`);
    }
    const selectExpr =
      metric.aggregation === MetricAggregation.COUNT
        ? 'COUNT(*)'
        : metric.aggregation === MetricAggregation.COUNT_DISTINCT
        ? (assertSafeIdentifier(metric.expression), `COUNT(DISTINCT ${metric.expression})`)
        : (assertSafeIdentifier(metric.expression), `${metric.aggregation}(${metric.expression})`);

    if (metric.groupBy) assertSafeIdentifier(metric.groupBy);

    let whereClause = '';
    const bindings: any[] = [];
    const filters = this.parseFilters(metric).filters || [];
    if (filters.length > 0) {
      const clauses = filters.map((f: MetricFilter) => {
        assertSafeIdentifier(f.column);
        if (!ALLOWED_OPS.has(f.op)) {
          throw new Error(`unsupported operator: ${f.op}`);
        }
        if (f.op === 'IN') {
          const values = Array.isArray(f.value) ? f.value : [f.value];
          if (values.length === 0) throw new Error('IN filter requires values');
          bindings.push(...values);
          return `${f.column} IN (${values.map(() => '?').join(',')})`;
        }
        bindings.push(f.value);
        return `${f.column} ${f.op} ?`;
      });
      whereClause = ` WHERE ${clauses.join(' AND ')}`;
    }
    return { selectExpr, whereClause, bindings };
  }

  private validateDefinition(dto: CreateMetricDto) {
    if (!dto.name?.trim()) throw new Error('메트릭 이름이 필요합니다.');
    if (!dto.databaseId) throw new Error('databaseId가 필요합니다.');
    assertSafeIdentifier(dto.tableName);
    assertSafeIdentifier(dto.expression);
    if (dto.groupBy) assertSafeIdentifier(dto.groupBy);
    if (!Object.values(MetricAggregation).includes(dto.aggregation)) {
      throw new Error(`unsupported aggregation: ${dto.aggregation}`);
    }
    (dto.filters || []).forEach(f => {
      assertSafeIdentifier(f.column);
      if (!ALLOWED_OPS.has(f.op)) throw new Error(`unsupported operator: ${f.op}`);
      if (f.op === 'IN' && Array.isArray(f.value) && f.value.length === 0) {
        throw new Error('IN filter requires values');
      }
    });
  }

  private parseFilters(metric: Metric): any {
    return {
      ...metric,
      name: metric.definition ? JSON.parse(metric.definition).label : metric.name,
      filters: metric.filters ? JSON.parse(metric.filters as unknown as string) : [],
    };
  }
}
