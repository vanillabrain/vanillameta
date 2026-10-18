import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import {
  storeClassificationCreate,
  readClassificationCreate,
  clearClassificationCreate,
} from './classificationCreateStorage';
const body = {
  expectedActorId: 1,
  expectedOrganizationId: 7,
  requestId: '11111111-1111-4111-8111-111111111111',
  name: '매출',
};
beforeEach(() => sessionStorage.clear());
afterEach(() => vi.restoreAllMocks());
it('persists only a minimal same-tab same-session actor/org request for 24h', () => {
  expect(storeClassificationCreate('session', body, 100)).toBe(true);
  const key = sessionStorage.key(0) ?? '';
  expect(key).not.toBe('');
  expect(Object.keys(JSON.parse(sessionStorage.getItem(key) ?? 'null'))).toEqual(['schemaVersion', 'savedAt', 'body']);
  expect(readClassificationCreate('session', 1, 7, 101)).toEqual({ record: body, error: false });
  expect(readClassificationCreate('other-session', 1, 7, 101)).toEqual({ record: null, error: false });
  expect(readClassificationCreate('session', 2, 7, 101)).toEqual({ record: null, error: false });
  expect(readClassificationCreate('session', 1, 8, 101)).toEqual({ record: null, error: false });
  expect(readClassificationCreate('session', 1, 7, 100 + 24 * 60 * 60 * 1000)).toEqual({ record: null, error: false });
  clearClassificationCreate('session', 1, 7);
  expect(readClassificationCreate('session', 1, 7, 101)).toEqual({ record: null, error: false });
});
it.each([
  'broken json',
  ' '.repeat(8193),
  JSON.stringify({ schemaVersion: 1, savedAt: 100, body: { ...body, expectedActorId: 2 } }),
  JSON.stringify({ schemaVersion: 1, savedAt: 100, body: { ...body, token: 'not-allowed' } }),
  JSON.stringify({ schemaVersion: 1, savedAt: 200, body }),
])('does not restore corrupt, oversize, future or substituted records', value => {
  storeClassificationCreate('session', body, 100);
  const key = sessionStorage.key(0) ?? '';
  expect(key).not.toBe('');
  sessionStorage.setItem(key, value);
  expect(readClassificationCreate('session', 1, 7, 101)).toEqual({ record: null, error: false });
});
it('reports storage failure rather than claiming durable recovery', () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('blocked');
  });
  expect(storeClassificationCreate('session', body)).toBe(false);
  expect(readClassificationCreate('session', 1, 7)).toEqual({ record: null, error: false });
});

it('distinguishes unavailable reads from no record and verifies cleanup', () => {
  storeClassificationCreate('session', body);
  const read = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('blocked');
  });
  expect(readClassificationCreate('session', 1, 7)).toEqual({ record: null, error: true });
  read.mockRestore();
  const remove = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
    throw new Error('blocked');
  });
  expect(clearClassificationCreate('session', 1, 7)).toBe(false);
  expect(readClassificationCreate('session', 1, 7).record).toEqual(body);
  remove.mockImplementation(() => undefined);
  expect(clearClassificationCreate('session', 1, 7)).toBe(false);
  remove.mockRestore();
  expect(clearClassificationCreate('session', 1, 7)).toBe(true);
});
