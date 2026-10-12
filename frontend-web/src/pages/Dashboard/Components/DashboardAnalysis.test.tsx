import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import DashboardAnalysis from './DashboardAnalysis';
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('@/helpers/apiHelper', () => api);
vi.mock('./AiDashboardPanel', () => ({ default: () => null }));
vi.mock('@/widget/wrapper/WidgetViewer', () => ({ default: ({ dataSet }: any) => <span>{dataSet[0].requests}</span> }));
vi.mock('@mui/material', () => {
  const container = ({ children }: any) => <div>{children}</div>;
  return {
    Box: container,
    Card: container,
    Stack: container,
    Typography: container,
    FormControl: container,
    InputLabel: container,
    Button: ({ children, onClick, disabled }: any) => (
      <button disabled={disabled} onClick={onClick}>
        {children}
      </button>
    ),
    Alert: ({ children }: any) => <div role="alert">{children}</div>,
    LinearProgress: () => <div>Loading</div>,
    Select: ({ children, value, onChange, disabled }: any) => (
      <select aria-label="device_type" value={value} onChange={onChange} disabled={disabled}>
        {children}
      </select>
    ),
    MenuItem: ({ children, value }: any) => <option value={value}>{children}</option>,
  };
});
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
const response = (data: any) => ({ data: { status: 'SUCCESS', data } });
const preview = (requests: number) => ({
  widgets: [{ type: 'BOARD_NUMERIC', title: 'Requests', valueField: 'requests', datas: [{ requests }] }],
  dimensions: [{ column: 'device_type', values: ['Mobile/Tablet'] }],
});
it('queries every widget with the same selected source filter and recovers after a failure', async () => {
  api.get.mockResolvedValue(response({ databaseId: 3, widgets: [] }));
  api.post
    .mockResolvedValueOnce(response(preview(634513000)))
    .mockRejectedValueOnce(new Error('worker unavailable'))
    .mockResolvedValueOnce(response(preview(634513000)));
  render(
    <DashboardAnalysis dashboardId={3} onSaved={vi.fn()}>
      Fallback
    </DashboardAnalysis>,
  );
  await screen.findByText('634513000');
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Mobile/Tablet' } });
  await screen.findByRole('alert');
  expect(api.post.mock.calls[1][1].filters).toEqual([{ column: 'device_type', value: 'Mobile/Tablet' }]);
  expect(screen.getByRole('alert').textContent).toContain('worker unavailable');
  fireEvent.click(screen.getByText('전체 데이터로 복구'));
  await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  expect(api.post.mock.calls[2][1].filters).toEqual([]);
});
