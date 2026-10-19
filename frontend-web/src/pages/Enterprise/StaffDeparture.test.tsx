import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import StaffDeparture from './StaffDeparture';
import {
  completedDeparture,
  departureId as id,
  departureRecord,
  departureReview,
} from '@/api/staffDepartureFixtures.test-support';
import { savePendingStaffDeparture } from '@/api/staffDepartureStorage';
import { EnterpriseContext } from '@/api/enterpriseService';
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('@/helpers/apiHelper', () => api);
vi.mock('@/api/personalLibraryService', () => ({ personalLibrarySessionScope: () => 'session' }));
const context = (actor = 3, role: 'admin' | 'member' = 'member', version = 4): EnterpriseContext => ({
  organization: { id: 7, name: '조직', version },
  membership: { userId: actor, team: '', role },
});
const open = () => fireEvent.click(screen.getByRole('button', { name: '조직 탈퇴 펼치기' }));
const lookup = async () => {
  fireEvent.change(screen.getByLabelText('탈퇴 요청 번호'), { target: { value: id } });
  fireEvent.click(screen.getByRole('button', { name: '현재 기록 조회' }));
  await screen.findByText('다른 admin 검토 대기');
};
const selfAck = () => screen.getByRole('checkbox', { name: '본인의 조직 탈퇴 요청과 로그인·조직 관계 회수에 동의합니다.' });
const finalAck = () => screen.getByRole('checkbox', { name: /최신 잔여와 보존 범위를 확인/ });
const create = () => {
  fireEvent.click(selfAck());
  fireEvent.click(screen.getByRole('button', { name: '본인 탈퇴 요청 저장' }));
};
const prepareAdmin = async () => {
  api.get.mockResolvedValueOnce({ data: departureRecord() }).mockResolvedValueOnce({ data: departureReview() });
  await lookup();
  fireEvent.click(screen.getByRole('button', { name: '최신 잔여 검토' }));
  await screen.findByText(/이번 검토에서 차단 사유 없음/);
};
beforeEach(() => {
  vi.resetAllMocks();
  sessionStorage.clear();
  localStorage.clear();
  vi.spyOn(crypto, 'randomUUID').mockReturnValue(id);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it('fold/open/input have zero automatic networking, separate self consent, responsive helper outside row', () => {
  render(<StaffDeparture context={context()} />);
  open();
  expect(api.get).not.toHaveBeenCalled();
  expect(api.post).not.toHaveBeenCalled();
  expect((screen.getByRole('button', { name: '본인 탈퇴 요청 저장' }) as HTMLInputElement).disabled).toBe(true);
  const input = screen.getByLabelText('탈퇴 요청 번호');
  expect(input.getAttribute('aria-describedby')).toBe('departure-request-help');
  expect(input.parentElement?.contains(document.getElementById('departure-request-help'))).toBe(false);
  expect(input.className).toContain('md:text-base');
  expect(input.className).toContain('lg:text-sm');
  fireEvent.change(input, { target: { value: id } });
  expect(api.get).not.toHaveBeenCalled();
});
it('self creates once with exact UUID/version/ack and has no review/complete authority', async () => {
  api.post.mockResolvedValue({ data: departureRecord() });
  render(<StaffDeparture context={context()} />);
  open();
  create();
  await screen.findByText('다른 admin 검토 대기');
  expect(api.post).toHaveBeenCalledExactlyOnceWith('/enterprise/staff-departure', {
    requestId: id,
    expectedOrganizationVersion: 4,
    acknowledgedDeparture: true,
  });
  expect(screen.queryByRole('button', { name: '최신 잔여 검토' })).toBeNull();
  expect(screen.queryByRole('button', { name: '조직 탈퇴 확정' })).toBeNull();
});
it('different admin explicitly reads record then review and separately confirms exact reviewed basis', async () => {
  api.post.mockResolvedValue({ data: completedDeparture() });
  render(<StaffDeparture context={context(4, 'admin')} />);
  open();
  await prepareAdmin();
  expect(api.post).not.toHaveBeenCalled();
  expect((screen.getByRole('button', { name: '조직 탈퇴 확정' }) as HTMLInputElement).disabled).toBe(true);
  fireEvent.click(finalAck());
  fireEvent.click(screen.getByRole('button', { name: '조직 탈퇴 확정' }));
  await screen.findByText('조직 탈퇴 완료');
  expect(api.post).toHaveBeenCalledExactlyOnceWith(`/enterprise/staff-departure/${id}/complete`, {
    expectedVersion: 1,
    reviewBasis: 'a'.repeat(64),
    acknowledgedDeparture: true,
  });
  expect(screen.queryByRole('checkbox', { name: /최신 잔여/ })).toBeNull();
});
it('blocked review shows counts and blockers without final consent or execution', async () => {
  api.get
    .mockResolvedValueOnce({ data: departureRecord() })
    .mockResolvedValueOnce({ data: departureReview({ eligible: false, blockers: ['last_admin'] }) });
  render(<StaffDeparture context={context(4, 'admin')} />);
  open();
  await lookup();
  fireEvent.click(screen.getByRole('button', { name: '최신 잔여 검토' }));
  await screen.findByText('다른 활성 admin이 남아야 합니다.');
  expect(screen.queryByRole('button', { name: '조직 탈퇴 확정' })).toBeNull();
  expect(api.post).not.toHaveBeenCalled();
});
it.each([new Error('network'), { response: { status: 503 } }, { invalidSuccess: true }])(
  'unknown creation survives close/reload, GET404 required before identical retry %s',
  async failure => {
    if ('invalidSuccess' in failure) api.post.mockResolvedValueOnce({ data: {} });
    else api.post.mockRejectedValueOnce(failure);
    const view = render(<StaffDeparture context={context()} />);
    open();
    create();
    await screen.findByRole('alert');
    expect((screen.getByLabelText('탈퇴 요청 번호') as HTMLInputElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: '조직 탈퇴 접기' }));
    open();
    expect(api.post).toHaveBeenCalledTimes(1);
    view.unmount();
    render(<StaffDeparture context={context()} />);
    open();
    expect((screen.getByLabelText('탈퇴 요청 번호') as HTMLInputElement).value).toBe(id);
    expect(screen.queryByRole('button', { name: '같은 요청 다시 시도' })).toBeNull();
    api.get.mockRejectedValueOnce({ response: { status: 404 } });
    fireEvent.click(screen.getByRole('button', { name: '현재 기록 조회' }));
    await screen.findByText(/기록이 없습니다/);
    api.post.mockResolvedValueOnce({ data: departureRecord() });
    fireEvent.click(screen.getByRole('checkbox', { name: /보존한 같은 요청 번호/ }));
    fireEvent.click(screen.getByRole('button', { name: '같은 요청 다시 시도' }));
    await screen.findByText('다른 admin 검토 대기');
    expect(api.post.mock.calls[1]).toEqual(api.post.mock.calls[0]);
    expect(crypto.randomUUID).toHaveBeenCalledTimes(1);
  },
);
it('unknown completion restores exact basis, GETrequested before explicit retry, no automatic review or POST', async () => {
  render(<StaffDeparture context={context(4, 'admin')} />);
  open();
  await prepareAdmin();
  api.post.mockRejectedValueOnce({ response: { status: 500 } });
  fireEvent.click(finalAck());
  fireEvent.click(screen.getByRole('button', { name: '조직 탈퇴 확정' }));
  await screen.findByRole('alert');
  cleanup();
  render(<StaffDeparture context={context(4, 'admin')} />);
  open();
  expect(api.post).toHaveBeenCalledTimes(1);
  api.get.mockResolvedValueOnce({ data: departureRecord() });
  fireEvent.click(screen.getByRole('button', { name: '현재 기록 조회' }));
  await screen.findByText('다른 admin 검토 대기');
  api.post.mockResolvedValueOnce({ data: completedDeparture() });
  fireEvent.click(screen.getByRole('checkbox', { name: /보존한 같은 요청 번호/ }));
  fireEvent.click(screen.getByRole('button', { name: '같은 요청 다시 시도' }));
  await screen.findByText('조직 탈퇴 완료');
  expect(api.post.mock.calls[1]).toEqual(api.post.mock.calls[0]);
  expect(api.get).toHaveBeenCalledTimes(3);
});
it('completed GET reconciles unknown completion without replaying execution', async () => {
  savePendingStaffDeparture('session', {
    savedAt: Date.now(),
    actorId: 4,
    organizationId: 7,
    targetId: 3,
    requestId: id,
    operation: 'complete',
    input: { expectedVersion: 1, reviewBasis: 'b'.repeat(64), acknowledgedDeparture: true },
  });
  api.get.mockResolvedValue({ data: completedDeparture() });
  render(<StaffDeparture context={context(4, 'admin')} />);
  open();
  fireEvent.click(screen.getByRole('button', { name: '현재 기록 조회' }));
  await screen.findByText('조직 탈퇴 완료');
  expect(api.post).not.toHaveBeenCalled();
  expect(sessionStorage.length).toBe(0);
  expect(screen.queryByRole('button', { name: '같은 요청 다시 시도' })).toBeNull();
});
it('definite completion409 clears pending/consent/review and requires explicit GET plus new review', async () => {
  render(<StaffDeparture context={context(4, 'admin')} />);
  open();
  await prepareAdmin();
  api.post.mockRejectedValueOnce({ response: { status: 409 } });
  fireEvent.click(finalAck());
  fireEvent.click(screen.getByRole('button', { name: '조직 탈퇴 확정' }));
  await screen.findByRole('alert');
  expect(sessionStorage.length).toBe(0);
  expect(screen.queryByRole('checkbox', { name: /최신 잔여/ })).toBeNull();
  expect(screen.queryByRole('button', { name: '최신 잔여 검토' })).toBeNull();
  expect((screen.getByLabelText('탈퇴 요청 번호') as HTMLInputElement).value).toBe(id);
  expect((screen.getByLabelText('탈퇴 요청 번호') as HTMLInputElement).disabled).toBe(false);
  expect(api.post).toHaveBeenCalledTimes(1);
});
it('no-org relogged self can read historical receipt using token identity only for cache fence', async () => {
  localStorage.setItem(
    'accessToken',
    JSON.stringify(`x.${btoa(JSON.stringify({ accessKeyData: { id: 3, authVersion: 2 } }))}.x`),
  );
  api.get.mockResolvedValue({ data: completedDeparture() });
  render(<StaffDeparture context={{ organization: null, membership: null }} />);
  open();
  fireEvent.change(screen.getByLabelText('탈퇴 요청 번호'), { target: { value: id } });
  fireEvent.click(screen.getByRole('button', { name: '현재 기록 조회' }));
  await screen.findByText('조직 탈퇴 완료');
  expect(screen.getByText(/완료 이전 로그인은 회수/)).toBeTruthy();
  expect(screen.queryByRole('button', { name: '본인 탈퇴 요청 저장' })).toBeNull();
});
it('cross-org record is hidden and no review action leaks', async () => {
  api.get.mockResolvedValue({ data: departureRecord({ organizationId: 8 }) });
  render(<StaffDeparture context={context(4, 'admin')} />);
  open();
  fireEvent.change(screen.getByLabelText('탈퇴 요청 번호'), { target: { value: id } });
  fireEvent.click(screen.getByRole('button', { name: '현재 기록 조회' }));
  await screen.findByRole('alert');
  expect(screen.queryByText('다른 admin 검토 대기')).toBeNull();
  expect(screen.queryByRole('button', { name: '최신 잔여 검토' })).toBeNull();
});
it('self cancels stale own request from new organization with explicit separate consent', async () => {
  api.get.mockResolvedValueOnce({ data: departureRecord() });
  api.post.mockResolvedValueOnce({
    data: departureRecord({ status: 'cancelled', version: 2, cancelledAt: new Date().toISOString() }),
  });
  render(<StaffDeparture context={{ ...context(), organization: { id: 8, name: '새 조직', version: 9 } }} />);
  open();
  await lookup();
  fireEvent.click(screen.getByRole('checkbox', { name: /아직 실행되지 않은 본인 요청/ }));
  fireEvent.click(screen.getByRole('button', { name: '본인 요청 취소' }));
  await screen.findByText('요청 취소됨');
  expect(api.post).toHaveBeenCalledExactlyOnceWith(`/enterprise/staff-departure/${id}/cancel`, {
    expectedVersion: 1,
    acknowledgedDeparture: true,
  });
});
it('old-token401 asks relogin without redirect or automatic reread', async () => {
  api.get.mockRejectedValue({ response: { status: 401 } });
  render(<StaffDeparture context={context()} />);
  open();
  fireEvent.change(screen.getByLabelText('탈퇴 요청 번호'), { target: { value: id } });
  fireEvent.click(screen.getByRole('button', { name: '현재 기록 조회' }));
  await screen.findByText(/로그인이 만료되었습니다/);
  expect((screen.getByRole('button', { name: '현재 기록 조회' }) as HTMLInputElement).disabled).toBe(true);
  expect(api.get).toHaveBeenCalledTimes(1);
});
it.each(['target', 'close', 'scope', 'unmount'])('late read cannot disclose after %s changes', async change => {
  let resolve!: (v: unknown) => void;
  api.get.mockReturnValue(
    new Promise(r => {
      resolve = r;
    }),
  );
  const view = render(<StaffDeparture context={context(4, 'admin')} />);
  open();
  fireEvent.change(screen.getByLabelText('탈퇴 요청 번호'), { target: { value: id } });
  fireEvent.click(screen.getByRole('button', { name: '현재 기록 조회' }));
  // Inputs are locked during a request; close/scope/unmount are the applicable response fences.
  if (change === 'scope') view.rerender(<StaffDeparture context={context(4, 'admin', 5)} />);
  else if (change === 'unmount') view.unmount();
  else {
    fireEvent.click(screen.getByRole('button', { name: '조직 탈퇴 접기' }));
    if (change === 'target') {
      open();
      fireEvent.change(screen.getByLabelText('탈퇴 요청 번호'), {
        target: { value: '633c472f-b03d-40a1-804c-4af4d787506c' },
      });
    }
  }
  resolve({ data: departureRecord() });
  await waitFor(() => expect(screen.queryByText('다른 admin 검토 대기')).toBeNull());
  expect(api.post).not.toHaveBeenCalled();
});

it('changing lookup target clears review and final acknowledgment immediately', async () => {
  render(<StaffDeparture context={context(4, 'admin')} />);
  open();
  await prepareAdmin();
  fireEvent.click(finalAck());
  fireEvent.change(screen.getByLabelText('탈퇴 요청 번호'), { target: { value: '633c472f-b03d-40a1-804c-4af4d787506c' } });
  expect(screen.queryByText(/이번 검토에서 차단 사유 없음/)).toBeNull();
  expect(screen.queryByRole('button', { name: '조직 탈퇴 확정' })).toBeNull();
  expect(api.post).not.toHaveBeenCalled();
});
it('failed review retry clears prior counts and confirmation while leaving the request number', async () => {
  render(<StaffDeparture context={context(4, 'admin')} />);
  open();
  await prepareAdmin();
  fireEvent.click(finalAck());
  api.get.mockRejectedValueOnce({ response: { status: 503 } });
  fireEvent.click(screen.getByRole('button', { name: '최신 잔여 검토' }));
  expect(screen.queryByText('개인 소유 소스')).toBeNull();
  await screen.findByRole('alert');
  expect(screen.queryByRole('checkbox', { name: /최신 잔여/ })).toBeNull();
  expect((screen.getByLabelText('탈퇴 요청 번호') as HTMLInputElement).value).toBe(id);
  expect(screen.queryByRole('checkbox', { name: /본인의 조직 탈퇴 요청/ })).toBeNull();
  expect(screen.queryByRole('button', { name: '본인 탈퇴 요청 저장' })).toBeNull();
});
it('closing during an in-flight creation ignores its result but preserves recovery ticket and never resends', async () => {
  let resolve!: (v: unknown) => void;
  api.post.mockReturnValue(
    new Promise(r => {
      resolve = r;
    }),
  );
  render(<StaffDeparture context={context()} />);
  open();
  create();
  fireEvent.click(screen.getByRole('button', { name: '조직 탈퇴 접기' }));
  open();
  resolve({ data: departureRecord() });
  await waitFor(() => expect(screen.queryByText('다른 admin 검토 대기')).toBeNull());
  expect(sessionStorage.length).toBe(1);
  expect((screen.getByLabelText('탈퇴 요청 번호') as HTMLInputElement).disabled).toBe(true);
  expect(api.post).toHaveBeenCalledTimes(1);
  expect(api.get).not.toHaveBeenCalled();
});
it('completion404 reconciliation cannot recreate or retry a completion', async () => {
  savePendingStaffDeparture('session', {
    savedAt: Date.now(),
    actorId: 4,
    organizationId: 7,
    targetId: 3,
    requestId: id,
    operation: 'complete',
    input: { expectedVersion: 1, reviewBasis: 'a'.repeat(64), acknowledgedDeparture: true },
  });
  api.get.mockRejectedValueOnce({ response: { status: 404 } });
  render(<StaffDeparture context={context(4, 'admin')} />);
  open();
  fireEvent.click(screen.getByRole('button', { name: '현재 기록 조회' }));
  await screen.findByRole('alert');
  expect(screen.queryByRole('button', { name: '같은 요청 다시 시도' })).toBeNull();
  expect(sessionStorage.length).toBe(1);
  expect(api.post).not.toHaveBeenCalled();
});
it('a definite request409 permits explicit fresh consent without mislabeling it as unknown', async () => {
  api.post.mockRejectedValueOnce({ response: { status: 409 } });
  render(<StaffDeparture context={context()} />);
  open();
  create();
  await screen.findByRole('alert');
  expect(sessionStorage.length).toBe(0);
  expect(screen.queryByText(/저장 결과를 확인할 요청 번호/)).toBeNull();
  expect(screen.queryByRole('checkbox', { name: /본인의 조직 탈퇴 요청/ })).toBeNull();
  expect((screen.getByLabelText('탈퇴 요청 번호') as HTMLInputElement).value).toBe(id);
  fireEvent.click(screen.getByRole('button', { name: '새 본인 요청 작성' }));
  expect((selfAck() as HTMLInputElement).checked).toBe(false);
  expect((screen.getByLabelText('탈퇴 요청 번호') as HTMLInputElement).value).toBe('');
  expect(api.post).toHaveBeenCalledTimes(1);
});
it('an unresolved request from an old organization cannot retry against the new organization', async () => {
  savePendingStaffDeparture('session', {
    savedAt: Date.now(),
    actorId: 3,
    organizationId: 7,
    requestId: id,
    operation: 'request',
    input: { requestId: id, expectedOrganizationVersion: 4, acknowledgedDeparture: true },
  });
  api.get.mockRejectedValueOnce({ response: { status: 404 } });
  render(<StaffDeparture context={{ ...context(), organization: { id: 8, name: '새 조직', version: 4 } }} />);
  open();
  fireEvent.click(screen.getByRole('button', { name: '현재 기록 조회' }));
  await screen.findByRole('alert');
  expect(screen.queryByRole('button', { name: '같은 요청 다시 시도' })).toBeNull();
  expect(api.post).not.toHaveBeenCalled();
});

it('hides self creation while a lookup number is populated or another employee is reviewed; explicit new draft clears the lookup', async () => {
  render(<StaffDeparture context={context(4, 'admin')} />);
  open();
  fireEvent.click(selfAck());
  fireEvent.change(screen.getByLabelText('탈퇴 요청 번호'), { target: { value: id } });
  expect(screen.queryByRole('checkbox', { name: /본인의 조직 탈퇴 요청/ })).toBeNull();
  expect(screen.queryByRole('button', { name: '본인 탈퇴 요청 저장' })).toBeNull();
  expect(api.get).not.toHaveBeenCalled();
  expect(api.post).not.toHaveBeenCalled();
  await prepareAdmin();
  expect(screen.queryByRole('button', { name: '본인 탈퇴 요청 저장' })).toBeNull();
  fireEvent.click(finalAck());
  fireEvent.click(screen.getByRole('button', { name: '새 본인 요청 작성' }));
  expect((screen.getByLabelText('탈퇴 요청 번호') as HTMLInputElement).value).toBe('');
  expect(screen.queryByText(/이번 검토에서 차단 사유 없음/)).toBeNull();
  expect(screen.queryByRole('checkbox', { name: /최신 잔여/ })).toBeNull();
  expect((selfAck() as HTMLInputElement).checked).toBe(false);
  expect((screen.getByRole('button', { name: '본인 탈퇴 요청 저장' }) as HTMLButtonElement).disabled).toBe(true);
  expect(api.post).not.toHaveBeenCalled();
});
it('does not offer a new draft while an unresolved write is retained', async () => {
  api.post.mockRejectedValueOnce(new Error('offline'));
  render(<StaffDeparture context={context()} />);
  open();
  create();
  await screen.findByRole('alert');
  expect(screen.queryByRole('button', { name: '새 본인 요청 작성' })).toBeNull();
  expect(screen.queryByRole('button', { name: '본인 탈퇴 요청 저장' })).toBeNull();
});
