import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import HandoverFinalTransfer from './HandoverFinalTransfer';
import { HandoverProposal } from '@/api/handoverService';
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('@/helpers/apiHelper', () => api);
vi.mock('@/helpers/editorDraftStorage', () => ({ editorDraftSessionEpoch: () => 'session' }));
const proposalId = '12345678-1234-4234-8234-123456789012',
  requestId = '22345678-1234-4234-8234-123456789012';
const scope = { organizationId: 7, actorId: 42 };
const proposal = (): HandoverProposal => ({
  requestId: proposalId,
  organizationId: 7,
  ownerId: 42,
  recipientId: 43,
  version: 2,
  status: 'accepted',
  expiresAt: '2099-01-01T00:00:00Z',
  acceptedAt: '2026-10-19T00:00:00Z',
  reviewBasis: 'a'.repeat(64),
  expired: false,
  detailsAvailable: true,
  assets: [{ kind: 'dashboard', id: 11, title: '<b>Private</b>' }],
});
const report = () => ({
  proposalId,
  organizationId: 7,
  ownerId: 42,
  recipientId: 43,
  proposalVersion: 2,
  checkedAt: '2026-10-19T00:00:00Z',
  basis: 'opaque-basis',
  eligible: true,
  blockers: [],
  dashboards: [{ id: 11, title: '<b>Private</b>' }],
});
const receipt = (change = {}) => ({
  proposalId,
  requestId,
  organizationId: 7,
  ownerId: 42,
  recipientId: 43,
  version: 1,
  status: 'prepared',
  reviewBasis: 'opaque-review',
  expiresAt: '2099-01-01T00:00:00Z',
  acceptedAt: null,
  completedAt: null,
  detailsAvailable: true,
  dashboards: report().dashboards,
  replayed: false,
  ...change,
});
const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }));
const open = () => click('최종 대시보드 인계 열기');
const agree = () => fireEvent.click(screen.getByRole('checkbox', { name: /목록·당사자/ }));
const renderOwner = () => render(<HandoverFinalTransfer review={proposal()} scope={scope} organizationVersion={3} />);
const conditions = async () => {
  click('최종 이전 조건 검토');
  await screen.findByText(/현재 지원 범위에서 준비 가능/);
};
const load = async () => {
  click('최종 요청 상태 조회');
  await screen.findByRole('list', { name: '최종 인계 대시보드' });
};
beforeEach(() => {
  vi.resetAllMocks();
  sessionStorage.clear();
  vi.spyOn(crypto, 'randomUUID').mockReturnValue(requestId);
  api.get.mockResolvedValue({ data: report() });
  api.post.mockResolvedValue({ data: receipt() });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it('is folded, allows both ordinary parties, opening never reads/writes, and shows separate final consent', () => {
  const view = renderOwner();
  expect(api.get).not.toHaveBeenCalled();
  open();
  expect(api.get).not.toHaveBeenCalled();
  expect(api.post).not.toHaveBeenCalled();
  expect(screen.getByText(/기존 제목 공개 의향과 별도의 최종 동의/)).toBeTruthy();
  expect(screen.getByText('이전 효과와 제외 범위').closest('details').open).toBe(false);
  view.rerender(<HandoverFinalTransfer review={proposal()} scope={{ ...scope, actorId: 43 }} organizationVersion={3} />);
  open();
  expect(screen.queryByRole('button', { name: '최종 이전 조건 검토' })).toBeNull();
  expect(screen.getByRole('button', { name: '최종 요청 상태 조회' })).toBeTruthy();
});
it('owner explicitly reviews, confirms and prepares only; next decision requires manual status GET', async () => {
  renderOwner();
  open();
  await conditions();
  expect(screen.getByRole('button', { name: '최종 인계 요청 준비' }).hasAttribute('disabled')).toBe(true);
  agree();
  click('최종 인계 요청 준비');
  await screen.findByText(/최종 수락 대기 · 버전/);
  expect(api.post).toHaveBeenCalledTimes(1);
  expect(api.post.mock.calls[0][1]).toEqual({
    requestId,
    expectedProposalVersion: 2,
    basis: 'opaque-basis',
    acknowledgedTransfer: true,
  });
  expect(document.querySelector('li b')).toBeNull();
  expect(screen.getByRole('button', { name: '최종 인계 요청 취소' }).hasAttribute('disabled')).toBe(true);
});
it('recipient explicitly loads then accepts with captured version/basis, without executing', async () => {
  api.get.mockResolvedValue({ data: receipt() });
  api.post.mockResolvedValue({ data: receipt({ status: 'accepted', version: 2, acceptedAt: '2026-10-19T00:00:00Z' }) });
  render(<HandoverFinalTransfer review={proposal()} scope={{ ...scope, actorId: 43 }} organizationVersion={3} />);
  open();
  await load();
  agree();
  click('최종 인계 수락');
  await screen.findByText(/최종 수락됨 · 버전 2/);
  expect(api.post).toHaveBeenCalledWith(`/enterprise/handover/${proposalId}/transfer/accept`, {
    expectedVersion: 1,
    reviewBasis: 'opaque-review',
    acknowledgedTransfer: true,
  });
  expect(screen.queryByRole('button', { name: '선택 대시보드 전체 이전 실행' })).toBeNull();
});
it('owner latest manual status and checkbox are required for execution; completed receipt cannot execute/cancel', async () => {
  api.get.mockResolvedValue({ data: receipt({ status: 'accepted', version: 2, acceptedAt: '2026-10-19T00:00:00Z' }) });
  api.post.mockResolvedValue({
    data: receipt({
      status: 'completed',
      version: 3,
      acceptedAt: '2026-10-19T00:00:00Z',
      completedAt: '2026-10-19T01:00:00Z',
    }),
  });
  renderOwner();
  open();
  await load();
  expect(screen.getByRole('button', { name: '선택 대시보드 전체 이전 실행' }).hasAttribute('disabled')).toBe(true);
  agree();
  click('선택 대시보드 전체 이전 실행');
  await screen.findByText(/이전 완료 · 버전 3/);
  expect(screen.queryByRole('checkbox', { name: /목록·당사자/ })).toBeNull();
  expect(api.post).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('button', { name: '선택 대시보드 전체 이전 실행' })).toBeNull();
  expect(screen.queryByRole('button', { name: '최종 인계 요청 취소' })).toBeNull();
  expect(screen.queryByRole('button', { name: '최종 이전 조건 검토' })).toBeNull();
  click('최종 대시보드 인계 닫기');
  open();
  expect(screen.queryByRole('button', { name: '최종 이전 조건 검토' })).toBeNull();
});
it.each(['network', '503', 'invalid'])(
  'unknown prepare %s persists exact input across close/reload; explicit 404 enables same UUID retry',
  async kind => {
    api.post.mockRejectedValueOnce(kind === '503' ? { response: { status: 503 } } : Error('network'));
    if (kind === 'invalid') api.post.mockReset().mockResolvedValueOnce({ data: { ok: true } });
    let view = renderOwner();
    open();
    await conditions();
    agree();
    click('최종 인계 요청 준비');
    await waitFor(() => expect(screen.queryByText('최종 인계 확인 중…')).toBeNull());
    const sent = api.post.mock.calls[0][1];
    expect(sessionStorage.length).toBe(1);
    click('최종 대시보드 인계 닫기');
    open();
    expect(screen.queryByRole('button', { name: '같은 요청으로 최종 준비 재시도' })).toBeNull();
    view.unmount();
    view = renderOwner();
    open();
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/저장 결과를 확인해야/)).toBeTruthy();
    api.get.mockRejectedValueOnce({ response: { status: 404 } });
    click('최종 요청 상태 조회');
    await screen.findByRole('button', { name: '같은 요청으로 최종 준비 재시도' });
    agree();
    api.post.mockResolvedValueOnce({ data: receipt() });
    click('같은 요청으로 최종 준비 재시도');
    await screen.findByText(/최종 수락 대기 · 버전/);
    expect(api.post.mock.calls[1][1]).toEqual(sent);
    expect(crypto.randomUUID).toHaveBeenCalledTimes(1);
    expect(sessionStorage.length).toBe(0);
  },
);
it('definite prepare 409 clears old consent/report without unknown warning, preserving parent proposal', async () => {
  api.post.mockRejectedValue({ response: { status: 409 } });
  renderOwner();
  open();
  await conditions();
  agree();
  click('최종 인계 요청 준비');
  await waitFor(() => expect(screen.queryByText('최종 인계 확인 중…')).toBeNull());
  expect(screen.queryByText(/저장 결과를 확인해야/)).toBeNull();
  expect(screen.getByText(/요청이 거절되었습니다/)).toBeTruthy();
  expect(screen.queryByRole('checkbox')).toBeNull();
  expect(sessionStorage.length).toBe(0);
  expect(screen.getByRole('button', { name: '최종 이전 조건 검토' }).hasAttribute('disabled')).toBe(false);
});
it.each([409, 503])(
  'decision failure %i clears result/consent, requires manual read, never automatically retries',
  async status => {
    api.get.mockResolvedValue({ data: receipt() });
    api.post.mockRejectedValue({ response: { status } });
    render(<HandoverFinalTransfer review={proposal()} scope={{ ...scope, actorId: 43 }} organizationVersion={3} />);
    open();
    await load();
    agree();
    click('최종 인계 수락');
    await waitFor(() => expect(screen.queryByText('최종 인계 확인 중…')).toBeNull());
    expect(screen.queryByRole('list', { name: '최종 인계 대시보드' })).toBeNull();
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(!!screen.queryByText(/저장 결과를 확인해야/)).toBe(status === 503);
    expect(api.post).toHaveBeenCalledTimes(1);
    await load();
    agree();
    expect(screen.getByRole('button', { name: '최종 인계 수락' }).hasAttribute('disabled')).toBe(false);
  },
);
it('re-read clears previous report immediately and failure cannot leave transfer-ready UI', async () => {
  renderOwner();
  open();
  await conditions();
  api.get.mockRejectedValueOnce({ response: { status: 403 } });
  click('최종 이전 조건 검토');
  expect(screen.queryByRole('list', { name: '최종 인계 대시보드' })).toBeNull();
  await waitFor(() => expect(screen.queryByText('최종 인계 확인 중…')).toBeNull());
  expect(screen.queryByRole('button', { name: '최종 인계 요청 준비' })).toBeNull();
});
it.each(['close', 'scope', 'review', 'unmount'])('ignores late responses after %s', async mode => {
  let resolve: (v: unknown) => void;
  api.get.mockImplementationOnce(
    () =>
      new Promise(done => {
        resolve = done;
      }),
  );
  const view = renderOwner();
  open();
  click('최종 이전 조건 검토');
  if (mode === 'close') click('최종 대시보드 인계 닫기');
  if (mode === 'scope')
    view.rerender(
      <HandoverFinalTransfer review={proposal()} scope={{ organizationId: 8, actorId: 42 }} organizationVersion={4} />,
    );
  if (mode === 'review')
    view.rerender(<HandoverFinalTransfer review={{ ...proposal(), version: 3 }} scope={scope} organizationVersion={3} />);
  if (mode === 'unmount') view.unmount();
  await act(async () => resolve({ data: report() }));
  expect(screen.queryByText(/현재 지원 범위에서 준비 가능/)).toBeNull();
  expect(api.post).not.toHaveBeenCalled();
});
it('receipts remain accessible after intent disclosure ends; no private titles or final accept', async () => {
  api.get.mockResolvedValue({ data: receipt({ status: 'cancelled', version: 2, detailsAvailable: false, dashboards: [] }) });
  render(
    <HandoverFinalTransfer
      review={{ ...proposal(), status: 'cancelled', detailsAvailable: false, assets: [], expired: true }}
      scope={{ ...scope, actorId: 43 }}
      organizationVersion={3}
    />,
  );
  open();
  await load();
  expect(screen.getByText(/자료 공개가 종료되어/)).toBeTruthy();
  expect(screen.queryByText('<b>Private</b>')).toBeNull();
  expect(screen.queryByRole('button', { name: '최종 인계 수락' })).toBeNull();
});
it('unrelated actor cannot render or request', () => {
  render(<HandoverFinalTransfer review={proposal()} scope={{ ...scope, actorId: 99 }} organizationVersion={3} />);
  expect(screen.queryByRole('button')).toBeNull();
  expect(api.get).not.toHaveBeenCalled();
});
it('blocked source selection shows reason and cannot prepare or inherit prior intent consent', async () => {
  api.get.mockResolvedValue({ data: { ...report(), eligible: false, blockers: ['source_transfer_deferred'] } });
  render(
    <HandoverFinalTransfer
      review={{ ...proposal(), assets: [...proposal().assets, { kind: 'source', id: 12, title: 'Source' }] }}
      scope={scope}
      organizationVersion={3}
    />,
  );
  open();
  click('최종 이전 조건 검토');
  await screen.findByText('소스 자체 이전은 이번 범위에 포함되지 않습니다.');
  expect(screen.queryByRole('checkbox')).toBeNull();
  expect(screen.queryByRole('button', { name: '최종 인계 요청 준비' })).toBeNull();
  expect(api.post).not.toHaveBeenCalled();
});
it('owner can explicitly cancel expired prepared receipt with current version/basis', async () => {
  api.get.mockResolvedValue({ data: receipt({ expiresAt: '2000-01-01' }) });
  api.post.mockResolvedValue({
    data: receipt({ status: 'cancelled', version: 2, expiresAt: '2000-01-01', detailsAvailable: false, dashboards: [] }),
  });
  renderOwner();
  open();
  await load();
  agree();
  click('최종 인계 요청 취소');
  await screen.findByText(/최종 요청 취소됨 · 버전 2/);
  expect(api.post).toHaveBeenCalledWith(`/enterprise/handover/${proposalId}/transfer/cancel`, {
    expectedVersion: 1,
    reviewBasis: 'opaque-review',
    acknowledgedTransfer: true,
  });
  expect(screen.queryByRole('button', { name: '최종 인계 요청 준비' })).toBeNull();
});
it('close during prepare retains pending even if the hidden response later succeeds, requiring explicit reconciliation', async () => {
  let resolve: (v: unknown) => void;
  api.post.mockImplementationOnce(
    () =>
      new Promise(done => {
        resolve = done;
      }),
  );
  const view = renderOwner();
  open();
  await conditions();
  agree();
  click('최종 인계 요청 준비');
  click('최종 대시보드 인계 닫기');
  await act(async () => resolve({ data: receipt() }));
  expect(sessionStorage.length).toBe(1);
  view.unmount();
  renderOwner();
  open();
  expect(screen.queryByRole('list', { name: '최종 인계 대시보드' })).toBeNull();
  api.get.mockResolvedValueOnce({ data: receipt() });
  await load();
  expect(sessionStorage.length).toBe(0);
  expect(api.post).toHaveBeenCalledTimes(1);
});
it('does not unlock a retained preparation for a different final UUID', async () => {
  api.post.mockRejectedValueOnce(Error('network'));
  renderOwner();
  open();
  await conditions();
  agree();
  click('최종 인계 요청 준비');
  await waitFor(() => expect(screen.queryByText('최종 인계 확인 중…')).toBeNull());
  api.get.mockResolvedValueOnce({ data: receipt({ requestId: '32345678-1234-4234-8234-123456789012' }) });
  click('최종 요청 상태 조회');
  await screen.findByText(/저장된 요청 번호와 현재 최종 기록이 다릅니다/);
  expect(sessionStorage.length).toBe(1);
  expect(screen.queryByRole('button', { name: '같은 요청으로 최종 준비 재시도' })).toBeNull();
  expect(api.post).toHaveBeenCalledTimes(1);
});
it('storage failure prevents sending preparation', async () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw Error('denied');
  });
  renderOwner();
  open();
  await conditions();
  agree();
  click('최종 인계 요청 준비');
  await screen.findByText(/탭 복구 정보를 저장하지 못해/);
  expect(api.post).not.toHaveBeenCalled();
});
it('keeps known rejected preparation identifiable and only generates a fresh request on explicit new preparation', async () => {
  api.post.mockRejectedValueOnce({ response: { status: 409 } });
  renderOwner();
  open();
  await conditions();
  agree();
  click('최종 인계 요청 준비');
  await waitFor(() => expect(screen.queryByText('최종 인계 확인 중…')).toBeNull());
  expect(screen.getByText(/요청이 거절되었습니다/).textContent).toContain(requestId);
  expect(crypto.randomUUID).toHaveBeenCalledTimes(1);
  await conditions();
  expect(crypto.randomUUID).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: '새 최종 인계 요청 준비' }).hasAttribute('disabled')).toBe(true);
  agree();
  crypto.randomUUID = vi.fn().mockReturnValue('32345678-1234-4234-8234-123456789012');
  api.post.mockResolvedValueOnce({ data: receipt({ requestId: '32345678-1234-4234-8234-123456789012' }) });
  click('새 최종 인계 요청 준비');
  await screen.findByText(/최종 수락 대기 · 버전/);
  expect(api.post.mock.calls[1][1].requestId).toBe('32345678-1234-4234-8234-123456789012');
});
it.each([42, 43])(
  'never displays disclosed final titles or enables consent when parent is closed for party %i',
  async actorId => {
    const leakedTitle = 'Unrelated private title';
    api.get.mockResolvedValueOnce({ data: receipt({ dashboards: [{ id: 999, title: leakedTitle }] }) });
    render(
      <HandoverFinalTransfer
        review={{ ...proposal(), detailsAvailable: false, assets: [] }}
        scope={{ ...scope, actorId }}
        organizationVersion={3}
      />,
    );
    open();
    expect(api.get).not.toHaveBeenCalled();
    click('최종 요청 상태 조회');
    await waitFor(() => expect(screen.queryByText('최종 인계 확인 중…')).toBeNull());
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.queryByText(leakedTitle)).toBeNull();
    expect(screen.queryByRole('list', { name: '최종 인계 대시보드' })).toBeNull();
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.queryByRole('button', { name: '최종 이전 조건 검토' })).toBeNull();
    expect(screen.queryByRole('button', { name: '최종 인계 수락' })).toBeNull();
    expect(api.post).not.toHaveBeenCalled();
    api.get.mockResolvedValueOnce({ data: receipt({ detailsAvailable: false, dashboards: [] }) });
    await load();
    expect(screen.getByText(/자료 공개가 종료되어/)).toBeTruthy();
    expect(screen.queryByText(leakedTitle)).toBeNull();
  },
);
