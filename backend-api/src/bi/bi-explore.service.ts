import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { AiDashboardService } from '../ai/ai-dashboard.service';
import {
  normalizeSourceFilters,
  numericSourceColumns,
  positiveId,
  quoteColumn,
  SourceFilter,
  sourceQuery,
} from '../ai/dashboard-draft';
import { comparisonValues, previousDateRange, validatePeriodOptions } from '../ai/dashboard-period';
import { ConnectionService } from '../connection/connection.service';
import { exploreViewRevision } from './explore-view-state';
import { BiService } from './bi.service';

const PIVOT_ROW_LIMIT = 50;
const PIVOT_COLUMN_LIMIT = 12;
const MAX_MEASURES = 6;
const MAX_DIMENSIONS = 4;
const LEADERBOARD_LIMIT = 20;
const MAX_PAGE_SIZE = 50;
const MAX_PAGE = 10000;
const MAX_SEARCH_LENGTH = 200;
const MAX_VALUES = 50;
const DETAIL_COLUMNS = 50;
/**
 * sourceQuery validates a deliberately small SELECT grammar that has no parameter token, so the
 * search pattern is written as a sentinel literal during validation and swapped for a bound
 * parameter immediately afterwards.
 */
const SEARCH_PARAMETER = "'__vm_explore_search__'";

const PIVOT_FIELDS = [
  'sourceId',
  'sourceRevision',
  'measureIds',
  'rowDimensions',
  'columnDimensions',
  'filters',
  'dateRange',
];
const CATALOG_FIELDS = ['sourceId'];
const QUERY_FIELDS = [
  'sourceId',
  'sourceRevision',
  'measureIds',
  'dimensionColumns',
  'rankingMeasureId',
  'leaderboardSort',
  'filters',
  'dateRange',
  'trendGrain',
  'comparePrevious',
  'page',
  'pageSize',
  'includeRows',
];
const VALUES_FIELDS = ['sourceId', 'sourceRevision', 'column', 'search', 'filters', 'dateRange'];

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

  private filters(value: unknown) {
    return normalizeSourceFilters(value === undefined ? [] : (value as any[]), false);
  }

  private leaderboardSort(value: unknown, comparePrevious: boolean) {
    const sort =
      value === undefined
        ? { by: 'value', direction: 'desc' }
        : this.fields(value, ['by', 'direction']);
    if (
      !['value', 'delta', 'percentChange'].includes(sort.by) ||
      !['asc', 'desc'].includes(sort.direction)
    )
      throw new BadRequestException('invalid leaderboardSort');
    if (sort.by !== 'value' && !comparePrevious)
      throw new BadRequestException('comparison sort requires comparePrevious and dateRange');
    return {
      by: sort.by as 'value' | 'delta' | 'percentChange',
      direction: sort.direction as 'asc' | 'desc',
    };
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
    const catalog = {
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
    return { ...catalog, viewRevision: exploreViewRevision(catalog) };
  }

  async pivot(body: any, actor: number) {
    const input = this.fields(body, PIVOT_FIELDS);
    const sourceId = positiveId(input.sourceId);
    const expected = this.revision(input.sourceRevision);
    const measureIds = this.measureIds(input.measureIds);
    for (const [name, min, max] of [
      ['rowDimensions', 1, 2],
      ['columnDimensions', 0, 1],
    ] as const) {
      if (!Array.isArray(input[name]) || input[name].length < min || input[name].length > max)
        throw new BadRequestException(`invalid ${name}`);
    }
    const filters = this.filters(input.filters);
    // Authorize before opening/decrypting a source snapshot, including foreign broken sources.
    const authorizedMetrics = await this.bi.metrics(sourceId, actor);
    return this.connection.withDuckDBSnapshot(sourceId, async () => {
      const profile = await this.bi.profile(sourceId, actor);
      if (!profile.supported)
        throw new BadRequestException('서버에 저장한 DuckDB 파일을 선택해 주세요.');
      const sourceRevision = await this.connection.duckDBVersion(sourceId);
      if (sourceRevision !== expected)
        throw new ConflictException(
          '파일 버전이 변경되었습니다. 소스를 새로고침한 뒤 다시 시도해 주세요.',
        );
      const columns = profile.columns.map(column => column.name);
      const rowDimensions = this.dimensions(input.rowDimensions, columns);
      const columnDimensions = this.dimensions(input.columnDimensions, columns);
      if (rowDimensions.some(column => columnDimensions.includes(column)))
        throw new BadRequestException('overlapping pivot dimensions');
      const known = new Map(authorizedMetrics.map(m => [m.id, m]));
      const metrics = [];
      const expressions: string[] = [];
      for (const id of measureIds) {
        if (!known.has(id)) throw new BadRequestException('unknown measure id');
        const prepared = await this.bi.prepare(
          { sourceId, metricId: id, chart: 'number', title: known.get(id).label },
          actor,
        );
        const widget: {
          sql: string;
          prefix?: string;
          suffix?: string;
          decimalPlaces: number;
          numberNotation: string;
        } = prepared.draft.widgets[0];
        expressions.push(this.expression(widget.sql));
        metrics.push({
          id,
          label: known.get(id).label,
          ...(widget.prefix ? { prefix: widget.prefix } : {}),
          ...(widget.suffix ? { suffix: widget.suffix } : {}),
          decimalPlaces: widget.decimalPlaces,
          numberNotation: widget.numberNotation,
        });
      }

      const measureAliases = expressions.map((_expression, i) => `__vm_pivot_m${i}`);
      const aggregates = expressions
        .map((expression, i) => `${expression} AS ${quoteColumn(measureAliases[i])}`)
        .join(', ');
      const grandSql = `SELECT ${aggregates} FROM source`;
      // The shared compiler authorizes filters/date types and binds their values. Everything
      // appended below is server-generated from canonical expressions and registered columns.
      const filtered = sourceQuery(
        grandSql,
        columns,
        filters,
        input.dateRange,
        profile.columns.filter(column => column.temporal).map(column => column.name),
        numericSourceColumns(
          profile.columns.map(column => ({ column_name: column.name, column_type: column.type })),
        ),
      );
      const sourceCte = filtered.sql.slice(0, -grandSql.length);
      const run = async (sql: string): Promise<Array<Record<string, any>>> =>
        (await this.connection.queryDuckDB(sourceId, sourceCte + sql, filtered.bindings)).datas;
      const rowAliases = rowDimensions.map((_column, i) => `__vm_pivot_r${i}`);
      const columnAliases = columnDimensions.map((_column, i) => `__vm_pivot_c${i}`);
      const selectDimensions = (dimensions: string[], aliases: string[]) =>
        dimensions.map((column, i) => `${quoteColumn(column)} AS ${quoteColumn(aliases[i])}`);
      const axisSql = (dimensions: string[], aliases: string[], limit: number) =>
        `SELECT ${selectDimensions(dimensions, aliases).join(', ')}, ${aggregates},
           COUNT(*) OVER () AS "__vm_pivot_groups" FROM source
         GROUP BY ${dimensions.map((_column, i) => i + 1).join(', ')}
         ORDER BY ${quoteColumn(measureAliases[0])} DESC NULLS LAST,
           ${aliases.map(alias => `${quoteColumn(alias)} ASC NULLS LAST`).join(', ')}
         LIMIT ${limit}`;
      const metricValues = (row: any): unknown[] =>
        measureAliases.map(alias => this.scalar(row[alias]));
      const axisValues = (row: any, aliases: string[]): unknown[] =>
        aliases.map(alias => row[alias] ?? null);
      const grandTotals = metricValues((await run(grandSql))[0]);
      const rowGroups = await run(axisSql(rowDimensions, rowAliases, PIVOT_ROW_LIMIT + 1));
      const columnGroups = columnDimensions.length
        ? await run(axisSql(columnDimensions, columnAliases, PIVOT_COLUMN_LIMIT + 1))
        : [];
      const rows = rowGroups.slice(0, PIVOT_ROW_LIMIT).map(row => {
        const values = axisValues(row, rowAliases);
        return {
          key: JSON.stringify(values),
          values,
          totals: metricValues(row),
          cells: [] as Array<{ columnKey: string; values: unknown[] }>,
        };
      });
      const pivotColumns = columnDimensions.length
        ? columnGroups.slice(0, PIVOT_COLUMN_LIMIT).map(row => {
            const values = axisValues(row, columnAliases);
            return { key: JSON.stringify(values), values, totals: metricValues(row) };
          })
        : [{ key: '[]', values: [] as unknown[], totals: grandTotals }];
      if (rows.length && pivotColumns.length) {
        const ctes = [
          `"__vm_pivot_rows" AS (${axisSql(rowDimensions, rowAliases, PIVOT_ROW_LIMIT)})`,
        ];
        if (columnDimensions.length)
          ctes.push(
            `"__vm_pivot_columns" AS (${axisSql(
              columnDimensions,
              columnAliases,
              PIVOT_COLUMN_LIMIT,
            )})`,
          );
        // Semi-joins restrict original rows BEFORE cell aggregation, including NULL tuples.
        // No dimension values cross back through bindings or lose BIGINT/date type precision.
        const selected = (dimensions: string[], aliases: string[], cte: string) =>
          `EXISTS (SELECT 1 FROM ${quoteColumn(cte)} WHERE ${dimensions
            .map(
              (column, i) =>
                `source.${quoteColumn(column)} IS NOT DISTINCT FROM ${quoteColumn(
                  cte,
                )}.${quoteColumn(aliases[i])}`,
            )
            .join(' AND ')})`;
        const predicates = [selected(rowDimensions, rowAliases, '__vm_pivot_rows')];
        if (columnDimensions.length)
          predicates.push(selected(columnDimensions, columnAliases, '__vm_pivot_columns'));
        const dimensions = [
          ...selectDimensions(rowDimensions, rowAliases),
          ...selectDimensions(columnDimensions, columnAliases),
        ];
        const cells = await run(`, ${ctes.join(', ')}
          SELECT ${dimensions.join(', ')}, ${aggregates} FROM source
          WHERE ${predicates.join(' AND ')}
          GROUP BY ${dimensions.map((_dimension, i) => i + 1).join(', ')}
          LIMIT ${PIVOT_ROW_LIMIT * PIVOT_COLUMN_LIMIT}`);
        const byRow = new Map(rows.map(row => [row.key, row]));
        const columnOrder = new Map(pivotColumns.map((column, i) => [column.key, i]));
        for (const cell of cells) {
          const key = JSON.stringify(axisValues(cell, rowAliases));
          byRow.get(key).cells.push({
            columnKey: JSON.stringify(axisValues(cell, columnAliases)),
            values: metricValues(cell),
          });
        }
        for (const row of rows)
          row.cells.sort((a, b) => columnOrder.get(a.columnKey) - columnOrder.get(b.columnKey));
      }
      return {
        sourceRevision,
        metrics,
        rows,
        columns: pivotColumns,
        grandTotals,
        limits: {
          rowLimit: PIVOT_ROW_LIMIT,
          columnLimit: PIVOT_COLUMN_LIMIT,
          totalRowGroups: rowGroups[0]?.__vm_pivot_groups ?? 0,
          totalColumnGroups: columnDimensions.length ? columnGroups[0]?.__vm_pivot_groups ?? 0 : 1,
          truncatedRows: rowGroups.length > PIVOT_ROW_LIMIT,
          truncatedColumns: columnGroups.length > PIVOT_COLUMN_LIMIT,
        },
      };
    });
  }

  async query(body: any, actor: number) {
    const input = this.fields(body, QUERY_FIELDS);
    const expected = this.revision(input.sourceRevision);
    const measureIds = this.measureIds(input.measureIds);
    const { trendGrain, comparePrevious } = validatePeriodOptions(input);
    const leaderboardSort = this.leaderboardSort(input.leaderboardSort, comparePrevious);
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
        leaderboardSort,
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
    leaderboardSort: { by: 'value' | 'delta' | 'percentChange'; direction: 'asc' | 'desc' };
    dimensionColumns: unknown;
    filters: SourceFilter[];
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
    const numeric = numericSourceColumns(
      profile.columns.map(column => ({ column_name: column.name, column_type: column.type })),
    );
    const dimensionColumns = this.dimensions(input.dimensionColumns, columns);
    const catalog = await this.bi.metrics(profile.sourceId, input.actor);
    const known = new Map(catalog.map((measure: any) => [measure.id, measure]));
    for (const measureId of input.measureIds)
      if (!known.has(measureId)) throw new BadRequestException('unknown measure id');

    const measures = [];
    const widgets = [];
    for (const measureId of input.measureIds) {
      const prepared = await this.bi.prepare(
        {
          sourceId: profile.sourceId,
          metricId: measureId,
          chart: 'number',
          title: known.get(measureId).label,
        },
        input.actor,
      );
      const widget = prepared.draft.widgets[0];
      measures.push({
        metricId: measureId,
        definition: prepared.definition,
        // Only for the ranking leaderboard; canonical text still comes from prepare.
        expression: this.expression(widget.sql),
      });
      widgets.push(widget);
    }

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
        const sql = this.leaderboardSql(
          column,
          ranking.expression,
          input.leaderboardSort.direction,
        );
        const currentQuery = sourceQuery(
          sql,
          columns,
          input.filters,
          input.dateRange,
          temporal,
          numeric,
        );
        if (!previous) {
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
            numeric,
          );
          const prior = sourceQuery(
            groupedSql,
            columns,
            input.filters,
            previous,
            temporal,
            numeric,
          );
          const split = (query: string, name: string) =>
            query
              .replace('WITH source AS', `WITH ${name} AS`)
              .replace('FROM source GROUP', `FROM ${name} GROUP`);
          const value = 'c."__vm_value"';
          const previousValue = 'p."__vm_value"';
          const delta = `(${value} - ${previousValue})`;
          const percent = `CASE WHEN ${previousValue} IS NULL OR ${previousValue} = 0 THEN NULL ELSE ${delta} / abs(${previousValue}) * 100 END`;
          const order = { value, delta, percentChange: percent }[input.leaderboardSort.by];
          const result = await this.connection.queryDuckDB(
            profile.sourceId,
            `WITH current_groups AS (${split(
              current.sql,
              'current_source',
            )}), prior_groups AS (${split(prior.sql, 'prior_source')})
             SELECT COALESCE(c."__vm_category", p."__vm_category") AS category,
               c."__vm_value" AS value, p."__vm_value" AS previous
             FROM current_groups c FULL OUTER JOIN prior_groups p
               ON c."__vm_category" IS NOT DISTINCT FROM p."__vm_category"
             ORDER BY ${order} ${input.leaderboardSort.direction.toUpperCase()} NULLS LAST, category ASC NULLS LAST LIMIT ${
              LEADERBOARD_LIMIT + 1
            }`,
            [...current.bindings, ...prior.bindings],
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
        numeric,
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
        numeric,
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
        leaderboardSort: input.leaderboardSort,
        ...(input.dateRange !== undefined ? { dateRange: input.dateRange } : {}),
        trendGrain: input.trendGrain,
        comparePrevious: input.comparePrevious,
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

  private leaderboardSql(column: string, expression: string, direction: 'asc' | 'desc') {
    return `SELECT ${quoteColumn(
      column,
    )} AS "__vm_category", ${expression} AS "__vm_value" FROM source GROUP BY 1 ORDER BY "__vm_value" ${direction.toUpperCase()} NULLS LAST, "__vm_category" ASC NULLS LAST LIMIT ${
      LEADERBOARD_LIMIT + 1
    }`;
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
      const temporal = profile.columns
        .filter((column: any) => column.temporal)
        .map((column: any) => column.name);
      const numeric = numericSourceColumns(
        profile.columns.map(column => ({ column_name: column.name, column_type: column.type })),
      );
      const query = this.valueQuery(
        input.column,
        search,
        columns,
        filters,
        input.dateRange,
        temporal,
        numeric,
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
    filters: SourceFilter[],
    dateRange: any,
    temporal: string[],
    numeric: string[],
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
      numeric,
    );
    if (!search) return query;
    const parts = query.sql.split(SEARCH_PARAMETER);
    if (parts.length !== 2) throw new BadRequestException('search parameter could not be bound');
    const pattern = `%${search.toLowerCase().replace(/[\\%_]/g, character => `\\${character}`)}%`;
    return { sql: parts.join('?'), bindings: [...query.bindings, pattern] };
  }
}
