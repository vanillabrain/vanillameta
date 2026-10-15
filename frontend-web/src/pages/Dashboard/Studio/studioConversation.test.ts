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
