import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ReportReader from './ReportReader';
import { textAnchorAt } from './reportAnchor';
import { commentError } from './reportCommentApi';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), scope: 'A' }));
vi.mock('@/api/personalLibraryService', () => ({ personalLibrarySessionScope: () => api.scope }));
vi.mock('@/helpers/apiHelper', () => ({ get: api.get, post: api.post }));
vi.mock('../Dashboard/Studio/PublishedBlockView', () => ({
  PublishedBlockView: ({ block }: { block: { title: string } }) => <h2>{block.title}</h2>,
}));

const id = '12345678-1234-4234-8234-123456789abc';
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const TEXT = ' 매출이 늘었다. \n\n비용은 줄었다.';
const reader = (role: 'owner' | 'recipient' = 'owner') => ({
  role,
  title: '협업 보고서',
  body: '매출이 늘었다.\n\n비용은 줄었다.',
  version: 2,
  savedAt: '2026-10-29T00:00:00Z',
  period: '전체 기간',
  timeZone: 'UTC',
  capturedAt: '2026-10-28T00:00:00Z',
  blocks: [
    { kind: 'kpi', title: '매출', description: '', display: {}, valueType: 'number', value: 1 },
    {
      kind: 'chart',
      chart: 'CHART_COLUMN',
      title: '채널',
      description: '',
      display: {},
      valueType: 'number',
      categoryType: 'string',
      points: [],
    },
  ],
  documentBlocks: [
    { id: 't1', kind: 'TEXT', text: ' 매출이 늘었다. ' },
    { id: 'img1', kind: 'IMAGE', dataUrl: 'data:image/png;base64,AAAA', alt: '채널 차트', width: 'full' },
    { id: 't2', kind: 'TEXT', text: '비용은 줄었다.' },
  ],
});
const author = (userId: string) => ({ kind: 'user', userId, clientName: null });
const ai = { kind: 'ai', userId: 'owner', clientName: 'Claude Desktop' };
const thread = (n: number, overrides: Record<string, unknown> = {}) => {
  const anchor = textAnchorAt(TEXT, 1, 4);
  return {
    id: uuid(n),
    version: 2,
    anchor,
    location: { status: 'exact', start: 1, end: 4 },
    status: 'open',
    statusVersion: 0,
    createdAt: '2026-10-30T00:00:00Z',
    author: author('peer'),
    mine: false,
    resolvedAt: null,
    resolvedBy: null,
    comments: [
      { id: uuid(n + 100), body: '근거가 있나요?', createdAt: '2026-10-30T00:00:00Z', author: author('peer'), mine: false },
    ],
    suggestions: [],
    ...overrides,
  };
};
const list = (threads: unknown[], version = 2, role = 'owner') => ({ role, version, threads });
const write = (operation: string, value: Record<string, unknown>) => ({
  replayed: false,
  operation,
  resultId: value.id,
  thread: value,
});
const routeGets = (comments: () => Promise<unknown>, report = reader()) =>
  api.get.mockImplementation(async (url: string) =>
    url.endsWith('/comments') ? { data: await comments() } : { data: report },
  );
const show = () =>
  render(
    <MemoryRouter initialEntries={[`/reports/${id}/read`]}>
      <Routes>
        <Route path="/reports/:reportId/read" element={<ReportReader />} />
      </Routes>
    </MemoryRouter>,
  );
const article = () => screen.getByRole('article', { name: '보고서 본문' });
const point = (target: number): [Node, number] => {
  const walker = document.createTreeWalker(article(), NodeFilter.SHOW_TEXT);
  let total = 0;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (target <= total + node.nodeValue.length) return [node, target - total];
    total += node.nodeValue.length;
  }
  throw new Error('offset outside the article');
};
const select = (start: number, end: number, touch = false) => {
  const range = document.createRange();
  range.setStart(...point(start));
  range.setEnd(...point(end));
  window.getSelection().removeAllRanges();
  window.getSelection().addRange(range);
  if (touch) fireEvent(document, new Event('selectionchange'));
  else fireEvent.mouseUp(article());
};
beforeEach(() => {
  api.get.mockReset();
  api.post.mockReset();
  api.scope = 'A';
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
});
afterEach(() => {
  window.getSelection()?.removeAllRanges();
  cleanup();
});

it('renders the untrimmed document text, highlights located open threads and labels authors', async () => {
  const detached = thread(2, {
    anchor: { kind: 'text', start: 0, end: 3, quote: '사라진 문장', prefix: '', suffix: '' },
    location: { status: 'detached' },
    comments: [{ id: uuid(202), body: '이 부분은요?', createdAt: '2026-10-30T00:00:00Z', author: ai, mine: false }],
  });
  routeGets(async () => list([thread(1), detached]));
  show();
  await screen.findByText('근거가 있나요?');
  expect(article().textContent).toBe(TEXT);
  const marks = article().querySelectorAll('mark');
  expect(Array.from(marks).map(mark => mark.textContent)).toEqual(['매출이']);
  expect(screen.getAllByText('peer').length).toBeGreaterThan(0);
  expect(screen.getByText('Claude · Claude Desktop')).toBeTruthy();
  expect(screen.getByText(/원문에서 찾을 수 없음/)).toBeTruthy();
});

it('creates a thread from a text selection with the shared anchor and the reader version', async () => {
  routeGets(async () => list([]));
  api.post.mockImplementation(async (url: string, body: { anchor: unknown; body: string }) => ({
    data: write('thread.create', {
      ...thread(3, {
        anchor: body.anchor,
        location: { status: 'exact', start: 13, end: 15 },
        comments: [
          { id: uuid(303), body: body.body, createdAt: '2026-10-30T00:00:00Z', author: author('owner'), mine: true },
        ],
      }),
    }),
  }));
  show();
  await screen.findByText('아직 댓글이 없습니다.');
  select(13, 15);
  fireEvent.click(screen.getByRole('button', { name: '선택한 부분에 댓글' }));
  fireEvent.change(screen.getByLabelText('새 댓글'), { target: { value: '비용 근거 추가' } });
  fireEvent.click(screen.getByRole('button', { name: '댓글 남기기' }));
  await screen.findByText('비용 근거 추가');
  const [url, body] = api.post.mock.calls[0];
  expect(url).toBe(`/reports/${id}/comments`);
  expect(body).toMatchObject({ version: 2, anchor: textAnchorAt(TEXT, 13, 15), body: '비용 근거 추가' });
  expect(body.requestId).toMatch(/^[0-9a-f-]{36}$/);
  await waitFor(() => expect(screen.queryByLabelText('새 댓글')).toBeNull());
});

it('offers the selection action for touch selections that fire only selectionchange', async () => {
  routeGets(async () => list([]));
  show();
  await screen.findByText('아직 댓글이 없습니다.');
  select(1, 4, true);
  const action = await screen.findByRole('button', { name: '선택한 부분에 댓글' });
  expect(screen.getByRole('group', { name: '선택한 본문' }).textContent).toContain('“매출이”');
  fireEvent.click(action);
  expect(screen.getByLabelText('새 댓글')).toBeTruthy();
});

it('comments on an image and on the whole report, reusing the request id for a retried send', async () => {
  routeGets(async () => list([]));
  api.post
    .mockRejectedValueOnce(new Error('network'))
    .mockImplementation(async (_url: string, body: { anchor: unknown }) => ({
      data: write('thread.create', thread(4, { anchor: body.anchor, location: { status: 'exact' } })),
    }));
  show();
  await screen.findByText('아직 댓글이 없습니다.');
  fireEvent.click(screen.getByRole('button', { name: '이미지 채널 차트에 댓글' }));
  fireEvent.change(screen.getByLabelText('새 댓글'), { target: { value: '축 설명' } });
  fireEvent.click(screen.getByRole('button', { name: '댓글 남기기' }));
  await screen.findByText(/댓글 요청을 완료하지 못했습니다/);
  fireEvent.click(screen.getByRole('button', { name: '댓글 남기기' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
  expect(api.post.mock.calls[0][1]).toEqual(api.post.mock.calls[1][1]);
  expect(api.post.mock.calls[0][1].anchor).toEqual({ kind: 'image', blockId: 'img1' });
  await waitFor(() => expect(screen.queryByLabelText('새 댓글')).toBeNull());
  fireEvent.click(screen.getByRole('button', { name: '보고서 전체에 댓글' }));
  expect(screen.getByLabelText('새 댓글').closest('.report-comment-new').textContent).toContain('보고서 전체');
});

it('proposes an edit on a located range, resolves by status version and shows the diff', async () => {
  routeGets(async () => list([thread(5)]));
  api.post.mockImplementation(async (url: string, body: any) => {
    if (url.endsWith('/suggestions'))
      return {
        data: write('suggestion.create', {
          ...thread(5),
          suggestions: [
            {
              id: uuid(505),
              baseVersion: 2,
              anchor: body.anchor,
              location: { status: 'exact', start: 1, end: 4 },
              replacement: body.replacement,
              rationale: body.rationale ?? null,
              status: 'open',
              statusVersion: 0,
              createdAt: '2026-10-30T00:00:00Z',
              author: author('owner'),
              mine: true,
              decidedAt: null,
              appliedVersion: null,
            },
          ],
        }),
      };
    return { data: write('thread.status', { ...thread(5), status: 'resolved', statusVersion: 1 }) };
  });
  show();
  await screen.findByText('근거가 있나요?');
  fireEvent.click(screen.getByRole('button', { name: '수정 제안' }));
  fireEvent.change(screen.getByLabelText('바꿀 문구'), { target: { value: '판매가' } });
  fireEvent.change(screen.getByLabelText('이유 (선택)'), { target: { value: '용어 통일' } });
  fireEvent.click(screen.getByRole('button', { name: '제안 보내기' }));
  const diff = await screen.findByRole('region', { name: '수정 제안' });
  expect(within(diff).getByLabelText('기존 문구').textContent).toBe('매출이');
  expect(within(diff).getByLabelText('제안 문구').textContent).toBe('판매가');
  expect(api.post.mock.calls[0][1]).toMatchObject({
    version: 2,
    threadId: uuid(5),
    anchor: textAnchorAt(TEXT, 1, 4),
    replacement: '판매가',
    rationale: '용어 통일',
  });
  fireEvent.click(screen.getByRole('button', { name: '해결' }));
  await screen.findByRole('button', { name: '다시 열기' });
  expect(api.post.mock.calls[1][1]).toMatchObject({ status: 'resolved', expectedStatusVersion: 0 });
});

it('hides resolve on threads a recipient does not own and blocks writes when versions disagree', async () => {
  routeGets(async () => list([thread(6, { mine: false })], 3, 'recipient'), reader('recipient'));
  show();
  await screen.findByText('근거가 있나요?');
  expect(screen.queryByRole('button', { name: '해결' })).toBeNull();
  expect(screen.getByRole('alert').textContent).toContain('새 버전');
  expect(screen.queryByRole('button', { name: '보고서 전체에 댓글' })).toBeNull();
  expect(screen.queryByRole('button', { name: '수정 제안' })).toBeNull();
  expect(article().querySelector('mark')).toBeNull();
});

it('drops the composer and ignores a late comment list when the window loses focus', async () => {
  let late: (value: unknown) => void;
  let calls = 0;
  routeGets(() => {
    calls += 1;
    return calls === 1 ? Promise.resolve(list([])) : new Promise(resolve => (late = resolve));
  });
  show();
  await screen.findByText('아직 댓글이 없습니다.');
  fireEvent.click(screen.getByRole('button', { name: '보고서 전체에 댓글' }));
  fireEvent.change(screen.getByLabelText('새 댓글'), { target: { value: '비밀 초안' } });
  fireEvent.blur(window);
  expect(screen.queryByDisplayValue('비밀 초안')).toBeNull();
  fireEvent.focus(window);
  await screen.findByText('댓글을 불러오는 중입니다.');
  fireEvent.blur(window);
  await act(async () => late(list([thread(7)])));
  expect(screen.queryByText('근거가 있나요?')).toBeNull();
  expect(screen.queryByDisplayValue('비밀 초안')).toBeNull();
});

it('maps comment errors from the Nest error envelope without the report-basis conflict copy', () => {
  const envelope = (status: number, data: unknown) => ({
    response: { status, data: { success: false, code: status, data, correlationId: 'c' } },
  });
  const limit = envelope(409, { statusCode: 409, message: '열린 제안은 보고서당 100개까지입니다.', code: 'COMMENT_LIMIT' });
  expect(commentError(limit)).toBe('열린 제안은 보고서당 100개까지입니다.');
  expect(commentError(envelope(413, { statusCode: 413, message: '', code: 'COMMENT_LIMIT' }))).toContain('한도');
  expect(commentError(envelope(400, '선택한 본문 범위를 확인해 주세요.'))).toBe('선택한 본문 범위를 확인해 주세요.');
  const stale = envelope(409, { statusCode: 409, message: '댓글 상태가 변경됐습니다.', error: 'Conflict' });
  expect(commentError(stale)).toBe('댓글 상태가 변경됐습니다.');
  const reused = envelope(409, {
    statusCode: 409,
    message: '같은 요청 ID의 입력이 다릅니다.',
    code: 'REQUEST_REUSED',
    resultId: '00000000-0000-4000-8000-000000000001',
  });
  expect(commentError(reused)).toBe(
    '이 요청은 이전 입력으로 이미 저장됐습니다. 목록을 새로 불러와 저장된 내용을 확인해 주세요.',
  );
  expect(commentError(envelope(409, {}))).toContain('댓글이나 제안');
  expect(commentError(envelope(409, {}))).not.toContain('기준');
  expect(commentError(new Error('network'))).toContain('연결');
});
