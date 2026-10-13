import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { comparisonTrend } from './comparisonTrend';
import MetricTrend from './MetricTrend';
import type { MetricTrendData } from './trendGeometry';

vi.mock('@mui/material', () => {
  const Container = ({ component: Tag = 'div', children, ...props }: any) => {
    delete props.sx;
    return <Tag {...props}>{children}</Tag>;
  };
  return { Box: Container, Typography: Container, Button: Container };
});

const periods = {
  current: { column: 'date', start: '2026-01-04', end: '2026-01-06' },
  previous: { column: 'date', start: '2026-01-01', end: '2026-01-03' },
};
const series = (points: MetricTrendData['points']): MetricTrendData => ({ column: 'date', grain: 'day', points });
afterEach(cleanup);

it('aligns missing leading/interior dates from period starts with one shared scale', () => {
  const current = series([
    { time: '2026-01-05', value: 10 },
    { time: '2026-01-06', value: 20 },
  ]);
  const previous = series([
    { time: '2026-01-01', value: 100 },
    { time: '2026-01-03', value: 0 },
  ]);
  const geometry = comparisonTrend(current, previous, periods);
  expect(geometry.current.dots).toEqual([
    { x: 300, y: 47.6 },
    { x: 596, y: 43.2 },
  ]);
  expect(geometry.previous.dots).toEqual([
    { x: 4, y: 8 },
    { x: 596, y: 52 },
  ]);
  expect(geometry.previous.path).not.toContain('L');
  expect(previous.points[0].time).toBe('2026-01-01');
});

it('preserves negative, NULL, zero and single observations', () => {
  const geometry = comparisonTrend(
    series([{ time: '2026-01-04', value: -10 }]),
    series([
      { time: '2026-01-01', value: 10 },
      { time: '2026-01-02', value: null },
    ]),
    periods,
  );
  expect(geometry.axes.min).toBe(-10);
  expect(geometry.current.dots).toEqual([{ x: 4, y: 52 }]);
  expect(geometry.previous.dots).toEqual([{ x: 4, y: 8 }]);
  expect(comparisonTrend(series([]), series([]), periods).current.path).toBe('');
});

it('refuses ambiguous grain, length, date, duplicate and out-of-period buckets', () => {
  const valid = series([{ time: '2026-01-04', value: 2 }]);
  expect(comparisonTrend({ ...valid, grain: 'week' }, series([]), periods)).toBeUndefined();
  expect(
    comparisonTrend(valid, series([]), { ...periods, previous: { ...periods.previous, end: '2026-01-02' } }),
  ).toBeUndefined();
  expect(
    comparisonTrend(valid, series([]), { ...periods, current: { ...periods.current, start: '2026-02-30' } }),
  ).toBeUndefined();
  expect(comparisonTrend(series([valid.points[0], valid.points[0]]), series([]), periods)).toBeUndefined();
  expect(comparisonTrend(valid, series([{ time: '2026-01-04', value: 2 }]), periods)).toBeUndefined();
  expect(comparisonTrend(series([{ time: '2026-01-04T01:00:00Z', value: 2 }]), series([]), periods)).toBeUndefined();
});

it('renders a dashed comparison, original-date guidance, and removes it when comparison is off', () => {
  const trend = series([{ time: '2026-01-04', value: 10 }]);
  const previousTrend = series([{ time: '2026-01-01', value: 100 }]);
  const view = render(<MetricTrend title="매출" trend={trend} previousTrend={previousTrend} periods={periods} />);
  expect(screen.getByText(/실선: 현재 기간/).textContent).toContain('2026-01-01 ~ 2026-01-03');
  expect(view.container.querySelector('path[stroke-dasharray="5 3"]')).toBeTruthy();
  view.rerender(<MetricTrend title="매출" trend={trend} />);
  expect(view.container.querySelector('path[stroke-dasharray="5 3"]')).toBeNull();
  expect(screen.queryByText(/실선: 현재 기간/)).toBeNull();
});

it('can display previous-only data, and explains unsupported weekly overlays', () => {
  const previousTrend = series([{ time: '2026-01-01', value: 100 }]);
  const view = render(<MetricTrend title="매출" trend={series([])} previousTrend={previousTrend} periods={periods} />);
  expect(view.container.querySelector('path[stroke-dasharray="5 3"]')).toBeTruthy();
  view.rerender(
    <MetricTrend title="매출" trend={{ ...series([]), grain: 'week' }} previousTrend={previousTrend} periods={periods} />,
  );
  expect(screen.getByText(/겹쳐 보기는/)).toBeTruthy();
  expect(view.container.querySelector('path[stroke-dasharray="5 3"]')).toBeNull();
});
