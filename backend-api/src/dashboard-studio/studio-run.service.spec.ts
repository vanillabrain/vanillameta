jest.mock('../ai/ai.service', () => ({ AiService: class {} }));
import { ConflictException } from '@nestjs/common';
import { StudioRunService } from './studio-run.service';
import { readFileSync } from 'fs';
import { resolve } from 'path';
const base = () =>
  JSON.parse(readFileSync(resolve(__dirname, '../../../fixtures/studio/document-v1.json'), 'utf8'));
describe('Studio AI scoped runs', () => {
  const previousProvider = process.env.AI_PROVIDER;
  afterAll(() => {
    if (previousProvider === undefined) delete process.env.AI_PROVIDER;
    else process.env.AI_PROVIDER = previousProvider;
  });
  let studio: any, ai: any, service: StudioRunService, document: any, body: any;
  beforeEach(() => {
    process.env.AI_PROVIDER = 'codex';
    document = base();
    document.dashboardId = 1;
    document.revision = 'a'.repeat(64);
    studio = {
      prepare: jest.fn(async (_id, b) => ({
        document: b.document,
        preview: { draft: { databaseId: document.sourceId, widgets: [] }, widgets: [] },
      })),
    };
    ai = {
      callLlm: jest.fn().mockResolvedValue(
        JSON.stringify({
          intent: 'edit',
          answer: '제목을 변경했습니다.',
          operations: [
            {
              type: 'updateBlock',
              blockId: document.blocks[0].id,
              patch: { title: 'New title' },
            },
          ],
        }),
      ),
    };
    service = new StudioRunService(studio, ai);
    body = {
      requestId: 'req1',
      dashboardId: 1,
      expectedRevision: document.revision,
      expectedSourceRevision: 'b'.repeat(64),
      document,
      clientEditVersion: 3,
      selectedBlockId: document.blocks[0].id,
      prompt: '선택 제목을 New title로 바꿔',
    };
  });
  it('returns validated selected operations without persisting and replays one request', async () => {
    const first = await service.run(body, 7);
    expect(first.proposedOperations).toHaveLength(1);
    expect(first.baseRevision).toBe(body.expectedRevision);
    expect(first.clientEditVersion).toBe(3);
    expect(await service.run(body, 7)).toEqual(first);
    expect(ai.callLlm).toHaveBeenCalledTimes(1);
    await expect(service.run({ ...body, prompt: 'different' }, 7)).rejects.toMatchObject({
      status: 409,
    });
  });
  it.each([
    { type: 'removeBlock', blockId: 'b1' },
    { type: 'updateBlock', blockId: 'other', patch: { title: 'Bad' } },
    { type: 'updateBlock', blockId: 'b1', patch: { definitionKey: 'other' } },
    { type: 'moveBlock', blockId: 'b1', breakpoint: 'lg', x: 0, y: 100 },
  ])('rejects scope or calculation/layout changes %#', async operation => {
    ai.callLlm.mockResolvedValue(
      JSON.stringify({ intent: 'edit', answer: 'Done', operations: [operation] }),
    );
    await expect(service.run(body, 7)).rejects.toThrow();
  });
  it('authorizes before invoking AI', async () => {
    studio.prepare.mockRejectedValue(new Error('Forbidden'));
    await expect(service.run(body, 7)).rejects.toThrow('Forbidden');
    expect(ai.callLlm).not.toHaveBeenCalled();
  });
  it('rejects stale versions after the model response', async () => {
    studio.prepare
      .mockImplementationOnce(async () => ({ document, preview: { widgets: [] } }))
      .mockRejectedValueOnce(new ConflictException('Changed'));
    await expect(service.run(body, 7)).rejects.toMatchObject({ status: 409 });
  });
  it('cancels before and after an awaited response', async () => {
    const c = new AbortController();
    c.abort();
    await expect(service.run(body, 7, c.signal)).rejects.toThrow();
    expect(ai.callLlm).not.toHaveBeenCalled();
  });
  it('returns question and unsupported replies without operations', async () => {
    ai.callLlm.mockResolvedValue(
      JSON.stringify({
        intent: 'unsupported',
        answer: '게시 기능은 아직 연결되지 않았습니다.',
        operations: [],
      }),
    );
    const result = await service.run(body, 7);
    expect(result.proposedOperations).toEqual([]);
  });
  it('aborts a running model and releases the failed request for retry', async () => {
    const c = new AbortController();
    ai.callLlm.mockImplementation(
      (_s, _u, _j, signal) =>
        new Promise((_resolve, reject) =>
          signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }),
        ),
    );
    const pending = service.run(body, 7, c.signal);
    await new Promise(resolve => setImmediate(resolve));
    c.abort();
    await expect(pending).rejects.toThrow('취소');
    ai.callLlm.mockResolvedValue(
      JSON.stringify({ intent: 'ask', answer: '다시 연결했습니다.', operations: [] }),
    );
    await expect(service.run({ ...body, requestId: 'retry' }, 7)).resolves.toMatchObject({
      intent: 'ask',
    });
  });
  it('times out without returning a proposal', async () => {
    jest.useFakeTimers({ doNotFake: ['performance'] });
    try {
      ai.callLlm.mockImplementation(
        (_s, _u, _j, signal) =>
          new Promise((_resolve, reject) =>
            signal.addEventListener('abort', () => reject(new Error('timeout')), { once: true }),
          ),
      );
      const pending = service.run(body, 7);
      const check = expect(pending).rejects.toThrow('시간');
      await Promise.resolve();
      await Promise.resolve();
      jest.advanceTimersByTime(175001);
      await check;
    } finally {
      jest.useRealTimers();
    }
  });
  it('never falls back to another provider when Codex is not configured', async () => {
    process.env.AI_PROVIDER = 'api';
    await expect(service.run(body, 7)).rejects.toThrow('gpt-6-luna');
    expect(ai.callLlm).not.toHaveBeenCalled();
  });
  it('preserves the T5 safe 503 contract if post-model preview fails', async () => {
    studio.prepare
      .mockImplementationOnce(async () => ({ document, preview: { widgets: [] } }))
      .mockRejectedValueOnce(new Error('private SQL backend detail'));
    await expect(service.run(body, 7)).rejects.toMatchObject({ status: 503 });
  });
});
