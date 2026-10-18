import React, { useState } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import MetricDeleteDialog from './MetricDeleteDialog';
import { metricDeletionDependencyLabels, fetchMetricDeleteImpact, submitMetricDeletion } from '@/api/metricDeletionService';
import MetricService from '@/api/metricService';
import { setToken } from '@/helpers/authHelper';
const api = vi.hoisted(() => ({ get: vi.fn(), del: vi.fn(), put: vi.fn(), post: vi.fn() }));
vi.mock('@/helpers/apiHelper', () => api);
const target = { id: 7, title: 'Existing target title' };
const deps = () => Object.keys(metricDeletionDependencyLabels).map(kind => ({ kind, count: 0 }));
const impact = (over: Record<string, unknown> = {}) => ({
  metricId: 7,
  actorId: 19,
  organizationId: 3,
  revision: 'a'.repeat(64),
  canDelete: true,
  dependencies: deps(),
  ...over,
});
const response = (data: unknown) => ({ data: { status: 'SUCCESS', data } });
const request = {
  requestId: '11111111-1111-4111-8111-111111111111',
  expectedRevision: 'a'.repeat(64),
  expectedActorId: 19,
  expectedOrganizationId: 3,
};
const receipt = (body = request, over: Record<string, unknown> = {}) =>
  response({ metricId: 7, requestId: body.requestId, receiptId: 41, deleted: true, replayed: false, ...over });
const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }));
const button = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement;
const deferred = () => {
  let resolve!: (v: any) => void;
  const promise = new Promise<any>(res => {
    resolve = res;
  });
  return { promise, resolve };
};
const ready = () => screen.findByText('현재 확인한 사용처가 없습니다. 삭제한 지표는 사용 목록에서 제외됩니다.');
function Harness({ selected = target, deleted = vi.fn() }: any) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <button onClick={() => setOpen(true)}>삭제 창 다시 열기</button>
      <MetricDeleteDialog target={selected} open={open} onOpenChange={setOpen} onDeleted={deleted} />
    </>
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  setToken('dialog-token');
  api.get.mockResolvedValue(response(impact()));
  api.del.mockImplementation(async (_path, config) => receipt(config.data));
});
afterEach(cleanup);

it('reads only metadata on explicit opening, shows the local title, and deletes only after confirmation', async () => {
  const deleted = vi.fn();
  render(<Harness deleted={deleted} />);
  await ready();
  expect(screen.getByRole('dialog', { name: '지표 삭제 영향' })).toBeTruthy();
  expect(screen.getByText(/Existing target title/)).toBeTruthy();
  expect(api.get).toHaveBeenCalledWith('/metric/7/delete-impact', undefined, { signal: expect.anything() });
  expect(api.del).not.toHaveBeenCalled();
  click('지표 삭제');
  await waitFor(() => expect(deleted).toHaveBeenCalledOnce());
  const body = api.del.mock.calls[0][1].data;
  expect(body).toEqual({ ...request, requestId: expect.stringMatching(/^[a-f0-9-]{36}$/) });
  expect(api.del).toHaveBeenCalledWith('/metric/7', { data: body });
  expect(deleted).toHaveBeenCalledWith({
    metricId: 7,
    requestId: body.requestId,
    receiptId: 41,
    deleted: true,
    replayed: false,
  });
  expect(api.get).toHaveBeenCalledTimes(1);
  expect(api.put).not.toHaveBeenCalled();
  expect(api.post).not.toHaveBeenCalled();
});
it.each(Object.keys(metricDeletionDependencyLabels))('blocks %s without auto-stopping any reference', async kind => {
  api.get.mockResolvedValueOnce(
    response(
      impact({
        canDelete: false,
        dependencies: deps().map(entry => (entry.kind === kind ? { ...entry, count: 2 } : entry)),
      }),
    ),
  );
  render(<Harness />);
  await screen.findByText(/사용처 설정이 남아 있어 삭제할 수 없습니다/);
  expect(screen.getByText(metricDeletionDependencyLabels[kind])).toBeTruthy();
  expect(screen.getByText('2개')).toBeTruthy();
  expect(button('지표 삭제').disabled).toBe(true);
  click('지표 삭제');
  expect(api.del).not.toHaveBeenCalled();
  expect(api.post).not.toHaveBeenCalled();
});
it('requires explicit impact reload after 409 and uses a new frozen revision, actor and organization', async () => {
  render(<Harness />);
  await ready();
  api.del.mockRejectedValueOnce({ response: { status: 409 } });
  click('지표 삭제');
  await screen.findByText(/삭제 기준이나 사용처가 변경/);
  const original = api.del.mock.calls[0][1].data;
  expect(button('지표 삭제').disabled).toBe(true);
  expect(api.get).toHaveBeenCalledTimes(1);
  api.get.mockResolvedValueOnce(response(impact({ actorId: 22, organizationId: 8, revision: 'b'.repeat(64) })));
  click('사용처 다시 읽기');
  await ready();
  click('지표 삭제');
  await waitFor(() => expect(api.del).toHaveBeenCalledTimes(2));
  expect(api.del.mock.calls[1][1].data).toEqual({
    requestId: expect.any(String),
    expectedActorId: 22,
    expectedOrganizationId: 8,
    expectedRevision: 'b'.repeat(64),
  });
  expect(api.del.mock.calls[1][1].data.requestId).not.toBe(original.requestId);
});
it('preserves unknown deletion UUID/body across collapse and confirms a replay explicitly', async () => {
  const deleted = vi.fn();
  render(<Harness deleted={deleted} />);
  await ready();
  api.del.mockRejectedValueOnce(new Error('response lost'));
  click('지표 삭제');
  await screen.findByText(/삭제 결과를 확인하지 못했습니다/);
  const original = { ...api.del.mock.calls[0][1].data };
  expect(button('사용처 다시 읽기').disabled).toBe(true);
  // The DELETE may have committed: any new impact read would now be refused.
  api.get.mockRejectedValue({ response: { status: 403 } });
  click('닫기');
  click('삭제 창 다시 열기');
  expect(button('같은 요청으로 삭제 결과 확인').disabled).toBe(false);
  expect(screen.queryByText(/사용처를 확인하지 못했습니다/)).toBeNull();
  expect(api.get).toHaveBeenCalledTimes(1);
  expect(api.del).toHaveBeenCalledTimes(1);
  api.del.mockResolvedValueOnce(receipt(original, { replayed: true }));
  click('같은 요청으로 삭제 결과 확인');
  await waitFor(() => expect(deleted).toHaveBeenCalledOnce());
  expect(api.del.mock.calls[1][1].data).toEqual(original);
  expect(deleted.mock.calls[0][0].replayed).toBe(true);
  expect(api.get).toHaveBeenCalledTimes(1);
});
it('keeps malformed or mismatched receipts frozen without claiming success', async () => {
  const deleted = vi.fn();
  render(<Harness deleted={deleted} />);
  await ready();
  api.del.mockResolvedValueOnce(receipt(request, { metricId: 8 }));
  click('지표 삭제');
  await screen.findByText(/삭제 결과를 확인하지 못했습니다/);
  const original = { ...api.del.mock.calls[0][1].data };
  expect(deleted).not.toHaveBeenCalled();
  expect(button('사용처 다시 읽기').disabled).toBe(true);
  click('같은 요청으로 삭제 결과 확인');
  await waitFor(() => expect(deleted).toHaveBeenCalledOnce());
  expect(api.del.mock.calls[1][1].data).toEqual(original);
});
it('drops a late impact for a different target', async () => {
  const pending = deferred();
  api.get.mockReturnValueOnce(pending.promise);
  const view = render(<Harness />);
  api.get.mockResolvedValueOnce(response(impact({ metricId: 8 })));
  view.rerender(<Harness selected={{ id: 8, title: 'Second target' }} />);
  await ready();
  await act(async () =>
    pending.resolve(response(impact({ canDelete: false, dependencies: deps().map(entry => ({ ...entry, count: 1 })) }))),
  );
  expect(screen.getByText(/Second target/)).toBeTruthy();
  expect(button('지표 삭제').disabled).toBe(false);
});
it('retains the original pending target and rejects its late receipt after a target change', async () => {
  const deleted = vi.fn();
  const pending = deferred();
  const view = render(<Harness deleted={deleted} />);
  await ready();
  api.del.mockReturnValueOnce(pending.promise);
  click('지표 삭제');
  const original = api.del.mock.calls[0][1].data;
  view.rerender(<Harness selected={{ id: 8, title: 'Other target' }} deleted={deleted} />);
  await act(async () => pending.resolve(receipt(original)));
  expect(deleted).not.toHaveBeenCalled();
  expect(button('같은 요청으로 삭제 결과 확인').disabled).toBe(false);
  expect(screen.getByText(/Existing target title/)).toBeTruthy();
  expect(api.get).toHaveBeenCalledTimes(1);
  click('같은 요청으로 삭제 결과 확인');
  await waitFor(() => expect(deleted).toHaveBeenCalledOnce());
  expect(api.del.mock.calls[1][1].data).toEqual(original);
});
it('rejects late read and write responses after authentication changes', async () => {
  const deleted = vi.fn();
  const pending = deferred();
  render(<Harness deleted={deleted} />);
  await ready();
  api.del.mockReturnValueOnce(pending.promise);
  click('지표 삭제');
  const original = api.del.mock.calls[0][1].data;
  act(() => {
    setToken('new-account');
    window.dispatchEvent(new StorageEvent('storage', { key: 'accessToken' }));
  });
  await act(async () => pending.resolve(receipt(original)));
  expect(deleted).not.toHaveBeenCalled();
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.queryByText(/Existing target title/)).toBeNull();
  expect(api.del).toHaveBeenCalledTimes(1);
});
it('allows nullable organization metadata and freezes only the server actor, not token claims', async () => {
  api.get.mockResolvedValueOnce(response(impact({ actorId: 99, organizationId: null })));
  render(<Harness />);
  await ready();
  click('지표 삭제');
  await waitFor(() => expect(api.del).toHaveBeenCalledOnce());
  expect(api.del.mock.calls[0][1].data.expectedActorId).toBe(99);
  expect(api.del.mock.calls[0][1].data.expectedOrganizationId).toBeNull();
});
it('does not double-delete or callback twice in StrictMode while the receipt is pending', async () => {
  const deleted = vi.fn();
  const pending = deferred();
  render(
    <React.StrictMode>
      <Harness deleted={deleted} />
    </React.StrictMode>,
  );
  await ready();
  api.del.mockReturnValueOnce(pending.promise);
  click('지표 삭제');
  click('같은 요청으로 삭제 결과 확인');
  expect(api.del).toHaveBeenCalledOnce();
  const original = api.del.mock.calls[0][1].data;
  await act(async () => pending.resolve(receipt(original)));
  await waitFor(() => expect(deleted).toHaveBeenCalledOnce());
});
it.each([
  { metricId: 8 },
  { actorId: 0 },
  { actorId: undefined },
  { organizationId: 0 },
  { revision: 'bad' },
  { dependencies: [] },
  { dependencies: deps().filter(entry => entry.kind !== 'exportJobs') },
  { dependencies: deps().map(entry => (entry.kind === 'exportJobs' ? { ...entry, count: 0.5 } : entry)) },
  { dependencies: [...deps().slice(1), deps()[1]] },
  { dependencies: deps().map(entry => ({ ...entry, count: -1 })) },
  { dependencies: deps().map(entry => ({ ...entry, kind: 'SQL' })) },
  { canDelete: true, dependencies: deps().map(entry => ({ ...entry, count: 1 })) },
])('rejects malformed impact before any delete: %j', async over => {
  api.get.mockResolvedValueOnce(response(impact(over)));
  await expect(fetchMetricDeleteImpact(7)).rejects.toThrow();
  expect(api.del).not.toHaveBeenCalled();
});
it.each([{ receiptId: 0 }, { deleted: false }, { requestId: 'wrong' }, { metricId: 8 }, { replayed: undefined }])(
  'rejects malformed receipts: %j',
  async over => {
    api.del.mockResolvedValueOnce(receipt(request, over));
    await expect(submitMetricDeletion(7, request)).rejects.toThrow();
  },
);
it('forbids bodyless adapter calls and malformed routing/input without sending DELETE', async () => {
  await expect(MetricService.deleteMetric(7, undefined as any)).rejects.toThrow();
  await expect(submitMetricDeletion(7, { ...request, expectedActorId: 0 })).rejects.toThrow();
  await expect(submitMetricDeletion(0, request)).rejects.toThrow();
  expect(api.del).not.toHaveBeenCalled();
  api.get.mockResolvedValueOnce({ data: impact() });
  await expect(fetchMetricDeleteImpact(7)).rejects.toThrow();
});
it('hides stale impact on a read failure and never renders backend title or SQL fields', async () => {
  api.get.mockResolvedValueOnce(response(impact({ title: 'Backend private title', sql: 'secret SQL' })));
  render(<Harness />);
  await ready();
  expect(screen.queryByText(/Backend private title|secret SQL/)).toBeNull();
  api.get.mockRejectedValueOnce(new Error('failed'));
  click('사용처 다시 읽기');
  await screen.findByText(/사용처를 확인하지 못했습니다/);
  expect(screen.queryByText('대시보드 정의')).toBeNull();
  expect(button('지표 삭제').disabled).toBe(true);
});

it('allows ordinary pre-delete cancellation and a fresh impact for a different target without any DELETE', async () => {
  const view = render(<Harness />);
  await ready();
  click('닫기');
  expect(api.del).not.toHaveBeenCalled();
  view.rerender(<Harness selected={{ id: 8, title: 'Next ordinary target' }} />);
  api.get.mockResolvedValueOnce(response(impact({ metricId: 8 })));
  click('삭제 창 다시 열기');
  await ready();
  expect(screen.getByText(/Next ordinary target/)).toBeTruthy();
  expect(button('지표 삭제').disabled).toBe(false);
  expect(api.get).toHaveBeenLastCalledWith('/metric/8/delete-impact', undefined, { signal: expect.anything() });
  expect(api.del).not.toHaveBeenCalled();
});

it('withdraws old private title and pending intent before the session-change close callback runs', async () => {
  const deleted = vi.fn();
  const closed = vi.fn((open: boolean) => {
    if (!open) {
      expect(screen.queryByText(/Existing target title/)).toBeNull();
      expect(screen.queryByText('대시보드 정의')).toBeNull();
      expect(screen.queryByRole('button', { name: '같은 요청으로 삭제 결과 확인' })).toBeNull();
    }
  });
  render(<MetricDeleteDialog target={target} open onOpenChange={closed} onDeleted={deleted} />);
  await ready();
  api.del.mockRejectedValueOnce(new Error('unknown result'));
  click('지표 삭제');
  await screen.findByText(/삭제 결과를 확인하지 못했습니다/);
  expect(screen.getByText(/로그인 간 요청 복구는 지원하지 않습니다/)).toBeTruthy();
  api.get.mockRejectedValue({ response: { status: 403 } });
  act(() => {
    setToken('account-B');
    window.dispatchEvent(new StorageEvent('storage', { key: 'accessToken' }));
  });
  await waitFor(() => expect(closed).toHaveBeenCalledWith(false));
  expect(screen.queryByText(/Existing target title/)).toBeNull();
  expect(api.get).toHaveBeenCalledTimes(1);
  expect(api.del).toHaveBeenCalledTimes(1);
  expect(button('지표 삭제').disabled).toBe(true);
  click('지표 삭제');
  expect(api.del).toHaveBeenCalledTimes(1);
  expect(deleted).not.toHaveBeenCalled();
});

it('clears unknown intent on a new login, refuses the old target in B, and permits a fresh explicit impact in a new A session', async () => {
  const deleted = vi.fn();
  render(<Harness deleted={deleted} />);
  await ready();
  api.del.mockRejectedValueOnce(new Error('unknown'));
  click('지표 삭제');
  await screen.findByText(/삭제 결과를 확인하지 못했습니다/);
  const original = { ...api.del.mock.calls[0][1].data };
  api.get.mockRejectedValueOnce({ response: { status: 403 } });
  act(() => {
    setToken('account-B');
    window.dispatchEvent(new StorageEvent('storage', { key: 'accessToken' }));
  });
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.queryByText(/Existing target title/)).toBeNull();
  click('삭제 창 다시 열기');
  await screen.findByText(/사용처를 확인하지 못했습니다/);
  expect(screen.queryByText(/Existing target title/)).toBeNull();
  expect(screen.queryByRole('button', { name: '같은 요청으로 삭제 결과 확인' })).toBeNull();
  expect(button('지표 삭제').disabled).toBe(true);
  expect(api.del).toHaveBeenCalledTimes(1);
  act(() => {
    setToken('dialog-token');
    window.dispatchEvent(new StorageEvent('storage', { key: 'accessToken' }));
  });
  expect(screen.queryByRole('dialog')).toBeNull();
  api.get.mockResolvedValueOnce(response(impact({ revision: 'b'.repeat(64) })));
  click('삭제 창 다시 열기');
  await ready();
  expect(api.del).toHaveBeenCalledTimes(1);
  click('지표 삭제');
  await waitFor(() => expect(deleted).toHaveBeenCalledOnce());
  expect(api.del.mock.calls[1][1].data.requestId).not.toBe(original.requestId);
  expect(api.del.mock.calls[1][1].data.expectedRevision).toBe('b'.repeat(64));
});

it('preserves unknown intent and private title through a healthy same-actor token refresh', async () => {
  const token = (iat: number) =>
    `header.${btoa(JSON.stringify({ accessKeyData: { id: 19, authVersion: 0 }, iat })).replace(/=/g, '')}.signature${iat}`;
  setToken(token(1));
  const deleted = vi.fn();
  render(<Harness deleted={deleted} />);
  await ready();
  api.del.mockRejectedValueOnce(new Error('unknown'));
  click('지표 삭제');
  await screen.findByText(/삭제 결과를 확인하지 못했습니다/);
  const original = { ...api.del.mock.calls[0][1].data };
  act(() => {
    setToken(token(2), true);
    window.dispatchEvent(new StorageEvent('storage', { key: 'accessToken' }));
  });
  expect(screen.getByRole('dialog', { name: '지표 삭제 영향' })).toBeTruthy();
  expect(screen.getByText(/Existing target title/)).toBeTruthy();
  expect(button('같은 요청으로 삭제 결과 확인').disabled).toBe(false);
  expect(api.get).toHaveBeenCalledTimes(1);
  click('같은 요청으로 삭제 결과 확인');
  await waitFor(() => expect(deleted).toHaveBeenCalledOnce());
  expect(api.del.mock.calls[1][1].data).toEqual(original);
});

it('does not let an old account receipt release the new account pending operation', async () => {
  const deleted = vi.fn();
  const oldWrite = deferred();
  const newWrite = deferred();
  const view = render(<Harness deleted={deleted} />);
  await ready();
  api.del.mockReturnValueOnce(oldWrite.promise);
  click('지표 삭제');
  const original = api.del.mock.calls[0][1].data;
  act(() => {
    setToken('account-B');
    window.dispatchEvent(new StorageEvent('storage', { key: 'accessToken' }));
  });
  expect(screen.queryByRole('dialog')).toBeNull();
  view.rerender(<Harness selected={{ id: 8, title: 'B current target' }} deleted={deleted} />);
  api.get.mockResolvedValueOnce(response(impact({ metricId: 8, actorId: 22, revision: 'b'.repeat(64) })));
  click('삭제 창 다시 열기');
  await ready();
  api.del.mockReturnValueOnce(newWrite.promise);
  click('지표 삭제');
  const current = api.del.mock.calls[1][1].data;
  await act(async () => oldWrite.resolve(receipt(original)));
  expect(deleted).not.toHaveBeenCalled();
  expect(screen.queryByText(/Existing target title/)).toBeNull();
  expect(button('같은 요청으로 삭제 결과 확인').disabled).toBe(true);
  click('같은 요청으로 삭제 결과 확인');
  expect(api.del).toHaveBeenCalledTimes(2);
  await act(async () => newWrite.resolve(receipt(current, { metricId: 8 })));
  await waitFor(() => expect(deleted).toHaveBeenCalledOnce());
  expect(deleted.mock.calls[0][0].metricId).toBe(8);
});

it('accepts all four zero-count kinds including nonblocking export jobs without querying files or history', async () => {
  api.get.mockResolvedValueOnce(
    response(
      impact({
        dependencies: [
          { kind: 'dashboardDefinitions', count: 0 },
          { kind: 'studioDocuments', count: 0 },
          { kind: 'exploreViews', count: 0 },
          { kind: 'exportJobs', count: 0 },
        ],
      }),
    ),
  );
  render(<Harness />);
  await ready();
  expect(screen.getByText('대기·실행 중 출력 작업')).toBeTruthy();
  expect(button('지표 삭제').disabled).toBe(false);
  expect(api.get).toHaveBeenCalledTimes(1);
  expect(api.del).not.toHaveBeenCalled();
});
it('explains independent cancellation for active export jobs and never cancels them automatically', async () => {
  api.get.mockResolvedValueOnce(
    response(
      impact({
        canDelete: false,
        dependencies: deps().map(entry => (entry.kind === 'exportJobs' ? { ...entry, count: 1 } : entry)),
      }),
    ),
  );
  render(<Harness />);
  await screen.findByText(/별도로 명시 취소한 뒤 사용처를 다시 읽어 주세요/);
  expect(screen.getByText(/완료·실패·취소된 출력 작업의 파일과 기록은 삭제를 차단하지 않습니다/)).toBeTruthy();
  expect(button('지표 삭제').disabled).toBe(true);
  expect(api.get).toHaveBeenCalledTimes(1);
  expect(api.del).not.toHaveBeenCalled();
  expect(api.post).not.toHaveBeenCalled();
  expect(api.put).not.toHaveBeenCalled();
});
