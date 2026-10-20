import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import ReceivedDashboards from './ReceivedDashboards';
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('@/helpers/apiHelper', () => api);
const entry = (dashboardId = 20) => ({ dashboardId, title: `공유 대시보드 ${dashboardId}`, version: 1 });
const page = (entries = [entry()], nextAfterId: number | null = null) => ({ data: { entries, nextAfterId } });
const open = () => fireEvent.click(screen.getByRole('button', { name: '받은 자료 열기' }));
beforeEach(() => vi.resetAllMocks());
afterEach(cleanup);
it('reads only after opening and links only to the existing protected dashboard route', async () => {
  api.get.mockResolvedValueOnce(page());
  render(<ReceivedDashboards />);
  expect(api.get).not.toHaveBeenCalled();
  open();
  const link = await screen.findByRole('link', { name: '대시보드 20 열기' });
  expect(link.getAttribute('href')).toBe('/dashboard/20');
  expect(api.get).toHaveBeenCalledWith('/enterprise/deliveries/dashboard/received', {});
  expect(api.post).not.toHaveBeenCalled();
  expect(screen.getByText('공유 대시보드 20')).toBeTruthy();
});
it('continues from an empty filtered page using the scanned cursor and appends only fresh results', async () => {
  api.get
    .mockResolvedValueOnce(page([], 119))
    .mockResolvedValueOnce(page([entry(120)], 140))
    .mockResolvedValueOnce(page([entry(141)]));
  render(<ReceivedDashboards />);
  open();
  await screen.findByText(/이번 구간/);
  fireEvent.click(screen.getByRole('button', { name: '받은 자료 다음 구간' }));
  await screen.findByText('공유 대시보드 120');
  expect(api.get).toHaveBeenNthCalledWith(2, '/enterprise/deliveries/dashboard/received', { afterId: 119 });
  fireEvent.click(screen.getByRole('button', { name: '받은 자료 다음 구간' }));
  await screen.findByText('공유 대시보드 141');
  expect(screen.getByText('공유 대시보드 120')).toBeTruthy();
  expect(screen.queryByRole('button', { name: '받은 자료 다음 구간' })).toBeNull();
});
it('hides stale titles on a failed page and explicitly restarts from the beginning', async () => {
  api.get
    .mockResolvedValueOnce(page([entry()], 20))
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce(page([]));
  render(<ReceivedDashboards />);
  open();
  await screen.findByText('공유 대시보드 20');
  fireEvent.click(screen.getByRole('button', { name: '받은 자료 다음 구간' }));
  await screen.findByText(/다시 읽어/);
  expect(screen.queryByText('공유 대시보드 20')).toBeNull();
  expect(screen.queryByRole('link')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '받은 자료 다시 읽기' }));
  await screen.findByText('현재 열람할 수 있는 받은 자료가 없습니다.');
  expect(api.get).toHaveBeenNthCalledWith(3, '/enterprise/deliveries/dashboard/received', {});
});
it('ignores an old answer after close and remount for another account', async () => {
  let resolve!: (value: unknown) => void;
  api.get
    .mockReturnValueOnce(
      new Promise(finish => {
        resolve = finish;
      }),
    )
    .mockResolvedValueOnce(page([entry(30)]));
  const view = render(<ReceivedDashboards key="account-one" />);
  open();
  fireEvent.click(screen.getByRole('button', { name: '받은 자료 접기' }));
  view.rerender(<ReceivedDashboards key="account-two" />);
  open();
  await screen.findByText('공유 대시보드 30');
  await act(async () => resolve(page()));
  expect(screen.queryByText('공유 대시보드 20')).toBeNull();
});
it('rejects invalid destinations, backward cursors, duplicate rows and excessive labels', async () => {
  for (const invalid of [
    page([{ ...entry(), dashboardId: 'https://invalid.example' } as any]),
    page([entry(20), entry(20)]),
    page([{ ...entry(), title: 'x'.repeat(301) }]),
    page([entry(20)], 19),
  ]) {
    api.get.mockResolvedValueOnce(invalid);
    const view = render(<ReceivedDashboards />);
    open();
    await screen.findByText(/다시 읽어/);
    expect(screen.queryByRole('link')).toBeNull();
    view.unmount();
  }
});
it('survives StrictMode effect replay and discards the first slower answer', async () => {
  let first!: (value: unknown) => void;
  api.get
    .mockReturnValueOnce(
      new Promise(resolve => {
        first = resolve;
      }),
    )
    .mockResolvedValueOnce(page([entry(30)]));
  render(
    <React.StrictMode>
      <ReceivedDashboards />
    </React.StrictMode>,
  );
  open();
  await screen.findByText('공유 대시보드 30');
  await act(async () => first(page()));
  expect(screen.queryByText('공유 대시보드 20')).toBeNull();
  expect(api.post).not.toHaveBeenCalled();
});
it('offers own-source remix only when the server explicitly permits independent copying', async () => {
  api.get.mockResolvedValueOnce({
    data: {
      entries: [
        { ...entry(20), allowCopy: true },
        { ...entry(21), allowCopy: false },
      ],
      nextAfterId: null,
    },
  });
  render(<ReceivedDashboards />);
  open();
  const link = await screen.findByRole('link', { name: '대시보드 20 내 소스로 복제' });
  expect(link.getAttribute('href')).toBe('/received/20/remix');
  expect(screen.queryByRole('link', { name: '대시보드 21 내 소스로 복제' })).toBeNull();
  expect(api.post).not.toHaveBeenCalled();
});
