import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import AggregateSegment from './AggregateSegment';

const api = vi.hoisted(() => ({ post: vi.fn(), assertSession: vi.fn() }));
vi.mock('@/helpers/apiHelper', () => ({ post: api.post }));
vi.mock('@/helpers/authResponseFence', () => ({ captureAuthResponseFence: () => api.assertSession }));
vi.mock('@/pages/Dashboard/Components/MetricTrend', () => ({ default: () => <span>집계 추세</span> }));
const props = {
  sourceId: 4,
  sourceRevision: 'rev4',
  measures: [
    { id: 1, label: '매출' },
    { id: 2, label: '마진' },
  ],
  dimensions: [{ column: 'company' }, { column: 'revenue', numeric: true }],
  filters: [],
  grain: 'day' as const,
  paused: false,
  onReloadCatalog: vi.fn(),
};
const response = (n = 1) => ({
  data: {
    status: 'SUCCESS',
    data: {
      sourceRevision: 'rev4',
      scope: { dimensionColumn: 'company', totalGroups: n, rows: n },
      kpis: [{ id: 1, label: '매출', value: 1200, unit: 'USD', decimalPlaces: 2 }],
      groups: [{ category: 'A', values: [{ id: 1, value: 1200 }] }],
      groupsTruncated: false,
      details: { rows: [{ company: 'A', revenue: 1200 }], totalRows: n, page: 0, pageSize: 20 },
    },
  },
});
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

it('submits aggregate predicates separately from raw row filters and changes do not query automatically', async () => {
  api.post.mockResolvedValue(response());
  render(<AggregateSegment {...props} filters={[{ column: 'company', values: ['A'] }]} />);
  expect(api.post).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('조건 1 기준값'), { target: { value: '1000' } });
  fireEvent.click(screen.getByRole('button', { name: '조건 추가' }));
  fireEvent.change(screen.getByLabelText('조건 2 지표'), { target: { value: '2' } });
  fireEvent.change(screen.getByLabelText('조건 2 기준값'), { target: { value: '20' } });
  expect(api.post).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '집계 조건 적용' }));
  await screen.findByText('조건에 맞는 대상 1개 · 원본 1행 · company 기준');
  expect(api.post).toHaveBeenCalledWith(
    '/bi/explore/segments',
    expect.objectContaining({
      sourceId: 4,
      dimensionColumn: 'company',
      measureIds: [1, 2],
      filters: [{ column: 'company', values: ['A'] }],
      conditions: [
        { measureId: 1, operator: 'gte', value: 1000 },
        { measureId: 2, operator: 'lt', value: 20 },
      ],
    }),
    expect.anything(),
  );
  fireEvent.change(screen.getByLabelText('조건 1 기준값'), { target: { value: '2000' } });
  expect(screen.queryByText('조건에 맞는 대상 1개 · 원본 1행 · company 기준')).toBeNull();
  expect(api.post).toHaveBeenCalledTimes(1);
});

it('invalidates in-flight results when source filters change and ignores a late success', async () => {
  let finish: (value: unknown) => void = () => undefined;
  api.post.mockImplementation(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  const view = render(<AggregateSegment {...props} />);
  fireEvent.change(screen.getByLabelText('조건 1 기준값'), { target: { value: '1000' } });
  fireEvent.click(screen.getByRole('button', { name: '집계 조건 적용' }));
  const signal = api.post.mock.calls[0][2].signal as AbortSignal;
  view.rerender(<AggregateSegment {...props} filters={[{ column: 'company', values: ['B'] }]} />);
  expect(signal.aborted).toBe(true);
  await act(async () => {
    finish(response());
  });
  expect(screen.queryByText('선택 대상에 기여한 원본 행')).toBeNull();
  expect(api.post).toHaveBeenCalledTimes(1);
});

it('keeps thresholds after server failure and blocks an unselected condition measure', async () => {
  api.post.mockRejectedValue({ response: { status: 409 } });
  render(<AggregateSegment {...props} />);
  fireEvent.change(screen.getByLabelText('조건 1 기준값'), { target: { value: '1000' } });
  fireEvent.click(screen.getByRole('button', { name: '집계 조건 적용' }));
  await screen.findByText('데이터 또는 지표 정의가 변경되었습니다. 카탈로그를 다시 불러온 뒤 조회해 주세요.');
  expect((screen.getByLabelText('조건 1 기준값') as HTMLInputElement).value).toBe('1000');
  fireEvent.click(screen.getByRole('button', { name: '카탈로그 다시 불러오기' }));
  expect(props.onReloadCatalog).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('checkbox', { name: '매출' }));
  await waitFor(() =>
    expect((screen.getByRole('button', { name: '집계 조건 적용' }) as HTMLButtonElement).disabled).toBe(true),
  );
});

it('restores segment settings without an automatic query and applies its Pivot column explicitly', async () => {
  const restored: any = {
    version: 1,
    mode: 'segment',
    measureIds: [1, 2],
    segment: {
      dimensionColumn: 'company',
      conditions: [{ measureId: 1, operator: 'gte', value: 1000 }],
      pivotColumn: 'region',
    },
  };
  const data = response();
  (data.data.data as any).viewRevision = 'v1';
  (data.data.data as any).pivot = {
    column: 'region',
    columns: [{ value: 'North', totals: [{ id: 1, value: 1200 }] }],
    rows: [{ category: 'A', cells: [{ column: 'North', values: [{ id: 1, value: 1200 }] }] }],
    truncatedColumns: false,
    columnLimit: 20,
  };
  api.post.mockResolvedValue(data);
  const view = render(
    <AggregateSegment
      {...props}
      dimensions={[...props.dimensions, { column: 'region' }]}
      restoration={{ nonce: 1, state: restored }}
    />,
  );
  expect(api.post).not.toHaveBeenCalled();
  expect((screen.getByLabelText('조건 1 기준값') as HTMLInputElement).value).toBe('1000');
  expect((screen.getByLabelText('집계 Pivot 열') as HTMLSelectElement).value).toBe('region');
  fireEvent.click(screen.getByRole('button', { name: '집계 조건 적용' }));
  await screen.findByRole('region', { name: '집계 조건 Pivot 표' });
  expect(api.post.mock.calls[0][1].pivotColumn).toBe('region');
  view.rerender(
    <AggregateSegment
      {...props}
      dimensions={[...props.dimensions, { column: 'region' }]}
      restoration={{
        nonce: 2,
        state: {
          ...restored,
          segment: { ...restored.segment, conditions: [{ measureId: 1, operator: 'gte', value: 2000 }] },
        },
      }}
    />,
  );
  expect(screen.queryByRole('region', { name: '집계 조건 Pivot 표' })).toBeNull();
  expect(api.post).toHaveBeenCalledTimes(1);
});

it('preserves input and rejects a late result after the login identity changes', async () => {
  let finish: (value: any) => void = vi.fn();
  let allowed = true;
  api.assertSession.mockImplementation(() => {
    if (!allowed) throw { response: { status: 403 } };
  });
  api.post.mockImplementation(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  render(<AggregateSegment {...props} />);
  fireEvent.change(screen.getByLabelText('조건 1 기준값'), { target: { value: '1000' } });
  fireEvent.click(screen.getByRole('button', { name: '집계 조건 적용' }));
  allowed = false;
  await act(async () => {
    finish(response());
  });
  expect((await screen.findByRole('alert')).textContent).toContain('권한');
  expect(screen.queryByText('1,200.00 USD')).toBeNull();
  expect((screen.getByLabelText('조건 1 기준값') as HTMLInputElement).value).toBe('1000');
});
