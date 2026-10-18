import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Notifications from './Notifications';
import { fetchNotifications } from '@/api/enterpriseService';
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), del: vi.fn() }));
vi.mock('@/helpers/apiHelper', () => api);
const item = (id = 4) => ({
  id,
  resourceKind: 'dashboard',
  eventType: 'permissions',
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

it('labels group sharing and revocation as historical incidents without implying current permission', async () => {
  api.get.mockResolvedValueOnce({
    data: {
      entries: [
        { ...item(6), viaGroup: true, eventType: 'unshared' },
        { ...item(5), viaGroup: true, eventType: 'shared' },
      ],
      nextBeforeId: null,
    },
  });
  render(<Notifications organizationId={1} />);
  open();
  await screen.findByText(/대시보드 #7 그룹 공유 회수/);
  expect(screen.getByText(/대시보드 #7 그룹 조회 공유/)).toBeTruthy();
  expect(screen.getByText(/현재 접근 권한은 자료를 열 때 다시 확인/)).toBeTruthy();
  expect(api.post).not.toHaveBeenCalled();
  api.post.mockResolvedValueOnce({ data: { id: 6, read: true, removed: false } });
  fireEvent.click(screen.getByRole('button', { name: '알림 6 읽음' }));
  await waitFor(() =>
    expect((screen.getByRole('button', { name: '알림 6 읽음' }) as HTMLButtonElement).disabled).toBe(true),
  );
});
it('rejects malformed group context rather than rendering a source permission as a group share', async () => {
  api.get.mockResolvedValueOnce({ data: { entries: [{ ...item(), viaGroup: true }], nextBeforeId: null } });
  render(<Notifications organizationId={1} />);
  open();
  await screen.findByText(/알림을 확인하지 못했습니다/);
  expect(screen.queryByText(/대시보드 #7/)).toBeNull();
});

it.each(['ready', 'failed', 'cancelled'])('accepts a minimal raw export %s incident', async eventType => {
  const entry = { ...item(), resourceKind: 'export', eventType };
  api.get.mockResolvedValueOnce(page([entry]));
  await expect(fetchNotifications()).resolves.toEqual({ entries: [entry], nextBeforeId: null });
  expect(api.get).toHaveBeenCalledWith('/enterprise/notifications', {});
  expect(api.post).not.toHaveBeenCalled();
});

it.each([
  ...['shared', 'unshared'].map(eventType => ({ resourceKind: 'source', eventType })),
  ...['permissions', 'shared', 'unshared', 'queued', 'running', 'interrupted', 'expired'].map(eventType => ({
    resourceKind: 'export',
    eventType,
  })),
  ...['source', 'dashboard'].flatMap(resourceKind =>
    ['ready', 'failed', 'cancelled'].map(eventType => ({ resourceKind, eventType })),
  ),
  ...['ready', 'failed', 'cancelled'].flatMap(eventType =>
    [true, false].map(viaGroup => ({ resourceKind: 'export', eventType, viaGroup })),
  ),
])('rejects invalid notification kind/event/group combinations: %j', async context => {
  api.get.mockResolvedValueOnce(page([{ ...item(), ...context }]));
  await expect(fetchNotifications()).rejects.toThrow();
});

it('accepts source permissions and dashboard permissions/sharing while rejecting invalid group context', async () => {
  for (const resourceKind of ['source', 'dashboard']) {
    for (const eventType of resourceKind === 'source' ? ['permissions'] : ['permissions', 'shared', 'unshared']) {
      const entry = { ...item(), resourceKind, eventType };
      api.get.mockResolvedValueOnce(page([entry]));
      await expect(fetchNotifications()).resolves.toMatchObject({ entries: [entry] });
    }
  }
  for (const eventType of ['shared', 'unshared']) {
    const entry = { ...item(), eventType, viaGroup: true };
    api.get.mockResolvedValueOnce(page([entry]));
    await expect(fetchNotifications()).resolves.toMatchObject({ entries: [entry] });
  }
  for (const context of [
    { resourceKind: 'source', eventType: 'permissions', viaGroup: true },
    { resourceKind: 'source', eventType: 'shared', viaGroup: true },
    { resourceKind: 'dashboard', eventType: 'permissions', viaGroup: true },
    { resourceKind: 'dashboard', eventType: 'shared', viaGroup: false },
  ]) {
    api.get.mockResolvedValueOnce(page([{ ...item(), ...context }]));
    await expect(fetchNotifications()).rejects.toThrow();
  }
});

it('shows export results and historical versions, and only changes explicit inbox state', async () => {
  const ready = { ...item(9), resourceKind: 'export', eventType: 'ready', resourceId: 31, version: 8 };
  const failed = { ...item(8), resourceKind: 'export', eventType: 'failed', resourceId: 32, version: 5 };
  const cancelled = { ...item(7), resourceKind: 'export', eventType: 'cancelled', resourceId: 33, version: 11 };
  api.get.mockResolvedValueOnce(page([ready, failed, cancelled]));
  const view = render(<Notifications organizationId={1} />);
  expect(api.get).not.toHaveBeenCalled();
  open();
  await screen.findByText(/파일 작업 #31 완료 · 버전 8/);
  expect(screen.getByText(/파일 작업 #32 실패 · 버전 5/)).toBeTruthy();
  expect(screen.getByText(/파일 작업 #33 취소 · 버전 11/)).toBeTruthy();
  expect(screen.getByText(/알림은 과거 사건이며 현재 작업 상태·파일 유효성·접근 권한을 증명하지 않습니다/)).toBeTruthy();
  expect(screen.queryByRole('link')).toBeNull();
  expect(api.post).not.toHaveBeenCalled();
  api.post.mockResolvedValueOnce({ data: { id: 9, read: true, removed: false } });
  fireEvent.click(screen.getByRole('button', { name: '알림 9 읽음' }));
  await waitFor(() =>
    expect((screen.getByRole('button', { name: '알림 9 목록 제거' }) as HTMLButtonElement).disabled).toBe(false),
  );
  expect((screen.getByRole('button', { name: '알림 9 읽음' }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByText(/파일 작업 #31 완료 · 버전 8/)).toBeTruthy();
  api.post.mockRejectedValueOnce(new Error('lost response'));
  fireEvent.click(screen.getByRole('button', { name: '알림 8 목록 제거' }));
  await screen.findByText(/같은 동작/);
  expect(screen.getByText(/파일 작업 #32 실패 · 버전 5/)).toBeTruthy();
  api.post.mockResolvedValueOnce({ data: { id: 8, read: false, removed: true } });
  fireEvent.click(screen.getByRole('button', { name: '알림 8 목록 제거' }));
  await waitFor(() => expect(screen.queryByText(/파일 작업 #32/)).toBeNull());
  expect(api.post.mock.calls.map(call => call.slice(0, 2))).toEqual([
    ['/enterprise/notifications/9/read', {}],
    ['/enterprise/notifications/8/remove', {}],
    ['/enterprise/notifications/8/remove', {}],
  ]);
  api.get.mockResolvedValueOnce(page([{ ...ready, read: true }, cancelled]));
  view.unmount();
  render(<Notifications organizationId={1} />);
  expect(api.get).toHaveBeenCalledTimes(1);
  open();
  await screen.findByText(/파일 작업 #31 완료 · 버전 8/);
  expect((screen.getByRole('button', { name: '알림 9 읽음' }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.queryByText(/파일 작업 #32/)).toBeNull();
  expect(api.post).toHaveBeenCalledTimes(3);
  expect(api.get.mock.calls.every(call => call[0] === '/enterprise/notifications')).toBe(true);
  expect(api.patch).not.toHaveBeenCalled();
  expect(api.del).not.toHaveBeenCalled();
});

it('fails closed in the actual inbox for a crosskind export event', async () => {
  api.get.mockResolvedValueOnce(page([{ ...item(), resourceKind: 'source', eventType: 'ready' }]));
  render(<Notifications organizationId={1} />);
  open();
  await screen.findByText(/알림을 확인하지 못했습니다/);
  expect(screen.queryByText(/소스 #7/)).toBeNull();
  expect(api.post).not.toHaveBeenCalled();
});

it.each(['shared', 'unshared'])(
  'rejects source %s in the inbox instead of labeling it as a share or group incident',
  async eventType => {
    api.get.mockResolvedValueOnce(page([{ ...item(), resourceKind: 'source', eventType }]));
    render(<Notifications organizationId={1} />);
    open();
    await screen.findByText(/알림을 확인하지 못했습니다/);
    expect(screen.queryByText(/소스 #7/)).toBeNull();
    expect(api.post).not.toHaveBeenCalled();
  },
);
