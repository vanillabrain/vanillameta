import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import HandoverProposal from './HandoverProposal';
import Enterprise from './index';
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), del: vi.fn() }));
vi.mock('@/helpers/apiHelper', () => api);
const uuid = '12345678-1234-4234-8234-123456789012';
const otherUuid = '22345678-1234-4234-8234-123456789012';
const basis = 'b'.repeat(64);
const asset = (id = 11, kind: 'source' | 'dashboard' = 'source') => ({ kind, id, title: `Literal <b>asset-${id}</b>` });
const proposal = (change = {}) => ({
  requestId: uuid,
  organizationId: 7,
  ownerId: 42,
  recipientId: 43,
  version: 1,
  status: 'pending',
  expiresAt: '2026-10-20T12:00:00Z',
  acceptedAt: null,
  reviewBasis: basis,
  assets: [asset()],
  expired: false,
  detailsAvailable: true,
  ...change,
});
const context = (actor = 42, version = 3, org = 7, role: 'member' | 'admin' = 'member') => ({
  organization: { id: org, name: 'Example', version },
  membership: { userId: actor, team: 'Ops', role },
});
const open = () => fireEvent.click(screen.getByRole('button', { name: '업무 자료 인계 열기' }));
const input = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }));
const disclose = () => fireEvent.click(screen.getByRole('checkbox', { name: /정확한 제목·번호/ }));
const agree = () => fireEvent.click(screen.getByRole('checkbox', { name: /위 고정 목록/ }));
const review = async () => {
  input('조회할 요청 번호', uuid);
  click('요청 상태·고정 목록 검토');
  await screen.findByRole('list', { name: '검토한 고정 자료' });
};
const select = async () => {
  click('본인 후보 불러오기');
  fireEvent.click(await screen.findByRole('checkbox', { name: /소스 #11/ }));
  input('수신자 직원 번호', '43');
  disclose();
};
const deferred = () => {
  let resolve: (v: { data: unknown }) => void;
  let reject: (v: unknown) => void;
  const promise = new Promise<{ data: unknown }>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve: (data: unknown) => resolve({ data }), reject: (error: unknown) => reject(error) };
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal('crypto', { randomUUID: vi.fn(() => uuid) });
  api.get.mockImplementation((url: string) =>
    Promise.resolve({ data: url.endsWith('/candidates') ? { entries: [asset()], nextAfterId: null } : proposal() }),
  );
  api.post.mockResolvedValue({ data: proposal() });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it('offers ordinary members a folded panel without requests on opening or editing fields; helpers stay outside rows', () => {
  render(<HandoverProposal context={context()} />);
  expect(api.get).not.toHaveBeenCalled();
  open();
  input('선택할 자료 유형', 'dashboard');
  input('수신자 직원 번호', '43');
  input('조회할 요청 번호', uuid);
  expect(api.get).not.toHaveBeenCalled();
  expect(api.post).not.toHaveBeenCalled();
  const hint = screen.getByText(/같은 조직의 다른 활성 직원/);
  expect(screen.getByLabelText('수신자 직원 번호').getAttribute('aria-describedby')).toBe(hint.id);
  expect(screen.getByText('인계 의향의 범위와 한계').closest('details').open).toBe(false);
});
it('creates only explicitly consented exact title/id selections with a client UUID; write response alone cannot authorize cancellation', async () => {
  render(<HandoverProposal context={context()} />);
  open();
  await select();
  click('인계 의향 요청 저장');
  await screen.findByText(/의향 수락 대기.*조직 #7/);
  expect(api.post).toHaveBeenCalledExactlyOnceWith('/enterprise/handover', {
    requestId: uuid,
    recipientId: 43,
    assets: [asset()],
  });
  expect(screen.getByRole('button', { name: '인계 의향 철회' })).toHaveProperty('disabled', true);
  expect(screen.getByText(/요청 번호.*12345678/)).toBeTruthy();
  expect(screen.getByRole('list', { name: '공개할 제목과 번호' }).querySelector('b')).toBeNull();
  click('요청 상태·고정 목록 검토');
  await waitFor(() => expect(screen.getByRole('checkbox', { name: /위 고정 목록/ })).toHaveProperty('disabled', false));
  agree();
  expect(screen.getByRole('button', { name: '인계 의향 철회' })).toHaveProperty('disabled', false);
});
it('enforces a twenty-item selection across explicit cursor pages and clears confirmation on selection/type changes', async () => {
  api.get
    .mockResolvedValueOnce({ data: { entries: Array.from({ length: 20 }, (_, i) => asset(i + 1)), nextAfterId: 20 } })
    .mockResolvedValueOnce({ data: { entries: [asset(21)], nextAfterId: null } });
  render(<HandoverProposal context={context()} />);
  open();
  click('본인 후보 불러오기');
  await screen.findByRole('checkbox', { name: /소스 #20 / });
  for (const box of screen.getAllByRole('checkbox').filter(box => box.closest('li'))) fireEvent.click(box);
  expect(screen.getByText('선택 20/20개')).toBeTruthy();
  input('수신자 직원 번호', '43');
  disclose();
  click('다음 20개');
  expect(await screen.findByRole('checkbox', { name: /소스 #21 / })).toHaveProperty('disabled', true);
  expect(api.get).toHaveBeenLastCalledWith(
    '/enterprise/handover/candidates',
    { kind: 'source', afterId: 20 },
    expect.anything(),
  );
  expect(screen.getByRole('checkbox', { name: /정확한 제목·번호/ })).toHaveProperty('checked', false);
  input('선택할 자료 유형', 'dashboard');
  expect(screen.queryByRole('checkbox', { name: /소스 #21 / })).toBeNull();
  expect(api.get).toHaveBeenCalledTimes(2);
});
it.each([new Error('offline'), { response: { status: 503 } }])(
  'keeps UUID/full payload after a truly unknown create outcome, checks state, and explicitly retries only the same UUID',
  async failure => {
    api.post.mockRejectedValueOnce(failure).mockResolvedValueOnce({ data: proposal() });
    render(<HandoverProposal context={context()} />);
    open();
    await select();
    click('인계 의향 요청 저장');
    await screen.findByRole('alert');
    const original = api.post.mock.calls[0][1];
    expect(screen.getByLabelText('수신자 직원 번호')).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: '같은 요청 번호로 요청 저장 재시도' })).toHaveProperty('disabled', true);
    click('업무 자료 인계 접기');
    open();
    expect(api.post).toHaveBeenCalledOnce();
    expect(api.get).toHaveBeenCalledOnce();
    expect(screen.getByRole('list', { name: '공개할 제목과 번호' }).textContent).toContain(asset().title);
    api.get.mockRejectedValueOnce({ response: { status: 404 } });
    click('같은 요청 번호 상태 확인');
    await screen.findByText(/기록을 찾지 못했습니다/);
    await waitFor(() =>
      expect(screen.getByRole('checkbox', { name: /정확한 제목·번호/ })).toHaveProperty('disabled', false),
    );
    disclose();
    click('같은 요청 번호로 요청 저장 재시도');
    await screen.findByText(/의향 수락 대기.*조직 #7/);
    expect(api.post.mock.calls[1][1]).toEqual(original);
    expect(crypto.randomUUID).toHaveBeenCalledOnce();
  },
);
it('requires a new successful state check after a failed retry check; no automatic UUID or post', async () => {
  api.post.mockRejectedValue(new Error('lost'));
  render(<HandoverProposal context={context()} />);
  open();
  await select();
  click('인계 의향 요청 저장');
  await screen.findByRole('alert');
  await waitFor(() =>
    expect(screen.getByRole('button', { name: '같은 요청 번호 상태 확인' })).toHaveProperty('disabled', false),
  );
  api.get.mockRejectedValueOnce({ response: { status: 404 } });
  click('같은 요청 번호 상태 확인');
  await screen.findByText(/기록을 찾지 못했습니다/);
  await waitFor(() =>
    expect(screen.getByRole('button', { name: '같은 요청 번호 상태 확인' })).toHaveProperty('disabled', false),
  );
  api.get.mockRejectedValueOnce(new Error('offline'));
  click('같은 요청 번호 상태 확인');
  await waitFor(() =>
    expect(screen.getByRole('button', { name: '같은 요청 번호 상태 확인' })).toHaveProperty('disabled', false),
  );
  expect(screen.getByRole('checkbox', { name: /정확한 제목·번호/ })).toHaveProperty('disabled', true);
  expect(api.post).toHaveBeenCalledOnce();
});
it('reconciles lost-create replay to a hidden cancelled receipt without leaking old selected titles or making another write', async () => {
  api.post.mockRejectedValue(new Error('lost'));
  render(<HandoverProposal context={context()} />);
  open();
  await select();
  click('인계 의향 요청 저장');
  await screen.findByRole('alert');
  await waitFor(() =>
    expect(screen.getByRole('button', { name: '같은 요청 번호 상태 확인' })).toHaveProperty('disabled', false),
  );
  api.get.mockResolvedValueOnce({
    data: proposal({ status: 'cancelled', version: 3, detailsAvailable: false, assets: [] }),
  });
  click('같은 요청 번호 상태 확인');
  await screen.findByText(/자료 공개가 종료되어/);
  expect(screen.queryByText(/Literal <b>asset-11/)).toBeNull();
  expect(screen.getByText(/의향 철회 기록.*조직 #7/)).toBeTruthy();
  expect(api.post).toHaveBeenCalledOnce();
});
it('recipient must explicitly review and confirm; posts captured version/basis and reports current cancelled acceptance replay', async () => {
  render(<HandoverProposal context={context(43)} />);
  open();
  await review();
  expect(screen.queryByRole('button', { name: '인계 의향 철회' })).toBeNull();
  expect(screen.getByText(/같은 번호로 현재 기록을 다시 확인할 수 있습니다/)).toBeTruthy();
  expect(screen.queryByText(/수신자에게 기존 채널로 직접 전달하세요/)).toBeNull();
  expect(screen.getByRole('button', { name: '인계 의향 수락' })).toHaveProperty('disabled', true);
  agree();
  input('조회할 요청 번호', otherUuid);
  expect(screen.queryByRole('list', { name: '검토한 고정 자료' })).toBeNull();
  await review();
  agree();
  api.post.mockResolvedValue({
    data: proposal({
      status: 'cancelled',
      version: 3,
      acceptedAt: '2026-10-19T12:00:00Z',
      detailsAvailable: false,
      assets: [],
    }),
  });
  click('인계 의향 수락');
  await screen.findByText(/의향 철회 기록.*조직 #7/);
  expect(api.post).toHaveBeenCalledExactlyOnceWith(`/enterprise/handover/${uuid}/accept`, {
    expectedVersion: 1,
    reviewBasis: basis,
  });
  expect(screen.queryByRole('button', { name: '인계 의향 수락' })).toBeNull();
  expect(screen.queryByText(/의향 수락 기록.*조직/)).toBeNull();
  expect(screen.getByText(/과거 수락 시각/)).toBeTruthy();
});
it('owner can explicitly cancel an expired hidden proposal without receiving titles', async () => {
  api.get.mockResolvedValue({ data: proposal({ expired: true, detailsAvailable: false, assets: [] }) });
  render(<HandoverProposal context={context()} />);
  open();
  await review();
  agree();
  api.post.mockResolvedValue({
    data: proposal({ status: 'cancelled', version: 2, expired: true, detailsAvailable: false, assets: [] }),
  });
  click('인계 의향 철회');
  await screen.findByText(/의향 철회 기록.*조직/);
  expect(api.post).toHaveBeenCalledWith(`/enterprise/handover/${uuid}/cancel`, { expectedVersion: 1, reviewBasis: basis });
});
it('invalidates late candidate reads after kind change and closes without publishing a late create response', async () => {
  const old = deferred();
  api.get.mockReturnValueOnce(old.promise);
  render(<HandoverProposal context={context()} />);
  open();
  click('본인 후보 불러오기');
  input('선택할 자료 유형', 'dashboard');
  await act(async () => old.resolve({ entries: [asset()], nextAfterId: null }));
  expect(screen.queryByRole('checkbox', { name: /소스 #11/ })).toBeNull();
  input('선택할 자료 유형', 'source');
  await select();
  const writing = deferred();
  api.post.mockReturnValueOnce(writing.promise);
  click('인계 의향 요청 저장');
  click('업무 자료 인계 접기');
  await act(async () => writing.resolve(proposal()));
  open();
  expect(screen.queryByRole('list', { name: '검토한 고정 자료' })).toBeNull();
  expect(screen.getByRole('button', { name: '같은 요청 번호 상태 확인' })).toBeTruthy();
  expect(screen.getByLabelText('조회할 요청 번호')).toHaveProperty('value', uuid);
});
it('discards foreign/malformed replies, role/scope changes, unmounts and late UUID reads', async () => {
  const old = deferred();
  api.get.mockReturnValueOnce(old.promise);
  const view = render(<HandoverProposal context={context()} />);
  open();
  input('조회할 요청 번호', uuid);
  click('요청 상태·고정 목록 검토');
  input('조회할 요청 번호', otherUuid);
  await act(async () => old.resolve(proposal()));
  expect(screen.queryByRole('list', { name: '검토한 고정 자료' })).toBeNull();
  api.get.mockResolvedValue({ data: proposal({ organizationId: 8 }) });
  input('조회할 요청 번호', uuid);
  click('요청 상태·고정 목록 검토');
  await screen.findByRole('alert');
  const later = deferred();
  api.get.mockReturnValueOnce(later.promise);
  click('요청 상태·고정 목록 검토');
  view.rerender(<HandoverProposal context={context(42, 4)} />);
  await act(async () => later.resolve(proposal()));
  open();
  expect(screen.queryByRole('list', { name: '검토한 고정 자료' })).toBeNull();
  expect(api.post).not.toHaveBeenCalled();
  view.rerender(<HandoverProposal context={context(99, 4, 8, 'admin')} />);
  open();
  input('조회할 요청 번호', uuid);
  const leaving = deferred();
  api.get.mockReturnValueOnce(leaving.promise);
  click('요청 상태·고정 목록 검토');
  view.unmount();
  await act(async () => leaving.resolve(proposal()));
  expect(api.post).not.toHaveBeenCalled();
});
it('integrates the panel for ordinary members without fetching candidates or request records', async () => {
  api.get.mockResolvedValue({ data: context() });
  render(<Enterprise />);
  await screen.findByRole('button', { name: '업무 자료 인계 열기' });
  open();
  expect(api.get.mock.calls.every(call => call[0] === '/enterprise/context')).toBe(true);
  expect(api.post).not.toHaveBeenCalled();
});
it('distinguishes definite title-conflict rejection and allows explicit candidate reselect/new UUID without a frozen-payload dead end', async () => {
  api.post.mockRejectedValueOnce({ response: { status: 409 } });
  render(<HandoverProposal context={context()} />);
  open();
  await select();
  click('인계 의향 요청 저장');
  await screen.findByText(/저장이 거절되어 반영되지 않았습니다/);
  expect(screen.getByLabelText('수신자 직원 번호')).toHaveProperty('disabled', false);
  expect(screen.queryByRole('button', { name: '같은 요청 번호 상태 확인' })).toBeNull();
  expect(screen.getByLabelText('조회할 요청 번호')).toHaveProperty('value', uuid);
  api.get.mockResolvedValueOnce({ data: { entries: [{ ...asset(), title: 'Renamed candidate' }], nextAfterId: null } });
  click('본인 후보 불러오기');
  const box = await screen.findByRole('checkbox', { name: /Renamed candidate/ });
  fireEvent.click(box);
  fireEvent.click(box);
  disclose();
  vi.mocked(crypto.randomUUID).mockReturnValueOnce(otherUuid);
  api.post.mockResolvedValueOnce({
    data: proposal({ requestId: otherUuid, assets: [{ ...asset(), title: 'Renamed candidate' }] }),
  });
  expect(api.post).toHaveBeenCalledOnce();
  click('수정한 초안으로 새 요청 저장');
  await screen.findByText(/의향 수락 대기.*조직 #7/);
  expect(api.post).toHaveBeenLastCalledWith('/enterprise/handover', {
    requestId: otherUuid,
    recipientId: 43,
    assets: [{ ...asset(), title: 'Renamed candidate' }],
  });
});
it('treats malformed successful create receipts as unknown and preserves full-title payload/UUID until state lookup', async () => {
  api.post.mockResolvedValueOnce({ data: { ...proposal(), payloadHash: basis } });
  render(<HandoverProposal context={context()} />);
  open();
  await select();
  click('인계 의향 요청 저장');
  await waitFor(() =>
    expect(screen.getByRole('button', { name: '같은 요청 번호 상태 확인' })).toHaveProperty('disabled', false),
  );
  expect(screen.getByLabelText('수신자 직원 번호')).toHaveProperty('disabled', true);
  expect(screen.getByRole('button', { name: '같은 요청 번호로 요청 저장 재시도' })).toHaveProperty('disabled', true);
  expect(api.post.mock.calls[0][1].assets).toEqual([asset()]);
  api.get.mockResolvedValueOnce({
    data: proposal({
      status: 'accepted',
      version: 2,
      expired: true,
      acceptedAt: '2026-10-19T12:00:00Z',
      detailsAvailable: false,
      assets: [],
    }),
  });
  click('같은 요청 번호 상태 확인');
  await screen.findByText(/자료 공개가 종료되어/);
  expect(screen.queryByText(/Literal <b>asset-11/)).toBeNull();
  expect(api.post).toHaveBeenCalledOnce();
});
it('recovers an uncertain recipient decision by explicit status read with no silent repeated acceptance', async () => {
  render(<HandoverProposal context={context(43)} />);
  open();
  await review();
  agree();
  api.post.mockRejectedValueOnce({ response: { status: 503 } });
  click('인계 의향 수락');
  await waitFor(() =>
    expect(screen.getByRole('button', { name: '같은 요청 번호 상태 확인' })).toHaveProperty('disabled', false),
  );
  expect(screen.queryByRole('button', { name: '인계 의향 수락' })).toBeNull();
  api.get.mockResolvedValueOnce({ data: proposal({ status: 'accepted', version: 2, acceptedAt: '2026-10-19T12:00:00Z' }) });
  click('같은 요청 번호 상태 확인');
  await screen.findByText(/의향 수락 기록.*조직/);
  expect(api.post).toHaveBeenCalledOnce();
  expect(screen.getByRole('button', { name: '인계 의향 수락' })).toHaveProperty('disabled', true);
});
it.each([409, 503, 'network'])(
  'does not advertise an unconfirmed UUID for delivery after create failure %s; explicit verified read enables the instruction',
  async failure => {
    api.post.mockRejectedValueOnce(typeof failure === 'number' ? { response: { status: failure } } : new Error('lost'));
    render(<HandoverProposal context={context()} />);
    open();
    await select();
    click('인계 의향 요청 저장');
    if (failure === 409) await screen.findByText(/저장이 거절되어 반영되지 않았습니다/);
    else
      await waitFor(() =>
        expect(screen.getByRole('button', { name: '같은 요청 번호 상태 확인' })).toHaveProperty('disabled', false),
      );
    expect(screen.getByText(/저장 여부를 확인할 요청 번호.*수신자에게 전달하기 전 현재 기록을 확인하세요/)).toBeTruthy();
    expect(screen.queryByText(/수신자에게 기존 채널로 직접 전달하세요/)).toBeNull();
    expect(screen.getByRole('list', { name: '공개할 제목과 번호' }).textContent).toContain(asset().title);
    click(failure === 409 ? '요청 상태·고정 목록 검토' : '같은 요청 번호 상태 확인');
    await screen.findByText(/요청 번호.*수신자에게 기존 채널로 직접 전달하세요/);
    expect(screen.queryByText(/저장 여부를 확인할 요청 번호/)).toBeNull();
    expect(api.post).toHaveBeenCalledOnce();
  },
);
it('clears definite decision 409 uncertainty while preserving UUID and requires explicit GET/new consent before retry', async () => {
  render(<HandoverProposal context={context(43)} />);
  open();
  await review();
  agree();
  api.post.mockRejectedValueOnce({ response: { status: 409 } });
  click('인계 의향 수락');
  await screen.findByText(/의향 변경이 거절되어 반영되지 않았습니다/);
  expect(screen.queryByText(/저장 결과 확인이 필요합니다/)).toBeNull();
  expect(screen.getByLabelText('조회할 요청 번호')).toHaveProperty('value', uuid);
  expect(screen.getByLabelText('조회할 요청 번호')).toHaveProperty('disabled', false);
  expect(screen.queryByRole('list', { name: '검토한 고정 자료' })).toBeNull();
  expect(screen.queryByRole('button', { name: '인계 의향 수락' })).toBeNull();
  expect(screen.getByText(/저장 여부를 확인할 요청 번호/)).toBeTruthy();
  expect(api.post).toHaveBeenCalledExactlyOnceWith(`/enterprise/handover/${uuid}/accept`, {
    expectedVersion: 1,
    reviewBasis: basis,
  });
  click('요청 상태·고정 목록 검토');
  await screen.findByRole('list', { name: '검토한 고정 자료' });
  expect(screen.getByRole('checkbox', { name: /위 고정 목록/ })).toHaveProperty('checked', false);
  expect(screen.getByRole('button', { name: '인계 의향 수락' })).toHaveProperty('disabled', true);
  expect(api.post).toHaveBeenCalledOnce();
  agree();
  api.post.mockResolvedValueOnce({ data: proposal({ status: 'accepted', version: 2, acceptedAt: '2026-10-19T12:00:00Z' }) });
  click('인계 의향 수락');
  await screen.findByText(/의향 수락 기록.*조직/);
  expect(api.post).toHaveBeenCalledTimes(2);
});
it('keeps parent proposal, request number, candidates and selection when an explicit dependency review fails', async () => {
  const accepted = proposal({ status: 'accepted', version: 2, acceptedAt: '2026-10-19T12:00:00Z' });
  const dependencies = {
    requestId: uuid,
    organizationId: 7,
    ownerId: 42,
    recipientId: 43,
    proposalVersion: 2,
    checkedAt: '2026-10-19T13:00:00Z',
    scope: 'selected_dependencies_v1',
    executionAvailable: false,
    assets: [
      {
        ...asset(),
        dependencyStatus: 'covered',
        requiredSources: 1,
        selectedSources: 1,
        missingOwnedSources: 0,
        otherSources: 0,
        metricCount: 2,
        storage: 'file_review_required',
      },
    ],
  };
  api.get.mockImplementation((url: string) =>
    url.endsWith('/dependencies')
      ? Promise.reject({ response: { status: 409 } })
      : Promise.resolve({ data: url.endsWith('/candidates') ? { entries: [asset()], nextAfterId: null } : accepted }),
  );
  render(<HandoverProposal context={context()} />);
  open();
  await select();
  await review();
  expect(api.get).toHaveBeenCalledTimes(2);
  click('연결 자료·보관 조건 확인 열기');
  expect(api.get).toHaveBeenCalledTimes(2);
  click('연결 자료·보관 조건 조회');
  await screen.findByRole('alert');
  expect(screen.getByLabelText('조회할 요청 번호')).toHaveProperty('value', uuid);
  expect(screen.getByRole('list', { name: '검토한 고정 자료' })).toBeTruthy();
  expect(screen.getByRole('list', { name: '공개할 제목과 번호' }).textContent).toContain(asset().title);
  expect(screen.getByRole('checkbox', { name: /소스 #11/ })).toHaveProperty('checked', true);
  expect(screen.queryByRole('list', { name: '선택 자료별 연결·보관 검토' })).toBeNull();
  expect(api.post).not.toHaveBeenCalled();
  api.get.mockResolvedValueOnce({ data: dependencies });
  click('연결 자료·보관 조건 조회');
  await screen.findByRole('list', { name: '선택 자료별 연결·보관 검토' });
  click('요청 상태·고정 목록 검토');
  await screen.findByRole('button', { name: '연결 자료·보관 조건 확인 열기' });
  expect(screen.queryByRole('list', { name: '선택 자료별 연결·보관 검토' })).toBeNull();
  expect(api.get.mock.calls.filter(call => call[0].endsWith('/dependencies'))).toHaveLength(2);
  expect(api.post).not.toHaveBeenCalled();
});
it.each([
  { actor: 42, change: {} },
  { actor: 43, change: { status: 'accepted', version: 2, acceptedAt: '2026-10-19T12:00:00Z' } },
  {
    actor: 42,
    change: { status: 'accepted', version: 2, acceptedAt: '2026-10-19T12:00:00Z', detailsAvailable: false, assets: [] },
  },
  {
    actor: 42,
    change: {
      status: 'accepted',
      version: 2,
      acceptedAt: '2026-10-19T12:00:00Z',
      expired: true,
      detailsAvailable: false,
      assets: [],
    },
  },
])('withholds dependency information from pending/recipient/ended-disclosure contexts %j', async ({ actor, change }) => {
  api.get.mockResolvedValue({ data: proposal(change) });
  render(<HandoverProposal context={context(actor)} />);
  open();
  await review();
  expect(screen.queryByRole('region', { name: '인계 전 연결 자료·보관 조건' })).toBeNull();
  expect(api.get).toHaveBeenCalledOnce();
  expect(api.post).not.toHaveBeenCalled();
});
it.each([42, 43])(
  'integrates separate folded final transfer for party %i without automatic calls or changing intent consent',
  async actor => {
    api.get.mockResolvedValue({
      data: proposal({
        status: 'accepted',
        version: 2,
        acceptedAt: '2026-10-19T12:00:00Z',
        assets: [asset(21, 'dashboard')],
      }),
    });
    render(<HandoverProposal context={context(actor)} />);
    open();
    await review();
    expect(screen.getByRole('button', { name: '최종 대시보드 인계 열기' })).toBeTruthy();
    click('최종 대시보드 인계 열기');
    expect(api.get).toHaveBeenCalledTimes(1);
    expect(api.post).not.toHaveBeenCalled();
    expect(screen.getByRole('checkbox', { name: /위 고정 목록/ })).toHaveProperty('checked', false);
    expect(screen.queryByRole('button', { name: '최종 인계 수락' })).toBeNull();
    click('업무 자료 인계 접기');
    expect(screen.queryByRole('region', { name: '최종 대시보드 인계' })).toBeNull();
  },
);
it('final review failure preserves parent request/fixed list; parent explicit re-read remounts folded final child', async () => {
  const accepted = proposal({
    status: 'accepted',
    version: 2,
    acceptedAt: '2026-10-19T12:00:00Z',
    assets: [asset(21, 'dashboard')],
  });
  api.get.mockResolvedValue({ data: accepted });
  render(<HandoverProposal context={context()} />);
  open();
  await review();
  click('최종 대시보드 인계 열기');
  api.get.mockRejectedValueOnce({ response: { status: 409 } });
  click('최종 이전 조건 검토');
  await waitFor(() => expect(screen.queryByText('최종 인계 확인 중…')).toBeNull());
  expect(screen.getByLabelText('조회할 요청 번호')).toHaveProperty('value', uuid);
  expect(screen.getByRole('list', { name: '검토한 고정 자료' }).textContent).toContain(asset(21, 'dashboard').title);
  expect(api.post).not.toHaveBeenCalled();
  click('요청 상태·고정 목록 검토');
  await screen.findByRole('button', { name: '최종 대시보드 인계 열기' });
  expect(screen.queryByRole('button', { name: '최종 요청 상태 조회' })).toBeNull();
  expect(api.post).not.toHaveBeenCalled();
});
