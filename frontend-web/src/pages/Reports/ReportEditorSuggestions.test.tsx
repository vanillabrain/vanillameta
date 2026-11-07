import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ReportEditor from './ReportEditor';
import { textAnchorAt } from './reportAnchor';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('@/api/personalLibraryService', () => ({ personalLibrarySessionScope: () => 'A' }));
vi.mock('@/helpers/apiHelper', () => ({ get: api.get, post: api.post }));
vi.mock('@/helpers/editorDraftStorage', () => ({ editorDraftKey: async () => 'actor-org-epoch' }));
vi.mock('@/helpers/authHelper', () => ({ getToken: () => 'session' }));
vi.mock('../Dashboard/Studio/PublishedBlockView', () => ({
  PublishedBlockView: ({ block }: { block: { title: string } }) => <h2>{block.title}</h2>,
}));

const id = '12345678-1234-4234-8234-123456789abc';
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const BODY = '매출이 늘었다.\n\n비용은 줄었다.';
const pendingKey = `actor-org-epoch:private-report:none:${id}`;
const block = (blockId: string, kind: string, title: string) => ({
  id: blockId,
  kind,
  title,
  description: '',
  display: {},
  valueField: 'value',
  fields: [{ columnName: 'value', columnType: 'number' }],
  datas: [{ value: 1 }],
});
const report = (version = 2, body = BODY) => ({
  reportId: id,
  version,
  title: '협업 보고서',
  body,
  blocks: [{ id: 'text', kind: 'TEXT', text: body }],
  savedAt: '2026-10-29T00:01:00Z',
  revision: String(version).repeat(64),
  organizationId: null,
  snapshot: {
    capturedAt: '2026-10-29T00:00:00Z',
    rendered: {
      title: 'Sales',
      periodLabel: '전체 기간',
      blocks: [block('kpi', 'BOARD_NUMERIC', '매출 KPI'), block('chart', 'CHART_COLUMN', '채널 매출')],
    },
    basis: {
      dashboardId: 2,
      dashboardRevision: 'a'.repeat(64),
      source: { id: 1, revision: 'b'.repeat(64), schemaVersion: 'c'.repeat(64), dataVersion: 'd'.repeat(64) },
      selection: { kpiId: 'kpi', chartId: 'chart' },
      timeZone: 'UTC',
    },
  },
});
const author = { kind: 'ai', userId: 'owner', clientName: 'Claude Desktop' };
const suggestion = (n: number, anchor: ReturnType<typeof textAnchorAt>, replacement: string, status = 'open') => ({
  id: uuid(n),
  baseVersion: 1,
  anchor,
  location: { status: 'exact', start: anchor.start, end: anchor.end },
  replacement,
  rationale: null,
  status,
  statusVersion: status === 'open' ? 0 : 1,
  createdAt: '2026-10-30T00:00:00Z',
  author,
  mine: false,
  decidedAt: null,
  appliedVersion: null,
});
const first = suggestion(1, textAnchorAt(BODY, 0, 3), '판매가');
const lost = suggestion(2, { kind: 'text', start: 0, end: 3, quote: '사라진 문장', prefix: '', suffix: '' }, '새 문장');
const thread = (suggestions = [first, lost]) => ({
  id: uuid(10),
  version: 1,
  anchor: textAnchorAt(BODY, 0, 3),
  location: { status: 'exact', start: 0, end: 3 },
  status: 'open',
  statusVersion: 0,
  createdAt: '2026-10-30T00:00:00Z',
  author,
  mine: false,
  resolvedAt: null,
  resolvedBy: null,
  visibility: 'private',
  canManage: true,
  narrowLocked: false,
  viewerCount: 0,
  comments: [{ id: uuid(11), body: '용어를 맞춰 주세요.', createdAt: '2026-10-30T00:00:00Z', author, mine: false }],
  suggestions,
});
let threads: unknown[];
const show = () =>
  render(
    <MemoryRouter initialEntries={[`/reports/${id}`]}>
      <Routes>
        <Route path="/reports/:reportId" element={<ReportEditor />} />
      </Routes>
    </MemoryRouter>,
  );
const textarea = () => screen.getByLabelText('본문') as HTMLTextAreaElement;
const card = (replacement: string) => screen.getByText(replacement, { selector: 'ins' }).closest('section');
beforeEach(() => {
  threads = [thread()];
  api.get.mockReset();
  api.post.mockReset();
  sessionStorage.clear();
  api.get.mockImplementation(async (url: string) =>
    url.endsWith('/comments') ? { data: { role: 'owner', version: 2, threads } } : { data: report() },
  );
});
afterEach(cleanup);

it('applies a suggestion to the draft only, undoes it, and saves the applied id through the pending ticket', async () => {
  let finish: (value: unknown) => void;
  api.post.mockImplementation(() => new Promise(resolve => (finish = resolve)));
  show();
  await screen.findByText('판매가', { selector: 'ins' });
  expect(within(card('새 문장')).getByRole('button', { name: '본문에 적용' }).hasAttribute('disabled')).toBe(true);
  fireEvent.click(within(card('판매가')).getByRole('button', { name: '본문에 적용' }));
  expect(textarea().value).toBe('판매가 늘었다.\n\n비용은 줄었다.');
  expect(within(card('판매가')).getByText(/초안에 적용됨/)).toBeTruthy();
  expect(within(card('판매가')).getByRole('button', { name: '본문에 적용' }).hasAttribute('disabled')).toBe(true);
  expect(api.post).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole('button', { name: '직전 적용 되돌리기' }));
  expect(textarea().value).toBe(BODY);
  expect(within(card('판매가')).queryByText(/초안에 적용됨/)).toBeNull();

  fireEvent.click(within(card('판매가')).getByRole('button', { name: '본문에 적용' }));
  fireEvent.click(screen.getByRole('button', { name: '비공개 저장', exact: true }));
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
  const [url, command] = api.post.mock.calls[0];
  expect(url).toBe(`/reports/${id}/save`);
  expect(command.appliedSuggestionIds).toEqual([first.id]);
  expect(command.body).toBe('판매가 늘었다.\n\n비용은 줄었다.');
  expect(JSON.parse(sessionStorage.getItem(pendingKey)).command.appliedSuggestionIds).toEqual([first.id]);

  threads = [thread([{ ...first, status: 'applied', statusVersion: 1, appliedVersion: 3 }, lost])];
  const listCalls = api.get.mock.calls.filter(([path]) => path.endsWith('/comments')).length;
  await act(async () =>
    finish({ data: { report: report(3, command.body), replayed: false, appliedSuggestionIds: [first.id] } }),
  );
  await screen.findByText(/제안 1건을 적용 완료로 표시했습니다/);
  await waitFor(() => expect(api.get.mock.calls.filter(([path]) => path.endsWith('/comments')).length).toBe(listCalls + 1));
  await waitFor(() => expect(screen.queryByText('판매가', { selector: 'ins' })).toBeNull());
  expect(sessionStorage.getItem(pendingKey)).toBeNull();
});

it('re-locates against the current draft and refuses to apply once the quoted text is gone', async () => {
  show();
  await screen.findByText('판매가', { selector: 'ins' });
  fireEvent.change(textarea(), { target: { value: '첫 줄 추가\n' + BODY } });
  expect(within(card('판매가')).getByRole('button', { name: '본문에 적용' }).hasAttribute('disabled')).toBe(false);
  fireEvent.click(within(card('판매가')).getByRole('button', { name: '본문에 적용' }));
  expect(textarea().value).toBe('첫 줄 추가\n판매가 늘었다.\n\n비용은 줄었다.');
  fireEvent.click(screen.getByRole('button', { name: '직전 적용 되돌리기' }));
  fireEvent.change(textarea(), { target: { value: '전부 새로 썼다.' } });
  expect(within(card('판매가')).getByRole('button', { name: '본문에 적용' }).hasAttribute('disabled')).toBe(true);
  expect(within(card('판매가')).getByText(/찾지 못해 적용할 수 없습니다/)).toBeTruthy();
});

it('dismisses an open suggestion with its status version and never sends a save', async () => {
  api.post.mockImplementation(async () => ({
    data: {
      replayed: false,
      operation: 'suggestion.dismiss',
      resultId: lost.id,
      thread: thread([first, { ...lost, status: 'dismissed', statusVersion: 1 }]),
    },
  }));
  show();
  await screen.findByText('새 문장', { selector: 'ins' });
  fireEvent.click(within(card('새 문장')).getByRole('button', { name: '제안 닫기' }));
  await waitFor(() => expect(screen.queryByText('새 문장', { selector: 'ins' })).toBeNull());
  expect(api.post).toHaveBeenCalledTimes(1);
  expect(api.post.mock.calls[0][0]).toBe(`/reports/${id}/suggestions/${lost.id}/dismiss`);
  expect(api.post.mock.calls[0][1]).toMatchObject({ expectedStatusVersion: 0 });
});

it('restores applied ids from a pending ticket so a resend carries them', async () => {
  const command = {
    requestId: uuid(99),
    expectedOrganizationId: null,
    expectedRevision: '2'.repeat(64),
    title: '협업 보고서',
    body: '판매가 늘었다.\n\n비용은 줄었다.',
    appliedSuggestionIds: [first.id],
    blocks: [{ id: 'text', kind: 'TEXT', text: '판매가 늘었다.\n\n비용은 줄었다.' }],
    data: { mode: 'retain', fromRevision: '2'.repeat(64) },
  };
  sessionStorage.setItem(
    pendingKey,
    JSON.stringify({ version: 1, reportId: id, dashboardId: 2, updatedAt: Date.now(), command }),
  );
  api.get.mockImplementation(async (url: string) => {
    if (url.endsWith('/comments')) return { data: { role: 'owner', version: 2, threads } };
    if (url.includes('/outcome/')) return { data: { status: 'missing' } };
    return { data: report() };
  });
  api.post.mockResolvedValue({
    data: { report: report(3, command.body), replayed: false, appliedSuggestionIds: [first.id] },
  });
  show();
  await screen.findByRole('button', { name: '동일 요청 다시 보내기' });
  await waitFor(() => expect(within(card('판매가')).getByText(/초안에 적용됨/)).toBeTruthy());
  fireEvent.click(screen.getByRole('button', { name: '동일 요청 다시 보내기' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
  expect(api.post.mock.calls[0][1]).toEqual(command);
});
