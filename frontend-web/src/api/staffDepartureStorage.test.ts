import { beforeEach, expect, it, vi } from 'vitest';
import {
  clearPendingStaffDeparture,
  PendingStaffDeparture,
  readPendingStaffDeparture,
  savePendingStaffDeparture,
  staffDepartureStorageKey,
} from './staffDepartureStorage';
import { departureId } from './staffDepartureFixtures.test-support';
const ticket = (): Extract<PendingStaffDeparture, { operation: 'request' }> => ({
  savedAt: Date.now(),
  actorId: 3,
  organizationId: 7,
  requestId: departureId,
  operation: 'request',
  input: { requestId: departureId, expectedOrganizationVersion: 4, acknowledgedDeparture: true },
});
beforeEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
});
it('round trips minimal exact request input; isolates sessions/actors; clears only exact ticket', () => {
  const p = ticket();
  expect(savePendingStaffDeparture('s', p)).toBe(true);
  expect(readPendingStaffDeparture('s', 3)).toEqual({ pending: p, error: false });
  expect(readPendingStaffDeparture('other', 3).pending).toBeNull();
  expect(readPendingStaffDeparture('s', 4).pending).toBeNull();
  expect(clearPendingStaffDeparture('s', p)).toBe(true);
  expect(readPendingStaffDeparture('s', 3).pending).toBeNull();
});
it('retains only captured completion basis/version and scoped target; no review/counts/private data', () => {
  const p: PendingStaffDeparture = {
    savedAt: Date.now(),
    actorId: 4,
    organizationId: 7,
    targetId: 3,
    requestId: departureId,
    operation: 'complete',
    input: { expectedVersion: 1, reviewBasis: 'a'.repeat(64), acknowledgedDeparture: true },
  };
  expect(savePendingStaffDeparture('s', p)).toBe(true);
  expect(readPendingStaffDeparture('s', 4).pending).toEqual(p);
  expect(savePendingStaffDeparture('s', { ...p, targetId: 4 })).toBe(false);
  expect(savePendingStaffDeparture('s', { ...p, input: { ...p.input, privateTitle: 'x' } } as any)).toBe(false);
});
it('fails closed on expired/future/oversize/malformed/misbound tickets and multiple unresolved requests', () => {
  const p = ticket(),
    key = staffDepartureStorageKey('s', p) as string;
  for (const value of [
    { ...p, savedAt: Date.now() - 86400000 },
    { ...p, savedAt: Date.now() + 100000 },
    { ...p, actorId: 4 },
    { ...p, organizationId: 8 },
    { ...p, extra: true },
    { ...p, input: {} },
  ]) {
    sessionStorage.setItem(key, JSON.stringify(value));
    expect(readPendingStaffDeparture('s', 3).error).toBe(true);
  }
  sessionStorage.setItem(key, 'x'.repeat(8193));
  expect(readPendingStaffDeparture('s', 3).error).toBe(true);
  sessionStorage.clear();
  savePendingStaffDeparture('s', p);
  const id2 = '633c472f-b03d-40a1-804c-4af4d787506c';
  savePendingStaffDeparture('s', { ...p, requestId: id2, input: { ...p.input, requestId: id2 } });
  expect(readPendingStaffDeparture('s', 3)).toEqual({ pending: null, error: true });
});
it('reports unavailable storage instead of allowing an untracked write', () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('blocked');
  });
  expect(savePendingStaffDeparture('s', ticket())).toBe(false);
  expect(savePendingStaffDeparture(null, ticket())).toBe(false);
});
