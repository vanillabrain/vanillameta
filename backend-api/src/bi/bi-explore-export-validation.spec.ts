jest.mock('../ai/ai.service', () => ({ AiService: class {} }));

import { BadRequestException } from '@nestjs/common';
import { BiExploreService } from './bi-explore.service';

describe('BiExploreService SQL-free export admission', () => {
  // Even reading a dependency property fails, including schema or aggregate SQL access.
  const dependency = new Proxy(
    {},
    {
      get: (_target, key) => {
        throw new Error(`unexpected dependency access: ${String(key)}`);
      },
    },
  );
  const service = new BiExploreService(dependency as any, dependency as any, dependency as any);
  const base = () => ({ sourceId: 1, sourceRevision: 'file-v1', measureIds: [2] });
  const explore = (query: Record<string, unknown> = {}) => ({
    mode: 'explore',
    query: { ...base(), rankingMeasureId: 2, ...query },
  });
  const pivot = (query: Record<string, unknown> = {}) => ({
    mode: 'pivot',
    query: { ...base(), rowColumns: ['region'], columnColumns: ['day'], ...query },
  });
  const dateRange = { column: 'day', start: '2026-01-01', end: '2026-01-31' };

  it.each([explore(), pivot(), pivot({ rowColumns: [], columnColumns: [] })])(
    'accepts aggregate requests without I/O or mutation: %j',
    payload => {
      const before = JSON.stringify(payload);
      expect(service.validateExportRequest(payload)).toEqual(payload);
      expect(JSON.stringify(payload)).toBe(before);
    },
  );

  it.each(['explore', 'pivot'])('accepts exact pinned metric versions for %s without I/O', mode => {
    const payload = (mode === 'explore' ? explore : pivot)({ expectedMeasureVersions: { '2': 3 } });
    expect(service.validateExportRequest(payload)).toEqual(payload);
  });
  it.each([null, [], {}, { '2': 0 }, { '2': 1.5 }, { '2': '1' }, { '02': 1 }, { '2': 1, '3': 1 }])(
    'rejects malformed or non-exact pinned versions without I/O: %j',
    expectedMeasureVersions => {
      for (const payload of [
        explore({ expectedMeasureVersions }),
        pivot({ expectedMeasureVersions }),
      ])
        expect(() => service.validateExportRequest(payload)).toThrow(BadRequestException);
    },
  );

  it('accepts compared filters and the legacy explore sort alias', () => {
    const payload = explore({
      dimensionColumns: ['region'],
      filters: [{ column: 'amount', range: { min: 0 } }],
      dateRange,
      comparePrevious: true,
      trendGrain: 'week',
      leaderboardSort: { by: 'delta', direction: 'asc' },
      page: 0,
      pageSize: 50,
      includeRows: false,
    });
    expect(service.validateExportRequest(payload)).toEqual(payload);
  });

  it('accepts pivot time axes and cell sort without claiming live schema validity', () => {
    const payload = pivot({
      rowColumns: ['region', 'city'],
      dateRange,
      comparePrevious: true,
      rowHierarchy: true,
      rowSort: {
        by: 'percentChange',
        direction: 'desc',
        measureId: 2,
        columnTuple: ['2026-01-01'],
      },
      timeAxis: { column: 'day', grain: 'month', timeZone: 'UTC' },
    });
    expect(service.validateExportRequest(payload)).toEqual(payload);
    expect(service.validateExportRequest(pivot({ tableMode: 'flat' }))).toBeDefined();
  });

  it.each(['explore', 'pivot'])(
    'validates condition ASTs for %s while deferring actual columns',
    mode => {
      const conditions = {
        sourceRevision: 'a'.repeat(64),
        definition: {
          include: { kind: 'predicate', column: 'not-yet-verified', operator: 'eq', values: ['A'] },
          exclude: null,
        },
      };
      const payload = mode === 'explore' ? explore({ conditions }) : pivot({ conditions });
      expect(service.validateExportRequest(payload)).toEqual(payload);
      expect(() =>
        service.validateExportRequest({
          ...payload,
          query: {
            ...payload.query,
            conditions: {
              ...conditions,
              definition: {
                exclude: null,
                include: {
                  kind: 'predicate',
                  column: 'region',
                  operator: 'invalid',
                  values: ['A'],
                },
              },
            },
          },
        }),
      ).toThrow(BadRequestException);
    },
  );

  it.each([
    null,
    [],
    {},
    { mode: 'sql', query: {} },
    { ...explore(), sql: 'SELECT 1' },
    { mode: 'explore', query: [] },
    { mode: 'pivot', query: null },
  ])('rejects malformed envelopes: %j', payload => {
    expect(() => service.validateExportRequest(payload)).toThrow(BadRequestException);
  });

  const commonInvalid = [
    { sourceId: '1' },
    { sourceRevision: '' },
    { measureIds: [] },
    { measureIds: [2, 2] },
    { measureIds: [0] },
    { measureIds: [1, 2, 3, 4, 5, 6, 7] },
    { sql: 'SELECT 1' },
    { filters: {} },
    { filters: [{ column: 'region', value: 'a' }] },
    { filters: [{ column: 'region', values: [] }] },
    { filters: [{ column: 'amount', range: { min: 2, max: 1 } }] },
    { filters: [{ column: 'region', values: ['a'], extra: true }] },
    { dateRange: null },
    { dateRange: { ...dateRange, end: '2026-02-30' } },
    { dateRange: { ...dateRange, start: '2026-02-01' } },
    { dateRange: { ...dateRange, timeZone: 'invalid' } },
    { dateRange: { ...dateRange, extra: true } },
    { dateRange: { ...dateRange, end: '9999-12-31' } },
    { dateRange: { ...dateRange, start: '0001-01-01' }, comparePrevious: true },
    { comparePrevious: true },
    { comparePrevious: 'true' },
    { conditions: {} },
  ];
  describe.each([
    ['explore', explore],
    ['pivot', pivot],
  ] as const)('%s common validation', (_mode, payload) => {
    it.each(commonInvalid)('rejects invalid query without I/O: %j', query => {
      expect(() => service.validateExportRequest(payload(query))).toThrow(BadRequestException);
    });
  });

  it.each([
    { includeRows: true },
    { includeRows: 'false' },
    { rankingMeasureId: 9 },
    { dimensionColumns: 'region' },
    { dimensionColumns: ['region', 'region'] },
    { dimensionColumns: [''] },
    { dimensionColumns: ['a', 'b', 'c', 'd', 'e'] },
    { page: -1 },
    { pageSize: 51 },
    { trendGrain: 'year' },
    { rankingSort: null },
    { rankingSort: { by: 'invalid' } },
    { leaderboardSort: { direction: 'sideways' } },
    { rankingSort: { by: 'delta', direction: 'asc' } },
    { rankingSort: { extra: true } },
    { rankingSort: { by: 'value' }, leaderboardSort: { by: 'invalid' } },
    { rowColumns: [] },
  ])('rejects invalid explore options: %j', query => {
    expect(() => service.validateExportRequest(explore(query))).toThrow(BadRequestException);
  });

  it.each([
    { rowDimensions: ['region'] },
    { columnDimensions: [] },
    { rowDimensions: undefined },
    { rowColumns: 'region' },
    { columnColumns: null },
    { rowColumns: [''] },
    { rowColumns: ['a', 'b', 'c'] },
    { rowColumns: ['region', 'region'] },
    { columnColumns: ['region'] },
    { rowHierarchy: 'true' },
    { tableMode: 'other' },
    { tableMode: 'flat', rowHierarchy: true },
    { rowSort: { by: 'value', direction: 'asc', measureId: 9 } },
    { rowSort: { by: 'delta', direction: 'asc', measureId: 2 } },
    { rowSort: { by: 'label', direction: 'asc', measureId: 2 } },
    { rowSort: { by: 'label' } },
    { rowSort: { by: 'label', direction: 'asc', extra: true } },
    { rowSort: { by: 'value', direction: 'asc', measureId: 2, columnTuple: [] } },
    { rowSort: { by: 'value', direction: 'asc', measureId: 2, columnTuple: [{}] } },
    {
      tableMode: 'flat',
      rowSort: { by: 'value', direction: 'asc', measureId: 2, columnTuple: ['a'] },
    },
    { timeAxis: [] },
    { timeAxis: { column: 'day', grain: 'year', timeZone: 'UTC' } },
    { timeAxis: { column: 'missing', grain: 'day', timeZone: 'UTC' } },
    { timeAxis: { column: 'day', grain: 'day', timeZone: 'invalid' } },
    { timeAxis: { column: 'day', grain: 'day', timeZone: 'UTC', extra: true } },
    { dateRange, timeAxis: { column: 'day', grain: 'day', timeZone: 'Asia/Seoul' } },
    { trendGrain: 'day' },
    { includeRows: false },
  ])('rejects invalid pivot options: %j', query => {
    expect(() => service.validateExportRequest(pivot(query))).toThrow(BadRequestException);
  });

  it('shares preflight with immediate export and ordinary query/pivot', async () => {
    const assertSourceAction = jest.fn().mockResolvedValue(undefined);
    const authorized = new BiExploreService(
      { assertSourceAction } as any,
      dependency as any,
      dependency as any,
    );
    await expect(authorized.exportCsv(explore({ filters: {} }), 1)).rejects.toThrow(
      BadRequestException,
    );
    expect(assertSourceAction).toHaveBeenCalledWith(1, 1, 'export');
    await expect(service.query(explore({ dimensionColumns: ['a', 'a'] }).query, 1)).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.pivot(pivot({ rowColumns: ['day'] }).query, 1)).rejects.toThrow(
      BadRequestException,
    );
  });
});
