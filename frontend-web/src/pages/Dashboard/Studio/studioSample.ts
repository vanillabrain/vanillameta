import { StudioBlock, StudioDocumentV1 } from './studioTypes';
export const studioSampleTrend = (scale = 1) => ({
  column: 'ordered_at',
  grain: 'day',
  timeZone: 'UTC',
  points: [5.1, 6.4, 5.9, 8.2, 6.7, 7.3, 8.66].map((v, i) => ({
    time: `2026-10-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
    value: Math.round(v * 1000000 * scale),
  })),
});
export const sampleBlock = (id: string, kind: StudioBlock['kind'], title: string, definitionKey = 'gross'): StudioBlock => ({
  id,
  kind,
  title,
  definitionKey,
  description: '디자인용 가상 데이터',
  measureRefs: [],
  dimensionRefs: [],
  display: { numberNotation: 'compact', decimalPlaces: 2, prefix: '₩' },
});
export const studioSample: StudioDocumentV1 = {
  schemaVersion: 1,
  title: '온라인 스토어 매출·환불',
  sourceId: 1,
  blocks: [
    sampleBlock('gross', 'BOARD_NUMERIC', '총매출'),
    sampleBlock('refund', 'BOARD_NUMERIC', '환불액', 'refund'),
    sampleBlock('net', 'BOARD_NUMERIC', '순매출', 'net'),
    sampleBlock('daily', 'CHART_LINE', '일별 매출 추이'),
    sampleBlock('channel', 'CHART_COLUMN', '채널별 매출'),
  ],
  layouts: {
    lg: [
      { id: 'gross', x: 0, y: 0, w: 4, h: 5 },
      { id: 'refund', x: 4, y: 0, w: 4, h: 5 },
      { id: 'net', x: 8, y: 0, w: 4, h: 5 },
      { id: 'daily', x: 0, y: 5, w: 7, h: 6 },
      { id: 'channel', x: 7, y: 5, w: 5, h: 6 },
    ],
    md: [
      { id: 'gross', x: 0, y: 0, w: 4, h: 5 },
      { id: 'refund', x: 4, y: 0, w: 4, h: 5 },
      { id: 'net', x: 0, y: 5, w: 8, h: 5 },
      { id: 'daily', x: 0, y: 10, w: 8, h: 6 },
      { id: 'channel', x: 0, y: 16, w: 8, h: 6 },
    ],
    xs: [
      { id: 'gross', x: 0, y: 0, w: 1, h: 5 },
      { id: 'refund', x: 0, y: 5, w: 1, h: 5 },
      { id: 'net', x: 0, y: 10, w: 1, h: 5 },
      { id: 'daily', x: 0, y: 15, w: 1, h: 6 },
      { id: 'channel', x: 0, y: 21, w: 1, h: 6 },
    ],
  },
};
