import React from 'react';
import { expect, it, vi, afterEach } from 'vitest';
import { render, cleanup, waitFor, fireEvent } from '@testing-library/react';
import DashboardPivots, { mergePivotFilters } from './DashboardPivots';
const api = vi.hoisted(() => ({ get: vi.fn(), del: vi.fn(), pivot: vi.fn() }));
vi.mock('@/helpers/apiHelper', () => api);
vi.mock('@/pages/Explore/PivotTable', () => ({
  default: (props: any) => {
    api.pivot(props);
    return <div>Pivot data</div>;
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
