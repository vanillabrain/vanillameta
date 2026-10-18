import { beforeEach, expect, it, vi } from 'vitest';
import {
  classificationName,
  createClassification,
  listClassifications,
  updateClassification,
  validClassificationRef,
} from './classificationService';
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('@/helpers/apiHelper', () => api);
beforeEach(() => vi.resetAllMocks());
const entry = { id: 4, name: '매출', active: true, version: 1 };
const body = {
  expectedActorId: 1,
  expectedOrganizationId: 7,
  requestId: '11111111-1111-4111-8111-111111111111',
  name: '매출',
};
it('normalizes names with UTF16 bounds while rejecting original controls and lone surrogates', () => {
  expect(classificationName('  Ａ분류  ')).toBe('A분류');
  expect(classificationName('😀'.repeat(40))).toHaveLength(80);
  for (const value of ['\n분류', '분류\t', 'a\u0085', '\ud800', '😀'.repeat(41), ' '.repeat(5)])
    expect(() => classificationName(value)).toThrow();
});
it.each([
  null,
  { organizationId: 1, id: 2, version: 0 },
  { organizationId: 1, id: '2', version: 1 },
  { organizationId: 1, id: 2, version: 1, name: 'x' },
])('rejects noncanonical classification refs %j', value => expect(validClassificationRef(value)).toBe(false));
it('accepts canonical refs and raw paginated lists only', async () => {
  expect(validClassificationRef({ organizationId: 7, id: 4, version: 1 })).toBe(true);
  api.get.mockResolvedValue({ data: { actorId: 1, organizationId: 7, canManage: true, entries: [entry], nextAfterId: 4 } });
  expect((await listClassifications()).entries).toEqual([entry]);
  expect(api.get).toHaveBeenCalledWith('/enterprise/classifications', undefined);
  api.get.mockResolvedValue({
    data: { actorId: 1, organizationId: 7, canManage: false, entries: [{ ...entry, id: 8 }], nextAfterId: null },
  });
  await listClassifications(4);
  expect(api.get).toHaveBeenLastCalledWith('/enterprise/classifications', { afterId: 4 });
});
it.each([
  { actorId: 0 },
  { entries: [{ ...entry, active: 'true' }] },
  { entries: [entry, entry] },
  { nextAfterId: 5 },
  { entries: [], nextAfterId: 4 },
  { entries: [{ ...entry, name: '\n매출' }] },
])('rejects malformed registry envelopes %j', async over => {
  api.get.mockResolvedValue({
    data: { actorId: 1, organizationId: 7, canManage: true, entries: [entry], nextAfterId: null, ...over },
  });
  await expect(listClassifications()).rejects.toThrow();
});
it('checks exact create identity and historical v1 receipt before resolving a pending request', async () => {
  api.post.mockResolvedValue({ data: { actorId: 1, organizationId: 7, entry, replayed: true } });
  expect((await createClassification(body)).replayed).toBe(true);
  for (const over of [
    { actorId: 2 },
    { organizationId: 9 },
    { entry: { ...entry, name: '다른 이름' } },
    { replayed: undefined },
  ]) {
    api.post.mockResolvedValue({ data: { actorId: 1, organizationId: 7, entry, replayed: false, ...over } });
    await expect(createClassification(body)).rejects.toThrow();
  }
});
it('checks update CAS result, including a valid no-op, without accepting other identity', async () => {
  const update = { expectedActorId: 1, expectedOrganizationId: 7, expectedVersion: 1, name: '매출', active: false };
  api.post.mockResolvedValue({ data: { actorId: 1, organizationId: 7, entry: { ...entry, active: false, version: 2 } } });
  expect((await updateClassification(4, update)).entry.version).toBe(2);
  api.post.mockResolvedValue({ data: { actorId: 1, organizationId: 7, entry } });
  await expect(updateClassification(4, { ...update, active: true })).resolves.toHaveProperty('entry.version', 1);
  api.post.mockResolvedValue({ data: { actorId: 2, organizationId: 7, entry } });
  await expect(updateClassification(4, { ...update, active: true })).rejects.toThrow();
});
