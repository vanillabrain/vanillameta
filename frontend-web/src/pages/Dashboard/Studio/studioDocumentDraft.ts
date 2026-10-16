import { editorDraftKey, EDITOR_DRAFT_TTL, EDITOR_DRAFT_LIMIT } from '@/helpers/editorDraftStorage';
import { getToken } from '@/helpers/authHelper';
import { validateStudioDocument } from './studioDocument';
import { StudioDocumentV1 } from './studioTypes';
export type StudioDocumentDraft = {
  version: 1;
  updatedAt: number;
  baseRevision: string;
  sourceRevision: string;
  document: StudioDocumentV1;
};
const hash = (v: unknown) => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
function valid(v: any, id: number, now: number): v is StudioDocumentDraft {
  try {
    if (
      !v ||
      typeof v !== 'object' ||
      Array.isArray(v) ||
      Object.keys(v).length !== 5 ||
      v.version !== 1 ||
      !Number.isFinite(v.updatedAt) ||
      v.updatedAt > now + 60000 ||
      now - v.updatedAt >= EDITOR_DRAFT_TTL ||
      !hash(v.baseRevision) ||
      !hash(v.sourceRevision)
    )
      return false;
    const d = validateStudioDocument(v.document);
    return d.dashboardId === id && (d.revision === undefined || d.revision === v.baseRevision);
  } catch {
    return false;
  }
}
export async function studioDocumentDraftKey(id: number) {
  const key = await editorDraftKey(getToken(), id);
  return key ? key + ':studio-document' : null;
}
export function removeStudioDocumentDraft(key: string | null): boolean {
  if (!key) return false;
  try {
    sessionStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
export function readStudioDocumentDraft(key: string | null, id: number, now = Date.now()): StudioDocumentDraft | null {
  if (!key) return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (raw === null) return null;
    const v = new TextEncoder().encode(raw).length <= EDITOR_DRAFT_LIMIT ? JSON.parse(raw) : null;
    if (valid(v, id, now)) return v;
  } catch {
    /* Invalid drafts never become executable requests. */
  }
  removeStudioDocumentDraft(key);
  return null;
}
export function writeStudioDocumentDraft(key: string | null, value: StudioDocumentDraft): boolean {
  if (!key) return false;
  try {
    const raw = JSON.stringify(value);
    if (!valid(value, value.document.dashboardId, Date.now()) || new TextEncoder().encode(raw).length > EDITOR_DRAFT_LIMIT)
      return false;
    sessionStorage.setItem(key, raw);
    return true;
  } catch {
    return false;
  }
}
