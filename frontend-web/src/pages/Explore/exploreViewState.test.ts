import { expect, it } from 'vitest';
import { parseExploreViewState } from './exploreViewState';
const state = () => ({
  version: 1,
  measureIds: [1, 2],
  dimensionColumns: ['device_type'],
  rankingMeasureId: 1,
  filters: [{ column: 'bid_floor', range: { min: 0, max: 10 } }],
  dateRange: { column: '__time', start: '2023-09-10', end: '2023-09-11', timeZone: 'UTC' },
  relativePeriod: null,
  trendGrain: 'week',
  comparePrevious: true,
  includeRows: true,
  leaderboardSort: { by: 'percentChange', direction: 'asc' },
});
const catalog = {
  measures: [{ id: 1 }, { id: 2 }],
  dimensions: [
    { column: 'bid_floor', numeric: true },
    { column: 'device_type', numeric: false },
  ],
  temporalColumns: [{ column: '__time' }],
};
it('preserves exact settings and rejects unknown schema members before screen mutation', () => {
  const input = state(),
    output = parseExploreViewState(input, catalog);
  expect(output).toEqual(input);
  expect(output).not.toBe(input);
  expect(() => parseExploreViewState(input, { ...catalog, measures: [{ id: 1 }] })).toThrow();
  expect(() => parseExploreViewState(input, { ...catalog, dimensions: [] })).toThrow();
});
it.each([
  { version: 2 },
  { measureIds: [] },
  { measureIds: [1, 1] },
  { rankingMeasureId: 3 },
  { dimensionColumns: ['device_type', 'device_type'] },
  { filters: [{ column: 'bid_floor', range: { min: 10, max: 1 } }] },
  { filters: [{ column: 'bid_floor', range: { min: Infinity } }] },
  { filters: [{ column: 'bid_floor', values: [0], range: { max: 10 } }] },
  { filters: [{ column: 'device_type', range: { min: 1 } }] },
  { dateRange: null },
  { dateRange: { column: '__time', start: '2023-02-30', end: '2023-09-11' } },
  { comparePrevious: false },
  { sql: 'SELECT * FROM source' },
  { relativePeriod: { days: 30, column: '__time' } },
  { leaderboardSort: { by: 'percentChange', direction: 'sideways' } },
])('rejects malformed response %j', over => expect(() => parseExploreViewState({ ...state(), ...over }, catalog)).toThrow());
it('allows empty dimension selection, all time and inclusive one-sided zero bound', () => {
  expect(
    parseExploreViewState(
      {
        ...state(),
        dimensionColumns: [],
        dateRange: null,
        comparePrevious: false,
        leaderboardSort: { by: 'value', direction: 'desc' },
        filters: [{ column: 'bid_floor', range: { max: 0 } }],
      },
      catalog,
    ).filters,
  ).toEqual([{ column: 'bid_floor', range: { max: 0 } }]);
});

it('restores Pivot axes and mode while retaining legacy Explore views', () => {
  const pivot = { ...state(), mode: 'pivot', pivot: { rowDimensions: ['device_type'], columnDimensions: ['bid_floor'] } };
  expect(parseExploreViewState(pivot, catalog)).toEqual(pivot);
  for (const axes of [
    { rowDimensions: [], columnDimensions: [] },
    { rowDimensions: ['device_type'], columnDimensions: ['device_type'] },
    { rowDimensions: ['__time'], columnDimensions: [] },
    { rowDimensions: ['unknown'], columnDimensions: [] },
  ])
    expect(() => parseExploreViewState({ ...pivot, pivot: axes }, catalog)).toThrow();
  expect(() => parseExploreViewState({ ...pivot, mode: 'explore' }, catalog)).toThrow();
  expect(() => parseExploreViewState({ ...pivot, pivot: undefined }, catalog)).toThrow();
  expect(parseExploreViewState(state(), catalog)).toEqual(state());
});

it('validates aggregate segment conditions and typed pivot column before restoring', () => {
  const input = {
    ...state(),
    mode: 'segment',
    dimensionColumns: ['device_type'],
    comparePrevious: false,
    includeRows: false,
    leaderboardSort: { by: 'value', direction: 'desc' },
    segment: { dimensionColumn: 'device_type', conditions: [{ measureId: 1, operator: 'gte', value: 1000 }] },
  };
  expect(parseExploreViewState(input, catalog)).toEqual(input);
  for (const patch of [
    { conditions: [] },
    { pivotColumn: 'device_type' },
    { pivotColumn: 'bid_floor' },
    { conditions: [{ measureId: 99, operator: 'gt', value: 1 }] },
  ])
    expect(() => parseExploreViewState({ ...input, segment: { ...input.segment, ...patch } }, catalog)).toThrow();
  expect(() => parseExploreViewState({ ...input, mode: 'explore' }, catalog)).toThrow();
});

const snapshot = () => ({
  sourceRevision: 'a'.repeat(64),
  definition: { include: { kind: 'predicate', column: 'device_type', operator: 'eq', values: ['App'] }, exclude: null },
});
it('roundtrips an immutable condition snapshot and rejects stale files before restoring', () => {
  const input = { ...state(), conditions: snapshot() };
  const parsed = parseExploreViewState(input, { ...catalog, sourceRevision: 'a'.repeat(64) });
  expect(parsed.conditions).toEqual(input.conditions);
  input.conditions.definition.include.values[0] = 'changed';
  expect((parsed.conditions.definition.include as any).values).toEqual(['App']);
  expect(() => parseExploreViewState(input, { ...catalog, sourceRevision: 'b'.repeat(64) })).toThrow(/파일 버전/);
});
it.each([
  null,
  {},
  { ...snapshot(), extra: true },
  { ...snapshot(), definition: { include: null } },
  {
    ...snapshot(),
    definition: { include: { kind: 'predicate', column: 'x', operator: 'sql', values: ['x'] }, exclude: null },
  },
  {
    ...snapshot(),
    definition: { include: { kind: 'predicate', column: 'x', operator: 'eq', values: ['x'.repeat(40000)] }, exclude: null },
  },
])('rejects invalid or oversized saved conditions %j', conditions => {
  expect(() => parseExploreViewState({ ...state(), conditions })).toThrow();
});
