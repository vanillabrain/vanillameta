import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { AiDashboardService } from '../ai/ai-dashboard.service';
import { quoteColumn, sourceQuery } from '../ai/dashboard-draft';
import { comparisonValues, previousDateRange, validatePeriodOptions } from '../ai/dashboard-period';
import { ConnectionService } from '../connection/connection.service';
import { BiService } from './bi.service';

const MAX_MEASURES = 6;
const MAX_DIMENSIONS = 4;
const LEADERBOARD_LIMIT = 20;
const MAX_PAGE_SIZE = 50;
const MAX_PAGE = 10000;
const MAX_SEARCH_LENGTH = 200;
const MAX_VALUES = 50;
const DETAIL_COLUMNS = 50;
const MAX_PIVOT_AXIS = 2;
const MAX_PIVOT_ROWS = 50;
const MAX_PIVOT_COLUMNS = 20;
const MAX_PIVOT_CELLS = 6000;
/** Aggregates beyond the exact integer range are suppressed by comparisonValues; sorts must agree. */
const MAX_EXACT = Number.MAX_SAFE_INTEGER;
type RankingSort = { by: 'value' | 'delta' | 'percentChange'; direction: 'asc' | 'desc' };
type ExploreFilter =
  | { column: string; values: any[] }
  | { column: string; range: { min?: number; max?: number } };
type PivotMeasure = { metricId: number; definition: any; expression: string };
type PivotTuple = unknown[];
type PivotValues = Array<number | string | null>;
type PivotGroups = Record<'cells' | 'rows' | 'columns' | 'grand', Map<string, PivotValues>>;
/**
 * sourceQuery validates a deliberately small SELECT grammar that has no parameter token, so the
 * search pattern is written as a sentinel literal during validation and swapped for a bound
 * parameter immediately afterwards.
 */
const SEARCH_PARAMETER = "'__vm_explore_search__'";

const CATALOG_FIELDS = ['sourceId'];
const QUERY_FIELDS = [
  'sourceId',
  'sourceRevision',
  'measureIds',
  'dimensionColumns',
  'rankingMeasureId',
  'rankingSort',
  'filters',
  'dateRange',
  'trendGrain',
  'comparePrevious',
  'page',
  'pageSize',
  'includeRows',
];
const VALUES_FIELDS = ['sourceId', 'sourceRevision', 'column', 'search', 'filters', 'dateRange'];
const PIVOT_FIELDS = [
  'sourceId',
  'sourceRevision',
  'measureIds',
  'rowColumns',
  'columnColumns',
  'filters',
  'dateRange',
  'comparePrevious',
];

/** Dynamic exploration over a managed DuckDB source: catalog, aggregate query and value search. */
@Injectable()
export class BiExploreService {
  constructor(
    private readonly bi: BiService,
    private readonly dashboards: AiDashboardService,
    private readonly connection: ConnectionService,
  ) {}

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

  private dimensions(value: unknown, columns: string[]) {
    if (value === undefined) return [];
    if (!Array.isArray(value) || value.length > MAX_DIMENSIONS)
      throw new BadRequestException('dimensionColumns allows at most 4 columns');
    const seen = new Set<string>();
    return value.map(candidate => {
      if (typeof candidate !== 'string' || !candidate.trim() || candidate.length > 128)
        throw new BadRequestException('invalid dimension column');
      if (!columns.includes(candidate)) throw new BadRequestException('unknown dimension column');
      if (seen.has(candidate)) throw new BadRequestException('duplicate dimension column');
      seen.add(candidate);
      return candidate;
    });
  }

  /** Union of a member list and one inclusive range; a filter is exactly one of the two. */
  private filters(value: unknown): ExploreFilter[] {
    if (value === undefined) return [];
    if (!Array.isArray(value)) throw new BadRequestException('filters must be an array');
    return value.map(filter => {
      if (!filter || typeof filter !== 'object' || Array.isArray(filter))
        throw new BadRequestException('invalid filter');
      const unknown = Object.keys(filter).find(key => !['column', 'values', 'range'].includes(key));
      if (unknown) throw new BadRequestException('unsupported filter field');
      if (typeof filter.column !== 'string' || !filter.column.trim())
        throw new BadRequestException('invalid filter column');
      if ('values' in filter && 'range' in filter)
        throw new BadRequestException('ambiguous filter');
      if ('range' in filter) return { column: filter.column, range: this.range(filter.range) };
      if (!Array.isArray(filter.values) || !filter.values.length)
        throw new BadRequestException('invalid filter values');
      return { column: filter.column, values: filter.values };
    });
  }

  /** Inclusive finite bounds with at least one endpoint and min <= max; strict keys elsewhere. */
  private range(value: unknown) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new BadRequestException('invalid filter range');
    const keys = Object.keys(value);
    if (!keys.length || keys.some(key => key !== 'min' && key !== 'max'))
      throw new BadRequestException('invalid filter range');
    const { min, max } = value as { min?: unknown; max?: unknown };
    if (
      (min === undefined && max === undefined) ||
      (min !== undefined && !Number.isFinite(min)) ||
      (max !== undefined && !Number.isFinite(max)) ||
      (min !== undefined && max !== undefined && (min as number) > (max as number))
    )
      throw new BadRequestException('invalid filter range');
    return {
      ...(min !== undefined ? { min: min as number } : {}),
      ...(max !== undefined ? { max: max as number } : {}),
    };
  }

  /**
   * A range compares raw source values, so only columns the profile reports numeric qualify.
   * Aggregated measure thresholds are a different contract and are not applied here.
   */
  private validateRangeFilters(filters: ExploreFilter[], profile: any) {
    for (const filter of filters) {
      if (!('range' in filter)) continue;
      const column = profile.columns.find((candidate: any) => candidate.name === filter.column);
      if (!column) throw new BadRequestException('unknown filter column');
      if (!column.numeric)
        throw new BadRequestException('숫자 열에만 범위 필터를 적용할 수 있습니다.');
    }
  }

  /** Default is the current measure value descending; change sorts require a compared period. */
  private rankingSort(value: unknown, comparePrevious: boolean): RankingSort {
    if (value === undefined) return { by: 'value', direction: 'desc' };
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new BadRequestException('invalid rankingSort');
    if (Object.keys(value).some(key => key !== 'by' && key !== 'direction'))
      throw new BadRequestException('unsupported rankingSort field');
    const by = (value as any).by ?? 'value';
    const direction = (value as any).direction ?? 'desc';
    if (!['value', 'delta', 'percentChange'].includes(by))
      throw new BadRequestException('invalid rankingSort by');
    if (!['asc', 'desc'].includes(direction))
      throw new BadRequestException('invalid rankingSort direction');
    if (by !== 'value' && !comparePrevious)
      throw new BadRequestException('변화량 정렬에는 이전 기간 비교가 필요합니다.');
    return { by, direction } as RankingSort;
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

  private flag(value: unknown, fallback: boolean, name: string) {
    if (value === undefined) return fallback;
    if (typeof value !== 'boolean') throw new BadRequestException(`invalid ${name}`);
    return value;
  }

  private scalar(value: unknown): number | string | null {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return value;
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }

  /** Canonical aggregate from BiService.prepare's generated number widget (never re-derived here). */
  private expression(sql: string) {
    const match = /^SELECT ([\s\S]+?) AS value FROM source$/.exec(sql.trim());
    if (!match) throw new BadRequestException('저장 지표 정의를 확인해 주세요.');
    return match[1].trim();
  }

  async catalog(body: any, actor: number) {
    const input = this.fields(body, CATALOG_FIELDS);
    return this.connection.withDuckDBSnapshot(input.sourceId, () =>
      this.catalogSnapshot(input, actor),
    );
  }

  private async catalogSnapshot(input: any, actor: number) {
    const profile = await this.bi.profile(input.sourceId, actor);
    if (!profile.supported)
      throw new BadRequestException('서버에 저장한 DuckDB 파일을 선택해 주세요.');
    const measures = await this.bi.metrics(profile.sourceId, actor);
    return {
      sourceId: profile.sourceId,
      name: profile.name,
      sourceRevision: await this.connection.duckDBVersion(profile.sourceId),
      rowCount: profile.rowCount,
      measures: measures.map(measure => ({
        id: measure.id,
        label: measure.label,
        definitionVersion: measure.definitionVersion,
        definition: measure.definition,
      })),
      dimensions: profile.columns.map(column => ({
        column: column.name,
        type: column.type,
        numeric: column.numeric,
        temporal: column.temporal,
      })),
      temporalColumns: profile.columns
        .filter(column => column.temporal)
        .map(column => ({ column: column.name, min: column.min, max: column.max })),
    };
  }

  async query(body: any, actor: number) {
    const input = this.fields(body, QUERY_FIELDS);
    const expected = this.revision(input.sourceRevision);
    const measureIds = this.measureIds(input.measureIds);
    const { trendGrain, comparePrevious } = validatePeriodOptions(input);
    const rankingSort = this.rankingSort(input.rankingSort, comparePrevious);
    const page = this.page(input.page);
    const pageSize = this.pageSize(input.pageSize);
    const includeRows = this.flag(input.includeRows, false, 'includeRows');
    const filters = this.filters(input.filters);
    const dateRange = input.dateRange;
    if (comparePrevious && dateRange === undefined)
      throw new BadRequestException('이전 기간 비교에는 적용한 날짜 범위가 필요합니다.');
    if (
      !Number.isSafeInteger(input.rankingMeasureId) ||
      !measureIds.includes(input.rankingMeasureId)
    )
      throw new BadRequestException('rankingMeasureId must be one of the selected measures');
    const rankingMeasureId = Number(input.rankingMeasureId);
    return this.connection.withDuckDBSnapshot(input.sourceId, () =>
      this.querySnapshot({
        actor,
        sourceId: input.sourceId,
        expected,
        measureIds,
        rankingMeasureId,
        rankingSort,
        dimensionColumns: input.dimensionColumns,
        filters,
        dateRange,
        trendGrain,
        comparePrevious,
        page,
        pageSize,
        includeRows,
      }),
    );
  }

  private async querySnapshot(input: {
    actor: number;
    sourceId: unknown;
    expected: string;
    measureIds: number[];
    rankingMeasureId: number;
    rankingSort: RankingSort;
    dimensionColumns: unknown;
    filters: ExploreFilter[];
    dateRange: any;
    trendGrain: 'auto' | 'day' | 'week' | 'month';
    comparePrevious: boolean;
    page: number;
    pageSize: number;
    includeRows: boolean;
  }) {
    const profile = await this.bi.profile(input.sourceId, input.actor);
    if (!profile.supported)
      throw new BadRequestException('서버에 저장한 DuckDB 파일을 선택해 주세요.');
    const sourceRevision = await this.connection.duckDBVersion(profile.sourceId);
    if (sourceRevision !== input.expected)
      throw new ConflictException(
        '파일 버전이 변경되었습니다. 소스를 새로고침한 뒤 다시 시도해 주세요.',
      );
    const columns = profile.columns.map((column: any) => column.name);
    const temporal = profile.columns
      .filter((column: any) => column.temporal)
      .map((column: any) => column.name);
    this.validateRangeFilters(input.filters, profile);
    const dimensionColumns = this.dimensions(input.dimensionColumns, columns);
    const catalog = await this.bi.metrics(profile.sourceId, input.actor);
    const known = new Map(catalog.map((measure: any) => [measure.id, measure]));
    for (const measureId of input.measureIds)
      if (!known.has(measureId)) throw new BadRequestException('unknown measure id');

    const { measures, widgets } = await this.measureExpressions(
      profile,
      input.measureIds,
      input.actor,
      known,
    );

    const preview = await this.dashboards.preview(
      {
        draft: { databaseId: profile.sourceId, title: 'BI explore', explanation: '', widgets },
        filters: input.filters,
        ...(input.dateRange !== undefined ? { dateRange: input.dateRange } : {}),
        trendGrain: input.trendGrain,
        comparePrevious: input.comparePrevious,
        includeTrends: true,
      },
      input.actor,
    );
    const kpis = measures.map((measure, index) =>
      this.kpi(measure, preview.data.widgets[index], input.comparePrevious),
    );

    const previous =
      input.comparePrevious && input.dateRange !== undefined
        ? previousDateRange(input.dateRange)
        : undefined;
    const leaderboards = [];
    if (dimensionColumns.length) {
      const ranking = measures.find(measure => measure.metricId === input.rankingMeasureId);
      for (const column of dimensionColumns) {
        if (!previous) {
          const sql = this.leaderboardSql(column, ranking.expression, input.rankingSort);
          const currentQuery = sourceQuery(sql, columns, input.filters, input.dateRange, temporal);
          const current = await this.connection.queryDuckDB(
            profile.sourceId,
            currentQuery.sql,
            currentQuery.bindings,
          );
          leaderboards.push(this.leaderboard(column, current.datas));
        } else {
          // Join complete aggregates before limiting; a current leader may rank far lower previously.
          const groupedSql = `SELECT ${quoteColumn(column)} AS "__vm_category", ${
            ranking.expression
          } AS "__vm_value" FROM source GROUP BY 1`;
          const current = sourceQuery(
            groupedSql,
            columns,
            input.filters,
            input.dateRange,
            temporal,
          );
          const prior = sourceQuery(groupedSql, columns, input.filters, previous, temporal);
          const joined = this.joinLeaderboardSql(current, prior, input.rankingSort);
          const result = await this.connection.queryDuckDB(
            profile.sourceId,
            joined.sql,
            joined.bindings,
          );
          leaderboards.push({
            column,
            truncated: result.datas.length > LEADERBOARD_LIMIT,
            rows: result.datas.slice(0, LEADERBOARD_LIMIT).map((row: any) => {
              const comparison = comparisonValues(row.value, row.previous);
              return {
                category: row.category,
                value: this.scalar(row.value),
                previousValue: this.scalar(row.previous),
                delta: comparison.delta,
                percentChange: comparison.percentChange,
                ...(comparison.unavailable ? { unavailable: comparison.unavailable } : {}),
              };
            }),
          });
        }
      }
    }

    let details;
    if (input.includeRows) {
      const countQuery = sourceQuery(
        'SELECT CAST(count(*) AS VARCHAR) AS total FROM source',
        columns,
        input.filters,
        input.dateRange,
        temporal,
      );
      const count = await this.connection.queryDuckDB(
        profile.sourceId,
        countQuery.sql,
        countQuery.bindings,
      );
      const selected = columns.slice(0, DETAIL_COLUMNS);
      const rowsQuery = sourceQuery(
        `SELECT ${selected
          .map((column, index) => `${quoteColumn(column)} AS "__vm_detail_${index}"`)
          .join(', ')} FROM source ORDER BY ALL LIMIT ${input.pageSize} OFFSET ${
          input.page * input.pageSize
        }`,
        columns,
        input.filters,
        input.dateRange,
        temporal,
      );
      const rows = await this.connection.queryDuckDB(
        profile.sourceId,
        rowsQuery.sql,
        rowsQuery.bindings,
      );
      details = {
        rows: rows.datas.map((row: any) =>
          Object.fromEntries(
            selected.map((column, index) => [column, row[`__vm_detail_${index}`]]),
          ),
        ),
        totalRows: String(count.datas[0].total),
        page: input.page,
        pageSize: input.pageSize,
      };
    }

    return {
      sourceRevision,
      kpis,
      leaderboards,
      ...(details ? { details } : {}),
      applied: {
        filters: input.filters,
        ...(input.dateRange !== undefined ? { dateRange: input.dateRange } : {}),
        trendGrain: input.trendGrain,
        comparePrevious: input.comparePrevious,
        rankingSort: input.rankingSort,
      },
    };
  }

  private kpi(measure: any, widget: any, comparePrevious: boolean) {
    const kpi: any = {
      id: measure.metricId,
      title: widget?.title,
      value: this.scalar(widget?.datas?.[0]?.[widget.valueField]),
    };
    if (widget?.prefix) kpi.prefix = widget.prefix;
    if (widget?.suffix) kpi.suffix = widget.suffix;
    if (typeof widget?.decimalPlaces === 'number') kpi.decimalPlaces = widget.decimalPlaces;
    const trend = this.trend(widget, 'trend', 'trendUnavailable');
    if (trend) kpi.trend = trend;
    if (comparePrevious) {
      const previousTrend = this.trend(widget, 'previousTrend', 'previousTrendUnavailable');
      if (previousTrend) kpi.previousTrend = previousTrend;
      if (widget?.comparison) kpi.comparison = widget.comparison;
    }
    return kpi;
  }

  private trend(widget: any, key: string, unavailableKey: string) {
    const trend = widget?.[key];
    if (!trend?.points) {
      const unavailable = widget?.[unavailableKey];
      return unavailable ? { points: [], unavailable } : undefined;
    }
    return {
      column: trend.column,
      grain: trend.grain,
      ...(trend.timeZone ? { timeZone: trend.timeZone } : {}),
      points: trend.points.map((point: any) => ({ time: point.time, value: point.value })),
    };
  }

  private leaderboardSql(column: string, expression: string, sort: RankingSort) {
    const direction = sort.direction === 'asc' ? 'ASC' : 'DESC';
    return `SELECT ${quoteColumn(
      column,
    )} AS "__vm_category", ${expression} AS "__vm_value" FROM source GROUP BY 1 ORDER BY "__vm_value" ${direction} NULLS LAST, "__vm_category" ASC NULLS LAST LIMIT ${
      LEADERBOARD_LIMIT + 1
    }`;
  }

  /**
   * Both periods aggregate completely before the join, so a change sort can surface a category
   * that never reaches the current head. The ordered aliases mirror comparisonValues: rows whose
   * delta or percentChange the exact-integer guard suppresses are NULL here and sorted last.
   */
  private joinLeaderboardSql(
    current: { sql: string; bindings: any[] },
    prior: { sql: string; bindings: any[] },
    sort: RankingSort,
  ) {
    const split = (query: string, name: string) =>
      query
        .replace('WITH source AS', `WITH ${name} AS`)
        .replace('FROM source GROUP', `FROM ${name} GROUP`);
    const left = 'c."__vm_value"';
    const right = 'p."__vm_value"';
    // abs(bound) mirrors outsideExactRange; the string branch mirrors roundedBoundary for the
    // BIGINT/HUGEINT/DECIMAL values duckdb reports as text.
    const unsafe = (value: string) =>
      `(abs(${value}) > ${MAX_EXACT} OR ((typeof(${value}) IN ('BIGINT', 'UBIGINT', 'HUGEINT', 'UHUGEINT') OR typeof(${value}) LIKE 'DECIMAL%') AND abs(${value}) >= ${MAX_EXACT} AND NOT regexp_matches(CAST(${value} AS VARCHAR), '^[+-]?[0-9]+$')))`;
    const difference = `${left} - ${right}`;
    const delta = `CASE WHEN ${unsafe(left)} OR ${unsafe(
      right,
    )} OR abs(${difference}) > ${MAX_EXACT} THEN NULL ELSE ${difference} END`;
    const percentChange = `CASE WHEN ${right} IS NULL OR ${right} = 0 THEN NULL ELSE (${delta}) / abs(${right}) * 100 END`;
    const order = { value: 'value', delta: 'delta', percentChange: 'percent_change' }[sort.by];
    const direction = sort.direction === 'asc' ? 'ASC' : 'DESC';
    return {
      sql: `WITH current_groups AS (${split(
        current.sql,
        'current_source',
      )}), prior_groups AS (${split(prior.sql, 'prior_source')})
        SELECT COALESCE(c."__vm_category", p."__vm_category") AS category,
          ${left} AS value, ${right} AS previous,
          ${delta} AS delta, ${percentChange} AS percent_change
        FROM current_groups c FULL OUTER JOIN prior_groups p
          ON c."__vm_category" IS NOT DISTINCT FROM p."__vm_category"
        ORDER BY ${order} ${direction} NULLS LAST, category ASC NULLS LAST LIMIT ${
        LEADERBOARD_LIMIT + 1
      }`,
      bindings: [...current.bindings, ...prior.bindings],
    };
  }

  private leaderboard(column: string, rows: any[]) {
    return {
      column,
      truncated: rows.length > LEADERBOARD_LIMIT,
      rows: rows
        .slice(0, LEADERBOARD_LIMIT)
        .map(row => ({ category: row.__vm_category ?? null, value: this.scalar(row.__vm_value) })),
    };
  }

  async values(body: any, actor: number) {
    const input = this.fields(body, VALUES_FIELDS);
    const expected = this.revision(input.sourceRevision);
    if (typeof input.column !== 'string' || !input.column.trim() || input.column.length > 128)
      throw new BadRequestException('invalid column');
    const search = input.search === undefined ? '' : input.search;
    if (typeof search !== 'string' || search.length > MAX_SEARCH_LENGTH)
      throw new BadRequestException('search must be at most 200 characters');
    const filters = this.filters(input.filters);
    return this.connection.withDuckDBSnapshot(input.sourceId, async () => {
      const profile = await this.bi.profile(input.sourceId, actor);
      if (!profile.supported)
        throw new BadRequestException('서버에 저장한 DuckDB 파일을 선택해 주세요.');
      const sourceRevision = await this.connection.duckDBVersion(profile.sourceId);
      if (sourceRevision !== expected)
        throw new ConflictException(
          '파일 버전이 변경되었습니다. 소스를 새로고침한 뒤 다시 시도해 주세요.',
        );
      const columns = profile.columns.map((column: any) => column.name);
      if (!columns.includes(input.column)) throw new BadRequestException('unknown column');
      this.validateRangeFilters(filters, profile);
      const temporal = profile.columns
        .filter((column: any) => column.temporal)
        .map((column: any) => column.name);
      const query = this.valueQuery(
        input.column,
        search,
        columns,
        filters,
        input.dateRange,
        temporal,
      );
      const result = await this.connection.queryDuckDB(profile.sourceId, query.sql, query.bindings);
      const values = result.datas.map((row: any) => row.value);
      return {
        values: values.slice(0, MAX_VALUES),
        truncated: values.length > MAX_VALUES,
        sourceRevision,
      };
    });
  }

  /** NULL stays a distinct member of the list; LIKE wildcards are escaped before binding. */
  private valueQuery(
    column: string,
    search: string,
    columns: string[],
    filters: ExploreFilter[],
    dateRange: any,
    temporal: string[],
  ) {
    const predicate = search
      ? ` WHERE lower(CAST(${quoteColumn(column)} AS VARCHAR)) LIKE ${SEARCH_PARAMETER} ESCAPE '\\'`
      : '';
    const query = sourceQuery(
      `SELECT DISTINCT CAST(${quoteColumn(
        column,
      )} AS VARCHAR) AS value FROM source${predicate} ORDER BY value LIMIT ${MAX_VALUES + 1}`,
      columns,
      filters,
      dateRange,
      temporal,
    );
    if (!search) return query;
    const parts = query.sql.split(SEARCH_PARAMETER);
    if (parts.length !== 2) throw new BadRequestException('search parameter could not be bound');
    const pattern = `%${search.toLowerCase().replace(/[\\%_]/g, character => `\\${character}`)}%`;
    return { sql: parts.join('?'), bindings: [...query.bindings, pattern] };
  }

  /** Bounded pivot: axis tuples plus canonical totals reaggregated outside the cell grid. */
  async pivot(body: any, actor: number) {
    const input = this.fields(body, PIVOT_FIELDS);
    const expected = this.revision(input.sourceRevision);
    const measureIds = this.measureIds(input.measureIds);
    const { comparePrevious } = validatePeriodOptions(input);
    const filters = this.filters(input.filters);
    const dateRange = input.dateRange;
    if (comparePrevious && dateRange === undefined)
      throw new BadRequestException('이전 기간 비교에는 적용한 날짜 범위가 필요합니다.');
    return this.connection.withDuckDBSnapshot(input.sourceId, () =>
      this.pivotSnapshot({
        actor,
        sourceId: input.sourceId,
        expected,
        measureIds,
        rowColumns: input.rowColumns,
        columnColumns: input.columnColumns,
        filters,
        dateRange,
        comparePrevious,
      }),
    );
  }

  private async pivotSnapshot(input: {
    actor: number;
    sourceId: unknown;
    expected: string;
    measureIds: number[];
    rowColumns: unknown;
    columnColumns: unknown;
    filters: ExploreFilter[];
    dateRange: any;
    comparePrevious: boolean;
  }) {
    const profile = await this.bi.profile(input.sourceId, input.actor);
    if (!profile.supported)
      throw new BadRequestException('서버에 저장한 DuckDB 파일을 선택해 주세요.');
    const sourceRevision = await this.connection.duckDBVersion(profile.sourceId);
    if (sourceRevision !== input.expected)
      throw new ConflictException(
        '파일 버전이 변경되었습니다. 소스를 새로고침한 뒤 다시 시도해 주세요.',
      );
    const columns = profile.columns.map((column: any) => column.name);
    const temporal = profile.columns
      .filter((column: any) => column.temporal)
      .map((column: any) => column.name);
    this.validateRangeFilters(input.filters, profile);
    const rowColumns = this.axis(input.rowColumns, columns, '행');
    const columnColumns = this.axis(input.columnColumns, columns, '열');
    if (columnColumns.some(column => rowColumns.includes(column)))
      throw new BadRequestException('같은 열을 행과 열 축에 함께 사용할 수 없습니다.');
    const catalog = await this.bi.metrics(profile.sourceId, input.actor);
    const known = new Map(catalog.map((measure: any) => [measure.id, measure]));
    for (const measureId of input.measureIds)
      if (!known.has(measureId)) throw new BadRequestException('unknown measure id');
    const { measures } = await this.measureExpressions(
      profile,
      input.measureIds,
      input.actor,
      known,
    );

    // A compared period needs an explicit range, exactly like the aggregate query contract.
    const previous =
      input.comparePrevious && input.dateRange !== undefined
        ? previousDateRange(input.dateRange)
        : undefined;
    const currentTuples = await this.pivotTuples(
      profile.sourceId,
      rowColumns,
      columnColumns,
      columns,
      input.filters,
      input.dateRange,
      temporal,
    );
    const priorTuples =
      previous === undefined
        ? undefined
        : await this.pivotTuples(
            profile.sourceId,
            rowColumns,
            columnColumns,
            columns,
            input.filters,
            previous,
            temporal,
          );
    // Bound the union of both periods after the union: a previous-only tuple must still be shown.
    const rows = this.boundedTuples(
      [currentTuples.rows, ...(priorTuples ? [priorTuples.rows] : [])],
      MAX_PIVOT_ROWS,
      '행',
    );
    const columnTuples = this.boundedTuples(
      [currentTuples.columns, ...(priorTuples ? [priorTuples.columns] : [])],
      MAX_PIVOT_COLUMNS,
      '열',
    );
    if (rows.length * columnTuples.length * measures.length > MAX_PIVOT_CELLS)
      throw new BadRequestException(
        `표시할 값이 ${MAX_PIVOT_CELLS}개를 넘습니다. 필터를 좁히거나 행·열 축을 줄여 주세요.`,
      );

    const current = await this.pivotGroups(
      profile.sourceId,
      rowColumns,
      columnColumns,
      measures,
      columns,
      input.filters,
      input.dateRange,
      temporal,
    );
    const prior =
      previous === undefined
        ? undefined
        : await this.pivotGroups(
            profile.sourceId,
            rowColumns,
            columnColumns,
            measures,
            columns,
            input.filters,
            previous,
            temporal,
          );
    const empty = measures.map(() => null);
    /**
     * Every cell and total is read from the aggregate of its own grain, so a non-additive measure
     * stays canonical. A missing tuple is null, never zero, and an empty count stays 0.
     */
    const at = (groups: PivotGroups, grain: keyof PivotGroups, tuple: PivotTuple) =>
      groups[grain].get(JSON.stringify(tuple)) ?? empty;
    const measureValues = (values: PivotValues, compared: PivotValues | undefined) =>
      measures.map((measure, index) => ({
        measureId: measure.metricId,
        value: values[index] ?? null,
        ...(input.comparePrevious
          ? { comparison: comparisonValues(values[index] ?? null, compared?.[index] ?? null) }
          : {}),
      }));

    const cells = [];
    rows.forEach((rowTuple, row) =>
      columnTuples.forEach((columnTuple, column) => {
        const tuple = [...rowTuple, ...columnTuple];
        cells.push({
          row,
          column,
          measures: measureValues(
            at(current, 'cells', tuple),
            prior ? at(prior, 'cells', tuple) : undefined,
          ),
        });
      }),
    );

    return {
      sourceId: profile.sourceId,
      sourceRevision,
      rowColumns,
      columnColumns,
      rows,
      columns: columnTuples,
      cells,
      rowTotals: rows.map(tuple =>
        measureValues(at(current, 'rows', tuple), prior ? at(prior, 'rows', tuple) : undefined),
      ),
      columnTotals: columnTuples.map(tuple =>
        measureValues(
          at(current, 'columns', tuple),
          prior ? at(prior, 'columns', tuple) : undefined,
        ),
      ),
      grandTotal: measureValues(
        at(current, 'grand', []),
        prior ? at(prior, 'grand', []) : undefined,
      ),
      applied: {
        filters: input.filters,
        ...(input.dateRange !== undefined ? { dateRange: input.dateRange } : {}),
        comparePrevious: input.comparePrevious,
      },
      limits: { rows: MAX_PIVOT_ROWS, columns: MAX_PIVOT_COLUMNS, cells: MAX_PIVOT_CELLS },
    };
  }

  /** Up to two columns per axis; membership and within-axis duplicates reuse the dimension rules. */
  private axis(value: unknown, columns: string[], label: '행' | '열') {
    if (value === undefined) return [];
    if (!Array.isArray(value) || value.length > MAX_PIVOT_AXIS)
      throw new BadRequestException(`${label} 축은 최대 2개 열까지 지정할 수 있습니다.`);
    return this.dimensions(value, columns);
  }

  /** Both axis tuple lists of one period, before the previous period is unioned in. */
  private async pivotTuples(
    sourceId: number,
    rowColumns: string[],
    columnColumns: string[],
    columns: string[],
    filters: ExploreFilter[],
    dateRange: any,
    temporal: string[],
  ) {
    return {
      rows: await this.axisTuples(
        sourceId,
        rowColumns,
        MAX_PIVOT_ROWS,
        columns,
        filters,
        dateRange,
        temporal,
      ),
      columns: await this.axisTuples(
        sourceId,
        columnColumns,
        MAX_PIVOT_COLUMNS,
        columns,
        filters,
        dateRange,
        temporal,
      ),
    };
  }

  /** Distinct axis tuples, capped one past the limit so overflow is reported instead of truncated. */
  private async axisTuples(
    sourceId: number,
    axis: string[],
    max: number,
    columns: string[],
    filters: ExploreFilter[],
    dateRange: any,
    temporal: string[],
  ) {
    // An empty axis is the overall aggregate: one singleton tuple, no group query.
    if (!axis.length) return [[]] as PivotTuple[];
    const sql = `SELECT DISTINCT ${axis
      .map((column, index) => `${quoteColumn(column)} AS "__vm_axis_${index}"`)
      .join(', ')} FROM source LIMIT ${max + 1}`;
    const query = sourceQuery(sql, columns, filters, dateRange, temporal);
    const result = await this.connection.queryDuckDB(sourceId, query.sql, query.bindings);
    return result.datas.map((row: any) =>
      axis.map((_column, index) => this.grouping(row[`__vm_axis_${index}`])),
    ) as PivotTuple[];
  }

  private boundedTuples(lists: PivotTuple[][], max: number, label: '행' | '열') {
    const unique = new Map<string, PivotTuple>();
    for (const list of lists)
      for (const tuple of list) {
        const key = JSON.stringify(tuple);
        if (!unique.has(key)) unique.set(key, tuple);
      }
    const tuples = [...unique.values()].sort((left, right) => this.compareTuples(left, right));
    if (tuples.length > max)
      throw new BadRequestException(
        `${label} 조합이 ${max}개를 넘습니다. 필터를 좁히거나 축을 줄여 주세요.`,
      );
    return tuples;
  }

  /** Deterministic ascending order with null last; numbers compare numerically, everything as text. */
  private compareTuples(left: PivotTuple, right: PivotTuple) {
    for (let index = 0; index < Math.max(left.length, right.length); index++) {
      const one = left[index] ?? null;
      const other = right[index] ?? null;
      if (one === other) continue;
      if (one === null) return 1;
      if (other === null) return -1;
      if (typeof one === 'number' && typeof other === 'number') return one < other ? -1 : 1;
      const oneText = String(one);
      const otherText = String(other);
      if (oneText === otherText) continue;
      return oneText < otherText ? -1 : 1;
    }
    return 0;
  }

  /** Grouping values stay primitives the client can render; a null group stays an actual null. */
  private grouping(value: unknown): unknown {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : String(value);
    if (typeof value === 'string' || typeof value === 'boolean') return value;
    if (typeof value === 'bigint') {
      const numeric = Number(value);
      return Number.isSafeInteger(numeric) ? numeric : value.toString();
    }
    try {
      return JSON.stringify(value) ?? String(value);
    } catch {
      return String(value);
    }
  }

  /** One canonical aggregate per grain; measures never get re-summed from the cell grid. */
  private async pivotAggregate(
    sourceId: number,
    axis: string[],
    measures: PivotMeasure[],
    columns: string[],
    filters: ExploreFilter[],
    dateRange: any,
    temporal: string[],
  ) {
    const projection = [
      ...axis.map((column, index) => `${quoteColumn(column)} AS "__vm_axis_${index}"`),
      ...measures.map((measure, index) => `${measure.expression} AS "__vm_measure_${index}"`),
    ].join(', ');
    const query = sourceQuery(
      axis.length
        ? `SELECT ${projection} FROM source GROUP BY ${axis
            .map((_column, index) => index + 1)
            .join(', ')}`
        : `SELECT ${projection} FROM source`,
      columns,
      filters,
      dateRange,
      temporal,
    );
    const result = await this.connection.queryDuckDB(sourceId, query.sql, query.bindings);
    const groups = new Map<string, PivotValues>();
    for (const row of result.datas) {
      const tuple = axis.map((_column, index) => this.grouping(row[`__vm_axis_${index}`]));
      // COUNT over no rows stays 0 while SUM/AVG stay null; scalar keeps large integers exact.
      groups.set(
        JSON.stringify(tuple),
        measures.map((_measure, index) => this.scalar(row[`__vm_measure_${index}`])),
      );
    }
    return groups;
  }

  /** Cells, both axis totals and the overall total for one period, each at its own grain. */
  private async pivotGroups(
    sourceId: number,
    rowColumns: string[],
    columnColumns: string[],
    measures: PivotMeasure[],
    columns: string[],
    filters: ExploreFilter[],
    dateRange: any,
    temporal: string[],
  ): Promise<PivotGroups> {
    const grand = await this.pivotAggregate(
      sourceId,
      [],
      measures,
      columns,
      filters,
      dateRange,
      temporal,
    );
    const grain = [...rowColumns, ...columnColumns];
    // An empty axis group is the grand total itself; no second query is needed for it.
    return {
      cells: grain.length
        ? await this.pivotAggregate(
            sourceId,
            grain,
            measures,
            columns,
            filters,
            dateRange,
            temporal,
          )
        : grand,
      rows: rowColumns.length
        ? await this.pivotAggregate(
            sourceId,
            rowColumns,
            measures,
            columns,
            filters,
            dateRange,
            temporal,
          )
        : grand,
      columns: columnColumns.length
        ? await this.pivotAggregate(
            sourceId,
            columnColumns,
            measures,
            columns,
            filters,
            dateRange,
            temporal,
          )
        : grand,
      grand,
    };
  }

  /** Canonical measure SQL comes from BiService.prepare; the explore layer never rebuilds it. */
  private async measureExpressions(
    profile: any,
    measureIds: number[],
    actor: number,
    known: Map<number, any>,
  ) {
    const measures: PivotMeasure[] = [];
    const widgets: any[] = [];
    for (const measureId of measureIds) {
      const prepared = await this.bi.prepare(
        {
          sourceId: profile.sourceId,
          metricId: measureId,
          chart: 'number',
          title: known.get(measureId).label,
        },
        actor,
      );
      const widget = prepared.draft.widgets[0];
      measures.push({
        metricId: measureId,
        definition: prepared.definition,
        // Only for grouped aggregates that reuse the canonical text produced by prepare.
        expression: this.expression(widget.sql),
      });
      widgets.push(widget);
    }
    return { measures, widgets };
  }
}
