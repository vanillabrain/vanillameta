import { beforeEach, expect, it, vi } from 'vitest';
import {
  clearReceivedRemixPending,
  readReceivedRemixPending,
  receivedRemixStorageKey,
  ReceivedRemixPending,
  saveReceivedRemixPending,
  validReceivedRemixInput,
} from './receivedRemixPendingStorage';
import { lookupReceivedRemixResult } from './studioRemixApi';
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('@/helpers/apiHelper', () => api);
const scope = { actorId: 3, organizationId: 1, originId: 20, session: 'session' };
const reference = 'd-1-7-20-2-' + 'a'.repeat(64);
const ticket = (): ReceivedRemixPending => ({
  savedAt: Date.now(),
  actorId: 3,
  organizationId: 1,
  originId: 20,
  reference,
  input: {
    requestId: '533c472f-b03d-40a1-804c-4af4d787506c',
    targetSourceId: 22,
    mapping: { amount: 'total' },
    excludedBlockIds: [],
    expectedVersion: 2,
    expectedLifecycleRevision: 'c'.repeat(64),
    expectedSourceRevision: 'b'.repeat(64),
  },
});
beforeEach(() => {
  vi.restoreAllMocks();
  vi.resetAllMocks();
  sessionStorage.clear();
});
it('roundtrips private d-/g- references and exact minimal request; isolates actor/org/origin/session', () => {
  const p = ticket();
  expect(saveReceivedRemixPending(scope, p)).toBe(true);
  expect(readReceivedRemixPending(scope).pending).toEqual(p);
  for (const s of [
    { ...scope, actorId: 4 },
    { ...scope, organizationId: 2 },
    { ...scope, originId: 21 },
    { ...scope, session: 'other' },
  ])
    expect(readReceivedRemixPending(s)).toEqual({ pending: null, error: false });
  p.reference = 'g-1-7-20-2-80-3-' + 'a'.repeat(64);
  expect(saveReceivedRemixPending(scope, p)).toBe(true);
  expect(clearReceivedRemixPending(scope)).toBe(true);
  expect(readReceivedRemixPending(scope).pending).toBeNull();
});
it('enforces exact top keys, scope/reference binding, valid TTL and 128KiB without deleting malformed records', () => {
  const p = ticket(),
    key = receivedRemixStorageKey(scope) as string;
  for (const v of [
    { ...p, actorId: 4 },
    { ...p, organizationId: 2 },
    { ...p, originId: 21 },
    { ...p, reference: reference.replace('-20-', '-21-') },
    { ...p, reference: reference.replace('-1-', '-2-') },
    { ...p, reference: 'a'.repeat(64) },
    { ...p, document: {} },
    { ...p, token: 'secret' },
    { ...p, savedAt: Date.now() + 60000 },
    { ...p, savedAt: Date.now() - 86400000 },
  ])
    expect(saveReceivedRemixPending(scope, v as any)).toBe(false);
  sessionStorage.setItem(key, JSON.stringify(p));
  expect(readReceivedRemixPending(scope, p.savedAt + 86399999).error).toBe(false);
  expect(readReceivedRemixPending(scope, p.savedAt + 86400000).error).toBe(true);
  for (const raw of ['bad', 'x'.repeat(131073), 'null', '{}', '[]']) {
    sessionStorage.setItem(key, raw);
    expect(readReceivedRemixPending(scope)).toEqual({ pending: null, error: true });
    expect(sessionStorage.getItem(key)).toBe(raw);
  }
});
it.each([
  { requestId: 'bad' },
  { requestId: '533C472F-B03D-40A1-804C-4AF4D787506C' },
  { requestId: '533c472f-b03d-10a1-804c-4af4d787506c' },
  { targetSourceId: 0 },
  { expectedVersion: 0 },
  { expectedVersion: 1.5 },
  { expectedLifecycleRevision: 'bad' },
  { expectedSourceRevision: 'B'.repeat(64) },
  { mapping: [] },
  { mapping: JSON.parse('{"__proto__":"x"}') },
  { mapping: { constructor: 'x' } },
  { mapping: { prototype: 'x' } },
  { mapping: { ['x'.repeat(257)]: 'a' } },
  { mapping: { a: 'x'.repeat(257) } },
  { mapping: Object.fromEntries(Array.from({ length: 129 }, (_, i) => ['col' + i, 'target'])) },
  { excludedBlockIds: ['a', 'a'] },
  { excludedBlockIds: Array.from({ length: 7 }, (_, i) => 'b' + i) },
  { excludedBlockIds: ['x'.repeat(129)] },
  { sql: 'secret' },
])('rejects invalid frozen request before result lookup %s', async patch => {
  const p = { ...ticket(), input: { ...ticket().input, ...patch } };
  expect(validReceivedRemixInput(p.input)).toBe(false);
  expect(saveReceivedRemixPending(scope, p as any)).toBe(false);
  await expect(lookupReceivedRemixResult(reference, p.input as any)).rejects.toThrow();
  expect(api.post).not.toHaveBeenCalled();
});
it('enforces serialized UTF8 capacity and permits bounded mapping/exclusion limits', () => {
  const p = ticket();
  p.input.mapping = Object.fromEntries(Array.from({ length: 128 }, (_, i) => ['column' + i, 'a'.repeat(256)]));
  p.input.excludedBlockIds = Array.from({ length: 6 }, (_, i) => 'block' + i);
  expect(saveReceivedRemixPending(scope, p)).toBe(true);
  p.input.mapping = Object.fromEntries(Array.from({ length: 128 }, (_, i) => ['column' + i, '가'.repeat(256)]));
  expect(saveReceivedRemixPending(scope, p)).toBe(true);
  p.input.mapping = Object.fromEntries(Array.from({ length: 128 }, (_, i) => ['가'.repeat(250) + i, '가'.repeat(256)]));
  expect(saveReceivedRemixPending(scope, p)).toBe(false);
});
it('storage unavailable/readback failure blocks persistence', () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('quota');
  });
  expect(saveReceivedRemixPending(scope, ticket())).toBe(false);
  vi.restoreAllMocks();
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('blocked');
  });
  expect(readReceivedRemixPending(scope).error).toBe(true);
  expect(saveReceivedRemixPending(scope, ticket())).toBe(false);
  expect(clearReceivedRemixPending(scope)).toBe(false);
});
it('result lookup is exactly frozen read-only POST, validates found false and scoped own-copy receipt', async () => {
  const input = ticket().input,
    signal = new AbortController().signal;
  api.post
    .mockResolvedValueOnce({ data: { found: false } })
    .mockResolvedValueOnce({ data: { found: true, dashboardId: 90, sourceId: 22, revision: 'e'.repeat(64) } });
  await expect(lookupReceivedRemixResult(reference, input, signal)).resolves.toEqual({ found: false });
  await expect(lookupReceivedRemixResult(reference, input)).resolves.toMatchObject({ dashboardId: 90 });
  expect(api.post.mock.calls[0]).toEqual([
    '/studio/received/' + reference + '/remix-result',
    input,
    expect.objectContaining({ signal }),
  ]);
  expect(api.get).not.toHaveBeenCalled();
});
it.each([
  { found: false, hash: 'secret' },
  { found: true, dashboardId: 90, sourceId: 23, revision: 'e'.repeat(64) },
  { found: true, dashboardId: 20, sourceId: 22, revision: 'e'.repeat(64) },
  { found: true, dashboardId: 90, sourceId: 22, revision: 'bad' },
  { found: true, dashboardId: 90, sourceId: 22, revision: 'e'.repeat(64), document: {} },
  { found: 'false' },
  null,
])('rejects private/malformed or mismatched lookup result %s', async data => {
  api.post.mockResolvedValue({ data });
  await expect(lookupReceivedRemixResult(reference, ticket().input)).rejects.toThrow();
});
