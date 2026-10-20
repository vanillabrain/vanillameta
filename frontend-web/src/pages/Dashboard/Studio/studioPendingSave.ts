import { EDITOR_DRAFT_LIMIT, EDITOR_DRAFT_TTL } from '@/helpers/editorDraftStorage';
import { studioSaveBody, StudioSaveRequest } from './studioApi';
export type StudioPendingSave = {
  version: 1;
  updatedAt: number;
  phase: 'pending' | 'confirmed';
  request: StudioSaveRequest;
};
export const studioPendingSaveKey = (documentKey: string | null) => (documentKey ? documentKey + ':pending-save' : null);
function valid(value: any, id: number, now: number): value is StudioPendingSave {
  try {
    if (
      !value ||
      typeof value !== 'object' ||
      Array.isArray(value) ||
      Object.keys(value).length !== 4 ||
      value.version !== 1 ||
      !['pending', 'confirmed'].includes(value.phase) ||
      !Number.isFinite(value.updatedAt) ||
      value.updatedAt > now + 60000 ||
      now - value.updatedAt >= EDITOR_DRAFT_TTL
    )
      return false;
    const r = value.request;
    if (
      !r ||
      typeof r !== 'object' ||
      ['requestId', 'expectedRevision', 'expectedSourceRevision'].some(k => typeof r[k] !== 'string') ||
      Object.keys(r).length !== 4 ||
      Object.keys(r).some(k => !['requestId', 'expectedRevision', 'expectedSourceRevision', 'document'].includes(k)) ||
      !/^[-a-zA-Z0-9_]{1,128}$/.test(r.requestId) ||
      !/^[a-f0-9]{64}$/.test(r.expectedRevision) ||
      !/^[a-f0-9]{64}$/.test(r.expectedSourceRevision)
    )
      return false;
    const body = studioSaveBody(r);
    return (
      body.document.dashboardId === id &&
      body.document.blocks.length > 0 &&
      (!body.document.revision || body.document.revision === r.expectedRevision)
    );
  } catch {
    return false;
  }
}
export function removeStudioPendingSave(documentKey: string | null): boolean {
  const key = studioPendingSaveKey(documentKey);
  if (!key) return false;
  try {
    sessionStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
export function readStudioPendingSave(documentKey: string | null, id: number, now = Date.now()): StudioPendingSave | null {
  const key = studioPendingSaveKey(documentKey);
  if (!key) return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (raw === null) return null;
    const value = new TextEncoder().encode(raw).length <= EDITOR_DRAFT_LIMIT ? JSON.parse(raw) : null;
    if (valid(value, id, now)) return value;
  } catch {
    /* Untrusted storage is never an executable request. */
  }
  removeStudioPendingSave(documentKey);
  return null;
}
export function writeStudioPendingSave(documentKey: string | null, value: StudioPendingSave): boolean {
  const key = studioPendingSaveKey(documentKey);
  if (!key) return false;
  try {
    const raw = JSON.stringify(value),
      draft = sessionStorage.getItem(documentKey) || '';
    if (
      !valid(value, value.request.document.dashboardId, Date.now()) ||
      new TextEncoder().encode(JSON.stringify({ ...value, phase: 'confirmed' }) + draft).length > EDITOR_DRAFT_LIMIT
    )
      return false;
    sessionStorage.setItem(key, raw);
    return true;
  } catch {
    return false;
  }
}
