import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import StudioEvidence from './StudioEvidence';
const document: any = {
  sourceId: 3,
  blocks: [
    {
      id: 'b1',
      definitionKey: 'b1',
      kind: 'BOARD_NUMERIC',
      title: '매출',
      measureRefs: [{ id: 5, definitionVersion: '2' }],
      dimensionRefs: [],
      display: {},
    },
  ],
};
const evidence: any = {
  schemaVersion: 1,
  queriedAt: '2026-10-18T00:00:00.000Z',
  documentRevision: 'a'.repeat(64),
  source: { id: 3, revision: 'b'.repeat(64), dataVersion: 'c'.repeat(64), schemaVersion: 'd'.repeat(64) },
  query: {
    filters: [],
    dateRange: null,
    blocks: [
      {
        id: 'b1',
        definitionKey: 'b1',
        kind: 'BOARD_NUMERIC',
        measureRefs: document.blocks[0].measureRefs,
        dimensionRefs: [],
        timeGrain: 'auto',
      },
    ],
  },
  blocks: [
    {
      blockId: 'b1',
      measureRefs: document.blocks[0].measureRefs,
      calculation: { aggregation: 'SUM', column: 'revenue', unit: 'KRW' },
      resultStatus: 'available',
      aggregateRowCount: 1,
    },
  ],
};
describe('Studio evidence panel', () => {
  it('offers same-scope exploration only for a clean saved revision with verified numeric/grouped data', () => {
    const d = { ...document, dashboardId: 9, revision: evidence.documentRevision };
    const view = render(<StudioEvidence document={d} evidence={evidence} saved />);
    const href = String(screen.getByText('같은 조건으로 탐색 ↗').closest('a')?.getAttribute('href'));
    const params = new URLSearchParams(href.split('?')[1]);
    expect(params.get('studioDashboard')).toBe('9');
    expect(params.get('studioRevision')).toBe(evidence.documentRevision);
    expect(params.get('sourceRevision')).toBe(evidence.source.revision);
    expect(href).not.toContain('sql');
    view.rerender(<StudioEvidence document={d} evidence={evidence} saved={false} />);
    expect(screen.queryByText('같은 조건으로 탐색 ↗')).toBeNull();
  });
  it('shows the server-proven saved formula label without exposing SQL or snapshots', () => {
    const expressionLabel = '(총매출 (#1 · v1) − 총비용 (#2 · v1))';
    const next = {
      ...evidence,
      blocks: [{ ...evidence.blocks[0], calculation: { aggregation: 'FORMULA', unit: 'USD', expressionLabel } }],
    };
    render(<StudioEvidence document={document} evidence={next} />);
    expect(screen.getByText(expressionLabel + ' · USD')).toBeTruthy();
    expect(screen.queryByText('FORMULA(*) · USD')).toBeNull();
  });
  it('shows evidence with real query time and canonical calculation without claiming ingest time', () => {
    render(<StudioEvidence document={document} evidence={evidence} />);
    expect(screen.getByText('SUM(revenue) · KRW')).toBeTruthy();
    expect(screen.getByText(/저장 지표 #5 · 정의 v2/)).toBeTruthy();
    expect(screen.getByText(/조회 완료 시각/)).toBeTruthy();
    expect(screen.queryByText('마지막 갱신 성공 시각')).toBeNull();
  });
  it('does not relabel old rows after a scope change', () => {
    render(
      <StudioEvidence document={{ ...document, filters: [{ column: 'channel', values: ['Site'] }] }} evidence={evidence} />,
    );
    expect(screen.getByText(/현재 편집 조건과 다릅니다/)).toBeTruthy();
    expect(screen.queryByText('SUM(revenue) · KRW')).toBeNull();
  });
  it('does not borrow evidence for AI changes or malformed data', () => {
    const { rerender } = render(<StudioEvidence document={document} evidence={evidence} unverifiedAi />);
    expect(screen.queryByText('SUM(revenue) · KRW')).toBeNull();
    rerender(<StudioEvidence document={document} evidence={{ schemaVersion: 1 }} />);
    expect(screen.getByText(/실행 근거가 없습니다/)).toBeTruthy();
  });
  it('keeps valid evidence for title or display-only edits', () => {
    render(
      <StudioEvidence
        document={{ ...document, blocks: [{ ...document.blocks[0], title: '변경 제목', display: { decimalPlaces: 2 } }] }}
        evidence={evidence}
      />,
    );
    expect(screen.getByText('SUM(revenue) · KRW')).toBeTruthy();
    expect(screen.getByText('변경 제목')).toBeTruthy();
  });
  it('marks suppressed chart data as unavailable rather than a zero-row result', () => {
    render(
      <StudioEvidence
        document={document}
        evidence={{ ...evidence, blocks: [{ ...evidence.blocks[0], resultStatus: 'unavailable', aggregateRowCount: null }] }}
      />,
    );
    expect(screen.getByText(/요청한 집계의 결과 확인 불가/)).toBeTruthy();
    expect(screen.queryByText(/집계 결과 0행/)).toBeNull();
  });
  it('does not invent missing legacy calculation evidence', () => {
    render(
      <StudioEvidence
        document={document}
        evidence={{ ...evidence, blocks: [{ ...evidence.blocks[0], calculation: null }] }}
      />,
    );
    expect(screen.getByText(/구조화 계산 근거 없음/)).toBeTruthy();
  });
});
