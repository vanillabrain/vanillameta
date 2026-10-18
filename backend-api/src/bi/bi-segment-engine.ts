import { BadRequestException } from '@nestjs/common';
import {
  numericSourceColumns,
  quoteColumn,
  SourceFilter,
  sourceQuery,
} from '../ai/dashboard-draft';
import type { DashboardDateRange } from '../ai/dashboard-date-range';

/** Server-only keys: these never enter the public metric-ID request schema. */
export type CandidateMetricKey = `candidate:${number}`;
type MetricKey = number | CandidateMetricKey;
export type PreparedSegmentInput<K extends MetricKey> = {
  measures: Array<{
    id: K;
    label: string;
    unit: string;
    decimalPlaces: number;
    expression: string;
  }>;
  conditions: Array<{ measureId: K; operator: string; value: number }>;
  dimensionColumn: string;
  pivotColumn?: string;
  filters: SourceFilter[];
  dateRange?: DashboardDateRange;
  trendGrain: 'day' | 'week' | 'month';
  page: number;
  pageSize: number;
  aggregateOnly: boolean;
  detailSelection?: {
    row?: string | number | boolean | null;
    column?: string | number | boolean | null;
  };
};
export type PreparedSegmentContext = {
  profile: { sourceId: number; columns: Array<{ name: string; type: string; temporal: boolean }> };
  sourceRevision: string;
  viewRevision: string;
  query(sql: string, bindings: unknown[]): Promise<Record<string, any>[]>;
  assertCurrent(): Promise<void>;
};
export const GROUP_LIMIT = 50,
  GROUP_PROBE = 51,
  TREND_LIMIT = 200,
  TREND_PROBE = 201,
  DETAIL_COLUMNS = 50;
const DIMENSION_ALIAS = '__vm_seg_dim';
const PROBE_SQL = 'SELECT 1 AS "__vm_seg_probe" FROM source';
const OPERATORS: Record<string, string> = { gte: '>=', gt: '>', lte: '<=', lt: '<', eq: '=' };
const scalar = (value: unknown): number | string | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return value;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
};
/** Only trusted server compilers prepare expressions; no controller accepts this input. */
export async function executePreparedSegment<K extends MetricKey>(
  input: PreparedSegmentInput<K>,
  context: PreparedSegmentContext,
) {
  const { profile, sourceRevision, viewRevision } = context;
  const measures = input.measures;
  if (
    !measures.length ||
    measures.length > 6 ||
    new Set(measures.map(m => m.id)).size !== measures.length ||
    !input.conditions.length ||
    input.conditions.length > 3 ||
    input.conditions.some(
      c =>
        !Object.prototype.hasOwnProperty.call(OPERATORS, c.operator) ||
        !Number.isFinite(c.value) ||
        !measures.some(m => m.id === c.measureId),
    )
  )
    throw new BadRequestException('Invalid prepared segment measures or conditions');
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
    context.query(`${prefix}${eligible}${scoped} ${sql}`, [...bindings, ...extraBindings]);

  const assertCurrent = context.assertCurrent;
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
        .map((column, index) => `${quoteColumn(column)} AS ${quoteColumn(`__vm_detail_${index}`)}`)
        .join(', ')} FROM scoped_rows WHERE ${where} ORDER BY ALL LIMIT ${input.pageSize} OFFSET ${
        input.page * input.pageSize
      }`,
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
        value: scalar(totals[`__vm_detail_k${index}`]),
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
    value: scalar(kpiRows[0]?.[`__vm_seg_k${index}`]),
    unit: measure.unit,
    decimalPlaces: measure.decimalPlaces,
  }));
  const groups = groupRows.slice(0, GROUP_LIMIT).map(row => ({
    category: row.category ?? null,
    values: measures.map((measure, index) => ({
      id: measure.id,
      value: scalar(row[`value${index}`]),
    })),
  }));

  // Qualification remains over all source rows per original dimension. Only the displayed
  // axes are bounded; cells/row/column/grand totals reaggregate the canonical expressions.
  let pivot:
    | {
        column: string;
        columns: Array<{
          value: unknown;
          totals: Array<{ id: K; value: number | string | null }>;
        }>;
        rows: Array<{
          category: unknown;
          cells: Array<{
            column: unknown;
            values: Array<{ id: K; value: number | string | null }>;
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
          value: scalar(row[`__vm_pivot_${i}`]),
        })),
      })),
      rows: groups.map(group => ({
        category: group.category,
        cells: displayedColumns.map(column => ({
          column: column.category ?? null,
          values: measures.map((m, i) => ({
            id: m.id,
            value: scalar(
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
    values: Array<{ id: K; value: number | string | null }>;
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
          value: scalar(row[`__vm_seg_t${index}`]),
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
export type PreparedSegmentResult<K extends MetricKey> = Awaited<
  ReturnType<typeof executePreparedSegment<K>>
>;
