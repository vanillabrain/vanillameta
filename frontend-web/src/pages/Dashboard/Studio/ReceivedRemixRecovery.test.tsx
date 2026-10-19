import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ReceivedRemixRecovery from './ReceivedRemixRecovery';
import { readReceivedRemixPending, ReceivedRemixPending, saveReceivedRemixPending } from './receivedRemixPendingStorage';
import { lookupReceivedRemixResult, previewRemix, saveRemix } from './studioRemixApi';
const mocks = vi.hoisted(() => ({ session: 'session-1', open: vi.fn(), discard: vi.fn() }));
vi.mock('@/api/personalLibraryService', () => ({ personalLibrarySessionScope: () => mocks.session }));
vi.mock('./PublishedDashboard', () => ({
  PublishedBlockView: ({ block }: any) => (
    <p>
      {block.title} {block.datas[0]?.value}
    </p>
  ),
}));
vi.mock('./studioRemixApi', async () => ({
  ...(await vi.importActual<any>('./studioRemixApi')),
  lookupReceivedRemixResult: vi.fn(),
  previewRemix: vi.fn(),
  saveRemix: vi.fn(),
}));
const scope = { actorId: 3, organizationId: 1, originId: 20, session: 'session-1' };
const reference = 'g-1-7-20-2-80-3-' + 'a'.repeat(64);
const ticket = (): ReceivedRemixPending => ({
  savedAt: Date.now(),
  actorId: 3,
  organizationId: 1,
  originId: 20,
  reference,
  input: {
    requestId: '533c472f-b03d-40a1-804c-4af4d787506c',
    targetSourceId: 22,
    mapping: { amount: 'total' },
    excludedBlockIds: [],
    expectedVersion: 2,
    expectedLifecycleRevision: 'c'.repeat(64),
    expectedSourceRevision: 'b'.repeat(64),
  },
});
const report = (): any => ({
  token: reference,
  version: 2,
  lifecycleRevision: 'c'.repeat(64),
  title: 'Received',
  requiredFields: [{ name: 'amount', type: 'BIGINT', blockIds: ['b1'] }],
  blocks: [{ id: 'b1', title: 'Total', kind: 'BOARD_NUMERIC', supported: true }],
  targetSourceId: 22,
  sourceRevision: 'b'.repeat(64),
  profile: { sourceId: 22, rowCount: '2', columns: [{ name: 'total', type: 'BIGINT' }] },
  mapping: { amount: 'total' },
  fields: [{ sourceColumn: 'amount', sourceType: 'BIGINT', targetColumn: 'total', status: 'mapped', candidates: ['total'] }],
  unmappedBlocks: [],
  unmappedConditions: [],
  preview: {
    widgets: [
      { blockId: 'b1', title: 'Total', type: 'BOARD_NUMERIC', valueField: 'value', datas: [{ value: 500 }], fields: [] },
    ],
  },
});
const renderRecovery = (p: ReceivedRemixPending | null = ticket(), storageError = false) => {
  if (p) saveReceivedRemixPending(scope, p);
  return render(
    <ReceivedRemixRecovery
      scope={scope}
      pending={p}
      storageError={storageError}
      onOpen={mocks.open}
      onDiscard={mocks.discard}
    />,
  );
};
const check = () => fireEvent.click(screen.getByRole('button', { name: '저장 결과 확인' }));
const repreview = () => fireEvent.click(screen.getByRole('button', { name: '보존한 조건으로 전체 미리보기' }));
const save = () => fireEvent.click(screen.getByRole('button', { name: '같은 복제 요청 저장' }));
beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  mocks.session = 'session-1';
  vi.mocked(lookupReceivedRemixResult).mockResolvedValue({ found: false });
  vi.mocked(previewRemix).mockResolvedValue(report());
  vi.mocked(saveRemix).mockResolvedValue({ dashboardId: 90, document: {} } as any);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it('does not automatically lookup/preview/save; a found copy opens only explicitly and clears its ticket', async () => {
  vi.mocked(lookupReceivedRemixResult).mockResolvedValueOnce({
    found: true,
    dashboardId: 90,
    sourceId: 22,
    revision: 'e'.repeat(64),
  });
  renderRecovery();
  expect(lookupReceivedRemixResult).not.toHaveBeenCalled();
  check();
  await screen.findByRole('button', { name: '내 사본 열기' });
  expect(previewRemix).not.toHaveBeenCalled();
  expect(saveRemix).not.toHaveBeenCalled();
  expect(readReceivedRemixPending(scope).pending).not.toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '내 사본 열기' }));
  expect(mocks.open).toHaveBeenCalledExactlyOnceWith(90);
  expect(readReceivedRemixPending(scope).pending).toBeNull();
});
it('missing -> original pinned preview -> full result and separate ACK -> exact frozen save', async () => {
  const p = ticket();
  renderRecovery(p);
  check();
  await screen.findByText(/조회 시점에 저장 영수증/);
  expect(saveRemix).not.toHaveBeenCalled();
  repreview();
  await screen.findByText('Total 500');
  expect(previewRemix).toHaveBeenCalledWith(
    reference,
    {
      targetSourceId: 22,
      mapping: { amount: 'total' },
      excludedBlockIds: [],
      expectedVersion: 2,
      expectedLifecycleRevision: 'c'.repeat(64),
    },
    expect.anything(),
  );
  expect((screen.getByRole('button', { name: '같은 복제 요청 저장' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('checkbox', { name: /원래 소스 기준과 전체 미리보기/ }));
  save();
  await waitFor(() => expect(mocks.open).toHaveBeenCalledWith(90));
  expect(saveRemix).toHaveBeenCalledExactlyOnceWith(reference, p.input);
});
it.each([
  { sourceRevision: 'd'.repeat(64) },
  { version: 3 },
  { lifecycleRevision: 'd'.repeat(64) },
  { targetSourceId: 23 },
  { unmappedBlocks: [{ blockId: 'b1', title: 'Total', reason: 'missing', missingFields: ['amount'] }] },
  { preview: { widgets: [] } },
])('refuses changed origin/source or unusable preview %s', async patch => {
  vi.mocked(previewRemix).mockResolvedValueOnce({ ...report(), ...patch });
  renderRecovery();
  check();
  await screen.findByText(/조회 시점에 저장 영수증/);
  repreview();
  await screen.findByRole('alert');
  expect(screen.queryByRole('button', { name: '같은 복제 요청 저장' })).toBeNull();
  expect(readReceivedRemixPending(scope).pending).not.toBeNull();
  expect(saveRemix).not.toHaveBeenCalled();
});
it.each([403, 409, 500])(
  'failed lookup/preview/save HTTP%s keeps the request and clears old consent/results',
  async status => {
    renderRecovery();
    check();
    await screen.findByText(/조회 시점에 저장 영수증/);
    repreview();
    await screen.findByText('Total 500');
    fireEvent.click(screen.getByRole('checkbox', { name: /원래 소스 기준과 전체 미리보기/ }));
    vi.mocked(saveRemix).mockRejectedValueOnce({ response: { status } });
    save();
    await screen.findByRole('alert');
    expect(screen.queryByText('Total 500')).toBeNull();
    expect(readReceivedRemixPending(scope).pending).not.toBeNull();
    vi.mocked(lookupReceivedRemixResult).mockRejectedValueOnce({ response: { status } });
    check();
    await screen.findByRole('alert');
    expect(screen.queryByRole('button', { name: '보존한 조건으로 전체 미리보기' })).toBeNull();
    expect(mocks.open).not.toHaveBeenCalled();
  },
);
it('new status check clears old preview/ack immediately and failures preserve ticket', async () => {
  renderRecovery();
  check();
  await screen.findByText(/조회 시점에 저장 영수증/);
  repreview();
  await screen.findByText('Total 500');
  fireEvent.click(screen.getByRole('checkbox', { name: /원래 소스 기준과 전체 미리보기/ }));
  vi.mocked(lookupReceivedRemixResult).mockRejectedValueOnce(new Error('offline'));
  check();
  expect(screen.queryByText('Total 500')).toBeNull();
  await screen.findByRole('alert');
  expect(readReceivedRemixPending(scope).pending).not.toBeNull();
});
it('malformed storage has a warned ACK discard path and never discloses stored private content', () => {
  renderRecovery(null, true);
  expect(screen.getByRole('alert')).toBeTruthy();
  expect(screen.queryByRole('button', { name: '저장 결과 확인' })).toBeNull();
  expect((screen.getByRole('button', { name: '복제 요청 보관 해제' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('checkbox', { name: /서버 결과와 사본이 남을 수/ }));
  fireEvent.click(screen.getByRole('button', { name: '복제 요청 보관 해제' }));
  expect(mocks.discard).toHaveBeenCalledTimes(1);
  expect(saveRemix).not.toHaveBeenCalled();
});
it('storage readback/write failure blocks retry save', async () => {
  renderRecovery();
  check();
  await screen.findByText(/조회 시점에 저장 영수증/);
  repreview();
  await screen.findByText('Total 500');
  fireEvent.click(screen.getByRole('checkbox', { name: /원래 소스 기준과 전체 미리보기/ }));
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('quota');
  });
  save();
  await screen.findByRole('alert');
  expect(saveRemix).not.toHaveBeenCalled();
});
it.each(['session', 'unmount'])('late result after %s cannot expose/open a copy or erase retained input', async change => {
  let resolve!: (v: any) => void;
  vi.mocked(lookupReceivedRemixResult).mockImplementationOnce(
    () =>
      new Promise(r => {
        resolve = r;
      }),
  );
  const view = renderRecovery();
  check();
  if (change === 'session') mocks.session = 'other';
  else view.unmount();
  await act(async () => resolve({ found: true, dashboardId: 90, sourceId: 22, revision: 'e'.repeat(64) }));
  expect(screen.queryByRole('button', { name: '내 사본 열기' })).toBeNull();
  expect(mocks.open).not.toHaveBeenCalled();
  expect(readReceivedRemixPending(scope).pending).not.toBeNull();
});
