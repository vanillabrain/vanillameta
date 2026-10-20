import { BadRequestException } from '@nestjs/common';
import { StudioConditions } from '../dashboard-studio/studio-contract';
import { parseExploreViewConditions } from './explore-view-state';
import {
  DashboardDateRange,
  dateRangeBounds,
  validateBusinessTimeZone,
  validateDateRange,
} from '../ai/dashboard-date-range';

export type ExploreRankingSort = {
  by: 'value' | 'delta' | 'percentChange';
  direction: 'asc' | 'desc';
};
export type ExploreViewFilter =
  | { column: string; values: (string | number | boolean | null)[] }
  | { column: string; range: { min?: number; max?: number } };
/**
 * Pivot layout for version 2 views. Axes live on the view so a layout toggled off keeps its
 * selection, and every name is validated exactly like a dimension column.
 */
export type ExplorePivot = {
  enabled: boolean;
  rowColumns: string[];
  columnColumns: string[];
};
/** Version 3 row ordering. A label order needs no measure; a value order must name a selected one. */
export type ExploreRowSort = {
  by: 'label' | 'value';
  direction: 'asc' | 'desc';
  measureId?: number;
};
/** One expanded hierarchy row: the value of the single row column the view is nested on. */
export type ExploreExpandedRow = [string | number | boolean | null];
/** One saved column tuple, in the same member domain as a filter value. */
export type ExploreColumnTuple = (string | number | boolean | null)[];
/**
 * Version 4 row ordering. The label order compares row tuples; the three measure orders compare the
 * row total or, when a column tuple names one cell, that cell of the row. A change order needs a
 * compared period, and the label shape carries neither a measure nor a column cell.
 */
export type ExploreRowSortV4 = {
  by: 'label' | 'value' | 'delta' | 'percentChange';
  direction: 'asc' | 'desc';
  measureId?: number;
  columnTuple?: ExploreColumnTuple;
};
/**
 * Version 4 optional bucket axis. The named column is bucketed to a civil day label in the chosen
 * timezone, so it must already be one of the axis columns.
 */
export type ExploreTimeAxis = {
  column: string;
  grain: 'day' | 'week' | 'month';
  timeZone: string;
};
/**
 * Version 3 pivot layout: the version 2 axes plus the row hierarchy, its ordering and the row keys
 * the user expanded. The axes keep the version 2 rules, so a layout toggled off still keeps state.
 */
export type ExplorePivotV3 = ExplorePivot & {
  rowHierarchy: boolean;
  rowSort: ExploreRowSort;
  expandedRows: ExploreExpandedRow[];
};
/**
 * Version 4 pivot layout: the version 3 hierarchy fields plus an optional bucket axis. The bucket
 * column must be an axis column and its timezone must agree with the saved period.
 */
export type ExplorePivotV4 = ExplorePivot & {
  rowHierarchy: boolean;
  rowSort: ExploreRowSortV4;
  expandedRows: ExploreExpandedRow[];
  timeAxis?: ExploreTimeAxis;
};
/**
 * Version 5 pivot layout: the version 4 fields plus the required table mode. A flat table merges
 * both axes onto the row side, so it has no row hierarchy, no expanded rows and no column cell.
 */
export type ExplorePivotV5 = ExplorePivotV4 & { tableMode: 'nest' | 'flat' };
/** Fields every state version shares. */
type ExploreViewStateBase = {
  conditions?: StudioConditions;
  timeZone: string;
  measureIds: number[];
  dimensionColumns: string[];
  rankingMeasureId: number;
  rankingSort: ExploreRankingSort;
  filters: ExploreViewFilter[];
  dateRange?: DashboardDateRange;
  trendGrain: 'day' | 'week' | 'month';
  comparePrevious: boolean;
  includeRows: boolean;
};
export type ExploreViewStateV1 = ExploreViewStateBase & { version: 1 };
export type ExploreViewStateV2 = ExploreViewStateBase & { version: 2; pivot: ExplorePivot };
export type ExploreViewStateV3 = ExploreViewStateBase & { version: 3; pivot: ExplorePivotV3 };
export type ExploreViewStateV4 = ExploreViewStateBase & { version: 4; pivot: ExplorePivotV4 };
export type ExploreViewStateV5 = ExploreViewStateBase & { version: 5; pivot: ExplorePivotV5 };
/**
 * Versioned saved exploration state. It is a strict whitelist: one unknown key is a client bug.
 * The page offset is intentionally not stored; opening a view always restores page 0.
 * Version 1 is unchanged and rejects a stored pivot; version 2 requires one. Version 3 adds the
 * nested row hierarchy, its ordering and the expanded rows on top of the same axes. Version 4 adds
 * an optional bucket axis and widens the row ordering to change sorts and one column cell. Version
 * 5 requires the table mode, which may fold both axes onto a flat row side.
 */
export type ExploreViewState =
  | ExploreViewStateV1
  | ExploreViewStateV2
  | ExploreViewStateV3
  | ExploreViewStateV4
  | ExploreViewStateV5;

const MAX_MEASURES = 6;
const MAX_DIMENSIONS = 4;
const MAX_FILTERS = 20;
const MAX_FILTER_VALUES = 50;
const MAX_FILTER_STRING = 256;
const MAX_COLUMN_LENGTH = 128;
const MAX_PIVOT_AXIS_COLUMNS = 2;
const MAX_PIVOT_COLUMNS = 4;
const MAX_EXPANDED_ROWS = 50;
/** A hierarchy nests exactly the two row columns the axes allow. */
const HIERARCHY_ROW_COLUMNS = 2;
const GRAINS = ['day', 'week', 'month'];
const SORT_FIELDS = ['value', 'delta', 'percentChange'];
const ROW_SORT_FIELDS = ['label', 'value'];
/** Version 4 widens the row ordering: change sorts and an optional single column cell. */
const ROW_SORT_FIELDS_V4 = ['label', 'value', 'delta', 'percentChange'];
const TABLE_MODES = ['nest', 'flat'];
const TIME_AXIS_FIELDS = ['column', 'grain', 'timeZone'];
const STATE_FIELDS = [
  'conditions',
  'version',
  'timeZone',
  'measureIds',
  'dimensionColumns',
  'rankingMeasureId',
  'rankingSort',
  'filters',
  'dateRange',
  'trendGrain',
  'comparePrevious',
  'includeRows',
];
const PIVOT_FIELDS = ['enabled', 'rowColumns', 'columnColumns'];
/** Version 3 adds the row hierarchy, its ordering and the expanded row keys to the same axes. */
const PIVOT_V3_FIELDS = [...PIVOT_FIELDS, 'rowHierarchy', 'rowSort', 'expandedRows'];
/** Version 4 adds the optional bucket axis on top of the version 3 layout. */
const PIVOT_V4_FIELDS = [...PIVOT_V3_FIELDS, 'timeAxis'];
/** Version 5 adds the required table mode on top of the version 4 layout. */
const PIVOT_V5_FIELDS = [...PIVOT_V4_FIELDS, 'tableMode'];
/** Versions 2 through 5 store the pivot layout; a version 1 state rejects the key as unknown. */
const PIVOT_STATE_FIELDS = [...STATE_FIELDS, 'pivot'];

const invalid = (): never => {
  throw new BadRequestException('저장 탐색 조건의 형식을 확인해 주세요.');
};
const object = (value: any, keys: string[]) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid();
  if (Object.keys(value).some(key => !keys.includes(key))) invalid();
};
const column = (value: unknown): string => {
  if (typeof value !== 'string' || !value.trim() || value.length > MAX_COLUMN_LENGTH) invalid();
  return value as string;
};
const member = (value: unknown) => {
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.length <= MAX_FILTER_STRING) return value;
  return invalid();
};

/** Union of a member list and one inclusive range; a filter is exactly one of the two. */
function range(value: any): { min?: number; max?: number } {
  object(value, ['min', 'max']);
  const keys = Object.keys(value);
  const { min, max } = value;
  if (!keys.length || (min === undefined && max === undefined)) invalid();
  if (min !== undefined && !Number.isFinite(min)) invalid();
  if (max !== undefined && !Number.isFinite(max)) invalid();
  if (min !== undefined && max !== undefined && min > max) invalid();
  return {
    ...(min !== undefined ? { min: min as number } : {}),
    ...(max !== undefined ? { max: max as number } : {}),
  };
}

function filters(value: any): ExploreViewFilter[] {
  if (!Array.isArray(value) || value.length > MAX_FILTERS) invalid();
  const names = new Set<string>();
  return value.map(entry => {
    object(entry, ['column', 'values', 'range']);
    const name = column(entry.column);
    if (names.has(name)) invalid();
    names.add(name);
    if ('values' in entry && 'range' in entry) invalid();
    if ('range' in entry) return { column: name, range: range(entry.range) };
    if (
      !Array.isArray(entry.values) ||
      !entry.values.length ||
      entry.values.length > MAX_FILTER_VALUES
    )
      invalid();
    return { column: name, values: entry.values.map(member) };
  });
}

function measureIds(value: any): number[] {
  if (!Array.isArray(value) || !value.length || value.length > MAX_MEASURES) invalid();
  const seen = new Set<number>();
  return value.map(candidate => {
    if (!Number.isSafeInteger(candidate) || Number(candidate) <= 0) invalid();
    const id = Number(candidate);
    if (seen.has(id)) invalid();
    seen.add(id);
    return id;
  });
}

function dimensions(value: any): string[] {
  if (!Array.isArray(value) || value.length > MAX_DIMENSIONS) invalid();
  const seen = new Set<string>();
  return value.map(candidate => {
    const name = column(candidate);
    if (seen.has(name)) invalid();
    seen.add(name);
    return name;
  });
}

/** One pivot axis: at most two distinct names, each validated like a dimension column. */
function pivotAxis(value: any): string[] {
  if (!Array.isArray(value) || value.length > MAX_PIVOT_AXIS_COLUMNS) invalid();
  const seen = new Set<string>();
  return value.map(candidate => {
    const name = column(candidate);
    if (seen.has(name)) invalid();
    seen.add(name);
    return name;
  });
}

/**
 * Version 2 pivot layout, reused as the version 3 axis base. A layout toggled off keeps its axes,
 * so both axes are always required and validated; a name may not repeat within an axis or across
 * the two axes.
 */
function pivot(value: any): ExplorePivot {
  object(value, PIVOT_FIELDS);
  if (typeof value.enabled !== 'boolean') invalid();
  const rowColumns = pivotAxis(value.rowColumns);
  const columnColumns = pivotAxis(value.columnColumns);
  if (rowColumns.length + columnColumns.length > MAX_PIVOT_COLUMNS) invalid();
  for (const name of rowColumns) if (columnColumns.includes(name)) invalid();
  return { enabled: value.enabled, rowColumns, columnColumns };
}

/**
 * Version 3 row ordering. A label order carries no measure; a value order must name one of the
 * view's selected measures so the ordering stays executable.
 */
function rowSort(value: any, measureIds: number[]): ExploreRowSort {
  object(value, ['by', 'direction', 'measureId']);
  const { by, direction, measureId } = value;
  if (!ROW_SORT_FIELDS.includes(by) || !['asc', 'desc'].includes(direction)) invalid();
  if (by === 'label') {
    if (measureId !== undefined) invalid();
    return { by, direction };
  }
  if (!Number.isSafeInteger(measureId) || !measureIds.includes(measureId)) invalid();
  return { by, direction, measureId: Number(measureId) };
}

/** One expanded row key: exactly one value, validated like a filter member. */
function expandedRow(value: any): ExploreExpandedRow {
  if (!Array.isArray(value) || value.length !== 1) invalid();
  return [member(value[0])] as ExploreExpandedRow;
}

/**
 * One saved column cell. Its arity is fixed by the column axis, so a tuple can only address a cell
 * of the grid; whether that cell exists in the data is decided by the bounded pivot query.
 */
function columnTupleValue(value: any, arity: number): ExploreColumnTuple {
  if (!Array.isArray(value) || value.length !== arity) invalid();
  return value.map(member) as ExploreColumnTuple;
}

/**
 * Version 4 row ordering. The label order stays measure-free; the three measure orders name a
 * selected measure, and only the change orders need a compared period. An optional column tuple
 * narrows the sorted cell to one column of the grid instead of the row total.
 */
function rowSortV4(
  value: any,
  measureIds: number[],
  comparePrevious: boolean,
  columnArity: number,
): ExploreRowSortV4 {
  object(value, ['by', 'direction', 'measureId', 'columnTuple']);
  const { by, direction, measureId, columnTuple } = value;
  if (!ROW_SORT_FIELDS_V4.includes(by) || !['asc', 'desc'].includes(direction)) invalid();
  if (by === 'label') {
    if (measureId !== undefined || columnTuple !== undefined) invalid();
    return { by, direction };
  }
  if (!Number.isSafeInteger(measureId) || !measureIds.includes(measureId)) invalid();
  if (by !== 'value' && !comparePrevious) invalid();
  if (columnTuple !== undefined)
    return {
      by,
      direction,
      measureId: Number(measureId),
      columnTuple: columnTupleValue(columnTuple, columnArity),
    };
  return { by, direction, measureId: Number(measureId) };
}

/**
 * Expanded hierarchy rows. Every key is a single value, so a duplicate is the same JSON tuple; the
 * list is capped because each entry is one drill path the user opened, not query input.
 */
function expandedRows(value: any): ExploreExpandedRow[] {
  if (!Array.isArray(value) || value.length > MAX_EXPANDED_ROWS) invalid();
  const seen = new Set<string>();
  return value.map(candidate => {
    const tuple = expandedRow(candidate);
    const key = JSON.stringify(tuple);
    if (seen.has(key)) invalid();
    seen.add(key);
    return tuple;
  });
}

/**
 * Version 3 pivot layout: the version 2 axes plus the row hierarchy, its ordering and the expanded
 * rows. An expanded list only means something for a hierarchy nested on both row columns, so a
 * state without that layout is rejected instead of stored as dead keys.
 */
function pivotV3(value: any, measureIds: number[]): ExplorePivotV3 {
  object(value, PIVOT_V3_FIELDS);
  const base = pivot({
    enabled: value.enabled,
    rowColumns: value.rowColumns,
    columnColumns: value.columnColumns,
  });
  if (typeof value.rowHierarchy !== 'boolean') invalid();
  const sort = rowSort(value.rowSort, measureIds);
  const rows = expandedRows(value.expandedRows);
  if (rows.length && (!value.rowHierarchy || base.rowColumns.length !== HIERARCHY_ROW_COLUMNS))
    invalid();
  return { ...base, rowHierarchy: value.rowHierarchy, rowSort: sort, expandedRows: rows };
}

/**
 * Version 4 optional bucket axis. The bucket column is a civil label of one axis column, so it must
 * already be in exactly one axis, and the bucket timezone must agree with the saved period.
 */
function timeAxis(value: any, axes: string[], periodTimeZone?: string): ExploreTimeAxis {
  object(value, TIME_AXIS_FIELDS);
  const name = column(value.column);
  if (typeof value.grain !== 'string' || !GRAINS.includes(value.grain)) invalid();
  if (typeof value.timeZone !== 'string') invalid();
  const timeZone = validateBusinessTimeZone(value.timeZone);
  if (!axes.includes(name)) invalid();
  if (periodTimeZone !== undefined && timeZone !== periodTimeZone) invalid();
  return { column: name, grain: value.grain as ExploreTimeAxis['grain'], timeZone };
}

/**
 * Shared shape of the version 4 and version 5 pivot layouts: the version 3 fields plus an optional
 * bucket axis. The caller has already checked that only its own version's keys are present.
 */
function pivotV4Core(
  value: any,
  measureIds: number[],
  comparePrevious: boolean,
  periodTimeZone?: string,
): ExplorePivotV4 {
  const base = pivot({
    enabled: value.enabled,
    rowColumns: value.rowColumns,
    columnColumns: value.columnColumns,
  });
  if (typeof value.rowHierarchy !== 'boolean') invalid();
  const sort = rowSortV4(value.rowSort, measureIds, comparePrevious, base.columnColumns.length);
  const rows = expandedRows(value.expandedRows);
  if (rows.length && (!value.rowHierarchy || base.rowColumns.length !== HIERARCHY_ROW_COLUMNS))
    invalid();
  const axes = base.rowColumns.concat(base.columnColumns);
  const bucket =
    value.timeAxis === undefined ? undefined : timeAxis(value.timeAxis, axes, periodTimeZone);
  return {
    ...base,
    rowHierarchy: value.rowHierarchy,
    rowSort: sort,
    expandedRows: rows,
    ...(bucket !== undefined ? { timeAxis: bucket } : {}),
  };
}

/**
 * Version 4 pivot layout: the version 3 fields plus an optional bucket axis. Temporal membership of
 * the bucket column is checked against the live source at save time, like every other column name.
 */
function pivotV4(
  value: any,
  measureIds: number[],
  comparePrevious: boolean,
  periodTimeZone?: string,
): ExplorePivotV4 {
  object(value, PIVOT_V4_FIELDS);
  return pivotV4Core(value, measureIds, comparePrevious, periodTimeZone);
}

/**
 * Version 5 pivot layout: the version 4 fields plus a required table mode. A flat table has no row
 * hierarchy, no expanded rows and no column cell to sort by, so each is a contradictory request.
 */
function pivotV5(
  value: any,
  measureIds: number[],
  comparePrevious: boolean,
  periodTimeZone?: string,
): ExplorePivotV5 {
  object(value, PIVOT_V5_FIELDS);
  const base = pivotV4Core(value, measureIds, comparePrevious, periodTimeZone);
  if (!TABLE_MODES.includes(value.tableMode)) invalid();
  if (value.tableMode === 'flat') {
    if (base.rowHierarchy) invalid();
    if (base.expandedRows.length) invalid();
    if (base.rowSort.columnTuple !== undefined) invalid();
  }
  return { ...base, tableMode: value.tableMode as ExplorePivotV5['tableMode'] };
}

/** Change sorts compare against the previous period, so they require comparePrevious. */
function rankingSort(value: any, comparePrevious: boolean): ExploreRankingSort {
  object(value, ['by', 'direction']);
  const { by, direction } = value;
  if (!SORT_FIELDS.includes(by) || !['asc', 'desc'].includes(direction)) invalid();
  if (by !== 'value' && !comparePrevious) invalid();
  return { by, direction } as ExploreRankingSort;
}

/**
 * Structural validation only; catalog membership (columns, measures, temporal bounds) is checked
 * separately against the live source so this stays free of heavy queries.
 */
export function validateExploreViewState(input: any): ExploreViewState {
  const version = input && input.version;
  if (version !== 1 && version !== 2 && version !== 3 && version !== 4 && version !== 5) invalid();
  // Version 1 rejects a stored pivot as an unknown key; versions 2 through 5 require one.
  object(input, version === 1 ? STATE_FIELDS : PIVOT_STATE_FIELDS);
  if (typeof input.timeZone !== 'string') invalid();
  const timeZone = validateBusinessTimeZone(input.timeZone);
  const ids = measureIds(input.measureIds);
  const dimensionColumns = dimensions(input.dimensionColumns);
  const filterList = filters(input.filters);
  if (typeof input.comparePrevious !== 'boolean') invalid();
  if (typeof input.includeRows !== 'boolean') invalid();
  if (typeof input.trendGrain !== 'string' || !GRAINS.includes(input.trendGrain)) invalid();
  const sort = rankingSort(input.rankingSort, input.comparePrevious);
  if (!Number.isSafeInteger(input.rankingMeasureId) || !ids.includes(input.rankingMeasureId))
    invalid();
  // The query compares against the period preceding an applied date range, so a stored view must
  // carry that range too; a non-value sort without it would not be executable.
  if (input.comparePrevious && input.dateRange === undefined) invalid();
  const state: any = {
    version,
    timeZone,
    measureIds: ids,
    dimensionColumns,
    rankingMeasureId: Number(input.rankingMeasureId),
    rankingSort: sort,
    filters: filterList,
    trendGrain: input.trendGrain,
    comparePrevious: input.comparePrevious,
    includeRows: input.includeRows,
    ...(input.conditions === undefined
      ? {}
      : { conditions: parseExploreViewConditions(input.conditions) }),
  };
  if (version === 2) state.pivot = pivot(input.pivot);
  if (version === 3) state.pivot = pivotV3(input.pivot, ids);
  // A bucket axis only has a period to agree with when the state carries a date range, and a saved
  // range always takes the state timezone, so the bucket timezone resolves against that same zone.
  if (version === 4)
    state.pivot = pivotV4(
      input.pivot,
      ids,
      input.comparePrevious,
      input.dateRange !== undefined ? timeZone : undefined,
    );
  if (version === 5)
    state.pivot = pivotV5(
      input.pivot,
      ids,
      input.comparePrevious,
      input.dateRange !== undefined ? timeZone : undefined,
    );
  if (input.dateRange !== undefined) {
    const dateRange = validateDateRange(input.dateRange);
    // The exploration picker stores civil YYYY-MM-DD days only; the query API keeps timestamp
    // precision, but a saved view must not accept a state the picker cannot round-trip.
    if (dateRange.precision === 'timestamp') invalid();
    // A view keeps one business timezone; the period timezone must not contradict it.
    if (dateRange.timeZone !== undefined && dateRange.timeZone !== timeZone) invalid();
    dateRangeBounds(dateRange, timeZone);
    // The query defaults an omitted period timezone to UTC, so persist the state timezone onto the
    // range; otherwise a non-UTC view would silently be executed in UTC.
    state.dateRange = { ...dateRange, timeZone };
  }
  return JSON.parse(JSON.stringify(state));
}
