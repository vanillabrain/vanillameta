import { EDITOR_DRAFT_TTL } from '@/helpers/editorDraftStorage';
import { removeStudioQuestion } from './studioQuestionDraft';
export type CreationQuestion = { sourceId: number | null; prompt: string };
type Record = CreationQuestion & { version: 1; updatedAt: number };
/** UC048: separate from the save request, within the existing login scope. */
export const creationQuestionKey = (confirmationKey: string | null) =>
  confirmationKey ? confirmationKey + ':question' : null;
const valid = (v: any, now: number): v is Record =>
  !!v &&
  typeof v === 'object' &&
  !Array.isArray(v) &&
  Object.keys(v).length === 4 &&
  v.version === 1 &&
  Number.isFinite(v.updatedAt) &&
  v.updatedAt <= now + 60000 &&
  now - v.updatedAt < EDITOR_DRAFT_TTL &&
  (v.sourceId === null || (Number.isSafeInteger(v.sourceId) && v.sourceId > 0)) &&
  typeof v.prompt === 'string' &&
  !!v.prompt.trim() &&
  v.prompt.length <= 2000;
export function readCreationQuestion(key: string | null, now = Date.now()): CreationQuestion | null {
  if (!key) return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (raw === null) return null;
    const value = new TextEncoder().encode(raw).length <= 8192 ? JSON.parse(raw) : null;
    if (valid(value, now)) return { sourceId: value.sourceId, prompt: value.prompt };
  } catch {
    /* Invalid/unavailable storage does not block creation. */
  }
  removeStudioQuestion(key);
  return null;
}
export function writeCreationQuestion(key: string | null, value: CreationQuestion, now = Date.now()): boolean {
  if (!value.prompt.trim()) return removeStudioQuestion(key);
  const record: Record = { version: 1, updatedAt: now, sourceId: value.sourceId, prompt: value.prompt };
  const raw = JSON.stringify(record);
  if (!key || !valid(record, now) || new TextEncoder().encode(raw).length > 8192) return false;
  try {
    sessionStorage.setItem(key, raw);
    return true;
  } catch {
    return false;
  }
}
export const removeCreationQuestion = removeStudioQuestion;
