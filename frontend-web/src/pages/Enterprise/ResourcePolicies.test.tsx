import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ResourcePolicies from './ResourcePolicies';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), del: vi.fn() }));
vi.mock('@/helpers/apiHelper', () => ({ get: api.get, post: api.post, patch: api.patch, del: api.del }));

const raw = (data: unknown) => ({ data });
const status = (code: number) => ({ response: { status: code } });
const offline = () => new Error('Network Error');

const resource = (kind: 'source' | 'dashboard', id: number, label: string) => ({ kind, id, label });
const resourcePage = (entries: any[], nextAfter: string | null = null) => ({ entries, nextAfter });
const rights = (read: boolean, edit = false, publish = false, exportRight = false) => ({
  read,
  edit,
  publish,
  export: exportRight,
});
const grant = (recipientId: number, userId: string, version: number, value: ReturnType<typeof rights>) => ({
  recipientId,
  userId,
  version,
  rights: value,
});
const policyList = (kind: 'source' | 'dashboard', resourceId: number, entries: any[]) => ({
  kind,
  resourceId,
  entries,
});
const member = (id: number, userId: string, active = true) => ({ id, userId, team: 'growth', role: 'member', active });
const memberPage = (entries: any[], nextAfterId: number | null = null) => ({
  organizationVersion: 3,
  entries,
  nextAfterId,
});
const receipt = (
  kind: 'source' | 'dashboard',
  resourceId: number,
  recipientId: number,
  version: number,
  value: ReturnType<typeof rights>,
) => ({ kind, resourceId, recipientId, version, rights: value });

const openPanel = () => fireEvent.click(screen.getByRole('button', { name: '자원별 권한 관리 열기' }));
const resourceButton = (kindLabel: string, label: string, id: number) =>
  screen.getByRole('button', { name: `권한 관리: ${kindLabel} ${label} #${id}` });
const rightsBox = (label: string) => screen.getByRole('checkbox', { name: label }) as HTMLInputElement;
const saveButton = () => screen.getByRole('button', { name: /^(권한 저장|저장 중…)$/ }) as HTMLButtonElement;
const ackBox = () => screen.getByRole('checkbox', { name: /동의합니다/ }) as HTMLInputElement;
const recipientSelect = () => screen.getByLabelText(/^수신자\(직원\)$/) as HTMLSelectElement;
/** Notices nest their text, so read the alert roles instead of matching a duplicated string. */
const alerts = async () => (await screen.findAllByRole('alert')).map(node => node.textContent ?? '').join(' | ');

beforeEach(() => {
  api.get.mockReset();
  api.post.mockReset();
  api.patch.mockReset();
  api.del.mockReset();
});
afterEach(cleanup);

it('keeps the grant editor collapsed until an admin opens it, and reads nothing before then', async () => {
  api.get.mockResolvedValueOnce(raw(resourcePage([resource('dashboard', 12, '매출 대시보드')])));
  render(<ResourcePolicies organizationId={7} />);

  const toggle = screen.getByRole('button', { name: '자원별 권한 관리 열기' });
  expect(toggle.getAttribute('aria-expanded')).toBe('false');
  expect(api.get).not.toHaveBeenCalled();

  openPanel();
  expect(screen.getByRole('button', { name: '자원별 권한 접기' }).getAttribute('aria-expanded')).toBe('true');
  await screen.findByText('매출 대시보드');
  expect(api.get).toHaveBeenCalledTimes(1);
  expect(api.get).toHaveBeenCalledWith('/enterprise/resources', {}, expect.anything());
});

it('pages the owned resources with the returned cursor and stops at the last page', async () => {
  api.get.mockResolvedValueOnce(raw(resourcePage([resource('dashboard', 12, '매출 대시보드')], 'source:5')));
  api.get.mockResolvedValueOnce(raw(resourcePage([resource('source', 5, '주문 소스')], null)));
  render(<ResourcePolicies organizationId={7} />);
  openPanel();
  await screen.findByText('매출 대시보드');

  fireEvent.click(screen.getByRole('button', { name: '다음 20개 더 보기' }));
  await screen.findByText('주문 소스');
  expect(api.get).toHaveBeenNthCalledWith(2, '/enterprise/resources', { after: 'source:5' }, expect.anything());
  await waitFor(() =>
    expect((screen.getByRole('button', { name: '다음 20개 더 보기' }) as HTMLButtonElement).disabled).toBe(true),
  );
});

it('reads the stored grants and the current organization staff only for the selected resource', async () => {
  api.get.mockResolvedValueOnce(raw(resourcePage([resource('dashboard', 12, '매출 대시보드')])));
  api.get.mockResolvedValueOnce(raw(policyList('dashboard', 12, [grant(9, 'synthetic-9', 2, rights(true, true))])));
  api.get.mockResolvedValueOnce(raw(memberPage([member(9, 'synthetic-9'), member(11, 'synthetic-11', false)])));
  render(<ResourcePolicies organizationId={7} />);
  openPanel();
  await screen.findByText('매출 대시보드');
  expect(api.get).toHaveBeenCalledTimes(1);

  fireEvent.click(resourceButton('대시보드', '매출 대시보드', 12));
  await screen.findByText('로그인 ID synthetic-9');
  expect(api.get).toHaveBeenNthCalledWith(2, '/enterprise/resources/dashboard/12/policies', undefined, expect.anything());
  expect(screen.getByText('권한 읽기 · 편집')).toBeTruthy();
  expect(screen.getByText('버전 2')).toBeTruthy();
  expect(api.get).toHaveBeenCalledTimes(2);

  fireEvent.click(screen.getByRole('button', { name: '새 수신자에게 권한 부여' }));
  await waitFor(() => expect(api.get).toHaveBeenCalledTimes(3));
  expect(api.get).toHaveBeenNthCalledWith(3, '/enterprise/members', {}, expect.anything());
  expect(screen.getByText('현재 조직(#7)의 직원만 지정할 수 있습니다.')).toBeTruthy();
});

it('shows the reading admin in the staff page but never offers their own account as a recipient', async () => {
  api.get.mockResolvedValueOnce(raw(resourcePage([resource('dashboard', 12, '매출 대시보드')])));
  api.get.mockResolvedValueOnce(raw(policyList('dashboard', 12, [grant(9, 'synthetic-me', 2, rights(true))])));
  api.get.mockResolvedValueOnce(raw(memberPage([member(9, 'synthetic-me'), member(11, 'synthetic-other')])));
  render(<ResourcePolicies organizationId={7} selfRecipientId={9} />);
  openPanel();
  await screen.findByText('매출 대시보드');
  fireEvent.click(resourceButton('대시보드', '매출 대시보드', 12));
  await screen.findByText('로그인 ID synthetic-me');

  // A stored self grant stays visible, but the server refuses it, so it cannot be edited from here.
  expect(screen.getByText('본인(권한 변경 불가)')).toBeTruthy();
  expect((screen.getByRole('button', { name: '권한 변경: 로그인 ID synthetic-me' }) as HTMLButtonElement).disabled).toBe(
    true,
  );

  fireEvent.click(screen.getByRole('button', { name: '새 수신자에게 권한 부여' }));
  expect(((await screen.findByRole('option', { name: /synthetic-me/ })) as HTMLOptionElement).disabled).toBe(true);
  expect((screen.getByRole('option', { name: 'synthetic-other' }) as HTMLOptionElement).disabled).toBe(false);
  expect(api.post).not.toHaveBeenCalled();
});

it('lets the admin retry a failed staff read before picking a new recipient', async () => {
  api.get.mockResolvedValueOnce(raw(resourcePage([resource('dashboard', 12, '매출 대시보드')])));
  api.get.mockResolvedValueOnce(raw(policyList('dashboard', 12, [])));
  api.get.mockRejectedValueOnce(offline());
  api.get.mockResolvedValueOnce(raw(memberPage([member(9, 'synthetic-9')])));
  render(<ResourcePolicies organizationId={7} />);
  openPanel();
  await screen.findByText('매출 대시보드');
  fireEvent.click(resourceButton('대시보드', '매출 대시보드', 12));
  await screen.findByText('아직 이 자원에 부여된 권한이 없습니다.');
  fireEvent.click(screen.getByRole('button', { name: '새 수신자에게 권한 부여' }));

  expect(await alerts()).toMatch(/서버와 통신하지 못했습니다/);
  expect(screen.queryByRole('option', { name: 'synthetic-9' })).toBeNull();

  fireEvent.click(screen.getByRole('button', { name: '직원 목록 다시 불러오기' }));
  await screen.findByRole('option', { name: 'synthetic-9' });
  expect(api.get).toHaveBeenNthCalledWith(4, '/enterprise/members', {}, expect.anything());
});

it('refuses source publishing and keeps edit/publish/export behind read', async () => {
  api.get.mockResolvedValueOnce(raw(resourcePage([resource('source', 5, '주문 소스')])));
  api.get.mockResolvedValueOnce(raw(policyList('source', 5, [])));
  api.get.mockResolvedValueOnce(raw(memberPage([member(9, 'synthetic-9')])));
  render(<ResourcePolicies organizationId={7} />);
  openPanel();
  await screen.findByText('주문 소스');
  fireEvent.click(resourceButton('데이터 소스', '주문 소스', 5));
  await screen.findByText('아직 이 자원에 부여된 권한이 없습니다.');
  fireEvent.click(screen.getByRole('button', { name: '새 수신자에게 권한 부여' }));
  await waitFor(() => expect(api.get).toHaveBeenCalledTimes(3));
  await screen.findByRole('option', { name: 'synthetic-9' });
  fireEvent.change(recipientSelect(), { target: { value: '9' } });

  // A new grant starts as read-only.
  expect(rightsBox('읽기').checked).toBe(true);
  expect(rightsBox('편집').checked).toBe(false);
  expect(rightsBox('편집').disabled).toBe(false);
  // A source grant can never publish, so the checkbox is disabled and false.
  expect(rightsBox('게시').disabled).toBe(true);
  expect(rightsBox('게시').checked).toBe(false);
  expect(screen.getByText(/데이터 소스는 게시 권한을 지원하지 않습니다/)).toBeTruthy();

  fireEvent.click(rightsBox('편집'));
  expect(rightsBox('편집').checked).toBe(true);

  // Turning read off also clears and disables the three dependents.
  fireEvent.click(rightsBox('읽기'));
  expect(rightsBox('읽기').checked).toBe(false);
  expect(rightsBox('편집').checked).toBe(false);
  expect(rightsBox('편집').disabled).toBe(true);
  expect(rightsBox('게시').disabled).toBe(true);
  expect(rightsBox('내보내기').disabled).toBe(true);
  expect(api.post).not.toHaveBeenCalled();
});

it('sends a new grant as version 0 only after an explicit summary and consent, and resets consent on every edit', async () => {
  api.get.mockResolvedValueOnce(raw(resourcePage([resource('dashboard', 12, '매출 대시보드')])));
  api.get.mockResolvedValueOnce(raw(policyList('dashboard', 12, [])));
  api.get.mockResolvedValueOnce(raw(memberPage([member(9, 'synthetic-9')])));
  api.post.mockResolvedValueOnce(raw(receipt('dashboard', 12, 9, 1, rights(true, true, false, true))));
  render(<ResourcePolicies organizationId={7} />);
  openPanel();
  await screen.findByText('매출 대시보드');
  fireEvent.click(resourceButton('대시보드', '매출 대시보드', 12));
  await screen.findByText('아직 이 자원에 부여된 권한이 없습니다.');
  fireEvent.click(screen.getByRole('button', { name: '새 수신자에게 권한 부여' }));
  await waitFor(() => expect(api.get).toHaveBeenCalledTimes(3));
  await screen.findByRole('option', { name: 'synthetic-9' });
  fireEvent.change(recipientSelect(), { target: { value: '9' } });

  expect(screen.getByText(/변경 요약: 새 권한: 읽기\./)).toBeTruthy();
  expect(saveButton().disabled).toBe(true);

  fireEvent.click(rightsBox('편집'));
  fireEvent.click(ackBox());
  expect(saveButton().disabled).toBe(false);

  // Any later right change re-opens the agreement step.
  fireEvent.click(rightsBox('내보내기'));
  expect(ackBox().checked).toBe(false);
  expect(saveButton().disabled).toBe(true);

  fireEvent.click(ackBox());
  fireEvent.click(saveButton());
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
  const [url, body] = api.post.mock.calls[0];
  expect(url).toBe('/enterprise/resources/dashboard/12/policies');
  expect(Object.keys(body).sort()).toEqual(['expectedVersion', 'recipientId', 'rights']);
  expect(body).toEqual({
    recipientId: 9,
    expectedVersion: 0,
    rights: { read: true, edit: true, publish: false, export: true },
  });

  await screen.findByText(/권한을 저장했습니다\(버전 1 · 읽기 · 편집 · 내보내기\)/);
  expect(screen.getByText('버전 1')).toBeTruthy();
  expect(screen.queryByRole('button', { name: /^(권한 저장|저장 중…)$/ })).toBeNull();
});

it('compares an existing grant against its stored version and saves only a confirmed diff', async () => {
  api.get.mockResolvedValueOnce(raw(resourcePage([resource('dashboard', 12, '매출 대시보드')])));
  api.get.mockResolvedValueOnce(raw(policyList('dashboard', 12, [grant(9, 'synthetic-9', 2, rights(true))])));
  api.post.mockResolvedValueOnce(raw(receipt('dashboard', 12, 9, 3, rights(true, false, false, true))));
  render(<ResourcePolicies organizationId={7} />);
  openPanel();
  await screen.findByText('매출 대시보드');
  fireEvent.click(resourceButton('대시보드', '매출 대시보드', 12));
  await screen.findByText('로그인 ID synthetic-9');

  fireEvent.click(screen.getByRole('button', { name: '권한 변경: 로그인 ID synthetic-9' }));
  expect(screen.getByText(/기존 권한 버전 2/)).toBeTruthy();
  // Nothing changed yet, so there is neither a summary nor a writable path.
  expect(screen.getByText(/변경된 권한이 없습니다/)).toBeTruthy();
  expect(saveButton().disabled).toBe(true);

  fireEvent.click(rightsBox('내보내기'));
  expect(screen.getByText(/변경 요약: 내보내기 아니오 → 예/)).toBeTruthy();
  fireEvent.click(ackBox());
  fireEvent.click(saveButton());
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
  expect(api.post.mock.calls[0][1]).toEqual({
    recipientId: 9,
    expectedVersion: 2,
    rights: { read: true, edit: false, publish: false, export: true },
  });
  await screen.findByText(/권한을 저장했습니다\(버전 3/);
});

it('revokes every right of a stored grant whose target is gone from the staff list', async () => {
  api.get.mockResolvedValueOnce(raw(resourcePage([resource('dashboard', 12, '매출 대시보드')])));
  api.get.mockResolvedValueOnce(raw(policyList('dashboard', 12, [grant(9, 'synthetic-9', 5, rights(true, true))])));
  api.get.mockResolvedValueOnce(raw(memberPage([member(11, 'synthetic-11')])));
  api.post.mockResolvedValueOnce(raw(receipt('dashboard', 12, 9, 6, rights(false))));
  render(<ResourcePolicies organizationId={7} />);
  openPanel();
  await screen.findByText('매출 대시보드');
  fireEvent.click(resourceButton('대시보드', '매출 대시보드', 12));
  await screen.findByText('로그인 ID synthetic-9');
  fireEvent.click(screen.getByRole('button', { name: '새 수신자에게 권한 부여' }));
  await waitFor(() => expect(api.get).toHaveBeenCalledTimes(3));

  // The left account is not offered as a new target, but its stored grant stays editable.
  expect(screen.queryByRole('option', { name: 'synthetic-9' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '권한 변경: 로그인 ID synthetic-9' }));
  expect(screen.getByText(/수신자가 비활성이거나 조직을 떠난 뒤에도/)).toBeTruthy();

  fireEvent.click(rightsBox('읽기'));
  fireEvent.click(rightsBox('편집'));
  expect(screen.getByText(/모든 권한을 끈 상태로 저장하면/)).toBeTruthy();
  fireEvent.click(ackBox());
  fireEvent.click(saveButton());
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
  expect(api.post.mock.calls[0][1]).toEqual({
    recipientId: 9,
    expectedVersion: 5,
    rights: { read: false, edit: false, publish: false, export: false },
  });
  await screen.findByText(/권한을 저장했습니다\(버전 6 · 권한 없음\)/);
  expect(screen.getByText('권한 없음')).toBeTruthy();
});

it('keeps the draft and the agreement when the write never reaches the server', async () => {
  api.get.mockResolvedValueOnce(raw(resourcePage([resource('dashboard', 12, '매출 대시보드')])));
  api.get.mockResolvedValueOnce(raw(policyList('dashboard', 12, [grant(9, 'synthetic-9', 2, rights(true))])));
  api.post.mockRejectedValueOnce(offline());
  render(<ResourcePolicies organizationId={7} />);
  openPanel();
  await screen.findByText('매출 대시보드');
  fireEvent.click(resourceButton('대시보드', '매출 대시보드', 12));
  await screen.findByText('로그인 ID synthetic-9');
  fireEvent.click(screen.getByRole('button', { name: '권한 변경: 로그인 ID synthetic-9' }));
  fireEvent.click(rightsBox('내보내기'));
  fireEvent.click(ackBox());
  fireEvent.click(saveButton());

  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
  expect(await alerts()).toMatch(/서버와 통신하지 못했습니다/);
  expect(rightsBox('내보내기').checked).toBe(true);
  expect(ackBox().checked).toBe(true);
  expect(saveButton().disabled).toBe(false);

  api.post.mockResolvedValueOnce(raw(receipt('dashboard', 12, 9, 3, rights(true, false, false, true))));
  fireEvent.click(saveButton());
  await screen.findByText(/권한을 저장했습니다\(버전 3/);
  expect(api.post).toHaveBeenCalledTimes(2);
  expect(api.post.mock.calls[1][1].expectedVersion).toBe(2);
});

it('holds a conflicted draft until the grants are re-read, then saves against the fresh version', async () => {
  api.get.mockResolvedValueOnce(raw(resourcePage([resource('dashboard', 12, '매출 대시보드')])));
  api.get.mockResolvedValueOnce(raw(policyList('dashboard', 12, [grant(9, 'synthetic-9', 2, rights(true))])));
  api.post.mockRejectedValueOnce(status(409));
  render(<ResourcePolicies organizationId={7} />);
  openPanel();
  await screen.findByText('매출 대시보드');
  fireEvent.click(resourceButton('대시보드', '매출 대시보드', 12));
  await screen.findByText('로그인 ID synthetic-9');
  fireEvent.click(screen.getByRole('button', { name: '권한 변경: 로그인 ID synthetic-9' }));
  fireEvent.click(rightsBox('내보내기'));
  fireEvent.click(ackBox());
  fireEvent.click(saveButton());

  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
  expect(await alerts()).toMatch(/다른 곳에서 먼저 변경되었습니다/);
  expect(screen.getByText(/입력한 권한은 그대로 두었습니다/)).toBeTruthy();
  // The chosen rights survive, but the write is locked until the stored version is re-read.
  expect(rightsBox('내보내기').checked).toBe(true);
  expect(ackBox().checked).toBe(false);
  expect(saveButton().disabled).toBe(true);
  expect(api.post).toHaveBeenCalledTimes(1);

  api.get.mockResolvedValueOnce(raw(policyList('dashboard', 12, [grant(9, 'synthetic-9', 4, rights(true))])));
  fireEvent.click(screen.getByRole('button', { name: '정책 다시 불러오기' }));
  await screen.findByText('기존 권한 버전 4');
  expect(api.get).toHaveBeenNthCalledWith(3, '/enterprise/resources/dashboard/12/policies', undefined, expect.anything());
  expect(rightsBox('내보내기').checked).toBe(true);
  expect(screen.queryByText(/입력한 권한은 그대로 두었습니다/)).toBeNull();

  fireEvent.click(ackBox());
  api.post.mockResolvedValueOnce(raw(receipt('dashboard', 12, 9, 5, rights(true, false, false, true))));
  fireEvent.click(saveButton());
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
  expect(api.post.mock.calls[1][1]).toEqual({
    recipientId: 9,
    expectedVersion: 4,
    rights: { read: true, edit: false, publish: false, export: true },
  });
});

it('hides the former resources and grants when the server refuses the owner check with 403', async () => {
  api.get.mockResolvedValueOnce(raw(resourcePage([resource('dashboard', 12, '매출 대시보드')])));
  api.get.mockRejectedValueOnce(status(403));
  render(<ResourcePolicies organizationId={7} />);
  openPanel();
  await screen.findByText('매출 대시보드');
  fireEvent.click(resourceButton('대시보드', '매출 대시보드', 12));

  expect(await alerts()).toMatch(/권한이 없습니다/);
  expect(screen.queryByText('매출 대시보드')).toBeNull();
  expect(screen.queryByRole('button', { name: /권한 관리:/ })).toBeNull();
  expect(screen.queryByRole('button', { name: /^(권한 저장|저장 중…)$/ })).toBeNull();
  expect(screen.getByRole('button', { name: '자원 권한 다시 확인' })).toBeTruthy();
});

it('drops a late grants answer for a resource the admin already left', async () => {
  const pending: { resolve?: (value: unknown) => void } = {};
  api.get.mockImplementation((url: string) => {
    if (url === '/enterprise/resources')
      return Promise.resolve(raw(resourcePage([resource('dashboard', 12, '자원A'), resource('dashboard', 13, '자원B')])));
    if (url === '/enterprise/resources/dashboard/12/policies')
      return new Promise(resolve => {
        pending.resolve = resolve;
      });
    if (url === '/enterprise/resources/dashboard/13/policies')
      return Promise.resolve(raw(policyList('dashboard', 13, [grant(21, 'synthetic-21', 1, rights(true))])));
    return Promise.reject(new Error('unexpected request'));
  });
  render(<ResourcePolicies organizationId={7} />);
  openPanel();
  await screen.findByText('자원A');
  fireEvent.click(resourceButton('대시보드', '자원A', 12));
  fireEvent.click(resourceButton('대시보드', '자원B', 13));
  await screen.findByText('로그인 ID synthetic-21');

  await act(async () => {
    pending.resolve?.(raw(policyList('dashboard', 12, [grant(31, 'synthetic-late', 1, rights(true))])));
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(screen.queryByText(/synthetic-late/)).toBeNull();
  expect(screen.getByText('로그인 ID synthetic-21')).toBeTruthy();
});

it('cancels the in-flight grants read when the panel unmounts', async () => {
  const signals: AbortSignal[] = [];
  api.get.mockImplementation((url: string, _params: unknown, config: { signal?: AbortSignal }) => {
    if (url === '/enterprise/resources') return Promise.resolve(raw(resourcePage([resource('dashboard', 12, '자원A')])));
    if (config?.signal) signals.push(config.signal);
    return new Promise(() => undefined);
  });
  const view = render(<ResourcePolicies organizationId={7} />);
  openPanel();
  await screen.findByText('자원A');
  fireEvent.click(resourceButton('대시보드', '자원A', 12));
  await waitFor(() => expect(signals).toHaveLength(1));
  expect(signals[0].aborted).toBe(false);

  view.unmount();
  expect(signals[0].aborted).toBe(true);
});
