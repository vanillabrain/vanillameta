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
import { removeToken, setToken } from './authHelper';
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
  setToken('secret-a');
  const a = await editorDraftKey('secret-a', 8),
    c = await editorDraftKey('secret-a', 9);
  setToken('secret-b');
  const b = await editorDraftKey('secret-b', 8);
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

const snapshotTab = () => Object.fromEntries(Object.entries(sessionStorage));
const restoreTab = (snapshot: Record<string, string>) => {
  sessionStorage.clear();
  Object.entries(snapshot).forEach(([key, value]) => sessionStorage.setItem(key, value));
};
it('UC028 discovers two authenticated renewals from another tab after missing storage events', async () => {
  const { setToken } = await import('./authHelper');
  setToken('cross-tab-old-secret');
  const key = await editorDraftKey('cross-tab-old-secret', 8);
  writeEditorDraft(key, fixture());
  const firstTab = snapshotTab();
  restoreTab({});
  await retainEditorDraftSession('cross-tab-old-secret', 'cross-tab-next-secret');
  setToken('cross-tab-next-secret', true);
  await retainEditorDraftSession('cross-tab-next-secret', 'cross-tab-final-secret');
  setToken('cross-tab-final-secret', true);
  expect(sessionStorage.getItem(key)).toBeNull();
  const shared = localStorage.getItem('vm:editor-draft-auth:v1');
  expect(shared).not.toMatch(/cross-tab|unsaved|retry|SELECT/);
  restoreTab(firstTab);
  expect(await editorDraftKey('cross-tab-final-secret', 8)).toBe(key);
  expect(readEditorDraft(key, 8).draft?.prompt).toBe('retry');
});
it.each(['login', 'logout'])('UC028 retires other-tab namespaces on %s even with an identical token', async action => {
  const { setToken } = await import('./authHelper');
  setToken('same-token');
  const key = await editorDraftKey('same-token', 8);
  writeEditorDraft(key, fixture());
  const firstTab = snapshotTab();
  restoreTab({});
  if (action === 'logout') removeToken();
  setToken('same-token');
  restoreTab(firstTab);
  const replacement = await editorDraftKey('same-token', 8);
  expect(replacement).not.toBe(key);
  expect(readEditorDraft(replacement, 8).draft).toBeNull();
  expect(sessionStorage.getItem(key)).not.toBeNull();
});
it('UC028 rejects a draft key calculation when a new login occurs during hashing', async () => {
  const { setToken } = await import('./authHelper');
  setToken('before-hash');
  const original = crypto.subtle.digest.bind(crypto.subtle);
  vi.spyOn(crypto.subtle, 'digest').mockImplementationOnce(async (...args) => {
    setToken('replacement-login');
    return original(...args);
  });
  await expect(editorDraftKey('before-hash', 8)).rejects.toThrow('Draft session changed');
  expect(await editorDraftKey('replacement-login', 8)).toBeTruthy();
});
it('UC028 does not inherit malformed shared metadata or fail authentication on storage errors', async () => {
  localStorage.setItem('vm:editor-draft-auth:v1', '{');
  await expect(editorDraftKey('old', 8)).rejects.toThrow();
  await expect(retainEditorDraftSession('old', 'new')).resolves.toBeUndefined();
  localStorage.setItem('unrelated', 'keep');
  clearEditorDrafts();
  expect(localStorage.getItem('unrelated')).toBe('keep');
  expect(await editorDraftKey('new', 8)).toBeTruthy();
});

it('UC028 never overwrites a published renewal alias with an old-token key calculation', async () => {
  setToken('before-publish');
  const key = await editorDraftKey('before-publish', 8);
  writeEditorDraft(key, fixture());
  await retainEditorDraftSession('before-publish', 'after-publish');
  const published = localStorage.getItem('vm:editor-draft-auth:v1');
  await expect(editorDraftKey('before-publish', 8)).rejects.toThrow('Draft session token changed');
  expect(localStorage.getItem('vm:editor-draft-auth:v1')).toBe(published);
  setToken('after-publish', true);
  expect(await editorDraftKey('after-publish', 8)).toBe(key);
});

it('UC028 carries a legacy tab alias into the first shared authenticated binding', async () => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('legacy-token'));
  const hash = Array.from(new Uint8Array(digest), x => x.toString(16).padStart(2, '0')).join('');
  const key = `${EDITOR_DRAFT_PREFIX}${hash}:8`;
  sessionStorage.setItem('vm:editor-draft-session:v1', JSON.stringify({ tokenHash: hash, scope: hash }));
  writeEditorDraft(key, fixture());
  expect(await editorDraftKey('legacy-token', 8)).toBe(key);
  await retainEditorDraftSession('legacy-token', 'legacy-renewed');
  expect(await editorDraftKey('legacy-renewed', 8)).toBe(key);
});
it('UC028 refuses a late renewal scoped to a previous login generation', async () => {
  setToken('identical-login');
  await editorDraftKey('identical-login', 8);
  const prior = JSON.parse(localStorage.getItem('vm:editor-draft-auth:v1')).epoch;
  setToken('identical-login');
  const replacement = localStorage.getItem('vm:editor-draft-auth:v1');
  await retainEditorDraftSession('identical-login', 'late-renewal', prior);
  expect(localStorage.getItem('vm:editor-draft-auth:v1')).toBe(replacement);
});
