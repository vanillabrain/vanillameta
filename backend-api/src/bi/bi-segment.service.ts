import { executePreparedSegment, GROUP_LIMIT, TREND_LIMIT } from './bi-segment-engine';
import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { EXPORT_MIME, ExportEntry, toCsv } from './bi-explore-export';
import { normalizeSourceFilters, positiveId, SourceFilter } from '../ai/dashboard-draft';
import { validateDateRange } from '../ai/dashboard-date-range';
import { ConnectionService } from '../connection/connection.service';
import { BiService } from './bi.service';
import { exploreViewRevision } from './explore-view-state';

const MAX_MEASURES = 6;
const MAX_CONDITIONS = 3;
const MAX_PAGE = 10000;
const MAX_PAGE_SIZE = 50;
const OPERATORS: Record<string, string> = { gte: '>=', gt: '>', lte: '<=', lt: '<', eq: '=' };
const GRAINS = ['day', 'week', 'month'];
const REQUEST_FIELDS = [
  'sourceId',
  'sourceRevision',
  'catalogRevision',
  'dimensionColumn',
  'pivotColumn',
  'measureIds',
  'conditions',
  'filters',
  'dateRange',
  'trendGrain',
  'page',
  'pageSize',
];

type SegmentSelection = {
  row?: string | number | boolean | null;
  column?: string | number | boolean | null;
};

type SegmentCondition = { measureId: number; operator: string; value: number };
type SegmentMeasure = {
  id: number;
  label: string;
  unit: string;
  decimalPlaces: number;
  expression: string;
};

/**
 * Owner-only aggregate segment endpoint. Qualification always runs over the current filtered
 * period: the eligible CTE groups the filtered source by one dimension and applies every
 * comparison in HAVING before any limit, then KPIs, details and trends are reaggregated from the
 * canonical metric text over the qualified rows only (never by summing group-level values).
 */
@Injectable()
export class BiSegmentService {
  constructor(private readonly bi: BiService, private readonly connection: ConnectionService) {}

  /** Strict request schema: an unknown field is a client bug, not a silent extra. */
  private fields(input: unknown, allowed: string[]) {
    if (!input || typeof input !== 'object' || Array.isArray(input))
      throw new BadRequestException('invalid request body');
    const unknown = Object.keys(input).find(key => !allowed.includes(key));
    if (unknown) throw new BadRequestException(`unsupported field: ${unknown}`);
    return input as Record<string, any>;
  }

  private revision(value: unknown) {
    if (typeof value !== 'string' || !value || value.length > 256)
      throw new BadRequestException('sourceRevision is required');
    return value;
  }

  private measureIds(value: unknown) {
    if (!Array.isArray(value) || !value.length || value.length > MAX_MEASURES)
      throw new BadRequestException('measureIds requires 1 to 6 ids');
    const seen = new Set<number>();
    return value.map(candidate => {
      if (!Number.isSafeInteger(candidate) || Number(candidate) <= 0)
        throw new BadRequestException('invalid measure id');
      const id = Number(candidate);
      if (seen.has(id)) throw new BadRequestException('duplicate measure id');
      seen.add(id);
      return id;
    });
  }

  private dimensionColumn(value: unknown) {
    if (typeof value !== 'string' || !value.trim() || value.length > 128)
      throw new BadRequestException('invalid dimension column');
    return value;
  }

  /** Every compared measure must be one of the selected ids, so no hidden column is aggregated. */
  private conditions(value: unknown, measureIds: number[]): SegmentCondition[] {
    if (!Array.isArray(value) || !value.length || value.length > MAX_CONDITIONS)
      throw new BadRequestException('conditions requires 1 to 3 comparisons');
    return value.map(entry => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry))
        throw new BadRequestException('invalid condition');
      if (Object.keys(entry).some(key => !['measureId', 'operator', 'value'].includes(key)))
        throw new BadRequestException('unsupported condition field');
      const measureId = Number((entry as any).measureId);
      if (!Number.isSafeInteger(measureId) || !measureIds.includes(measureId))
        throw new BadRequestException('condition measureId must be one of the selected measures');
      const operator = (entry as any).operator;
      if (
        typeof operator !== 'string' ||
        !Object.prototype.hasOwnProperty.call(OPERATORS, operator)
      )
        throw new BadRequestException('invalid condition operator');
      const raw = (entry as any).value;
      if (typeof raw !== 'number' || !Number.isFinite(raw))
        throw new BadRequestException('invalid condition value');
      return { measureId, operator, value: raw };
    });
  }

  /** Shape and bounds come from normalizeSourceFilters; sourceQuery authorizes columns and types. */
  private filters(value: unknown): SourceFilter[] {
    return normalizeSourceFilters(value === undefined ? [] : (value as any[]));
  }

  private grain(value: unknown) {
    if (value === undefined) return 'day';
    if (typeof value !== 'string' || !GRAINS.includes(value))
      throw new BadRequestException('invalid trend grain');
    return value as 'day' | 'week' | 'month';
  }

  private page(value: unknown) {
    const page = value === undefined ? 0 : value;
    if (!Number.isInteger(page) || Number(page) < 0 || Number(page) > MAX_PAGE)
      throw new BadRequestException('invalid page');
    return Number(page);
  }

  private pageSize(value: unknown) {
    const size = value === undefined ? 25 : value;
    if (!Number.isInteger(size) || Number(size) < 1 || Number(size) > MAX_PAGE_SIZE)
      throw new BadRequestException('invalid pageSize');
    return Number(size);
  }

  /** Canonical aggregate from BiService.prepare's generated number widget (never re-derived here). */
  private expression(sql: string) {
    const match = /^SELECT ([\s\S]+?) AS value FROM source$/.exec(String(sql || '').trim());
    if (!match) throw new BadRequestException('저장 지표 정의를 확인해 주세요.');
    return match[1].trim();
  }

  async exportCsv(body: any, actor: number) {
    const input = this.fields(body, [...REQUEST_FIELDS, 'viewRevision']);
    if (typeof input.viewRevision !== 'string' || !/^[a-f0-9]{64}$/.test(input.viewRevision))
      throw new BadRequestException('적용된 집계 결과를 먼저 불러와 주세요.');
    const { viewRevision, ...query } = input;
    const result = await this.segments(query, actor, viewRevision, true);
    const entries: ExportEntry[] = [];
    const append = (
      section: string,
      axis: Record<string, unknown> | null,
      values: Array<{ id: number; value: any }>,
    ) => {
      for (const value of values) {
        const metric = result.kpis.find(candidate => candidate.id === value.id);
        entries.push({
          section,
          rowAxis: axis,
          columnAxis: null,
          measureId: value.id,
          measureLabel: metric.label,
          value: value.value,
        });
      }
    };
    append('kpi', null, result.kpis);
    for (const group of result.groups)
      append('group', { [result.scope.dimensionColumn]: group.category }, group.values);
    for (const point of result.trends) append('trend', { time: point.time }, point.values);
    if (result.pivot) {
      const addPivot = (
        section: string,
        rowAxis: Record<string, unknown> | null,
        column: unknown,
        values: Array<{ id: number; value: any }>,
      ) => {
        for (const value of values)
          entries.push({
            section,
            rowAxis,
            columnAxis: { [result.pivot.column]: column },
            measureId: value.id,
            measureLabel: result.kpis.find(m => m.id === value.id).label,
            value: value.value,
          });
      };
      for (const row of result.pivot.rows)
        for (const cell of row.cells)
          addPivot(
            'pivot_cell',
            { [result.scope.dimensionColumn]: row.category },
            cell.column,
            cell.values,
          );
      for (const column of result.pivot.columns)
        addPivot('pivot_column_total', null, column.value, column.totals);
    }

    return {
      ...toCsv(entries, {
        sourceId: query.sourceId,
        sourceRevision: result.sourceRevision,
        viewRevision: result.viewRevision,
        ...result.scope,
        time: result.time,
        metrics: result.kpis.map(({ id, label, unit, decimalPlaces }) => ({
          id,
          label,
          unit,
          decimalPlaces,
        })),
        ...(result.pivot
          ? {
              pivotColumn: result.pivot.column,
              pivotColumnLimit: result.pivot.columnLimit,
              pivotColumnsTruncated: result.pivot.truncatedColumns,
            }
          : {}),
        groupsTruncated: result.groupsTruncated,
        groupDisplayLimit: GROUP_LIMIT,
        trendsTruncated: result.trendsTruncated,
        trendDisplayLimit: TREND_LIMIT,
        exportScope: 'displayed aggregates; totals cover all qualified rows; no raw rows',
      }),
      sourceRevision: result.sourceRevision,
      viewRevision: result.viewRevision,
      filename: `aggregate-segment-${query.sourceId}.csv`,
      mimeType: EXPORT_MIME,
    };
  }

  async segments(body: any, actor: number, expectedView?: string, aggregateOnly = false) {
    const result = await this.execute(body, actor, expectedView, aggregateOnly);
    if ('selection' in result) throw new Error('unexpected detail result');
    return result;
  }

  /** A read-only drill keeps qualification fixed, and restricts rows only afterwards. */
  async details(body: any, actor: number) {
    const input = this.fields(body, [...REQUEST_FIELDS, 'viewRevision', 'selection']);
    const { selection, viewRevision, ...query } = input;
    if (typeof viewRevision !== 'string' || !/^[a-f0-9]{64}$/.test(viewRevision))
      throw new BadRequestException('적용된 집계 결과를 먼저 불러와 주세요.');
    const chosen = this.fields(selection, ['row', 'column']);
    for (const [key, value] of Object.entries(chosen)) {
      // Same scalar/length contract as source filters, without moving it before HAVING.
      normalizeSourceFilters([{ column: key, values: [value] }], false);
    }
    if ('column' in chosen && !query.pivotColumn)
      throw new BadRequestException('Pivot column is required');
    const result = await this.execute(query, actor, viewRevision, false, chosen);
    if (!('selection' in result)) throw new Error('missing detail result');
    return result;
  }

  private async execute(
    body: any,
    actor: number,
    expectedView?: string,
    aggregateOnly = false,
    detailSelection?: SegmentSelection,
  ) {
    const input = this.fields(body, REQUEST_FIELDS);
    const sourceId = positiveId(input.sourceId);
    const expected = this.revision(input.sourceRevision);
    const catalogRevision =
      input.catalogRevision === undefined ? undefined : this.revision(input.catalogRevision);
    const measureIds = this.measureIds(input.measureIds);
    const conditions = this.conditions(input.conditions, measureIds);
    const dimensionColumn = this.dimensionColumn(input.dimensionColumn);
    const pivotColumn =
      input.pivotColumn === undefined ? undefined : this.dimensionColumn(input.pivotColumn);
    const filters = this.filters(input.filters);
    const dateRange =
      input.dateRange === undefined ? undefined : validateDateRange(input.dateRange);
    const trendGrain = this.grain(input.trendGrain);
    const page = this.page(input.page);
    const pageSize = this.pageSize(input.pageSize);
    // Ownership is proven before a snapshot opens, including for a foreign or broken source.
    const catalog = await this.bi.metrics(sourceId, actor);
    return this.connection.withDuckDBSnapshot(sourceId, () =>
      this.segmentsSnapshot({
        actor,
        sourceId,
        expected,
        catalogRevision,
        measureIds,
        conditions,
        dimensionColumn,
        pivotColumn,
        filters,
        dateRange,
        trendGrain,
        page,
        pageSize,
        catalog,
        expectedView,
        aggregateOnly,
        detailSelection,
      }),
    );
  }

  private async segmentsSnapshot(input: {
    actor: number;
    sourceId: number;
    expected: string;
    catalogRevision?: string;
    measureIds: number[];
    conditions: SegmentCondition[];
    dimensionColumn: string;
    pivotColumn?: string;
    filters: SourceFilter[];
    dateRange: any;
    trendGrain: 'day' | 'week' | 'month';
    page: number;
    pageSize: number;
    catalog: any[];
    expectedView?: string;
    aggregateOnly: boolean;
    detailSelection?: SegmentSelection;
  }) {
    const profile = await this.bi.profile(input.sourceId, input.actor);
    if (!profile.supported)
      throw new BadRequestException('서버에 저장한 DuckDB 파일을 선택해 주세요.');
    const sourceRevision = await this.connection.duckDBVersion(profile.sourceId);
    if (sourceRevision !== input.expected)
      throw new ConflictException(
        '파일 버전이 변경되었습니다. 소스를 새로고침한 뒤 다시 시도해 주세요.',
      );
    const definitionRevision = (measures: any[]) =>
      exploreViewRevision({
        sourceId: profile.sourceId,
        measures: measures.map(m => ({
          id: m.id,
          label: m.label,
          definitionVersion: m.definitionVersion,
          definition: m.definition,
        })),
        dimensions: profile.columns.map(c => ({
          column: c.name,
          type: c.type,
          numeric: c.numeric,
          temporal: c.temporal,
        })),
      });
    if (input.catalogRevision && definitionRevision(input.catalog) !== input.catalogRevision)
      throw new ConflictException(
        '저장한 Pivot의 지표·열 정의가 변경되었습니다. 보기를 갱신한 뒤 다시 추가해 주세요.',
      );
    const known = new Map(input.catalog.map((measure: any) => [measure.id, measure]));
    const definitions = (catalog: any[]) =>
      input.measureIds.map(id => catalog.find(metric => metric.id === id) ?? null);
    const metricSnapshot = JSON.stringify(definitions(input.catalog));
    const viewRevision = createHash('sha256')
      .update(
        JSON.stringify({
          sourceId: input.sourceId,
          actor: input.actor,
          sourceRevision,
          dimension: input.dimensionColumn,
          ...(input.pivotColumn ? { pivotColumn: input.pivotColumn } : {}),
          measures: definitions(input.catalog),
          conditions: input.conditions,
          filters: input.filters,
          dateRange: input.dateRange ?? null,
          grain: input.trendGrain,
        }),
      )
      .digest('hex');
    if (input.expectedView && viewRevision !== input.expectedView)
      throw new ConflictException(
        '집계 조건 또는 지표가 변경되었습니다. 다시 적용한 뒤 조회하거나 내보내세요.',
      );
    const measures: SegmentMeasure[] = [];
    for (const measureId of input.measureIds) {
      if (!known.has(measureId)) throw new BadRequestException('unknown measure id');
      const measure = known.get(measureId);
      const prepared = await this.bi.prepare(
        { sourceId: profile.sourceId, metricId: measureId, chart: 'number', title: measure.label },
        input.actor,
      );
      const widget = prepared.draft.widgets[0];
      if (JSON.stringify(prepared.definition) !== JSON.stringify(measure.definition))
        throw new ConflictException('지표 정의가 변경되었습니다. 다시 적용해 주세요.');
      measures.push({
        id: measureId,
        label: measure.label,
        unit: typeof prepared.definition?.unit === 'string' ? prepared.definition.unit : '',
        decimalPlaces: Number.isInteger(widget?.decimalPlaces) ? widget.decimalPlaces : 0,
        expression: this.expression(widget.sql),
      });
    }

    return executePreparedSegment(
      { ...input, measures },
      {
        profile,
        sourceRevision,
        viewRevision,
        query: async (sql, bindings) =>
          (await this.connection.queryDuckDB(profile.sourceId, sql, bindings)).datas,
        assertCurrent: async () => {
          const current = await this.bi.metrics(input.sourceId, input.actor);
          if (JSON.stringify(definitions(current)) !== metricSnapshot)
            throw new ConflictException('지표 정의가 변경되었습니다. 다시 적용해 주세요.');
          if (input.catalogRevision && definitionRevision(current) !== input.catalogRevision)
            throw new ConflictException(
              '저장한 Pivot의 지표·열 정의가 변경되었습니다. 다시 불러와 주세요.',
            );
        },
      },
    );
  }
}
