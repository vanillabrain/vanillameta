import { editorDraftKey } from '@/helpers/editorDraftStorage';
import { getToken } from '@/helpers/authHelper';

export type CreationSaveRequest = { requestId: string; proposalId: string; expectedSourceRevision: string };
export type CreationConfirmation = {
  version: 1;
  updatedAt: number;
  sourceId: number;
  title: string;
  prompt: string;
  request: CreationSaveRequest;
};
export const CONFIRMATION_TTL = 24 * 60 * 60 * 1000;
const LIMIT = 8192;
const exact = (v: any, keys: string[]) =>
  !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === keys.length && keys.every(k => k in v);
function valid(v: any, now: number): v is CreationConfirmation {
  return (
    exact(v, ['version', 'updatedAt', 'sourceId', 'title', 'prompt', 'request']) &&
    v.version === 1 &&
    Number.isFinite(v.updatedAt) &&
    v.updatedAt <= now + 60000 &&
    now - v.updatedAt < CONFIRMATION_TTL &&
    Number.isSafeInteger(v.sourceId) &&
    v.sourceId > 0 &&
    typeof v.title === 'string' &&
    v.title.length <= 300 &&
    typeof v.prompt === 'string' &&
    v.prompt.length <= 2000 &&
    exact(v.request, ['requestId', 'proposalId', 'expectedSourceRevision']) &&
    typeof v.request.requestId === 'string' &&
    /^[-a-zA-Z0-9_]{1,128}$/.test(v.request.requestId) &&
    typeof v.request.proposalId === 'string' &&
    /^[-a-zA-Z0-9_]{1,128}$/.test(v.request.proposalId) &&
    typeof v.request.expectedSourceRevision === 'string' &&
    /^[a-f0-9]{64}$/.test(v.request.expectedSourceRevision)
  );
}
/** UC-032: reuse the login scope, with a suffix that cannot collide with dashboard 1's body. */
export async function creationConfirmationKey(): Promise<string | null> {
  const key = await editorDraftKey(getToken(), 1);
  return key ? key + ':studio-create-save' : null;
}
export function readCreationConfirmation(key: string | null, now = Date.now()): CreationConfirmation | null {
  if (!key) return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (raw === null) return null;
    const value = new TextEncoder().encode(raw).length <= LIMIT ? JSON.parse(raw) : null;
    if (valid(value, now)) return value;
    sessionStorage.removeItem(key);
  } catch {
    try {
      sessionStorage.removeItem(key);
    } catch {
      /* storage may be unavailable */
    }
  }
  return null;
}
export function writeCreationConfirmation(key: string | null, value: CreationConfirmation) {
  const raw = JSON.stringify(value);
  if (!key || !valid(value, Date.now()) || new TextEncoder().encode(raw).length > LIMIT)
    throw new Error('invalid confirmation');
  sessionStorage.setItem(key, raw);
}
export function removeCreationConfirmation(key: string | null) {
  if (key) sessionStorage.removeItem(key);
}
