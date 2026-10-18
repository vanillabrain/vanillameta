import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import DashboardSegmentPivot from './DashboardSegmentPivot';
const api = vi.hoisted(() => ({ post: vi.fn(), fence: vi.fn(), exportProps: null as any }));
vi.mock('@/helpers/apiHelper', () => ({ post: api.post }));
vi.mock('@/helpers/authResponseFence', () => ({ captureAuthResponseFence: () => api.fence }));
vi.mock('@/pages/Explore/ExploreExport', () => ({
  default: (props: any) => {
    api.exportProps = props;
    return <button disabled={props.disabled}>CSV 연결 확인</button>;
  },
}));
const item: any = {
  sourceId: 4,
  sourceRevision: 'raw-v1',
  revision: 'saved-def-v1',
  state: {
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
    trendGrain: 'day',
  },
};
function result(value = '5431.25') {
  return {
    data: {
      status: 'SUCCESS',
      data: {
        sourceRevision: 'raw-v1',
        viewRevision: 'digest',
        scope: { dimensionColumn: 'company', totalGroups: 2, rows: 8 },
        kpis: [{ id: 1, label: '매출', unit: 'USD', decimalPlaces: 2, value }],
        groups: [],
        pivot: { column: 'component', columns: [], rows: [], columnLimit: 20, truncatedColumns: false },
      },
    },
  };
}
beforeEach(() => {
  vi.useFakeTimers();
  api.post.mockReset();
  api.fence.mockReset();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
const tick = async () => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(260);
  });
};
it('debounces raw filter/date changes, shares sibling reads and hides stale totals', async () => {
  api.post.mockResolvedValue(result());
  const pool = new Map();
  const ui = render(<DashboardSegmentPivot item={item} filters={[]} paused={false} requestPool={pool} />);
  await tick();
  expect(ui.getByText('5,431.25 USD')).toBeTruthy();
  api.post.mockClear();
  let resolve: (v: any) => void = vi.fn();
  api.post.mockImplementation(
    () =>
      new Promise(r => {
        resolve = r;
      }),
  );
  const dateRange = { column: 'day', start: '2025-01-06', end: '2025-01-15', timeZone: 'UTC' };
  ui.rerender(
    <DashboardSegmentPivot
      item={item}
      filters={[{ column: 'component', values: ['Storage'] }]}
      paused={false}
      requestPool={pool}
    />,
  );
  expect(ui.queryByText('5,431.25 USD')).toBeNull();
  const props = {
    item,
    filters: [{ column: 'component', values: ['Compute'] }],
    dateRange,
    paused: false,
    requestPool: pool,
  };
  ui.rerender(
    <>
      <DashboardSegmentPivot {...props} />
      <DashboardSegmentPivot {...props} />
    </>,
  );
  await tick();
  expect(api.post).toHaveBeenCalledTimes(1);
  expect(api.post.mock.lastCall[0]).toBe('/bi/explore/segments');
  expect(api.post.mock.lastCall[1]).toMatchObject({
    ...item.state.segment,
    filters: props.filters,
    dateRange,
    measureIds: [1, 4],
    catalogRevision: 'saved-def-v1',
  });
  await act(async () => {
    resolve(result('3460'));
  });
  expect(ui.getAllByText('3,460.00 USD')).toHaveLength(2);
});
it('ignores late responses, pauses without querying and explicitly retries failures', async () => {
  const pending: Array<(r: any) => void> = [];
  api.post.mockImplementation(() => new Promise(resolve => pending.push(resolve)));
  const pool = new Map();
  const ui = render(<DashboardSegmentPivot item={item} filters={[]} paused={false} requestPool={pool} />);
  await tick();
  ui.rerender(
    <DashboardSegmentPivot
      item={item}
      filters={[]}
      dateRange={{ column: 'day', start: '2025-01-06', end: '2025-01-15' }}
      paused={false}
      requestPool={pool}
    />,
  );
  await tick();
  await act(async () => {
    pending[0](result('5431.25'));
    pending[1](result('3460'));
  });
  expect(ui.queryByText('5,431.25 USD')).toBeNull();
  expect(ui.getByText('3,460.00 USD')).toBeTruthy();
  ui.rerender(<DashboardSegmentPivot item={item} filters={[]} paused requestPool={pool} />);
  await tick();
  expect(api.post).toHaveBeenCalledTimes(2);
  expect(ui.queryByText('3,460.00 USD')).toBeNull();
  api.post.mockRejectedValueOnce({ response: { status: 503 } }).mockResolvedValue(result());
  ui.rerender(<DashboardSegmentPivot item={item} filters={[]} paused={false} requestPool={pool} />);
  await tick();
  expect(ui.getByRole('alert').textContent).toContain('불러오지 못했습니다');
  fireEvent.click(ui.getByRole('button', { name: '집계 Pivot 다시 조회' }));
  await tick();
  expect(ui.getByText('5,431.25 USD')).toBeTruthy();
});
it('does not render late data across an auth change', async () => {
  api.post.mockResolvedValue(result());
  api.fence
    .mockImplementationOnce(() => undefined)
    .mockImplementation(() => {
      throw new Error('changed auth');
    });
  const ui = render(<DashboardSegmentPivot item={item} filters={[]} paused={false} requestPool={new Map()} />);
  await tick();
  expect(ui.queryByText('5,431.25 USD')).toBeNull();
  expect(ui.getByRole('alert')).toBeTruthy();
});

it('exports only the current qualified result with persisted definitions and exact scope digest', async () => {
  api.post.mockResolvedValue(result());
  const pool = new Map();
  const ui = render(<DashboardSegmentPivot item={item} filters={[]} paused={false} requestPool={pool} />);
  expect(ui.queryByText('CSV 연결 확인')).toBeNull();
  await tick();
  expect(ui.getByText('CSV 연결 확인')).toBeTruthy();
  expect(api.exportProps.payload).toEqual({
    mode: 'segment',
    query: {
      sourceId: 4,
      sourceRevision: 'raw-v1',
      catalogRevision: 'saved-def-v1',
      ...item.state.segment,
      measureIds: [1, 4],
      filters: [],
      trendGrain: 'day',
      viewRevision: 'digest',
    },
  });
  const filters = [{ column: 'component', values: ['Compute'] }];
  const dateRange = { column: 'day', start: '2025-01-06', end: '2025-01-15', timeZone: 'UTC' };
  ui.rerender(
    <DashboardSegmentPivot item={item} filters={filters} dateRange={dateRange} paused={false} requestPool={pool} />,
  );
  expect(ui.queryByText('CSV 연결 확인')).toBeNull();
  await tick();
  expect(api.exportProps.payload.query).toMatchObject({
    filters,
    dateRange,
    catalogRevision: 'saved-def-v1',
    viewRevision: 'digest',
  });
  ui.rerender(<DashboardSegmentPivot item={item} filters={filters} dateRange={dateRange} paused requestPool={pool} />);
  expect(ui.queryByText('CSV 연결 확인')).toBeNull();
});
