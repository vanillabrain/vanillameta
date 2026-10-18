import React from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import HandoverDependencyReview from './HandoverDependencyReview';
import { HandoverProposal } from '@/api/handoverService';
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), del: vi.fn() }));
vi.mock('@/helpers/apiHelper', () => api);
const uuid = '12345678-1234-4234-8234-123456789012';
const scope = { organizationId: 7, actorId: 42 };
const review = (): HandoverProposal => ({
  requestId: uuid,
  organizationId: 7,
  ownerId: 42,
  recipientId: 43,
  version: 2,
  status: 'accepted',
  expiresAt: '2026-10-20T12:00:00Z',
  acceptedAt: '2026-10-19T10:00:00Z',
  reviewBasis: 'a'.repeat(64),
  assets: [
    { kind: 'source', id: 11, title: '<b>File source</b>' },
    { kind: 'dashboard', id: 21, title: 'Selected dashboard' },
  ],
  expired: false,
  detailsAvailable: true,
});
const report = () => ({
  requestId: uuid,
  organizationId: 7,
  ownerId: 42,
  recipientId: 43,
  proposalVersion: 2,
  checkedAt: '2026-10-19T11:00:00Z',
  scope: 'selected_dependencies_v1',
  executionAvailable: false,
  assets: review().assets.map((asset, i) => ({
    ...asset,
    dependencyStatus: i ? 'missing' : 'covered',
    requiredSources: i ? 3 : 0,
    selectedSources: i ? 1 : 0,
    missingOwnedSources: i ? 1 : 0,
    otherSources: i ? 1 : 0,
    metricCount: i ? 0 : 3,
    storage: i ? 'not_applicable' : 'file_review_required',
  })),
});
const open = () => fireEvent.click(screen.getByRole('button', { name: '연결 자료·보관 조건 확인 열기' }));
const load = () => fireEvent.click(screen.getByRole('button', { name: '연결 자료·보관 조건 조회' }));
const result = () => screen.queryByRole('list', { name: '선택 자료별 연결·보관 검토' });
const deferred = () => {
  let resolve: (data: unknown) => void;
  const promise = new Promise(done => {
    resolve = data => done({ data });
  });
  return { promise, resolve: (data: unknown) => resolve(data) };
};
beforeEach(() => {
  vi.resetAllMocks();
  api.get.mockResolvedValue({ data: report() });
});
afterEach(cleanup);
it('is folded and never requests on opening alone; explicitly displays missing selections and storage needs without execution readiness', async () => {
  render(<HandoverDependencyReview review={review()} scope={scope} organizationVersion={3} />);
  expect(api.get).not.toHaveBeenCalled();
  open();
  expect(api.get).not.toHaveBeenCalled();
  load();
  const list = await screen.findByRole('list', { name: '선택 자료별 연결·보관 검토' });
  expect(list.querySelectorAll(':scope > li')).toHaveLength(2);
  expect(list.querySelector('b')).toBeNull();
  const sourceCard = within(screen.getByRole('heading', { name: /소스 #11/ }).closest('li'));
  const dashboardCard = within(screen.getByRole('heading', { name: /대시보드 #21/ }).closest('li'));
  for (const label of ['필요한 소스', '선택한 소스', '선택 누락 본인 소스', '타인·소유 미확인 소스']) {
    expect(sourceCard.queryByText(label)).toBeNull();
    expect(dashboardCard.getByText(label)).toBeTruthy();
  }
  expect(sourceCard.getAllByRole('term')).toHaveLength(1);
  expect(sourceCard.getByText('소스 지표 (비활성 포함)')).toBeTruthy();
  expect(sourceCard.getByText('파일 실체·보관 주체 별도 검토 필요')).toBeTruthy();
  expect(dashboardCard.getAllByRole('term')).toHaveLength(4);

  expect(screen.getByText(/누락된 본인 소스를 포함한 새 의향 요청/)).toBeTruthy();
  expect(screen.getByText('파일 실체·보관 주체 별도 검토 필요')).toBeTruthy();
  expect(screen.getByText(/실제 이전 실행 불가/)).toBeTruthy();
  expect(screen.getByText('검토 범위와 제외 사항').closest('details').open).toBe(false);
  expect(screen.getAllByRole('button')).toHaveLength(2);
  expect(api.post).not.toHaveBeenCalled();
  expect(api.patch).not.toHaveBeenCalled();
  expect(api.del).not.toHaveBeenCalled();
});
it.each([
  { scope: { ...scope, actorId: 43 } },
  { scope: { ...scope, actorId: 99 } },
  { scope: { ...scope, organizationId: 8 } },
  { change: { status: 'pending' } },
  { change: { status: 'cancelled' } },
  { change: { expired: true } },
  { change: { detailsAvailable: false } },
])('does not render for ineligible role/scope/status %j', ({ change, ...props }: any) => {
  render(<HandoverDependencyReview review={{ ...review(), ...change }} scope={scope} organizationVersion={3} {...props} />);
  expect(screen.queryByRole('region')).toBeNull();
  expect(api.get).not.toHaveBeenCalled();
});
it('clears a successful report immediately before retry, drops it on error and allows an explicit retry', async () => {
  render(<HandoverDependencyReview review={review()} scope={scope} organizationVersion={3} />);
  open();
  load();
  await screen.findByRole('list');
  const pending = deferred();
  api.get.mockReturnValueOnce(pending.promise);
  load();
  expect(result()).toBeNull();
  await act(async () => pending.resolve({ ...report(), executionAvailable: true }));
  await screen.findByRole('alert');
  expect(result()).toBeNull();
  load();
  await screen.findByRole('list');
  expect(screen.queryByRole('alert')).toBeNull();
  api.get.mockRejectedValueOnce({ response: { status: 409 } });
  load();
  await screen.findByRole('alert');
  expect(result()).toBeNull();
});
it('discards late responses after close and reopening does not request or restore the old report', async () => {
  const pending = deferred();
  api.get.mockReturnValueOnce(pending.promise);
  render(<HandoverDependencyReview review={review()} scope={scope} organizationVersion={3} />);
  open();
  load();
  const signal = api.get.mock.calls[0][2].signal;
  fireEvent.click(screen.getByRole('button', { name: '연결 자료·보관 조건 확인 접기' }));
  expect(signal.aborted).toBe(true);
  await act(async () => pending.resolve(report()));
  open();
  expect(result()).toBeNull();
  expect(api.get).toHaveBeenCalledOnce();
});
it('withdraws reports and late reads on request, review basis/version, organization, actor and unmount changes', async () => {
  const view = render(<HandoverDependencyReview review={review()} scope={scope} organizationVersion={3} />);
  open();
  load();
  await screen.findByRole('list');
  view.rerender(
    <HandoverDependencyReview review={{ ...review(), reviewBasis: 'b'.repeat(64) }} scope={scope} organizationVersion={3} />,
  );
  expect(result()).toBeNull();
  open();
  const pending = deferred();
  api.get.mockReturnValueOnce(pending.promise);
  load();
  view.rerender(<HandoverDependencyReview review={{ ...review(), version: 3 }} scope={scope} organizationVersion={3} />);
  await act(async () => pending.resolve(report()));
  expect(result()).toBeNull();
  open();
  view.rerender(<HandoverDependencyReview review={review()} scope={scope} organizationVersion={4} />);
  expect(result()).toBeNull();
  open();
  const requestRead = deferred();
  api.get.mockReturnValueOnce(requestRead.promise);
  load();
  view.rerender(
    <HandoverDependencyReview
      review={{ ...review(), requestId: '22345678-1234-4234-8234-123456789012' }}
      scope={scope}
      organizationVersion={4}
    />,
  );
  await act(async () => requestRead.resolve(report()));
  expect(result()).toBeNull();
  view.rerender(
    <HandoverDependencyReview review={review()} scope={{ organizationId: 8, actorId: 42 }} organizationVersion={4} />,
  );
  expect(screen.queryByRole('region')).toBeNull();
  view.rerender(<HandoverDependencyReview review={review()} scope={{ ...scope, actorId: 43 }} organizationVersion={4} />);
  expect(screen.queryByRole('region')).toBeNull();
  view.rerender(<HandoverDependencyReview review={review()} scope={scope} organizationVersion={4} />);
  open();
  const last = deferred();
  api.get.mockReturnValueOnce(last.promise);
  load();
  view.unmount();
  await act(async () => last.resolve(report()));
  expect(api.post).not.toHaveBeenCalled();
});
it('explains unresolved links and external connection storage without upgrading to transfer-ready', async () => {
  const data = report();
  data.assets[0].storage = 'connection_review_required';
  data.assets[1].dependencyStatus = 'unresolved';
  api.get.mockResolvedValue({ data });
  render(<HandoverDependencyReview review={review()} scope={scope} organizationVersion={3} />);
  open();
  load();
  await screen.findByText('외부 연결·계정 별도 검토 필요');
  expect(screen.getByText(/저장 연결의 형식·참조·지원 범위/)).toBeTruthy();
  expect(screen.getByText(/실제 이전 실행 불가/)).toBeTruthy();
});
