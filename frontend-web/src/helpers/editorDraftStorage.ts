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
async function tokenHash(token: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}
function sessionScope(hash: string) {
  const raw = sessionStorage.getItem(SESSION_SCOPE);
  try {
    const value = JSON.parse(raw ?? 'null');
    if (value?.tokenHash === hash && /^[a-f0-9]{64}$/.test(value.scope)) return value.scope as string;
  } catch {
    /* discard malformed namespace metadata */
  }
  return hash;
}
export async function editorDraftKey(token: string | null, id: number): Promise<string | null> {
  if (!token || !Number.isSafeInteger(id) || id < 1) return null;
  const hash = await tokenHash(token);
  const scope = sessionScope(hash);
  sessionStorage.setItem(SESSION_SCOPE, JSON.stringify({ tokenHash: hash, scope }));
  return `${EDITOR_DRAFT_PREFIX}${scope}:${id}`;
}
/** Only the successful authenticated refresh path may carry the existing scope forward. */
export async function retainEditorDraftSession(oldToken: string | null, newToken: string) {
  if (!oldToken) return;
  try {
    const oldHash = await tokenHash(oldToken);
    const scope = sessionScope(oldHash);
    const nextHash = await tokenHash(newToken);
    sessionStorage.setItem(SESSION_SCOPE, JSON.stringify({ tokenHash: nextHash, scope }));
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
  try {
    sessionStorage.removeItem(SESSION_SCOPE);
    Object.keys(sessionStorage)
      .filter(key => key.startsWith(EDITOR_DRAFT_PREFIX))
      .forEach(key => sessionStorage.removeItem(key));
  } catch {
    /* logout must still finish if storage is disabled */
  }
}
