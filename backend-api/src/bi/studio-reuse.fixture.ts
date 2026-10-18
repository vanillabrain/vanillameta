import { studioDigest } from '../dashboard-studio/studio-legacy';
import { exploreViewRevision } from './explore-view-state';
/** Public sample semantics; no account credentials or application state. */
export function studioReuseFixture() {
  const columns = [
    ['day', 'TIMESTAMP', false, true],
    ['company', 'VARCHAR', false, false],
    ['component', 'VARCHAR', false, false],
    ['revenue', 'DOUBLE', true, false],
    ['profit', 'DOUBLE', true, false],
  ].map(([name, type, numeric, temporal]) => ({ name, type, numeric, temporal }));
  const schemaVersion = studioDigest(columns);
  const definitions = [
    { aggregation: 'SUM', column: 'revenue', unit: 'USD', label: 'Revenue' },
    {
      aggregation: 'RATIO_SUM',
      column: 'profit',
      denominatorColumn: 'revenue',
      scale: 100,
      unit: '%',
      label: 'Margin',
    },
  ].map(d => ({
    schemaVersion: 1,
    definitionVersion: 1,
    sourceId: 1,
    tableName: 'uploaded_data',
    decimalPlaces: 2,
    numberNotation: 'plain',
    ...d,
  }));
  const catalog: any = {
    sourceId: 1,
    sourceRevision: 'a'.repeat(64),
    measures: definitions.map((definition, i) => ({
      id: i + 1,
      label: definition.label,
      definitionVersion: 1,
      definition,
    })),
    dimensions: columns.map((c: any) => ({
      column: c.name,
      type: c.type,
      numeric: c.numeric,
      temporal: c.temporal,
    })),
    temporalColumns: [{ column: 'day' }],
  };
  catalog.viewRevision = exploreViewRevision(catalog);
  const state = {
    version: 1,
    mode: 'segment',
    segment: {
      dimensionColumn: 'company',
      pivotColumn: 'component',
      conditions: [
        { measureId: 1, operator: 'gte', value: 1000 },
        { measureId: 2, operator: 'lt', value: 20 },
      ],
    },
    measureIds: [1, 2],
    dimensionColumns: ['company'],
    rankingMeasureId: 1,
    leaderboardSort: { by: 'value', direction: 'desc' },
    filters: [],
    dateRange: null,
    relativePeriod: null,
    trendGrain: 'day',
    comparePrevious: false,
    includeRows: false,
  };
  const chart = {
    id: 'chart-a',
    definitionKey: 'chart-a',
    kind: 'BOARD_NUMERIC',
    title: 'Revenue',
    description: '',
    measureRefs: [{ id: 1, definitionVersion: '1' }],
    dimensionRefs: [],
    display: { decimalPlaces: 2 },
  };
  const pivot = {
    id: 'pivot-a',
    definitionKey: 'pivot-a',
    kind: 'SEGMENT_PIVOT',
    title: 'Qualified margin',
    description: '',
    measureRefs: [
      { id: 1, definitionVersion: '1' },
      { id: 2, definitionVersion: '1' },
    ],
    dimensionRefs: ['company', 'component'].map(key => ({ key, sourceId: 1, schemaVersion })),
    display: {},
    pivot: { revision: catalog.viewRevision, state },
  };
  const document: any = {
    schemaVersion: 1,
    dashboardId: 1,
    revision: 'b'.repeat(64),
    title: 'Margin demo',
    sourceId: 1,
    blocks: [chart, pivot],
    layouts: Object.fromEntries(
      [
        ['xs', 1],
        ['md', 8],
        ['lg', 12],
      ].map(([bp, w]) => [
        bp,
        ['chart-a', 'pivot-a'].map((id, i) => ({ id, x: 0, y: i * 8, w, h: 8 })),
      ]),
    ),
  };
  const widget = {
    blockId: 'chart-a',
    type: 'BOARD_NUMERIC',
    title: 'Revenue',
    description: '',
    sql: 'SELECT SUM("revenue") AS value FROM source',
    valueField: 'value',
    decimalPlaces: 2,
  };
  const analysis: any = {
    databaseId: 1,
    title: document.title,
    revision: document.revision,
    widgets: [widget],
  };
  const snapshot: any = {
    schemaVersion: 2,
    kind: 'structured-bi-dashboard',
    sourceId: 1,
    items: [
      {
        key: 'chart-a',
        sourceId: 1,
        metricId: 1,
        definitionVersion: 1,
        definition: definitions[0],
        chart: 'number',
      },
    ],
    studioPivots: [pivot],
    studioBlockOrder: document.blocks.map(b => b.id),
    studioLayouts: document.layouts,
  };
  const columnMap = {
    day: 'event_day',
    company: 'customer',
    component: 'service',
    revenue: 'sales',
    profit: 'earnings',
  };
  const target: any = {
    sourceId: 2,
    supported: true,
    dataVersion: 'c'.repeat(64),
    columns: columns.map((c: any) => ({ ...c, name: columnMap[c.name] })),
  };
  return { analysis, snapshot, document, catalog, schemaVersion, target, columnMap };
}
