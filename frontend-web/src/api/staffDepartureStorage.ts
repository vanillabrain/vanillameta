import { isHandoverId } from './handoverService';
import {
  DepartureCompleteInput,
  DepartureRequestInput,
  exactDepartureKeys,
  validDepartureComplete,
  validDepartureRequest,
} from './staffDepartureService';
export type PendingStaffDeparture = {
  savedAt: number;
  actorId: number;
  organizationId: number;
  requestId: string;
} & (
  | { operation: 'request'; input: DepartureRequestInput }
  | { operation: 'complete'; targetId: number; input: DepartureCompleteInput }
);
const positive = (v: unknown): v is number => Number.isSafeInteger(v) && Number(v) > 0;
const prefix = (session: string | null, actor: number) =>
  session && positive(actor) ? `vm:staff-departure:v1:${session}:${actor}:` : null;
export const staffDepartureStorageKey = (session: string | null, p: PendingStaffDeparture) => {
  const base = prefix(session, p.actorId);
  return base && positive(p.organizationId) && isHandoverId(p.requestId)
    ? `${base}${p.organizationId}:${p.requestId}`
    : null;
};
const valid = (v: any, now: number): v is PendingStaffDeparture =>
  !!v &&
  exactDepartureKeys(
    v,
    v.operation === 'request'
      ? ['savedAt', 'actorId', 'organizationId', 'requestId', 'operation', 'input']
      : ['savedAt', 'actorId', 'organizationId', 'requestId', 'operation', 'targetId', 'input'],
  ) &&
  Number.isSafeInteger(v.savedAt) &&
  v.savedAt >= 0 &&
  v.savedAt <= now &&
  now - v.savedAt < 86400000 &&
  positive(v.actorId) &&
  positive(v.organizationId) &&
  isHandoverId(v.requestId) &&
  (v.operation === 'request'
    ? validDepartureRequest(v.input) && v.input.requestId === v.requestId
    : v.operation === 'complete' && positive(v.targetId) && v.targetId !== v.actorId && validDepartureComplete(v.input));
/** Discover only this authenticated cache fence's tickets. Never silently choose between unresolved writes. */
export function readPendingStaffDeparture(
  session: string | null,
  actor: number,
  now = Date.now(),
): { pending: PendingStaffDeparture | null; error: boolean } {
  try {
    const base = prefix(session, actor);
    if (!base) return { pending: null, error: false };
    if (sessionStorage.length > 1000) return { pending: null, error: true };
    let pending: PendingStaffDeparture | null = null;
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const key = sessionStorage.key(i);
      if (!key?.startsWith(base)) continue;
      const raw = sessionStorage.getItem(key);
      if (!raw || new TextEncoder().encode(raw).length > 8192) return { pending: null, error: true };
      const value = JSON.parse(raw);
      if (!valid(value, now) || staffDepartureStorageKey(session, value) !== key || value.actorId !== actor || pending)
        return { pending: null, error: true };
      pending = value;
    }
    return { pending, error: false };
  } catch {
    return { pending: null, error: true };
  }
}
export function savePendingStaffDeparture(session: string | null, p: PendingStaffDeparture) {
  try {
    const key = staffDepartureStorageKey(session, p);
    if (!key || !valid(p, Date.now())) return false;
    const raw = JSON.stringify(p);
    if (new TextEncoder().encode(raw).length > 8192) return false;
    sessionStorage.setItem(key, raw);
    return sessionStorage.getItem(key) === raw;
  } catch {
    return false;
  }
}
export function clearPendingStaffDeparture(session: string | null, p: PendingStaffDeparture) {
  try {
    const key = staffDepartureStorageKey(session, p);
    if (!key) return false;
    sessionStorage.removeItem(key);
    return sessionStorage.getItem(key) === null;
  } catch {
    return false;
  }
}
