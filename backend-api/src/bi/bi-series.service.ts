import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import {
  normalizeSourceFilters,
  numericSourceColumns,
  positiveId,
  quoteColumn,
  SourceFilter,
  sourceQuery,
} from '../ai/dashboard-draft';
import { validateDateRange } from '../ai/dashboard-date-range';
import { ConnectionService } from '../connection/connection.service';
import { BiService } from './bi.service';

const MEASURE_LIMIT = 6;
const VALUE_LIMIT = 4;
const POINT_LIMIT = 400;
const PROBE = 'SELECT 1 AS "__vm_series_probe" FROM source';
const SERIES_VALUE_LIMIT = 50;
const VALUE_FIELDS = ['sourceId', 'sourceRevision', 'column', 'search', 'filters', 'dateRange'];
const VALUE_SEARCH_PARAMETER = "'__vm_series_value_search__'";
const FIELDS = [
  'sourceId',
  'sourceRevision',
  'measureIds',
  'dimensionColumn',
  'dimensionValues',
  'filters',
  'dateRange',
  'grain',
];
type Grain = 'day' | 'week' | 'month';

/** Owner-only, exact aggregate comparison for a bounded set of dimension values. */
@Injectable()
export class BiSeriesService {
  constructor(private readonly bi: BiService, private readonly connection: ConnectionService) {}

  private fields(value: unknown, allowed: string[] = FIELDS) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new BadRequestException('invalid request body');
    const unknown = Object.keys(value).find(key => !allowed.includes(key));
    if (unknown) throw new BadRequestException(`unsupported field: ${unknown}`);
    return value as Record<string, any>;
  }

  private expression(sql: string) {
    const match = /^SELECT ([\s\S]+?) AS value FROM source$/.exec(String(sql || '').trim());
    if (!match) throw new BadRequestException('저장 지표 정의를 확인해 주세요.');
    return match[1].trim();
  }

  private scalar(value: unknown): number | string | null {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return value;
    return null;
  }

  private utcDateRange(value: unknown) {
    if (value === undefined) return undefined;
    const dateRange = validateDateRange(value);
    if (dateRange.timeZone !== undefined && dateRange.timeZone !== 'UTC')
      throw new BadRequestException('차원 추세 비교는 UTC 기간만 지원합니다.');
    return dateRange;
  }

  async values(body: unknown, actor: number) {
    const input = this.fields(body, VALUE_FIELDS);
    const sourceId = positiveId(input.sourceId);
    if (
      typeof input.sourceRevision !== 'string' ||
      !input.sourceRevision ||
      input.sourceRevision.length > 256
    )
      throw new BadRequestException('sourceRevision is required');
    if (typeof input.column !== 'string' || !input.column.trim() || input.column.length > 128)
      throw new BadRequestException('invalid column');
    const search = input.search === undefined ? '' : input.search;
    if (typeof search !== 'string' || search.length > 200)
      throw new BadRequestException('search must be at most 200 characters');
    const filters: SourceFilter[] = normalizeSourceFilters(
      input.filters === undefined ? [] : input.filters,
    );
    const dateRange = this.utcDateRange(input.dateRange);

    // Prove source access before opening the pinned file, then bind every result to its revision.
    await this.bi.metrics(sourceId, actor);
    return this.connection.withDuckDBSnapshot(sourceId, async () => {
      const profile = await this.bi.profile(sourceId, actor);
      if (!profile.supported)
        throw new BadRequestException('서버에 저장한 DuckDB 파일을 선택해 주세요.');
      const sourceRevision = await this.connection.duckDBVersion(sourceId);
      if (sourceRevision !== input.sourceRevision)
        throw new ConflictException(
          '파일 버전이 변경되었습니다. 카탈로그를 다시 불러온 뒤 다시 시도해 주세요.',
        );
      const columns = profile.columns.map((column: any) => column.name);
      if (!columns.includes(input.column)) throw new BadRequestException('unknown column');
      const temporal = profile.columns
        .filter((column: any) => column.temporal)
        .map((column: any) => column.name);
      const numeric = numericSourceColumns(
        profile.columns.map((column: any) => ({
          column_name: column.name,
          column_type: column.type,
        })),
      );
      const quoted = quoteColumn(input.column);
      const predicate = search
        ? ` WHERE lower(CAST(${quoted} AS VARCHAR)) LIKE ${VALUE_SEARCH_PARAMETER} ESCAPE '\\'`
        : '';
      const query = sourceQuery(
        `SELECT DISTINCT ${quoted} AS value FROM source${predicate} ORDER BY 1 LIMIT ${
          SERIES_VALUE_LIMIT + 1
        }`,
        columns,
        filters,
        dateRange,
        temporal,
        numeric,
      );
      const sql = search ? query.sql.replace(VALUE_SEARCH_PARAMETER, '?') : query.sql;
      const pattern = `%${search.toLowerCase().replace(/[\\%_]/g, character => `\\${character}`)}%`;
      const bindings = search ? [...query.bindings, pattern] : query.bindings;
      const rows = (await this.connection.queryDuckDB(sourceId, sql, bindings)).datas;
      const values = rows.map((row: any) => row.value);
      return {
        sourceRevision,
        values: values.slice(0, SERIES_VALUE_LIMIT),
        truncated: values.length > SERIES_VALUE_LIMIT,
      };
    });
  }

  async compare(body: unknown, actor: number) {
    const input = this.fields(body);
    const sourceId = positiveId(input.sourceId);
    if (
      typeof input.sourceRevision !== 'string' ||
      !input.sourceRevision ||
      input.sourceRevision.length > 256
    )
      throw new BadRequestException('sourceRevision is required');
    if (
      !Array.isArray(input.measureIds) ||
      input.measureIds.length < 1 ||
      input.measureIds.length > MEASURE_LIMIT
    )
      throw new BadRequestException('measureIds requires 1 to 6 ids');
    const measureIds = input.measureIds.map(Number);
    if (
      measureIds.some(id => !Number.isSafeInteger(id) || id <= 0) ||
      new Set(measureIds).size !== measureIds.length
    )
      throw new BadRequestException('invalid measureIds');
    if (
      typeof input.dimensionColumn !== 'string' ||
      !input.dimensionColumn.trim() ||
      input.dimensionColumn.length > 128
    )
      throw new BadRequestException('invalid dimensionColumn');
    if (
      !Array.isArray(input.dimensionValues) ||
      input.dimensionValues.length < 1 ||
      input.dimensionValues.length > VALUE_LIMIT
    )
      throw new BadRequestException('dimensionValues requires 1 to 4 values');
    const values = input.dimensionValues;
    if (
      values.some(
        value =>
          value !== null &&
          typeof value !== 'string' &&
          typeof value !== 'boolean' &&
          !(typeof value === 'number' && Number.isFinite(value)),
      )
    )
      throw new BadRequestException('dimension values must be JSON scalars');
    if (new Set(values.map(value => JSON.stringify([typeof value, value]))).size !== values.length)
      throw new BadRequestException('duplicate dimension value');
    const filters: SourceFilter[] = normalizeSourceFilters(
      input.filters === undefined ? [] : input.filters,
    );
    const dateRange = this.utcDateRange(input.dateRange);
    const grain: Grain = input.grain === undefined ? 'day' : input.grain;
    if (!['day', 'week', 'month'].includes(grain))
      throw new BadRequestException('invalid trend grain');

    // Prove ownership before opening a pinned file, including malformed foreign sources.
    const catalog = await this.bi.metrics(sourceId, actor);
    return this.connection.withDuckDBSnapshot(sourceId, async () => {
      const profile = await this.bi.profile(sourceId, actor);
      if (!profile.supported)
        throw new BadRequestException('서버에 저장한 DuckDB 파일을 선택해 주세요.');
      const sourceRevision = await this.connection.duckDBVersion(sourceId);
      if (sourceRevision !== input.sourceRevision)
        throw new ConflictException(
          '파일 버전이 변경되었습니다. 카탈로그를 다시 불러온 뒤 다시 시도해 주세요.',
        );
      const columns: string[] = profile.columns.map((column: any) => column.name);
      if (!columns.includes(input.dimensionColumn))
        throw new BadRequestException('unknown dimension column');
      const temporal = profile.columns
        .filter((column: any) => column.temporal)
        .map((column: any) => column.name);
      const timeColumn = dateRange?.column ?? temporal[0];
      if (!timeColumn || !temporal.includes(timeColumn))
        throw new BadRequestException('a temporal source column is required');
      const numeric = numericSourceColumns(
        profile.columns.map((column: any) => ({
          column_name: column.name,
          column_type: column.type,
        })),
      );
      const known = new Map(catalog.map((measure: any) => [measure.id, measure]));
      const measures = [];
      for (const id of measureIds) {
        const measure: any = known.get(id);
        if (!measure) throw new BadRequestException('unknown measure id');
        const prepared = await this.bi.prepare(
          { sourceId, metricId: id, chart: 'number', title: measure.label },
          actor,
        );
        const widget = prepared.draft.widgets[0];
        measures.push({
          id,
          label: measure.label,
          unit: prepared.definition?.unit ?? '',
          decimalPlaces: widget?.decimalPlaces ?? 0,
          expression: this.expression(widget.sql),
        });
      }
      const filtered = sourceQuery(PROBE, columns, filters, dateRange, temporal, numeric);
      const prefix = filtered.sql.slice(0, -PROBE.length);
      const dimension = quoteColumn(input.dimensionColumn);
      const time = quoteColumn(timeColumn);
      const bucket = `date_trunc('${grain}', CAST(${time} AS TIMESTAMP))`;
      const whereValues = `${dimension} IS NOT DISTINCT FROM ?`;
      const kpiRows = await this.connection.queryDuckDB(
        sourceId,
        `${prefix} SELECT ${dimension} AS "__vm_value", ${measures
          .map((m: any, i) => `${m.expression} AS "m${i}"`)
          .join(', ')} FROM source WHERE ${values
          .map(() => `(${whereValues})`)
          .join(' OR ')} GROUP BY 1`,
        [...filtered.bindings, ...values],
      );
      const trendRows = await this.connection.queryDuckDB(
        sourceId,
        `${prefix}, grouped AS (SELECT ${dimension} AS "__vm_value", strftime(${bucket}, '%Y-%m-%d') AS "time", ${measures
          .map((m: any, i: number) => `${m.expression} AS "m${i}"`)
          .join(', ')} FROM source WHERE ${values
          .map(() => `(${whereValues})`)
          .join(
            ' OR ',
          )} GROUP BY 1, 2), ranked AS (SELECT *, row_number() OVER (PARTITION BY "__vm_value" ORDER BY "time") AS "__vm_rank" FROM grouped) SELECT * FROM ranked WHERE "__vm_rank" <= ${
          POINT_LIMIT + 1
        } ORDER BY "time", "__vm_value"`,
        [...filtered.bindings, ...values],
      );
      const kpiByValue = new Map(
        kpiRows.datas.map((row: any) => [
          JSON.stringify([typeof row.__vm_value, row.__vm_value]),
          row,
        ]),
      );
      const pointsByValue = new Map<string, any[]>();
      const truncatedValues = new Set<string>();
      for (const row of trendRows.datas) {
        if (row.time == null) continue;
        const key = JSON.stringify([typeof row.__vm_value, row.__vm_value]);
        const points = pointsByValue.get(key) ?? [];
        if (points.length < POINT_LIMIT)
          points.push({
            time: String(row.time),
            values: measures.map((m: any, i: number) => ({
              id: m.id,
              value: this.scalar(row[`m${i}`]),
            })),
          });
        else truncatedValues.add(key);
        pointsByValue.set(key, points);
      }

      const series = values.map((value: any) => {
        const key = JSON.stringify([typeof value, value]);
        const row: any = kpiByValue.get(key);
        return {
          value,
          label: value === null ? '(값 없음)' : value === '' ? '(빈 문자열)' : String(value),
          kpis: measures.map((measure: any, i: number) => ({
            id: measure.id,
            value: this.scalar(row?.[`m${i}`]),
            unit: measure.unit,
            decimalPlaces: measure.decimalPlaces,
          })),
          points: pointsByValue.get(key) ?? [],
          truncated: truncatedValues.has(key),
        };
      });
      return {
        sourceRevision,
        dimensionColumn: input.dimensionColumn,
        time: { column: timeColumn, grain, timeZone: 'UTC' },
        filters,
        ...(dateRange ? { dateRange } : {}),
        measures: measures.map(({ id, label, unit, decimalPlaces }: any) => ({
          id,
          label,
          unit,
          decimalPlaces,
        })),
        series,
      };
    });
  }
}
