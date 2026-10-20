import { metricLinkItems, refreshMetricLinks, preserveMetricLinks } from './metric-analysis-links';

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

const previous: any = {
  databaseId: 7,
  widgets: [
    {
      blockId: 'total',
      title: 'Total',
      type: 'BOARD_NUMERIC',
      sql: 'SELECT SUM(amount) AS value FROM source',
      valueField: 'value',
    },
    {
      blockId: 'devices',
      title: 'Devices',
      type: 'CHART_COLUMN',
      sql: 'SELECT device, SUM(amount) AS value FROM source GROUP BY device',
      valueField: 'value',
      categoryField: 'device',
    },
  ],
};
const snapshot: any = {
  schemaVersion: 2,
  kind: 'structured-bi-dashboard',
  sourceId: 7,
  items: previous.widgets.map((widget, index) => ({
    key: widget.blockId,
    sourceId: 7,
    metricId: index + 11,
    definitionVersion: 2,
    definition: {
      schemaVersion: 1,
      sourceId: 7,
      definitionVersion: 2,
      aggregation: 'SUM',
      column: 'amount',
    },
    ...(index
      ? { dimension: 'device', dimensionDefinition: { sourceId: 7, column: 'device' } }
      : {}),
  })),
};

it('preserves full metric and dimension evidence by block identity after deletion and visual edits', () => {
  const next = {
    ...previous,
    widgets: [{ ...previous.widgets[1], title: 'Renamed', suffix: ' USD', decimalPlaces: 2 }],
  };
  expect(preserveMetricLinks(snapshot, previous, next).items).toEqual([snapshot.items[1]]);
  expect(snapshot.items).toHaveLength(2);
});

it('does not invent links for inserted or copied blocks with identical SQL', () => {
  const next = {
    ...previous,
    widgets: [{ ...previous.widgets[0], blockId: 'copy' }, previous.widgets[1]],
  };
  expect(preserveMetricLinks(snapshot, previous, next).items).toEqual([{}, snapshot.items[1]]);
});

it.each([
  { sql: 'SELECT AVG(amount) AS value FROM source' },
  { valueField: 'other' },
  { categoryField: 'other_dimension' },
  { type: 'CHART_LINE' },
])('detaches only a block whose calculation or result shape changes: %j', changed => {
  const next = {
    ...previous,
    widgets: [previous.widgets[0], { ...previous.widgets[1], ...changed }],
  };
  expect(preserveMetricLinks(snapshot, previous, next).items).toEqual([snapshot.items[0], {}]);
});

it('rejects cross-source or inconsistent persisted identity/version evidence', () => {
  expect(preserveMetricLinks(snapshot, previous, { ...previous, databaseId: 8 })).toBeNull();
  for (const corrupt of [
    { ...snapshot, sourceId: 8 },
    { ...snapshot, items: snapshot.items.map(item => ({ ...item, key: 'wrong' })) },
    { ...snapshot, items: snapshot.items.map(item => ({ ...item, definitionVersion: 3 })) },
  ])
    expect(preserveMetricLinks(corrupt, previous, previous)).toBeNull();
});

it('preserves a legacy single metric and does not attach that metric to a newly inserted sibling', () => {
  const single = { ...previous, widgets: [previous.widgets[0]] };
  const legacy = { ...snapshot.items[0], schemaVersion: 1, kind: 'structured-bi' };
  expect(preserveMetricLinks(legacy, single, single)).toEqual(legacy);
  const expanded = preserveMetricLinks(legacy, single, previous);
  expect(expanded).toMatchObject({
    schemaVersion: 2,
    kind: 'structured-bi-dashboard',
    items: [snapshot.items[0], {}],
  });
});

it('retains keyed non-metric metadata and promotes readable legacy linked snapshots', () => {
  const unlinked = {
    ...snapshot,
    items: snapshot.items.map(item => ({ key: item.key, presentation: { compact: true } })),
  };
  expect(preserveMetricLinks(unlinked, previous, previous)).toEqual(unlinked);
  const legacy = { ...snapshot, schemaVersion: 1, kind: 'metric-linked-analysis' };
  expect(preserveMetricLinks(legacy, previous, previous)).toMatchObject({
    schemaVersion: 2,
    kind: 'structured-bi-dashboard',
    items: snapshot.items,
  });
});

it('fails closed for ambiguous multi-block or mismatched snapshot identity', () => {
  const keyless = { ...snapshot, items: snapshot.items.map(({ key, ...item }) => item) };
  expect(preserveMetricLinks(keyless, previous, previous)).toBeNull();
  expect(
    preserveMetricLinks({ ...snapshot, items: snapshot.items.slice(1) }, previous, previous),
  ).toBeNull();
});
