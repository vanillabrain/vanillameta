import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import StaffTransfer from './StaffTransfer';
import Enterprise from './index';
import { fetchMembers } from '@/api/enterpriseService';
import {
  acceptStaffTransfer,
  completeStaffTransfer,
  createStaffTransfer,
  fetchStaffTransfer,
  revokeStaffTransfer,
  reviewStaffTransfer,
} from '@/api/staffTransferService';
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), del: vi.fn(), patch: vi.fn() }));
vi.mock('@/helpers/apiHelper', () => api);
const code = 'a'.repeat(64);
const basis = 'b'.repeat(64);
const base = { sourceOrganizationId: 7, targetOrganizationId: 8, expiresAt: '2026-10-18T12:00:00Z' };
const context = (role: 'admin' | 'member' = 'member') => ({
  organization: { id: 7, name: 'Example', version: 3 },
  membership: { userId: 42, role, team: '' },
});
const reviewed = (accepted = true) => ({
  reviewBasis: basis,
  ...base,
  userId: 99,
  team: 'Ops',
  accepted,
  sourceVersion: 3,
  targetVersion: 6,
  status: 'pending',
});
const reviewCode = async () => {
  fireEvent.click(screen.getByRole('button', { name: '이동 요청 검토' }));
  await screen.findByText(/검토한 직원 #99/);
};
const open = async () => {
  fireEvent.click(screen.getByRole('button', { name: '조직 이동 열기' }));
  await screen.findByText('현재 확인된 내 이동 요청이 없습니다.');
};
const input = (name: string, value: string) => fireEvent.change(screen.getByLabelText(name), { target: { value } });
const check = (name: RegExp) => fireEvent.click(screen.getByRole('checkbox', { name }));
beforeEach(() => {
  vi.resetAllMocks();
  api.get.mockResolvedValue({ data: null });
});
afterEach(cleanup);
it('loads self status only on opening; requires consent, keeps code only in memory and revokes explicitly', async () => {
  const storage = vi.spyOn(Storage.prototype, 'setItem');
  api.post.mockResolvedValue({ data: { ...base, code } });
  api.del.mockResolvedValue({ data: { revoked: true } });
  const view = render(<StaffTransfer context={context()} onReload={vi.fn()} />);
  expect(api.get).not.toHaveBeenCalled();
  await open();
  input('이동할 조직 번호', '8');
  fireEvent.click(screen.getByRole('button', { name: '이동 동의 코드 발급' }));
  expect(api.post).not.toHaveBeenCalled();
  check(/member 이동에 동의/);
  fireEvent.click(screen.getByRole('button', { name: '이동 동의 코드 발급' }));
  expect(await screen.findByLabelText('발급된 이동 코드')).toHaveProperty('value', code);
  expect(api.post).toHaveBeenCalledWith('/enterprise/staff-transfer', { targetOrganizationId: 8 });
  expect(storage).not.toHaveBeenCalled();
  check(/동의를 철회합니다/);
  fireEvent.click(screen.getByRole('button', { name: '이동 동의 철회' }));
  await screen.findByText('이동 동의를 철회했습니다.');
  expect(screen.queryByLabelText('발급된 이동 코드')).toBeNull();
  view.unmount();
  storage.mockRestore();
});
it('reloads accepted/completed self status without recovering a code and hides admin actions from members', async () => {
  api.get.mockResolvedValue({ data: { ...base, team: 'Ops', accepted: true, status: 'completed' } });
  render(<StaffTransfer context={context()} onReload={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: '조직 이동 열기' }));
  await screen.findByText(/내 이동:.*이동 완료/);
  expect(screen.queryByLabelText('발급된 이동 코드')).toBeNull();
  expect(screen.queryByRole('button', { name: '대상 조직으로 수락' })).toBeNull();
});
it('requires code-bound review, correct target org and a new confirmation for acceptance', async () => {
  api.post.mockImplementation((url: string) =>
    Promise.resolve({ data: url.endsWith('/review') ? reviewed(false) : { ...base, accepted: true, team: 'Ops' } }),
  );
  const targetContext = { ...context('admin'), organization: { id: 8, name: 'Target', version: 6 } };
  render(<StaffTransfer context={targetContext} onReload={vi.fn()} />);
  await open();
  input('직원이 전달한 이동 코드', code);
  check(/현재 조직 #8에서/);
  expect(screen.getByRole('button', { name: '대상 조직으로 수락' })).toHaveProperty('disabled', true);
  await reviewCode();
  expect(screen.getByRole('button', { name: '대상 조직으로 수락' })).toHaveProperty('disabled', true);
  check(/현재 조직 #8에서 팀 Ops/);
  input('대상 조직 수락 팀', 'New');
  expect(screen.getByRole('button', { name: '대상 조직으로 수락' })).toHaveProperty('disabled', true);
  input('대상 조직 수락 팀', 'Ops');
  check(/현재 조직 #8에서 팀 Ops/);
  fireEvent.click(screen.getByRole('button', { name: '대상 조직으로 수락' }));
  await screen.findByText(/수락 확인:/);
  expect(api.post).toHaveBeenLastCalledWith('/enterprise/staff-transfer/accept', { code, team: 'Ops', expectedVersion: 6 });
  expect(screen.queryByText(/검토한 직원/)).toBeNull();
  expect(screen.getByRole('button', { name: '현재 조직에서 최종 이동' })).toHaveProperty('disabled', true);
});
it('requires accepted source-admin review and automatically uses both reviewed versions, then refreshes context', async () => {
  let accepted = false;
  api.post.mockImplementation((url: string) =>
    Promise.resolve({ data: url.endsWith('/review') ? reviewed(accepted) : { ...base, completed: true, userId: 99 } }),
  );
  const reload = vi.fn();
  render(<StaffTransfer context={context('admin')} onReload={reload} />);
  await open();
  input('직원이 전달한 이동 코드', code);
  await reviewCode();
  check(/대상 조직의 수락과 최신 버전/);
  expect(screen.getByRole('button', { name: '현재 조직에서 최종 이동' })).toHaveProperty('disabled', true);
  expect(screen.getByRole('button', { name: '대상 조직으로 수락' })).toHaveProperty('disabled', true);
  accepted = true;
  await reviewCode();
  check(/대상 조직의 수락과 최신 버전/);
  input('직원이 전달한 이동 코드', 'b'.repeat(64));
  expect(screen.queryByText(/검토한 직원/)).toBeNull();
  expect(screen.getByRole('checkbox', { name: /대상 조직의 수락과 최신 버전/ })).toHaveProperty('checked', false);
  input('직원이 전달한 이동 코드', code);
  await reviewCode();
  check(/대상 조직의 수락과 최신 버전/);
  fireEvent.click(screen.getByRole('button', { name: '현재 조직에서 최종 이동' }));
  await screen.findByText(/직원 #99의.*이동을 완료/);
  expect(api.post).toHaveBeenLastCalledWith('/enterprise/staff-transfer/complete', {
    code,
    expectedVersion: 3,
    targetExpectedVersion: 6,
    reviewBasis: basis,
  });
  expect(reload).toHaveBeenCalledWith(expect.stringContaining('다시 로그인'));
  expect(screen.queryByText(/처리 결과가 확정되지 않았습니다/)).toBeNull();
});
it('does not retry an ambiguous write and requires context reload after conflict', async () => {
  const reload = vi.fn();
  api.post.mockImplementation((url: string) =>
    url.endsWith('/review') ? Promise.resolve({ data: reviewed() }) : Promise.reject({ response: { status: 409 } }),
  );
  render(<StaffTransfer context={context('admin')} onReload={reload} />);
  await open();
  input('직원이 전달한 이동 코드', code);
  await reviewCode();
  check(/대상 조직의 수락과 최신 버전/);
  fireEvent.click(screen.getByRole('button', { name: '현재 조직에서 최종 이동' }));
  await screen.findByText(/처리 결과가 확정되지 않았습니다/);
  expect(api.post).toHaveBeenCalledTimes(2);
  expect(screen.getByRole('button', { name: '대상 조직으로 수락' })).toHaveProperty('disabled', true);
  fireEvent.click(screen.getByRole('button', { name: '내 이동 상태 다시 불러오기' }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: '조직·버전 다시 불러오기' })).toHaveProperty('disabled', false),
  );
  expect(api.get).toHaveBeenCalledTimes(2);
  expect(screen.getByRole('button', { name: '대상 조직으로 수락' })).toHaveProperty('disabled', true);
  fireEvent.click(screen.getByRole('button', { name: '조직·버전 다시 불러오기' }));
  expect(reload).toHaveBeenCalledOnce();
});
it('guards API payloads, input limits and enterprise errors', async () => {
  await expect(createStaffTransfer(-1)).rejects.toMatchObject({ kind: 'invalid' });
  await expect(acceptStaffTransfer({ code: 'bad', team: '', expectedVersion: 1 })).rejects.toMatchObject({
    kind: 'invalid',
  });
  await expect(
    completeStaffTransfer({ code, expectedVersion: 1, targetExpectedVersion: -1, reviewBasis: basis }),
  ).rejects.toMatchObject({
    kind: 'invalid',
  });
  expect(api.post).not.toHaveBeenCalled();
  api.get.mockResolvedValue({ data: { ...base, team: '', accepted: false, status: 'pending', code } });
  await expect(fetchStaffTransfer()).rejects.toMatchObject({ kind: 'invalid' });
  api.post.mockRejectedValue({ response: { status: 403 } });
  await expect(createStaffTransfer(8)).rejects.toMatchObject({ kind: 'forbidden' });
  api.del.mockResolvedValue({ data: { revoked: false } });
  await expect(revokeStaffTransfer()).rejects.toMatchObject({ kind: 'invalid' });
});
it('preserves fetchMembers callers and forwards literal search with cursor/config', async () => {
  api.get.mockResolvedValue({ data: { organizationVersion: 3, entries: [], nextAfterId: null } });
  await fetchMembers();
  expect(api.get).toHaveBeenLastCalledWith('/enterprise/members', {}, {});
  const config = { signal: new AbortController().signal };
  await fetchMembers(20, config, '%_Ops');
  expect(api.get).toHaveBeenLastCalledWith('/enterprise/members', { afterId: 20, q: '%_Ops' }, config);
  await expect(fetchMembers(undefined, {}, 'a'.repeat(101))).rejects.toMatchObject({ kind: 'invalid' });
  expect(api.get).toHaveBeenCalledTimes(2);
});
it('integrates server search into the actual staff list and subsequent cursor pages', async () => {
  api.get.mockImplementation((url: string, params: any) =>
    Promise.resolve({
      data:
        url === '/enterprise/context'
          ? context('admin')
          : url === '/enterprise/members'
          ? {
              organizationVersion: 3,
              entries: [
                {
                  id: params?.afterId ? 22 : params?.q ? 21 : 1,
                  userId: params?.q ? `Ops-${params.afterId || 21}` : 'Other',
                  team: 'Ops',
                  role: 'member',
                  active: true,
                },
              ],
              nextAfterId: params?.afterId ? null : 21,
            }
          : null,
    }),
  );
  render(<Enterprise />);
  await screen.findByText('로그인 ID Other');
  input('직원 검색', 'Ops');
  fireEvent.click(screen.getByRole('button', { name: '직원 검색 적용' }));
  await screen.findByText('로그인 ID Ops-21');
  expect(screen.queryByText('로그인 ID Other')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '다음 20명 더 보기' }));
  await screen.findByText('직원 번호 #22');
  expect(api.get).toHaveBeenCalledWith('/enterprise/members', { afterId: 21, q: 'Ops' }, {});
});
it('refreshes organization context alongside the staff list before allowing a fresh transfer confirmation', async () => {
  api.get.mockImplementation((url: string) =>
    Promise.resolve({
      data:
        url === '/enterprise/context'
          ? context('admin')
          : url === '/enterprise/members'
          ? { organizationVersion: 3, entries: [], nextAfterId: null }
          : null,
    }),
  );
  api.post.mockImplementation((url: string) =>
    url.endsWith('/review') ? Promise.resolve({ data: reviewed() }) : Promise.reject({ response: { status: 409 } }),
  );
  render(<Enterprise />);
  await screen.findByRole('heading', { name: '직원 목록' });
  await open();
  input('직원이 전달한 이동 코드', code);
  await reviewCode();
  check(/대상 조직의 수락과 최신 버전/);
  fireEvent.click(screen.getByRole('button', { name: '현재 조직에서 최종 이동' }));
  await screen.findByText(/처리 결과가 확정되지 않았습니다/);
  await waitFor(() =>
    expect(screen.getByRole('button', { name: '조직·버전 다시 불러오기' })).toHaveProperty('disabled', false),
  );
  fireEvent.click(screen.getByRole('button', { name: '조직·버전 다시 불러오기' }));
  await screen.findByRole('button', { name: '조직 이동 열기' });
  await open();
  expect(screen.queryByText(/처리 결과가 확정되지 않았습니다/)).toBeNull();
  expect(screen.getByLabelText('직원이 전달한 이동 코드')).toHaveProperty('value', '');
  expect(api.get.mock.calls.filter(call => call[0] === '/enterprise/context')).toHaveLength(2);
  expect(api.post).toHaveBeenCalledTimes(2);
});
it('ignores an in-flight code response after leaving the panel and never restores it on remount', async () => {
  let resolve: (value: unknown) => void;
  api.post.mockImplementation(
    () =>
      new Promise(done => {
        resolve = done;
      }),
  );
  const view = render(<StaffTransfer context={context()} onReload={vi.fn()} />);
  await open();
  input('이동할 조직 번호', '8');
  check(/member 이동에 동의/);
  fireEvent.click(screen.getByRole('button', { name: '이동 동의 코드 발급' }));
  view.unmount();
  resolve({ data: { ...base, code } });
  render(<StaffTransfer context={context()} onReload={vi.fn()} />);
  await open();
  expect(screen.queryByLabelText('발급된 이동 코드')).toBeNull();
  expect(api.post).toHaveBeenCalledTimes(1);
});
it('normalizes transport failures and refuses malformed successful write receipts', async () => {
  api.post.mockResolvedValue({ data: { ...base, code: 'not-a-code' } });
  await expect(createStaffTransfer(8)).rejects.toMatchObject({ kind: 'invalid' });
  api.post.mockResolvedValue({ data: { ...base, accepted: false, team: '' } });
  await expect(acceptStaffTransfer({ code, team: '', expectedVersion: 0 })).rejects.toMatchObject({ kind: 'invalid' });
  api.post.mockResolvedValue({ data: { ...base, completed: true, userId: '99' } });
  await expect(
    completeStaffTransfer({ code, expectedVersion: 0, targetExpectedVersion: 0, reviewBasis: basis }),
  ).rejects.toMatchObject({
    kind: 'invalid',
  });
  api.get.mockRejectedValue(new Error('offline'));
  await expect(fetchStaffTransfer()).rejects.toMatchObject({ kind: 'network' });
});
it('refuses unrelated-organization reviews and blocks moving the acting employee themselves', async () => {
  api.post.mockResolvedValue({ data: { ...reviewed(), sourceOrganizationId: 9, targetOrganizationId: 10 } });
  render(<StaffTransfer context={context('admin')} onReload={vi.fn()} />);
  await open();
  input('직원이 전달한 이동 코드', code);
  fireEvent.click(screen.getByRole('button', { name: '이동 요청 검토' }));
  await screen.findByText('현재 조직의 이동 요청이 아닙니다.');
  expect(screen.queryByText(/검토한 직원/)).toBeNull();
  check(/대상 조직의 수락과 최신 버전/);
  expect(screen.getByRole('button', { name: '현재 조직에서 최종 이동' })).toHaveProperty('disabled', true);
  api.post.mockResolvedValue({ data: { ...reviewed(), userId: 42 } });
  fireEvent.click(screen.getByRole('button', { name: '이동 요청 검토' }));
  await screen.findByText(/검토한 직원 #42/);
  check(/대상 조직의 수락과 최신 버전/);
  expect(screen.getByRole('button', { name: '현재 조직에서 최종 이동' })).toHaveProperty('disabled', true);
});
it('validates the review read contract and sends only the code', async () => {
  api.post.mockResolvedValue({ data: reviewed() });
  await expect(reviewStaffTransfer(code)).resolves.toMatchObject({ userId: 99, sourceVersion: 3, targetVersion: 6 });
  expect(api.post).toHaveBeenCalledWith('/enterprise/staff-transfer/review', { code });
  api.post.mockResolvedValue({ data: { ...reviewed(), targetVersion: '6' } });
  await expect(reviewStaffTransfer(code)).rejects.toMatchObject({ kind: 'invalid' });
  api.post.mockResolvedValue({ data: { ...reviewed(), hash: code } });
  await expect(reviewStaffTransfer(code)).rejects.toMatchObject({ kind: 'invalid' });
  await expect(reviewStaffTransfer('invalid')).rejects.toMatchObject({ kind: 'invalid' });
  expect(api.post).toHaveBeenCalledTimes(3);
});
it.each([undefined, '', 'A'.repeat(64), 'a'.repeat(63), 'g'.repeat(64)])(
  'rejects missing or malformed review basis %s for review and completion',
  async invalidBasis => {
    api.post.mockResolvedValue({ data: { ...reviewed(), reviewBasis: invalidBasis } });
    await expect(reviewStaffTransfer(code)).rejects.toMatchObject({ kind: 'invalid' });
    api.post.mockClear();
    await expect(
      completeStaffTransfer({ code, expectedVersion: 3, targetExpectedVersion: 6, reviewBasis: invalidBasis as string }),
    ).rejects.toMatchObject({ kind: 'invalid' });
    expect(api.post).not.toHaveBeenCalled();
  },
);
it('sends the exact captured review basis and requires a fresh review after an acceptance overwrite conflict', async () => {
  let currentBasis = basis;
  const captured: unknown[] = [];
  api.post.mockImplementation((url: string, body: any) => {
    if (url.endsWith('/review')) return Promise.resolve({ data: { ...reviewed(), reviewBasis: currentBasis } });
    captured.push(body);
    return Promise.reject({ response: { status: 409 } });
  });
  render(<StaffTransfer context={context('admin')} onReload={vi.fn()} />);
  await open();
  input('직원이 전달한 이동 코드', code);
  await reviewCode();
  currentBasis = 'c'.repeat(64); // Another acceptance changes the server basis after this review.
  check(/대상 조직의 수락과 최신 버전/);
  fireEvent.click(screen.getByRole('button', { name: '현재 조직에서 최종 이동' }));
  await screen.findByText(/처리 결과가 확정되지 않았습니다/);
  expect(captured).toEqual([{ code, expectedVersion: 3, targetExpectedVersion: 6, reviewBasis: basis }]);
  expect(screen.queryByText(/검토한 직원/)).toBeNull();
  expect(screen.getByRole('checkbox', { name: /대상 조직의 수락과 최신 버전/ })).toHaveProperty('checked', false);
  expect(screen.getByRole('button', { name: '현재 조직에서 최종 이동' })).toHaveProperty('disabled', true);
});
