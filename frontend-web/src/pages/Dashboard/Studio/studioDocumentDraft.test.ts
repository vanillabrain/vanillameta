import { webcrypto } from 'node:crypto';
import { setToken, removeToken } from '@/helpers/authHelper';
import { retainEditorDraftSession, EDITOR_DRAFT_TTL, EDITOR_DRAFT_LIMIT } from '@/helpers/editorDraftStorage';
import {
  studioDocumentDraftKey,
  StudioDocumentDraft,
  readStudioDocumentDraft,
  writeStudioDocumentDraft,
} from './studioDocumentDraft';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
const fixture = (): StudioDocumentDraft => ({
  version: 1,
  updatedAt: Date.now(),
  baseRevision: 'a'.repeat(64),
  sourceRevision: 'b'.repeat(64),
  document: {
    schemaVersion: 1,
    dashboardId: 46,
    revision: 'a'.repeat(64),
    sourceId: 34,
    title: 'draft',
    blocks: [],
    layouts: { lg: [], md: [], xs: [] },
  },
});
beforeEach(() => sessionStorage.clear());
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it('round trips a bounded document and rejects other dashboards or expiration', () => {
  const d = fixture();
  expect(writeStudioDocumentDraft('d', d)).toBe(true);
  expect(readStudioDocumentDraft('d', 46)).toEqual(d);
  expect(readStudioDocumentDraft('d', 45)).toBeNull();
  writeStudioDocumentDraft('d', d);
  expect(readStudioDocumentDraft('d', 46, d.updatedAt + EDITOR_DRAFT_TTL)).toBeNull();
});
it('rejects SQL/catalog payloads, invalid geometry, future timestamps and oversized records', () => {
  for (const raw of [
    '{',
    'x'.repeat(EDITOR_DRAFT_LIMIT + 1),
    JSON.stringify({ ...fixture(), sql: 'secret' }),
    JSON.stringify({ ...fixture(), updatedAt: Date.now() + 120000 }),
    JSON.stringify({
      ...fixture(),
      document: { ...fixture().document, layouts: { lg: [{ id: 'missing', x: -1, y: 0, w: 1, h: 1 }], md: [], xs: [] } },
    }),
  ]) {
    sessionStorage.setItem('d', raw);
    expect(readStudioDocumentDraft('d', 46)).toBeNull();
    expect(sessionStorage.getItem('d')).toBeNull();
  }
});
it('reports blocked storage without deleting unrelated records', () => {
  sessionStorage.setItem('unrelated', 'keep');
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw Error('quota');
  });
  expect(writeStudioDocumentDraft('d', fixture())).toBe(false);
  expect(sessionStorage.getItem('unrelated')).toBe('keep');
});

it('isolates login/dashboard scopes while retaining a normal refreshed token', async () => {
  localStorage.clear();
  vi.stubGlobal('crypto', webcrypto);
  setToken('old-document-token');
  const key = await studioDocumentDraftKey(46);
  expect(key).not.toBe(await studioDocumentDraftKey(45));
  expect(writeStudioDocumentDraft(key, fixture())).toBe(true);
  await retainEditorDraftSession('old-document-token', 'new-document-token');
  setToken('new-document-token', true);
  expect(await studioDocumentDraftKey(46)).toBe(key);
  setToken('new-login');
  expect(await studioDocumentDraftKey(46)).not.toBe(key);
  expect(readStudioDocumentDraft(key, 46)).toBeNull();
  removeToken();
});
it('stores local revisionless reducer documents but rejects a conflicting embedded revision', () => {
  const draft = fixture();
  delete draft.document.revision;
  expect(writeStudioDocumentDraft('local', draft)).toBe(true);
  expect(readStudioDocumentDraft('local', 46)).toEqual(draft);
  draft.document.revision = 'c'.repeat(64);
  expect(writeStudioDocumentDraft('local', draft)).toBe(false);
});

it('round trips v2 with baseline and rejects mismatched or missing comparison data', () => {
  const old = fixture();
  const baseline = structuredClone(old.document);
  delete baseline.revision;
  const draft: StudioDocumentDraft = { ...old, version: 2, baseline };
  expect(writeStudioDocumentDraft('v2', draft)).toBe(true);
  expect(readStudioDocumentDraft('v2', 46)).toEqual(draft);
  for (const bad of [
    undefined,
    { ...baseline, sourceId: 99 },
    { ...baseline, dashboardId: 45 },
    { ...baseline, revision: 'c'.repeat(64) },
    { ...baseline, sql: 'not allowed' },
  ]) {
    sessionStorage.setItem('v2', JSON.stringify({ ...draft, baseline: bad }));
    expect(readStudioDocumentDraft('v2', 46)).toBeNull();
  }
  sessionStorage.setItem('v1', JSON.stringify(old));
  expect(readStudioDocumentDraft('v1', 46)).toEqual(old);
});

it('UC052 persists applied conditions exactly through browser draft/recovery and rejects malformed scope', () => {
  const d = fixture();
  d.document.conditions = {
    sourceRevision: 'b'.repeat(64),
    semantics: {
      schemaVersion: 1,
      catalogVersion: 4,
      columns: [{ column: 'amount', businessType: 'number', dateFormat: '' }],
    },
    definition: { include: { kind: 'predicate', column: 'amount', operator: 'gt', values: [10] }, exclude: null },
  };
  expect(writeStudioDocumentDraft('scope', d)).toBe(true);
  expect(readStudioDocumentDraft('scope', 46)?.document.conditions).toEqual(d.document.conditions);
  sessionStorage.setItem('bad', JSON.stringify({ ...d, document: { ...d.document, conditions: { definition: null } } }));
  expect(readStudioDocumentDraft('bad', 46)).toBeNull();
});
