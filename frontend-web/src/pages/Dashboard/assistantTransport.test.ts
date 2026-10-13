import { beforeEach, expect, it, vi } from 'vitest';
import { assistantTransport, AssistantMessage } from './assistantTransport';

const api = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock('@/helpers/apiHelper', () => ({ post: api.post }));

const widget = { title: 'Total', type: 'BOARD_NUMERIC', sql: 'SELECT SUM(amount) AS total FROM sales', valueField: 'total' };
const draft = { databaseId: 7, title: 'Sales', explanation: 'Verified totals', widgets: [widget] };
const preview = { draft, widgets: [{ ...widget, fields: [{ name: 'total' }], datas: [{ total: 42 }] }] };
const success = (data: unknown) => ({ data: { status: 'SUCCESS', data } });
const context = {
  dashboardId: 9,
  databaseId: 7,
  currentDraft: draft,
  filters: [{ column: 'region', values: ['EU'] }],
  dateRange: { start: '2026-01-01', end: '2026-02-01' },
  selectedWidget: 0,
};
const message = (id: string, role: AssistantMessage['role'], text: string): AssistantMessage => ({
  id,
  role,
  parts: [{ type: 'text', text }],
});
const send = (
  current = context,
  messages = [message('request', 'user', 'Revise totals')],
  mode = 'edit',
  signal = new AbortController().signal,
) =>
  assistantTransport(() => current).sendMessages({
    trigger: 'submit-message',
    chatId: 'test',
    messageId: undefined,
    messages,
    body: { mode },
    abortSignal: signal,
  });
const chunks = async (stream: ReadableStream) => {
  const reader = stream.getReader();
  const result = [];
  for (;;) {
    const item = await reader.read();
    if (item.done) return result;
    result.push(item.value);
  }
};
beforeEach(() => api.post.mockReset());

it('publishes an edit only after server preview validation and forwards current query context', async () => {
  api.post.mockResolvedValueOnce(success(draft)).mockResolvedValueOnce(success(preview));
  const signal = new AbortController().signal;
  const result = await chunks(await send(context, undefined, 'edit', signal));
  expect(api.post).toHaveBeenNthCalledWith(
    1,
    '/ai/dashboard-draft',
    { ...context, history: [], prompt: 'Revise totals' },
    { timeout: 180000, signal },
  );
  expect(api.post).toHaveBeenNthCalledWith(
    2,
    '/ai/dashboard-preview',
    { draft, dashboardId: 9, filters: context.filters, dateRange: context.dateRange, includeTrends: true },
    { timeout: 180000, signal },
  );
  expect(result[0]).toMatchObject({
    type: 'start',
    messageMetadata: { result: { mode: 'edit', preview, base: JSON.stringify(context) } },
  });
  expect(
    result
      .filter(chunk => chunk.type === 'text-delta')
      .map(chunk => chunk.delta)
      .join(''),
  ).toBe('Verified totals');
  expect(result.at(-1)).toMatchObject({ type: 'finish', finishReason: 'stop' });
  expect(api.post).toHaveBeenCalledTimes(2);
});

it.each([
  ['missing widgets', { ...preview, widgets: [] }],
  ['missing result field', { ...preview, widgets: [{ ...preview.widgets[0], fields: [{ name: 'unrelated' }] }] }],
  ['unvalidated SQL', { ...preview, widgets: [{ ...preview.widgets[0], sql: 'SELECT 0 AS total' }] }],
  ['another database', { ...preview, draft: { ...draft, databaseId: 8 } }],
])('rejects preview with %s before exposing a proposal', async (_name, invalid) => {
  api.post.mockResolvedValueOnce(success(draft)).mockResolvedValueOnce(success(invalid));
  await expect(send()).rejects.toThrow('미리보기를 검증하지 못했습니다.');
});

it('rejects an invalid draft before executing a preview query', async () => {
  api.post.mockResolvedValueOnce(success({ ...draft, widgets: [] }));
  await expect(send()).rejects.toThrow('AI 초안을 검증하지 못했습니다.');
  expect(api.post).toHaveBeenCalledTimes(1);
});

it('sends the latest context and only the last ten non-system history entries, bounded to 2000 characters', async () => {
  let current = context;
  const transport = assistantTransport(() => current);
  current = { ...context, dashboardId: 12, filters: [] };
  const history = Array.from({ length: 14 }, (_, index) =>
    message(String(index), index % 2 ? 'assistant' : 'user', `${index}:${'x'.repeat(2200)}`),
  );
  const messages = [...history, message('system', 'system', 'do not forward'), message('last', 'user', 'Current question')];
  api.post.mockResolvedValueOnce(success({ answer: 'Answer', context: { sql: widget.sql } }));
  const stream = await transport.sendMessages({
    trigger: 'submit-message',
    chatId: 'test',
    messageId: undefined,
    messages,
    body: { mode: 'ask' },
    abortSignal: new AbortController().signal,
  });
  const payload = api.post.mock.calls[0][1];
  expect(payload).toMatchObject({ ...current, prompt: 'Current question' });
  expect(payload.history).toEqual(
    history.slice(-10).map(item => ({ role: item.role, text: (item.parts[0] as { text: string }).text.slice(0, 2000) })),
  );
  expect((await chunks(stream))[0]).toMatchObject({
    messageMetadata: { result: { answer: 'Answer', mode: 'ask', context: { sql: widget.sql } } },
  });
  expect(api.post).toHaveBeenCalledTimes(1);
});

it.each([
  [
    'backend envelope',
    () => api.post.mockResolvedValueOnce({ data: { status: 'ERROR', message: 'Query rejected' } }),
    'Query rejected',
  ],
  [
    'API error list',
    () => api.post.mockRejectedValueOnce({ response: { data: { message: ['SQL failed', 'Try again'] } } }),
    'SQL failed\nTry again',
  ],
  ['empty answer', () => api.post.mockResolvedValueOnce(success({ answer: '   ' })), 'AI 답변이 비어 있습니다.'],
])('surfaces %s errors', async (_name, setup, error) => {
  setup();
  await expect(send(context, undefined, 'ask')).rejects.toThrow(error);
});

it('does not publish a late answer after abort, even when the API ignores the signal', async () => {
  let resolve!: (value: unknown) => void;
  api.post.mockImplementationOnce(
    () =>
      new Promise(done => {
        resolve = done;
      }),
  );
  const controller = new AbortController();
  const pending = send(context, undefined, 'ask', controller.signal);
  const rejected = expect(pending).rejects.toThrow('요청이 중단되었습니다.');
  controller.abort();
  resolve(success({ answer: 'Late answer' }));
  await rejected;
  expect(api.post.mock.calls[0][2].signal.aborted).toBe(true);
});

it('time bucket forwards exact UTC timestamp precision to proposal and preview and fingerprints the entire range', async () => {
  const dateRange = {
    column: 'created_at',
    start: '2026-01-11T10:00:00Z',
    end: '2026-01-11T11:00:00Z',
    precision: 'timestamp',
  };
  const current = { ...context, dateRange, trendGrain: 'day', comparePrevious: true };
  api.post.mockResolvedValueOnce(success(draft)).mockResolvedValueOnce(success(preview));
  const result = await chunks(await send(current));
  expect(api.post.mock.calls[0][1]).toMatchObject({ dateRange, trendGrain: 'day', comparePrevious: true });
  expect(api.post.mock.calls[1][1]).toEqual({
    draft,
    dashboardId: context.dashboardId,
    filters: context.filters,
    dateRange,
    trendGrain: 'day',
    comparePrevious: true,
    includeTrends: true,
  });
  expect(result[0].messageMetadata.result.base).toBe(JSON.stringify(current));
  expect(api.post).toHaveBeenCalledTimes(2);
});
