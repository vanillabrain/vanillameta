import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Enterprise from './index';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), del: vi.fn() }));
vi.mock('@/helpers/apiHelper', () => ({ get: api.get, post: api.post, patch: api.patch, del: api.del }));

const raw = (data: unknown) => ({ data });
const status = (code: number) => ({ response: { status: code } });
const offline = () => new Error('Network Error');
const EXPIRES = '2026-10-18T11:00:00.000Z';

/** A real acceptance code is a 64-character lowercase hex digest, and the member login id is a string. */
const CODE = '9f2c41'.repeat(10) + 'abcd';
const loginId = (n: number) => `synthetic-${n}`;

const member = (id: number, userId = loginId(id), team = 'growth', role: 'admin' | 'member' = 'member', active = true) => ({
  id,
  userId,
  team,
  role,
  active,
});

const context = (role: 'admin' | 'member' = 'member', version = 3) => ({
  organization: { id: 7, name: '바닐라메타', version },
  membership: { userId: 42, role, team: 'platform' },
});

const page = (entries: ReturnType<typeof member>[], organizationVersion = 3, nextAfterId: number | null = null) => ({
  organizationVersion,
  entries,
  nextAfterId,
});

const nameField = () => screen.getByLabelText(/^새 조직 이름/) as HTMLInputElement;
/** Scope the edit inputs to the one open row; the add form repeats the same labels. */
const editRow = (login: string) =>
  screen.getByRole('button', { name: `로그인 ID ${login} 변경` }).closest('li') as HTMLElement;
const editTeam = (login: string) => within(editRow(login)).getByLabelText(/^팀$/) as HTMLInputElement;
const editRole = (login: string) => within(editRow(login)).getByLabelText(/^역할$/) as HTMLSelectElement;
const editAgree = (login: string) => within(editRow(login)).getByRole('checkbox', { name: /위 변경/ }) as HTMLInputElement;
const alertText = async () => (await screen.findByRole('alert')).textContent ?? '';

/** The context GET always answers first; list loads queue their own pages. */
const serveContext = (value: unknown) => api.get.mockResolvedValueOnce(raw(value));

beforeEach(() => {
  api.get.mockReset();
  api.post.mockReset();
  api.patch.mockReset();
  api.del.mockReset();
});
afterEach(cleanup);

it('asks an unaffiliated account to create one isolated organization and keeps the typed name after failure', async () => {
  serveContext({ organization: null, membership: null });
  api.post.mockRejectedValueOnce(offline());
  render(<Enterprise />);

  await screen.findByLabelText(/^새 조직 이름/);
  expect(api.get).toHaveBeenCalledWith('/enterprise/context', undefined, expect.anything());
  expect(screen.queryByText('직원 목록')).toBeNull();

  fireEvent.change(nameField(), { target: { value: ' 바닐라메타 ' } });
  fireEvent.click(screen.getByRole('button', { name: '조직 만들기' }));
  expect(await alertText()).toMatch(/서버와 통신하지 못했습니다/);
  expect(api.post).toHaveBeenCalledWith('/enterprise/organizations', { name: '바닐라메타' });
  expect(nameField().value).toBe(' 바닐라메타 ');
  expect(api.post).toHaveBeenCalledTimes(1);
});

it('shows only the account’s own organization context to a member, with no staff controls', async () => {
  serveContext(context('member'));
  render(<Enterprise />);

  await screen.findByText('바닐라메타');
  expect(screen.getByText('member (구성원)')).toBeTruthy();
  expect(screen.getByText(/직원 관리에서는 본인 소속만 확인할 수 있습니다/)).toBeTruthy();
  expect(screen.queryByText('직원 목록')).toBeNull();
  expect(screen.queryByText('기존 계정 추가')).toBeNull();
  expect(screen.queryByRole('button', { name: '조직 연결 코드 발급' })).toBeNull();
  expect(api.get).toHaveBeenCalledTimes(1);
});

it('issues a one-time connection code only for the organization number the recipient types, and can revoke it', async () => {
  serveContext({ organization: null, membership: null });
  api.post.mockResolvedValueOnce(
    raw({ enrollmentCode: CODE, expiresAt: EXPIRES, organization: { id: 7, name: '바닐라메타' } }),
  );
  render(<Enterprise />);

  const target = (await screen.findByLabelText(/^참여할 조직 번호/)) as HTMLInputElement;
  const issue = () => screen.getByRole('button', { name: '조직 연결 코드 발급' }) as HTMLButtonElement;
  expect(api.post).not.toHaveBeenCalled();
  expect(issue().disabled).toBe(true);

  // A non-numeric organization number never reaches the server.
  fireEvent.change(target, { target: { value: 'abc' } });
  fireEvent.click(issue());
  expect(await alertText()).toMatch(/참여할 조직 번호\(양의 정수\)를 입력해 주세요/);
  expect(api.post).not.toHaveBeenCalled();

  fireEvent.change(target, { target: { value: '7' } });
  fireEvent.click(issue());

  const code = (await screen.findByLabelText(/^발급된 연결 코드/)) as HTMLInputElement;
  expect(code.value).toBe(CODE);
  expect(code.readOnly).toBe(true);
  expect(api.post).toHaveBeenCalledTimes(1);
  expect(api.post).toHaveBeenCalledWith('/enterprise/enrollment', { organizationId: 7 });
  expect(screen.getByText(/조직 “바닐라메타” \(#7\) 전용 코드입니다/)).toBeTruthy();
  expect(screen.getByText(/화면을 벗어나면 다시 볼 수 없습니다/)).toBeTruthy();
  expect(screen.getByText(/15분 · 1회/)).toBeTruthy();

  // A failed revoke keeps the code visible so the recipient can retry.
  api.del.mockRejectedValueOnce(offline());
  fireEvent.click(screen.getByRole('button', { name: '코드 중지' }));
  expect(await alertText()).toMatch(/서버와 통신하지 못했습니다/);
  expect((screen.getByLabelText(/^발급된 연결 코드/) as HTMLInputElement).value).toBe(CODE);

  api.del.mockResolvedValueOnce(raw({ revoked: true }));
  fireEvent.click(screen.getByRole('button', { name: '코드 중지' }));
  await screen.findByText(/조직 연결 코드를 중지했습니다/);
  expect(api.del).toHaveBeenCalledWith('/enterprise/enrollment');
  expect(screen.queryByLabelText(/^발급된 연결 코드/)).toBeNull();
});

it('loads the admin member list 20 at a time and continues from the returned cursor', async () => {
  serveContext(context('admin'));
  api.get.mockResolvedValueOnce(
    raw(
      page(
        Array.from({ length: 20 }, (_, index) => member(index + 1)),
        3,
        20,
      ),
    ),
  );
  api.get.mockResolvedValueOnce(raw(page([member(21)], 3, null)));
  render(<Enterprise />);

  await screen.findByText(/현재 20명 표시/);
  expect(api.get).toHaveBeenNthCalledWith(2, '/enterprise/members', {}, expect.anything());
  expect(screen.getByText(/다음 페이지 있음/)).toBeTruthy();

  const more = screen.getByRole('button', { name: '다음 20명 더 보기' }) as HTMLButtonElement;
  fireEvent.click(more);
  await waitFor(() => expect(api.get).toHaveBeenCalledTimes(3));
  expect(api.get).toHaveBeenNthCalledWith(3, '/enterprise/members', { afterId: 20 }, {});
  await screen.findByText(/현재 21명 표시/);
  expect(screen.getByText(/마지막 페이지/)).toBeTruthy();
  expect((screen.getByRole('button', { name: '다음 20명 더 보기' }) as HTMLButtonElement).disabled).toBe(true);
});

it('adds an existing account only with its enrollment code and an explicit confirmation that any edit resets', async () => {
  serveContext(context('admin'));
  api.get.mockResolvedValueOnce(raw(page([])));
  api.post.mockResolvedValueOnce(raw({ organizationVersion: 4, member: member(9, loginId(555), 'data', 'admin') }));
  api.get.mockResolvedValueOnce(raw(page([member(9, loginId(555), 'data', 'admin')], 4, null)));
  render(<Enterprise />);

  const form = (await screen.findByText('기존 계정 추가')).closest('form') as HTMLFormElement;
  const userId = within(form).getByLabelText(/^로그인 ID \(userId\)/) as HTMLInputElement;
  const team = within(form).getByLabelText(/^팀$/) as HTMLInputElement;
  const role = within(form).getByLabelText(/^역할$/) as HTMLSelectElement;
  const enrollment = within(form).getByLabelText(/^연결 코드/) as HTMLInputElement;
  const agree = () =>
    within(form).getByRole('checkbox', { name: /이 계정이 발급한 연결 코드를 함께 전송합니다/ }) as HTMLInputElement;
  const submit = () => within(form).getByRole('button', { name: '직원 추가' }) as HTMLButtonElement;

  fireEvent.change(userId, { target: { value: '555' } });
  fireEvent.change(team, { target: { value: 'data' } });
  fireEvent.change(role, { target: { value: 'admin' } });

  // Without the recipient's code the submit stays unavailable and no request is attempted.
  fireEvent.click(agree());
  expect(enrollment.value).toBe('');
  expect(submit().disabled).toBe(true);
  expect(api.post).not.toHaveBeenCalled();

  // A mistyped code never leaves the client either.
  fireEvent.change(enrollment, { target: { value: 'VM-ENROLL-9f2c41' } });
  fireEvent.click(agree());
  expect(submit().disabled).toBe(false);
  fireEvent.click(submit());
  expect(await alertText()).toMatch(/연결 코드 형식이 올바르지 않습니다/);
  expect(api.post).not.toHaveBeenCalled();

  fireEvent.change(enrollment, { target: { value: CODE } });
  expect(submit().disabled).toBe(true);
  fireEvent.click(agree());
  expect(api.post).not.toHaveBeenCalled();
  fireEvent.change(team, { target: { value: 'data-platform' } });
  expect(submit().disabled).toBe(true);
  expect(api.post).not.toHaveBeenCalled();

  fireEvent.click(agree());
  fireEvent.click(submit());
  await screen.findByText(`로그인 ID ${loginId(555)} 계정을 admin (관리자)로 추가했습니다.`);
  expect(api.post).toHaveBeenCalledTimes(1);
  expect(api.post).toHaveBeenCalledWith('/enterprise/members', {
    userId: '555',
    team: 'data-platform',
    role: 'admin',
    enrollmentCode: CODE,
    expectedVersion: 3,
  });
  await screen.findByText(/현재 1명 표시/);
});

it('keeps the edited row open with its inputs on failure and resets the agreement for a conflict', async () => {
  serveContext(context('admin'));
  api.get.mockResolvedValueOnce(raw(page([member(4, loginId(41), 'growth', 'member')])));
  api.patch.mockRejectedValueOnce(offline());
  render(<Enterprise />);

  fireEvent.click(await screen.findByRole('button', { name: `로그인 ID ${loginId(41)} 변경` }));
  fireEvent.change(editTeam(loginId(41)), { target: { value: 'data' } });
  fireEvent.change(editRole(loginId(41)), { target: { value: 'admin' } });
  expect(screen.getByText(/변경 요약: 팀 growth → data · 역할 member \(구성원\) → admin \(관리자\)/)).toBeTruthy();

  const agree = editAgree(loginId(41));
  const save = () => screen.getByRole('button', { name: '변경 저장' }) as HTMLButtonElement;
  expect(save().disabled).toBe(true);
  fireEvent.click(agree);
  fireEvent.click(save());
  await waitFor(() => expect(api.patch).toHaveBeenCalledTimes(1));
  expect(await alertText()).toMatch(/서버와 통신하지 못했습니다/);
  expect(api.patch).toHaveBeenCalledWith('/enterprise/members/4', {
    team: 'data',
    role: 'admin',
    active: true,
    expectedVersion: 3,
  });
  expect(editTeam(loginId(41)).value).toBe('data');
  expect(editRole(loginId(41)).value).toBe('admin');
  expect(editAgree(loginId(41)).checked).toBe(true);

  api.patch.mockRejectedValueOnce(status(409));
  fireEvent.click(save());
  await waitFor(() => expect(api.patch).toHaveBeenCalledTimes(2));
  expect(await alertText()).toMatch(/조직 정보가 변경되었습니다. 최신 정보를 다시 불러와 주세요/);
  expect(editTeam(loginId(41)).value).toBe('data');
});

it('saves a confirmed role and active change for the exact row', async () => {
  serveContext(context('admin'));
  api.get.mockResolvedValueOnce(raw(page([member(4, loginId(41))])));
  api.patch.mockResolvedValueOnce(raw({ organizationVersion: 4, member: member(4, loginId(41), 'growth', 'admin', false) }));
  render(<Enterprise />);

  fireEvent.click(await screen.findByRole('button', { name: `로그인 ID ${loginId(41)} 변경` }));
  fireEvent.change(editRole(loginId(41)), { target: { value: 'admin' } });
  fireEvent.click(screen.getByRole('checkbox', { name: '계정 활성' }));
  fireEvent.click(editAgree(loginId(41)));
  fireEvent.click(screen.getByRole('button', { name: '변경 저장' }));

  await screen.findByText('변경 내용을 저장했습니다.');
  expect(api.patch).toHaveBeenCalledTimes(1);
  expect(api.patch).toHaveBeenCalledWith('/enterprise/members/4', {
    team: 'growth',
    role: 'admin',
    active: false,
    expectedVersion: 3,
  });
  const row = (await screen.findByText(`로그인 ID ${loginId(41)}`)).closest('li') as HTMLElement;
  expect(within(row).getByText('역할 admin (관리자)')).toBeTruthy();
  expect(within(row).queryByLabelText(/^팀$/)).toBeNull();
});

it('hides the member list when the server refuses the staff read with 403', async () => {
  serveContext(context('admin'));
  api.get.mockRejectedValueOnce(status(403));
  render(<Enterprise />);

  expect(await alertText()).toMatch(/권한이 없습니다/);
  expect(screen.queryByText('기존 계정 추가')).toBeNull();
  expect(screen.queryByRole('button', { name: '다음 20명 더 보기' })).toBeNull();
});

it('shows a reload-only guidance when the organization context itself cannot be read', async () => {
  api.get.mockRejectedValueOnce(offline());
  render(<Enterprise />);

  expect(await alertText()).toMatch(/서버와 통신하지 못했습니다/);
  expect(screen.queryByLabelText(/^새 조직 이름/)).toBeNull();
  expect(screen.queryByText('직원 목록')).toBeNull();
  api.get.mockResolvedValueOnce(raw(context('member')));
  fireEvent.click(screen.getByRole('button', { name: '조직 정보 다시 불러오기' }));
  await screen.findByText('바닐라메타');
  expect(api.get).toHaveBeenCalledTimes(2);
  expect(api.get).toHaveBeenLastCalledWith('/enterprise/context', undefined, expect.anything());
});

it('does not send any write request on mount beyond the reads it needs', async () => {
  serveContext({ organization: null, membership: null });
  render(<Enterprise />);
  await screen.findByLabelText(/^새 조직 이름/);
  await waitFor(() => expect(api.get).toHaveBeenCalledTimes(1));
  expect(api.post).not.toHaveBeenCalled();
  expect(api.patch).not.toHaveBeenCalled();
});

it('withdraws the whole directory and its controls when a role write is refused with 403', async () => {
  serveContext(context('admin'));
  api.get.mockResolvedValueOnce(raw(page([member(4, loginId(41), 'growth', 'member')])));
  api.patch.mockRejectedValueOnce(status(403));
  render(<Enterprise />);

  fireEvent.click(await screen.findByRole('button', { name: `로그인 ID ${loginId(41)} 변경` }));
  fireEvent.change(editRole(loginId(41)), { target: { value: 'admin' } });
  fireEvent.click(editAgree(loginId(41)));
  fireEvent.click(screen.getByRole('button', { name: '변경 저장' }));

  expect(await alertText()).toMatch(/권한이 없습니다/);
  // The stale directory and every control that could write to it must be gone, not just flagged.
  expect(screen.queryByText(`로그인 ID ${loginId(41)}`)).toBeNull();
  expect(screen.queryByText('기존 계정 추가')).toBeNull();
  expect(screen.queryByRole('button', { name: '다음 20명 더 보기' })).toBeNull();
  expect(api.patch).toHaveBeenCalledTimes(1);
});

it('drops a later page that belongs to a different organization version instead of mixing snapshots', async () => {
  serveContext(context('admin'));
  api.get.mockResolvedValueOnce(raw(page([member(1)], 3, 20)));
  api.get.mockResolvedValueOnce(raw(page([member(21)], 4, null)));
  // The prompted reload keeps answering with the current organization version.
  api.get.mockResolvedValue(raw(page([], 4, null)));
  render(<Enterprise />);

  await screen.findByText(/현재 1명 표시/);
  fireEvent.click(screen.getByRole('button', { name: '다음 20명 더 보기' }));
  // The mismatched page is dropped and nothing from it is mixed into the previous snapshot.
  await screen.findByText(/현재 0명 표시/);
  expect(screen.queryByText(`로그인 ID ${loginId(21)}`)).toBeNull();
  expect(screen.getByText(/현재 0명 표시/)).toBeTruthy();
});
