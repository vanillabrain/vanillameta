import { exactBundleTransferKeys, BundleTransferPrepare, validBundleTransferPrepare } from './bundlehandoverService';
import { isHandoverId } from './handoverService';
export const bundleTransferStorageKey = (session: string | null, actor: number, org: number, proposal: string) =>
  session && Number.isSafeInteger(actor) && actor > 0 && Number.isSafeInteger(org) && org > 0 && isHandoverId(proposal)
    ? `vm:bundle-handover:v1:${session}:${actor}:${org}:${proposal}`
    : null;
export type PendingBundleTransfer = { savedAt: number; input: BundleTransferPrepare };
const valid = (v: any, now: number): v is PendingBundleTransfer =>
  exactBundleTransferKeys(v, ['savedAt', 'input']) &&
  Number.isSafeInteger(v.savedAt) &&
  v.savedAt <= now &&
  now - v.savedAt < 86400000 &&
  validBundleTransferPrepare(v.input);
export function readPendingBundleTransfer(
  key: string | null,
  now = Date.now(),
): { pending: PendingBundleTransfer | null; error: boolean } {
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
export function savePendingBundleTransfer(key: string | null, pending: PendingBundleTransfer) {
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
export function clearPendingBundleTransfer(key: string | null) {
  try {
    if (!key) return false;
    sessionStorage.removeItem(key);
    return sessionStorage.getItem(key) === null;
  } catch {
    return false;
  }
}
