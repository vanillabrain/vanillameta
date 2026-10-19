import React from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import AnalysisBasis, { analysisFilterBasis } from './AnalysisBasis';
afterEach(cleanup);
it('keeps zero bounds and typed categorical values distinct, with explicit unknown scope', () => {
  expect(analysisFilterBasis([{ column: 'amount', range: { min: 0 } }])).toBe('amount: 0 ~ +∞');
  expect(analysisFilterBasis([{ column: 'category', values: [1, '1', null, false] }], true)).toBe(
    'category: 1, "1", null, false · 포함·제외 조건 적용됨',
  );
  expect(analysisFilterBasis([{ column: 'unknown' }])).toContain('조건 확인 필요');
  expect(analysisFilterBasis([], true)).not.toContain('필터 없음');
});
it('provides one named readonly region with full long values behind a native keyboard disclosure', () => {
  const name = '매우긴사업부매출분석'.repeat(20);
  const view = render(
    <AnalysisBasis
      status="게시본 · V2"
      data={name}
      period="전체 기간 · UTC"
      filters="공통 필터 없음"
      metrics="총매출 · USD"
    />,
  );
  const region = screen.getByRole('region', { name: '분석 기준' });
  expect(within(region).queryByRole('button')).toBeNull();
  const details = view.container.querySelector('details');
  expect(details?.open).toBe(false);
  expect(details?.querySelector('dd')?.textContent).toBe(name);
  expect(details?.querySelector('summary')?.textContent).toBe('기준 자세히 보기');
});
