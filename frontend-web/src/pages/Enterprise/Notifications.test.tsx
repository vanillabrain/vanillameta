import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Notifications from './Notifications';
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), del: vi.fn() }));
vi.mock('@/helpers/apiHelper', () => api);
const item = (id = 4) => ({
  id,
  resourceKind: 'dashboard',
  resourceId: 7,
  version: 2,
  createdAt: '2026-10-18T12:34:56Z',
  read: false,
});
const page = (entries = [item()], nextBeforeId: number | null = null) => ({ data: { entries, nextBeforeId } });
const open = () => fireEvent.click(screen.getByRole('button', { name: '내 알림 열기' }));
beforeEach(() => vi.resetAllMocks());
afterEach(cleanup);
it('does not read when collapsed, marks and removes explicitly, then reads persisted state after remount', async () => {
  api.get.mockResolvedValueOnce(page()).mockResolvedValueOnce(page([]));
  const view = render(<Notifications organizationId={1} />);
  expect(api.get).not.toHaveBeenCalled();
  open();
  await screen.findByText(/대시보드 #7/);
  expect(api.post).not.toHaveBeenCalled();
  api.post.mockResolvedValueOnce({ data: { id: 4, read: true, removed: false } });
  fireEvent.click(screen.getByRole('button', { name: '알림 4 읽음' }));
  await waitFor(() =>
    expect((screen.getByRole('button', { name: '알림 4 목록 제거' }) as HTMLButtonElement).disabled).toBe(false),
  );
  expect((screen.getByRole('button', { name: '알림 4 읽음' }) as HTMLButtonElement).disabled).toBe(true);
  api.post.mockResolvedValueOnce({ data: { id: 4, read: true, removed: true } });
  fireEvent.click(screen.getByRole('button', { name: '알림 4 목록 제거' }));
  await screen.findByText('표시할 알림이 없습니다.');
  expect(api.post.mock.calls.map(call => call.slice(0, 2))).toEqual([
    ['/enterprise/notifications/4/read', {}],
    ['/enterprise/notifications/4/remove', {}],
  ]);
  view.unmount();
  render(<Notifications organizationId={1} />);
  open();
  await screen.findByText('표시할 알림이 없습니다.');
  expect(api.post).toHaveBeenCalledTimes(2);
});
it('keeps the entry after a lost write response and allows an identical retry', async () => {
  api.get.mockResolvedValue(page());
  api.post.mockRejectedValueOnce(new Error('lost')).mockResolvedValueOnce({ data: { id: 4, read: false, removed: true } });
  render(<Notifications organizationId={1} />);
  open();
  await screen.findByText(/대시보드 #7/);
  fireEvent.click(screen.getByRole('button', { name: '알림 4 목록 제거' }));
  await screen.findByText(/같은 동작/);
  expect(screen.getByText(/대시보드 #7/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '알림 4 목록 제거' }));
  await screen.findByText('표시할 알림이 없습니다.');
  expect(api.post.mock.calls[0]).toEqual(api.post.mock.calls[1]);
});
it('drops a late answer after closing and changing organization', async () => {
  let resolve!: (value: unknown) => void;
  api.get
    .mockReturnValueOnce(
      new Promise(r => {
        resolve = r;
      }),
    )
    .mockResolvedValueOnce(page([]));
  const view = render(<Notifications organizationId={1} />);
  open();
  fireEvent.click(screen.getByRole('button', { name: '내 알림 접기' }));
  view.rerender(<Notifications organizationId={2} />);
  open();
  await screen.findByText('표시할 알림이 없습니다.');
  await act(async () => resolve(page()));
  expect(screen.queryByText(/대시보드 #7/)).toBeNull();
});
it('paginates and hides stale rows when a further read fails, then restarts explicitly', async () => {
  api.get
    .mockResolvedValueOnce(page([item(4)], 4))
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce(page([item(5)]));
  render(<Notifications organizationId={1} />);
  open();
  await screen.findByText(/대시보드 #7/);
  fireEvent.click(screen.getByRole('button', { name: '이전 알림 더 보기' }));
  await screen.findByText(/다시 읽어/);
  expect(screen.queryByText(/대시보드 #7/)).toBeNull();
  expect(api.get).toHaveBeenNthCalledWith(2, '/enterprise/notifications', { beforeId: 4 });
  fireEvent.click(screen.getByRole('button', { name: '알림 다시 읽기' }));
  await screen.findByRole('button', { name: '알림 5 읽음' });
});
it('rejects malformed or out-of-order payloads instead of rendering partial notifications', async () => {
  api.get.mockResolvedValueOnce(page([item(2), item(3)]));
  render(<Notifications organizationId={1} />);
  open();
  await screen.findByText(/다시 읽어/);
  expect(screen.queryByText(/대시보드 #7/)).toBeNull();
});
it('ignores an old mutation response after reopening and reading a fresh inbox', async () => {
  let finish!: (value: unknown) => void;
  api.get.mockResolvedValue(page());
  api.post.mockReturnValueOnce(
    new Promise(resolve => {
      finish = resolve;
    }),
  );
  render(<Notifications organizationId={1} />);
  open();
  await screen.findByText(/대시보드 #7/);
  fireEvent.click(screen.getByRole('button', { name: '알림 4 목록 제거' }));
  fireEvent.click(screen.getByRole('button', { name: '내 알림 접기' }));
  open();
  await screen.findByText(/대시보드 #7/);
  await act(async () => finish({ data: { id: 4, read: false, removed: true } }));
  expect(screen.getByText(/대시보드 #7/)).toBeTruthy();
});
