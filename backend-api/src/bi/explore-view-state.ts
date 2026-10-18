import { BadRequestException } from '@nestjs/common';
import { createHash } from 'crypto';
import { dateRangeBounds } from '../ai/dashboard-date-range';
import { normalizeSourceFilters, numericSourceColumns, sourceQuery } from '../ai/dashboard-draft';

const invalid = () => {
  throw new BadRequestException('탐색 저장 보기의 기간·필터·지표 조건을 확인해 주세요.');
};
const object = (value: any, keys: string[]) => {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).some(key => !keys.includes(key))
  )
    invalid();
};
function stable(value: any): any {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map(key => [key, stable(value[key])]),
    );
  return value;
}
/** Definition-only revision: published rows/date bounds do not rewrite saved settings. */
export function exploreViewRevision(catalog: any): string {
  return createHash('sha256')
    .update(
      JSON.stringify(
        stable({
          sourceId: catalog.sourceId,
          measures: [...catalog.measures].sort((a, b) => a.id - b.id),
          dimensions: [...catalog.dimensions].sort((a, b) => a.column.localeCompare(b.column)),
        }),
      ),
    )
    .digest('hex');
}
export function validateExploreViewState(input: any, catalog: any) {
  object(input, [
    'version',
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
    input.version !== 1 ||
    input.relativePeriod !== null ||
    !['day', 'week', 'month'].includes(input.trendGrain) ||
    typeof input.comparePrevious !== 'boolean' ||
    typeof input.includeRows !== 'boolean'
  )
    invalid();
  if (
    !Array.isArray(input.measureIds) ||
    !input.measureIds.length ||
    input.measureIds.length > 6 ||
    new Set(input.measureIds).size !== input.measureIds.length ||
    input.measureIds.some(
      id => !Number.isSafeInteger(id) || id <= 0 || !catalog.measures.some(m => m.id === id),
    ) ||
    !input.measureIds.includes(input.rankingMeasureId)
  )
    invalid();
  const columns = catalog.dimensions.map(d => d.column);
  if (
    !Array.isArray(input.dimensionColumns) ||
    input.dimensionColumns.length > 4 ||
    new Set(input.dimensionColumns).size !== input.dimensionColumns.length ||
    input.dimensionColumns.some(name => !columns.includes(name))
  )
    invalid();
  if (input.mode !== undefined && !['explore', 'pivot', 'segment'].includes(input.mode)) invalid();
  if (input.mode === 'segment') {
    const segment = input.segment;
    object(segment, ['dimensionColumn', 'conditions', 'pivotColumn']);
    if (
      typeof segment.dimensionColumn !== 'string' ||
      !segment.dimensionColumn.trim() ||
      segment.dimensionColumn.length > 128 ||
      input.dimensionColumns.length !== 1 ||
      input.dimensionColumns[0] !== segment.dimensionColumn ||
      input.comparePrevious ||
      input.includeRows ||
      input.leaderboardSort?.by !== 'value' ||
      input.leaderboardSort?.direction !== 'desc'
    )
      invalid();
    const axes = [
      segment.dimensionColumn,
      ...(segment.pivotColumn === undefined ? [] : [segment.pivotColumn]),
    ];
    if (
      new Set(axes).size !== axes.length ||
      axes.some(name => typeof name !== 'string' || !name.trim() || name.length > 128)
    )
      invalid();
    if (
      axes.some(
        name =>
          !catalog.dimensions.some(d => d.column === name && !d.numeric) ||
          catalog.temporalColumns.some(d => d.column === name),
      )
    )
      invalid();
    if (
      !Array.isArray(segment.conditions) ||
      segment.conditions.length < 1 ||
      segment.conditions.length > 3
    )
      invalid();
    for (const condition of segment.conditions) {
      object(condition, ['measureId', 'operator', 'value']);
      if (
        !Number.isSafeInteger(condition.measureId) ||
        !input.measureIds.includes(condition.measureId) ||
        !['gte', 'gt', 'lte', 'lt', 'eq'].includes(condition.operator) ||
        typeof condition.value !== 'number' ||
        !Number.isFinite(condition.value) ||
        Math.abs(condition.value) > Number.MAX_SAFE_INTEGER
      )
        invalid();
    }
  } else if (input.segment !== undefined) invalid();
  if (input.mode === 'pivot') {
    object(input.pivot, ['rowDimensions', 'columnDimensions']);
    const axes = input.pivot;
    if (
      !Array.isArray(axes.rowDimensions) ||
      axes.rowDimensions.length < 1 ||
      axes.rowDimensions.length > 2 ||
      !Array.isArray(axes.columnDimensions) ||
      axes.columnDimensions.length > 1
    )
      invalid();
    const names = [...axes.rowDimensions, ...axes.columnDimensions];
    if (
      new Set(names).size !== names.length ||
      names.some(
        name => !columns.includes(name) || catalog.temporalColumns.some(d => d.column === name),
      )
    )
      invalid();
  } else if (input.pivot !== undefined) invalid();
  object(input.leaderboardSort, ['by', 'direction']);
  if (
    !['value', 'delta', 'percentChange'].includes(input.leaderboardSort.by) ||
    !['asc', 'desc'].includes(input.leaderboardSort.direction)
  )
    invalid();
  if (input.dateRange !== null) {
    object(input.dateRange, ['column', 'start', 'end', 'timeZone']);
    if (
      input.dateRange.column !== catalog.temporalColumns[0]?.column ||
      !/^\d{4}-\d{2}-\d{2}$/.test(input.dateRange.start) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(input.dateRange.end)
    )
      invalid();
    dateRangeBounds(input.dateRange);
  }
  if (
    (input.comparePrevious && input.dateRange === null) ||
    (input.leaderboardSort.by !== 'value' && !input.comparePrevious)
  )
    invalid();
  if (!Array.isArray(input.filters)) invalid();
  const filters = normalizeSourceFilters(input.filters, false);
  const temporal = catalog.temporalColumns.map(c => c.column);
  const numeric = numericSourceColumns(
    catalog.dimensions.map(d => ({ column_name: d.column, column_type: d.type })),
  );
  sourceQuery(
    'SELECT count(*) AS value FROM source',
    columns,
    filters,
    input.dateRange ?? undefined,
    temporal,
    numeric,
  );
  return JSON.parse(JSON.stringify({ ...input, filters }));
}
