import React from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import MetricTrend from './MetricTrend';
import type { MetricTrendData } from './trendGeometry';
import { timeRangeLabel } from './timeSelection';

const times = ['2026-01-01T00:00:00Z', '2026-01-02T00:00:00Z', '2026-01-03T00:00:00Z'];
const ranges = times.map((start, index) => ({
  column: 'event_time',
  start,
  end: `2026-01-0${index + 2}T00:00:00Z`,
  precision: 'timestamp' as const,
}));
const trend = (): MetricTrendData => ({
  column: 'event_time',
  grain: 'day',
  points: times.map((time, index) => ({ time, value: [0, null, 7][index] })),
  contribution: { supported: true, groupFingerprint: 'current-groups' },
  timeSelection: { column: 'event_time', grain: 'day', ranges },
});
const label = (time: string) => `이 시점의 집계 원본 행 보기: 매출 · ${time.replace('T', ' ').replace('Z', ' UTC')}`;
const chart = () => screen.getByRole('group', { name: '매출 일별 추세' });
const activeButton = (time: string) =>
  within(screen.getByText(/집계 원본 시점:/).parentElement).getByRole('button', { name: label(time) });
const openTable = () => userEvent.click(screen.getByLabelText('매출 시계열 데이터 표'));
const table = () => screen.getByRole('table');
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it('navigates contributor-only points including NULL and zero; SVG Enter/Space and pointer never drill through', async () => {
  const contribute = vi.fn();
  render(<MetricTrend trend={{ ...trend(), timeSelection: undefined }} title="매출" onContributionSelect={contribute} />);
  const svg = chart();
  svg.focus();
  await userEvent.keyboard('{ArrowRight}');
  expect(screen.getByText(/집계 원본 시점:/).textContent).toContain('2026-01-02 00:00:00 UTC · 값 없음');
  expect(activeButton(times[1])).toBeTruthy();
  await userEvent.keyboard('{Enter} ');
  fireEvent.click(svg, { clientX: 596 });
  expect(contribute).not.toHaveBeenCalled();
  await userEvent.keyboard('{End}{ArrowRight}');
  expect(activeButton(times[2])).toBeTruthy();
  await userEvent.keyboard('{ArrowLeft}{Home}{ArrowLeft}');
  expect(screen.getByText(/집계 원본 시점:/).textContent).toContain('2026-01-01 00:00:00 UTC · 0');
  await userEvent.tab();
  expect(document.activeElement).toBe(activeButton(times[0]));
  await userEvent.keyboard('{Enter} ');
  expect(contribute.mock.calls).toEqual([[times[0]], [times[0]]]);
});

it('offers native per-point table actions for NULL observations without changing date-filter cells', async () => {
  const contribute = vi.fn();
  const filter = vi.fn();
  render(<MetricTrend trend={trend()} title="매출" onContributionSelect={contribute} onTimeSelect={filter} />);
  await openTable();
  expect(
    within(table())
      .getAllByRole('columnheader')
      .map(cell => cell.textContent),
  ).toEqual(['날짜', '값', '집계 원본 행']);
  const button = within(table()).getByRole('button', { name: label(times[1]) });
  const row = button.closest('tr');
  expect(within(row).getByText('값 없음')).toBeTruthy();
  expect(within(row).getByRole('button', { name: `기간 선택: ${timeRangeLabel(ranges[1])}` })).toBeTruthy();
  act(() => button.focus());
  expect(screen.getByText(/집계 원본 시점:/).textContent).toContain('2026-01-02');
  await userEvent.keyboard('{Enter} ');
  expect(contribute.mock.calls).toEqual([[times[1]], [times[1]]]);
  expect(filter).not.toHaveBeenCalled();
  userEvent.click(within(row).getByRole('button', { name: `기간 선택: ${timeRangeLabel(ranges[1])}` }));
  expect(filter).toHaveBeenCalledExactlyOnceWith(ranges[1]);
  expect(contribute).toHaveBeenCalledTimes(2);
});

it('keeps existing SVG pointer and Enter/Space time-filter actions separate from the active contributor button', async () => {
  const contribute = vi.fn();
  const filter = vi.fn();
  render(<MetricTrend trend={trend()} title="매출" onContributionSelect={contribute} onTimeSelect={filter} />);
  const svg = chart();
  vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    width: 600,
    height: 60,
    right: 600,
    bottom: 60,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
  fireEvent.click(svg, { clientX: 596 });
  expect(filter).toHaveBeenLastCalledWith(ranges[2]);
  svg.focus();
  await userEvent.keyboard('{Home}{ArrowRight}{Enter} ');
  expect(filter.mock.calls).toEqual([[ranges[2]], [ranges[1]], [ranges[1]]]);
  expect(contribute).not.toHaveBeenCalled();
  userEvent.click(activeButton(times[1]));
  expect(contribute).toHaveBeenCalledExactlyOnceWith(times[1]);
  expect(filter).toHaveBeenCalledTimes(3);
});

it('guards pending actions with a visible linked reason, keeps native focus and Tab access, and uses the latest callback', async () => {
  const oldCallback = vi.fn(),
    currentCallback = vi.fn();
  const view = render(<MetricTrend trend={trend()} title="매출" onContributionSelect={oldCallback} />);
  const button = activeButton(times[0]) as HTMLButtonElement;
  act(() => button.focus());
  view.rerender(
    <MetricTrend
      trend={trend()}
      title="매출"
      onContributionSelect={currentCallback}
      contributionDisabled
      contributionDisabledReason="현재 조회가 완료된 뒤 확인할 수 있습니다."
    />,
  );
  expect(document.activeElement).toBe(button);
  expect(button.disabled).toBe(false);
  expect(button.getAttribute('aria-disabled')).toBe('true');
  expect(document.getElementById(button.getAttribute('aria-describedby')).textContent).toBe(
    '현재 조회가 완료된 뒤 확인할 수 있습니다.',
  );
  await userEvent.keyboard('{Enter} ');
  fireEvent.click(button);
  await openTable();
  const tableButton = within(table()).getByRole('button', { name: label(times[1]) }) as HTMLButtonElement;
  act(() => tableButton.focus());
  await userEvent.keyboard('{Enter} ');
  expect(tableButton.disabled).toBe(false);
  expect(currentCallback).not.toHaveBeenCalled();
  expect(oldCallback).not.toHaveBeenCalled();
  view.rerender(<MetricTrend trend={trend()} title="매출" onContributionSelect={currentCallback} />);
  expect(document.activeElement).toBe(tableButton);
  await userEvent.keyboard('{Enter}');
  expect(currentCallback).toHaveBeenCalledExactlyOnceWith(times[1]);
  expect(screen.queryByText('현재 조회가 완료된 뒤 확인할 수 있습니다.')).toBeNull();
});

it('navigates and opens a single all-NULL contributor bucket even without a numeric line', async () => {
  const contribute = vi.fn();
  render(
    <MetricTrend
      trend={{ ...trend(), points: [{ time: times[1], value: null }], timeSelection: undefined }}
      title="매출"
      onContributionSelect={contribute}
    />,
  );
  chart().focus();
  await userEvent.keyboard('{End}{ArrowRight}{Home}{ArrowLeft}');
  expect(activeButton(times[1])).toBeTruthy();
  userEvent.click(activeButton(times[1]));
  expect(contribute).toHaveBeenCalledExactlyOnceWith(times[1]);
  await openTable();
  expect(within(table()).getByText('값 없음')).toBeTruthy();
});

it.each([true, false])('keeps time-filter and contributor disabled states independent: time disabled=%s', async disabled => {
  const contribute = vi.fn(),
    filter = vi.fn();
  render(
    <MetricTrend
      trend={trend()}
      title="매출"
      onContributionSelect={contribute}
      onTimeSelect={filter}
      timeSelectionDisabled={disabled}
      contributionDisabled={!disabled}
    />,
  );
  chart().focus();
  await userEvent.keyboard('{End}{Enter}');
  userEvent.click(activeButton(times[2]));
  expect(filter.mock.calls).toEqual(disabled ? [] : [[ranges[2]]]);
  expect(contribute.mock.calls).toEqual(disabled ? [[times[2]]] : []);
});

it.each([undefined, { supported: false, reason: '현재 집계를 확인할 수 없습니다.' }])(
  'hides unproven contributor actions while preserving the date/value table %j',
  metadata => {
    render(<MetricTrend trend={{ ...trend(), contribution: metadata }} title="매출" onContributionSelect={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /집계 원본 행 보기/ })).toBeNull();
    openTable();
    expect(within(table()).getAllByRole('columnheader')).toHaveLength(2);
    if (metadata?.reason) expect(screen.getByText(metadata.reason)).toBeTruthy();
  },
);

it('removes stale actions on metadata or callback removal, and resets active selection to current points', async () => {
  const contribute = vi.fn();
  const view = render(<MetricTrend trend={trend()} title="매출" onContributionSelect={contribute} />);
  chart().focus();
  await userEvent.keyboard('{End}');
  view.rerender(
    <MetricTrend trend={{ ...trend(), points: [trend().points[0]] }} title="매출" onContributionSelect={contribute} />,
  );
  expect(activeButton(times[0])).toBeTruthy();
  userEvent.click(activeButton(times[0]));
  expect(contribute).toHaveBeenCalledExactlyOnceWith(times[0]);
  view.rerender(<MetricTrend trend={trend()} title="매출" />);
  expect(screen.queryByRole('button', { name: /집계 원본 행 보기/ })).toBeNull();
  expect(screen.getByRole('img', { name: '매출 일별 추세' }).hasAttribute('tabindex')).toBe(false);
});

it('keeps compact active current/previous values and full exact-value tables including unsafe strings', () => {
  const raw = '9007199254740993.12345678901234567890123456789';
  render(
    <>
      <MetricTrend
        title="현재 매출"
        numberNotation="compact"
        prefix="$"
        decimalPlaces={2}
        onContributionSelect={vi.fn()}
        trend={{ column: 'day', grain: 'day', contribution: { supported: true }, points: [{ time: times[0], value: raw }] }}
      />
      <MetricTrend
        title="이전 매출"
        numberNotation="compact"
        prefix="$"
        decimalPlaces={2}
        onContributionSelect={vi.fn()}
        trend={{
          column: 'day',
          grain: 'day',
          contribution: { supported: true },
          points: [{ time: times[0], value: '999999' }],
        }}
      />
    </>,
  );
  const current = screen.getByText('$9,007.2T');
  expect(current.getAttribute('title')).toBe('$' + raw);
  expect(current.getAttribute('aria-label')).toBe('$' + raw);
  expect(screen.getByText('$1M').getAttribute('title')).toBe('$999999');
  const currentTable = screen.getByRole('region', { name: '현재 매출 날짜별 값', hidden: true });
  const currentCell = within(currentTable).getByText('$9,007,199,254,740,993.12345678901234567890123456789');
  expect(currentCell.getAttribute('title')).toBe('$' + raw);
  expect(currentCell.getAttribute('aria-label')).toBe('$' + raw);
  const previousTable = screen.getByRole('region', { name: '이전 매출 날짜별 값', hidden: true });
  expect(within(previousTable).getByText('$999,999.00')).toBeTruthy();
  const currentChart = screen.getByRole('group', { name: '현재 매출 일별 추세' });
  expect(currentChart.querySelector('desc').textContent).toContain('$9,007.2T');
  const exactId = currentChart.getAttribute('aria-describedby').split(' ')[1];
  expect(document.getElementById(exactId).textContent).toContain('$' + raw);
});
