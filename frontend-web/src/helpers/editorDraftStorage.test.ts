import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import {
  BrowserDraft,
  editorDraftKey,
  readEditorDraft,
  writeEditorDraft,
  removeEditorDraft,
  clearEditorDrafts,
  retainEditorDraftSession,
  EDITOR_DRAFT_PREFIX,
  EDITOR_DRAFT_TTL,
  EDITOR_DRAFT_LIMIT,
} from './editorDraftStorage';
import { removeToken } from './authHelper';
const item = {
  key: 'one',
  kind: 'existing',
  title: 'KPI',
  chart: 'number',
  unit: '',
  decimalPlaces: 0,
  numberNotation: 'plain',
  width: 6,
  height: 3,
};
const fixture = (): BrowserDraft<typeof item> => ({
  version: 1,
  updatedAt: Date.now(),
  dashboardId: 8,
  sourceId: 1,
  baseRevision: 'a'.repeat(64),
  base: { title: 'base', items: [item] },
  draft: { title: 'unsaved', items: [item] },
  prompt: 'retry',
  selectedKey: 'one',
  aiEditMode: 'auto',
  layoutMode: 'mobile',
  conflict: false,
  unknownSave: false,
  saveAttempt: null,
});
beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  vi.stubGlobal('crypto', webcrypto);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it('scopes by session and dashboard without persisting the raw token', async () => {
  const a = await editorDraftKey('secret-a', 8),
    b = await editorDraftKey('secret-b', 8),
    c = await editorDraftKey('secret-a', 9);
  expect(a).not.toBe(b);
  expect(a).not.toBe(c);
  expect(a).not.toContain('secret');
  expect(await editorDraftKey(null, 8)).toBeNull();
  if (!a || !b) throw new Error('missing scope');
  const f = fixture();
  expect(writeEditorDraft(a, f)).toBe(true);
  expect(readEditorDraft(a, 8).draft).toEqual(f);
  expect(readEditorDraft(b, 8).draft).toBeNull();
  expect(readEditorDraft(a, 9).draft).toBeNull();
});
it.each(['malformed', 'expired', 'oversize', 'version', 'items', 'revision', 'revision-type', 'future'])(
  'ignores %s data and removes only its key',
  kind => {
    const f: any = fixture();
    if (kind === 'expired') f.updatedAt -= EDITOR_DRAFT_TTL;
    if (kind === 'future') f.updatedAt += 120000;
    if (kind === 'version') f.version = 2;
    if (kind === 'items') f.draft.items = [{ ...item, kind: 'execute' }];
    if (kind === 'revision') f.baseRevision = 'bad';
    if (kind === 'revision-type') f.baseRevision = ['a'.repeat(64)];
    const raw = kind === 'malformed' ? '{' : kind === 'oversize' ? 'x'.repeat(EDITOR_DRAFT_LIMIT + 1) : JSON.stringify(f);
    sessionStorage.setItem('test-key', raw);
    sessionStorage.setItem('unrelated', 'keep');
    expect(readEditorDraft('test-key', 8).draft).toBeNull();
    expect(sessionStorage.getItem('test-key')).toBeNull();
    expect(sessionStorage.getItem('unrelated')).toBe('keep');
  },
);
it('reports blocked reads/quota and removes only feature keys on logout', () => {
  const f = fixture();
  vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
    throw new DOMException('quota');
  });
  expect(writeEditorDraft('k', f)).toBe(false);
  expect(writeEditorDraft('k', { ...f, prompt: 'x'.repeat(EDITOR_DRAFT_LIMIT) })).toBe(false);
  vi.spyOn(Storage.prototype, 'getItem').mockImplementationOnce(() => {
    throw new Error('disabled');
  });
  expect(readEditorDraft('k', 8).problem).toBeTruthy();
  sessionStorage.setItem(EDITOR_DRAFT_PREFIX + 'own', 'x');
  sessionStorage.setItem('user-data', 'keep');
  localStorage.setItem('accessToken', '"token"');
  removeToken();
  expect(sessionStorage.getItem(EDITOR_DRAFT_PREFIX + 'own')).toBeNull();
  expect(sessionStorage.getItem('user-data')).toBe('keep');
  expect(localStorage.getItem('accessToken')).toBeNull();
  clearEditorDrafts();
  expect(removeEditorDraft(null)).toBe(true);
});

it('keeps the draft namespace on authenticated token renewal but clears it on a new login', async () => {
  const old = await editorDraftKey('old-session', 8);
  if (!old) throw new Error('scope');
  writeEditorDraft(old, fixture());
  await retainEditorDraftSession('old-session', 'renewed-session');
  expect(await editorDraftKey('renewed-session', 8)).toBe(old);
  expect(readEditorDraft(old, 8).draft).not.toBeNull();
  const { setToken } = await import('./authHelper');
  setToken('new-login');
  expect(sessionStorage.getItem(old)).toBeNull();
  expect(await editorDraftKey('new-login', 8)).not.toBe(old);
});
