import React from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import HandoverFileCustodyReview from './HandoverFileCustodyReview';
import HandoverDependencyReview from './HandoverDependencyReview';
import HandoverProposalPanel from './HandoverProposal';
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
  assets: [{ kind: 'source', id: 11, title: '<b>File source</b>' }],
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
  scope: 'selected_file_custody_v1',
  executionAvailable: false,
  sources: [
    {
      kind: 'source',
      id: 11,
      title: '<b>File source</b>',
      storage: 'managed_file',
      identity: 'observed',
      filesChecked: 2,
      consumers: 'none_observed',
      refresh: 'none_observed',
    },
  ],
});
const load = () => fireEvent.click(screen.getByRole('button', { name: '파일·갱신 상태 확인' }));
const result = () => screen.queryByRole('list', { name: '선택 소스별 파일·갱신 상태' });
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
it('has a direct explicit button with no third fold/autoload; renders observations with non-exclusivity and SQLite limits', async () => {
  render(<HandoverFileCustodyReview review={review()} scope={scope} organizationVersion={3} />);
  expect(api.get).not.toHaveBeenCalled();
  expect(screen.getAllByRole('button')).toHaveLength(1);
  load();
  const list = await screen.findByRole('list', { name: '선택 소스별 파일·갱신 상태' });
  expect(list.querySelector('b')).toBeNull();
  expect(screen.getByText('파일 연결 신원을 관측함')).toBeTruthy();
  expect(screen.getByText('알려진 검사 범위에서 공유 사용처 미관측')).toBeTruthy();
  expect(screen.getByText('열린 갱신 작업 미관측')).toBeTruthy();
  expect(screen.getByText(/내용 정상·배타적 보관·복구 가능 증명이 아닙니다/)).toBeTruthy();
  const limits = screen.getByText('파일 확인의 범위와 한계').closest('details');
  expect(limits.open).toBe(false);
  expect(within(limits).getByText(/SQLite에는 소스 소유를 확인하는 별도 관리 명세가 없어/)).toBeTruthy();
  expect(api.post).not.toHaveBeenCalled();
  expect(api.patch).not.toHaveBeenCalled();
  expect(api.del).not.toHaveBeenCalled();
});
it('shows incomplete identity, consumers and refresh as warnings and external connections as separate review needs', async () => {
  const data = report();
  data.sources[0] = { ...data.sources[0], identity: 'unresolved', consumers: 'present', refresh: 'active_or_unresolved' };
  api.get.mockResolvedValueOnce({ data });
  render(<HandoverFileCustodyReview review={review()} scope={scope} organizationVersion={3} />);
  load();
  await screen.findByText('공유 사용처가 관측됨 · 보관 책임 검토 필요');
  expect(screen.getByText('갱신 진행 또는 미해제 작업 상태 확인 필요')).toBeTruthy();
  expect(screen.getByText(/일부 관측을 전체 파일 확인으로 해석하지 마세요/)).toBeTruthy();
  expect(within(screen.getByRole('heading', { name: /소스 #11/ }).closest('li')).getAllByRole('term')).toHaveLength(4);
  api.get.mockResolvedValueOnce({
    data: {
      ...report(),
      sources: [
        {
          ...report().sources[0],
          storage: 'external_connection',
          identity: 'not_applicable',
          consumers: 'not_applicable',
          refresh: 'not_applicable',
          filesChecked: 0,
        },
      ],
    },
  });
  load();
  await screen.findByText(/외부 연결 계정·이관 가능성은 별도로/);
  expect(screen.queryByText('파일 연결 신원을 관측함')).toBeNull();
  const external = within(screen.getByRole('heading', { name: /소스 #11/ }).closest('li'));
  expect(external.getByText('외부 연결')).toBeTruthy();
  expect(external.queryByRole('term')).toBeNull();
  for (const label of [
    '검사한 파일',
    '관리 파일 신원 확인 대상 아님',
    '관리 파일 공유 사용처 확인 대상 아님',
    '관리 파일 갱신 확인 대상 아님',
  ])
    expect(external.queryByText(label)).toBeNull();
  api.get.mockResolvedValueOnce({
    data: {
      ...report(),
      sources: [
        {
          ...report().sources[0],
          storage: 'unresolved',
          identity: 'unresolved',
          consumers: 'unresolved',
          refresh: 'active_or_unresolved',
          filesChecked: 0,
        },
      ],
    },
  });
  load();
  await screen.findByText('보관 방식 확인 필요');
  const unresolved = within(screen.getByRole('heading', { name: /소스 #11/ }).closest('li'));
  expect(unresolved.getAllByRole('term')).toHaveLength(4);
  expect(unresolved.getByText('검사한 파일')).toBeTruthy();
  expect(unresolved.getByText('공유 사용처 확인 불완전 · 추가 검토 필요')).toBeTruthy();
});
it('explains the successful empty-source result without inventing checked files', async () => {
  api.get.mockResolvedValueOnce({ data: { ...report(), sources: [] } });
  render(
    <HandoverFileCustodyReview
      review={{ ...review(), assets: [{ kind: 'dashboard', id: 21, title: 'Dashboard' }] }}
      scope={scope}
      organizationVersion={3}
    />,
  );
  load();
  await screen.findByText('선택된 소스가 없어 파일·갱신 상태 확인 대상이 없습니다.');
  expect(result()).toBeNull();
});
it('clears old results at retry start and failure, then recovers only via another explicit GET', async () => {
  render(<HandoverFileCustodyReview review={review()} scope={scope} organizationVersion={3} />);
  load();
  await screen.findByRole('list');
  const pending = deferred();
  api.get.mockReturnValueOnce(pending.promise);
  load();
  expect(result()).toBeNull();
  await act(async () => pending.resolve({ ...report(), proposalVersion: 3 }));
  await screen.findByRole('alert');
  expect(result()).toBeNull();
  load();
  await screen.findByRole('list');
  expect(screen.queryByRole('alert')).toBeNull();
  api.get.mockRejectedValueOnce(new Error('offline'));
  load();
  await screen.findByRole('alert');
  expect(result()).toBeNull();
  expect(api.get).toHaveBeenCalledTimes(4);
});
it.each([
  { actorId: 43, organizationId: 7 },
  { actorId: 42, organizationId: 8 },
])('is absent outside the current owner scope %j', foreign => {
  render(<HandoverFileCustodyReview review={review()} scope={foreign} organizationVersion={3} />);
  expect(screen.queryByRole('button')).toBeNull();
  expect(api.get).not.toHaveBeenCalled();
});
it('discards late responses across request/basis/version/organization changes, ended disclosure and unmount', async () => {
  const view = render(<HandoverFileCustodyReview review={review()} scope={scope} organizationVersion={3} />);
  load();
  await screen.findByRole('list');
  view.rerender(
    <HandoverFileCustodyReview
      review={{ ...review(), reviewBasis: 'b'.repeat(64) }}
      scope={scope}
      organizationVersion={3}
    />,
  );
  expect(result()).toBeNull();
  for (const change of [
    { review: { ...review(), version: 3 }, organizationVersion: 3 },
    { review: review(), organizationVersion: 4 },
    { review: { ...review(), requestId: '22345678-1234-4234-8234-123456789012' }, organizationVersion: 4 },
  ]) {
    const pending = deferred();
    api.get.mockReturnValueOnce(pending.promise);
    load();
    const signal = api.get.mock.calls.at(-1)[2].signal;
    view.rerender(<HandoverFileCustodyReview scope={scope} {...change} />);
    expect(signal.aborted).toBe(true);
    await act(async () => pending.resolve(report()));
    expect(result()).toBeNull();
  }
  const pending = deferred();
  api.get.mockReturnValueOnce(pending.promise);
  load();
  view.rerender(
    <HandoverFileCustodyReview
      review={{ ...review(), detailsAvailable: false, assets: [] }}
      scope={scope}
      organizationVersion={4}
    />,
  );
  await act(async () => pending.resolve(report()));
  expect(screen.queryByRole('button')).toBeNull();
  view.rerender(<HandoverFileCustodyReview review={review()} scope={scope} organizationVersion={4} />);
  const leaving = deferred();
  api.get.mockReturnValueOnce(leaving.promise);
  load();
  view.unmount();
  await act(async () => leaving.resolve(report()));
  expect(api.post).not.toHaveBeenCalled();
});
it('mounts only inside the opened dependency panel and discards a late custody read on its close without auto requests on reopen', async () => {
  render(<HandoverDependencyReview review={review()} scope={scope} organizationVersion={3} />);
  expect(screen.queryByRole('button', { name: '파일·갱신 상태 확인' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '연결 자료·보관 조건 확인 열기' }));
  expect(api.get).not.toHaveBeenCalled();
  const pending = deferred();
  api.get.mockReturnValueOnce(pending.promise);
  load();
  fireEvent.click(screen.getByRole('button', { name: '연결 자료·보관 조건 확인 접기' }));
  await act(async () => pending.resolve(report()));
  fireEvent.click(screen.getByRole('button', { name: '연결 자료·보관 조건 확인 열기' }));
  expect(result()).toBeNull();
  expect(api.get).toHaveBeenCalledOnce();
});
it('custody failure preserves the parent accepted request, selected candidates and dependency report', async () => {
  const proposal = review();
  const context = {
    organization: { id: 7, name: 'Example', version: 3 },
    membership: { userId: 42, role: 'member' as const, team: 'Ops' },
  };
  const dependencies = {
    requestId: uuid,
    organizationId: 7,
    ownerId: 42,
    recipientId: 43,
    proposalVersion: 2,
    checkedAt: '2026-10-19T11:00:00Z',
    scope: 'selected_dependencies_v1',
    executionAvailable: false,
    assets: [
      {
        ...proposal.assets[0],
        dependencyStatus: 'covered',
        requiredSources: 0,
        selectedSources: 0,
        missingOwnedSources: 0,
        otherSources: 0,
        metricCount: 3,
        storage: 'file_review_required',
      },
    ],
  };
  api.get.mockImplementation((url: string) =>
    url.endsWith('/custody')
      ? Promise.reject({ response: { status: 409 } })
      : Promise.resolve({
          data: url.endsWith('/candidates')
            ? { entries: proposal.assets, nextAfterId: null }
            : url.endsWith('/dependencies')
            ? dependencies
            : proposal,
        }),
  );
  render(<HandoverProposalPanel context={context} />);
  fireEvent.click(screen.getByRole('button', { name: '업무 자료 인계 열기' }));
  fireEvent.click(screen.getByRole('button', { name: '본인 후보 불러오기' }));
  fireEvent.click(await screen.findByRole('checkbox', { name: /소스 #11/ }));
  fireEvent.change(screen.getByLabelText('조회할 요청 번호'), { target: { value: uuid } });
  fireEvent.click(screen.getByRole('button', { name: '요청 상태·고정 목록 검토' }));
  await screen.findByRole('list', { name: '검토한 고정 자료' });
  fireEvent.click(screen.getByRole('button', { name: '연결 자료·보관 조건 확인 열기' }));
  expect(api.get.mock.calls.filter(call => call[0].endsWith('/custody'))).toHaveLength(0);
  fireEvent.click(screen.getByRole('button', { name: '연결 자료·보관 조건 조회' }));
  await screen.findByRole('list', { name: '선택 자료별 연결·보관 검토' });
  load();
  await screen.findByRole('alert');
  expect(screen.getByLabelText('조회할 요청 번호')).toHaveProperty('value', uuid);
  expect(screen.getByRole('list', { name: '검토한 고정 자료' })).toBeTruthy();
  expect(screen.getByRole('list', { name: '선택 자료별 연결·보관 검토' })).toBeTruthy();
  expect(screen.getByRole('list', { name: '공개할 제목과 번호' }).textContent).toContain(proposal.assets[0].title);
  expect(screen.getByRole('checkbox', { name: /소스 #11/ })).toHaveProperty('checked', true);
  expect(api.post).not.toHaveBeenCalled();
});
