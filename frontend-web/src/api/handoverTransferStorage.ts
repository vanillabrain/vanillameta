import { exactTransferKeys, TransferPrepare, validTransferPrepare } from './handoverTransferService';
import { isHandoverId } from './handoverService';
export const transferStorageKey = (session: string | null, actor: number, org: number, proposal: string) =>
  session && Number.isSafeInteger(actor) && actor > 0 && Number.isSafeInteger(org) && org > 0 && isHandoverId(proposal)
    ? `vm:handover-transfer:v1:${session}:${actor}:${org}:${proposal}`
    : null;
export type PendingTransfer = { savedAt: number; input: TransferPrepare };
const valid = (v: any, now: number): v is PendingTransfer =>
  exactTransferKeys(v, ['savedAt', 'input']) &&
  Number.isSafeInteger(v.savedAt) &&
  v.savedAt <= now &&
  now - v.savedAt < 86400000 &&
  validTransferPrepare(v.input);
export function readPendingTransfer(
  key: string | null,
  now = Date.now(),
): { pending: PendingTransfer | null; error: boolean } {
  try {
    if (!key) return { pending: null, error: true };
    const raw = sessionStorage.getItem(key);
    if (!raw) return { pending: null, error: false };
    if (new TextEncoder().encode(raw).length > 8192) return { pending: null, error: true };
    const v = JSON.parse(raw);
    return valid(v, now) ? { pending: v, error: false } : { pending: null, error: true };
  } catch {
    return { pending: null, error: true };
  }
}
export function savePendingTransfer(key: string | null, pending: PendingTransfer) {
  try {
    if (!key || !valid(pending, Date.now())) return false;
    const raw = JSON.stringify(pending);
    if (new TextEncoder().encode(raw).length > 8192) return false;
    sessionStorage.setItem(key, raw);
    return sessionStorage.getItem(key) === raw;
  } catch {
    return false;
  }
}
export function clearPendingTransfer(key: string | null) {
  try {
    if (!key) return false;
    sessionStorage.removeItem(key);
    return sessionStorage.getItem(key) === null;
  } catch {
    return false;
  }
}
