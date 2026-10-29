import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ReportReader from './ReportReader';
import ReportShares from './ReportShares';
import { readerSchema, readerBlocks, ShareCommand } from './reportSharingApi';
import { readSharePending, sharePendingKey, storeSharePending } from './reportSharePending';
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), scope: 'A' }));
vi.mock('@/api/personalLibraryService', () => ({ personalLibrarySessionScope: () => api.scope }));
vi.mock('@/helpers/apiHelper', () => ({ get: api.get, post: api.post }));
vi.mock('../Dashboard/Studio/PublishedBlockView', () => ({
  PublishedBlockView: ({ block }: { block: { title: string; datas: unknown; display: { suffix?: string } } }) => (
    <section>
      <h2>{block.title}</h2>
      <p>
        {JSON.stringify(block.datas)} {block.display.suffix}
      </p>
    </section>
  ),
}));
const id = '12345678-1234-4234-8234-123456789abc';
const hash = 'e'.repeat(64);
const read = () => ({
  role: 'recipient',
  title: '고정 매출 보고서',
  body: '<script>명시한 본문</script>',
  version: 1,
  savedAt: '2026-10-29T00:00:00Z',
  period: '전체 기간',
  timeZone: 'UTC',
  capturedAt: '2026-10-28T00:00:00Z',
  blocks: [
    {
      kind: 'kpi',
      title: '매출',
      description: '',
      display: { suffix: 'USD', decimalPlaces: 2 },
      valueType: 'number',
      value: '16537.01',
      trend: { grain: 'day', points: [{ time: '2026-10-28', value: '16537.01' }] },
    },
    {
      kind: 'chart',
      chart: 'CHART_COLUMN',
      title: '채널 매출',
      description: '',
      display: { suffix: 'USD' },
      valueType: 'number',
      categoryType: 'string',
      points: [{ category: 'Site', value: 500 }],
    },
  ],
});
const shares = () => ({
  organizationId: 1,
  headRevision: hash,
  headVersion: 1,
  canShare: true,
  items: [
    { recipientId: 8, userId: '동료', team: '팀', active: true, relationVersion: 1, pinnedVersion: 1, status: 'active' },
  ],
  nextCursor: null,
});
const command = (): ShareCommand => ({
  requestId: '22345678-1234-4234-8234-123456789abc',
  expectedOrganizationId: 1,
  recipientId: 8,
  expectedRelationVersion: 1,
  operation: { kind: 'revoke' },
});
const receipt = (input: ShareCommand) => ({
  requestId: input.requestId,
  recipientId: input.recipientId,
  operation: input.operation.kind,
  relationVersion: 2,
  pinnedVersion: 1,
  committedAt: '2026-10-29T00:00:00Z',
});
const showReader = () =>
  render(
    <MemoryRouter initialEntries={[`/reports/${id}/read`]}>
      <Routes>
        <Route path="/reports/:reportId/read" element={<ReportReader />} />
      </Routes>
    </MemoryRouter>,
  );
const showShares = (reviewedVersion = 1) => render(<ReportShares id={id} reviewedVersion={reviewedVersion} />);
beforeEach(() => {
  api.get.mockReset();
  api.post.mockReset();
  api.scope = 'A';
  sessionStorage.clear();
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
});
afterEach(cleanup);
it('renders plaintext and mapped values with shared units without recipient edit or source links', async () => {
  api.get.mockResolvedValue({ data: read() });
  const view = showReader();
  await screen.findByText('고정 매출 보고서');
  expect(screen.getByText('<script>명시한 본문</script>')).toBeTruthy();
  expect(view.container.querySelector('script')).toBeNull();
  expect(screen.queryByRole('link', { name: /편집|Studio/ })).toBeNull();
  expect(screen.queryByRole('button', { name: '공유 관리' })).toBeNull();
  expect(screen.getByText(/16537.01/).textContent).toContain('USD');
  const mapped = readerBlocks(readerSchema.parse(read()));
  expect(mapped[1].datas).toEqual([{ category: 'Site', value: 500 }]);
  expect(mapped[0].trend.points).toEqual([{ time: '2026-10-28', value: '16537.01' }]);
  expect(readerSchema.safeParse({ ...read(), revision: hash }).success).toBe(false);
});
it('conceals on focus before rechecking, leaves content absent after 403, and ignores an older success', async () => {
  let late: (value: unknown) => void;
  api.get
    .mockResolvedValueOnce({ data: read() })
    .mockImplementationOnce(
      () =>
        new Promise(resolve => {
          late = resolve;
        }),
    )
    .mockRejectedValueOnce({ response: { status: 403 } });
  showReader();
  await screen.findByText('고정 매출 보고서');
  fireEvent.focus(window);
  expect(screen.queryByText('고정 매출 보고서')).toBeNull();
  fireEvent.focus(window);
  await screen.findByRole('alert');
  await act(async () => late({ data: read() }));
  expect(screen.queryByText('고정 매출 보고서')).toBeNull();
  expect(screen.queryByText('<script>명시한 본문</script>')).toBeNull();
});
it('conceals on blur and hidden visibility and rejects old-account responses', async () => {
  let late: (value: unknown) => void;
  api.get.mockResolvedValueOnce({ data: read() }).mockImplementation(
    () =>
      new Promise(resolve => {
        late = resolve;
      }),
  );
  showReader();
  await screen.findByText('고정 매출 보고서');
  fireEvent.blur(window);
  expect(screen.queryByText('고정 매출 보고서')).toBeNull();
  fireEvent.focus(window);
  api.scope = 'B';
  await act(async () => late({ data: read() }));
  expect(screen.queryByText('고정 매출 보고서')).toBeNull();
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
  fireEvent(document, new Event('visibilitychange'));
  expect(screen.queryByText('매출')).toBeNull();
});
it('requires the displayed reader version to match the sharing head before new consent', async () => {
  api.get.mockResolvedValue({ data: { ...shares(), headVersion: 2 } });
  showShares(1);
  await screen.findByText(/최신 저장본을 먼저 검토/);
  expect(screen.queryByRole('button', { name: '검색', exact: true })).toBeNull();
  expect(screen.queryByRole('button', { name: '최신 저장본 공유' })).toBeNull();
  expect(screen.getByRole('button', { name: '회수' })).toBeTruthy();
  expect(api.post).not.toHaveBeenCalled();
});
it('requires separate keyboard cancel/confirm and preserves the exact ticket after committed POST then failed current GET', async () => {
  let failCurrent = false;
  api.get.mockImplementation(async () => {
    if (failCurrent) throw new Error('offline');
    return { data: shares() };
  });
  api.post.mockImplementation(async (_url, input: ShareCommand) => {
    failCurrent = true;
    return { data: { receipt: receipt(input), replayed: false } };
  });
  const view = showShares();
  const revoke = await screen.findByRole('button', { name: '회수' });
  revoke.focus();
  fireEvent.click(revoke);
  expect(api.post).not.toHaveBeenCalled();
  const cancel = screen.getByRole('button', { name: '취소' });
  expect(document.activeElement).toBe(cancel);
  fireEvent.keyDown(cancel, { key: 'Escape' });
  expect(screen.queryByRole('button', { name: '확정' })).toBeNull();
  expect(document.activeElement).toBe(revoke);
  fireEvent.click(screen.getByRole('button', { name: '회수' }));
  fireEvent.click(screen.getByRole('button', { name: '확정' }));
  await screen.findByRole('alert');
  const key = sharePendingKey('A', 1, id);
  const pending = readSharePending(key);
  expect(pending).toEqual(api.post.mock.calls[0][1]);
  expect(api.post).toHaveBeenCalledTimes(1);
  view.unmount();
  api.get.mockImplementation(async (url: string) => ({
    data: url.includes('/outcome/') ? { status: 'committed', receipt: receipt(pending) } : shares(),
  }));
  showShares();
  await waitFor(() => expect(readSharePending(key)).toBeNull());
  expect(api.post).toHaveBeenCalledTimes(1);
  expect(api.get.mock.calls.some(([url]) => url.endsWith('/outcome/' + pending.requestId))).toBe(true);
  expect(await screen.findByText('동료 · 팀')).toBeTruthy();
});
it('reload and failed outcome keep the ticket; only explicit retry sends its original UUID and CAS', async () => {
  const saved = command(),
    key = sharePendingKey('A', 1, id);
  storeSharePending(key, saved);
  api.get.mockImplementation(async (url: string) => {
    if (url.includes('/outcome/')) throw new Error('offline');
    return { data: shares() };
  });
  api.post.mockRejectedValue({ response: { status: 409 } });
  showShares();
  await screen.findByRole('alert');
  expect(api.post).not.toHaveBeenCalled();
  expect(readSharePending(key)).toEqual(saved);
  const retry = screen.getByRole('button', { name: '동일 요청 재시도 검토' });
  retry.focus();
  fireEvent.click(retry);
  fireEvent.keyDown(screen.getByRole('button', { name: '취소' }), { key: 'Escape' });
  expect(document.activeElement).toBe(retry);
  expect(api.post).not.toHaveBeenCalled();
  expect(readSharePending(key)).toEqual(saved);
  fireEvent.click(retry);
  fireEvent.click(screen.getByRole('button', { name: '확정' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
  expect(api.post.mock.calls[0][1]).toEqual(saved);
  expect(readSharePending(key)).toEqual(saved);
});
it('isolates pending tickets by actor/org/report scope and expires bounded storage without POST', () => {
  const key = sharePendingKey('A', 1, id),
    saved = command();
  expect(storeSharePending(key, saved)).toBe(true);
  expect(readSharePending(sharePendingKey('B', 1, id))).toBeNull();
  expect(readSharePending(sharePendingKey('A', 2, id))).toBeNull();
  expect(readSharePending(key, Date.now() + 24 * 60 * 60 * 1000 + 1)).toBeNull();
  sessionStorage.setItem(key, 'x'.repeat(9000));
  expect(readSharePending(key)).toBeNull();
  expect(api.post).not.toHaveBeenCalled();
});
it('keeps search identity and query across visibility reads, cancels consent, and clears a late 403', async () => {
  let rejectRead: (reason: unknown) => void;
  api.get.mockResolvedValue({ data: shares() });
  showShares();
  const input = await screen.findByRole('textbox', { name: '같은 조직 직원 검색' });
  fireEvent.change(input, { target: { value: '동료 이름' } });
  fireEvent.click(screen.getByRole('button', { name: '회수' }));
  expect(screen.getByRole('button', { name: '확정' })).toBeTruthy();
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
  fireEvent(document, new Event('visibilitychange'));
  expect(screen.getByRole('textbox', { name: '같은 조직 직원 검색' })).toBe(input);
  expect(screen.queryByRole('button', { name: '확정' })).toBeNull();
  expect(screen.getByText('동료 · 팀').closest('[hidden]')).toBeTruthy();
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  fireEvent(document, new Event('visibilitychange'));
  await screen.findByRole('button', { name: '회수' });
  expect(screen.getByRole('textbox', { name: '같은 조직 직원 검색' })).toBe(input);
  expect((input as HTMLInputElement).value).toBe('동료 이름');
  api.get.mockImplementation(
    () =>
      new Promise((_resolve, reject) => {
        rejectRead = reject;
      }),
  );
  fireEvent.focus(window);
  await act(async () => rejectRead({ response: { status: 403 } }));
  expect(await screen.findByRole('alert')).toBeTruthy();
  expect(screen.queryByText('동료 · 팀')).toBeNull();
  expect(api.post).not.toHaveBeenCalled();
});
it('clears the previous session search workspace on storage changes', async () => {
  api.get.mockResolvedValue({ data: shares() });
  showShares();
  const input = await screen.findByRole('textbox', { name: '같은 조직 직원 검색' });
  fireEvent.change(input, { target: { value: '동료 이름' } });
  api.scope = 'B';
  fireEvent(window, new Event('storage'));
  const next = await screen.findByRole('textbox', { name: '같은 조직 직원 검색' });
  expect(next).not.toBe(input);
  expect((next as HTMLInputElement).value).toBe('');
});
it('preserves the owner sharing shell while both reader and recipient authority refresh', async () => {
  api.get.mockImplementation(async (url: string) => ({
    data: url.endsWith('/shares') ? shares() : { ...read(), role: 'owner' },
  }));
  showReader();
  const manage = await screen.findByRole('button', { name: '공유 관리', exact: true });
  fireEvent.click(manage);
  const input = await screen.findByRole('textbox', { name: '같은 조직 직원 검색' });
  fireEvent.change(input, { target: { value: '이름 유지' } });
  fireEvent.click(screen.getByRole('button', { name: '회수' }));
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
  fireEvent(document, new Event('visibilitychange'));
  expect(screen.getByRole('button', { name: '공유 관리', exact: true })).toBe(manage);
  expect(screen.getByRole('textbox', { name: '같은 조직 직원 검색' })).toBe(input);
  expect(screen.queryByRole('button', { name: '확정' })).toBeNull();
  expect(screen.queryByText('고정 매출 보고서')).toBeNull();
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  fireEvent(document, new Event('visibilitychange'));
  await screen.findByRole('button', { name: '회수' });
  expect(screen.getByRole('textbox', { name: '같은 조직 직원 검색' })).toBe(input);
  expect((input as HTMLInputElement).value).toBe('이름 유지');
  expect(api.post).not.toHaveBeenCalled();
});
it('discards peer results and consent when a newer sharing version arrives', async () => {
  let version = 1;
  api.get.mockImplementation(async (url: string) => ({
    data: url.endsWith('/peers')
      ? { items: [{ id: 9, userId: '검색한 직원', team: '다른 팀' }], nextCursor: null }
      : { ...shares(), headVersion: version },
  }));
  showShares();
  const input = await screen.findByRole('textbox', { name: '같은 조직 직원 검색' });
  fireEvent.change(input, { target: { value: '검색한 직원' } });
  fireEvent.click(screen.getByRole('button', { name: '검색', exact: true }));
  fireEvent.click(await screen.findByRole('button', { name: '이 직원 선택' }));
  expect(screen.getByRole('button', { name: '확정' })).toBeTruthy();
  version = 2;
  fireEvent.focus(window);
  await screen.findByText(/최신 저장본을 먼저 검토/);
  expect(screen.queryByRole('button', { name: '확정' })).toBeNull();
  expect(screen.queryByText('검색한 직원 · 다른 팀')).toBeNull();
  expect(api.post).not.toHaveBeenCalled();
});
it.each(['peers', 'post', 'outcome'])(
  'invalidates reader and sharing data after %s authorization failure without discarding a ticket',
  async failure => {
    let denied = false;
    const saved = command();
    const key = sharePendingKey('A', 1, id);
    if (failure === 'outcome') storeSharePending(key, saved);
    api.get.mockImplementation(async (url: string) => {
      if ((failure === 'peers' && url.includes('/peers')) || (failure === 'outcome' && url.includes('/outcome/')))
        denied = true;
      if (denied) throw { response: { status: 403 } };
      return { data: url.endsWith('/shares') ? shares() : { ...read(), role: 'owner' } };
    });
    api.post.mockImplementation(async () => {
      denied = true;
      throw { response: { status: 403 } };
    });
    showReader();
    fireEvent.click(await screen.findByRole('button', { name: '공유 관리', exact: true }));
    if (failure === 'peers') {
      fireEvent.click(await screen.findByRole('button', { name: '검색', exact: true }));
    } else if (failure === 'post') {
      fireEvent.click(await screen.findByRole('button', { name: '회수', exact: true }));
      fireEvent.click(screen.getByRole('button', { name: '확정', exact: true }));
    }
    await waitFor(() => expect(screen.queryByText('고정 매출 보고서')).toBeNull());
    await waitFor(() => expect(screen.queryByText('동료 · 팀')).toBeNull());
    expect(screen.queryByText('<script>명시한 본문</script>')).toBeNull();
    if (failure === 'peers') expect(readSharePending(key)).toBeNull();
    else expect(readSharePending(key)).toEqual(failure === 'post' ? api.post.mock.calls[0][1] : saved);
  },
);
