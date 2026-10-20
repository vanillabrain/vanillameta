import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import DashboardSegmentExplore from './DashboardSegmentExplore';
const api = vi.hoisted(() => ({ post: vi.fn(), get: vi.fn() }));
vi.mock('@/helpers/apiHelper', () => api);
vi.mock('@/helpers/authResponseFence', () => ({ captureAuthResponseFence: () => () => undefined }));
vi.mock('@/pages/Dashboard/Components/MetricTrend', () => ({ default: () => null }));
const item: any = {
  id: 'p1',
  name: 'Saved',
  sourceId: 4,
  sourceRevision: 'raw4',
  revision: 'a'.repeat(64),
  measures: [
    { id: 1, label: '매출' },
    { id: 4, label: '마진' },
  ],
  dimensions: [{ column: 'company' }, { column: 'component' }],
  state: {
    version: 1,
    mode: 'segment',
    segment: {
      dimensionColumn: 'company',
      pivotColumn: 'component',
      conditions: [
        { measureId: 1, operator: 'gte', value: 1000 },
        { measureId: 4, operator: 'lt', value: 20 },
      ],
    },
    measureIds: [1, 4],
    dimensionColumns: ['company'],
    rankingMeasureId: 1,
    leaderboardSort: { by: 'value', direction: 'desc' },
    filters: [],
    dateRange: null,
    relativePeriod: null,
    trendGrain: 'week',
    comparePrevious: false,
    includeRows: false,
  },
};
const filters = [{ column: 'component', values: ['Compute'] }];
const range = { column: 'day', start: '2025-01-06', end: '2025-01-15', timeZone: 'UTC' };
beforeEach(() => {
  vi.resetAllMocks();
  api.post.mockRejectedValue({ response: { status: 409 } });
});
afterEach(cleanup);
it('starts only on explicit apply with frozen current scope and saved definition revision', async () => {
  const onReload = vi.fn();
  const ui = render(
    <DashboardSegmentExplore item={item} filters={filters} dateRange={range} paused={false} onReload={onReload} />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Saved 조건 다시 탐색' }));
  await waitFor(() => expect((screen.getByLabelText('조건 1 기준값') as HTMLInputElement).value).toBe('1000'));
  expect(api.post).not.toHaveBeenCalled();
  expect(api.get).not.toHaveBeenCalled();
  ui.rerender(
    <DashboardSegmentExplore
      item={item}
      filters={[{ column: 'component', values: ['Storage'] }]}
      paused={false}
      onReload={onReload}
    />,
  );
  fireEvent.change(screen.getByLabelText('조건 1 기준값'), { target: { value: '600' } });
  fireEvent.click(screen.getByRole('button', { name: '집계 조건 적용' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
  expect(api.post.mock.lastCall[1]).toMatchObject({
    sourceId: 4,
    sourceRevision: 'raw4',
    catalogRevision: item.revision,
    filters,
    dateRange: range,
    trendGrain: 'week',
    pivotColumn: 'component',
    conditions: [
      { measureId: 1, operator: 'gte', value: 600 },
      { measureId: 4, operator: 'lt', value: 20 },
    ],
  });
  await screen.findByRole('alert');
  expect((screen.getByLabelText('조건 1 기준값') as HTMLInputElement).value).toBe('600');
  expect(item.state.segment.conditions[0].value).toBe(1000);
});
it('closing unsaved changes performs no write and a new session restores original conditions', async () => {
  const onReload = vi.fn();
  render(<DashboardSegmentExplore item={item} filters={[]} paused={false} onReload={onReload} />);
  fireEvent.click(screen.getByRole('button', { name: 'Saved 조건 다시 탐색' }));
  await waitFor(() => expect((screen.getByLabelText('조건 1 기준값') as HTMLInputElement).value).toBe('1000'));
  fireEvent.change(screen.getByLabelText('조건 1 기준값'), { target: { value: '600' } });
  fireEvent.click(screen.getByRole('button', { name: '탐색 닫기' }));
  expect(api.post).not.toHaveBeenCalled();
  expect(onReload).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Saved 조건 다시 탐색' }));
  await waitFor(() => expect((screen.getByLabelText('조건 1 기준값') as HTMLInputElement).value).toBe('1000'));
});
it('does not allow incomplete common scope to start exploration', () => {
  render(<DashboardSegmentExplore item={item} filters={[]} paused onReload={vi.fn()} />);
  expect(screen.getByRole('button', { name: 'Saved 조건 다시 탐색' }).hasAttribute('disabled')).toBe(true);
});

const segmentResponse = {
  data: {
    status: 'SUCCESS',
    data: {
      sourceRevision: 'raw4',
      viewRevision: 'b'.repeat(64),
      scope: { dimensionColumn: 'company', totalGroups: 1, rows: 1 },
      kpis: [{ id: 1, label: '매출', value: 1200, unit: 'USD', decimalPlaces: 2 }],
      groups: [],
      details: { rows: [], totalRows: 1, page: 0, pageSize: 20 },
    },
  },
};
async function openAppliedDialog(onReload: () => void) {
  render(<DashboardSegmentExplore item={item} filters={filters} paused={false} onReload={onReload} />);
  fireEvent.click(screen.getByRole('button', { name: 'Saved 조건 다시 탐색' }));
  await waitFor(() => expect((screen.getByLabelText('조건 1 기준값') as HTMLInputElement).value).toBe('1000'));
  fireEvent.click(screen.getByRole('button', { name: '집계 조건 적용' }));
  await screen.findByText('1,200.00 USD');
  fireEvent.click(screen.getByRole('button', { name: '집계 조건 저장 보기' }));
  await waitFor(() => expect(screen.getByRole('button', { name: '현재 보기 저장' }).hasAttribute('disabled')).toBe(true));
}
it('blocks all dismissal and saved-panel unmount while a save response is held', async () => {
  let finish: (v: any) => void = vi.fn();
  let savedBody: any;
  api.get.mockResolvedValue({ data: { status: 'SUCCESS', data: [] } });
  api.post.mockImplementation((url, body) =>
    url === '/bi/explore/segments'
      ? Promise.resolve(segmentResponse)
      : new Promise(resolve => {
          finish = resolve;
          savedBody = body;
        }),
  );
  const onReload = vi.fn();
  await openAppliedDialog(onReload);
  fireEvent.change(screen.getByLabelText('저장 보기 이름'), { target: { value: 'Saved copy' } });
  await waitFor(() => expect(screen.getByRole('button', { name: '현재 보기 저장' }).hasAttribute('disabled')).toBe(false));
  fireEvent.click(screen.getByRole('button', { name: '현재 보기 저장' }));
  expect(screen.getByRole('button', { name: '탐색 닫기' }).hasAttribute('disabled')).toBe(true);
  expect(screen.getByRole('button', { name: '조건 탐색 닫기' }).hasAttribute('disabled')).toBe(true);
  expect(screen.getByRole('button', { name: '집계 조건 저장 보기' }).hasAttribute('disabled')).toBe(true);
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  fireEvent.click(screen.getByRole('button', { name: '탐색 닫기' }));
  expect(screen.getByRole('dialog')).toBeTruthy();
  expect(onReload).not.toHaveBeenCalled();
  finish({
    data: {
      status: 'SUCCESS',
      data: { id: 3, name: 'Saved copy', revision: item.revision, state: savedBody.state, createdAt: '2026-10-18' },
    },
  });
  await screen.findByText('현재 조건을 개인 저장 보기로 저장했습니다.');
  fireEvent.click(screen.getByRole('button', { name: '탐색 닫기' }));
  expect(onReload).toHaveBeenCalledTimes(1);
});
it('keeps the outer session open while nested dashboard add is held', async () => {
  let finish: (v: any) => void = vi.fn();
  const saved = { id: 3, name: 'Existing', revision: item.revision, state: item.state, createdAt: '2026-10-18' };
  api.get.mockImplementation(url =>
    Promise.resolve({
      data: {
        status: 'SUCCESS',
        data:
          url === '/dashboard'
            ? [{ id: 3, title: 'Board', analysisDefinition: JSON.stringify({ databaseId: 4 }) }]
            : [saved],
      },
    }),
  );
  api.post.mockImplementation(url =>
    url === '/bi/explore/segments'
      ? Promise.resolve(segmentResponse)
      : new Promise(resolve => {
          finish = resolve;
        }),
  );
  const onReload = vi.fn();
  await openAppliedDialog(onReload);
  fireEvent.click(await screen.findByRole('button', { name: 'Existing 대시보드에 추가' }));
  await waitFor(() =>
    expect(screen.getByRole('combobox', { name: '추가할 대시보드' }).hasAttribute('disabled')).toBe(false),
  );
  fireEvent.change(screen.getByRole('combobox', { name: '추가할 대시보드' }), { target: { value: '3' } });
  fireEvent.click(screen.getByRole('button', { name: 'Pivot 추가' }));
  expect(screen.getByRole('button', { name: '탐색 닫기', hidden: true }).hasAttribute('disabled')).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: '탐색 닫기', hidden: true }));
  expect(onReload).not.toHaveBeenCalled();
  finish({ data: { status: 'SUCCESS', data: { id: 'new' } } });
  await screen.findByText('대시보드에 Pivot을 추가했습니다.');
  expect(screen.getByRole('button', { name: '탐색 닫기', hidden: true }).hasAttribute('disabled')).toBe(false);
});
