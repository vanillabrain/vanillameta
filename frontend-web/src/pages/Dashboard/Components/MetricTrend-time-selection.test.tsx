import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import MetricTrend from './MetricTrend';
import type { MetricTrendData } from './trendGeometry';
import { timeRangeLabel } from './timeSelection';

const range = (day: number) => ({
  column: 'event_time',
  start: `2026-01-${String(day).padStart(2, '0')}T00:00:00Z`,
  end: `2026-01-${String(day + 1).padStart(2, '0')}T00:00:00Z`,
  precision: 'timestamp' as const,
});
const ranges = [1, 2, 3, 11].map(range);
const trend = (): MetricTrendData => ({
  column: 'event_time',
  grain: 'day',
  points: ranges.map((bucket, index) => ({ time: bucket.start, value: [0, null, 4, 10][index] })),
  timeSelection: { column: 'event_time', grain: 'day', ranges },
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
const chart = () => screen.getByRole('group', { name: '매출 일별 추세' });
const openTable = () => userEvent.click(screen.getByLabelText('매출 시계열 데이터 표'));
const bucketButton = (index: number) => screen.getByRole('button', { name: `기간 선택: ${timeRangeLabel(ranges[index])}` });
const bounds = (element: Element, left: number, width: number, height: number) =>
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
    left,
    top: 40,
    width,
    height,
    right: left + width,
    bottom: 40 + height,
    x: left,
    y: 40,
    toJSON: () => ({}),
  });

it.each([
  { left: 80, width: 300, height: 30, clicks: [80, 155, 380] },
  { left: 100, width: 900, height: 60, clicks: [100, 400, 625] },
])('maps pointer clicks to the nearest numerical UTC bucket with SVG scaling and letterboxing %j', rect => {
  const select = vi.fn();
  render(<MetricTrend trend={trend()} title="매출" onTimeSelect={select} />);
  const svg = chart();
  bounds(svg, rect.left, rect.width, rect.height);
  rect.clicks.forEach(clientX => fireEvent.click(svg, { clientX, clientY: 55 }));
  expect(select.mock.calls.map(([selected]) => selected)).toEqual([ranges[0], ranges[2], ranges[3]]);
});

it('skips NULL observations for pointer selection while zero remains selectable', () => {
  const select = vi.fn();
  render(<MetricTrend trend={trend()} title="매출" onTimeSelect={select} />);
  const svg = chart();
  bounds(svg, 0, 600, 60);
  // The NULL point is at x=63.2; the nearest numerical point to x=60 is the legitimate zero.
  fireEvent.click(svg, { clientX: 60 });
  expect(select).toHaveBeenCalledWith(ranges[0]);
});

it('navigates aligned UTC buckets via arrows, Home/End and applies only via Enter/Space, including NULL buckets', async () => {
  const select = vi.fn();
  render(<MetricTrend trend={trend()} title="매출" onTimeSelect={select} />);
  const svg = chart();
  expect(svg.getAttribute('tabindex')).toBe('0');
  svg.focus();
  await userEvent.keyboard('{ArrowRight}');
  expect(select).not.toHaveBeenCalled();
  await userEvent.keyboard('{Enter}');
  expect(select).toHaveBeenLastCalledWith(ranges[1]);
  await userEvent.keyboard('{End}{ArrowRight} ');
  expect(select).toHaveBeenLastCalledWith(ranges[3]);
  await userEvent.keyboard('{ArrowLeft}{Enter}');
  expect(select).toHaveBeenLastCalledWith(ranges[2]);
  await userEvent.keyboard('{Home}{ArrowLeft} ');
  expect(select).toHaveBeenLastCalledWith(ranges[0]);
  expect(select).toHaveBeenCalledTimes(4);
  expect(document.activeElement).toBe(svg);
});

it('allows pointer and keyboard activation for a single zero bucket', async () => {
  const select = vi.fn();
  const single = {
    ...trend(),
    points: [trend().points[0]],
    timeSelection: { ...trend().timeSelection, ranges: [ranges[0]] },
  };
  render(<MetricTrend trend={single} title="매출" onTimeSelect={select} />);
  const svg = chart();
  bounds(svg, 100, 300, 30);
  fireEvent.click(svg, { clientX: 100 });
  svg.focus();
  await userEvent.keyboard('{End}{ArrowRight}{Home}{ArrowLeft}{Enter} ');
  expect(select.mock.calls.map(([selected]) => selected)).toEqual([ranges[0], ranges[0], ranges[0]]);
});

it.each(['{Enter}', ' '])('uses native table buttons via %s and marks the exact selected range', async keys => {
  const select = vi.fn();
  render(<MetricTrend trend={trend()} title="매출" onTimeSelect={select} selectedTimeRange={ranges[1]} />);
  await openTable();
  const selected = bucketButton(1);
  expect(selected.tagName).toBe('BUTTON');
  expect(selected.getAttribute('aria-pressed')).toBe('true');
  expect(bucketButton(0).getAttribute('aria-pressed')).toBe('false');
  selected.focus();
  await userEvent.keyboard(keys);
  expect(select).toHaveBeenCalledTimes(1);
  expect(select).toHaveBeenCalledWith(ranges[1]);
});

it('keeps native button and SVG focus during pending, guards keyboard/pointer, and resumes activation', async () => {
  const select = vi.fn();
  const view = render(<MetricTrend trend={trend()} title="매출" onTimeSelect={select} />);
  await openTable();
  const button = bucketButton(0) as HTMLButtonElement;
  button.focus();
  view.rerender(<MetricTrend trend={trend()} title="매출" onTimeSelect={select} timeSelectionDisabled />);
  expect(document.activeElement).toBe(button);
  expect(button.disabled).toBe(false);
  expect(button.getAttribute('aria-disabled')).toBe('true');
  await userEvent.keyboard('{Enter} ');
  fireEvent.click(button);
  const svg = chart();
  bounds(svg, 0, 600, 60);
  svg.focus();
  expect(svg.getAttribute('aria-disabled')).toBe('true');
  await userEvent.keyboard('{End}{ArrowRight}{Enter} ');
  fireEvent.click(svg, { clientX: 596 });
  expect(select).not.toHaveBeenCalled();
  expect(document.activeElement).toBe(svg);
  view.rerender(<MetricTrend trend={trend()} title="매출" onTimeSelect={select} />);
  await userEvent.keyboard('{Enter}');
  expect(select).toHaveBeenCalledWith(ranges[0]);
});

it.each([
  undefined,
  { ...trend().timeSelection, ranges: [ranges[0]] },
  { ...trend().timeSelection, ranges: ranges.map(bucket => ({ ...bucket, column: 'other' })) },
  { ...trend().timeSelection, ranges: ranges.map(bucket => ({ ...bucket, precision: undefined })) },
])('keeps unproven or mismatched time metadata read-only %j', metadata => {
  const select = vi.fn();
  render(<MetricTrend trend={{ ...trend(), timeSelection: metadata }} title="매출" onTimeSelect={select} />);
  const svg = screen.getByRole('img', { name: '매출 일별 추세' });
  expect(svg.hasAttribute('tabindex')).toBe(false);
  fireEvent.click(svg, { clientX: 100 });
  fireEvent.keyDown(svg, { key: 'Enter' });
  openTable();
  expect(screen.queryByRole('button', { name: /기간 선택:/ })).toBeNull();
  expect(select).not.toHaveBeenCalled();
});
