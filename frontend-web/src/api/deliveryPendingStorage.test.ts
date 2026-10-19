import { beforeEach, expect, it, vi } from 'vitest';
import {
  clearDeliveryPending,
  DeliveryPending,
  deliveryPendingStorageKey,
  readDeliveryPending,
  saveDeliveryPending,
} from './deliveryPendingStorage';
import { saveDeliveries, validDeliveryInput } from './deliveryService';
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('@/helpers/apiHelper', () => api);
const scope = { selfId: 1, organizationId: 7, dashboardId: 20, session: 'opaque-session' };
const ticket = (): DeliveryPending => ({
  savedAt: Date.now(),
  selfId: 1,
  organizationId: 7,
  dashboardId: 20,
  input: {
    requestId: '533c472f-b03d-40a1-804c-4af4d787506c',
    active: true,
    allowCopy: true,
    recipients: [{ recipientId: 2, expectedVersion: 0 }],
  },
});
beforeEach(() => {
  vi.restoreAllMocks();
  vi.resetAllMocks();
  sessionStorage.clear();
});
it('roundtrips frozen minimal input without names/tokens and isolates actor/org/dashboard/session', () => {
  const p = ticket();
  expect(saveDeliveryPending(scope, p)).toBe(true);
  expect(readDeliveryPending(scope)).toEqual({ pending: p, error: false });
  for (const s of [
    { ...scope, selfId: 3 },
    { ...scope, organizationId: 8 },
    { ...scope, dashboardId: 21 },
    { ...scope, session: 'other-epoch' },
  ])
    expect(readDeliveryPending(s)).toEqual({ pending: null, error: false });
  expect(clearDeliveryPending({ ...scope, dashboardId: 21 })).toBe(true);
  expect(readDeliveryPending(scope).pending).toEqual(p);
  expect(clearDeliveryPending(scope)).toBe(true);
  expect(readDeliveryPending(scope).pending).toBeNull();
});
it('enforces exactly 24 hours, finite safe timestamps and 8KiB; corrupt/expired records stay explicit errors', () => {
  const p = ticket(),
    key = deliveryPendingStorageKey(scope) as string;
  expect(saveDeliveryPending(scope, { ...p, savedAt: Date.now() - 86400000 })).toBe(false);
  expect(saveDeliveryPending(scope, { ...p, savedAt: Date.now() + 60000 })).toBe(false);
  expect(saveDeliveryPending(scope, { ...p, savedAt: NaN })).toBe(false);
  sessionStorage.setItem(key, JSON.stringify(p));
  expect(readDeliveryPending(scope, p.savedAt + 86399999).error).toBe(false);
  expect(readDeliveryPending(scope, p.savedAt + 86400000).error).toBe(true);
  for (const raw of ['bad json', 'x'.repeat(8193), 'null', '[]', '{}']) {
    sessionStorage.setItem(key, raw);
    expect(readDeliveryPending(scope).error).toBe(true);
  }
});
it('rejects scope rebinding, private/unknown/missing fields at every level, and self recipient', () => {
  const p = ticket();
  for (const v of [
    { ...p, organizationId: 8 },
    { ...p, selfId: 3 },
    { ...p, dashboardId: 21 },
    { ...p, token: 'secret' },
    { ...p, input: { ...p.input, title: 'private' } },
    { ...p, input: { ...p.input, recipients: [{ recipientId: 2, expectedVersion: 0, name: 'private' }] } },
    { ...p, input: { ...p.input, recipients: [{ recipientId: 1, expectedVersion: 0 }] } },
  ])
    expect(saveDeliveryPending(scope, v as any)).toBe(false);
  expect(saveDeliveryPending({ ...scope, session: null }, p)).toBe(false);
});
it.each([
  { requestId: 'invalid' },
  { requestId: '533c472f-b03d-10a1-804c-4af4d787506c' },
  { requestId: '533c472f-b03d-50a1-804c-4af4d787506c' },
  { active: false, allowCopy: true },
  { recipients: [{ recipientId: 2, expectedVersion: 2147483647 }] },
  { active: 1 },
  { allowCopy: 'yes' },
  { recipients: [] },
  {
    recipients: [
      { recipientId: 2, expectedVersion: 0 },
      { recipientId: 2, expectedVersion: 1 },
    ],
  },
  { recipients: [{ recipientId: -1, expectedVersion: 0 }] },
  { recipients: [{ recipientId: 2, expectedVersion: -1 }] },
  { recipients: [{ recipientId: 2, expectedVersion: 1.5 }] },
  { recipients: [{ recipientId: Number.MAX_SAFE_INTEGER + 1, expectedVersion: 0 }] },
  { recipients: Array.from({ length: 51 }, (_, i) => ({ recipientId: i + 2, expectedVersion: 0 })) },
])('rejects malformed frozen input before any POST %s', async patch => {
  const input = { ...ticket().input, ...patch };
  expect(validDeliveryInput(input)).toBe(false);
  await expect(saveDeliveries(20, input as any)).rejects.toThrow();
  expect(api.post).not.toHaveBeenCalled();
});
it('accepts all fifty safe unique recipients, absent/false copy and revocation settings', () => {
  const p = ticket();
  p.input.recipients = Array.from({ length: 50 }, (_, i) => ({ recipientId: i + 2, expectedVersion: i }));
  expect(saveDeliveryPending(scope, p)).toBe(true);
  delete p.input.allowCopy;
  p.input.active = false;
  expect(saveDeliveryPending(scope, p)).toBe(true);
  p.input.allowCopy = false;
  p.input.recipients[0].expectedVersion = 2147483646;
  expect(saveDeliveryPending(scope, p)).toBe(true);
  p.input.active = true;
  p.input.allowCopy = false;
  expect(saveDeliveryPending(scope, p)).toBe(true);
});
it('write or readback failure blocks persistence and retains explicit error on unreadable storage', () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('quota');
  });
  expect(saveDeliveryPending(scope, ticket())).toBe(false);
  vi.restoreAllMocks();
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('blocked');
  });
  expect(saveDeliveryPending(scope, ticket())).toBe(false);
  expect(readDeliveryPending(scope).error).toBe(true);
  expect(clearDeliveryPending(scope)).toBe(false);
});

it('rejects uppercase UUID before storage or POST', async () => {
  const pending = ticket();
  pending.input.requestId = pending.input.requestId.toUpperCase();
  expect(saveDeliveryPending(scope, pending)).toBe(false);
  await expect(saveDeliveries(scope.dashboardId, pending.input)).rejects.toThrow();
  expect(api.post).not.toHaveBeenCalled();
});
