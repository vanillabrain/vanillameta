import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import Classifications from './Classifications';
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), epoch: 'session-1' }));
vi.mock('@/helpers/apiHelper', () => ({ get: api.get, post: api.post }));
vi.mock('@/helpers/editorDraftStorage', () => ({ editorDraftSessionEpoch: () => api.epoch }));
const entry = { id: 4, name: '매출', active: true, version: 1 };
const page = (over = {}) => ({
  data: { actorId: 1, organizationId: 7, canManage: true, entries: [entry], nextAfterId: null, ...over },
});
beforeEach(() => {
  sessionStorage.clear();
  vi.resetAllMocks();
  api.epoch = 'session-1';
  api.get.mockResolvedValue(page());
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
const click = (name: string) => fireEvent.click(screen.getByRole('button', { name, exact: true }));
const open = async () => {
  click('공통 분류');
  await screen.findByText(/매출 · ID 4/);
};
it('loads only when opened, allows member listing/search and hides management controls', async () => {
  api.get.mockResolvedValue(page({ canManage: false }));
  render(<Classifications actorId={1} organizationId={7} />);
  expect(api.get).not.toHaveBeenCalled();
  await open();
  expect(screen.queryByLabelText('새 공통 분류 이름')).toBeNull();
  expect(screen.queryByRole('button', { name: '분류 편집' })).toBeNull();
  fireEvent.change(screen.getByLabelText('불러온 분류 검색'), { target: { value: '없는 이름' } });
  expect(screen.queryByRole('listitem')).toBeNull();
  expect(api.get).toHaveBeenCalledTimes(1);
});
it('creates and edits with verified actor/org fences and exact CAS, preserving draft on 409', async () => {
  render(<Classifications actorId={1} organizationId={7} />);
  await open();
  fireEvent.change(screen.getByLabelText('새 공통 분류 이름'), { target: { value: '  Ａ분류  ' } });
  api.post.mockImplementation(async (_url, body) => ({
    data: { actorId: 1, organizationId: 7, entry: { id: 5, name: body.name, active: true, version: 1 }, replayed: false },
  }));
  click('분류 만들기');
  await screen.findByText(/공통 분류를 만들었습니다/);
  expect(api.post.mock.lastCall?.[1]).toMatchObject({
    expectedActorId: 1,
    expectedOrganizationId: 7,
    name: 'A분류',
    requestId: expect.any(String),
  });
  const row = within(screen.getByRole('listitem', { name: '공통 분류 4' }));
  fireEvent.click(row.getByRole('button', { name: '분류 편집' }));
  fireEvent.change(row.getByLabelText('분류 이름'), { target: { value: '매출 새 이름' } });
  fireEvent.click(row.getByRole('checkbox', { name: '분류 활성' }));
  api.post.mockRejectedValueOnce({ response: { status: 409 } });
  fireEvent.click(row.getByRole('button', { name: '분류 변경 저장' }));
  await screen.findByText(/분류 기준이 변경/);
  expect((row.getByLabelText('분류 이름') as HTMLInputElement).value).toBe('매출 새 이름');
  expect(api.post.mock.lastCall).toEqual([
    '/enterprise/classifications/4',
    { expectedActorId: 1, expectedOrganizationId: 7, expectedVersion: 1, name: '매출 새 이름', active: false },
  ]);
});
it('freezes unknown create results across closing/reopening and retries the same UUID/body', async () => {
  render(<Classifications actorId={1} organizationId={7} />);
  await open();
  fireEvent.change(screen.getByLabelText('새 공통 분류 이름'), { target: { value: '분류 신규' } });
  api.post.mockResolvedValueOnce({ data: { unknown: true } });
  click('분류 만들기');
  await screen.findByRole('button', { name: '같은 생성 요청 확인' });
  const frozen = structuredClone(api.post.mock.lastCall?.[1]);
  click('공통 분류');
  click('공통 분류');
  expect((screen.getByLabelText('새 공통 분류 이름') as HTMLInputElement).disabled).toBe(true);
  api.post.mockImplementationOnce(async (_url, body) => ({
    data: { actorId: 1, organizationId: 7, entry: { ...entry, id: 6, name: body.name }, replayed: true },
  }));
  await waitFor(() =>
    expect((screen.getByRole('button', { name: '같은 생성 요청 확인' }) as HTMLButtonElement).disabled).toBe(false),
  );
  click('같은 생성 요청 확인');
  await screen.findByText(/이전에 접수한/);
  expect(api.post.mock.lastCall?.[1]).toEqual(frozen);
});
it('discards another actor/org or auth-generation pending state without replaying it', async () => {
  const { rerender } = render(<Classifications actorId={1} organizationId={7} />);
  await open();
  fireEvent.change(screen.getByLabelText('새 공통 분류 이름'), { target: { value: '비공개 초안' } });
  api.post.mockRejectedValueOnce(new Error('offline'));
  click('분류 만들기');
  await screen.findByRole('button', { name: '같은 생성 요청 확인' });
  rerender(<Classifications actorId={2} organizationId={8} />);
  expect(screen.queryByText('비공개 초안')).toBeNull();
  expect(screen.queryByRole('button', { name: '같은 생성 요청 확인' })).toBeNull();
  expect(api.post).toHaveBeenCalledTimes(1);
  api.get.mockResolvedValue(page({ actorId: 2, organizationId: 8 }));
  click('공통 분류');
  await screen.findByText(/현재 조직 8/);
  act(() => {
    api.epoch = 'session-2';
    window.dispatchEvent(new Event('storage'));
  });
  expect(screen.queryByText(/현재 조직 8/)).toBeNull();
});
it('paginates only loaded ranges and rejects a mismatched read context before showing entries', async () => {
  api.get
    .mockResolvedValueOnce(page({ nextAfterId: 4 }))
    .mockResolvedValueOnce(page({ entries: [{ ...entry, id: 9, name: '재고' }] }));
  render(<Classifications actorId={1} organizationId={7} />);
  await open();
  click('분류 더 불러오기');
  await screen.findByText(/재고 · ID 9/);
  expect(api.get.mock.lastCall).toEqual(['/enterprise/classifications', { afterId: 4 }]);
  api.get.mockResolvedValueOnce(page({ actorId: 2, organizationId: 8, entries: [{ ...entry, name: '다른 조직 비공개' }] }));
  click('분류 목록 다시 읽기');
  await screen.findByRole('alert');
  expect(screen.queryByText(/다른 조직 비공개/)).toBeNull();
});

it('persists before POST and reload restores only an explicit same-body confirmation after verified listing', async () => {
  const first = render(<Classifications actorId={1} organizationId={7} />);
  await open();
  fireEvent.change(screen.getByLabelText('새 공통 분류 이름'), { target: { value: 'reload 분류' } });
  api.post.mockImplementationOnce(async () => {
    expect(sessionStorage.length).toBe(1);
    throw { response: { status: 503 } };
  });
  click('분류 만들기');
  await screen.findByRole('button', { name: '같은 생성 요청 확인' });
  const frozen = structuredClone(api.post.mock.lastCall?.[1]);
  first.unmount();
  api.get.mockResolvedValue(page({ entries: [{ ...entry, id: 6, name: frozen.name }] }));
  render(<Classifications actorId={1} organizationId={7} />);
  expect(api.post).toHaveBeenCalledTimes(1);
  click('공통 분류');
  await screen.findByRole('button', { name: '같은 생성 요청 확인' });
  expect(api.post).toHaveBeenCalledTimes(1);
  api.post.mockImplementationOnce(async (_url, request) => ({
    data: { actorId: 1, organizationId: 7, entry: { ...entry, id: 6, name: request.name }, replayed: true },
  }));
  click('같은 생성 요청 확인');
  await screen.findByText(/이전에 접수한/);
  expect(api.post.mock.lastCall?.[1]).toEqual(frozen);
  expect(sessionStorage.length).toBe(0);
  expect(screen.getAllByRole('listitem', { name: '공통 분류 6' })).toHaveLength(1);
});
it('storage failure keeps an in-memory request with explicit warning; discard clears it', async () => {
  render(<Classifications actorId={1} organizationId={7} />);
  await open();
  const storage = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('blocked');
  });
  api.post.mockRejectedValueOnce(new Error('offline'));
  fireEvent.change(screen.getByLabelText('새 공통 분류 이름'), { target: { value: '메모리 보존' } });
  click('분류 만들기');
  await screen.findByText(/새로고침 후 복구할 수 없습니다/);
  expect(screen.getByRole('button', { name: '같은 생성 요청 확인' })).toBeTruthy();
  await waitFor(() =>
    expect((screen.getByRole('button', { name: '미확정 생성 요청 버리기' }) as HTMLButtonElement).disabled).toBe(false),
  );
  click('미확정 생성 요청 버리기');
  expect(screen.queryByRole('button', { name: '같은 생성 요청 확인' })).toBeNull();
  storage.mockRestore();
});
it('does not restore a pending request for a member and clears a definitive 409 without dropping the name', async () => {
  const first = render(<Classifications actorId={1} organizationId={7} />);
  await open();
  fireEvent.change(screen.getByLabelText('새 공통 분류 이름'), { target: { value: '보존할 이름' } });
  api.post.mockRejectedValueOnce(new Error('offline'));
  click('분류 만들기');
  await screen.findByRole('button', { name: '같은 생성 요청 확인' });
  first.unmount();
  api.get.mockResolvedValue(page({ canManage: false }));
  const member = render(<Classifications actorId={1} organizationId={7} />);
  await open();
  expect(screen.queryByRole('button', { name: '같은 생성 요청 확인' })).toBeNull();
  expect(api.post).toHaveBeenCalledTimes(1);
  member.unmount();
  api.get.mockResolvedValue(page());
  render(<Classifications actorId={1} organizationId={7} />);
  await open();
  api.post.mockRejectedValueOnce({ response: { status: 409 } });
  click('같은 생성 요청 확인');
  await screen.findByText(/분류 기준이 변경/);
  expect(sessionStorage.length).toBe(0);
  expect((screen.getByLabelText('새 공통 분류 이름') as HTMLInputElement).value).toBe('보존할 이름');
});
it('warns on unavailable restore reads and permits creation only after a successful reread', async () => {
  const read = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('blocked');
  });
  render(<Classifications actorId={1} organizationId={7} />);
  await open();
  await screen.findByText(/탭 복구 기록을 읽지 못했습니다/);
  fireEvent.change(screen.getByLabelText('새 공통 분류 이름'), { target: { value: '보존 이름' } });
  expect((screen.getByRole('button', { name: '분류 만들기' }) as HTMLButtonElement).disabled).toBe(true);
  expect(api.post).not.toHaveBeenCalled();
  read.mockRestore();
  click('분류 목록 다시 읽기');
  await waitFor(() =>
    expect((screen.getByRole('button', { name: '분류 만들기' }) as HTMLButtonElement).disabled).toBe(false),
  );
  expect((screen.getByLabelText('새 공통 분류 이름') as HTMLInputElement).value).toBe('보존 이름');
});
it('keeps pending request when explicit discard fails, then warns after confirmed result cleanup fails', async () => {
  render(<Classifications actorId={1} organizationId={7} />);
  await open();
  api.post.mockRejectedValueOnce(new Error('offline'));
  fireEvent.change(screen.getByLabelText('새 공통 분류 이름'), { target: { value: '미확정 이름' } });
  click('분류 만들기');
  await screen.findByRole('button', { name: '같은 생성 요청 확인' });
  await waitFor(() =>
    expect((screen.getByRole('button', { name: '미확정 생성 요청 버리기' }) as HTMLButtonElement).disabled).toBe(false),
  );
  const frozen = structuredClone(api.post.mock.lastCall?.[1]);
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
    throw new Error('blocked');
  });
  click('미확정 생성 요청 버리기');
  await screen.findByText(/탭 복구 기록을 지우지 못했습니다/);
  expect(screen.getByRole('button', { name: '같은 생성 요청 확인' })).toBeTruthy();
  expect(sessionStorage.length).toBe(1);
  api.post.mockResolvedValueOnce({
    data: { actorId: 1, organizationId: 7, entry: { ...entry, id: 6, name: frozen.name }, replayed: true },
  });
  click('같은 생성 요청 확인');
  await screen.findByText(/이전에 접수한/);
  expect(api.post.mock.lastCall?.[1]).toEqual(frozen);
  expect(screen.queryByRole('button', { name: '같은 생성 요청 확인' })).toBeNull();
  expect(screen.getByText(/탭 복구 기록을 지우지 못했습니다/)).toBeTruthy();
  expect(sessionStorage.length).toBe(1);
});
it('never inserts an off-page historical replay and reads renamed inactive state only from the current list', async () => {
  api.get.mockResolvedValueOnce(page({ nextAfterId: 4 }));
  render(<Classifications actorId={1} organizationId={7} />);
  await open();
  fireEvent.change(screen.getByLabelText('새 공통 분류 이름'), { target: { value: '과거 이름' } });
  api.post.mockRejectedValueOnce(new Error('offline'));
  click('분류 만들기');
  await screen.findByRole('button', { name: '같은 생성 요청 확인' });
  await waitFor(() =>
    expect((screen.getByRole('button', { name: '같은 생성 요청 확인' }) as HTMLButtonElement).disabled).toBe(false),
  );
  api.post.mockResolvedValueOnce({
    data: { actorId: 1, organizationId: 7, entry: { id: 9, name: '과거 이름', version: 1, active: true }, replayed: true },
  });
  click('같은 생성 요청 확인');
  await screen.findByText(/과거 생성 영수증/);
  expect(screen.getByText(/생성 #9/)).toBeTruthy();
  expect(screen.queryByRole('listitem', { name: '공통 분류 9' })).toBeNull();
  api.get.mockResolvedValueOnce(page({ entries: [{ id: 9, name: '변경 이름', version: 3, active: false }] }));
  click('분류 더 불러오기');
  await screen.findByText(/변경 이름 · ID 9 · 버전 3 · 비활성/);
  expect(screen.getAllByRole('listitem')).toHaveLength(2);
});
it('does not replace an already loaded current entry with its historical creation receipt', async () => {
  api.get.mockResolvedValueOnce(page({ entries: [{ ...entry, name: '최신 이름', active: false, version: 3 }] }));
  render(<Classifications actorId={1} organizationId={7} />);
  click('공통 분류');
  await screen.findByText(/최신 이름 · ID 4/);
  fireEvent.change(screen.getByLabelText('새 공통 분류 이름'), { target: { value: '매출' } });
  api.post.mockResolvedValueOnce({ data: { actorId: 1, organizationId: 7, entry, replayed: true } });
  click('분류 만들기');
  await screen.findByText(/과거 생성 영수증/);
  expect(screen.getByText(/최신 이름 · ID 4 · 버전 3 · 비활성/)).toBeTruthy();
});
it('leaves a paginated range unchanged after fresh create and loads the new row once in sorted order', async () => {
  api.get.mockResolvedValueOnce(page({ nextAfterId: 4 }));
  render(<Classifications actorId={1} organizationId={7} />);
  await open();
  fireEvent.change(screen.getByLabelText('새 공통 분류 이름'), { target: { value: '새 분류' } });
  api.post.mockResolvedValueOnce({
    data: { actorId: 1, organizationId: 7, entry: { id: 10, name: '새 분류', active: true, version: 1 }, replayed: false },
  });
  click('분류 만들기');
  await screen.findByText(/다음 페이지를 더 불러오거나/);
  expect(screen.queryByRole('listitem', { name: '공통 분류 10' })).toBeNull();
  api.get.mockResolvedValueOnce(
    page({
      entries: [
        { ...entry, id: 7 },
        { id: 10, name: '새 분류', active: true, version: 1 },
      ],
    }),
  );
  click('분류 더 불러오기');
  await screen.findByRole('listitem', { name: '공통 분류 10' });
  expect(api.get.mock.lastCall).toEqual(['/enterprise/classifications', { afterId: 4 }]);
  expect(screen.getAllByRole('listitem').map(row => row.getAttribute('aria-label'))).toEqual([
    '공통 분류 4',
    '공통 분류 7',
    '공통 분류 10',
  ]);
});
