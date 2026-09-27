import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

  async findAll() {
    const metrics = await this.metricRepository.find({ where: { useYn: YesNo.YES } });
    return { status: ResponseStatus.SUCCESS, data: metrics.map(m => this.parseFilters(m)) };
  }

  async findOne(id: number) {
    const metric = await this.metricRepository.findOne({ where: { id } });
    if (!metric) return { status: ResponseStatus.ERROR, message: '메트릭을 찾을 수 없습니다.' };
    return { status: ResponseStatus.SUCCESS, data: this.parseFilters(metric) };
  }

  async create(dto: CreateMetricDto) {
    try {
      this.validateDefinition(dto);
      const metric = this.metricRepository.create({
        ...dto,
        filters: dto.filters ? JSON.stringify(dto.filters) : null,
      });
      const saved = await this.metricRepository.save(metric);
      return { status: ResponseStatus.SUCCESS, data: this.parseFilters(saved) };
    } catch (e) {
      return { status: ResponseStatus.ERROR, message: e.message };
    }
  }

  async update(id: number, dto: UpdateMetricDto) {
    const metric = await this.metricRepository.findOne({ where: { id } });
    if (!metric) return { status: ResponseStatus.ERROR, message: '메트릭을 찾을 수 없습니다.' };
    try {
      const merged = { ...this.parseFilters(metric), ...dto };
      this.validateDefinition(merged as CreateMetricDto);
      if (dto.filters !== undefined) {
        (dto as any).filters = dto.filters ? JSON.stringify(dto.filters) : null;
      }
      await this.metricRepository.update(id, dto as any);
      return { status: ResponseStatus.SUCCESS, data: { id } };
    } catch (e) {
      return { status: ResponseStatus.ERROR, message: e.message };
    }
  }

  async remove(id: number) {
    const result = await this.metricRepository.update(id, { useYn: YesNo.NO });
    if (result.affected === 0)
      return { status: ResponseStatus.ERROR, message: '메트릭을 찾을 수 없습니다.' };
    return { status: ResponseStatus.SUCCESS, data: { id } };
  }

  /**
   * 메트릭 평가: 검증된 식별자 + 화이트리스트 집계함수 + 파라미터 바인딩 필터만 허용
   * groupBy 지정 시 그룹별 시리즈, 아니면 단일 값 반환
   */
  async evaluate(id: number) {
    const metric = await this.metricRepository.findOne({ where: { id } });
    if (!metric) return { status: ResponseStatus.ERROR, message: '메트릭을 찾을 수 없습니다.' };

    try {
      const { selectExpr, whereClause, bindings } = this.buildQuery(metric);
      const groupByCol = metric.groupBy || null;
      const selectCols = groupByCol
        ? `${groupByCol}, ${selectExpr} AS value`
        : `${selectExpr} AS value`;
      const sql = `SELECT ${selectCols} FROM ${metric.tableName}${whereClause}${
        groupByCol ? ` GROUP BY ${groupByCol} LIMIT ${MAX_GROUP_ROWS}` : ''
      }`;

      const knex = await this.connectionService.getKnex(metric.databaseId);
      const timeoutMs = parseInt(process.env.QUERY_TIMEOUT_MS) || 60000;
      let rawQuery = knex.raw(sql, bindings);
      try {
        rawQuery = rawQuery.timeout(timeoutMs) as any;
      } catch {
        // timeout 미지원 드라이버는 그대로 실행
      }
      const result = await rawQuery;

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
    });
  }

  private parseFilters(metric: Metric): any {
    return {
      ...metric,
      filters: metric.filters ? JSON.parse(metric.filters as unknown as string) : [],
    };
  }
}
