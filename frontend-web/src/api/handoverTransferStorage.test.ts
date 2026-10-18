import { beforeEach, expect, it, vi } from 'vitest';
import {
  clearPendingTransfer,
  readPendingTransfer,
  savePendingTransfer,
  transferStorageKey,
} from './handoverTransferStorage';
const uuid = '12345678-1234-4234-8234-123456789012';
const key = transferStorageKey('session', 42, 7, uuid);
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
  expect(savePendingTransfer(key, t)).toBe(true);
  expect(readPendingTransfer(key).pending).toEqual(t);
  for (const other of [
    transferStorageKey('other', 42, 7, uuid),
    transferStorageKey('session', 43, 7, uuid),
    transferStorageKey('session', 42, 8, uuid),
    transferStorageKey('session', 42, 7, '22345678-1234-4234-8234-123456789012'),
  ])
    expect(readPendingTransfer(other).pending).toBeNull();
  expect(clearPendingTransfer(key)).toBe(true);
  expect(readPendingTransfer(key).pending).toBeNull();
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
  expect(readPendingTransfer(key)).toEqual({ pending: null, error: true });
});
it('does not send recovery data to unscoped storage and handles denied storage', () => {
  expect(savePendingTransfer(null, ticket())).toBe(false);
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw Error('denied');
  });
  expect(savePendingTransfer(key, ticket())).toBe(false);
});
