import type { StudioBlock, StudioDocumentV1 } from './studioTypes';
export const pivotRecipe = () => ({
  revision: 'b'.repeat(64),
  state: {
    version: 1 as const,
    mode: 'segment' as const,
    segment: {
      dimensionColumn: 'company',
      pivotColumn: 'component',
      conditions: [{ measureId: 1, operator: 'gte' as const, value: 1000 }],
    },
    measureIds: [1],
    dimensionColumns: ['company'],
    rankingMeasureId: 1,
    leaderboardSort: { by: 'value' as const, direction: 'desc' as const },
    filters: [],
    dateRange: null,
    relativePeriod: null,
    trendGrain: 'day' as const,
    comparePrevious: false,
    includeRows: false,
  },
});
export const pivotBlock = (): StudioBlock =>
  ({
    id: 'new:00000000-0000-4000-8000-000000000001',
    kind: 'SEGMENT_PIVOT',
    definitionKey: 'pivot:1',
    title: '고객 Pivot',
    description: '',
    measureRefs: [{ id: 1, definitionVersion: '1' }],
    dimensionRefs: ['company', 'component'].map(key => ({ key, sourceId: 4, schemaVersion: 'v1' })),
    display: {},
    pivot: pivotRecipe(),
  } as StudioBlock);
export const pivotDocument = (): StudioDocumentV1 => ({
  schemaVersion: 1,
  dashboardId: 3,
  revision: 'a'.repeat(64),
  sourceId: 4,
  title: '혼합 대시보드',
  blocks: [pivotBlock()],
  layouts: Object.fromEntries(
    ['lg', 'md', 'xs'].map(bp => [
      bp,
      [{ id: pivotBlock().id, x: 0, y: 0, w: bp === 'xs' ? 1 : bp === 'md' ? 8 : 12, h: 6 }],
    ]),
  ) as StudioDocumentV1['layouts'],
});
export const pivotAggregate = () => ({
  viewRevision: 'b'.repeat(64),
  sourceRevision: 'c'.repeat(64),
  scope: { dimensionColumn: 'company', totalGroups: 1, rows: 8 },
  kpis: [{ id: 1, label: '매출', value: '5431.25', unit: 'USD', decimalPlaces: 2 }],
  groups: [{ category: 'Baro', values: [{ id: 1, value: '5431.25' }] }],
  groupsTruncated: false,
  pivot: {
    column: 'component',
    columns: [{ value: 'Compute', totals: [{ id: 1, value: '5431.25' }] }],
    rows: [{ category: 'Baro', cells: [{ column: 'Compute', values: [{ id: 1, value: '5431.25' }] }] }],
    truncatedColumns: false,
    columnLimit: 20,
  },
});
export const mixedPivotDocument = (): StudioDocumentV1 => {
  const doc = pivotDocument();
  doc.blocks.unshift({
    id: 'chart1',
    kind: 'BOARD_NUMERIC',
    definitionKey: 'chart1',
    title: '기존 매출',
    description: '',
    measureRefs: [],
    dimensionRefs: [],
    display: {},
  });
  for (const bp of ['lg', 'md', 'xs'] as const) {
    doc.layouts[bp][0].y = 6;
    doc.layouts[bp].unshift({ id: 'chart1', x: 0, y: 0, w: 1, h: 6 });
  }
  return doc;
};
