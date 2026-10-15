import React from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import PeriodComparison, { PreviousPeriodData } from './PeriodComparison';
import MetricTrend from './MetricTrend';

// 실제 shadcn/Tailwind 구현은 인라인 style 대신 임의값 클래스로 높이를 제한한다.
const boundedScrollClasses = (element: HTMLElement) => {
  const classes = element.className.split(' ');
  return { maxHeight: classes.find(name => name.startsWith('max-h-')), overflow: classes.includes('overflow-auto') };
};
afterEach(cleanup);

it('renders server percent units once and signed delta with metric formatting', () => {
  render(
    <PeriodComparison
      title="매출"
      comparison={{ previousValue: -20, delta: 30, percentChange: 150 }}
      prefix="₩"
      suffix="원"
      decimalPlaces={2}
    />,
  );
  const region = screen.getByRole('region', { name: '매출 이전 기간 비교' });
  expect(within(region).getByText('₩-20.00원')).toBeTruthy();
  expect(within(region).getByText('+₩30.00원')).toBeTruthy();
  expect(within(region).getByText('+150%')).toBeTruthy();
});

it('reports zero baseline percent as 계산 불가 while retaining the delta', () => {
  render(<PeriodComparison title="매출" comparison={{ previousValue: 0, delta: 50, percentChange: null }} />);
  expect(screen.getByText('계산 불가')).toBeTruthy();
  expect(screen.getByText('+50')).toBeTruthy();
});

it('keeps NULL previous, delta and percent as 값 없음 without a made-up zero', () => {
  render(<PeriodComparison title="매출" comparison={{ previousValue: null, delta: null, percentChange: null }} />);
  expect(screen.getAllByText('값 없음')).toHaveLength(3);
  expect(screen.queryByText('0')).toBeNull();
});

it('retains KPI comparison when trends are empty or capped and displays server warnings', () => {
  render(
    <MetricTrend
      title="매출"
      unavailable="시계열 결과가 240개를 초과했습니다."
      comparison={{ previousValue: 10, delta: 40, percentChange: 400 }}
    />,
  );
  expect(screen.getByRole('region', { name: '매출 이전 기간 비교' })).toBeTruthy();
  expect(screen.getByText('+400%')).toBeTruthy();
  expect(screen.getByText(/240개를 초과했습니다/)).toBeTruthy();
  expect(screen.queryByRole('img')).toBeNull();
});

it('labels weekly KPI trends and exposes bounded actual NULL values accessibly', () => {
  render(
    <MetricTrend
      title="매출"
      trend={{
        grain: 'week',
        column: 'day',
        points: [
          { time: '2026-01-05', value: 20 },
          { time: '2026-01-12', value: null },
        ],
      }}
    />,
  );
  expect(screen.getByRole('img', { name: /매출 주별 추세/ })).toBeTruthy();
  const summary = screen.getByText('시계열 데이터 표');
  expect(summary.tagName).toBe('SUMMARY');
  const region = screen.getByRole('region', { name: '매출 날짜별 값', hidden: true });
  expect(boundedScrollClasses(region)).toEqual({ maxHeight: 'max-h-[160px]', overflow: true });
  expect(region.tabIndex).toBe(0);
  expect(within(region).getByText('값 없음')).toBeTruthy();
});

it('bounds previous data independently from charts and preserves original dates with safe text', () => {
  render(
    <PreviousPeriodData
      title="추세"
      categoryField="day"
      valueField="amount"
      period="2026-01-01 ~ 2026-01-10"
      data={[
        { day: '2026-01-05', amount: null },
        { day: '<img onerror=attack>', amount: 10 },
      ]}
    />,
  );
  const region = screen.getByRole('region', { name: '추세 이전 기간 값', hidden: true });
  expect(boundedScrollClasses(region)).toEqual({ maxHeight: 'max-h-[180px]', overflow: true });
  expect(region.tabIndex).toBe(0);
  expect(within(region).getAllByRole('row', { hidden: true })).toHaveLength(3);
  expect(within(region).getByText('<img onerror=attack>')).toBeTruthy();
  expect(region.querySelector('img')).toBeNull();
  expect(screen.getByText('이전 기간 데이터 표').tagName).toBe('SUMMARY');
});

it('renders empty previous data without filling dates or zeros', () => {
  render(<PreviousPeriodData title="추세" categoryField="day" valueField="amount" data={[]} />);
  expect(screen.getByText('이전 기간 데이터가 없습니다.')).toBeTruthy();
  expect(screen.getAllByRole('row', { hidden: true })).toHaveLength(1);
});

it('distinguishes unsafe comparison precision from NULL and retains a finite previous value', () => {
  render(
    <PeriodComparison
      title="큰 매출"
      comparison={{
        previousValue: 10,
        delta: null,
        percentChange: null,
        unavailable: '안전한 숫자 정밀도를 초과하여 비교할 수 없습니다.',
      }}
    />,
  );
  expect(screen.getByRole('alert').textContent).toBe('안전한 숫자 정밀도를 초과하여 비교할 수 없습니다.');
  expect(screen.getByText('10')).toBeTruthy();
  expect(screen.getAllByText('값 없음')).toHaveLength(2);
});

it('compacts signed comparisons and exposes the exact unsafe decimal without changing percent units', () => {
  const { rerender } = render(
    <PeriodComparison
      title="매출"
      numberNotation="compact"
      prefix="$"
      decimalPlaces={2}
      comparison={{ previousValue: '9007199254740993.125', delta: '-999999', percentChange: '-12.345' }}
    />,
  );
  const previous = screen.getByText('$9,007.2T');
  expect(previous.getAttribute('title')).toBe('$9007199254740993.125');
  expect(previous.getAttribute('aria-label')).toBe('$9007199254740993.125');
  expect(screen.getByText('-$1M')).toBeTruthy();
  expect(screen.getByText('-12.35%')).toBeTruthy();
  rerender(
    <PeriodComparison
      title="매출"
      prefix="$"
      decimalPlaces={2}
      comparison={{ previousValue: '9007199254740993.125', delta: '5', percentChange: '0' }}
    />,
  );
  expect(screen.getByText('$9,007,199,254,740,993.125')).toBeTruthy();
  expect(screen.getByText('+$5.00')).toBeTruthy();
});

it('recognizes decimal-string zero baseline and rejects blank values without fake zeros', () => {
  const { rerender } = render(
    <PeriodComparison title="매출" comparison={{ previousValue: '0.00', delta: '5', percentChange: '100' }} />,
  );
  expect(screen.getByText('계산 불가')).toBeTruthy();
  rerender(<PeriodComparison title="매출" comparison={{ previousValue: '', delta: 'NaN', percentChange: null }} />);
  expect(screen.getAllByText('값 없음')).toHaveLength(3);
  expect(screen.queryByText('계산 불가')).toBeNull();
});

it('formats trend strings with units and compact notation while keeping exact accessible table and SVG descriptions', () => {
  const { rerender } = render(
    <MetricTrend
      title="매출"
      prefix="$"
      suffix=" USD"
      decimalPlaces={2}
      numberNotation="compact"
      trend={{
        column: 'day',
        grain: 'day',
        points: [
          { time: '2026-01-05', value: '9007199254740993.125' },
          { time: '2026-01-06', value: '999999' },
          { time: '2026-01-07', value: null },
        ],
      }}
      comparison={{ previousValue: '1000000', delta: '999999', percentChange: '100' }}
    />,
  );
  const cell = screen.getByText('$9,007,199,254,740,993.125 USD');
  expect(cell.getAttribute('title')).toBe('$9007199254740993.125 USD');
  expect(cell.getAttribute('aria-label')).toBe('$9007199254740993.125 USD');
  expect(screen.getByRole('img').querySelector('desc').textContent).toContain('$9,007.2T USD');
  expect(screen.getByRole('img').querySelectorAll('desc')[1].textContent).toContain('$9007199254740993.125 USD');
  expect(screen.getByText('+$1M USD')).toBeTruthy();
  expect(screen.getByRole('img').querySelector('path').getAttribute('d')).not.toMatch(/NaN|Infinity/);
  rerender(
    <MetricTrend
      title="매출"
      prefix="$"
      suffix=" USD"
      decimalPlaces={2}
      trend={{ column: 'day', grain: 'day', points: [{ time: '2026-01-05', value: '5' }] }}
    />,
  );
  expect(screen.getByText('$5.00 USD')).toBeTruthy();
});
