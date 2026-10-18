import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import StudioReport from './StudioReport';
afterEach(cleanup);
const props = {
  title: '고객별 이익',
  kind: 'CHART_BAR',
  presentation: 'table' as const,
  display: { prefix: '$', decimalPlaces: 2 },
  valueField: 'value',
  categoryField: 'dimension',
  period: '전체 기간',
  scope: '필터 없음',
  rows: [{ dimension: 'Seoul', value: '2657.55000001' }],
};
it('renders formatted and exact grouped aggregates in a focusable native scroll region', () => {
  render(<StudioReport {...props} />);
  expect(screen.getByRole('region', { name: '고객별 이익 집계 표' }).tabIndex).toBe(0);
  expect(screen.getByText('$2,657.55')).toBeTruthy();
  expect(screen.getByText('$2657.55000001')).toBeTruthy();
  expect(screen.getByText('Seoul')).toBeTruthy();
});
it('keeps null distinct from zero and does not execute authored text', () => {
  const description = '<img src=x onerror=alert(1)> 999999';
  const { container } = render(
    <StudioReport
      {...props}
      description={description}
      rows={[
        { dimension: null, value: null },
        { dimension: 'zero', value: 0 },
      ]}
    />,
  );
  expect(screen.getByText('$0.00')).toBeTruthy();
  expect(screen.getAllByText('값 없음').length).toBeGreaterThan(0);
  expect(screen.getByText(description)).toBeTruthy();
  expect(container.querySelector('img')).toBeNull();
  expect(screen.getByText('작성 설명 · 수치 검증 대상 아님')).toBeTruthy();
});
it('builds summary from the executed scalar and discloses its actual scope and precision', () => {
  render(
    <StudioReport
      {...props}
      title="이익"
      kind="BOARD_NUMERIC"
      presentation="summary"
      scope="location: Seoul"
      rows={[{ value: '2657.55' }]}
    />,
  );
  expect(screen.getByRole('note', { name: '이익 집계 요약' }).textContent).toContain('$2,657.55');
  expect(screen.getByText('$2657.55')).toBeTruthy();
  expect(screen.getByText(/조회 기준.*location: Seoul/)).toBeTruthy();
});
it('declines a grouped summary instead of turning the first group into a total', () => {
  render(<StudioReport {...props} presentation="summary" />);
  expect(screen.getByRole('status').textContent).toContain('확인할 수 없습니다');
  expect(screen.queryByText('$2,657.55')).toBeNull();
});

it('puts the aggregate first in a short saved summary block and keeps metadata in a disclosure', () => {
  const { container } = render(
    <StudioReport {...props} kind="BOARD_NUMERIC" presentation="summary" height={70} rows={[{ value: '-6964.84' }]} />,
  );
  expect(container.querySelector('.studio-report-value')?.textContent).toBe('$-6,964.84');
  expect(screen.getByRole('region', { name: '고객별 이익 요약 내용' }).tabIndex).toBe(0);
  expect(container.querySelector('details')?.open).toBe(false);
  expect(container.querySelector('details')?.textContent).toContain('전체 기간');
});
