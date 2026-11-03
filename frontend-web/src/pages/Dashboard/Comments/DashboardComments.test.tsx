import React from 'react';
import { afterEach, beforeEach, expect, it, onTestFinished, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { DashboardCommentsButton, DashboardCommentsPanel, useDashboardComments } from './DashboardComments';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('@/helpers/apiHelper', () => ({ get: api.get, post: api.post }));

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const REVISION = 'a'.repeat(64);
const NEXT_REVISION = 'b'.repeat(64);
const user = (userId: string) => ({ kind: 'user', userId, clientName: null });
const blocks = [
  { blockId: 'block-a', title: '매출 추이 (월)', type: 'CHART_LINE' },
  { blockId: 'block-b', title: '채널 비중', type: 'CHART_PIE' },
];
const thread = (n: number, overrides: Record<string, unknown> = {}) => ({
  id: uuid(n),
  anchor: { kind: 'whole' },
  location: 'exact',
  changed: false,
  status: 'open',
  statusVersion: 0,
  createdAt: '2026-11-03T00:00:00Z',
  author: user('peer'),
  mine: false,
  resolvedAt: null,
  resolvedBy: null,
  comments: [{ id: uuid(n + 100), body: `의견 ${n}`, createdAt: '2026-11-03T00:00:00Z', author: user('peer'), mine: false }],
  ...overrides,
});
const list = (threads: unknown[], overrides: Record<string, unknown> = {}) => ({
  revision: REVISION,
  canManage: true,
  blockAnchors: true,
  blocks,
  threads,
  ...overrides,
});
const receipt = (operation: string, value: Record<string, unknown>) => ({
  data: { replayed: false, operation, resultId: value.id, thread: value },
});
const rejected = (status: number, data: unknown = {}) => ({ response: { status, data } });

/** Stands in for DashboardAnalysis cards: same data-block-id and data-comment-trigger contract. */
function Harness() {
  const comments = useDashboardComments('7', '2026-11-03');
  return (
    <>
      <DashboardCommentsButton comments={comments} disabled={false} />
      {blocks.map(block => (
        <section
          key={block.blockId}
          data-block-id={block.blockId}
          data-comment-active={comments.cards?.activeBlockId === block.blockId || undefined}
        >
          {comments.cards?.blocks.has(block.blockId) && (
            <button data-comment-trigger onClick={event => comments.cards?.onComment(block.blockId, event.currentTarget)}>
              {`차트 ${block.title}에 댓글`}
            </button>
          )}
        </section>
      ))}
      <DashboardCommentsPanel comments={comments} />
    </>
  );
}
const panel = () => screen.getByRole('complementary', { name: '댓글' });
const openPanel = async (data: unknown) => {
  api.get.mockResolvedValue({ data });
  render(<Harness />);
  fireEvent.click(screen.getByRole('button', { name: '댓글' }));
  await waitFor(() => expect(api.get).toHaveBeenCalled());
};
const threadItem = (name: string) => within(panel()).getByRole('listitem', { name: `댓글 스레드 ${name}` });
const write = async (label: string, body: string, submit: string, scope: HTMLElement = panel()) => {
  fireEvent.change(within(scope).getByLabelText(label), { target: { value: body } });
  fireEvent.click(within(scope).getByRole('button', { name: submit }));
};

beforeEach(() => vi.resetAllMocks());
afterEach(cleanup);

it('loads comments with the view so chart buttons show before the panel opens', async () => {
  api.get.mockResolvedValue({ data: list([]) });
  render(<Harness />);
  expect(await screen.findAllByRole('button', { name: /에 댓글$/ })).toHaveLength(2);
  expect(api.get).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: '댓글' }));
  await within(panel()).findByText('아직 댓글이 없습니다.');
  expect(api.get).toHaveBeenCalledWith('/dashboards/7/comments', undefined, expect.anything());
  api.post.mockResolvedValue(receipt('dashboard.thread.create', thread(1)));
  fireEvent.click(within(panel()).getByRole('button', { name: '새 댓글' }));
  expect((within(panel()).getByLabelText('대상') as HTMLSelectElement).value).toBe('__whole__');
  await write('새 댓글', '전체 흐름은 좋아요', '댓글 남기기');
  await waitFor(() => expect(threadItem('대시보드 전체')).toBeTruthy());
  expect(api.post).toHaveBeenCalledWith(
    '/dashboards/7/comments',
    { requestId: expect.any(String), revision: REVISION, anchor: { kind: 'whole' }, body: '전체 흐름은 좋아요' },
    expect.anything(),
  );
  expect(within(panel()).queryByLabelText('새 댓글')).toBeNull();
});

it('pre-targets the chart whose card button opened the composer', async () => {
  await openPanel(list([]));
  const card = await screen.findByRole('button', { name: '차트 채널 비중에 댓글' });
  api.post.mockResolvedValue(receipt('dashboard.thread.create', thread(2, { anchor: { kind: 'block', ...blocks[1] } })));
  fireEvent.click(card);
  expect((within(panel()).getByLabelText('대상') as HTMLSelectElement).value).toBe('block-b');
  await write('새 댓글', '비중 합이 100%가 아니에요', '댓글 남기기');
  await waitFor(() => expect(threadItem('차트 · 채널 비중')).toBeTruthy());
  expect(api.post.mock.calls[0][1]).toMatchObject({ anchor: { kind: 'block', blockId: 'block-b' }, revision: REVISION });
});

it('hides chart buttons when the dashboard only accepts whole-dashboard comments', async () => {
  await openPanel(list([], { blockAnchors: false, blocks: [] }));
  await within(panel()).findByText('아직 댓글이 없습니다.');
  expect(screen.queryByRole('button', { name: /에 댓글$/ })).toBeNull();
  fireEvent.click(within(panel()).getByRole('button', { name: '새 댓글' }));
  expect(within(panel()).queryByLabelText('대상')).toBeNull();
  expect(within(panel()).getByText('대시보드 전체')).toBeTruthy();
});

it('labels chart threads, flags changed and detached charts, and focuses the exact chart', async () => {
  const scrolled: Element[] = [];
  const original = HTMLElement.prototype.scrollIntoView;
  HTMLElement.prototype.scrollIntoView = function (this: HTMLElement) {
    scrolled.push(this);
  };
  onTestFinished(() => {
    HTMLElement.prototype.scrollIntoView = original;
  });
  await openPanel(
    list([
      thread(1, {
        anchor: { kind: 'block', blockId: 'block-a', title: '매출 추이', type: 'CHART_LINE' },
        changed: true,
      }),
      thread(2, {
        anchor: { kind: 'block', blockId: 'block-gone', title: '삭제된 차트', type: 'CHART_BAR' },
        location: 'detached',
      }),
    ]),
  );
  const changed = await waitFor(() => threadItem('차트 · 매출 추이'));
  expect(within(changed).getByText('변경됨 · 현재 차트 · 매출 추이 (월)')).toBeTruthy();
  expect(within(threadItem('차트 · 삭제된 차트')).getByText('차트 없음 · 분리됨')).toBeTruthy();
  fireEvent.click(within(changed).getByRole('button', { name: /차트 · 매출 추이/ }));
  const card = document.querySelector('[data-block-id="block-a"]') as HTMLElement;
  await waitFor(() => expect(card.getAttribute('data-comment-active')).toBe('true'));
  expect(scrolled).toEqual([card]);
  fireEvent.click(within(threadItem('차트 · 삭제된 차트')).getByRole('button', { name: /차트 · 삭제된 차트/ }));
  await waitFor(() => expect(card.getAttribute('data-comment-active')).toBeNull());
  expect(scrolled).toHaveLength(1);
});

it('lets managers resolve and reopen with the status version, and hides it from readers', async () => {
  await openPanel(list([thread(1)]));
  const item = await waitFor(() => threadItem('대시보드 전체'));
  api.post.mockResolvedValue(receipt('dashboard.thread.status', thread(1, { status: 'resolved', statusVersion: 1 })));
  fireEvent.click(within(item).getByRole('button', { name: '해결' }));
  await within(threadItem('대시보드 전체')).findByRole('button', { name: '다시 열기' });
  expect(api.post).toHaveBeenCalledWith(
    `/dashboards/7/comments/${uuid(1)}/status`,
    { requestId: expect.any(String), status: 'resolved', expectedStatusVersion: 0 },
    expect.anything(),
  );
  cleanup();
  vi.resetAllMocks();
  await openPanel(list([thread(1, { mine: true })], { canManage: false }));
  const own = await waitFor(() => threadItem('대시보드 전체'));
  expect(within(own).queryByRole('button', { name: '해결' })).toBeNull();
  expect(within(panel()).getByText('내가 시작한 스레드만 보이며 대시보드 편집 권한자도 볼 수 있습니다.')).toBeTruthy();
});

it('replies inside a thread', async () => {
  await openPanel(list([thread(1)]));
  const item = await waitFor(() => threadItem('대시보드 전체'));
  const replied = thread(1, {
    comments: [
      ...thread(1).comments,
      { id: uuid(300), body: '반영했습니다', createdAt: '2026-11-03T01:00:00Z', author: user('owner'), mine: true },
    ],
  });
  api.post.mockResolvedValue(receipt('dashboard.comment.reply', replied));
  await write('답글', '반영했습니다', '답글 남기기', item);
  await within(threadItem('대시보드 전체')).findByText('반영했습니다');
  expect(api.post).toHaveBeenCalledWith(
    `/dashboards/7/comments/${uuid(1)}/replies`,
    { requestId: expect.any(String), body: '반영했습니다' },
    expect.anything(),
  );
});

it('shows an AI author as Claude with its client name', async () => {
  const ai = { kind: 'ai', userId: 'owner', clientName: 'Claude Code' };
  await openPanel(list([thread(1, { author: ai, comments: [{ ...thread(1).comments[0], author: ai, body: 'AI 의견' }] })]));
  const item = await waitFor(() => threadItem('대시보드 전체'));
  expect(within(item).getByText('Claude · Claude Code')).toBeTruthy();
});

it('hides the comment UI when the list is forbidden and returns focus to the trigger', async () => {
  api.get.mockRejectedValue(rejected(403, { success: false, code: 403, data: { message: '조직 정책' } }));
  render(<Harness />);
  const trigger = screen.getByRole('button', { name: '댓글' });
  fireEvent.click(trigger);
  await within(panel()).findByText(/이 대시보드에서는 댓글을 사용할 수 없습니다/);
  expect(within(panel()).queryByRole('button', { name: '새 댓글' })).toBeNull();
  expect(screen.queryByRole('button', { name: /에 댓글$/ })).toBeNull();
  fireEvent.click(within(panel()).getByRole('button', { name: '댓글 닫기' }));
  expect(screen.queryByRole('button', { name: '댓글' })).toBeNull();
  expect(screen.queryByRole('complementary', { name: '댓글' })).toBeNull();
});

it('returns focus to the trigger when the panel closes', async () => {
  await openPanel(list([]));
  await within(panel()).findByText('아직 댓글이 없습니다.');
  fireEvent.click(within(panel()).getByRole('button', { name: '댓글 닫기' }));
  expect(document.activeElement).toBe(screen.getByRole('button', { name: '댓글' }));
});

it('moves focus into the side panel when opened from the header so Escape closes it', async () => {
  await openPanel(list([]));
  await within(panel()).findByText('아직 댓글이 없습니다.');
  expect(panel().contains(document.activeElement)).toBe(true);
  fireEvent.keyDown(document.activeElement as Element, { key: 'Escape' });
  expect(screen.queryByRole('complementary', { name: '댓글' })).toBeNull();
  expect(document.activeElement).toBe(screen.getByRole('button', { name: '댓글' }));
});

it('reloads the list after a revision conflict and resends against the new revision', async () => {
  api.get.mockResolvedValueOnce({ data: list([]) }).mockResolvedValue({ data: list([], { revision: NEXT_REVISION }) });
  render(<Harness />);
  fireEvent.click(screen.getByRole('button', { name: '댓글' }));
  await within(panel()).findByText('아직 댓글이 없습니다.');
  api.post
    .mockRejectedValueOnce(
      rejected(409, {
        success: false,
        code: 409,
        data: {
          statusCode: 409,
          message: '대시보드가 변경됐습니다. 최신 내용을 다시 불러와 주세요.',
          code: 'REVISION_CONFLICT',
        },
      }),
    )
    .mockResolvedValueOnce(receipt('dashboard.thread.create', thread(1)));
  fireEvent.click(within(panel()).getByRole('button', { name: '새 댓글' }));
  await write('새 댓글', '다시 보낼 의견', '댓글 남기기');
  await within(panel()).findByText(/대시보드가 바뀌어 댓글 목록을 새로 불러왔습니다/);
  await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
  await act(async () => {
    await api.get.mock.results[1].value;
  });
  expect((within(panel()).getByLabelText('새 댓글') as HTMLTextAreaElement).value).toBe('다시 보낼 의견');
  fireEvent.click(within(panel()).getByRole('button', { name: '댓글 남기기' }));
  await waitFor(() => expect(threadItem('대시보드 전체')).toBeTruthy());
  expect(api.post.mock.calls.map(call => call[1].revision)).toEqual([REVISION, NEXT_REVISION]);
});
