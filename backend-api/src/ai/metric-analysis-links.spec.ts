import { preserveMetricLinks } from './metric-analysis-links';

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
