import React from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import PeriodComparison, { PreviousPeriodData } from './PeriodComparison';
import MetricTrend from './MetricTrend';

vi.mock('@mui/material', () => {
  const Container = ({ children, component: Tag = 'div', sx, ...props }: any) => (
    <Tag
      role={props.role}
      aria-label={props['aria-label']}
      tabIndex={props.tabIndex}
      style={{ maxHeight: sx?.maxHeight, maxWidth: sx?.maxWidth, overflow: sx?.overflow }}
    >
      {children}
    </Tag>
  );
  return { Box: Container, Typography: Container, Alert: ({ children }: any) => <div role="alert">{children}</div> };
});
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
  expect(region.style.maxHeight).toBe('160px');
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
  expect(region.style.maxHeight).toBe('180px');
  expect(region.style.overflow).toBe('auto');
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
