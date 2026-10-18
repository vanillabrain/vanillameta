import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import Deliveries from './Deliveries';
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), del: vi.fn() }));
vi.mock('@/helpers/apiHelper', () => api);
const members = [2, 3, 4].map(id => ({ id, userId: `operator-${id}`, role: 'member', team: 'Ops', active: id !== 4 }));
const roster = (entries = members, nextAfterId: number | null = null, organizationVersion = 1) => ({
  data: { entries, nextAfterId, organizationVersion },
});
const relations = (entries: unknown[] = []) => ({ data: { dashboardId: 20, entries } });
const open = () => fireEvent.click(screen.getByRole('button', { name: '조회 공유 열기' }));
const load = () => fireEvent.click(screen.getByRole('button', { name: '최신 공유 관계 읽기' }));
const ack = () => fireEvent.click(screen.getByRole('checkbox', { name: '선택한 수신자와 공유 변경을 확인했습니다.' }));
const save = () => fireEvent.click(screen.getByRole('button', { name: '공유 변경 저장' }));
beforeEach(() => {
  vi.resetAllMocks();
  api.get.mockImplementation((url: string) => Promise.resolve(url.includes('/members') ? roster() : relations()));
  api.post.mockImplementation((_url: string, body: any) =>
    Promise.resolve({
      data: {
        requestId: body.requestId,
        dashboardId: 20,
        entries: [...body.recipients]
          .sort((a, b) => a.recipientId - b.recipientId)
          .map(row => ({ recipientId: row.recipientId, version: row.expectedVersion + 1, active: body.active })),
        replayed: false,
      },
    }),
  );
});
afterEach(cleanup);
it('stays collapsed, selects the loaded team snapshot, previews and explicitly saves once', async () => {
  render(<Deliveries dashboardId={20} selfId={1} />);
  expect(api.get).not.toHaveBeenCalled();
  open();
  expect(api.get).not.toHaveBeenCalled();
  load();
  await screen.findByText(/operator-2/);
  expect(screen.queryByText(/operator-4/)).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '불러온 Ops 팀 선택' }));
  expect(screen.getByText('변경 미리보기: 2명 → 조회 공유')).toBeTruthy();
  expect((screen.getByRole('button', { name: '공유 변경 저장' }) as HTMLButtonElement).disabled).toBe(true);
  ack();
  save();
  await screen.findByText(/선택한 수신자의 공유를 저장/);
  expect(api.post).toHaveBeenCalledTimes(1);
  expect(api.post.mock.calls[0][1]).toMatchObject({
    active: true,
    recipients: [
      { recipientId: 2, expectedVersion: 0 },
      { recipientId: 3, expectedVersion: 0 },
    ],
  });
  expect(screen.queryByRole('button', { name: '공유 변경 저장' })).toBeNull();
  load();
  await screen.findByText(/operator-2/);
  expect(api.post).toHaveBeenCalledTimes(1);
});
it('freezes the exact request on response loss and replays it explicitly before a fresh read', async () => {
  api.post.mockRejectedValueOnce(new Error('lost'));
  render(<Deliveries dashboardId={20} selfId={1} />);
  open();
  load();
  await screen.findByText(/operator-2/);
  fireEvent.click(screen.getByRole('checkbox', { name: /operator-2/ }));
  ack();
  save();
  await screen.findByText(/같은 요청으로 확인하거나/);
  expect((screen.getByRole('radio', { name: '공유 회수' }) as HTMLInputElement).disabled).toBe(true);
  const first = structuredClone(api.post.mock.calls[0][1]);
  api.post.mockResolvedValueOnce({
    data: {
      dashboardId: 20,
      requestId: first.requestId,
      replayed: true,
      entries: [{ recipientId: 2, version: 1, active: true }],
    },
  });
  fireEvent.click(screen.getByRole('button', { name: '같은 공유 요청 확인' }));
  await screen.findByText(/이전 요청의 저장을 확인/);
  expect(api.post.mock.calls[1][1]).toEqual(first);
});
it('revokes a departed recipient using the recorded version without touching direct grants', async () => {
  api.get.mockImplementation((url: string) =>
    Promise.resolve(url.includes('/members') ? roster() : relations([{ recipientId: 9, version: 5, active: true }])),
  );
  render(<Deliveries dashboardId={20} selfId={1} />);
  open();
  load();
  await screen.findByText(/operator-2/);
  fireEvent.click(screen.getByRole('radio', { name: '공유 회수' }));
  fireEvent.click(screen.getByRole('checkbox', { name: /직원 #9/ }));
  ack();
  save();
  await screen.findByText(/선택한 수신자의 공유를 저장/);
  expect(api.post.mock.calls[0]).toEqual([
    '/enterprise/deliveries/dashboard/20',
    expect.objectContaining({ active: false, recipients: [{ recipientId: 9, expectedVersion: 5 }] }),
  ]);
});
it('preserves the source read warning, drops a late result on close and reads again after reopening', async () => {
  let finish!: (value: unknown) => void;
  api.get.mockReturnValueOnce(
    new Promise(resolve => {
      finish = resolve;
    }),
  );
  render(<Deliveries dashboardId={20} selfId={1} />);
  open();
  load();
  expect(screen.getByText(/소스 읽기 권한도 별도로/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '조회 공유 접기' }));
  await act(async () => finish(relations()));
  open();
  expect(screen.queryByText(/operator-2/)).toBeNull();
  load();
  await screen.findByText(/operator-2/);
});
it('requires a fresh read if the paged staff version changes and keeps POST at zero', async () => {
  api.get.mockImplementation((url: string, args: any) =>
    Promise.resolve(
      url.includes('/members') ? (args?.afterId ? roster([], null, 2) : roster([members[0]], 2, 1)) : relations(),
    ),
  );
  render(<Deliveries dashboardId={20} selfId={1} />);
  open();
  load();
  await screen.findByText(/operator-2/);
  fireEvent.click(screen.getByRole('button', { name: '직원 더 보기' }));
  await screen.findByText(/직원 목록이 변경됐거나/);
  expect(screen.queryByRole('button', { name: '공유 변경 저장' })).toBeNull();
  expect(api.post).not.toHaveBeenCalled();
});
it('does not accept an incomplete success response as a completed atomic batch', async () => {
  api.post.mockImplementationOnce((_url: string, body: any) =>
    Promise.resolve({ data: { dashboardId: 20, requestId: body.requestId, entries: [], replayed: false } }),
  );
  render(<Deliveries dashboardId={20} selfId={1} />);
  open();
  load();
  await screen.findByText(/operator-2/);
  fireEvent.click(screen.getByRole('checkbox', { name: /operator-2/ }));
  ack();
  save();
  await screen.findByText(/같은 요청으로 확인하거나/);
  expect(screen.getByRole('button', { name: '같은 공유 요청 확인' })).toBeTruthy();
  expect(screen.queryByText(/선택한 수신자의 공유를 저장/)).toBeNull();
});
it('preserves an uncertain request through a failed latest read and permits an identical confirmation', async () => {
  api.post.mockRejectedValueOnce(new Error('lost'));
  render(<Deliveries dashboardId={20} selfId={1} />);
  open();
  load();
  await screen.findByText(/operator-2/);
  fireEvent.click(screen.getByRole('checkbox', { name: /operator-2/ }));
  ack();
  save();
  await screen.findByText(/같은 요청으로 확인하거나/);
  const original = structuredClone(api.post.mock.calls[0][1]);
  api.get.mockRejectedValueOnce(new Error('unavailable'));
  load();
  await screen.findByText(/직원 목록을 확인하지 못했습니다/);
  expect(screen.getByText(/이전 공유 요청을 보존/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '같은 공유 요청 확인' }));
  await screen.findByText(/선택한 수신자의 공유를 저장/);
  expect(api.post.mock.calls[1][1]).toEqual(original);
});
