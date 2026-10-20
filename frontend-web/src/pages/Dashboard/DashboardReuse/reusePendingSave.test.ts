import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { setToken, removeToken } from '@/helpers/authHelper';
import { retainEditorDraftSession } from '@/helpers/editorDraftStorage';
import {
  reusePendingSaveKey,
  readReusePendingSave,
  writeReusePendingSave,
  removeReusePendingSave,
  ReusePendingSave,
} from './reusePendingSave';
const value = (): ReusePendingSave => ({
  version: 1,
  updatedAt: Date.now(),
  originalId: 12,
  sourceId: 2,
  title: '보관 제목',
  columnMap: { amount: 'sales' },
  blockIds: ['chart1'],
  unitConfirmed: true,
  request: { ticket: '11111111-1111-4111-8111-111111111111', requestId: '22222222-2222-4222-8222-222222222222' },
});
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.stubGlobal('crypto', webcrypto);
  setToken('old');
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it('preserves exact requests across refresh-token renewal and clears them on logout', async () => {
  const key = await reusePendingSaveKey(12),
    record = value();
  writeReusePendingSave(key, record);
  await retainEditorDraftSession('old', 'new');
  setToken('new', true);
  expect(await reusePendingSaveKey(12)).toBe(key);
  expect(readReusePendingSave(key, 12)).toEqual(record);
  expect(readReusePendingSave(await reusePendingSaveKey(13), 13)).toBeNull();
  removeToken();
  expect(sessionStorage.getItem(key)).toBeNull();
});
it('isolates same-token new login and removes only this key', async () => {
  const key = await reusePendingSaveKey(12);
  writeReusePendingSave(key, value());
  setToken('old');
  expect(await reusePendingSaveKey(12)).not.toBe(key);
  const current = await reusePendingSaveKey(12);
  writeReusePendingSave(current, value());
  sessionStorage.setItem('other', 'keep');
  removeReusePendingSave(current);
  expect(sessionStorage.getItem('other')).toBe('keep');
});
it.each(['expired', 'future', 'extra', 'request-extra', 'malformed', 'oversized', 'wrong-original', 'unsafe-map'])(
  'rejects %s data and never restores a request',
  async kind => {
    const key = await reusePendingSaveKey(12),
      v: any = value();
    if (kind === 'expired') v.updatedAt -= 86400000;
    if (kind === 'future') v.updatedAt += 60001;
    if (kind === 'extra') v.preview = { sql: 'not allowed' };
    if (kind === 'request-extra') v.request.sql = 'not allowed';
    if (kind === 'wrong-original') v.originalId = 13;
    if (kind === 'unsafe-map') v.columnMap = JSON.parse('{"__proto__":"sales"}');
    sessionStorage.setItem(key, kind === 'malformed' ? '{' : kind === 'oversized' ? 'x'.repeat(9000) : JSON.stringify(v));
    expect(readReusePendingSave(key, 12)).toBeNull();
    expect(sessionStorage.getItem(key)).toBeNull();
  },
);
it('storage failure is not interpreted as an empty recovery slot', async () => {
  const key = await reusePendingSaveKey(12);
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw Error('blocked');
  });
  expect(() => readReusePendingSave(key, 12)).toThrow('blocked');
});
it('failed write or silent quota failure is reported before network use', async () => {
  const key = await reusePendingSaveKey(12);
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => undefined);
  expect(() => writeReusePendingSave(key, value())).toThrow();
});
