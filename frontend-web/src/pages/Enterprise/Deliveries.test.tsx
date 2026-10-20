import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import Deliveries from './Deliveries';
import { deliveryPendingStorageKey, readDeliveryPending } from '@/api/deliveryPendingStorage';
const api = vi.hoisted(() => ({
  session: 'session-1' as string | null,
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  del: vi.fn(),
}));
vi.mock('@/helpers/apiHelper', () => api);
vi.mock('@/api/personalLibraryService', () => ({ personalLibrarySessionScope: () => api.session }));
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
  vi.restoreAllMocks();
  sessionStorage.clear();
  api.session = 'session-1';
  api.get.mockImplementation((url: string) => Promise.resolve(url.includes('/members') ? roster() : relations()));
  api.post.mockImplementation((_url: string, body: any) =>
    Promise.resolve({
      data: {
        requestId: body.requestId,
        dashboardId: 20,
        entries: [...body.recipients]
          .sort((a, b) => a.recipientId - b.recipientId)
          .map(row => ({
            recipientId: row.recipientId,
            version: row.expectedVersion + 1,
            active: body.active,
            ...(body.allowCopy !== undefined ? { allowCopy: body.allowCopy } : {}),
          })),
        replayed: false,
      },
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it('stays collapsed, selects the loaded team snapshot, previews and explicitly saves once', async () => {
  render(<Deliveries dashboardId={20} selfId={1} organizationId={7} />);
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
it('freezes the exact request on response loss and requires a fresh read and separate replay consent', async () => {
  api.post.mockRejectedValueOnce(new Error('lost'));
  render(<Deliveries dashboardId={20} selfId={1} organizationId={7} />);
  open();
  load();
  await screen.findByText(/operator-2/);
  fireEvent.click(screen.getByRole('checkbox', { name: /operator-2/ }));
  ack();
  save();
  await screen.findByText(/공유 결과를 확인하지 못했습니다/);
  expect(screen.queryByRole('radio', { name: '공유 회수' })).toBeNull();
  const first = structuredClone(api.post.mock.calls[0][1]);
  api.post.mockResolvedValueOnce({
    data: {
      dashboardId: 20,
      requestId: first.requestId,
      replayed: true,
      entries: [{ recipientId: 2, version: 1, active: true }],
    },
  });
  load();
  await screen.findByRole('checkbox', { name: /보존한 수신자 번호/ });
  await act(async () => undefined);
  fireEvent.click(screen.getByRole('checkbox', { name: /보존한 수신자 번호/ }));
  fireEvent.click(screen.getByRole('button', { name: '같은 공유 요청 확인' }));
  await screen.findByText(/이전 요청의 저장을 확인/);
  expect(api.post.mock.calls[1][1]).toEqual(first);
});
it('revokes a departed recipient using the recorded version without touching direct grants', async () => {
  api.get.mockImplementation((url: string) =>
    Promise.resolve(url.includes('/members') ? roster() : relations([{ recipientId: 9, version: 5, active: true }])),
  );
  render(<Deliveries dashboardId={20} selfId={1} organizationId={7} />);
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
  render(<Deliveries dashboardId={20} selfId={1} organizationId={7} />);
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
  render(<Deliveries dashboardId={20} selfId={1} organizationId={7} />);
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
  render(<Deliveries dashboardId={20} selfId={1} organizationId={7} />);
  open();
  load();
  await screen.findByText(/operator-2/);
  fireEvent.click(screen.getByRole('checkbox', { name: /operator-2/ }));
  ack();
  save();
  await screen.findByText(/공유 결과를 확인하지 못했습니다/);
  expect(screen.getByRole('button', { name: '같은 공유 요청 확인' })).toBeTruthy();
  expect(screen.queryByText(/선택한 수신자의 공유를 저장/)).toBeNull();
});
it('preserves an uncertain request through a failed latest read and permits an identical confirmation', async () => {
  api.post.mockRejectedValueOnce(new Error('lost'));
  render(<Deliveries dashboardId={20} selfId={1} organizationId={7} />);
  open();
  load();
  await screen.findByText(/operator-2/);
  fireEvent.click(screen.getByRole('checkbox', { name: /operator-2/ }));
  ack();
  save();
  await screen.findByText(/공유 결과를 확인하지 못했습니다/);
  const original = structuredClone(api.post.mock.calls[0][1]);
  api.get.mockRejectedValueOnce(new Error('unavailable'));
  load();
  await screen.findByText(/직원 목록을 확인하지 못했습니다/);
  expect(screen.getByText(/이전 공유 요청을 보존/)).toBeTruthy();
  load();
  await screen.findByRole('checkbox', { name: /보존한 수신자 번호/ });
  await act(async () => undefined);
  fireEvent.click(screen.getByRole('checkbox', { name: /보존한 수신자 번호/ }));
  fireEvent.click(screen.getByRole('button', { name: '같은 공유 요청 확인' }));
  await screen.findByText(/선택한 수신자의 공유를 저장/);
  expect(api.post.mock.calls[1][1]).toEqual(original);
});
it('requires distinct consent before sharing editable independent-copy semantics', async () => {
  render(<Deliveries dashboardId={20} selfId={1} organizationId={7} />);
  open();
  load();
  await screen.findByText(/operator-2/);
  fireEvent.click(screen.getByRole('checkbox', { name: /operator-2/ }));
  fireEvent.change(screen.getByRole('combobox', { name: '독립 복제 설정' }), { target: { value: 'allow' } });
  ack();
  expect((screen.getByRole('button', { name: '공유 변경 저장' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('checkbox', { name: /편집 가능한 독립 사본/ }));
  save();
  await screen.findByText(/선택한 수신자의 공유를 저장/);
  expect(api.post.mock.calls[0][1].allowCopy).toBe(true);
});
it('can revoke without the now-hidden independent-copy consent', async () => {
  render(<Deliveries dashboardId={20} selfId={1} organizationId={7} />);
  open();
  load();
  await screen.findByText(/operator-2/);
  fireEvent.change(screen.getByRole('combobox', { name: '독립 복제 설정' }), { target: { value: 'allow' } });
  fireEvent.click(screen.getByRole('radio', { name: '공유 회수' }));
  fireEvent.click(screen.getByRole('checkbox', { name: /operator-2/ }));
  ack();
  save();
  await screen.findByText(/선택한 수신자의 공유를 저장/);
  expect(api.post.mock.calls[0][1].active).toBe(false);
  expect(api.post.mock.calls[0][1].allowCopy).toBeUndefined();
});

const scope = { selfId: 1, organizationId: 7, dashboardId: 20, session: 'session-1' };
const chooseAndSave = async (copy = 'preserve') => {
  open();
  load();
  await screen.findByText(/operator-2/);
  fireEvent.click(screen.getByRole('checkbox', { name: /operator-2/ }));
  if (copy !== 'preserve')
    fireEvent.change(screen.getByRole('combobox', { name: '독립 복제 설정' }), { target: { value: copy } });
  if (copy === 'allow') fireEvent.click(screen.getByRole('checkbox', { name: /편집 가능한 독립 사본/ }));
  ack();
  save();
};
const retryConsent = () => fireEvent.click(screen.getByRole('checkbox', { name: /보존한 수신자 번호/ }));
const retry = () => fireEvent.click(screen.getByRole('button', { name: '같은 공유 요청 확인' }));
it('persists exact scope/body before POST, restores after unmount without reads/writes and requires current GET plus retry ACK', async () => {
  api.post.mockImplementationOnce((_url, body) => {
    expect(readDeliveryPending(scope).pending?.input).toEqual(body);
    return Promise.reject(new Error('response lost'));
  });
  const view = render(<Deliveries dashboardId={20} selfId={1} organizationId={7} />);
  await chooseAndSave('allow');
  await screen.findByText(/공유 결과를 확인하지 못했습니다/);
  const original = structuredClone(api.post.mock.calls[0][1]);
  view.unmount();
  api.get.mockClear();
  render(<Deliveries dashboardId={20} selfId={1} organizationId={7} />);
  open();
  expect(api.get).not.toHaveBeenCalled();
  expect(api.post).toHaveBeenCalledTimes(1);
  const frozen = screen.getByLabelText('보존한 공유 요청');
  expect(within(frozen).getByText('수신자 번호: 2')).toBeTruthy();
  expect(frozen.textContent).toContain('독립 복제: 허용');
  expect(frozen.textContent).not.toContain('operator-2');
  expect(frozen.textContent).toContain(original.requestId);
  expect((screen.getByRole('button', { name: '같은 공유 요청 확인' }) as HTMLButtonElement).disabled).toBe(true);
  load();
  await waitFor(() =>
    expect((screen.getByRole('checkbox', { name: /보존한 수신자 번호/ }) as HTMLInputElement).disabled).toBe(false),
  );
  expect(readDeliveryPending(scope).pending?.input).toEqual(original);
  expect(api.post).toHaveBeenCalledTimes(1);
  expect((screen.getByRole('button', { name: '같은 공유 요청 확인' }) as HTMLButtonElement).disabled).toBe(true);
  retryConsent();
  retry();
  await screen.findByText(/선택한 수신자의 공유를 저장/);
  expect(api.post.mock.calls[1][1]).toEqual(original);
  expect(readDeliveryPending(scope).pending).toBeNull();
  expect(screen.queryByRole('button', { name: '공유 변경 저장' })).toBeNull();
});
it('collapse and a successful latest GET preserve an uncertain revocation with recorded CAS', async () => {
  api.get.mockImplementation((url: string) =>
    Promise.resolve(url.includes('/members') ? roster() : relations([{ recipientId: 9, version: 5, active: true }])),
  );
  api.post.mockRejectedValueOnce(new Error('lost'));
  render(<Deliveries dashboardId={20} selfId={1} organizationId={7} />);
  open();
  load();
  await screen.findByText(/operator-2/);
  fireEvent.click(screen.getByRole('radio', { name: '공유 회수' }));
  fireEvent.click(screen.getByRole('checkbox', { name: /직원 #9/ }));
  ack();
  save();
  await screen.findByText(/공유 결과를 확인하지 못했습니다/);
  const original = api.post.mock.calls[0][1];
  fireEvent.click(screen.getByRole('button', { name: '조회 공유 접기' }));
  open();
  expect(screen.getByLabelText('보존한 공유 요청').textContent).toContain('공유 회수');
  load();
  await waitFor(() =>
    expect((screen.getByRole('checkbox', { name: /보존한 수신자 번호/ }) as HTMLInputElement).disabled).toBe(false),
  );
  expect(readDeliveryPending(scope).pending?.input).toEqual(original);
  expect(original.recipients).toEqual([{ recipientId: 9, expectedVersion: 5 }]);
  expect(api.post).toHaveBeenCalledTimes(1);
});
it.each([403, 409])('keeps the same UUID/CAS after HTTP%s and fresh GET never silently rebinds it', async status => {
  api.post.mockRejectedValueOnce({ response: { status } }).mockRejectedValueOnce({ response: { status } });
  render(<Deliveries dashboardId={20} selfId={1} organizationId={7} />);
  await chooseAndSave();
  await screen.findByText(/공유 결과를 확인하지 못했습니다/);
  const original = structuredClone(api.post.mock.calls[0][1]);
  api.get.mockImplementation((url: string) =>
    Promise.resolve(url.includes('/members') ? roster() : relations([{ recipientId: 2, version: 8, active: false }])),
  );
  load();
  await waitFor(() =>
    expect((screen.getByRole('checkbox', { name: /보존한 수신자 번호/ }) as HTMLInputElement).disabled).toBe(false),
  );
  retryConsent();
  retry();
  await screen.findByText(/공유 결과를 확인하지 못했습니다/);
  expect(api.post.mock.calls[1][1]).toEqual(original);
  expect(original.recipients[0].expectedVersion).toBe(0);
  expect(readDeliveryPending(scope).pending?.input).toEqual(original);
  expect((screen.getByRole('button', { name: '같은 공유 요청 확인' }) as HTMLButtonElement).disabled).toBe(true);
});
it('storage write failure blocks POST; explicit discard warns and never claims server cancellation', async () => {
  render(<Deliveries dashboardId={20} selfId={1} organizationId={7} />);
  open();
  load();
  await screen.findByText(/operator-2/);
  fireEvent.click(screen.getByRole('checkbox', { name: /operator-2/ }));
  ack();
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('quota');
  });
  save();
  await screen.findByRole('alert');
  expect(api.post).not.toHaveBeenCalled();
  expect(screen.getByText(/이미 서버에서 공유가 적용됐을 수 있습니다/)).toBeTruthy();
  expect((screen.getByRole('button', { name: '요청 보관 해제' }) as HTMLButtonElement).disabled).toBe(true);
  vi.restoreAllMocks();
  fireEvent.click(screen.getByRole('checkbox', { name: /서버 결과가 남을 수 있음을 이해/ }));
  fireEvent.click(screen.getByRole('button', { name: '요청 보관 해제' }));
  await screen.findByText(/이 탭의 보관만 해제했습니다/);
  expect(api.post).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: '공유 변경 저장' })).toBeNull();
});
it.each(['expired', 'corrupt', 'unreadable'])(
  'invalid stored %s state blocks fresh POST and does not allocate a new UUID',
  async kind => {
    const key = deliveryPendingStorageKey(scope) as string;
    sessionStorage.setItem(
      key,
      kind === 'expired'
        ? JSON.stringify({
            savedAt: Date.now() - 86400000,
            selfId: 1,
            organizationId: 7,
            dashboardId: 20,
            input: {
              requestId: '533c472f-b03d-40a1-804c-4af4d787506c',
              active: true,
              recipients: [{ recipientId: 2, expectedVersion: 0 }],
            },
          })
        : 'corrupt',
    );
    if (kind === 'unreadable')
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('blocked');
      });
    const uuid = vi.spyOn(crypto, 'randomUUID');
    render(<Deliveries dashboardId={20} selfId={1} organizationId={7} />);
    open();
    await screen.findByRole('alert');
    load();
    await screen.findByText(/operator-2/);
    fireEvent.click(screen.getByRole('checkbox', { name: /operator-2/ }));
    ack();
    save();
    expect(api.post).not.toHaveBeenCalled();
    expect(uuid).not.toHaveBeenCalled();
  },
);
it('a response after collapse cannot erase the retained request; reopening still requires GET', async () => {
  let finish!: (value: unknown) => void;
  api.post.mockImplementationOnce(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  render(<Deliveries dashboardId={20} selfId={1} organizationId={7} />);
  await chooseAndSave();
  const body = structuredClone(api.post.mock.calls[0][1]);
  fireEvent.click(screen.getByRole('button', { name: '조회 공유 접기' }));
  await act(async () =>
    finish({
      data: {
        dashboardId: 20,
        requestId: body.requestId,
        replayed: false,
        entries: [{ recipientId: 2, version: 1, active: true }],
      },
    }),
  );
  open();
  expect(readDeliveryPending(scope).pending?.input).toEqual(body);
  expect(screen.queryByText(/선택한 수신자의 공유를 저장/)).toBeNull();
  expect((screen.getByRole('button', { name: '같은 공유 요청 확인' }) as HTMLButtonElement).disabled).toBe(true);
});
it('session changes fence late GET and POST responses and never expose another session ticket', async () => {
  let finish!: (value: unknown) => void;
  api.get.mockImplementationOnce(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  const view = render(<Deliveries dashboardId={20} selfId={1} organizationId={7} />);
  open();
  load();
  api.session = 'new-session';
  fireEvent(window, new Event('storage'));
  await act(async () => finish(relations()));
  expect(screen.queryByText(/operator-2/)).toBeNull();
  api.session = 'session-1';
  fireEvent(window, new Event('storage'));
  api.post.mockImplementationOnce(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  load();
  await screen.findByText(/operator-2/);
  fireEvent.click(screen.getByRole('checkbox', { name: /operator-2/ }));
  ack();
  save();
  const original = structuredClone(api.post.mock.calls[0][1]);
  api.session = 'new-session';
  fireEvent(window, new Event('focus'));
  await act(async () =>
    finish({
      data: {
        dashboardId: 20,
        requestId: original.requestId,
        replayed: false,
        entries: [{ recipientId: 2, version: 1, active: true }],
      },
    }),
  );
  expect(screen.queryByLabelText('보존한 공유 요청')).toBeNull();
  expect(screen.queryByText(/선택한 수신자의 공유를 저장/)).toBeNull();
  expect(readDeliveryPending(scope).pending?.input).toEqual(original);
  view.unmount();
});
it.each([{ selfId: 3 }, { organizationId: 8 }, { dashboardId: 21 }])(
  'prop scope changes isolate retained writes and reset current management reads %s',
  async change => {
    api.post.mockRejectedValueOnce(new Error('lost'));
    const view = render(<Deliveries dashboardId={20} selfId={1} organizationId={7} />);
    await chooseAndSave();
    await screen.findByText(/공유 결과를 확인하지 못했습니다/);
    const original = structuredClone(api.post.mock.calls[0][1]);
    view.rerender(<Deliveries dashboardId={20} selfId={1} organizationId={7} {...change} />);
    expect(screen.queryByLabelText('보존한 공유 요청')).toBeNull();
    expect(screen.queryByText(/operator-2/)).toBeNull();
    expect(readDeliveryPending(scope).pending?.input).toEqual(original);
    expect(api.post).toHaveBeenCalledTimes(1);
  },
);
