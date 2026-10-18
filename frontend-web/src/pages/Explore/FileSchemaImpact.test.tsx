import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import FileSchemaImpact from './FileSchemaImpact';
const api = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/helpers/apiHelper', () => ({ get: api.get }));
const requestId = '11111111-1111-4111-8111-111111111111';
const item = {
  id: 'cost',
  title: '비용률',
  columns: ['expense_amount', 'sales_amount'],
  affectedColumns: ['expense_amount'],
  status: 'affected',
};
const result = {
  sourceId: 9,
  requestId,
  metrics: [{ ...item, id: 19 }],
  dashboards: [{ id: 11, title: '내 비용률 보고서', blocks: [item] }],
  truncated: false,
  unreadable: 0,
};
const wrap = (data: unknown) => ({ data: { status: 'SUCCESS', data } });
const renderPanel = (sourceId = 9) =>
  render(
    <MemoryRouter>
      <FileSchemaImpact sourceId={sourceId} requestId={requestId} />
    </MemoryRouter>,
  );
beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockResolvedValue(wrap(result));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it('reads only on explicit inspection and links the saved dashboard to existing private copy mapping', async () => {
  renderPanel();
  expect(api.get).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '영향받는 지표·블록 확인' }));
  await screen.findByText('내 비용률 보고서');
  expect(api.get.mock.calls[0][0]).toBe(`/bi/sources/9/file-refreshes/${requestId}/impact`);
  expect(screen.getAllByText(/변경 열의 영향 있음/)).toHaveLength(2);
  expect(screen.getByRole('link', { name: '새 데이터로 복사·열 연결' }).getAttribute('href')).toBe(
    '/dashboard/11/reuse?editor=studio',
  );
  expect(screen.getByRole('link', { name: /내 파일을 새 소스로 연결/ }).getAttribute('target')).toBe('_blank');
  expect(screen.getByText(/타입은 자동 변환하지 않으며/)).not.toBeNull();
});
it('keeps truncated and unsupported definitions as manual review, not unaffected claims', async () => {
  api.get.mockResolvedValue(
    wrap({ ...result, truncated: true, metrics: [{ ...item, status: 'review', columns: [], affectedColumns: [] }] }),
  );
  renderPanel();
  fireEvent.click(screen.getByRole('button', { name: '영향받는 지표·블록 확인' }));
  await screen.findByText(/표시되지 않은 항목을 영향 없음/);
  expect(screen.getByText('직접 확인 필요')).not.toBeNull();
  expect(screen.queryByText('변경 열 참조 없음')).toBeNull();
});
it('rejects mismatched source responses and preserves read-only retry after failure', async () => {
  api.get.mockResolvedValueOnce(wrap({ ...result, sourceId: 10 }));
  renderPanel();
  fireEvent.click(screen.getByRole('button', { name: '영향받는 지표·블록 확인' }));
  await screen.findByRole('alert');
  expect(screen.queryByText('내 비용률 보고서')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '영향받는 지표·블록 확인' }));
  await screen.findByText('내 비용률 보고서');
  expect(api.get).toHaveBeenCalledTimes(2);
});
it('does not apply an old source response after navigation', async () => {
  let resolve: (value: unknown) => void;
  api.get.mockReturnValueOnce(
    new Promise(r => {
      resolve = r;
    }),
  );
  const view = renderPanel();
  fireEvent.click(screen.getByRole('button', { name: '영향받는 지표·블록 확인' }));
  await waitFor(() => expect(api.get).toHaveBeenCalledTimes(1));
  view.rerender(
    <MemoryRouter>
      <FileSchemaImpact sourceId={10} requestId={requestId} />
    </MemoryRouter>,
  );
  await act(async () => resolve(wrap(result)));
  expect(screen.queryByText('내 비용률 보고서')).toBeNull();
  expect(api.get.mock.calls[0][2].signal.aborted).toBe(true);
});
