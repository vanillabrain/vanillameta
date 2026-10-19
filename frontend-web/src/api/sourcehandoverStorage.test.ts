import { beforeEach, expect, it, vi } from 'vitest';
import {
  clearPendingSourceTransfer,
  readPendingSourceTransfer,
  savePendingSourceTransfer,
  sourceTransferStorageKey,
} from './sourcehandoverStorage';
const uuid = '12345678-1234-4234-8234-123456789012';
const key = sourceTransferStorageKey('session', 42, 7, uuid);
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
  expect(savePendingSourceTransfer(key, t)).toBe(true);
  expect(readPendingSourceTransfer(key).pending).toEqual(t);
  for (const other of [
    sourceTransferStorageKey('other', 42, 7, uuid),
    sourceTransferStorageKey('session', 43, 7, uuid),
    sourceTransferStorageKey('session', 42, 8, uuid),
    sourceTransferStorageKey('session', 42, 7, '22345678-1234-4234-8234-123456789012'),
  ])
    expect(readPendingSourceTransfer(other).pending).toBeNull();
  expect(clearPendingSourceTransfer(key)).toBe(true);
  expect(readPendingSourceTransfer(key).pending).toBeNull();
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
  expect(readPendingSourceTransfer(key)).toEqual({ pending: null, error: true });
});
it('does not send recovery data to unscoped storage and handles denied storage', () => {
  expect(savePendingSourceTransfer(null, ticket())).toBe(false);
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw Error('denied');
  });
  expect(savePendingSourceTransfer(key, ticket())).toBe(false);
});
it('does not overwrite or recover dashboard transfer storage in the same scope', () => {
  const dashboardKey = `vm:handover-transfer:v1:session:42:7:${uuid}`;
  sessionStorage.setItem(dashboardKey, JSON.stringify(ticket()));
  expect(readPendingSourceTransfer(key).pending).toBeNull();
  expect(savePendingSourceTransfer(key, ticket())).toBe(true);
  expect(clearPendingSourceTransfer(key)).toBe(true);
  expect(sessionStorage.getItem(dashboardKey)).not.toBeNull();
});
