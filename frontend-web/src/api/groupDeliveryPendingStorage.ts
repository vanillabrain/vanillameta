import { GroupDeliveryInput, validGroupDeliveryInput } from './groupDeliveryService';
export type GroupDeliveryPendingScope = {
  selfId: number;
  organizationId: number;
  dashboardId: number;
  session: string | null;
};
export type GroupDeliveryPending = {
  savedAt: number;
  selfId: number;
  organizationId: number;
  dashboardId: number;
  input: GroupDeliveryInput;
};
const positive = (v: unknown): v is number => Number.isSafeInteger(v) && Number(v) > 0;
export function groupDeliveryPendingStorageKey(scope: GroupDeliveryPendingScope) {
  return scope.session && positive(scope.selfId) && positive(scope.organizationId) && positive(scope.dashboardId)
    ? `vm:group-delivery-pending:v1:${JSON.stringify([
        scope.session,
        scope.selfId,
        scope.organizationId,
        scope.dashboardId,
      ])}`
    : null;
}
const valid = (v: any, scope: GroupDeliveryPendingScope, now: number): v is GroupDeliveryPending =>
  !!v &&
  typeof v === 'object' &&
  !Array.isArray(v) &&
  Object.keys(v).length === 5 &&
  ['savedAt', 'selfId', 'organizationId', 'dashboardId', 'input'].every(k => Object.prototype.hasOwnProperty.call(v, k)) &&
  Number.isSafeInteger(v.savedAt) &&
  v.savedAt >= 0 &&
  v.savedAt <= now &&
  now - v.savedAt < 86400000 &&
  v.selfId === scope.selfId &&
  v.organizationId === scope.organizationId &&
  v.dashboardId === scope.dashboardId &&
  validGroupDeliveryInput(v.input);
export function readGroupDeliveryPending(
  scope: GroupDeliveryPendingScope,
  now = Date.now(),
): { pending: GroupDeliveryPending | null; error: boolean } {
  try {
    const key = groupDeliveryPendingStorageKey(scope);
    if (!key) return { pending: null, error: true };
    const raw = sessionStorage.getItem(key);
    if (raw === null) return { pending: null, error: false };
    if (new TextEncoder().encode(raw).length > 8192) return { pending: null, error: true };
    const v = JSON.parse(raw);
    return valid(v, scope, now) ? { pending: v, error: false } : { pending: null, error: true };
  } catch {
    return { pending: null, error: true };
  }
}
export function saveGroupDeliveryPending(scope: GroupDeliveryPendingScope, pending: GroupDeliveryPending) {
  try {
    const key = groupDeliveryPendingStorageKey(scope);
    if (!key || !valid(pending, scope, Date.now())) return false;
    const raw = JSON.stringify(pending);
    if (new TextEncoder().encode(raw).length > 8192) return false;
    sessionStorage.setItem(key, raw);
    const restored = readGroupDeliveryPending(scope);
    return !restored.error && JSON.stringify(restored.pending) === raw;
  } catch {
    return false;
  }
}
export function clearGroupDeliveryPending(scope: GroupDeliveryPendingScope) {
  try {
    const key = groupDeliveryPendingStorageKey(scope);
    if (!key) return false;
    sessionStorage.removeItem(key);
    return sessionStorage.getItem(key) === null;
  } catch {
    return false;
  }
}
