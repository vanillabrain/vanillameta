import type { StudioConditions } from '@/pages/Dashboard/Studio/studioTypes';
import { exploreConditions } from './exploreBasis';
import { validTimeZone } from '@/pages/Dashboard/Components/timeSelection';

export type ExploreFilter =
  | { column: string; values: Array<string | number | boolean | null> }
  | { column: string; range: { min?: number; max?: number } };
export type LeaderboardSort = { by: 'value' | 'delta' | 'percentChange'; direction: 'asc' | 'desc' };
export type ExploreDateRange = { column: string; start: string; end: string; timeZone?: string };
export type PivotAxes = { rowDimensions: string[]; columnDimensions: string[] };
export type ExploreViewState = {
  version: 1;
  mode?: 'explore' | 'pivot' | 'segment';
  segment?: {
    dimensionColumn: string;
    conditions: Array<{ measureId: number; operator: 'gte' | 'gt' | 'lte' | 'lt' | 'eq'; value: number }>;
    pivotColumn?: string;
  };
  conditions?: StudioConditions;
  pivot?: PivotAxes;
  measureIds: number[];
  dimensionColumns: string[];
  rankingMeasureId: number;
  leaderboardSort: LeaderboardSort;
  filters: ExploreFilter[];
  dateRange: ExploreDateRange | null;
  relativePeriod: null;
  trendGrain: 'day' | 'week' | 'month';
  comparePrevious: boolean;
  includeRows: boolean;
};
type ViewCatalog = {
  sourceRevision?: string;
  measures: Array<{ id: number }>;
  dimensions: Array<{ column: string; numeric?: boolean }>;
  temporalColumns: Array<{ column: string }>;
};
const invalid = () => {
  throw new Error('탐색 저장 보기의 조건을 확인할 수 없습니다. 현재 지표와 열을 확인해 주세요.');
};
const object = (value: any, keys: string[]) => {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !keys.includes(key)))
    invalid();
};
const column = (value: unknown) => typeof value === 'string' && !!value.trim() && value.length <= 128;
const day = (value: unknown) =>
  typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value + 'T00:00:00Z')) &&
  new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value;

/** Validate server settings before they can mutate the current screen; never carry result data. */
export function parseExploreViewState(value: unknown, catalog?: ViewCatalog): ExploreViewState {
  const state = value as ExploreViewState;
  object(state, [
    'version',
    'conditions',
    'mode',
    'pivot',
    'segment',
    'measureIds',
    'dimensionColumns',
    'rankingMeasureId',
    'leaderboardSort',
    'filters',
    'dateRange',
    'relativePeriod',
    'trendGrain',
    'comparePrevious',
    'includeRows',
  ]);
  if (
    state.version !== 1 ||
    state.relativePeriod !== null ||
    !['day', 'week', 'month'].includes(state.trendGrain) ||
    typeof state.comparePrevious !== 'boolean' ||
    typeof state.includeRows !== 'boolean'
  )
    invalid();
  if (
    !Array.isArray(state.measureIds) ||
    !state.measureIds.length ||
    state.measureIds.length > 6 ||
    new Set(state.measureIds).size !== state.measureIds.length ||
    state.measureIds.some(id => !Number.isSafeInteger(id) || id <= 0) ||
    !state.measureIds.includes(state.rankingMeasureId)
  )
    invalid();
  if (
    !Array.isArray(state.dimensionColumns) ||
    state.dimensionColumns.length > 4 ||
    state.dimensionColumns.some(name => !column(name)) ||
    new Set(state.dimensionColumns).size !== state.dimensionColumns.length
  )
    invalid();
  object(state.leaderboardSort, ['by', 'direction']);
  if (
    !['value', 'delta', 'percentChange'].includes(state.leaderboardSort.by) ||
    !['asc', 'desc'].includes(state.leaderboardSort.direction)
  )
    invalid();
  if (state.dateRange !== null) {
    object(state.dateRange, ['column', 'start', 'end', 'timeZone']);
    if (
      !column(state.dateRange.column) ||
      !day(state.dateRange.start) ||
      !day(state.dateRange.end) ||
      state.dateRange.start > state.dateRange.end ||
      ('timeZone' in state.dateRange && !validTimeZone(state.dateRange.timeZone))
    )
      invalid();
  }
  if ((state.comparePrevious && !state.dateRange) || (state.leaderboardSort.by !== 'value' && !state.comparePrevious))
    invalid();
  if (
    !Array.isArray(state.filters) ||
    state.filters.length > 5 ||
    new Set(state.filters.map(f => f?.column)).size !== state.filters.length
  )
    invalid();
  for (const filter of state.filters) {
    object(filter, ['column', 'values', 'range']);
    if (!column(filter.column) || Number('values' in filter) + Number('range' in filter) !== 1) invalid();
    if ('values' in filter) {
      if (
        !Array.isArray(filter.values) ||
        !filter.values.length ||
        filter.values.length > 50 ||
        filter.values.some(
          v =>
            !(
              v === null ||
              typeof v === 'boolean' ||
              (typeof v === 'string' && v.length <= 2000) ||
              (typeof v === 'number' && Number.isFinite(v))
            ),
        )
      )
        invalid();
    } else {
      object(filter.range, ['min', 'max']);
      if (
        !Object.keys(filter.range).length ||
        Object.values(filter.range).some(
          v => typeof v !== 'number' || !Number.isFinite(v) || Math.abs(v) > Number.MAX_SAFE_INTEGER,
        ) ||
        (filter.range.min !== undefined && filter.range.max !== undefined && filter.range.min > filter.range.max)
      )
        invalid();
    }
  }
  if (state.conditions !== undefined) exploreConditions(state.conditions, catalog?.sourceRevision);
  if (state.mode !== undefined && !['explore', 'pivot', 'segment'].includes(state.mode)) invalid();
  if (state.mode === 'segment') {
    const segment = state.segment;
    object(segment, ['dimensionColumn', 'conditions', 'pivotColumn']);
    if (
      typeof segment.dimensionColumn !== 'string' ||
      !segment.dimensionColumn.trim() ||
      segment.dimensionColumn.length > 128 ||
      state.dimensionColumns.length !== 1 ||
      state.dimensionColumns[0] !== segment.dimensionColumn ||
      state.comparePrevious ||
      state.includeRows ||
      state.leaderboardSort?.by !== 'value' ||
      state.leaderboardSort?.direction !== 'desc'
    )
      invalid();
    const axes = [segment.dimensionColumn, ...(segment.pivotColumn === undefined ? [] : [segment.pivotColumn])];
    if (
      new Set(axes).size !== axes.length ||
      axes.some(name => typeof name !== 'string' || !name.trim() || name.length > 128)
    )
      invalid();
    if (
      catalog &&
      axes.some(
        name =>
          !catalog.dimensions.some(d => d.column === name && !d.numeric) ||
          catalog.temporalColumns.some(d => d.column === name),
      )
    )
      invalid();
    if (!Array.isArray(segment.conditions) || segment.conditions.length < 1 || segment.conditions.length > 3) invalid();
    for (const condition of segment.conditions) {
      object(condition, ['measureId', 'operator', 'value']);
      if (
        !Number.isSafeInteger(condition.measureId) ||
        !state.measureIds.includes(condition.measureId) ||
        !['gte', 'gt', 'lte', 'lt', 'eq'].includes(condition.operator) ||
        typeof condition.value !== 'number' ||
        !Number.isFinite(condition.value) ||
        Math.abs(condition.value) > Number.MAX_SAFE_INTEGER
      )
        invalid();
    }
  } else if (state.segment !== undefined) invalid();
  if (state.mode === 'pivot') {
    object(state.pivot, ['rowDimensions', 'columnDimensions']);
    const axes = state.pivot;
    if (
      !Array.isArray(axes.rowDimensions) ||
      axes.rowDimensions.length < 1 ||
      axes.rowDimensions.length > 2 ||
      !Array.isArray(axes.columnDimensions) ||
      axes.columnDimensions.length > 1
    )
      invalid();
    const names = [...axes.rowDimensions, ...axes.columnDimensions];
    if (names.some(name => !column(name)) || new Set(names).size !== names.length) invalid();
    if (
      catalog &&
      names.some(
        name => !catalog.dimensions.some(d => d.column === name) || catalog.temporalColumns.some(d => d.column === name),
      )
    )
      invalid();
  } else if (state.pivot !== undefined) invalid();
  if (catalog) {
    if (
      state.measureIds.some(id => !catalog.measures.some(m => m.id === id)) ||
      state.dimensionColumns.some(name => !catalog.dimensions.some(d => d.column === name)) ||
      (state.dateRange && state.dateRange.column !== catalog.temporalColumns[0]?.column)
    )
      invalid();
    for (const filter of state.filters) {
      const field = catalog.dimensions.find(d => d.column === filter.column);
      if (!field || ('range' in filter && !field.numeric)) invalid();
    }
  }
  return JSON.parse(JSON.stringify(state));
}
