import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import GroupDeliveries from './GroupDeliveries';
const api = vi.hoisted(() => ({
  session: 'session-1' as string | null,
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  del: vi.fn(),
}));
vi.mock('@/helpers/apiHelper', () => api);
vi.mock('@/api/personalLibraryService', () => ({ personalLibrarySessionScope: () => api.session }));
import { groupDeliveryPendingStorageKey, readGroupDeliveryPending } from '@/api/groupDeliveryPendingStorage';
const group = { id: 7, name: 'Operations', active: true, version: 3 };
const open = () => fireEvent.click(screen.getByRole('button', { name: '그룹 공유 열기' }));
const load = () => fireEvent.click(screen.getByRole('button', { name: '그룹 공유 최신 읽기 · 초안 초기화' }));
const save = () => fireEvent.click(screen.getByRole('button', { name: '그룹 공유 변경 저장' }));
async function choose() {
  await screen.findByRole('option', { name: 'Operations · v3' });
  fireEvent.change(screen.getByRole('combobox', { name: '공유할 그룹' }), { target: { value: '7' } });
}
const ack = () => fireEvent.click(screen.getByRole('checkbox', { name: /그룹 전체·향후/ }));
beforeEach(() => {
  vi.resetAllMocks();
  vi.restoreAllMocks();
  sessionStorage.clear();
  api.session = 'session-1';
  api.get.mockImplementation((url: string) =>
    Promise.resolve({
      data: url === '/enterprise/groups' ? { entries: [group], nextAfterId: null } : { dashboardId: 20, entries: [] },
    }),
  );
  api.post.mockImplementation((_url: string, body: any) =>
    Promise.resolve({
      data: {
        requestId: body.requestId,
        dashboardId: 20,
        entry: { groupId: body.groupId, version: 1, active: body.active, allowCopy: body.allowCopy },
        replayed: false,
      },
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it('requires explicit load, group effect consent and saves a versioned current/future membership relation', async () => {
  render(<GroupDeliveries dashboardId={20} organizationId={5} selfId={1} />);
  open();
  expect(api.get).not.toHaveBeenCalled();
  load();
  await choose();
  fireEvent.click(screen.getByRole('checkbox', { name: '조회 공유 활성' }));
  fireEvent.click(screen.getByRole('checkbox', { name: '내 소스로 독립 복제 허용' }));
  expect(screen.getByText(/조회 공유: 중지 → 활성/)).toBeTruthy();
  expect((screen.getByRole('button', { name: '그룹 공유 변경 저장' }) as HTMLButtonElement).disabled).toBe(true);
  ack();
  save();
  await screen.findByText(/그룹 공유를 저장했습니다/);
  expect(api.post.mock.calls[0][1]).toMatchObject({
    groupId: 7,
    expectedGroupVersion: 3,
    expectedVersion: 0,
    active: true,
    allowCopy: true,
  });
  expect((screen.getByRole('button', { name: '그룹 공유 변경 저장' }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByRole('combobox', { name: '공유할 그룹' }).className).toContain('h-9');
  expect(screen.getByRole('combobox', { name: '공유할 그룹' }).className).toContain('text-base');
});
it('freezes the exact body after response loss and explicitly rechecks it before new writes', async () => {
  api.post.mockRejectedValueOnce(new Error('lost'));
  render(<GroupDeliveries dashboardId={20} organizationId={5} selfId={1} />);
  open();
  load();
  await choose();
  fireEvent.click(screen.getByRole('checkbox', { name: '조회 공유 활성' }));
  ack();
  save();
  await screen.findByText(/이전 그룹 공유 요청을 보존/);
  fireEvent.click(screen.getByRole('button', { name: '그룹 공유 접기' }));
  expect(screen.queryByRole('button', { name: '같은 그룹 공유 요청 확인' })).toBeNull();
  open();
  const confirm = screen.getByRole('button', { name: '같은 그룹 공유 요청 확인' });
  expect((confirm as HTMLButtonElement).disabled).toBe(true);
  load();
  await waitFor(() =>
    expect((screen.getByRole('checkbox', { name: /보존한 그룹 번호/ }) as HTMLInputElement).disabled).toBe(false),
  );
  expect(screen.queryByRole('combobox', { name: '공유할 그룹' })).toBeNull();
  fireEvent.click(screen.getByRole('checkbox', { name: /보존한 그룹 번호/ }));
  const first = structuredClone(api.post.mock.calls[0][1]);
  fireEvent.click(confirm);
  await screen.findByText(/그룹 공유를 저장했습니다/);
  expect(api.post.mock.calls[1][1]).toEqual(first);
  expect(api.post).toHaveBeenCalledTimes(2);
});
it('preserves the frozen request on 409 and keeps its group version/CAS after an explicit latest read', async () => {
  api.post.mockRejectedValueOnce({ response: { status: 409 } });
  render(<GroupDeliveries dashboardId={20} organizationId={5} selfId={1} />);
  open();
  load();
  await choose();
  fireEvent.click(screen.getByRole('checkbox', { name: '조회 공유 활성' }));
  ack();
  save();
  await screen.findByText(/이전 그룹 공유 요청을 보존/);
  const original = structuredClone(api.post.mock.calls[0][1]);
  await waitFor(() =>
    expect((screen.getByRole('button', { name: '그룹 공유 최신 읽기 · 초안 초기화' }) as HTMLButtonElement).disabled).toBe(
      false,
    ),
  );
  api.get.mockImplementation((url: string) =>
    Promise.resolve({
      data:
        url === '/enterprise/groups'
          ? { entries: [{ ...group, version: 4 }], nextAfterId: null }
          : { dashboardId: 20, entries: [{ groupId: 7, version: 8, active: false, allowCopy: false }] },
    }),
  );
  load();
  await waitFor(() =>
    expect((screen.getByRole('checkbox', { name: /보존한 그룹 번호/ }) as HTMLInputElement).disabled).toBe(false),
  );
  expect(readGroupDeliveryPending(scope).pending?.input).toEqual(original);
  fireEvent.click(screen.getByRole('checkbox', { name: /보존한 그룹 번호/ }));
  fireEvent.click(screen.getByRole('button', { name: '같은 그룹 공유 요청 확인' }));
  await screen.findByText(/그룹 공유를 저장했습니다/);
  expect(api.post.mock.calls[1][1]).toEqual(original);
});
it('drops a late response after unmount and permits inactive group revocation only', async () => {
  let resolve!: (value: any) => void;
  api.get.mockImplementation(
    () =>
      new Promise(r => {
        resolve = r;
      }),
  );
  const view = render(<GroupDeliveries dashboardId={20} organizationId={5} selfId={1} />);
  open();
  load();
  view.unmount();
  await act(async () => resolve({ data: { dashboardId: 20, entries: [] } }));
  expect(screen.queryByRole('combobox')).toBeNull();
  api.get.mockImplementation((url: string) =>
    Promise.resolve({
      data:
        url === '/enterprise/groups'
          ? { entries: [{ ...group, active: false }], nextAfterId: null }
          : { dashboardId: 20, entries: [{ groupId: 7, version: 2, active: true, allowCopy: true }] },
    }),
  );
  render(<GroupDeliveries dashboardId={20} organizationId={5} selfId={1} />);
  open();
  load();
  await screen.findByRole('option', { name: 'Operations · v3 · 비활성' });
  fireEvent.change(screen.getByRole('combobox'), { target: { value: '7' } });
  fireEvent.click(screen.getByRole('checkbox', { name: '조회 공유 활성' }));
  ack();
  save();
  await screen.findByText(/그룹 공유를 저장했습니다/);
  expect(api.post.mock.calls[0][1]).toMatchObject({ active: false, allowCopy: false, expectedVersion: 2 });
});

const scope = { selfId: 1, organizationId: 5, dashboardId: 20, session: 'session-1' };
async function start(copy = false) {
  open();
  load();
  await choose();
  fireEvent.click(screen.getByRole('checkbox', { name: '조회 공유 활성' }));
  if (copy) fireEvent.click(screen.getByRole('checkbox', { name: '내 소스로 독립 복제 허용' }));
  ack();
  save();
}
const retryAck = () => fireEvent.click(screen.getByRole('checkbox', { name: /보존한 그룹 번호/ }));
const retry = () => fireEvent.click(screen.getByRole('button', { name: '같은 그룹 공유 요청 확인' }));
const readyRetry = async () => {
  load();
  await waitFor(() =>
    expect((screen.getByRole('checkbox', { name: /보존한 그룹 번호/ }) as HTMLInputElement).disabled).toBe(false),
  );
};
it('persists exact body before POST and restores after reload with zero automatic writes; no names stored or frozen', async () => {
  api.post.mockImplementationOnce((_url, body) => {
    expect(readGroupDeliveryPending(scope).pending?.input).toEqual(body);
    return Promise.reject(new Error('lost'));
  });
  const view = render(<GroupDeliveries dashboardId={20} organizationId={5} selfId={1} />);
  await start(true);
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
  const original = structuredClone(api.post.mock.calls[0][1]);
  view.unmount();
  api.get.mockClear();
  render(<GroupDeliveries dashboardId={20} organizationId={5} selfId={1} />);
  open();
  expect(api.get).not.toHaveBeenCalled();
  expect(api.post).toHaveBeenCalledTimes(1);
  const frozen = screen.getByLabelText('보존한 그룹 공유 요청');
  expect(frozen.textContent).toContain(original.requestId);
  expect(frozen.textContent).toContain('그룹 번호 7 · 그룹 버전 3 · 공유 버전 0');
  expect(frozen.textContent).toContain('독립 복제: 허용');
  expect(frozen.textContent).not.toContain('Operations');
  expect(sessionStorage.getItem(groupDeliveryPendingStorageKey(scope) as string)).not.toContain('Operations');
  expect((screen.getByRole('button', { name: '같은 그룹 공유 요청 확인' }) as HTMLButtonElement).disabled).toBe(true);
  await readyRetry();
  expect(readGroupDeliveryPending(scope).pending?.input).toEqual(original);
  expect((screen.getByRole('button', { name: '같은 그룹 공유 요청 확인' }) as HTMLButtonElement).disabled).toBe(true);
  retryAck();
  retry();
  await screen.findByText(/그룹 공유를 저장했습니다/);
  expect(api.post.mock.calls[1][1]).toEqual(original);
  expect(readGroupDeliveryPending(scope).pending).toBeNull();
  expect((screen.getByRole('button', { name: '그룹 공유 변경 저장' }) as HTMLButtonElement).disabled).toBe(true);
});
it.each([403, 409])('retains exact frozen input on HTTP%s and failed GET; no automatic rebinding or retry', async status => {
  api.post.mockRejectedValueOnce({ response: { status } });
  render(<GroupDeliveries dashboardId={20} organizationId={5} selfId={1} />);
  await start();
  await waitFor(() =>
    expect((screen.getByRole('button', { name: '그룹 공유 최신 읽기 · 초안 초기화' }) as HTMLButtonElement).disabled).toBe(
      false,
    ),
  );
  const original = structuredClone(api.post.mock.calls[0][1]);
  api.get.mockRejectedValueOnce({ response: { status: 403 } });
  load();
  await waitFor(() =>
    expect((screen.getByRole('button', { name: '그룹 공유 최신 읽기 · 초안 초기화' }) as HTMLButtonElement).disabled).toBe(
      false,
    ),
  );
  expect(readGroupDeliveryPending(scope).pending?.input).toEqual(original);
  expect((screen.getByRole('button', { name: '같은 그룹 공유 요청 확인' }) as HTMLButtonElement).disabled).toBe(true);
  expect(api.post).toHaveBeenCalledTimes(1);
});
it.each(['corrupt', 'expired'])(
  'invalid %s ticket blocks new writes and has an explicit warned discard path without exposing raw content',
  async kind => {
    const key = groupDeliveryPendingStorageKey(scope) as string;
    sessionStorage.setItem(
      key,
      kind === 'corrupt'
        ? 'secret-malformed-content'
        : JSON.stringify({
            savedAt: Date.now() - 86400000,
            selfId: 1,
            organizationId: 5,
            dashboardId: 20,
            input: {
              requestId: '533c472f-b03d-40a1-804c-4af4d787506c',
              groupId: 7,
              expectedGroupVersion: 3,
              expectedVersion: 0,
              active: true,
              allowCopy: false,
            },
          }),
    );
    render(<GroupDeliveries dashboardId={20} organizationId={5} selfId={1} />);
    open();
    await screen.findByRole('alert');
    expect(screen.queryByText(/secret-malformed-content/)).toBeNull();
    load();
    await choose();
    fireEvent.click(screen.getByRole('checkbox', { name: '조회 공유 활성' }));
    ack();
    save();
    expect(api.post).not.toHaveBeenCalled();
    expect((screen.getByRole('button', { name: '그룹 요청 보관 해제' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/이미 서버에서 그룹 공유가 적용됐을 수 있습니다/)).toBeTruthy();
    fireEvent.click(screen.getByRole('checkbox', { name: /서버 결과가 남을 수 있음을 이해/ }));
    fireEvent.click(screen.getByRole('button', { name: '그룹 요청 보관 해제' }));
    await screen.findByText(/이 탭의 보관만 해제했습니다/);
    expect(sessionStorage.getItem(key)).toBeNull();
    expect(api.post).not.toHaveBeenCalled();
  },
);
it('storage write failure prevents POST; missing session prevents a new request', async () => {
  render(<GroupDeliveries dashboardId={20} organizationId={5} selfId={1} />);
  open();
  load();
  await choose();
  fireEvent.click(screen.getByRole('checkbox', { name: '조회 공유 활성' }));
  ack();
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('quota');
  });
  save();
  await screen.findByRole('alert');
  expect(api.post).not.toHaveBeenCalled();
});
it('keeps a prewrite selection across collapse but requires a new read/consent for a frozen attempt', async () => {
  render(<GroupDeliveries dashboardId={20} organizationId={5} selfId={1} />);
  open();
  load();
  await choose();
  fireEvent.click(screen.getByRole('checkbox', { name: '조회 공유 활성' }));
  ack();
  fireEvent.click(screen.getByRole('button', { name: '그룹 공유 접기' }));
  open();
  expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('7');
  expect((screen.getByRole('checkbox', { name: '조회 공유 활성' }) as HTMLInputElement).checked).toBe(true);
  api.post.mockRejectedValueOnce(new Error('lost'));
  save();
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByRole('button', { name: '그룹 공유 접기' }));
  open();
  expect((screen.getByRole('button', { name: '같은 그룹 공유 요청 확인' }) as HTMLButtonElement).disabled).toBe(true);
});
it('ignores late POST after collapse and retains the exact stored ticket', async () => {
  let finish!: (value: unknown) => void;
  api.post.mockImplementationOnce(
    () =>
      new Promise(r => {
        finish = r;
      }),
  );
  render(<GroupDeliveries dashboardId={20} organizationId={5} selfId={1} />);
  await start();
  const original = structuredClone(api.post.mock.calls[0][1]);
  fireEvent.click(screen.getByRole('button', { name: '그룹 공유 접기' }));
  await act(async () =>
    finish({
      data: {
        dashboardId: 20,
        requestId: original.requestId,
        replayed: false,
        entry: { groupId: 7, version: 1, active: true, allowCopy: false },
      },
    }),
  );
  open();
  expect(screen.queryByText(/그룹 공유를 저장했습니다/)).toBeNull();
  expect(readGroupDeliveryPending(scope).pending?.input).toEqual(original);
});
it('session/epoch changes drop late GET and POST and do not expose another session ticket', async () => {
  let finish!: (value: unknown) => void;
  api.get.mockImplementationOnce(
    () =>
      new Promise(r => {
        finish = r;
      }),
  );
  render(<GroupDeliveries dashboardId={20} organizationId={5} selfId={1} />);
  open();
  load();
  api.session = 'other';
  fireEvent(window, new Event('storage'));
  await act(async () => finish({ data: { entries: [group], nextAfterId: null } }));
  expect(screen.queryByRole('option', { name: 'Operations · v3' })).toBeNull();
  api.session = 'session-1';
  fireEvent(window, new Event('focus'));
  load();
  await choose();
  fireEvent.click(screen.getByRole('checkbox', { name: '조회 공유 활성' }));
  ack();
  api.post.mockImplementationOnce(
    () =>
      new Promise(r => {
        finish = r;
      }),
  );
  save();
  const original = structuredClone(api.post.mock.calls[0][1]);
  api.session = 'other';
  fireEvent(window, new Event('storage'));
  await act(async () =>
    finish({
      data: {
        dashboardId: 20,
        requestId: original.requestId,
        replayed: false,
        entry: { groupId: 7, version: 1, active: true, allowCopy: false },
      },
    }),
  );
  expect(screen.queryByLabelText('보존한 그룹 공유 요청')).toBeNull();
  expect(screen.queryByText(/그룹 공유를 저장했습니다/)).toBeNull();
  expect(readGroupDeliveryPending(scope).pending?.input).toEqual(original);
});
it.each([{ selfId: 2 }, { organizationId: 6 }, { dashboardId: 21 }])(
  'isolates pending ticket on changed scope %s',
  async change => {
    api.post.mockRejectedValueOnce(new Error('lost'));
    const view = render(<GroupDeliveries dashboardId={20} organizationId={5} selfId={1} />);
    await start();
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    const original = structuredClone(api.post.mock.calls[0][1]);
    view.rerender(<GroupDeliveries dashboardId={20} organizationId={5} selfId={1} {...change} />);
    expect(screen.queryByLabelText('보존한 그룹 공유 요청')).toBeNull();
    expect(readGroupDeliveryPending(scope).pending?.input).toEqual(original);
    expect(api.post).toHaveBeenCalledTimes(1);
  },
);
