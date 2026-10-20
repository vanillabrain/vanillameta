import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import StudioSemanticReview from './StudioSemanticReview';
import { CreationProposal } from './studioCreation';
vi.mock('@/widget/wrapper/WidgetViewer', () => ({
  default: ({ title }: any) => <div data-testid="chart">{title || 'chart preview'}</div>,
}));
afterEach(cleanup);
const proposal = (metric: any, kind = 'BOARD_NUMERIC'): CreationProposal => ({
  proposalId: 'p',
  sourceId: 3,
  sourceRevision: 'a'.repeat(64),
  title: '분석',
  profile: { sourceId: 3, rowCount: '2', columns: [] },
  semanticProposal: [{ title: '매출 기준', kind, metric }],
  preview: {
    draft: { databaseId: 3, title: '분석', explanation: '', widgets: [] },
    widgets: [
      {
        type: kind,
        valueField: 'value',
        datas: [{ value: 12.5 }],
        fields: [],
        sql: 'private SQL',
        suffix: '%',
        decimalPlaces: 1,
      },
    ],
  } as any,
});
const basis = () => {
  const element = screen.getByText('계산 기준 확인').closest('details');
  if (!element) throw new Error('missing disclosure');
  return element;
};
const open = () => fireEvent.click(screen.getByText('계산 기준 확인'));
it('shows the frozen saved ratio definition and preserves the numeric preview', () => {
  const p = proposal({
    id: 9,
    definitionVersion: 3,
    label: '환불률',
    aggregation: 'RATIO_SUM',
    column: 'refund',
    denominatorColumn: 'revenue',
    scale: 100,
    unit: '%',
  });
  const before = JSON.stringify(p);
  render(<StudioSemanticReview proposal={p} />);
  expect(screen.getByText(/저장 지표 #9 · v3/)).toBeTruthy();
  const details = screen.getByText('계산 기준 확인').closest('details') as HTMLDetailsElement;
  expect(details.open).toBe(false);
  open();
  expect(details.open).toBe(true);
  for (const text of ['집계 방식', 'RATIO_SUM', 'refund', '분모 열', 'revenue', '배율', '100', '단위', '%'])
    expect(within(details).getByText(text)).toBeTruthy();
  expect(screen.getByText('12.5%')).toBeTruthy();
  expect(screen.queryByText('private SQL')).toBeNull();
  expect(JSON.stringify(p)).toBe(before);
});
it('shows the weighted basis alongside an unchanged chart', () => {
  render(
    <StudioSemanticReview
      proposal={proposal(
        { aggregation: 'WEIGHTED_AVG', column: 'price', weightColumn: 'quantity', unit: '원' },
        'CHART_LINE',
      )}
    />,
  );
  open();
  const details = basis();
  expect(within(details).getByText('가중치 열')).toBeTruthy();
  expect(within(details).getByText('quantity')).toBeTruthy();
  expect(within(details).getByText('원')).toBeTruthy();
  expect(screen.getByTestId('chart')).toBeTruthy();
});
it('does not invent a ratio scale or denominator and separates absent units from display suffix', () => {
  render(<StudioSemanticReview proposal={proposal({ aggregation: 'RATIO_SUM', column: 'refund' })} />);
  open();
  const details = basis();
  expect(within(details).getAllByText('미확인')).toHaveLength(2);
  expect(within(details).getByText('미지정')).toBeTruthy();
  expect(screen.getByText('12.5%')).toBeTruthy();
  expect(within(details).queryByText('1')).toBeNull();
});
it('marks missing weights and incomplete definitions without rendering SQL', () => {
  render(
    <StudioSemanticReview proposal={proposal({ aggregation: 'WEIGHTED_AVG', column: 'price', sql: 'SELECT secret' })} />,
  );
  open();
  expect(screen.getByText('미확인')).toBeTruthy();
  expect(screen.queryByText('SELECT secret')).toBeNull();
});
it('retains no-result messaging when only the proposal definition is present', () => {
  const p = proposal({ aggregation: 'SUM', column: 'amount' });
  delete p.preview;
  render(<StudioSemanticReview proposal={p} />);
  open();
  expect(screen.getByText('계산 결과가 없습니다.')).toBeTruthy();
  expect(screen.getByText('미지정')).toBeTruthy();
});

it('distinguishes disclosures for multiple blocks even when their titles match', () => {
  const p = proposal({ aggregation: 'SUM', column: 'amount' });
  p.semanticProposal.push({ ...p.semanticProposal[0] });
  render(<StudioSemanticReview proposal={p} />);
  expect(screen.getByLabelText('1번 매출 기준 계산 기준 확인')).toBeTruthy();
  expect(screen.getByLabelText('2번 매출 기준 계산 기준 확인')).toBeTruthy();
});

it.each([
  {
    presentation: 'summary' as const,
    kind: 'BOARD_NUMERIC',
    value: 13000,
    prefix: '',
    suffix: ' KRW',
    decimals: 0,
    expected: '13,000 KRW',
  },
  {
    presentation: 'table' as const,
    kind: 'CHART_BAR',
    value: 12.5,
    prefix: '$',
    suffix: '',
    decimals: 2,
    expected: '$12.50',
  },
])('preserves frozen root/reused metric bases and currency in $presentation previews', async item => {
  const { basisFixture } = await import('@/api/businessBasis.fixture');
  const p = proposal({ id: 9, definitionVersion: 3, aggregation: 'SUM', column: 'amount', businessBasis: null }, item.kind);
  p.businessBasis = structuredClone(basisFixture);
  const row = p.preview?.widgets[0];
  if (!row) throw new Error('missing preview fixture');
  Object.assign(row, {
    presentation: item.presentation,
    prefix: item.prefix,
    suffix: item.suffix,
    decimalPlaces: item.decimals,
    categoryField: 'category',
    datas: [{ category: '직접 분류', value: item.value }],
  });
  const before = JSON.stringify(p);
  render(<StudioSemanticReview proposal={p} />);
  expect(screen.getByText('업무 기준 확인 · 카탈로그 v2')).toBeTruthy();
  expect(within(basis()).getByText('업무 기준 확인 · 원본 유형 기준')).toBeTruthy();
  const output =
    item.presentation === 'table' ? screen.getByRole('table') : screen.getByRole('note', { name: '매출 기준 집계 요약' });
  expect(within(output).getByText(item.expected)).toBeTruthy();
  expect(screen.queryByTestId('chart')).toBeNull();
  expect(screen.queryByText('private SQL')).toBeNull();
  expect(JSON.stringify(p)).toBe(before);
});
