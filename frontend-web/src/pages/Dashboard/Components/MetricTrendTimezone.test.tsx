import React from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it } from 'vitest';
import MetricTrend from './MetricTrend';
import { comparisonTrend } from './comparisonTrend';
import { MetricTrendData, trendBucketLabel, trendTimeZone } from './trendGeometry';

// points.time is the actual UTC instant at the local bucket start (KST midnight = 15:00Z the day before).
const seoul: MetricTrendData = {
  column: 'event_time',
  grain: 'day',
  timeZone: 'Asia/Seoul',
  points: [
    { time: '2025-12-31T15:00:00Z', value: 10 },
    { time: '2026-01-01T15:00:00Z', value: 20 },
    { time: '2026-01-02T15:00:00Z', value: 30 },
  ],
};
const periods = {
  current: { column: 'date', start: '2026-01-01', end: '2026-01-03' },
  previous: { column: 'date', start: '2025-12-29', end: '2025-12-31' },
};
const series = (points: MetricTrendData['points']): MetricTrendData => ({ column: 'date', grain: 'day', points });
afterEach(cleanup);

it('renders regional bucket labels, axis text and the table in the trend timezone', async () => {
  render(<MetricTrend trend={seoul} title="매출" />);
  const caption = document.querySelector('figcaption');
  expect(caption.textContent).toContain('일별 · Asia/Seoul');
  expect(caption.textContent).toContain('2026-01-01');
  expect(caption.textContent).toContain('2026-01-03');
  const svg = screen.getByRole('img', { name: '매출 일별 추세' });
  expect(svg.querySelector('desc').textContent).toContain('Asia/Seoul 2026-01-01부터 2026-01-03까지');
  expect(document.body.textContent).not.toContain('2025-12-31');
  await userEvent.click(screen.getByLabelText('매출 시계열 데이터 표'));
  const table = screen.getByRole('table');
  expect(within(table).getByText('매출 · 일별 · Asia/Seoul')).toBeTruthy();
  expect(
    within(table)
      .getAllByRole('rowheader')
      .map(cell => cell.textContent),
  ).toEqual(['2026-01-01', '2026-01-02', '2026-01-03']);
});

it('keeps legacy UTC labels unchanged when the timezone is omitted or explicitly UTC', () => {
  const points = [
    { time: '2026-01-01T00:00:00Z', value: 10 },
    { time: '2026-01-02T00:00:00Z', value: 20 },
  ];
  const view = render(<MetricTrend trend={series(points)} title="매출" />);
  expect(document.querySelector('figcaption').textContent).toContain('일별 · UTC');
  expect(document.querySelector('figcaption').textContent).toContain('2026-01-01');
  expect(document.querySelector('desc').textContent).toContain('UTC 2026-01-01부터 2026-01-02까지');
  view.rerender(<MetricTrend trend={{ ...series(points), timeZone: 'UTC' }} title="매출" />);
  expect(document.querySelector('figcaption').textContent).toContain('일별 · UTC');
  expect(document.querySelector('desc').textContent).toContain('UTC 2026-01-01부터 2026-01-02까지');
});

it('formats regional day and hour labels and falls back to UTC for unusable zones', () => {
  expect(trendBucketLabel('2026-01-01T15:00:00Z', 'day', 'Asia/Seoul')).toBe('2026-01-02');
  expect(trendBucketLabel('2026-01-01T15:30:00Z', 'hour', 'Asia/Seoul')).toBe('2026-01-02 00:30');
  expect(trendBucketLabel('2026-01-01T18:15:00Z', 'day', 'Asia/Kathmandu')).toBe('2026-01-02');
  expect(trendBucketLabel('2026-01-01T15:00:00Z', 'day')).toBe('2026-01-01');
  expect(trendBucketLabel('2026-01-01T15:30:00Z', 'hour', 'UTC')).toBe('2026-01-01 15:30');
  expect(trendBucketLabel('2026-01-01T15:00:00Z', 'day', 'Invalid/Zone')).toBe('2026-01-01');
  expect(trendTimeZone('Asia/Seoul')).toBe('Asia/Seoul');
  expect(trendTimeZone(undefined)).toBe('UTC');
  expect(trendTimeZone('UTC')).toBe('UTC');
});

it('keeps the comparison overlay UTC-only and never overlaps regional buckets', () => {
  // Regional bucket instants are local midnight, not UTC midnight, so the shared-scale overlay refuses them.
  expect(
    comparisonTrend(
      { ...series([{ time: '2026-01-01T15:00:00Z', value: 10 }]), timeZone: 'Asia/Seoul' },
      { ...series([{ time: '2025-12-31T15:00:00Z', value: 5 }]), timeZone: 'Asia/Seoul' },
      periods,
    ),
  ).toBeUndefined();
  // Periods that carry a regional zone are refused outright.
  expect(
    comparisonTrend(series([{ time: '2026-01-01', value: 1 }]), series([{ time: '2025-12-31', value: 1 }]), {
      current: { ...periods.current, timeZone: 'Asia/Seoul' },
      previous: { ...periods.previous, timeZone: 'Asia/Seoul' },
    }),
  ).toBeUndefined();
});

it('suppresses the overlay for a regional trend even when the periods are UTC', () => {
  const current = series([{ time: '2026-01-01T00:00:00Z', value: 10 }]);
  const previous = series([{ time: '2025-12-31T00:00:00Z', value: 5 }]);
  render(
    <MetricTrend
      title="매출"
      trend={{ ...current, timeZone: 'Africa/Abidjan' }}
      previousTrend={previous}
      periods={periods}
    />,
  );
  expect(screen.getByText(/겹쳐 보기는/)).toBeTruthy();
  expect(screen.queryByText(/실선/)).toBeNull();
});
