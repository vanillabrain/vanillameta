import React from 'react';
import { expect, it, vi, afterEach } from 'vitest';
import { render, cleanup, waitFor, fireEvent, screen } from '@testing-library/react';
import DashboardPivots, { mergePivotFilters } from './DashboardPivots';
const api = vi.hoisted(() => ({ get: vi.fn(), del: vi.fn(), pivot: vi.fn(), segment: vi.fn() }));
vi.mock('@/helpers/apiHelper', () => api);
vi.mock('@/pages/Explore/PivotTable', () => ({
  default: (props: any) => {
    api.pivot(props);
    return <div>Pivot data</div>;
  },
}));
vi.mock('./DashboardSegmentPivot', () => ({
  default: (props: any) => {
    api.segment(props);
    return <div>Segment Pivot</div>;
  },
}));
afterEach(cleanup);
it('common filters override only same column and preserve saved range/default', () => {
  expect(
    mergePivotFilters(
      [
        { column: 'bid_floor', range: { min: 1, max: 10 } },
        { column: 'device', values: ['Phone'] },
      ],
      [{ column: 'device', values: ['Tablet'] }],
    ),
  ).toEqual([
    { column: 'bid_floor', range: { min: 1, max: 10 } },
    { column: 'device', values: ['Tablet'] },
  ]);
});
it('mounted dashboard forwards common date/filter to saved Pivot and updates on changes', async () => {
  const item = {
    id: 'p1',
    name: 'Saved',
    sourceId: 3,
    sourceRevision: 'rev',
    dimensions: [{ column: 'device' }],
    state: {
      measureIds: [1],
      pivot: { rowDimensions: ['device'], columnDimensions: [] },
      filters: [{ column: 'bid_floor', range: { min: 1, max: 10 } }],
      dateRange: { column: 'day', start: '2023-09-10', end: '2023-09-11' },
    },
  };
  api.get.mockResolvedValue({ data: { status: 'SUCCESS', data: [item] } });
  const onFilter = vi.fn();
  const { rerender } = render(<DashboardPivots dashboardId={2} filters={[]} paused={false} onFilter={onFilter} />);
  await waitFor(() => expect(api.pivot).toHaveBeenCalled());
  expect(api.pivot.mock.lastCall[0].dateRange).toEqual(item.state.dateRange);
  const dateRange = { column: 'day', start: '2023-09-10', end: '2023-09-10' };
  rerender(
    <DashboardPivots
      dashboardId={2}
      filters={[{ column: 'device', values: ['Tablet'] }]}
      dateRange={dateRange}
      paused={false}
      onFilter={onFilter}
    />,
  );
  expect(api.pivot.mock.lastCall[0].dateRange).toEqual(dateRange);
  expect(api.pivot.mock.lastCall[0].filters).toHaveLength(2);
  api.pivot.mock.lastCall[0].onFilter([
    { column: 'bid_floor', range: { min: 1, max: 10 } },
    { column: 'device', values: ['Phone'] },
  ]);
  expect(onFilter).toHaveBeenCalledWith([{ column: 'device', values: ['Phone'] }]);
});

it('keeps stale Pivot removable while valid sibling stays visible', async () => {
  api.pivot.mockClear();
  const valid = {
    id: 'valid',
    name: 'Valid',
    sourceId: 3,
    sourceRevision: 'rev',
    dimensions: [],
    state: { measureIds: [1], pivot: { rowDimensions: ['device'], columnDimensions: [] }, filters: [] },
  };
  api.get.mockResolvedValueOnce({
    data: { status: 'SUCCESS', data: [{ id: 'stale', name: 'Stale', error: 'Pivot 정의가 변경되었습니다.' }, valid] },
  });
  api.get.mockResolvedValue({ data: { status: 'SUCCESS', data: [valid] } });
  api.del.mockResolvedValue({ data: { status: 'SUCCESS' } });
  const ui = render(<DashboardPivots dashboardId={2} filters={[]} paused={false} onFilter={vi.fn()} />);
  await waitFor(() => expect(ui.getByRole('alert').textContent).toContain('Pivot 정의가 변경되었습니다.'));
  expect(api.pivot.mock.lastCall[0].sourceRevision).toBe('rev');
  // Real shadcn Button: the accessible name is the production aria-label, so the stale card is addressed exactly.
  const removeStale = ui.getByRole('button', { name: 'Stale 대시보드에서 제거' });
  expect(ui.getByRole('button', { name: 'Valid 대시보드에서 제거' })).toBeTruthy();
  fireEvent.click(removeStale);
  await waitFor(() => expect(api.del).toHaveBeenCalledWith('/bi/dashboard/2/pivots/stale'));
  await waitFor(() => expect(ui.queryByText('Stale')).toBeNull());
  expect(ui.getByText('Valid')).toBeTruthy();
});

it('routes aggregate saved Pivots through qualification with merged common raw scope', async () => {
  const item = {
    id: 'segment1',
    name: 'Qualified',
    sourceId: 3,
    sourceRevision: 'rev',
    dimensions: [],
    state: {
      mode: 'segment',
      measureIds: [1],
      segment: {
        dimensionColumn: 'company',
        pivotColumn: 'component',
        conditions: [{ measureId: 1, operator: 'gte', value: 1000 }],
      },
      filters: [
        { column: 'component', values: ['Storage'] },
        { column: 'region', values: ['KR'] },
      ],
      dateRange: { column: 'day', start: '2025-01-01', end: '2025-01-03' },
    },
  };
  api.get.mockResolvedValue({ data: { status: 'SUCCESS', data: [item] } });
  const props = {
    dashboardId: 2,
    filters: [{ column: 'component', values: ['Compute'] }],
    paused: false,
    onFilter: vi.fn(),
  };
  const ui = render(<DashboardPivots {...props} />);
  await waitFor(() => expect(ui.getByText('Segment Pivot')).toBeTruthy());
  expect(api.segment.mock.lastCall[0].filters).toEqual([{ column: 'region', values: ['KR'] }, ...props.filters]);
  expect(api.segment.mock.lastCall[0].dateRange).toEqual(item.state.dateRange);
  const dateRange = { column: 'day', start: '2025-01-02', end: '2025-01-02' };
  ui.rerender(<DashboardPivots {...props} dateRange={dateRange} />);
  expect(api.segment.mock.lastCall[0].dateRange).toEqual(dateRange);
  ui.rerender(<DashboardPivots {...props} paused />);
  expect(api.segment.mock.lastCall[0].paused).toBe(true);
});

it('UC052 preserves conditioned Pivot through the dashboard without comparing metadata and file hashes', async () => {
  api.pivot.mockClear();
  const conditions = {
    sourceRevision: 'b'.repeat(64),
    definition: { include: { kind: 'predicate' as const, column: 'amount', operator: 'gt', values: [10] }, exclude: null },
  };
  const item = {
    id: 'scope',
    name: 'Scoped',
    sourceId: 3,
    sourceRevision: 'different-metadata-hash',
    dimensions: [{ column: 'device' }],
    state: { measureIds: [1], pivot: { rowDimensions: ['device'], columnDimensions: [] }, filters: [] },
  };
  api.get.mockResolvedValue({ data: { status: 'SUCCESS', data: [item] } });
  const view = render(
    <DashboardPivots dashboardId={2} filters={[]} conditions={conditions} paused={false} onFilter={vi.fn()} />,
  );
  await waitFor(() => expect(api.pivot).toHaveBeenCalled());
  expect(api.pivot.mock.lastCall[0].conditions).toEqual(conditions);
  expect(api.pivot.mock.lastCall[0].sourceRevision).toBe('different-metadata-hash');
  expect(api.pivot.mock.lastCall[0].paused).toBe(false);
  const next = { ...conditions, sourceRevision: 'c'.repeat(64) };
  view.rerender(<DashboardPivots dashboardId={2} filters={[]} conditions={next} paused={false} onFilter={vi.fn()} />);
  expect(api.pivot.mock.lastCall[0].conditions).toEqual(next);
});

it('does not dispatch a segment Pivot under unsupported business conditions', async () => {
  api.segment.mockClear();
  api.get.mockResolvedValue({
    data: {
      status: 'SUCCESS',
      data: [
        {
          id: 'conditioned-segment',
          name: 'Conditioned segment',
          sourceId: 3,
          sourceRevision: 'rev',
          dimensions: [],
          measures: [],
          state: {
            mode: 'segment',
            measureIds: [1],
            filters: [],
            segment: {
              dimensionColumn: 'company',
              pivotColumn: 'component',
              conditions: [{ measureId: 1, operator: 'gte', value: 1000 }],
            },
          },
        },
      ],
    },
  });
  const conditions = { sourceRevision: 'a'.repeat(64), definition: { include: null, exclude: null } };
  render(<DashboardPivots dashboardId={2} filters={[]} conditions={conditions} paused={false} onFilter={vi.fn()} />);
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('조건 없는 결과로 대체하지 않습니다'));
  expect(api.segment).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: /조건 다시 탐색/ })).toBeNull();
});
