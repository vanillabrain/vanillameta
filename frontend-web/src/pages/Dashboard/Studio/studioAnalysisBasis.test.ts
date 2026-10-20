import { expect, it } from 'vitest';
import { studioAnalysisBasis } from './studioAnalysisBasis';
import type { StudioDocumentV1 } from './studioTypes';
it('projects only pinned document scope and reference versions, including exclusive instants', () => {
  const document = {
    sourceId: 32,
    dateRange: { column: 'event_day', start: '2026-01-01T00:00:00Z', end: '2026-01-02T00:00:00Z', precision: 'timestamp' },
    filters: [{ column: 'customer', values: ['1', 1] }],
    blocks: [{ title: '총매출', measureRefs: [{ id: 5, definitionVersion: '2' }] }],
  } as StudioDocumentV1;
  const before = JSON.stringify(document);
  const basis = studioAnalysisBasis(document);
  expect(basis.data).toBe('데이터 소스 #32');
  expect(basis.metrics).toContain('지표 #5 · v2');
  expect(basis.period).toContain('종료 미포함');
  expect(basis.filters).toBe('customer: "1", 1');
  expect(JSON.stringify(document)).toBe(before);
});
