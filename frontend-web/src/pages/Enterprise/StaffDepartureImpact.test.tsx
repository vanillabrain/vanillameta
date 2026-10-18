import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import StaffDepartureImpact from './StaffDepartureImpact';
import Enterprise from './index';
import { DEPARTURE_COUNT_KEYS } from '@/api/staffDepartureService';
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), del: vi.fn() }));
vi.mock('@/helpers/apiHelper', () => api);
const context = (role: 'admin' | 'member' = 'admin', version = 3, org = 7) => ({
  organization: { id: org, name: 'Example', version },
  membership: { userId: 42, role, team: 'Ops' },
});
const member = (id: number, active = true) => ({
  id,
  userId: `employee-${id}`,
  team: 'Ops',
  role: 'member' as const,
  active,
});
const members = [member(42), member(43, false)];
const impact = (targetId = 42) => ({
  organizationId: 7,
  organizationVersion: 3,
  targetId,
  targetActive: targetId === 42,
  observedAt: '2026-10-19T01:00:00Z',
  counts: Object.fromEntries(DEPARTURE_COUNT_KEYS.map((key, index) => [key, index + 100])),
});
const open = () => fireEvent.click(screen.getByRole('button', { name: '퇴사·인계 전 확인 열기' }));
const choose = (id = 42) => fireEvent.change(screen.getByLabelText('영향 확인 직원'), { target: { value: String(id) } });
const load = () => fireEvent.click(screen.getByRole('button', { name: '영향 건수 조회' }));
const result = () => screen.queryByText(/조회 시각/);
const deferred = () => {
  let resolve: (value: { data: unknown }) => void;
  const promise = new Promise<{ data: unknown }>(done => {
    resolve = done;
  });
  return { promise, resolve: (data: unknown) => resolve({ data }) };
};
beforeEach(() => {
  vi.resetAllMocks();
  api.get.mockResolvedValue({ data: impact() });
});
afterEach(cleanup);
it('is admin-only, folded, never automatically fetches and offers only supplied members including inactive/self', () => {
  const view = render(<StaffDepartureImpact context={context('member')} members={members} />);
  expect(screen.queryByRole('button')).toBeNull();
  expect(api.get).not.toHaveBeenCalled();
  view.rerender(<StaffDepartureImpact context={context()} members={members} />);
  expect(screen.queryByLabelText('영향 확인 직원')).toBeNull();
  open();
  expect(screen.getAllByRole('option')).toHaveLength(3);
  expect(screen.getByRole('option', { name: '#43 · employee-43 · 비활성' })).toBeTruthy();
  choose();
  expect(api.get).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '퇴사·인계 전 확인 접기' }));
  open();
  expect(api.get).not.toHaveBeenCalled();
});
it('renders precisely eleven counts and limitations after explicit GET, with no mutations', async () => {
  render(<StaffDepartureImpact context={context()} members={members} />);
  open();
  choose();
  load();
  await screen.findByText(/직원 #42.*조회 시각/);
  expect(screen.getAllByRole('definition')).toHaveLength(11);
  expect(screen.getByText('100건')).toBeTruthy();
  expect(screen.getByText('Studio 게시 기록 (중지·만료 포함)')).toBeTruthy();
  expect(screen.getByText('소유 자료의 그룹 권한 관계 (회수 포함)')).toBeTruthy();
  expect(screen.getByText('소유 자료의 그룹 전달 관계 (회수 포함)')).toBeTruthy();
  expect(screen.getByText(/전체 계정 소유 건수/)).toBeTruthy();
  expect(screen.getByText(/관계 건수는 현재 접근권이 아니며/)).toBeTruthy();
  expect(screen.getByText(/총합을 표시하지 않습니다/)).toBeTruthy();
  expect(screen.getByText(/실행 승인이 아닙니다/)).toBeTruthy();
  expect(api.get).toHaveBeenCalledOnce();
  expect(api.get.mock.calls[0][0]).toBe('/enterprise/members/42/departure-impact');
  expect(api.post).not.toHaveBeenCalled();
  expect(api.patch).not.toHaveBeenCalled();
  expect(api.del).not.toHaveBeenCalled();
});
it('clears success immediately on retry and error; a subsequent explicit retry can succeed', async () => {
  render(<StaffDepartureImpact context={context()} members={members} />);
  open();
  choose();
  load();
  await screen.findByText(/조회 시각/);
  const retry = deferred();
  api.get.mockReturnValueOnce(retry.promise);
  load();
  expect(result()).toBeNull();
  await act(async () => retry.resolve({ ...impact(), organizationId: 8 }));
  await screen.findByRole('alert');
  expect(result()).toBeNull();
  expect(screen.queryByText('100건')).toBeNull();
  load();
  await screen.findByText(/조회 시각/);
  expect(screen.queryByRole('alert')).toBeNull();
  expect(api.get).toHaveBeenCalledTimes(3);
});
it('hides previous counts on a failed request and allows retry without restoring stale success', async () => {
  api.get.mockRejectedValueOnce({ response: { status: 403 } });
  render(<StaffDepartureImpact context={context()} members={members} />);
  open();
  choose();
  load();
  await screen.findByRole('alert');
  expect(result()).toBeNull();
  load();
  await screen.findByText(/조회 시각/);
  expect(screen.queryByRole('alert')).toBeNull();
});
it('drops a late prior-target response while allowing an explicit request for the new target', async () => {
  const old = deferred();
  api.get.mockReturnValueOnce(old.promise).mockResolvedValueOnce({ data: impact(43) });
  render(<StaffDepartureImpact context={context()} members={members} />);
  open();
  choose();
  load();
  choose(43);
  expect(result()).toBeNull();
  expect(api.get).toHaveBeenCalledOnce();
  load();
  await screen.findByText(/직원 #43.*비활성.*조회 시각/);
  await act(async () => old.resolve(impact()));
  expect(screen.queryByText(/직원 #42.*조회 시각/)).toBeNull();
  expect(screen.getByText(/직원 #43.*조회 시각/)).toBeTruthy();
});
it('clears counts when changing target or closing; late closed-panel responses never appear on reopen', async () => {
  render(<StaffDepartureImpact context={context()} members={members} />);
  open();
  choose();
  load();
  await screen.findByText(/조회 시각/);
  choose(43);
  expect(result()).toBeNull();
  choose();
  const pending = deferred();
  api.get.mockReturnValueOnce(pending.promise);
  load();
  fireEvent.click(screen.getByRole('button', { name: '퇴사·인계 전 확인 접기' }));
  await act(async () => pending.resolve(impact()));
  open();
  expect(result()).toBeNull();
  expect(api.get).toHaveBeenCalledTimes(2);
});
it('invalidates reads across version/org changes, roster removal and unmount', async () => {
  const pending = deferred();
  api.get.mockReturnValueOnce(pending.promise);
  const view = render(<StaffDepartureImpact context={context()} members={members} />);
  open();
  choose();
  load();
  view.rerender(<StaffDepartureImpact context={context('admin', 4)} members={members} />);
  await act(async () => pending.resolve(impact()));
  open();
  expect(result()).toBeNull();
  expect(api.get).toHaveBeenCalledOnce();
  choose();
  api.get.mockResolvedValue({ data: { ...impact(), organizationVersion: 4 } });
  load();
  await screen.findByText(/조회 시각/);
  view.rerender(<StaffDepartureImpact context={context('admin', 4)} members={[]} />);
  expect(result()).toBeNull();
  view.rerender(<StaffDepartureImpact context={context('admin', 4, 8)} members={members} />);
  open();
  expect(result()).toBeNull();
  const unmounted = deferred();
  api.get.mockReturnValueOnce(unmounted.promise);
  choose();
  load();
  view.unmount();
  await act(async () => unmounted.resolve({ ...impact(), organizationId: 8, organizationVersion: 4 }));
  render(<StaffDepartureImpact context={context('admin', 4, 8)} members={members} />);
  open();
  expect(result()).toBeNull();
});
it('integrates only the fetched staff list and remounts without fetching impact on context reload', async () => {
  api.get.mockImplementation((url: string) =>
    Promise.resolve({
      data:
        url === '/enterprise/context'
          ? context()
          : url === '/enterprise/members'
          ? { organizationVersion: 3, entries: members, nextAfterId: null }
          : url.endsWith('/departure-impact')
          ? impact()
          : null,
    }),
  );
  render(<Enterprise />);
  await screen.findByText('로그인 ID employee-42');
  open();
  expect(screen.getAllByRole('option', { name: /employee-/ })).toHaveLength(2);
  choose();
  load();
  await screen.findByText(/조회 시각/);
  fireEvent.click(screen.getByRole('button', { name: '조직 이동 열기' }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: '조직·버전 다시 불러오기' })).toHaveProperty('disabled', false),
  );
  fireEvent.click(screen.getByRole('button', { name: '조직·버전 다시 불러오기' }));
  await waitFor(() => expect(screen.getByRole('button', { name: '퇴사·인계 전 확인 열기' })).toBeTruthy());
  open();
  expect(result()).toBeNull();
  expect(api.get.mock.calls.filter(call => call[0].endsWith('/departure-impact'))).toHaveLength(1);
});

it('keeps detailed caveats folded in an accessible region without requesting on disclosure', () => {
  render(<StaffDepartureImpact context={context()} members={members} />);
  expect(screen.getByRole('region', { name: '퇴사·인계 영향 확인' })).toBeTruthy();
  open();
  const disclosure = screen.getByText('집계 기준과 제외 범위').closest('details');
  expect(disclosure.open).toBe(false);
  expect(screen.getByText(/건수만 확인하며/).closest('details')).toBeNull();
  expect(screen.getByText(/실행 승인이 아닙니다/).closest('details')).toBeNull();
  expect(screen.getByText(/고아 관계/).closest('details')).toBe(disclosure);
  expect(screen.getByText(/개인 저장 보기·기존 대시보드 게시\/공유·별도 BI 조직/).closest('details')).toBe(disclosure);
  fireEvent.click(screen.getByText('집계 기준과 제외 범위'));
  expect(api.get).not.toHaveBeenCalled();
});

it('links the member explanation outside the control row so it cannot offset input/button alignment', () => {
  render(<StaffDepartureImpact context={context()} members={members} />);
  open();
  const select = screen.getByLabelText('영향 확인 직원');
  const button = screen.getByRole('button', { name: '영향 건수 조회' });
  const explanation = screen.getByText('현재 직원 목록에 불러온 직원만 선택할 수 있습니다.');
  expect(select.getAttribute('aria-describedby')).toBe(explanation.id);
  expect(explanation.tagName).toBe('P');
  expect(button.parentElement.contains(select)).toBe(true);
  expect(button.parentElement.contains(explanation)).toBe(false);
});
