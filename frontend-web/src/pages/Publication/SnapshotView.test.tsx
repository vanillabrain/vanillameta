import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import SnapshotView from './SnapshotView';
const calls = vi.hoisted(() => ({ widget: vi.fn(), trend: vi.fn() }));
vi.mock('@/widget/wrapper/WidgetViewer', () => ({
  default: (props: any) => {
    calls.widget(props);
    return <div>{props.title} 고정값</div>;
  },
}));
vi.mock('../Dashboard/Components/MetricTrend', () => ({
  default: (props: any) => {
    calls.trend(props);
    return <div>{props.title} 추세</div>;
  },
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
it('renders captured numeric plus trend and category chart with no source identifiers or data fetch', () => {
  const numeric = {
    blockId: 'one',
    type: 'BOARD_NUMERIC',
    title: '요청 수',
    description: '집계',
    valueField: 'value',
    datas: [{ value: '10000000000000000' }],
    decimalPlaces: 0,
    trend: { column: 'ts', grain: 'day', points: [{ time: '2023-09-01', value: 10 }] },
  };
  const chart = {
    blockId: 'two',
    type: 'CHART_BAR',
    title: 'OS별',
    valueField: 'value',
    categoryField: 'os',
    datas: [{ os: 'Linux', value: 5 }],
  };
  render(
    <SnapshotView
      snapshot={{
        schemaVersion: 1,
        title: '고정 분석',
        capturedAt: '2026-10-15T00:00:00.000Z',
        scope: '전체 기간 · 필터 없음 · UTC',
        widgets: [numeric, chart],
        responsiveLayouts: {},
      }}
    />,
  );
  expect(screen.getByText('요청 수 추세')).toBeTruthy();
  expect(screen.getByText('OS별 고정값')).toBeTruthy();
  expect(calls.widget.mock.calls[0][0].dataSet).toEqual(numeric.datas);
  expect(calls.trend.mock.calls[0][0].trend).toEqual(numeric.trend);
  expect(calls.widget.mock.calls[0][0]).not.toHaveProperty('dataSetId');
  expect(calls.trend.mock.calls[0][0].onTimeSelect).toBeUndefined();
});

it('labels a reuse preview as unsaved without publication instructions', () => {
  render(
    <SnapshotView
      context="reuse"
      snapshot={{
        schemaVersion: 1,
        title: '복사본',
        capturedAt: '2026-10-15T00:00:00Z',
        scope: '새 소스',
        widgets: [],
        responsiveLayouts: {},
      }}
    />,
  );
  expect(screen.getByRole('region', { name: '복사본 미리보기' })).toBeTruthy();
  expect(screen.getByText(/저장 전 미리보기/)).toBeTruthy();
  expect(screen.queryByText(/재게시 후 반영/)).toBeNull();
});
