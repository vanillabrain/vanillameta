import React from 'react';
import { webcrypto } from 'node:crypto';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import DashboardLifecycle from './DashboardLifecycle';
import {
  dashboardLifecycleLabels,
  fetchDashboardLifecycle,
  saveDashboardLifecycle,
  dashboardLifecyclePendingKey,
  readDashboardLifecyclePending,
  writeDashboardLifecyclePending,
  DASHBOARD_LIFECYCLE_PENDING_TTL,
} from '@/api/dashboardLifecycleService';
import { setToken, removeToken } from '@/helpers/authHelper';
import { retainEditorDraftSession } from '@/helpers/editorDraftStorage';
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('@/helpers/apiHelper', () => api);
const props = { dashboardId: 12, organizationId: 7, dashboardLabel: 'Private dashboard A' };
const deps = () => Object.keys(dashboardLifecycleLabels).map(kind => ({ kind, count: 0 }));
const state = (over: any = {}) => ({
  dashboardId: 12,
  actorId: 19,
  organizationId: 7,
  active: true,
  version: 3,
  revision: 'a'.repeat(64),
  dependencies: deps(),
  ...over,
});
const request = {
  requestId: '11111111-1111-4111-8111-111111111111',
  expectedActorId: 19,
  expectedOrganizationId: 7,
  expectedVersion: 3,
  expectedRevision: 'a'.repeat(64),
  active: false,
  acknowledgedImpact: true as const,
};
const response = (data: any) => ({ data: { status: 'SUCCESS', data } });
const result = (body = request, over: any = {}) => ({
  dashboardId: 12,
  actorId: body.expectedActorId,
  organizationId: body.expectedOrganizationId,
  requestId: body.requestId,
  receiptId: 21,
  active: body.active,
  version: body.expectedVersion + 1,
  replayed: false,
  ...over,
});
const click = (name: string) => fireEvent.click(screen.getByRole('button', { name, exact: true }));
const button = (name: string) => screen.getByRole('button', { name, exact: true }) as HTMLButtonElement;
const open = () => click('대시보드 상태 관리 열기');
const read = async () => {
  await waitFor(() => expect(button('현재 상태·영향 읽기').disabled).toBe(false));
  click('현재 상태·영향 읽기');
  await screen.findByRole('region', { name: '현재 대시보드 상태' });
};
const choose = (value = 'inactive') => {
  fireEvent.change(screen.getByRole('combobox', { name: '저장할 대시보드 상태' }), { target: { value } });
  fireEvent.click(screen.getByRole('checkbox', { name: /영향을 확인하고/ }));
};
const deferred = () => {
  let resolve!: (value: any) => void;
  const promise = new Promise<any>(r => {
    resolve = r;
  });
  return { promise, resolve };
};
const token = (id = 19, iat = 1) =>
  `header.${btoa(JSON.stringify({ accessKeyData: { id, authVersion: 0 }, iat }))}.signature${iat}`;
beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  vi.stubGlobal('crypto', webcrypto);
  setToken(token());
  api.get.mockResolvedValue(response(state()));
  api.post.mockImplementation(async (_path, body) => response(result(body)));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it('stays collapsed and opening alone reads and writes nothing', async () => {
  render(<DashboardLifecycle {...props} />);
  expect(button('대시보드 상태 관리 열기').getAttribute('aria-expanded')).toBe('false');
  open();
  await waitFor(() => expect(button('현재 상태·영향 읽기').disabled).toBe(false));
  expect(api.get).not.toHaveBeenCalled();
  expect(api.post).not.toHaveBeenCalled();
});
it('reads eight impact counts, requires explicit choice and consent, and stores only the exact body', async () => {
  api.get.mockResolvedValueOnce(response(state({ dependencies: deps().map(entry => ({ ...entry, count: 2 })) })));
  render(<DashboardLifecycle {...props} />);
  open();
  await read();
  expect(api.get).toHaveBeenCalledWith('/enterprise/resources/dashboard/12/lifecycle', undefined, {
    signal: expect.anything(),
  });
  for (const text of Object.values(dashboardLifecycleLabels)) expect(screen.getByText(text)).toBeTruthy();
  expect(button('대시보드 상태 저장').disabled).toBe(true);
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'inactive' } });
  expect(button('대시보드 상태 저장').disabled).toBe(true);
  fireEvent.click(screen.getByRole('checkbox'));
  click('대시보드 상태 저장');
  await screen.findByRole('region', { name: '과거 상태 변경 영수증' });
  expect(api.post).toHaveBeenCalledWith('/enterprise/resources/dashboard/12/lifecycle', {
    ...request,
    requestId: expect.any(String),
  });
  expect(screen.queryByRole('region', { name: '현재 대시보드 상태' })).toBeNull();
  expect(api.get).toHaveBeenCalledTimes(1);
});
it('supports same-state explicit save as a fresh version and clears consent after choice changes', async () => {
  render(<DashboardLifecycle {...props} />);
  open();
  await read();
  choose('active');
  expect(screen.getByText(/같은 상태도 새 버전으로 저장합니다/)).toBeTruthy();
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'inactive' } });
  expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(false);
  choose('active');
  click('대시보드 상태 저장');
  await screen.findByRole('region', { name: '과거 상태 변경 영수증' });
  expect(api.post.mock.calls[0][1].active).toBe(true);
});
it('keeps a durable past receipt separate from a newer current GET and never automatically rereads', async () => {
  render(<DashboardLifecycle {...props} />);
  open();
  await read();
  choose();
  click('대시보드 상태 저장');
  const receipt = await screen.findByRole('region', { name: '과거 상태 변경 영수증' });
  expect(receipt.textContent).toContain('비활성 · 버전 4');
  expect(api.get).toHaveBeenCalledTimes(1);
  api.get.mockResolvedValueOnce(response(state({ version: 9, active: true })));
  await read();
  expect(screen.getByRole('region', { name: '현재 대시보드 상태' }).textContent).toContain('현재 상태: 활성 · 버전 9');
  expect(receipt.textContent).toContain('비활성 · 버전 4');
});
it('freezes unknown UUID/body across collapse and a current read without substituting the newer revision', async () => {
  api.post.mockRejectedValueOnce(new Error('lost response'));
  render(<DashboardLifecycle {...props} />);
  open();
  await read();
  choose();
  click('대시보드 상태 저장');
  await screen.findByText(/상태 변경 결과를 확인하지 못했습니다/);
  const original = { ...api.post.mock.calls[0][1] };
  expect(button('대시보드 상태 저장').disabled).toBe(true);
  click('대시보드 상태 관리 접기');
  open();
  expect(api.get).toHaveBeenCalledTimes(1);
  expect(api.post).toHaveBeenCalledTimes(1);
  api.get.mockResolvedValueOnce(response(state({ active: true, version: 20, revision: 'b'.repeat(64) })));
  await read();
  api.post.mockResolvedValueOnce(response(result(original, { replayed: true })));
  click('같은 요청으로 상태 변경 결과 확인');
  await screen.findByRole('region', { name: '과거 상태 변경 영수증' });
  expect(api.post.mock.calls[1][1]).toEqual(original);
});
it('reloads minimal pending intent and requires a successful permission read before manual replay', async () => {
  api.post.mockRejectedValueOnce(new Error('lost response'));
  const first = render(<DashboardLifecycle {...props} />);
  open();
  await read();
  choose();
  click('대시보드 상태 저장');
  await screen.findByText(/상태 변경 결과를 확인하지 못했습니다/);
  const original = api.post.mock.calls[0][1];
  const key = await dashboardLifecyclePendingKey(12, 7);
  const stored = JSON.parse(sessionStorage.getItem(key));
  expect(Object.keys(stored).sort()).toEqual(['dashboardId', 'request', 'updatedAt', 'version']);
  expect(JSON.stringify(stored)).not.toMatch(/Private dashboard|dependencies|token|SQL/);
  first.unmount();
  render(<DashboardLifecycle {...props} />);
  open();
  await waitFor(() => expect(button('같은 요청으로 상태 변경 결과 확인').disabled).toBe(true));
  expect(api.get).toHaveBeenCalledTimes(1);
  expect(api.post).toHaveBeenCalledTimes(1);
  api.get.mockRejectedValueOnce({ response: { status: 403 } });
  click('현재 상태·영향 읽기');
  await screen.findByText(/현재 상태와 영향을 확인하지 못했습니다/);
  expect(button('같은 요청으로 상태 변경 결과 확인').disabled).toBe(true);
  api.get.mockResolvedValueOnce(response(state({ active: false, version: 4 })));
  await read();
  click('같은 요청으로 상태 변경 결과 확인');
  await screen.findByRole('region', { name: '과거 상태 변경 영수증' });
  expect(api.post.mock.calls[1][1]).toEqual(original);
  expect(sessionStorage.getItem(key)).toBeNull();
});
it.each([{ code: 'DASHBOARD_LIFECYCLE_STALE' }, { success: false, code: 409, data: { code: 'DASHBOARD_LIFECYCLE_STALE' } }])(
  'requires new read and renewed consent only for explicit stale 409 %j',
  async data => {
    api.post.mockRejectedValueOnce({ response: { status: 409, data } });
    render(<DashboardLifecycle {...props} />);
    open();
    await read();
    choose();
    click('대시보드 상태 저장');
    await screen.findByText(/저장 기준이나 영향이 변경/);
    expect(api.get).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('region', { name: '현재 대시보드 상태' })).toBeNull();
    expect(screen.queryByRole('button', { name: '같은 요청으로 상태 변경 결과 확인' })).toBeNull();
    api.get.mockResolvedValueOnce(response(state({ version: 4, revision: 'b'.repeat(64) })));
    await read();
    expect(button('대시보드 상태 저장').disabled).toBe(true);
    choose();
    click('대시보드 상태 저장');
    await screen.findByRole('region', { name: '과거 상태 변경 영수증' });
    expect(api.post.mock.calls[1][1].expectedVersion).toBe(4);
    expect(api.post.mock.calls[1][1].requestId).not.toBe(api.post.mock.calls[0][1].requestId);
  },
);
it('withdraws old title, receipt and pending intent on a new login before effects can expose them', async () => {
  const late = deferred();
  api.post.mockReturnValueOnce(late.promise);
  render(<DashboardLifecycle {...props} />);
  open();
  await read();
  choose();
  click('대시보드 상태 저장');
  const body = api.post.mock.calls[0][1];
  act(() => {
    setToken(token(22));
    window.dispatchEvent(new StorageEvent('storage', { key: 'accessToken' }));
  });
  expect(screen.queryByText(/Private dashboard A/)).toBeNull();
  expect(screen.queryByRole('region', { name: '현재 대시보드 상태' })).toBeNull();
  expect(button('대시보드 상태 관리 열기').getAttribute('aria-expanded')).toBe('false');
  await act(async () => late.resolve(response(result(body))));
  expect(screen.queryByRole('region', { name: '과거 상태 변경 영수증' })).toBeNull();
  expect(Object.keys(sessionStorage).filter(key => key.includes('dashboard-lifecycle'))).toHaveLength(0);
});
it.each(['resource', 'organization'])('fences late reads and private labels after %s changes', async change => {
  const late = deferred();
  api.get.mockReturnValueOnce(late.promise);
  const view = render(<DashboardLifecycle {...props} />);
  open();
  await waitFor(() => expect(button('현재 상태·영향 읽기').disabled).toBe(false));
  click('현재 상태·영향 읽기');
  view.rerender(
    <DashboardLifecycle
      {...props}
      dashboardId={change === 'resource' ? 13 : 12}
      organizationId={change === 'organization' ? 8 : 7}
      dashboardLabel="Next label"
    />,
  );
  await act(async () => late.resolve(response(state())));
  expect(screen.queryByText(/Private dashboard A/)).toBeNull();
  expect(screen.queryByRole('region', { name: '현재 대시보드 상태' })).toBeNull();
});
it('preserves the frozen request and recovery key through real healthy token renewal and remount', async () => {
  api.post.mockRejectedValueOnce(new Error('unknown'));
  const view = render(<DashboardLifecycle {...props} />);
  open();
  await read();
  choose();
  click('대시보드 상태 저장');
  await screen.findByText(/상태 변경 결과를 확인하지 못했습니다/);
  const original = api.post.mock.calls[0][1];
  const key = await dashboardLifecyclePendingKey(12, 7);
  await act(async () => {
    await retainEditorDraftSession(token(), token(19, 2));
    setToken(token(19, 2), true);
    window.dispatchEvent(new StorageEvent('storage', { key: 'accessToken' }));
  });
  expect(await dashboardLifecyclePendingKey(12, 7)).toBe(key);
  expect(readDashboardLifecyclePending(key, 12, 7)).toEqual(original);
  view.unmount();
  render(<DashboardLifecycle {...props} />);
  open();
  await read();
  click('같은 요청으로 상태 변경 결과 확인');
  await screen.findByRole('region', { name: '과거 상태 변경 영수증' });
  expect(api.post.mock.calls[1][1]).toEqual(original);
});
it('retains unrelated questions and editor drafts while removing only a confirmed pending request', async () => {
  render(<DashboardLifecycle {...props} />);
  open();
  await read();
  sessionStorage.setItem('unrelated-question', 'keep SQL question');
  choose();
  click('대시보드 상태 저장');
  await screen.findByRole('region', { name: '과거 상태 변경 영수증' });
  expect(sessionStorage.getItem('unrelated-question')).toBe('keep SQL question');
});
it('does not double POST in StrictMode or on repeated clicks while saving', async () => {
  const late = deferred();
  api.post.mockReturnValueOnce(late.promise);
  render(
    <React.StrictMode>
      <DashboardLifecycle {...props} />
    </React.StrictMode>,
  );
  open();
  await read();
  choose();
  click('대시보드 상태 저장');
  click('같은 요청으로 상태 변경 결과 확인');
  expect(api.post).toHaveBeenCalledTimes(1);
  await act(async () => late.resolve(response(result(api.post.mock.calls[0][1]))));
  expect(screen.getAllByRole('region', { name: '과거 상태 변경 영수증' })).toHaveLength(1);
});
it('hides stale impact after failed reread and refuses wrong organization or actor recovery', async () => {
  render(<DashboardLifecycle {...props} />);
  open();
  await read();
  api.get.mockRejectedValueOnce(new Error('offline'));
  click('현재 상태·영향 읽기');
  await screen.findByText(/현재 상태와 영향을 확인하지 못했습니다/);
  expect(screen.queryByRole('region', { name: '현재 대시보드 상태' })).toBeNull();
  api.get.mockResolvedValueOnce(response(state({ organizationId: 8 })));
  click('현재 상태·영향 읽기');
  await waitFor(() => expect(button('현재 상태·영향 읽기').disabled).toBe(false));
  expect(screen.queryByRole('region', { name: '현재 대시보드 상태' })).toBeNull();
  expect(api.post).not.toHaveBeenCalled();
});
it('does not expose server private extra fields and keeps 36/32px control variants', async () => {
  api.get.mockResolvedValueOnce(response(state({ sql: 'private SQL', recipient: 'private person' })));
  render(<DashboardLifecycle {...props} />);
  open();
  await read();
  expect(screen.queryByText(/private SQL|private person/)).toBeNull();
  expect(button('대시보드 상태 저장').dataset.size).toBe('default');
  expect(button('현재 상태·영향 읽기').dataset.size).toBe('sm');
  expect(within(screen.getByRole('region', { name: '현재 대시보드 상태' })).getAllByRole('listitem')).toHaveLength(8);
});
it.each([
  { dashboardId: 13 },
  { actorId: 0 },
  { organizationId: null },
  { version: -1 },
  { revision: 'bad' },
  { dependencies: [] },
  { dependencies: [...deps().slice(1), deps()[1]] },
  { dependencies: deps().map(entry => ({ ...entry, count: 0.5 })) },
  { dependencies: deps().map(entry => ({ ...entry, kind: 'SQL' })) },
])('rejects malformed current envelope data %j', async over => {
  api.get.mockResolvedValueOnce(response(state(over)));
  await expect(fetchDashboardLifecycle(12)).rejects.toThrow();
});
it.each([
  { actorId: 22 },
  { organizationId: 8 },
  { dashboardId: 13 },
  { requestId: 'wrong' },
  { active: true },
  { version: 3 },
  { receiptId: 0 },
  { replayed: undefined },
])('rejects mismatched historical receipt %j', async over => {
  api.post.mockResolvedValueOnce(response(result(request, over)));
  await expect(saveDashboardLifecycle(12, request)).rejects.toThrow();
});
it('rejects raw bodies and invalid outgoing requests before any POST', async () => {
  api.get.mockResolvedValueOnce({ data: state() });
  await expect(fetchDashboardLifecycle(12)).rejects.toThrow();
  await expect(saveDashboardLifecycle(12, { ...request, extra: true } as any)).rejects.toThrow();
  await expect(saveDashboardLifecycle(12, { ...request, acknowledgedImpact: false } as any)).rejects.toThrow();
  expect(api.post).not.toHaveBeenCalled();
});
it.each(['expired', 'future', 'oversized', 'extra', 'bad-body'])('rejects %s pending storage without replay', async mode => {
  const key = await dashboardLifecyclePendingKey(12, 7);
  writeDashboardLifecyclePending(key, 12, request);
  const stored = JSON.parse(sessionStorage.getItem(key));
  if (mode === 'expired') stored.updatedAt -= DASHBOARD_LIFECYCLE_PENDING_TTL;
  if (mode === 'future') stored.updatedAt += 60001;
  if (mode === 'extra') stored.title = 'private';
  if (mode === 'bad-body') stored.request.expectedOrganizationId = 8;
  sessionStorage.setItem(key, mode === 'oversized' ? 'x'.repeat(8193) : JSON.stringify(stored));
  expect(readDashboardLifecyclePending(key, 12, 7)).toBeNull();
  expect(sessionStorage.getItem(key)).toBeNull();
  expect(api.post).not.toHaveBeenCalled();
});
it('reports storage failure before posting and clears pending storage on logout', async () => {
  const key = await dashboardLifecyclePendingKey(12, 7);
  writeDashboardLifecyclePending(key, 12, request);
  removeToken();
  expect(sessionStorage.getItem(key)).toBeNull();
  setToken(token());
  render(<DashboardLifecycle {...props} />);
  open();
  await read();
  choose();
  const store = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('quota');
  });
  click('대시보드 상태 저장');
  await screen.findByText(/미확정 요청을 보관하지 못해/);
  expect(api.post).not.toHaveBeenCalled();
  store.mockRestore();
});

it('keeps malformed successful responses frozen until a matching receipt is confirmed', async () => {
  api.post.mockImplementationOnce(async (_path, body) => response(result(body, { actorId: 22 })));
  render(<DashboardLifecycle {...props} />);
  open();
  await read();
  choose();
  click('대시보드 상태 저장');
  await screen.findByText(/상태 변경 결과를 확인하지 못했습니다/);
  const original = api.post.mock.calls[0][1];
  expect(screen.queryByRole('region', { name: '과거 상태 변경 영수증' })).toBeNull();
  expect(button('대시보드 상태 저장').disabled).toBe(true);
  click('같은 요청으로 상태 변경 결과 확인');
  await screen.findByRole('region', { name: '과거 상태 변경 영수증' });
  expect(api.post.mock.calls[1][1]).toEqual(original);
});
it('keeps an unknown request locked after 403 and permits replay only after management is verified again', async () => {
  api.post.mockRejectedValueOnce({ response: { status: 403 } });
  render(<DashboardLifecycle {...props} />);
  open();
  await read();
  choose();
  click('대시보드 상태 저장');
  await screen.findByText(/상태 변경 결과를 확인하지 못했습니다/);
  expect(screen.queryByText(/Private dashboard A/)).toBeNull();
  expect(button('같은 요청으로 상태 변경 결과 확인').disabled).toBe(true);
  await read();
  click('같은 요청으로 상태 변경 결과 확인');
  await screen.findByRole('region', { name: '과거 상태 변경 영수증' });
  expect(api.post.mock.calls[1][1]).toEqual(api.post.mock.calls[0][1]);
});
it('removes this tab pending intent on a different-tab login while preserving unrelated draft storage', async () => {
  api.post.mockRejectedValueOnce(new Error('unknown'));
  render(<DashboardLifecycle {...props} />);
  open();
  await read();
  choose();
  click('대시보드 상태 저장');
  await screen.findByText(/상태 변경 결과를 확인하지 못했습니다/);
  const key = await dashboardLifecyclePendingKey(12, 7);
  sessionStorage.setItem('other-editor-draft', 'kept');
  act(() => {
    localStorage.setItem('vm:editor-draft-auth:v1', JSON.stringify({ epoch: crypto.randomUUID() }));
    localStorage.setItem('accessToken', JSON.stringify(token(22)));
    window.dispatchEvent(new StorageEvent('storage', { key: 'accessToken' }));
  });
  expect(screen.queryByText(/Private dashboard A/)).toBeNull();
  expect(sessionStorage.getItem(key)).toBeNull();
  expect(sessionStorage.getItem('other-editor-draft')).toBe('kept');
});

it.each([
  { code: 'DASHBOARD_LIFECYCLE_RETRY_REQUIRED' },
  { success: false, code: 409, data: { code: 'DASHBOARD_LIFECYCLE_RETRY_REQUIRED' } },
  undefined,
  { code: 'UNKNOWN_PROXY_CONFLICT' },
  { success: false, code: 409, data: { message: 'Conflict' } },
])('preserves exact request through response loss, retry 409 %j, reload, permission read and manual replay', async data => {
  api.post.mockRejectedValueOnce({ response: { status: 503 } });
  const first = render(<DashboardLifecycle {...props} />);
  open();
  await read();
  choose();
  click('대시보드 상태 저장');
  await screen.findByText(/상태 변경 결과를 확인하지 못했습니다/);
  const original = { ...api.post.mock.calls[0][1] };
  const key = await dashboardLifecyclePendingKey(12, 7);
  api.post.mockRejectedValueOnce({ response: { status: 409, data } });
  click('같은 요청으로 상태 변경 결과 확인');
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(button('같은 요청으로 상태 변경 결과 확인').disabled).toBe(false));
  expect(api.post.mock.calls[1][1]).toEqual(original);
  expect(readDashboardLifecyclePending(key, 12, 7)).toEqual(original);
  expect(button('대시보드 상태 저장').disabled).toBe(true);
  expect((screen.getByRole('combobox') as HTMLSelectElement).disabled).toBe(true);
  expect(api.get).toHaveBeenCalledTimes(1);
  first.unmount();
  render(<DashboardLifecycle {...props} />);
  open();
  await waitFor(() => expect(button('같은 요청으로 상태 변경 결과 확인').disabled).toBe(true));
  expect(api.post).toHaveBeenCalledTimes(2);
  expect(api.get).toHaveBeenCalledTimes(1);
  api.get.mockResolvedValueOnce(response(state({ version: 10, active: true, revision: 'c'.repeat(64) })));
  await read();
  expect(button('대시보드 상태 저장').disabled).toBe(true);
  api.post.mockResolvedValueOnce(response(result(original, { replayed: true })));
  click('같은 요청으로 상태 변경 결과 확인');
  const receipt = await screen.findByRole('region', { name: '과거 상태 변경 영수증' });
  expect(receipt.textContent).toContain('과거 요청 재확인');
  expect(api.post.mock.calls[2][1]).toEqual(original);
  expect(sessionStorage.getItem(key)).toBeNull();
});
it('clears retry-required 409 intent and private state on a new login without disturbing unrelated storage', async () => {
  api.post.mockRejectedValueOnce({
    response: { status: 409, data: { success: false, code: 409, data: { code: 'DASHBOARD_LIFECYCLE_RETRY_REQUIRED' } } },
  });
  render(<DashboardLifecycle {...props} />);
  open();
  await read();
  choose();
  click('대시보드 상태 저장');
  await screen.findByText(/상태 변경 결과를 확인하지 못했습니다/);
  const key = await dashboardLifecyclePendingKey(12, 7);
  expect(readDashboardLifecyclePending(key, 12, 7)).toEqual(api.post.mock.calls[0][1]);
  sessionStorage.setItem('unrelated-question', 'kept');
  act(() => {
    setToken(token(22));
    window.dispatchEvent(new StorageEvent('storage', { key: 'accessToken' }));
  });
  expect(sessionStorage.getItem(key)).toBeNull();
  expect(sessionStorage.getItem('unrelated-question')).toBe('kept');
  expect(screen.queryByText(/Private dashboard A/)).toBeNull();
  expect(screen.queryByRole('button', { name: '같은 요청으로 상태 변경 결과 확인' })).toBeNull();
  expect(api.post).toHaveBeenCalledTimes(1);
});
