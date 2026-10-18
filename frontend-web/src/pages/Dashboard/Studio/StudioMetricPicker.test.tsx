import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import StudioMetricPicker from './StudioMetricPicker';
const change = vi.fn();
const metrics = [
  {
    id: 9,
    label: '환불률',
    definitionVersion: 3,
    definition: { aggregation: 'RATIO_SUM', column: 'refund', denominatorColumn: 'revenue', scale: 100, unit: '%' },
  },
  {
    id: 10,
    label: '환불률',
    definitionVersion: 2,
    definition: { aggregation: 'WEIGHTED_AVG', column: 'price', weightColumn: 'quantity', unit: '원' },
  },
  { id: 11, label: 'ＲＥＶＥＮＵＥ KPI', definitionVersion: 1 },
];
const props = () => ({ metrics, selected: [9], busy: false, onChange: change });
afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());
const open = () => fireEvent.click(screen.getByRole('button', { name: '저장 지표 검색' }));
const search = (value: string) => fireEvent.change(screen.getByLabelText('지표 이름·열·단위로 검색'), { target: { value } });
it('distinguishes equal labels by ID and version without preselecting others', () => {
  render(<StudioMetricPicker {...props()} />);
  expect(screen.getByRole('region', { name: '재사용 저장 지표 목록' }).getAttribute('tabindex')).toBe('0');
  expect(screen.getByRole('checkbox', { name: '환불률 · #9 · v3' }).getAttribute('aria-checked')).toBe('true');
  expect(screen.getByRole('checkbox', { name: '환불률 · #10 · v2' }).getAttribute('aria-checked')).toBe('false');
  expect(change).not.toHaveBeenCalled();
});
it('shows exact ratio and weighted fields without inventing formulas', () => {
  render(<StudioMetricPicker {...props()} />);
  for (const value of ['RATIO_SUM', 'WEIGHTED_AVG', 'refund', 'revenue', 'price', 'quantity', '100', '%', '원'])
    expect(screen.getByText(value)).toBeTruthy();
  expect(screen.getByText('계산 기준을 확인하지 못했습니다.')).toBeTruthy();
});
it('filters by normalized label and displayed ID while retaining selected entries', () => {
  render(<StudioMetricPicker {...props()} />);
  open();
  search(' revenue kpi ');
  expect(screen.getByText(/검색 결과 1개 · 선택 1개/)).toBeTruthy();
  expect(screen.getByRole('checkbox', { name: '환불률 · #9 · v3' }).getAttribute('aria-checked')).toBe('true');
  expect(screen.queryByRole('checkbox', { name: '환불률 · #10 · v2' })).toBeNull();
  search('#10');
  expect(screen.getByRole('checkbox', { name: '환불률 · #10 · v2' })).toBeTruthy();
  expect(change).not.toHaveBeenCalled();
});
it('searches units and secondary fields and restores all entries when folded', () => {
  render(<StudioMetricPicker {...props()} />);
  open();
  search('quantity');
  expect(screen.getByText(/검색 결과 1개/)).toBeTruthy();
  search('%');
  expect(screen.getByText(/검색 결과 1개/)).toBeTruthy();
  search('missing');
  expect(screen.getByText(/검색 결과 0개/)).toBeTruthy();
  expect(screen.getByRole('checkbox', { name: '환불률 · #9 · v3' }).getAttribute('aria-checked')).toBe('true');
  open();
  expect(screen.getAllByRole('checkbox')).toHaveLength(3);
  expect(change).not.toHaveBeenCalled();
});
it('only explicit checks invoke the parent once with the target identity', () => {
  render(<StudioMetricPicker {...props()} />);
  fireEvent.click(screen.getByRole('checkbox', { name: '환불률 · #10 · v2' }));
  expect(change).toHaveBeenCalledWith(10, true);
  fireEvent.click(screen.getByRole('checkbox', { name: '환불률 · #9 · v3' }));
  expect(change).toHaveBeenLastCalledWith(9, false);
  expect(change).toHaveBeenCalledTimes(2);
});
it('locks selecting and searching while busy', () => {
  const view = render(<StudioMetricPicker {...props()} />);
  open();
  view.rerender(<StudioMetricPicker {...props()} busy />);
  expect(screen.getByLabelText('지표 이름·열·단위로 검색').hasAttribute('disabled')).toBe(true);
  expect(screen.getByRole('button', { name: '저장 지표 검색' }).hasAttribute('disabled')).toBe(true);
  screen.getAllByRole('checkbox').forEach(c => expect(c.hasAttribute('disabled')).toBe(true));
});
it('handles absent units and does not render SQL or arbitrary definition fields', () => {
  const definition = { aggregation: 'COUNT', column: '*', sql: 'SELECT secret', connectionConfig: 'credentials' };
  render(
    <StudioMetricPicker
      {...props()}
      metrics={[
        {
          ...metrics[0],
          definition,
        },
      ]}
    />,
  );
  expect(screen.getByText('미지정')).toBeTruthy();
  expect(screen.queryByText(/SELECT secret|credentials/)).toBeNull();
});

it('keeps calculation details collapsed until explicit reading without selection callbacks', () => {
  render(<StudioMetricPicker {...props()} />);
  const summary = screen.getByText('계산 기준 확인 · #9');
  const details = summary.closest('details') as HTMLDetailsElement;
  expect(details.open).toBe(false);
  fireEvent.click(summary);
  expect(details.open).toBe(true);
  expect(change).not.toHaveBeenCalled();
});
