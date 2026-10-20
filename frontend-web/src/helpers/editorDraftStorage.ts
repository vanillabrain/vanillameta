/** UC-025: tab-local drafts are data, never executable requests or saved previews. */
export const EDITOR_DRAFT_PREFIX = 'vm:editor-draft:v1:';
export const EDITOR_DRAFT_TTL = 24 * 60 * 60 * 1000;
export const EDITOR_DRAFT_LIMIT = 256 * 1024;
export type BrowserDraft<T> = {
  version: 1;
  updatedAt: number;
  dashboardId: number;
  sourceId: number;
  baseRevision: string;
  base: { title: string; items: T[] };
  draft: { title: string; items: T[] };
  prompt: string;
  selectedKey: string;
  aiEditMode: 'auto' | 'content' | 'layout';
  layoutMode: 'mobile' | 'tablet' | 'desktop';
  conflict: boolean;
  unknownSave: boolean;
  saveAttempt: { title: string; items: T[] } | null;
};
const object = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown, n: number): v is string => typeof v === 'string' && v.length <= n;
const definition = (v: unknown) =>
  object(v) &&
  text(v.title, 300) &&
  text(v.description, 1000) &&
  text(v.sql, 50000) &&
  text(v.type, 100) &&
  text(v.valueField, 100);
const items = (v: unknown) =>
  Array.isArray(v) &&
  v.length >= 1 &&
  v.length <= 6 &&
  new Set(v.map(i => i?.key)).size === v.length &&
  v.every(
    i =>
      object(i) &&
      text(i.key, 100) &&
      !!i.key &&
      text(i.title, 300) &&
      text(i.unit, 12) &&
      ['existing', 'metric', 'draft'].includes(i.kind) &&
      ['number', 'bar', 'line'].includes(i.chart) &&
      ['plain', 'compact'].includes(i.numberNotation) &&
      Number.isInteger(i.decimalPlaces) &&
      i.decimalPlaces >= 0 &&
      i.decimalPlaces <= 6 &&
      [6, 12].includes(i.width) &&
      [3, 5, 7].includes(i.height) &&
      (i.kind !== 'draft' || definition(i.definition)) &&
      (i.savedDefinition === undefined || definition(i.savedDefinition)) &&
      (i.layouts === undefined ||
        (object(i.layouts) &&
          Object.entries(i.layouts).every(
            ([mode, r]) =>
              ['mobile', 'tablet', 'desktop'].includes(mode) &&
              object(r) &&
              ['x', 'y', 'w', 'h'].every(k => Number.isInteger(r[k])) &&
              r.x >= 0 &&
              r.y >= 0 &&
              r.y <= 10000 &&
              r.w >= 1 &&
              r.w <= 12 &&
              r.h >= 1 &&
              r.h <= 20,
          ))),
  );
const unit = (v: unknown) => object(v) && text(v.title, 300) && items(v.items);
function valid(v: unknown, id: number, now: number) {
  return (
    object(v) &&
    v.version === 1 &&
    Number.isFinite(v.updatedAt) &&
    v.updatedAt <= now + 60000 &&
    now - v.updatedAt < EDITOR_DRAFT_TTL &&
    v.dashboardId === id &&
    Number.isSafeInteger(v.sourceId) &&
    v.sourceId > 0 &&
    typeof v.baseRevision === 'string' &&
    /^[a-f0-9]{64}$/.test(v.baseRevision) &&
    unit(v.base) &&
    unit(v.draft) &&
    text(v.prompt, 20000) &&
    text(v.selectedKey, 100) &&
    ['auto', 'content', 'layout'].includes(v.aiEditMode) &&
    ['mobile', 'tablet', 'desktop'].includes(v.layoutMode) &&
    typeof v.conflict === 'boolean' &&
    typeof v.unknownSave === 'boolean' &&
    (v.saveAttempt === null || unit(v.saveAttempt))
  );
}
const SESSION_SCOPE = 'vm:editor-draft-session:v1';
const SHARED_SCOPE = 'vm:editor-draft-auth:v1';
type SharedSession = { epoch: string; tokenHash?: string; scope?: string; legacy?: boolean };
const hashString = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
async function tokenHash(token: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}
function sharedSession(): SharedSession {
  const raw = localStorage.getItem(SHARED_SCOPE);
  if (raw === null) {
    const fresh = { epoch: crypto.randomUUID(), legacy: true };
    localStorage.setItem(SHARED_SCOPE, JSON.stringify(fresh));
    return fresh;
  }
  const value = JSON.parse(raw);
  if (
    !object(value) ||
    typeof value.epoch !== 'string' ||
    !/^[a-f0-9-]{36}$/.test(value.epoch) ||
    (value.tokenHash !== undefined && (!hashString(value.tokenHash) || !hashString(value.scope)))
  )
    throw new Error('Invalid draft session metadata');
  return value as SharedSession;
}
/** An auth-generation fence, not proof of server authorization. Storage failure is non-fatal to auth. */
export function editorDraftSessionEpoch(): string | null {
  try {
    return sharedSession().epoch;
  } catch {
    return null;
  }
}
function legacyScope(hash: string, session: SharedSession): string | undefined {
  if (!session.legacy) return;
  try {
    const value = JSON.parse(sessionStorage.getItem(SESSION_SCOPE) ?? 'null');
    if (value?.tokenHash === hash && hashString(value.scope) && !value.epoch) return value.scope;
  } catch {
    /* malformed tab aliases are never used */
  }
}
export async function editorDraftKey(token: string | null, id: number): Promise<string | null> {
  if (!token || !Number.isSafeInteger(id) || id < 1) return null;
  const auth = localStorage.getItem('accessToken');
  const initial = sharedSession();
  const hash = await tokenHash(token);
  if (sharedSession().epoch !== initial.epoch) throw new Error('Draft session changed');
  const current = sharedSession();
  // A renewal can publish its alias just before committing the new access token in another tab.
  // Never let a stale key calculation replace that authenticated alias.
  if (current.tokenHash && current.tokenHash !== hash) throw new Error('Draft session token changed');
  const scope =
    current.tokenHash === hash
      ? current.scope
      : legacyScope(hash, current) ?? (await tokenHash(`${current.epoch}:${token}`));
  const latest = sharedSession();
  if (
    latest.epoch !== initial.epoch ||
    (latest.tokenHash && latest.tokenHash !== hash) ||
    localStorage.getItem('accessToken') !== auth
  )
    throw new Error('Draft session changed');
  localStorage.setItem(SHARED_SCOPE, JSON.stringify({ epoch: current.epoch, tokenHash: hash, scope }));
  sessionStorage.setItem(SESSION_SCOPE, JSON.stringify({ epoch: current.epoch, tokenHash: hash, scope }));
  return `${EDITOR_DRAFT_PREFIX}${scope}:${id}`;
}
/** UC-028: only the successful authenticated refresh path may publish token continuity across tabs. */
export async function retainEditorDraftSession(oldToken: string | null, newToken: string, expectedEpoch?: string | null) {
  if (!oldToken) return;
  try {
    const initial = sharedSession();
    if (expectedEpoch !== undefined && initial.epoch !== expectedEpoch) return;
    const [oldHash, nextHash] = await Promise.all([tokenHash(oldToken), tokenHash(newToken)]);
    const current = sharedSession();
    if (current.epoch !== initial.epoch || (current.tokenHash && current.tokenHash !== oldHash)) return;
    const scope =
      current.tokenHash === oldHash
        ? current.scope
        : legacyScope(oldHash, current) ?? (await tokenHash(`${current.epoch}:${oldToken}`));
    const latest = sharedSession();
    if (latest.epoch !== initial.epoch || latest.tokenHash !== current.tokenHash) return;
    localStorage.setItem(SHARED_SCOPE, JSON.stringify({ epoch: current.epoch, tokenHash: nextHash, scope }));
    sessionStorage.setItem(SESSION_SCOPE, JSON.stringify({ epoch: current.epoch, tokenHash: nextHash, scope }));
  } catch {
    /* storage failures must not prevent token renewal */
  }
}
export function readEditorDraft<T>(
  key: string,
  id: number,
  now = Date.now(),
): { draft: BrowserDraft<T> | null; problem?: string } {
  try {
    const raw = sessionStorage.getItem(key);
    if (raw === null) return { draft: null };
    if (new TextEncoder().encode(raw).length > EDITOR_DRAFT_LIMIT) throw new Error('limit');
    const value: unknown = JSON.parse(raw);
    if (!valid(value, id, now)) throw new Error('invalid');
    return { draft: value as BrowserDraft<T> };
  } catch {
    try {
      sessionStorage.removeItem(key);
    } catch {
      /* storage can be disabled */
    }
    return { draft: null, problem: '보관 초안을 읽지 못했습니다. 만료되었거나 브라우저 보관 기능을 사용할 수 없습니다.' };
  }
}
export function writeEditorDraft<T>(key: string, value: BrowserDraft<T>): boolean {
  try {
    const raw = JSON.stringify(value);
    if (new TextEncoder().encode(raw).length > EDITOR_DRAFT_LIMIT) return false;
    sessionStorage.setItem(key, raw);
    return true;
  } catch {
    return false;
  }
}
export function removeEditorDraft(key: string | null): boolean {
  try {
    if (key) sessionStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
export function clearEditorDrafts() {
  // Rotate even for identical token strings on a new login; other tabs retain only inaccessible old content.
  try {
    localStorage.removeItem(SHARED_SCOPE);
    localStorage.setItem(SHARED_SCOPE, JSON.stringify({ epoch: crypto.randomUUID() }));
  } catch {
    /* authentication must remain usable without draft metadata */
  }
  try {
    sessionStorage.removeItem(SESSION_SCOPE);
    Object.keys(sessionStorage)
      .filter(key => key.startsWith(EDITOR_DRAFT_PREFIX))
      .forEach(key => sessionStorage.removeItem(key));
  } catch {
    /* logout must still finish if storage is disabled */
  }
}
