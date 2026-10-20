import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ReportExplore from './ReportExplore';
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), navigate: vi.fn() }));
vi.mock('@/helpers/apiHelper', () => ({ get: api.get, post: api.post }));
vi.mock('react-router-dom', () => ({ useNavigate: () => api.navigate }));
const state = {
  version: 1,
  mode: 'explore',
  measureIds: [3],
  dimensionColumns: ['company'],
  rankingMeasureId: 3,
  leaderboardSort: { by: 'value', direction: 'desc' },
  filters: [{ column: 'company', values: [null, 'null'] }],
  dateRange: null,
  relativePeriod: null,
  trendGrain: 'day',
  comparePrevious: false,
  includeRows: false,
};
const guards = [{ id: 3, definitionVersion: '1', digest: 'a'.repeat(64) }];
const search =
  'sourceId=4&studioDashboard=9&studioBlock=b1&studioRevision=' + 'b'.repeat(64) + '&sourceRevision=' + 'c'.repeat(64);
beforeEach(() => {
  vi.resetAllMocks();
  api.get.mockResolvedValue({
    data: {
      sourceId: 4,
      dashboardId: 9,
      sourceRevision: 'c'.repeat(64),
      dashboardTitle: 'Report',
      blockTitle: 'Profit',
      measureGuards: guards,
      state,
    },
  });
  api.post.mockResolvedValue({
    data: {
      status: 'SUCCESS',
      data: {
        sourceRevision: 'c'.repeat(64),
        kpis: [{ id: 3, title: 'Profit', value: 2657.55, decimalPlaces: 2, suffix: ' USD' }],
        leaderboards: [{ column: 'company', rows: [{ category: 'A', value: 2657.55 }] }],
      },
    },
  });
});
afterEach(cleanup);
it('queries only the server-proven scope/metric guards and continues with those exact initial conditions', async () => {
  render(<ReportExplore search={search} />);
  await screen.findByText('2,657.55 USD', { selector: 'strong' });
  expect(api.post).toHaveBeenCalledTimes(1);
  expect(api.post.mock.calls[0][1]).toMatchObject({
    sourceId: 4,
    measureIds: [3],
    filters: state.filters,
    measureGuards: guards,
  });
  fireEvent.click(screen.getByRole('button', { name: '이 조건에서 계속 분석' }));
  expect(api.navigate).toHaveBeenCalledWith('/explore/source?sourceId=4', {
    state: { initialExplore: { sourceId: 4, state } },
  });
});
it.each([403, 409])('shows no substituted/default data after handoff %s', async status => {
  api.get.mockRejectedValueOnce({ response: { status } });
  render(<ReportExplore search={search} />);
  expect((await screen.findByRole('alert')).textContent).toContain(status === 409 ? '변경' : '권한');
  expect(api.post).not.toHaveBeenCalled();
  expect(screen.queryByText('2,657.55 USD')).toBeNull();
});
it('removes the previous successful result when a retry finds a changed metric', async () => {
  render(<ReportExplore search={search} />);
  await screen.findByText('2,657.55 USD', { selector: 'strong' });
  api.post.mockRejectedValueOnce({ response: { status: 409 } });
  fireEvent.click(screen.getByRole('button', { name: '다시 확인' }));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('변경'));
  expect(screen.queryByText('2,657.55 USD')).toBeNull();
});
