import { beforeEach, expect, it, vi } from 'vitest';
import {
  clearPendingBundleTransfer,
  readPendingBundleTransfer,
  savePendingBundleTransfer,
  bundleTransferStorageKey,
} from './bundlehandoverStorage';
const uuid = '12345678-1234-4234-8234-123456789012';
const key = bundleTransferStorageKey('session', 42, 7, uuid);
const ticket = () => ({
  savedAt: Date.now(),
  input: { requestId: uuid, expectedProposalVersion: 2, basis: 'opaque', acknowledgedTransfer: true as const },
});
beforeEach(() => {
  sessionStorage.clear();
  vi.restoreAllMocks();
});
it('persists only exact pending preparation and isolates actor/org/proposal/session', () => {
  const t = ticket();
  expect(savePendingBundleTransfer(key, t)).toBe(true);
  expect(readPendingBundleTransfer(key).pending).toEqual(t);
  for (const other of [
    bundleTransferStorageKey('other', 42, 7, uuid),
    bundleTransferStorageKey('session', 43, 7, uuid),
    bundleTransferStorageKey('session', 42, 8, uuid),
    bundleTransferStorageKey('session', 42, 7, '22345678-1234-4234-8234-123456789012'),
  ])
    expect(readPendingBundleTransfer(other).pending).toBeNull();
  expect(clearPendingBundleTransfer(key)).toBe(true);
  expect(readPendingBundleTransfer(key).pending).toBeNull();
});
it.each(['malformed', 'oversize', 'expired', 'future', 'extra', 'invalid'])('fails closed for %s recovery', kind => {
  let raw = JSON.stringify(ticket());
  if (kind === 'malformed') raw = '{';
  if (kind === 'oversize') raw = 'x'.repeat(8193);
  if (kind === 'expired') raw = JSON.stringify({ ...ticket(), savedAt: Date.now() - 86400000 });
  if (kind === 'future') raw = JSON.stringify({ ...ticket(), savedAt: Date.now() + 10000 });
  if (kind === 'extra') raw = JSON.stringify({ ...ticket(), privateManifest: [] });
  if (kind === 'invalid') raw = JSON.stringify({ ...ticket(), input: { ...ticket().input, acknowledgedTransfer: false } });
  sessionStorage.setItem(key, raw);
  expect(readPendingBundleTransfer(key)).toEqual({ pending: null, error: true });
});
it('does not send recovery data to unscoped storage and handles denied storage', () => {
  expect(savePendingBundleTransfer(null, ticket())).toBe(false);
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw Error('denied');
  });
  expect(savePendingBundleTransfer(key, ticket())).toBe(false);
});
it('does not overwrite or recover dashboard transfer storage in the same scope', () => {
  const dashboardKey = `vm:handover-transfer:v1:session:42:7:${uuid}`;
  sessionStorage.setItem(dashboardKey, JSON.stringify(ticket()));
  expect(readPendingBundleTransfer(key).pending).toBeNull();
  expect(savePendingBundleTransfer(key, ticket())).toBe(true);
  expect(clearPendingBundleTransfer(key)).toBe(true);
  expect(sessionStorage.getItem(dashboardKey)).not.toBeNull();
});
it('isolates unresolved bundles from source-only and dashboard-only final requests', () => {
  const sourceKey = `vm:source-handover:v1:session:42:7:${uuid}`,
    dashboardKey = `vm:handover-transfer:v1:session:42:7:${uuid}`;
  sessionStorage.setItem(sourceKey, JSON.stringify(ticket()));
  sessionStorage.setItem(dashboardKey, JSON.stringify(ticket()));
  expect(readPendingBundleTransfer(key).pending).toBeNull();
  expect(savePendingBundleTransfer(key, ticket())).toBe(true);
  expect(clearPendingBundleTransfer(key)).toBe(true);
  expect(sessionStorage.getItem(sourceKey)).not.toBeNull();
  expect(sessionStorage.getItem(dashboardKey)).not.toBeNull();
});
