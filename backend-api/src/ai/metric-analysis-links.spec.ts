import { metricLinkItems, refreshMetricLinks } from './metric-analysis-links';

/**
 * Regression guard for the Studio common-filter scope stored on structuredDefinition.
 * The non-preserving metric-refresh rewrite may only carry the scope of its own source;
 * an unrelated source scope must never be attached to the target draft.
 */
describe('metric link snapshot rewrite preserves only the same-source Studio scope', () => {
  const scope = [{ column: 'channel', values: ['Site', null] as Array<string | null> }];
  const definition = {
    schemaVersion: 1,
    sourceId: 2,
    definitionVersion: 4,
    aggregation: 'SUM',
    column: 'amount',
    tableName: 'uploaded_data',
  };
  const linkedItem = {
    metricId: 9,
    sourceId: 2,
    definitionVersion: 3,
    definition: { schemaVersion: 1, sourceId: 2, definitionVersion: 3 },
  };
  const draft = { databaseId: 2, widgets: [{}, {}] } as any;

  it('keeps studioFilters when the rewrite falls back to a metric-linked-analysis snapshot', () => {
    const snapshot = {
      schemaVersion: 2,
      kind: 'structured-bi-dashboard',
      sourceId: 2,
      dataVersion: 'dv-1',
      studioFilters: scope,
      items: [{ ...linkedItem }, {}],
    };
    const next = refreshMetricLinks(snapshot, draft, [1], 9, definition);
    expect(next).toMatchObject({ schemaVersion: 1, kind: 'metric-linked-analysis', sourceId: 2 });
    expect(next.studioFilters).toEqual(scope);
    expect(next.items[0]).toEqual(snapshot.items[0]);
    expect(next.items[1]).toMatchObject({ metricId: 9, sourceId: 2, definitionVersion: 4 });
    // Only the scope is carried across the rewrite; other metadata keeps dropping.
    expect(next.dataVersion).toBeUndefined();
  });

  it('never carries another source scope into this source draft', () => {
    const snapshot = {
      schemaVersion: 2,
      kind: 'structured-bi-dashboard',
      sourceId: 99,
      studioFilters: scope,
      items: [{ ...linkedItem }],
    };
    const next = refreshMetricLinks(snapshot, draft, [0], 9, definition);
    expect(next.sourceId).toBe(2);
    expect(Object.prototype.hasOwnProperty.call(next, 'studioFilters')).toBe(false);
    expect(metricLinkItems(next, draft)).toEqual([
      { metricId: 9, sourceId: 2, definitionVersion: 4, definition },
      {},
    ]);
  });

  it('carries only the same-source studioDateRange across the snapshot rewrite', () => {
    const range = { column: 'event_time', start: '2026-01-01', end: '2026-01-01' };
    const snapshot = {
      schemaVersion: 2,
      kind: 'structured-bi-dashboard',
      sourceId: 2,
      studioDateRange: range,
      items: [{ ...linkedItem }, {}],
    };
    const next = refreshMetricLinks(snapshot, draft, [1], 9, definition);
    expect(next).toMatchObject({ schemaVersion: 1, kind: 'metric-linked-analysis', sourceId: 2 });
    expect(next.studioDateRange).toEqual(range);
    const foreign = refreshMetricLinks({ ...snapshot, sourceId: 99 }, draft, [0], 9, definition);
    expect(Object.prototype.hasOwnProperty.call(foreign, 'studioDateRange')).toBe(false);
  });

  it('keeps studioFilters on the preserving structured-bi-dashboard branch', () => {
    const snapshot = {
      schemaVersion: 2,
      kind: 'structured-bi-dashboard',
      sourceId: 2,
      studioFilters: scope,
      items: [{ ...linkedItem }, {}],
    };
    const next = refreshMetricLinks(snapshot, draft, [0], 9, definition);
    expect(next).toMatchObject({ schemaVersion: 2, kind: 'structured-bi-dashboard', sourceId: 2 });
    expect(next.studioFilters).toEqual(scope);
  });
});
