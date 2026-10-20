import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import SegmentPivotDetails from './SegmentPivotDetails';
const api = vi.hoisted(() => ({ post: vi.fn(), fence: vi.fn() }));
vi.mock('@/helpers/apiHelper', () => ({ post: api.post }));
vi.mock('@/helpers/authResponseFence', () => ({ captureAuthResponseFence: () => api.fence }));
const query = {
  sourceId: 4,
  sourceRevision: 'raw4',
  viewRevision: 'view4',
  dimensionColumn: 'company',
  pivotColumn: 'component',
  measureIds: [1],
  conditions: [{ measureId: 1, operator: 'gte', value: 1000 }],
  filters: [],
};
const result: any = {
  sourceRevision: 'raw4',
  viewRevision: 'view4',
  scope: { dimensionColumn: 'company' },
  kpis: [{ id: 1, label: '매출', unit: 'USD', decimalPlaces: 2, value: 5431.25 }],
  groups: [{ category: 'Baro', values: [{ id: 1, value: 1171.25 }] }],
  pivot: {
    column: 'component',
    columns: [{ value: 'Compute', totals: [{ id: 1, value: 4100.5 }] }],
    rows: [{ category: 'Baro', cells: [{ column: 'Compute', values: [{ id: 1, value: 640.5 }] }] }],
    columnLimit: 20,
  },
};
const response = (name = 'row-0', page = 0) => ({
  data: {
    status: 'SUCCESS',
    data: {
      sourceRevision: 'raw4',
      viewRevision: 'view4',
      selection: { row: 'Baro', column: 'Compute' },
      kpis: [{ id: 1, label: '매출', unit: 'USD', decimalPlaces: 2, value: 640.5 }],
      details: { rows: [{ company: 'Baro', component: 'Compute', marker: name }], totalRows: '21', page, pageSize: 20 },
    },
  },
});
const props = { result, query, metricText: (_: any, v: any) => String(v) };
beforeEach(() => vi.resetAllMocks());
afterEach(cleanup);
const open = () =>
  fireEvent.click(screen.getByRole('button', { name: 'company Baro · component Compute · 기여 원본 보기' }));
it('reads only after explicit selection with unchanged qualification/proof and pages the same cell', async () => {
  api.post.mockResolvedValueOnce(response()).mockResolvedValueOnce(response('row-20', 1));
  render(<SegmentPivotDetails {...props} />);
  expect(api.post).not.toHaveBeenCalled();
  open();
  await screen.findByText('row-0');
  expect(api.post.mock.calls[0][0]).toBe('/bi/explore/segments/details');
  expect(api.post.mock.calls[0][1]).toEqual({
    ...query,
    selection: { row: 'Baro', column: 'Compute' },
    page: 0,
    pageSize: 20,
  });
  fireEvent.click(screen.getByRole('button', { name: '다음 기여 원본' }));
  await screen.findByText('row-20');
  expect(api.post.mock.lastCall[1]).toMatchObject({ page: 1, selection: { row: 'Baro', column: 'Compute' } });
  expect(screen.getByRole('button', { name: '이전 기여 원본' }).hasAttribute('disabled')).toBe(false);
  expect(screen.getByRole('button', { name: '다음 기여 원본' }).hasAttribute('disabled')).toBe(true);
});
it('aborts and hides old detail immediately when the base filter changes', async () => {
  let finish: (v: any) => void = vi.fn();
  api.post.mockImplementation(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  const view = render(<SegmentPivotDetails {...props} />);
  open();
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
  const signal = api.post.mock.calls[0][2].signal;
  view.rerender(
    <SegmentPivotDetails {...props} query={{ ...query, filters: [{ column: 'company', values: ['Other'] }] }} />,
  );
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(signal.aborted).toBe(true);
  await act(async () => finish(response('late private row')));
  expect(screen.queryByText('late private row')).toBeNull();
});
it('preserves the base Pivot on a recoverable error, retries explicitly and restores trigger focus on close', async () => {
  api.post.mockRejectedValueOnce({ response: { status: 503 } }).mockResolvedValueOnce(response());
  render(<SegmentPivotDetails {...props} />);
  const trigger = screen.getByRole('button', { name: 'company Baro · component Compute · 기여 원본 보기' });
  open();
  await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button', { name: '기여 원본 다시 조회' }));
  await screen.findByText('row-0');
  fireEvent.click(screen.getByRole('button', { name: '기여 원본 닫기' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(trigger));
  expect(screen.getByText('5431.25')).toBeTruthy();
});
it('rejects late rows after identity changes and stale revision failures do not offer blind retry', async () => {
  let finish: (v: any) => void = vi.fn();
  api.post.mockImplementation(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  render(<SegmentPivotDetails {...props} />);
  open();
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
  api.fence.mockImplementation(() => {
    throw Object.assign(new Error('identity changed'), { response: { status: 403 } });
  });
  await act(async () => finish(response('other account row')));
  expect(screen.queryByText('other account row')).toBeNull();
  expect(screen.getByRole('alert').textContent).toContain('권한');
});
it('blocks blind retry for a stale aggregate proof and keeps the base result visible', async () => {
  api.post.mockRejectedValue({ response: { status: 409 } });
  render(<SegmentPivotDetails {...props} />);
  open();
  await screen.findByRole('alert');
  expect(screen.queryByRole('button', { name: '기여 원본 다시 조회' })).toBeNull();
  expect(screen.queryByRole('region', { name: '선택 Pivot 기여 원본 표' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '기여 원본 닫기' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(screen.getByText('5431.25')).toBeTruthy();
});
