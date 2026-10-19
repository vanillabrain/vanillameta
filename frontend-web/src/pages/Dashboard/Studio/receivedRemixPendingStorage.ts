import type { RemixSaveInput } from './studioRemixApi';
export type ReceivedRemixScope = { actorId: number; organizationId: number; originId: number; session: string | null };
export type ReceivedRemixPending = {
  savedAt: number;
  actorId: number;
  organizationId: number;
  originId: number;
  reference: string;
  input: RemixSaveInput;
};
const positive = (v: unknown): v is number => Number.isSafeInteger(v) && Number(v) > 0;
const exact = (v: any, keys: string[]) =>
  !!v &&
  typeof v === 'object' &&
  !Array.isArray(v) &&
  Object.keys(v).length === keys.length &&
  keys.every(k => Object.prototype.hasOwnProperty.call(v, k));
const revision = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const safeName = (v: unknown): v is string =>
  typeof v === 'string' &&
  v.length > 0 &&
  v.length <= 256 &&
  !v.includes('\0') &&
  !['__proto__', 'constructor', 'prototype'].includes(v);
export function validReceivedReference(reference: unknown, originId?: number, organizationId?: number): reference is string {
  if (
    typeof reference !== 'string' ||
    reference.length > 512 ||
    !/^(?:d-(?:[1-9][0-9]*-){4}|g-(?:[1-9][0-9]*-){6})[a-f0-9]{64}$/.test(reference)
  )
    return false;
  const parts = reference.split('-');
  return (
    parts.slice(1, -1).every(p => positive(Number(p))) &&
    (originId === undefined || Number(parts[3]) === originId) &&
    (organizationId === undefined || Number(parts[1]) === organizationId)
  );
}
export function validReceivedRemixInput(v: any): v is RemixSaveInput {
  return (
    exact(v, [
      'requestId',
      'targetSourceId',
      'mapping',
      'excludedBlockIds',
      'expectedVersion',
      'expectedLifecycleRevision',
      'expectedSourceRevision',
    ]) &&
    typeof v.requestId === 'string' &&
    /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v.requestId) &&
    positive(v.targetSourceId) &&
    positive(v.expectedVersion) &&
    revision(v.expectedLifecycleRevision) &&
    revision(v.expectedSourceRevision) &&
    !!v.mapping &&
    typeof v.mapping === 'object' &&
    !Array.isArray(v.mapping) &&
    Object.keys(v.mapping).length <= 128 &&
    Object.entries(v.mapping).every(
      ([k, value]) => safeName(k) && typeof value === 'string' && value.length <= 256 && !value.includes('\0'),
    ) &&
    Array.isArray(v.excludedBlockIds) &&
    v.excludedBlockIds.length <= 6 &&
    new Set(v.excludedBlockIds).size === v.excludedBlockIds.length &&
    v.excludedBlockIds.every(
      (id: unknown) => typeof id === 'string' && id.length > 0 && id.length <= 128 && !id.includes('\0'),
    )
  );
}
export function receivedRemixStorageKey(scope: ReceivedRemixScope) {
  return scope.session && positive(scope.actorId) && positive(scope.organizationId) && positive(scope.originId)
    ? `vm:received-remix-pending:v1:${JSON.stringify([scope.session, scope.actorId, scope.organizationId, scope.originId])}`
    : null;
}
const valid = (v: any, scope: ReceivedRemixScope, now: number): v is ReceivedRemixPending =>
  exact(v, ['savedAt', 'actorId', 'organizationId', 'originId', 'reference', 'input']) &&
  Number.isSafeInteger(v.savedAt) &&
  v.savedAt >= 0 &&
  v.savedAt <= now &&
  now - v.savedAt < 86400000 &&
  v.actorId === scope.actorId &&
  v.organizationId === scope.organizationId &&
  v.originId === scope.originId &&
  validReceivedReference(v.reference, scope.originId, scope.organizationId) &&
  validReceivedRemixInput(v.input);
export function readReceivedRemixPending(
  scope: ReceivedRemixScope,
  now = Date.now(),
): { pending: ReceivedRemixPending | null; error: boolean } {
  try {
    const key = receivedRemixStorageKey(scope);
    if (!key) return { pending: null, error: true };
    const raw = sessionStorage.getItem(key);
    if (raw === null) return { pending: null, error: false };
    if (new TextEncoder().encode(raw).length > 131072) return { pending: null, error: true };
    const v = JSON.parse(raw);
    return valid(v, scope, now) ? { pending: v, error: false } : { pending: null, error: true };
  } catch {
    return { pending: null, error: true };
  }
}
export function saveReceivedRemixPending(scope: ReceivedRemixScope, pending: ReceivedRemixPending) {
  try {
    const key = receivedRemixStorageKey(scope);
    if (!key || !valid(pending, scope, Date.now())) return false;
    const raw = JSON.stringify(pending);
    if (new TextEncoder().encode(raw).length > 131072) return false;
    sessionStorage.setItem(key, raw);
    const check = readReceivedRemixPending(scope);
    return !check.error && JSON.stringify(check.pending) === raw;
  } catch {
    return false;
  }
}
export function clearReceivedRemixPending(scope: ReceivedRemixScope) {
  try {
    const key = receivedRemixStorageKey(scope);
    if (!key) return false;
    sessionStorage.removeItem(key);
    return sessionStorage.getItem(key) === null;
  } catch {
    return false;
  }
}
