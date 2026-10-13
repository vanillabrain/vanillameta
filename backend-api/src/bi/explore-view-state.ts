import { BadRequestException } from '@nestjs/common';
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
/** Fields every state version shares. */
type ExploreViewStateBase = {
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
/**
 * Versioned saved exploration state. It is a strict whitelist: one unknown key is a client bug.
 * The page offset is intentionally not stored; opening a view always restores page 0.
 * Version 1 is unchanged and rejects a stored pivot; version 2 requires one.
 */
export type ExploreViewState = ExploreViewStateV1 | ExploreViewStateV2;

const MAX_MEASURES = 6;
const MAX_DIMENSIONS = 4;
const MAX_FILTERS = 20;
const MAX_FILTER_VALUES = 50;
const MAX_FILTER_STRING = 256;
const MAX_COLUMN_LENGTH = 128;
const MAX_PIVOT_AXIS_COLUMNS = 2;
const MAX_PIVOT_COLUMNS = 4;
const GRAINS = ['day', 'week', 'month'];
const SORT_FIELDS = ['value', 'delta', 'percentChange'];
const STATE_FIELDS = [
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
/** Version 2 adds the pivot layout; a version 1 state keeps rejecting the key as unknown. */
const V2_STATE_FIELDS = [...STATE_FIELDS, 'pivot'];

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
 * Version 2 pivot layout. A layout toggled off keeps its axes, so both axes are always required
 * and validated; a name may not repeat within an axis or across the two axes.
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
  if (version !== 1 && version !== 2) invalid();
  // Version 1 rejects a stored pivot as an unknown key; version 2 requires one.
  object(input, version === 2 ? V2_STATE_FIELDS : STATE_FIELDS);
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
  };
  if (version === 2) state.pivot = pivot(input.pivot);
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
