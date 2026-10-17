import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { EDITOR_DRAFT_LIMIT, EDITOR_DRAFT_TTL } from '@/helpers/editorDraftStorage';
import {
  StudioPendingSave,
  writeStudioPendingSave,
  readStudioPendingSave,
  removeStudioPendingSave,
  studioPendingSaveKey,
} from './studioPendingSave';
export const record = (): StudioPendingSave => ({
  version: 1,
  updatedAt: Date.now(),
  phase: 'pending',
  request: {
    requestId: 'req-1',
    expectedRevision: 'a'.repeat(64),
    expectedSourceRevision: 'b'.repeat(64),
    document: {
      schemaVersion: 1,
      dashboardId: 3,
      sourceId: 4,
      title: '초안',
      blocks: [
        {
          id: 'b1',
          definitionKey: 'b1',
          kind: 'BOARD_NUMERIC',
          title: '매출',
          description: '',
          measureRefs: [],
          dimensionRefs: [],
          display: {},
        },
      ],
      layouts: {
        lg: [{ id: 'b1', x: 0, y: 0, w: 4, h: 2 }],
        md: [{ id: 'b1', x: 0, y: 0, w: 4, h: 2 }],
        xs: [{ id: 'b1', x: 0, y: 0, w: 1, h: 2 }],
      },
    },
  },
});
beforeEach(() => sessionStorage.clear());
afterEach(() => vi.restoreAllMocks());
it('retains exact request and confirmed phase under a separate scoped suffix', () => {
  const r = record();
  expect(writeStudioPendingSave('draft', r)).toBe(true);
  expect(readStudioPendingSave('draft', 3)).toEqual(r);
  expect(readStudioPendingSave('other', 3)).toBeNull();
  expect(writeStudioPendingSave('draft', { ...r, phase: 'confirmed' })).toBe(true);
  expect(readStudioPendingSave('draft', 3)?.phase).toBe('confirmed');
  expect(readStudioPendingSave('draft', 46)).toBeNull();
});
it('rejects wrong IDs, SQL, stale timestamps, invalid revisions and extra request fields', () => {
  const r = record();
  for (const bad of [
    { ...r, updatedAt: Date.now() - EDITOR_DRAFT_TTL },
    { ...r, sql: 'no' },
    { ...r, request: { ...r.request, requestId: 123 } },
    { ...r, request: { ...r.request, expectedRevision: 'bad' } },
    { ...r, request: { ...r.request, sql: 'no' } },
    { ...r, request: { ...r.request, document: { ...r.request.document, sql: 'no' } } },
  ]) {
    sessionStorage.setItem(studioPendingSaveKey('draft') ?? '', JSON.stringify(bad));
    expect(readStudioPendingSave('draft', 3)).toBeNull();
  }
});
it('bounds pending plus draft bytes and reports storage errors without clearing unrelated records', () => {
  sessionStorage.setItem('draft', 'x'.repeat(EDITOR_DRAFT_LIMIT));
  sessionStorage.setItem('question', 'keep');
  expect(writeStudioPendingSave('draft', record())).toBe(false);
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw Error('quota');
  });
  expect(writeStudioPendingSave('free', record())).toBe(false);
  expect(sessionStorage.getItem('question')).toBe('keep');
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
    throw Error('blocked');
  });
  expect(removeStudioPendingSave('draft')).toBe(false);
});

it('reserves enough bytes for the confirmed phase before sending', () => {
  const r = record(),
    size = new TextEncoder().encode(JSON.stringify({ ...r, phase: 'confirmed' })).length;
  sessionStorage.setItem('draft', 'x'.repeat(EDITOR_DRAFT_LIMIT - size));
  expect(writeStudioPendingSave('draft', r)).toBe(true);
  expect(writeStudioPendingSave('draft', { ...r, phase: 'confirmed' })).toBe(true);
  sessionStorage.setItem('draft', 'x'.repeat(EDITOR_DRAFT_LIMIT - size + 1));
  expect(writeStudioPendingSave('draft', r)).toBe(false);
});
