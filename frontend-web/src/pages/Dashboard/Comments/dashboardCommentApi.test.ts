import { beforeEach, expect, it, vi } from 'vitest';
import { commentError } from '@/components/comments/commentModel';
import { dashboardCommentApi } from './dashboardCommentApi';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('@/helpers/apiHelper', () => ({ get: api.get, post: api.post }));

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const REVISION = 'a'.repeat(64);
const user = { kind: 'user', userId: 'peer', clientName: null };
const thread = (overrides: Record<string, unknown> = {}) => ({
  id: uuid(1),
  anchor: { kind: 'block', blockId: 'block-a', title: '매출 추이', type: 'CHART_LINE' },
  location: 'exact',
  changed: false,
  status: 'open',
  statusVersion: 0,
  createdAt: '2026-11-03T00:00:00Z',
  author: user,
  mine: true,
  resolvedAt: null,
  resolvedBy: null,
  comments: [{ id: uuid(2), body: '축이 이상해요', createdAt: '2026-11-03T00:00:00Z', author: user, mine: true }],
  ...overrides,
});
const list = (threads: unknown[] = [thread()]) => ({
  revision: REVISION,
  canManage: false,
  blockAnchors: true,
  blocks: [{ blockId: 'block-a', title: '매출 추이', type: 'CHART_LINE' }],
  threads,
});

beforeEach(() => vi.resetAllMocks());

it('reads the dashboard comment list from the dashboard route', async () => {
  api.get.mockResolvedValue({ data: list([thread(), thread({ id: uuid(3), anchor: { kind: 'whole' } })]) });
  const result = await dashboardCommentApi.list('7');
  expect(api.get).toHaveBeenCalledWith('/dashboards/7/comments', undefined, expect.anything());
  expect(result.threads.map(item => item.anchor.kind)).toEqual(['block', 'whole']);
  expect(result.blocks[0].title).toBe('매출 추이');
});

it.each([
  ['a report location object', thread({ location: { status: 'exact' } })],
  ['a report image anchor', thread({ anchor: { kind: 'image', blockId: 'img1' } })],
  ['a block anchor without its snapshot', thread({ anchor: { kind: 'block', blockId: 'block-a' } })],
  ['an unknown field', thread({ suggestions: [] })],
])('rejects a list carrying %s', async (_label, bad) => {
  api.get.mockResolvedValue({ data: list([bad]) });
  await expect(dashboardCommentApi.list('7')).rejects.toThrow();
});

it('rejects a list whose revision is not a dashboard revision hash', async () => {
  api.get.mockResolvedValue({ data: { ...list(), revision: 'r1' } });
  await expect(dashboardCommentApi.list('7')).rejects.toThrow();
});

it('posts thread, reply and status writes and parses the dashboard receipt', async () => {
  const receipt = (operation: string) => ({ data: { replayed: false, operation, resultId: uuid(9), thread: thread() } });
  api.post
    .mockResolvedValueOnce(receipt('dashboard.thread.create'))
    .mockResolvedValueOnce(receipt('dashboard.comment.reply'))
    .mockResolvedValueOnce(receipt('dashboard.thread.status'));
  const created = await dashboardCommentApi.createThread('7', {
    requestId: uuid(5),
    revision: REVISION,
    anchor: { kind: 'block', blockId: 'block-a' },
    body: '확인 부탁',
  });
  await dashboardCommentApi.reply('7', uuid(1), { requestId: uuid(6), body: '답글' });
  await dashboardCommentApi.setStatus('7', uuid(1), { requestId: uuid(7), status: 'resolved', expectedStatusVersion: 0 });
  expect(created.operation).toBe('dashboard.thread.create');
  expect(api.post.mock.calls.map(([url, body]) => [url, body])).toEqual([
    [
      '/dashboards/7/comments',
      { requestId: uuid(5), revision: REVISION, anchor: { kind: 'block', blockId: 'block-a' }, body: '확인 부탁' },
    ],
    [`/dashboards/7/comments/${uuid(1)}/replies`, { requestId: uuid(6), body: '답글' }],
    [`/dashboards/7/comments/${uuid(1)}/status`, { requestId: uuid(7), status: 'resolved', expectedStatusVersion: 0 }],
  ]);
});

it('rejects a report receipt operation', async () => {
  api.post.mockResolvedValue({
    data: { replayed: false, operation: 'thread.create', resultId: uuid(9), thread: thread() },
  });
  await expect(dashboardCommentApi.reply('7', uuid(1), { requestId: uuid(6), body: '답글' })).rejects.toThrow();
});

it('words access failures for dashboards and keeps server conflict details', () => {
  const failure = (status: number, data: unknown = {}) => ({ response: { status, data } });
  expect(commentError(failure(403), '대시보드')).toBe('현재 이 대시보드의 댓글에 접근할 수 없습니다.');
  expect(
    commentError(
      failure(409, { success: false, code: 409, data: { statusCode: 409, message: '대시보드가 변경됐습니다.' } }),
      '대시보드',
    ),
  ).toBe('대시보드가 변경됐습니다.');
  expect(commentError(failure(409, { statusCode: 409, message: '한도', code: 'COMMENT_LIMIT' }), '대시보드')).toBe('한도');
});
