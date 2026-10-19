import { pivotAggregate } from '../Studio/studioPivot.fixture';
export const mixedReusePreview = (): any => {
  const pivot = pivotAggregate();
  delete pivot.sourceRevision;
  delete pivot.viewRevision;
  return {
    schemaVersion: 1,
    kind: 'studio-reuse-preview',
    title: 'Copy',
    capturedAt: '2026-10-19T00:00:00Z',
    scope: 'UTC',
    newMetricCount: 2,
    blocks: [
      {
        blockId: 'chart1',
        kind: 'BOARD_NUMERIC',
        title: 'Sales',
        description: '',
        display: {},
        widget: {
          type: 'BOARD_NUMERIC',
          valueField: 'value',
          fields: [{ columnName: 'value', columnType: 'number' }],
          datas: [{ value: 500 }],
        },
      },
      { blockId: 'pivot1', kind: 'SEGMENT_PIVOT', title: 'Margin', description: '', display: {}, pivot },
    ],
    layouts: Object.fromEntries(
      ['xs', 'md', 'lg'].map(bp => [
        bp,
        [
          { id: 'chart1', x: 0, y: 0, w: 1, h: 6 },
          { id: 'pivot1', x: 0, y: 6, w: 1, h: 8 },
        ],
      ]),
    ),
  };
};
