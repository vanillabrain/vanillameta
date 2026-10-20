import { beforeEach, expect, it, vi } from 'vitest';
import {
  clearGroupDeliveryPending,
  GroupDeliveryPending,
  groupDeliveryPendingStorageKey,
  readGroupDeliveryPending,
  saveGroupDeliveryPending,
} from './groupDeliveryPendingStorage';
import { saveGroupDelivery, validGroupDeliveryInput } from './groupDeliveryService';
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('@/helpers/apiHelper', () => api);
const scope = { selfId: 1, organizationId: 5, dashboardId: 20, session: 'opaque-session' };
const ticket = (): GroupDeliveryPending => ({
  savedAt: Date.now(),
  selfId: 1,
  organizationId: 5,
  dashboardId: 20,
  input: {
    requestId: '533c472f-b03d-40a1-804c-4af4d787506c',
    groupId: 7,
    expectedGroupVersion: 3,
    expectedVersion: 0,
    active: true,
    allowCopy: true,
  },
});
beforeEach(() => {
  vi.restoreAllMocks();
  vi.resetAllMocks();
  sessionStorage.clear();
});
it('roundtrips only exact frozen input and isolates actor/org/dashboard/session independently from direct deliveries', () => {
  const p = ticket();
  expect(saveGroupDeliveryPending(scope, p)).toBe(true);
  expect(readGroupDeliveryPending(scope)).toEqual({ pending: p, error: false });
  for (const s of [
    { ...scope, selfId: 2 },
    { ...scope, organizationId: 6 },
    { ...scope, dashboardId: 21 },
    { ...scope, session: 'other' },
  ])
    expect(readGroupDeliveryPending(s)).toEqual({ pending: null, error: false });
  expect(groupDeliveryPendingStorageKey(scope)).toMatch(/^vm:group-delivery-pending:v1:/);
  expect(clearGroupDeliveryPending({ ...scope, dashboardId: 21 })).toBe(true);
  expect(readGroupDeliveryPending(scope).pending).toEqual(p);
  expect(clearGroupDeliveryPending(scope)).toBe(true);
  expect(readGroupDeliveryPending(scope).pending).toBeNull();
});
it('rejects scope rebinding/private fields and invalid clock/TTL/8KiB without exposing raw content', () => {
  const p = ticket(),
    key = groupDeliveryPendingStorageKey(scope) as string;
  for (const value of [
    { ...p, savedAt: NaN },
    { ...p, savedAt: Date.now() + 60000 },
    { ...p, savedAt: Date.now() - 86400000 },
    { ...p, selfId: 2 },
    { ...p, organizationId: 6 },
    { ...p, dashboardId: 21 },
    { ...p, name: 'private' },
    { ...p, input: { ...p.input, name: 'private' } },
  ])
    expect(saveGroupDeliveryPending(scope, value as any)).toBe(false);
  sessionStorage.setItem(key, JSON.stringify(p));
  expect(readGroupDeliveryPending(scope, p.savedAt + 86399999).error).toBe(false);
  expect(readGroupDeliveryPending(scope, p.savedAt + 86400000).error).toBe(true);
  for (const raw of ['bad', 'x'.repeat(8193), '{}', 'null', '[]']) {
    sessionStorage.setItem(key, raw);
    expect(readGroupDeliveryPending(scope)).toEqual({ pending: null, error: true });
  }
  expect(saveGroupDeliveryPending({ ...scope, session: null }, p)).toBe(false);
});
it.each([
  { requestId: 'bad' },
  { requestId: '533C472F-B03D-40A1-804C-4AF4D787506C' },
  { requestId: '533c472f-b03d-10a1-804c-4af4d787506c' },
  { requestId: '533c472f-b03d-50a1-804c-4af4d787506c' },
  { groupId: 0 },
  { groupId: Number.MAX_SAFE_INTEGER + 1 },
  { expectedGroupVersion: 0 },
  { expectedGroupVersion: 1.5 },
  { expectedVersion: -1 },
  { expectedVersion: 1.5 },
  { expectedVersion: 2147483647 },
  { active: 'true' },
  { allowCopy: undefined },
  { active: false, allowCopy: true },
  { extra: true },
])('rejects nonexecutable stored input before POST %s', async patch => {
  const p = { ...ticket(), input: { ...ticket().input, ...patch } };
  expect(validGroupDeliveryInput(p.input)).toBe(false);
  expect(saveGroupDeliveryPending(scope, p as any)).toBe(false);
  await expect(saveGroupDelivery(20, p.input as any)).rejects.toThrow();
  expect(api.post).not.toHaveBeenCalled();
});
it('accepts CAS boundaries and explicit revocation without copy; missing keys fail closed', () => {
  const p = ticket();
  p.input.expectedVersion = 2147483646;
  p.input.active = false;
  p.input.allowCopy = false;
  expect(saveGroupDeliveryPending(scope, p)).toBe(true);
  for (const k of Object.keys(p.input)) {
    const v = { ...p.input };
    delete v[k];
    expect(validGroupDeliveryInput(v)).toBe(false);
  }
});
it('read/write/readback/clear failures fail closed instead of permitting an untracked request', () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('quota');
  });
  expect(saveGroupDeliveryPending(scope, ticket())).toBe(false);
  vi.restoreAllMocks();
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('blocked');
  });
  expect(readGroupDeliveryPending(scope).error).toBe(true);
  expect(saveGroupDeliveryPending(scope, ticket())).toBe(false);
  expect(clearGroupDeliveryPending(scope)).toBe(false);
});
