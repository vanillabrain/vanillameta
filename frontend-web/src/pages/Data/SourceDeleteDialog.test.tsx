import React, { useState } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import SourceDeleteDialog from './SourceDeleteDialog';
import {
  sourceDeletionDependencyLabels,
  fetchSourceDeleteImpact,
  submitSourceDeletion,
  fetchSourceDeletions,
  fetchSourceDeletionReceipt,
  cleanupSourceDeletion,
} from '@/api/sourceDeletionService';
import DatabaseService from '@/api/databaseService';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setToken } from '@/helpers/authHelper';
const api = vi.hoisted(() => ({ get: vi.fn(), del: vi.fn(), put: vi.fn(), post: vi.fn() }));
vi.mock('@/helpers/apiHelper', () => api);
const target = { id: 7, title: 'Existing target title' };
const deps = () => Object.keys(sourceDeletionDependencyLabels).map(kind => ({ kind, count: 0 }));
const impact = (over: Record<string, unknown> = {}) => ({
  sourceId: 7,
  actorId: 19,
  organizationId: 3,
  revision: 'a'.repeat(64),
  canDelete: true,
  managedFileCount: 2,
  dependencies: deps(),
  ...over,
});
const response = (data: any) => ({ data: { status: 'SUCCESS', data } });
const request = {
  requestId: '11111111-1111-4111-8111-111111111111',
  expectedRevision: 'a'.repeat(64),
  expectedActorId: 19,
  expectedOrganizationId: 3,
};
const receipt = (body = request, over: Record<string, unknown> = {}) =>
  response({
    sourceId: 7,
    requestId: body.requestId,
    receiptId: 41,
    deleted: true,
    replayed: false,
    cleanup: { status: 'pending', managedFiles: 2 },
    ...over,
  });
const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }));
const button = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement;
const deferred = () => {
  let resolve!: (v: any) => void;
  const promise = new Promise<any>(res => {
    resolve = res;
  });
  return { promise, resolve };
};
const ready = () =>
  screen.findByText('현재 확인한 사용처가 없습니다. 소스 연결 정보를 영구 삭제하며 파일 정리는 별도로 실행합니다.');
function Harness({ selected = target, deleted = vi.fn() }: any) {
  const [open, setOpen] = useState(true);
  const [client] = useState(() => new QueryClient());
  return (
    <>
      <button onClick={() => setOpen(true)}>삭제 창 다시 열기</button>
      <QueryClientProvider client={client}>
        <SourceDeleteDialog target={selected} open={open} onOpenChange={setOpen} onDeleted={deleted} />
      </QueryClientProvider>
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
  expect(screen.getByRole('dialog', { name: '소스 삭제 영향' })).toBeTruthy();
  expect(screen.getByText(/Existing target title/)).toBeTruthy();
  expect(api.get).toHaveBeenCalledWith('/database/7/delete-impact', undefined, { signal: expect.anything() });
  expect(api.del).not.toHaveBeenCalled();
  click('소스 삭제');
  await waitFor(() => expect(deleted).toHaveBeenCalledOnce());
  const body = api.del.mock.calls[0][1].data;
  expect(body).toEqual({ ...request, requestId: expect.stringMatching(/^[a-f0-9-]{36}$/) });
  expect(api.del).toHaveBeenCalledWith('/database/7', { data: body });
  expect(deleted).toHaveBeenCalledWith({
    sourceId: 7,
    requestId: body.requestId,
    receiptId: 41,
    deleted: true,
    replayed: false,
    cleanup: { status: 'pending', managedFiles: 2 },
  });
  expect(api.get).toHaveBeenCalledTimes(1);
  expect(api.put).not.toHaveBeenCalled();
  expect(api.post).not.toHaveBeenCalled();
});
it.each(Object.keys(sourceDeletionDependencyLabels))('blocks %s without auto-stopping any reference', async kind => {
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
  expect(screen.getByText(sourceDeletionDependencyLabels[kind])).toBeTruthy();
  expect(screen.getByText('2개')).toBeTruthy();
  expect(button('소스 삭제').disabled).toBe(true);
  click('소스 삭제');
  expect(api.del).not.toHaveBeenCalled();
  expect(api.post).not.toHaveBeenCalled();
});
it('requires explicit impact reload after 409 and uses a new frozen revision, actor and organization', async () => {
  render(<Harness />);
  await ready();
  api.del.mockRejectedValueOnce({ response: { status: 409 } });
  click('소스 삭제');
  await screen.findByText(/삭제 기준이나 사용처가 변경/);
  const original = api.del.mock.calls[0][1].data;
  expect(button('소스 삭제').disabled).toBe(true);
  expect(api.get).toHaveBeenCalledTimes(1);
  api.get.mockResolvedValueOnce(response(impact({ actorId: 22, organizationId: 8, revision: 'b'.repeat(64) })));
  click('사용처 다시 읽기');
  await ready();
  click('소스 삭제');
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
  click('소스 삭제');
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
  api.del.mockResolvedValueOnce(receipt(request, { sourceId: 8 }));
  click('소스 삭제');
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
  api.get.mockResolvedValueOnce(response(impact({ sourceId: 8 })));
  view.rerender(<Harness selected={{ id: 8, title: 'Second target' }} />);
  await ready();
  await act(async () =>
    pending.resolve(response(impact({ canDelete: false, dependencies: deps().map(entry => ({ ...entry, count: 1 })) }))),
  );
  expect(screen.getByText(/Second target/)).toBeTruthy();
  expect(button('소스 삭제').disabled).toBe(false);
});
it('retains the original pending target and rejects its late receipt after a target change', async () => {
  const deleted = vi.fn();
  const pending = deferred();
  const view = render(<Harness deleted={deleted} />);
  await ready();
  api.del.mockReturnValueOnce(pending.promise);
  click('소스 삭제');
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
  click('소스 삭제');
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
  click('소스 삭제');
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
  click('소스 삭제');
  click('같은 요청으로 삭제 결과 확인');
  expect(api.del).toHaveBeenCalledOnce();
  const original = api.del.mock.calls[0][1].data;
  await act(async () => pending.resolve(receipt(original)));
  await waitFor(() => expect(deleted).toHaveBeenCalledOnce());
});
it.each([
  { sourceId: 8 },
  { actorId: 0 },
  { actorId: undefined },
  { organizationId: 0 },
  { revision: 'bad' },
  { managedFileCount: -1 },
  { managedFileCount: undefined },
  { dependencies: [] },
  { dependencies: deps().filter(entry => entry.kind !== 'exportJobs') },
  { dependencies: deps().map(entry => (entry.kind === 'exportJobs' ? { ...entry, count: 0.5 } : entry)) },
  { dependencies: [...deps().slice(1), deps()[1]] },
  { dependencies: deps().map(entry => ({ ...entry, count: -1 })) },
  { dependencies: deps().map(entry => ({ ...entry, kind: 'SQL' })) },
  { canDelete: true, dependencies: deps().map(entry => ({ ...entry, count: 1 })) },
])('rejects malformed impact before any delete: %j', async over => {
  api.get.mockResolvedValueOnce(response(impact(over)));
  await expect(fetchSourceDeleteImpact(7)).rejects.toThrow();
  expect(api.del).not.toHaveBeenCalled();
});
it.each([{ receiptId: 0 }, { deleted: false }, { requestId: 'wrong' }, { sourceId: 8 }, { replayed: undefined }])(
  'rejects malformed receipts: %j',
  async over => {
    api.del.mockResolvedValueOnce(receipt(request, over));
    await expect(submitSourceDeletion(7, request)).rejects.toThrow();
  },
);
it('forbids bodyless adapter calls and malformed routing/input without sending DELETE', async () => {
  await expect(DatabaseService.deleteDatabase(7, undefined as any)).rejects.toThrow();
  await expect(submitSourceDeletion(7, { ...request, expectedActorId: 0 })).rejects.toThrow();
  await expect(submitSourceDeletion(0, request)).rejects.toThrow();
  expect(api.del).not.toHaveBeenCalled();
  api.get.mockResolvedValueOnce({ data: impact() });
  await expect(fetchSourceDeleteImpact(7)).rejects.toThrow();
});
it('hides stale impact on a read failure and never renders backend title or SQL fields', async () => {
  api.get.mockResolvedValueOnce(response(impact({ title: 'Backend private title', sql: 'secret SQL' })));
  render(<Harness />);
  await ready();
  expect(screen.queryByText(/Backend private title|secret SQL/)).toBeNull();
  api.get.mockRejectedValueOnce(new Error('failed'));
  click('사용처 다시 읽기');
  await screen.findByText(/사용처를 확인하지 못했습니다/);
  expect(screen.queryByText('데이터셋')).toBeNull();
  expect(button('소스 삭제').disabled).toBe(true);
});

it('allows ordinary pre-delete cancellation and a fresh impact for a different target without any DELETE', async () => {
  const view = render(<Harness />);
  await ready();
  click('닫기');
  expect(api.del).not.toHaveBeenCalled();
  view.rerender(<Harness selected={{ id: 8, title: 'Next ordinary target' }} />);
  api.get.mockResolvedValueOnce(response(impact({ sourceId: 8 })));
  click('삭제 창 다시 열기');
  await ready();
  expect(screen.getByText(/Next ordinary target/)).toBeTruthy();
  expect(button('소스 삭제').disabled).toBe(false);
  expect(api.get).toHaveBeenLastCalledWith('/database/8/delete-impact', undefined, { signal: expect.anything() });
  expect(api.del).not.toHaveBeenCalled();
});

it('withdraws old private title and pending intent before the session-change close callback runs', async () => {
  const deleted = vi.fn();
  const closed = vi.fn((open: boolean) => {
    if (!open) {
      expect(screen.queryByText(/Existing target title/)).toBeNull();
      expect(screen.queryByText('데이터셋')).toBeNull();
      expect(screen.queryByRole('button', { name: '같은 요청으로 삭제 결과 확인' })).toBeNull();
    }
  });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <SourceDeleteDialog target={target} open onOpenChange={closed} onDeleted={deleted} />
    </QueryClientProvider>,
  );
  await ready();
  api.del.mockRejectedValueOnce(new Error('unknown result'));
  click('소스 삭제');
  await screen.findByText(/삭제 결과를 확인하지 못했습니다/);
  expect(screen.getByText(/미확정 삭제 요청의 로그인 간 복구는 지원하지 않습니다/)).toBeTruthy();
  api.get.mockRejectedValue({ response: { status: 403 } });
  act(() => {
    setToken('account-B');
    window.dispatchEvent(new StorageEvent('storage', { key: 'accessToken' }));
  });
  await waitFor(() => expect(closed).toHaveBeenCalledWith(false));
  expect(screen.queryByText(/Existing target title/)).toBeNull();
  expect(api.get).toHaveBeenCalledTimes(1);
  expect(api.del).toHaveBeenCalledTimes(1);
  expect(button('소스 삭제').disabled).toBe(true);
  click('소스 삭제');
  expect(api.del).toHaveBeenCalledTimes(1);
  expect(deleted).not.toHaveBeenCalled();
});

it('clears unknown intent on a new login, refuses the old target in B, and permits a fresh explicit impact in a new A session', async () => {
  const deleted = vi.fn();
  render(<Harness deleted={deleted} />);
  await ready();
  api.del.mockRejectedValueOnce(new Error('unknown'));
  click('소스 삭제');
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
  expect(button('소스 삭제').disabled).toBe(true);
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
  click('소스 삭제');
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
  click('소스 삭제');
  await screen.findByText(/삭제 결과를 확인하지 못했습니다/);
  const original = { ...api.del.mock.calls[0][1].data };
  act(() => {
    setToken(token(2), true);
    window.dispatchEvent(new StorageEvent('storage', { key: 'accessToken' }));
  });
  expect(screen.getByRole('dialog', { name: '소스 삭제 영향' })).toBeTruthy();
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
  click('소스 삭제');
  const original = api.del.mock.calls[0][1].data;
  act(() => {
    setToken('account-B');
    window.dispatchEvent(new StorageEvent('storage', { key: 'accessToken' }));
  });
  expect(screen.queryByRole('dialog')).toBeNull();
  view.rerender(<Harness selected={{ id: 8, title: 'B current target' }} deleted={deleted} />);
  api.get.mockResolvedValueOnce(response(impact({ sourceId: 8, actorId: 22, revision: 'b'.repeat(64) })));
  click('삭제 창 다시 열기');
  await ready();
  api.del.mockReturnValueOnce(newWrite.promise);
  click('소스 삭제');
  const current = api.del.mock.calls[1][1].data;
  await act(async () => oldWrite.resolve(receipt(original)));
  expect(deleted).not.toHaveBeenCalled();
  expect(screen.queryByText(/Existing target title/)).toBeNull();
  expect(button('같은 요청으로 삭제 결과 확인').disabled).toBe(true);
  click('같은 요청으로 삭제 결과 확인');
  expect(api.del).toHaveBeenCalledTimes(2);
  await act(async () => newWrite.resolve(receipt(current, { sourceId: 8 })));
  await waitFor(() => expect(deleted).toHaveBeenCalledOnce());
  expect(deleted.mock.calls[0][0].sourceId).toBe(8);
});

it('keeps confirmed metadata deletion open for a separate explicit managed-file cleanup', async () => {
  const deleted = vi.fn();
  api.post.mockImplementation(async (_path, body) => receipt(body, { cleanup: { status: 'complete', managedFiles: 2 } }));
  render(<Harness deleted={deleted} />);
  await ready();
  expect(screen.getByText('정리 대상 관리 파일 2개')).toBeTruthy();
  click('소스 삭제');
  await screen.findByText('소스 #7 연결 정보 삭제 확정 · 영수증 #41');
  expect(deleted).toHaveBeenCalledOnce();
  expect(api.post).not.toHaveBeenCalled();
  const original = api.del.mock.calls[0][1].data;
  click('닫기');
  click('삭제 창 다시 열기');
  expect(api.get).toHaveBeenCalledTimes(1);
  expect(api.post).not.toHaveBeenCalled();
  click('파일 정리');
  await screen.findByText('관리 파일 2개 · 파일 정리 완료');
  expect(api.post).toHaveBeenCalledWith('/database/deletions/41/cleanup', { requestId: original.requestId });
  expect(button('파일 정리').disabled).toBe(true);
  expect(api.del).toHaveBeenCalledOnce();
  expect(deleted).toHaveBeenCalledOnce();
});
it('treats direct-only source completion as confirmed without any cleanup POST', async () => {
  api.get.mockResolvedValueOnce(response(impact({ managedFileCount: 0 })));
  api.del.mockImplementationOnce(async (_path, config) =>
    receipt(config.data, { cleanup: { status: 'complete', managedFiles: 0 } }),
  );
  render(<Harness />);
  await ready();
  click('소스 삭제');
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(api.post).not.toHaveBeenCalled();
});
it.each(['pending', 'retry_required'])(
  'requires another explicit action after cleanup %s without automatic looping',
  async status => {
    api.post.mockImplementation(async (_path, body) => receipt(body, { cleanup: { status, managedFiles: 2 } }));
    render(<Harness />);
    await ready();
    click('소스 삭제');
    await screen.findByText('소스 #7 연결 정보 삭제 확정 · 영수증 #41');
    click('파일 정리');
    await waitFor(() => expect(button('파일 정리').disabled).toBe(false));
    expect(api.post).toHaveBeenCalledOnce();
    expect(api.del).toHaveBeenCalledOnce();
    click('파일 정리');
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
    expect(api.post.mock.calls[1]).toEqual(api.post.mock.calls[0]);
  },
);
it('keeps the same receipt after unknown cleanup and allows explicit retry after collapse', async () => {
  api.post.mockRejectedValueOnce(new Error('response lost'));
  render(<Harness />);
  await ready();
  click('소스 삭제');
  await screen.findByText('소스 #7 연결 정보 삭제 확정 · 영수증 #41');
  click('파일 정리');
  await screen.findByText(/파일 정리 결과를 확인하지 못했습니다/);
  const call = api.post.mock.calls[0];
  click('닫기');
  click('삭제 창 다시 열기');
  expect(api.get).toHaveBeenCalledTimes(1);
  expect(api.post).toHaveBeenCalledOnce();
  api.post.mockResolvedValueOnce(
    receipt(api.del.mock.calls[0][1].data, { cleanup: { status: 'complete', managedFiles: 2 } }),
  );
  click('파일 정리');
  await screen.findByText('관리 파일 2개 · 파일 정리 완료');
  expect(api.post.mock.calls[1]).toEqual(call);
  expect(api.del).toHaveBeenCalledOnce();
});
it('does not double-submit cleanup in StrictMode or accept a receipt from another source', async () => {
  const pending = deferred();
  api.post.mockReturnValueOnce(pending.promise);
  render(
    <React.StrictMode>
      <Harness />
    </React.StrictMode>,
  );
  await ready();
  click('소스 삭제');
  await screen.findByText('소스 #7 연결 정보 삭제 확정 · 영수증 #41');
  click('파일 정리');
  click('파일 정리');
  expect(api.post).toHaveBeenCalledOnce();
  await act(async () =>
    pending.resolve(
      receipt(api.del.mock.calls[0][1].data, { sourceId: 8, cleanup: { status: 'complete', managedFiles: 2 } }),
    ),
  );
  await screen.findByText(/파일 정리 결과를 확인하지 못했습니다/);
  expect(screen.queryByText('관리 파일 2개 · 파일 정리 완료')).toBeNull();
  expect(screen.getByText('소스 #7 연결 정보 삭제 확정 · 영수증 #41')).toBeTruthy();
});
it('resumes server history manually after a fresh mount without automatic deletion or cleanup', async () => {
  api.get.mockResolvedValueOnce(
    response({ nextBeforeId: null, actorId: 19, organizationId: 3, entries: [receipt().data.data] }),
  );
  render(<Harness selected={null} />);
  expect(api.get).not.toHaveBeenCalled();
  click('파일 정리 기록 읽기');
  await screen.findByRole('button', { name: '영수증 #41 확인' });
  expect(api.get).toHaveBeenCalledWith('/database/deletions', undefined, { signal: expect.anything() });
  expect(api.del).not.toHaveBeenCalled();
  expect(api.post).not.toHaveBeenCalled();
  api.get.mockResolvedValueOnce(receipt());
  click('영수증 #41 확인');
  await screen.findByText('소스 #7 연결 정보 삭제 확정 · 영수증 #41');
  expect(api.get).toHaveBeenLastCalledWith('/database/deletions/41', undefined, { signal: expect.anything() });
  expect(api.post).not.toHaveBeenCalled();
  expect(button('소스 삭제').disabled).toBe(true);
});
it('hides stale server history after failure and never projects server private fields', async () => {
  api.get.mockResolvedValueOnce(
    response({
      nextBeforeId: null,
      actorId: 19,
      organizationId: null,
      entries: [{ ...receipt().data.data, title: 'Secret receipt title', path: '/private/hidden' }],
    }),
  );
  render(<Harness selected={null} />);
  click('파일 정리 기록 읽기');
  await screen.findByRole('button', { name: '영수증 #41 확인' });
  expect(screen.queryByText(/Secret receipt title|private\/hidden/)).toBeNull();
  api.get.mockRejectedValueOnce(new Error('offline'));
  click('파일 정리 기록 읽기');
  await screen.findByText(/파일 정리 기록을 읽지 못했습니다/);
  expect(screen.queryByRole('button', { name: '영수증 #41 확인' })).toBeNull();
});
it('hides receipt and ignores late cleanup after changing login', async () => {
  const pending = deferred();
  api.post.mockReturnValueOnce(pending.promise);
  render(<Harness />);
  await ready();
  click('소스 삭제');
  await screen.findByText('소스 #7 연결 정보 삭제 확정 · 영수증 #41');
  click('파일 정리');
  act(() => {
    setToken('account-B');
    window.dispatchEvent(new StorageEvent('storage', { key: 'accessToken' }));
  });
  expect(screen.queryByText(/소스 #7 연결 정보/)).toBeNull();
  await act(async () =>
    pending.resolve(receipt(api.del.mock.calls[0][1].data, { cleanup: { status: 'complete', managedFiles: 2 } })),
  );
  expect(screen.queryByText(/파일 정리 완료/)).toBeNull();
  expect(api.post).toHaveBeenCalledOnce();
});
it.each([
  { cleanup: undefined },
  { cleanup: { status: 'unknown', managedFiles: 2 } },
  { cleanup: { status: 'pending', managedFiles: -1 } },
  { cleanup: { status: 'complete', managedFiles: 0.5 } },
])('rejects invalid metadata cleanup receipt: %j', async over => {
  api.del.mockResolvedValueOnce(receipt(request, over));
  await expect(submitSourceDeletion(7, request)).rejects.toThrow();
});
it.each([
  { actorId: 0 },
  { actorId: undefined },
  { organizationId: 0 },
  { entries: [receipt().data.data, receipt().data.data] },
  { entries: [{ ...receipt().data.data, requestId: 'bad' }] },
])('rejects malformed history: %j', async over => {
  api.get.mockResolvedValueOnce(response({ nextBeforeId: null, actorId: 19, organizationId: null, entries: [], ...over }));
  await expect(fetchSourceDeletions()).rejects.toThrow();
});
it('rejects mismatched receipt reads and exact cleanup UUID/route mismatches', async () => {
  const expected = receipt().data.data;
  api.get.mockResolvedValueOnce(receipt(request, { receiptId: 42 }));
  await expect(fetchSourceDeletionReceipt(expected)).rejects.toThrow();
  api.post.mockResolvedValueOnce(receipt(request, { cleanup: { status: 'complete', managedFiles: 3 } }));
  await expect(cleanupSourceDeletion(expected)).rejects.toThrow();
  expect(api.post).toHaveBeenCalledWith('/database/deletions/41/cleanup', { requestId: request.requestId });
});
it('rejects late history results after a login boundary without showing former source numbers', async () => {
  const pending = deferred();
  api.get.mockReturnValueOnce(pending.promise);
  render(<Harness selected={null} />);
  click('파일 정리 기록 읽기');
  act(() => {
    setToken('history-account-B');
    window.dispatchEvent(new StorageEvent('storage', { key: 'accessToken' }));
  });
  await act(async () =>
    pending.resolve(response({ nextBeforeId: null, actorId: 19, organizationId: 3, entries: [receipt().data.data] })),
  );
  click('삭제 창 다시 열기');
  expect(screen.queryByText(/소스 #7/)).toBeNull();
  expect(screen.queryByRole('button', { name: '영수증 #41 확인' })).toBeNull();
  expect(api.post).not.toHaveBeenCalled();
  expect(api.del).not.toHaveBeenCalled();
});
it('keeps a confirmed cleanup receipt through healthy token refresh and collapse without rerunning deletion', async () => {
  const token = (iat: number) =>
    `header.${btoa(JSON.stringify({ accessKeyData: { id: 19, authVersion: 0 }, iat }))}.signature`;
  setToken(token(1));
  render(<Harness />);
  await ready();
  click('소스 삭제');
  await screen.findByText('소스 #7 연결 정보 삭제 확정 · 영수증 #41');
  act(() => {
    setToken(token(2), true);
    window.dispatchEvent(new StorageEvent('storage', { key: 'accessToken' }));
  });
  click('닫기');
  click('삭제 창 다시 열기');
  expect(screen.getByText('소스 #7 연결 정보 삭제 확정 · 영수증 #41')).toBeTruthy();
  expect(button('파일 정리').disabled).toBe(false);
  expect(api.get).toHaveBeenCalledTimes(1);
  expect(api.del).toHaveBeenCalledOnce();
  expect(api.post).not.toHaveBeenCalled();
});
it('uses exactly ten dependency kinds including shared files and ready unexpired export references', async () => {
  expect(Object.keys(sourceDeletionDependencyLabels)).toEqual([
    'datasets',
    'tableQueries',
    'metrics',
    'dashboards',
    'exploreViews',
    'directPermissions',
    'groupPermissions',
    'publications',
    'exportJobs',
    'sharedFiles',
  ]);
  api.get.mockResolvedValueOnce(
    response(
      impact({
        canDelete: false,
        dependencies: deps().map(entry => (entry.kind === 'exportJobs' ? { ...entry, count: 1 } : entry)),
      }),
    ),
  );
  render(<Harness />);
  await screen.findByText(/미만료 완료 출력 파일과 다른 소스의 파일 참조도 삭제를 차단합니다/);
  expect(button('소스 삭제').disabled).toBe(true);
  expect(api.post).not.toHaveBeenCalled();
});
it('loads older pending receipts only on explicit load-more with a descending cursor', async () => {
  const older = receipt({ ...request, requestId: '22222222-2222-4222-8222-222222222222' }, { receiptId: 40, sourceId: 8 })
    .data.data;
  api.get.mockResolvedValueOnce(
    response({ actorId: 19, organizationId: 3, entries: [receipt().data.data], nextBeforeId: 41 }),
  );
  render(<Harness selected={null} />);
  click('파일 정리 기록 읽기');
  await screen.findByRole('button', { name: '영수증 #41 확인' });
  expect(api.get).toHaveBeenCalledOnce();
  api.get.mockResolvedValueOnce(response({ actorId: 19, organizationId: 3, entries: [older], nextBeforeId: null }));
  click('이전 파일 정리 기록 더 읽기');
  await screen.findByRole('button', { name: '영수증 #40 확인' });
  expect(screen.getByRole('button', { name: '영수증 #41 확인' })).toBeTruthy();
  expect(api.get).toHaveBeenLastCalledWith('/database/deletions', { beforeId: 41 }, { signal: expect.anything() });
  expect(screen.queryByRole('button', { name: '이전 파일 정리 기록 더 읽기' })).toBeNull();
  expect(api.del).not.toHaveBeenCalled();
  expect(api.post).not.toHaveBeenCalled();
});
it.each([undefined, 0, 42])('rejects missing or nonprogressing history cursor %s', async nextBeforeId => {
  api.get.mockResolvedValueOnce(
    response({ actorId: 19, organizationId: null, entries: [receipt().data.data], nextBeforeId }),
  );
  await expect(fetchSourceDeletions()).rejects.toThrow();
});
it('hides history when a later page reports a changed server organization', async () => {
  api.get.mockResolvedValueOnce(
    response({ actorId: 19, organizationId: 3, entries: [receipt().data.data], nextBeforeId: 41 }),
  );
  render(<Harness selected={null} />);
  click('파일 정리 기록 읽기');
  await screen.findByRole('button', { name: '영수증 #41 확인' });
  api.get.mockResolvedValueOnce(response({ actorId: 19, organizationId: 4, entries: [], nextBeforeId: null }));
  click('이전 파일 정리 기록 더 읽기');
  await screen.findByText(/파일 정리 기록을 읽지 못했습니다/);
  expect(screen.queryByRole('button', { name: '영수증 #41 확인' })).toBeNull();
});
