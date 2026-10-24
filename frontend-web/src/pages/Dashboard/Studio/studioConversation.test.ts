import { applyStudioOperation } from './studioReducer';
import { describe, it, expect, vi } from 'vitest';
import { canApplyStudioRun, validateStudioRun, studioAssistantTransport } from './studioRunTransport';
import { validateStudioDocument } from './studioDocument';
const document = validateStudioDocument({
  schemaVersion: 1,
  dashboardId: 3,
  sourceId: 4,
  title: 'Test',
  blocks: [
    {
      id: 'b1',
      kind: 'CHART_LINE',
      definitionKey: 'd1',
      title: 'Daily',
      description: '',
      measureRefs: [],
      dimensionRefs: [],
      display: {},
    },
  ],
  layouts: {
    lg: [{ id: 'b1', x: 0, y: 0, w: 12, h: 5 }],
    md: [{ id: 'b1', x: 0, y: 0, w: 8, h: 5 }],
    xs: [{ id: 'b1', x: 0, y: 0, w: 1, h: 5 }],
  },
});
const context = {
  dashboardId: 3,
  document,
  expectedRevision: 'a'.repeat(64),
  expectedSourceRevision: 'b'.repeat(64),
  clientEditVersion: 2,
  selectedBlockId: 'b1',
};
const result = () => ({
  runId: 'run-1',
  baseRevision: context.expectedRevision,
  sourceRevision: context.expectedSourceRevision,
  clientEditVersion: 2,
  selectedBlockId: 'b1',
  intent: 'edit',
  answer: '주간으로 변경',
  proposedOperations: [{ type: 'updateBlock', blockId: 'b1', patch: { display: { timeGrain: 'week' } } }],
  steps: [{ name: '검증', status: 'succeeded' }],
  preview: {
    draft: {
      databaseId: 4,
      title: 'Test',
      explanation: '',
      widgets: [
        { type: 'CHART_LINE', title: 'Daily', description: '', sql: 'SELECT 1', valueField: 'value', categoryField: 'day' },
      ],
    },
    widgets: [{ type: 'CHART_LINE', sql: 'SELECT 1', valueField: 'value', fields: [], datas: [] }],
  },
});
describe('Studio AI local apply guard', () => {
  it('accepts selected display changes and preserves layouts', () => {
    const next = validateStudioRun(result(), context);
    expect(next.proposedOperations).toHaveLength(1);
    expect(canApplyStudioRun(next, context)).toBe(true);
  });
  it('accepts canonical source-pinned condition proposals without a selected block but rejects stale pins and no-ops', () => {
    const c = { ...context, selectedBlockId: undefined };
    const conditions = {
      sourceRevision: c.expectedSourceRevision,
      definition: { include: { kind: 'predicate', column: 'amount', operator: 'gte', values: [100] }, exclude: null },
    };
    const raw: any = { ...result(), selectedBlockId: null, proposedOperations: [{ type: 'setConditions', conditions }] };
    expect(validateStudioRun(raw, c).proposedOperations[0]).toEqual({ type: 'setConditions', conditions });
    expect('conditions' in document).toBe(false);
    expect(() =>
      validateStudioRun(
        {
          ...raw,
          proposedOperations: [{ type: 'setConditions', conditions: { ...conditions, sourceRevision: 'c'.repeat(64) } }],
        },
        c,
      ),
    ).toThrow();
    expect(() => validateStudioRun(raw, { ...c, document: { ...document, conditions } as any })).toThrow();
    expect(() => validateStudioRun({ ...raw, proposedOperations: [{ type: 'setConditions' }] }, c)).toThrow();
    expect(() =>
      validateStudioRun({ ...raw, proposedOperations: [{ type: 'setConditions', conditions, sql: 'bad' }] }, c),
    ).toThrow();
  });
  it('rejects an old response even if an undo restored identical content', () => {
    const next = validateStudioRun(result(), context);
    expect(canApplyStudioRun(next, { ...context, clientEditVersion: 4 })).toBe(false);
  });
  it('blocks changed selected block, save revision or source', () => {
    const next = validateStudioRun(result(), context);
    for (const delta of [
      { selectedBlockId: 'other' },
      { expectedRevision: 'c'.repeat(64) },
      { expectedSourceRevision: 'd'.repeat(64) },
    ])
      expect(canApplyStudioRun(next, { ...context, ...delta })).toBe(false);
  });
  it('rejects response operations against other blocks and definitions', () => {
    const raw = result();
    raw.proposedOperations[0].blockId = 'other';
    expect(() => validateStudioRun(raw, context)).toThrow();
    const raw2: any = result();
    raw2.proposedOperations[0].patch = { definitionKey: 'injected' };
    expect(() => validateStudioRun(raw2, context)).toThrow();
  });
});

it('reports an invalid model operation as validation failure rather than connection failure', async () => {
  vi.stubGlobal('crypto', { randomUUID: () => 'request-invalid' });
  try {
    const api = await import('@/helpers/apiHelper');
    const spy = vi
      .spyOn(api, 'post')
      .mockResolvedValue({ data: { ...result(), proposedOperations: [{ type: 'removeBlock', blockId: 'b1' }] } } as any);
    try {
      await expect(
        studioAssistantTransport(() => context).sendMessages({
          messages: [{ role: 'user', parts: [{ type: 'text', text: 'Edit' }] }],
        } as any),
      ).rejects.toMatchObject({ kind: 'invalid' });
    } finally {
      spy.mockRestore();
    }
  } finally {
    vi.unstubAllGlobals();
  }
});

it('surfaces a durable preview failure as activity without applying or rerunning the completed model step', async () => {
  const api = await import('@/api/ndjsonClient');
  const onRequest = vi.fn(),
    onExecution = vi.fn();
  const execution = {
    runId: 'run-preview-failed',
    requestId: 'q1',
    dashboardId: 3,
    status: 'failed',
    steps: [
      { stepId: 'proposeSemantics', status: 'succeeded', retryable: false },
      { stepId: 'preview', status: 'failed', retryable: true },
    ],
  };
  const spy = vi.spyOn(api, 'postNdjson').mockResolvedValue(execution as any);
  try {
    const stream = await studioAssistantTransport(() => context, { onRequest, onExecution }).sendMessages({
      messages: [{ role: 'user', parts: [{ type: 'text', text: 'Edit' }] }],
    } as any);
    const reader = stream.getReader();
    const chunks: any[] = [];
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      chunks.push(part.value);
    }
    expect(chunks[0].messageMetadata.result.execution.status).toBe('failed');
    expect(chunks[0].messageMetadata.result.result).toBeUndefined();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toBe('/studio/executions');
    expect(onExecution).toHaveBeenCalledWith(execution);
    expect(onRequest.mock.calls[0][0].prompt).toBe('Edit');
  } finally {
    spy.mockRestore();
  }
});

const publication = {
  token: 'publication_token_12345678',
  version: 2,
  visibility: 'link',
  allowRemix: false,
  expiresAt: null,
  asOf: '2026-10-15T10:30:00.000Z',
};
const savedExecution = () => ({
  runId: 'run-published',
  requestId: 'q1',
  dashboardId: 3,
  status: 'succeeded',
  saveResult: { document: { ...document, revision: 'c'.repeat(64) }, idMap: {} },
  publicationResult: publication,
  // A save/publish receipt is independent of the old preview/result context.
  result: { answer: '<script>never apply</script>' },
  steps: [
    { stepId: 'saveDraft', status: 'succeeded', retryable: false },
    { stepId: 'publish', status: 'succeeded', retryable: false },
  ],
});
it('streams the durable saved-and-published receipt instead of hiding publication behind an old model result', async () => {
  const api = await import('@/api/ndjsonClient');
  const execution = savedExecution();
  const onExecution = vi.fn();
  const spy = vi.spyOn(api, 'postNdjson').mockResolvedValue(execution as any);
  try {
    const stream = await studioAssistantTransport(() => context, { onRequest: vi.fn(), onExecution }).sendMessages({
      messages: [{ role: 'user', parts: [{ type: 'text', text: '저장하고 링크로 공유해줘' }] }],
    } as any);
    const start: any = (await stream.getReader().read()).value;
    const payload = start.messageMetadata.result;
    expect(payload.execution.publicationResult).toEqual(publication);
    expect(payload.result).toBeUndefined();
    expect(payload.answer).toContain('저장 완료 · 게시 완료 · v2 · 링크 공유');
    expect(payload.answer).not.toContain('<script>');
    expect(onExecution).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledOnce();
  } finally {
    spy.mockRestore();
  }
});
it('does not present malformed publication metadata as a successful shared link', async () => {
  const api = await import('@/api/ndjsonClient');
  const onExecution = vi.fn();
  const spy = vi.spyOn(api, 'postNdjson').mockResolvedValue({
    ...savedExecution(),
    publicationResult: { ...publication, token: 'javascript:alert(1)' },
  } as any);
  try {
    await expect(
      studioAssistantTransport(() => context, { onRequest: vi.fn(), onExecution }).sendMessages({
        messages: [{ role: 'user', parts: [{ type: 'text', text: '저장하고 링크로 공유해줘' }] }],
      } as any),
    ).rejects.toMatchObject({ kind: 'invalid' });
    expect(onExecution).not.toHaveBeenCalled();
  } finally {
    spy.mockRestore();
  }
});

it('UC052 content followups retain scope while condition removal remains an explicit reviewable proposal', () => {
  const conditions = {
    sourceRevision: 'b'.repeat(64),
    definition: { include: { kind: 'predicate' as const, column: 'amount', operator: 'gt', values: [10] }, exclude: null },
  };
  const scoped = { ...context, document: { ...document, conditions } };
  const validated = validateStudioRun(result(), scoped);
  let edited = scoped.document;
  for (const operation of validated.proposedOperations) edited = applyStudioOperation(edited, operation) as typeof edited;
  expect(edited.conditions).toEqual(conditions);
  expect(edited.layouts).toEqual(document.layouts);
  const removed = validateStudioRun(
    { ...result(), proposedOperations: [{ type: 'setConditions', conditions: null }] },
    scoped,
  );
  expect(removed.proposedOperations).toEqual([{ type: 'setConditions', conditions: null }]);
  expect(scoped.document.conditions).toEqual(conditions);
  expect(() =>
    validateStudioRun({ ...result(), intent: 'ask', proposedOperations: removed.proposedOperations }, scoped),
  ).toThrow();
});

it('AI preserves frozen semantics, rejects silent native/version switches, and permits explicit full removal', () => {
  const semantics = {
    schemaVersion: 1 as const,
    catalogVersion: 4,
    columns: [{ column: 'amount', businessType: 'number' as const, dateFormat: '' as const }],
  };
  const before = {
    sourceRevision: context.expectedSourceRevision,
    definition: { include: { kind: 'predicate' as const, column: 'amount', operator: 'gte', values: [10] }, exclude: null },
    semantics,
  };
  const c = { ...context, selectedBlockId: undefined, document: { ...document, conditions: before } };
  const conditions = {
    ...before,
    definition: { ...before.definition, include: { ...before.definition.include, values: [20] } },
  };
  const raw = { ...result(), selectedBlockId: null, proposedOperations: [{ type: 'setConditions', conditions }] };
  expect(validateStudioRun(raw, c).proposedOperations[0]).toEqual({ type: 'setConditions', conditions });
  for (const wrong of [undefined, { ...semantics, catalogVersion: 5 }])
    expect(() =>
      validateStudioRun(
        { ...raw, proposedOperations: [{ type: 'setConditions', conditions: { ...conditions, semantics: wrong } }] },
        c,
      ),
    ).toThrow(/업무 의미/);
  expect(
    validateStudioRun({ ...raw, proposedOperations: [{ type: 'setConditions', conditions: null }] }, c).proposedOperations,
  ).toEqual([{ type: 'setConditions', conditions: null }]);
});
