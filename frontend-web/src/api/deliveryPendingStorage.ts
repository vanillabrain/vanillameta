import { DeliveryInput, validDeliveryInput } from './deliveryService';
export type DeliveryPendingScope = { selfId: number; organizationId: number; dashboardId: number; session: string | null };
export type DeliveryPending = {
  savedAt: number;
  selfId: number;
  organizationId: number;
  dashboardId: number;
  input: DeliveryInput;
};
const positive = (v: unknown): v is number => Number.isSafeInteger(v) && Number(v) > 0;
export function deliveryPendingStorageKey(scope: DeliveryPendingScope) {
  return scope.session && positive(scope.selfId) && positive(scope.organizationId) && positive(scope.dashboardId)
    ? `vm:delivery-pending:v1:${JSON.stringify([scope.session, scope.selfId, scope.organizationId, scope.dashboardId])}`
    : null;
}
const valid = (v: any, scope: DeliveryPendingScope, now: number): v is DeliveryPending =>
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
  validDeliveryInput(v.input) &&
  v.input.recipients.every(r => r.recipientId !== scope.selfId);
export function readDeliveryPending(
  scope: DeliveryPendingScope,
  now = Date.now(),
): { pending: DeliveryPending | null; error: boolean } {
  try {
    const key = deliveryPendingStorageKey(scope);
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
export function saveDeliveryPending(scope: DeliveryPendingScope, pending: DeliveryPending) {
  try {
    const key = deliveryPendingStorageKey(scope);
    if (!key || !valid(pending, scope, Date.now())) return false;
    const raw = JSON.stringify(pending);
    if (new TextEncoder().encode(raw).length > 8192) return false;
    sessionStorage.setItem(key, raw);
    const restored = readDeliveryPending(scope);
    return !restored.error && JSON.stringify(restored.pending) === raw;
  } catch {
    return false;
  }
}
export function clearDeliveryPending(scope: DeliveryPendingScope) {
  try {
    const key = deliveryPendingStorageKey(scope);
    if (!key) return false;
    sessionStorage.removeItem(key);
    return sessionStorage.getItem(key) === null;
  } catch {
    return false;
  }
}
