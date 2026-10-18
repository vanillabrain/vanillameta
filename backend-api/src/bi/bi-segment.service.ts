import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { EXPORT_MIME, ExportEntry, toCsv } from './bi-explore-export';
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
import { exploreViewRevision } from './explore-view-state';

const MAX_MEASURES = 6;
const MAX_CONDITIONS = 3;
const MAX_PAGE = 10000;
const MAX_PAGE_SIZE = 50;
/** One extra group proves truncation without materialising the whole qualified list. */
const GROUP_LIMIT = 50;
const GROUP_PROBE = GROUP_LIMIT + 1;
const TREND_LIMIT = 200;
const TREND_PROBE = TREND_LIMIT + 1;
const DETAIL_COLUMNS = 50;
const DIMENSION_ALIAS = '__vm_seg_dim';
/**
 * Probe SELECT that passes the shared SELECT grammar so sourceQuery can emit the filtered
 * `WITH source AS (...)` prefix and bind the filter/date values. The body appended afterwards is
 * entirely server-generated from catalog columns, canonical metric text and bound numbers.
 */
const PROBE_SQL = 'SELECT 1 AS "__vm_seg_probe" FROM source';
/** Fixed comparison tokens; the number always travels as a bound parameter. */
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

  /** JSON primitives only: a non-numeric cell is reported as null, never NaN. */
  private scalar(value: unknown): number | string | null {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return value;
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
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
    const columns: string[] = profile.columns.map((column: any) => column.name);
    if (!columns.includes(input.dimensionColumn))
      throw new BadRequestException('unknown dimension column');
    const temporal: string[] = profile.columns
      .filter((column: any) => column.temporal)
      .map((column: any) => column.name);
    const numeric = numericSourceColumns(
      profile.columns.map((column: any) => ({
        column_name: column.name,
        column_type: column.type,
      })),
    );
    if (
      input.pivotColumn &&
      (input.pivotColumn === input.dimensionColumn ||
        !columns.includes(input.pivotColumn) ||
        temporal.includes(input.pivotColumn) ||
        numeric.includes(input.pivotColumn))
    )
      throw new BadRequestException('Pivot 열은 집계 대상과 다른 범주 열을 선택해 주세요.');
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

    const filtered = sourceQuery(
      PROBE_SQL,
      columns,
      input.filters,
      input.dateRange,
      temporal,
      numeric,
    );
    const prefix = filtered.sql.slice(0, -PROBE_SQL.length);
    const bindings = [...filtered.bindings, ...input.conditions.map(condition => condition.value)];
    const dimension = quoteColumn(input.dimensionColumn);
    const aggregate = (alias: (index: number) => string) =>
      measures
        .map((measure, index) => `${measure.expression} AS ${quoteColumn(alias(index))}`)
        .join(', ');
    const having = input.conditions
      .map(condition => {
        const index = measures.findIndex(measure => measure.id === condition.measureId);
        return `(${measures[index].expression} ${OPERATORS[condition.operator]} ?)`;
      })
      .join(' AND ');
    // Qualification is complete before any limit and repeats from the current filtered period.
    const eligible = `, eligible AS (SELECT ${dimension} AS ${quoteColumn(
      DIMENSION_ALIAS,
    )}, ${aggregate(i => `__vm_seg_m${i}`)} FROM source GROUP BY 1 HAVING ${having})`;
    // NULL dimension values must join their own qualified group instead of disappearing, and the
    // projection keeps only source columns so a source column named like an eligible alias stays
    // unambiguous for every canonical expression below.
    const scoped =
      `, scoped_rows AS (SELECT s.* FROM source s JOIN eligible e ON s.${dimension}` +
      ` IS NOT DISTINCT FROM e.${quoteColumn(DIMENSION_ALIAS)})`;
    const run = async (sql: string, extraBindings: any[] = []) =>
      (
        await this.connection.queryDuckDB(
          profile.sourceId,
          `${prefix}${eligible}${scoped} ${sql}`,
          [...bindings, ...extraBindings],
        )
      ).datas;

    const assertCurrent = async () => {
      const current = await this.bi.metrics(input.sourceId, input.actor);
      if (JSON.stringify(definitions(current)) !== metricSnapshot)
        throw new ConflictException('지표 정의가 변경되었습니다. 다시 적용해 주세요.');
      if (input.catalogRevision && definitionRevision(current) !== input.catalogRevision)
        throw new ConflictException(
          '저장한 Pivot의 지표·열 정의가 변경되었습니다. 다시 불러와 주세요.',
        );
    };
    if (input.detailSelection) {
      const selection = input.detailSelection;
      const predicates: string[] = [];
      const values: any[] = [];
      if (Object.prototype.hasOwnProperty.call(selection, 'row')) {
        predicates.push(`${dimension} IS NOT DISTINCT FROM ?`);
        values.push(selection.row);
      }
      if (Object.prototype.hasOwnProperty.call(selection, 'column')) {
        predicates.push(`${quoteColumn(input.pivotColumn)} IS NOT DISTINCT FROM ?`);
        values.push(selection.column);
      }
      const where = predicates.join(' AND ') || 'TRUE';
      const totals = (
        await run(
          `SELECT CAST(COUNT(*) AS VARCHAR) AS "__vm_count", ${aggregate(
            i => `__vm_detail_k${i}`,
          )} FROM scoped_rows WHERE ${where}`,
          values,
        )
      )[0];
      const selected = columns.slice(0, DETAIL_COLUMNS);
      const rows = await run(
        `SELECT ${selected
          .map(
            (column, index) => `${quoteColumn(column)} AS ${quoteColumn(`__vm_detail_${index}`)}`,
          )
          .join(', ')} FROM scoped_rows WHERE ${where} ORDER BY ALL LIMIT ${
          input.pageSize
        } OFFSET ${input.page * input.pageSize}`,
        values,
      );
      await assertCurrent();
      return {
        selection,
        sourceRevision,
        viewRevision,
        kpis: measures.map((measure, index) => ({
          id: measure.id,
          label: measure.label,
          unit: measure.unit,
          decimalPlaces: measure.decimalPlaces,
          value: this.scalar(totals[`__vm_detail_k${index}`]),
        })),
        details: {
          rows: rows.map(row =>
            Object.fromEntries(
              selected.map((column, index) => [column, row[`__vm_detail_${index}`]]),
            ),
          ),
          totalRows: String(totals.__vm_count),
          page: input.page,
          pageSize: input.pageSize,
        },
      };
    }

    // Grand KPIs reaggregate the canonical text over the qualified rows, never over group values.
    const kpiRows = await run(`SELECT ${aggregate(i => `__vm_seg_k${i}`)} FROM scoped_rows`);
    const groupRows = await run(
      `SELECT ${quoteColumn(DIMENSION_ALIAS)} AS ${quoteColumn('category')}, ${measures
        .map(
          (_measure, index) =>
            `${quoteColumn(`__vm_seg_m${index}`)} AS ${quoteColumn(`value${index}`)}`,
        )
        .join(', ')} FROM eligible ORDER BY ${quoteColumn('value0')} DESC NULLS LAST, ${quoteColumn(
        'category',
      )} ASC NULLS LAST LIMIT ${GROUP_PROBE}`,
    );
    const totalGroups = (await run('SELECT CAST(COUNT(*) AS VARCHAR) AS "total" FROM eligible'))[0]
      .total;
    const scopedRowCount = (
      await run('SELECT CAST(COUNT(*) AS VARCHAR) AS "total" FROM scoped_rows')
    )[0].total;

    const kpis = measures.map((measure, index) => ({
      id: measure.id,
      label: measure.label,
      value: this.scalar(kpiRows[0]?.[`__vm_seg_k${index}`]),
      unit: measure.unit,
      decimalPlaces: measure.decimalPlaces,
    }));
    const groups = groupRows.slice(0, GROUP_LIMIT).map(row => ({
      category: row.category ?? null,
      values: measures.map((measure, index) => ({
        id: measure.id,
        value: this.scalar(row[`value${index}`]),
      })),
    }));

    // Qualification remains over all source rows per original dimension. Only the displayed
    // axes are bounded; cells/row/column/grand totals reaggregate the canonical expressions.
    let pivot:
      | {
          column: string;
          columns: Array<{
            value: unknown;
            totals: Array<{ id: number; value: number | string | null }>;
          }>;
          rows: Array<{
            category: unknown;
            cells: Array<{
              column: unknown;
              values: Array<{ id: number; value: number | string | null }>;
            }>;
          }>;
          truncatedColumns: boolean;
          columnLimit: number;
        }
      | undefined;
    if (input.pivotColumn) {
      const pivotAxis = quoteColumn(input.pivotColumn);
      const columnRows = await run(
        `SELECT ${pivotAxis} AS category, ${aggregate(
          i => `__vm_pivot_${i}`,
        )} FROM scoped_rows GROUP BY 1 ORDER BY 1 ASC NULLS LAST LIMIT 21`,
      );
      const displayedColumns = columnRows.slice(0, 20);
      const cells = await run(
        `SELECT ${dimension} AS row_category, ${pivotAxis} AS column_category, ${aggregate(
          i => `__vm_cell_${i}`,
        )} FROM scoped_rows WHERE EXISTS (SELECT 1 FROM (SELECT ${quoteColumn(
          DIMENSION_ALIAS,
        )} FROM eligible ORDER BY ${quoteColumn('__vm_seg_m0')} DESC NULLS LAST, ${quoteColumn(
          DIMENSION_ALIAS,
        )} ASC NULLS LAST LIMIT ${GROUP_LIMIT}) displayed_rows WHERE scoped_rows.${dimension} IS NOT DISTINCT FROM displayed_rows.${quoteColumn(
          DIMENSION_ALIAS,
        )}) AND EXISTS (SELECT 1 FROM (SELECT ${pivotAxis} AS "__vm_pcol" FROM scoped_rows GROUP BY 1 ORDER BY 1 ASC NULLS LAST LIMIT 20) displayed_columns WHERE scoped_rows.${pivotAxis} IS NOT DISTINCT FROM displayed_columns."__vm_pcol") GROUP BY 1,2 ORDER BY 1,2 LIMIT 1001`,
      );
      // Use null-safe JOINs rather than category string coercion; a NULL and literal 'null' differ.
      pivot = {
        column: input.pivotColumn,
        columns: displayedColumns.map(row => ({
          value: row.category ?? null,
          totals: measures.map((m, i) => ({
            id: m.id,
            value: this.scalar(row[`__vm_pivot_${i}`]),
          })),
        })),
        rows: groups.map(group => ({
          category: group.category,
          cells: displayedColumns.map(column => ({
            column: column.category ?? null,
            values: measures.map((m, i) => ({
              id: m.id,
              value: this.scalar(
                cells.find(
                  row =>
                    (row.row_category ?? null) === group.category &&
                    (row.column_category ?? null) === (column.category ?? null),
                )?.[`__vm_cell_${i}`],
              ),
            })),
          })),
        })),
        truncatedColumns: columnRows.length > 20,
        columnLimit: 20,
      };
    }

    const timeColumn: string | undefined = temporal[0];
    const trends: Array<{
      time: string;
      values: Array<{ id: number; value: number | string | null }>;
    }> = [];
    let trendsTruncated = false;
    if (timeColumn) {
      const bucket = `date_trunc('${input.trendGrain}', ${quoteColumn(timeColumn)})`;
      const trendRows = await run(
        `SELECT strftime(${bucket}, '%Y-%m-%d') AS ${quoteColumn('time')}, ${aggregate(
          i => `__vm_seg_t${i}`,
        )} FROM scoped_rows GROUP BY 1 ORDER BY 1 LIMIT ${TREND_PROBE}`,
      );
      trendsTruncated = trendRows.length > TREND_LIMIT;
      for (const row of trendRows.slice(0, TREND_LIMIT)) {
        // An unset timestamp is not a trend point; it must never surface as the string 'null'.
        if (row.time === null || row.time === undefined) continue;
        trends.push({
          time: String(row.time),
          values: measures.map((measure, index) => ({
            id: measure.id,
            value: this.scalar(row[`__vm_seg_t${index}`]),
          })),
        });
      }
    }

    const selected = columns.slice(0, DETAIL_COLUMNS);
    const detailRows = input.aggregateOnly
      ? []
      : await run(
          `SELECT ${selected
            .map(
              (column, index) => `${quoteColumn(column)} AS ${quoteColumn(`__vm_detail_${index}`)}`,
            )
            .join(', ')} FROM scoped_rows ORDER BY ALL LIMIT ${input.pageSize} OFFSET ${
            input.page * input.pageSize
          }`,
        );
    const details = {
      rows: detailRows.map((row: any) =>
        Object.fromEntries(selected.map((column, index) => [column, row[`__vm_detail_${index}`]])),
      ),
      totalRows: String(scopedRowCount),
      page: input.page,
      pageSize: input.pageSize,
    };

    await assertCurrent();
    return {
      viewRevision,
      ...(pivot ? { pivot } : {}),
      sourceRevision,
      scope: {
        dimensionColumn: input.dimensionColumn,
        conditions: input.conditions,
        filters: input.filters,
        ...(input.dateRange !== undefined ? { dateRange: input.dateRange } : {}),
        totalGroups: String(totalGroups),
        rows: String(scopedRowCount),
      },
      kpis,
      groups,
      groupsTruncated: groupRows.length > GROUP_LIMIT,
      trends,
      trendsTruncated,
      time: timeColumn ? { column: timeColumn, grain: input.trendGrain, timeZone: 'UTC' } : null,
      details,
    };
  }
}
