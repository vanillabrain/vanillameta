import { editorDraftKey, EDITOR_DRAFT_TTL } from '@/helpers/editorDraftStorage';
import { getToken } from '@/helpers/authHelper';

type Question = { version: 1; updatedAt: number; text: string };
const LIMIT = 8192;
const valid = (value: any, now: number): value is Question =>
  !!value &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  Object.keys(value).length === 3 &&
  value.version === 1 &&
  Number.isFinite(value.updatedAt) &&
  value.updatedAt <= now + 60000 &&
  now - value.updatedAt < EDITOR_DRAFT_TTL &&
  typeof value.text === 'string' &&
  !!value.text.trim() &&
  value.text.length <= 2000;

export async function studioQuestionKey(id: number): Promise<string | null> {
  const key = await editorDraftKey(getToken(), id);
  return key ? key + ':studio-question' : null;
}
export function removeStudioQuestion(key: string | null): boolean {
  if (!key) return false;
  try {
    sessionStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
export function readStudioQuestion(key: string | null, now = Date.now()): string | null {
  if (!key) return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (raw === null) return null;
    const value = new TextEncoder().encode(raw).length <= LIMIT ? JSON.parse(raw) : null;
    if (valid(value, now)) return value.text;
  } catch {
    /* Invalid/unavailable tab storage never blocks the editor. */
  }
  removeStudioQuestion(key);
  return null;
}
export function writeStudioQuestion(key: string | null, text: string, now = Date.now()): boolean {
  if (!text.trim()) return removeStudioQuestion(key);
  const value: Question = { version: 1, updatedAt: now, text };
  const raw = JSON.stringify(value);
  if (!key || !valid(value, now) || new TextEncoder().encode(raw).length > LIMIT) return false;
  try {
    sessionStorage.setItem(key, raw);
    return true;
  } catch {
    return false;
  }
}
