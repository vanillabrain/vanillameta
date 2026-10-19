import { editorDraftKey, EDITOR_DRAFT_TTL } from '@/helpers/editorDraftStorage';
import { getToken } from '@/helpers/authHelper';
export type ReusePendingSave = {
  version: 1;
  updatedAt: number;
  originalId: number;
  sourceId: number;
  title: string;
  columnMap: Record<string, string>;
  blockIds: string[];
  unitConfirmed: boolean;
  request: { ticket: string; requestId: string };
};
export const REUSE_PENDING_LIMIT = 8192;
const object = (v: any) => !!v && typeof v === 'object' && !Array.isArray(v);
const exact = (v: any, keys: string[]) =>
  object(v) && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const positive = (v: unknown) => Number.isSafeInteger(v) && Number(v) > 0;
const uuid = (v: unknown) =>
  typeof v === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v);
function valid(v: any, id: number, now: number): v is ReusePendingSave {
  return (
    exact(v, [
      'version',
      'updatedAt',
      'originalId',
      'sourceId',
      'title',
      'columnMap',
      'blockIds',
      'unitConfirmed',
      'request',
    ]) &&
    v.version === 1 &&
    Number.isFinite(v.updatedAt) &&
    v.updatedAt <= now + 60000 &&
    now - v.updatedAt < EDITOR_DRAFT_TTL &&
    positive(id) &&
    v.originalId === id &&
    positive(v.sourceId) &&
    typeof v.title === 'string' &&
    v.title.trim().length > 0 &&
    v.title.length <= 300 &&
    typeof v.unitConfirmed === 'boolean' &&
    object(v.columnMap) &&
    Object.keys(v.columnMap).length <= 128 &&
    Object.entries(v.columnMap).every(
      ([k, value]) =>
        k.length > 0 &&
        k.length <= 512 &&
        !['__proto__', 'constructor', 'prototype'].includes(k) &&
        typeof value === 'string' &&
        value.length <= 512,
    ) &&
    Array.isArray(v.blockIds) &&
    v.blockIds.length >= 1 &&
    v.blockIds.length <= 6 &&
    new Set(v.blockIds).size === v.blockIds.length &&
    v.blockIds.every(k => typeof k === 'string' && k.length > 0 && k.length <= 128) &&
    exact(v.request, ['ticket', 'requestId']) &&
    uuid(v.request.ticket) &&
    uuid(v.request.requestId)
  );
}
export async function reusePendingSaveKey(id: number) {
  const key = await editorDraftKey(getToken(), id);
  return key ? key + ':studio-reuse-save' : null;
}
export function removeReusePendingSave(key: string | null) {
  if (!key) throw Error('복구 기록의 로그인 범위를 확인하지 못했습니다.');
  sessionStorage.removeItem(key);
  if (sessionStorage.getItem(key) !== null) throw Error('복구 기록을 정리하지 못했습니다.');
}
export function readReusePendingSave(key: string | null, id: number, now = Date.now()): ReusePendingSave | null {
  if (!key) return null;
  // Storage access failure is a gate, not evidence that no request exists.
  const raw = sessionStorage.getItem(key);
  if (raw === null) return null;
  let value: unknown;
  try {
    value = new TextEncoder().encode(raw).length <= REUSE_PENDING_LIMIT ? JSON.parse(raw) : null;
  } catch {
    value = null;
  }
  if (valid(value, id, now)) return value;
  removeReusePendingSave(key);
  return null;
}
export function writeReusePendingSave(key: string | null, value: ReusePendingSave) {
  if (!key || !valid(value, value.originalId, Date.now())) throw Error('복구 기록을 확인하지 못했습니다.');
  const raw = JSON.stringify(value);
  if (new TextEncoder().encode(raw).length > REUSE_PENDING_LIMIT) throw Error('복구 기록의 보관 한도를 초과했습니다.');
  sessionStorage.setItem(key, raw);
  if (sessionStorage.getItem(key) !== raw) throw Error('복구 기록을 보관하지 못했습니다.');
}
