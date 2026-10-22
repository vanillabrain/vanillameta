import { webcrypto } from 'node:crypto';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { setToken, removeToken } from '@/helpers/authHelper';
import { retainEditorDraftSession } from '@/helpers/editorDraftStorage';
import {
  creationConfirmationKey,
  readCreationConfirmation,
  writeCreationConfirmation,
  removeCreationConfirmation,
  CONFIRMATION_TTL,
  CreationConfirmation,
} from './studioCreationRecovery';
const fixture = (): CreationConfirmation => ({
  version: 1,
  updatedAt: Date.now(),
  sourceId: 30,
  title: 'KPI',
  prompt: 'keep question',
  request: { requestId: 'request-one', proposalId: 'proposal-one', expectedSourceRevision: 'a'.repeat(64) },
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
it('keeps the exact minimal request through token renewal and clears it on logout', async () => {
  const key = await creationConfirmationKey();
  writeCreationConfirmation(key, fixture());
  await retainEditorDraftSession('old', 'new');
  setToken('new', true);
  expect(await creationConfirmationKey()).toBe(key);
  expect(readCreationConfirmation(key)?.request.requestId).toBe('request-one');
  removeToken();
  expect(sessionStorage.getItem(key)).toBeNull();
});
it('isolates a same-token new login and removes only its explicit confirmation key', async () => {
  const key = await creationConfirmationKey();
  writeCreationConfirmation(key, fixture());
  setToken('old');
  expect(await creationConfirmationKey()).not.toBe(key);
  expect(readCreationConfirmation(await creationConfirmationKey())).toBeNull();
  const current = await creationConfirmationKey();
  writeCreationConfirmation(current, fixture());
  sessionStorage.setItem('other', 'keep');
  removeCreationConfirmation(current);
  expect(sessionStorage.getItem('other')).toBe('keep');
});
it.each(['expired', 'future', 'extra', 'request-extra', 'malformed', 'oversized'])(
  'rejects %s records without replay',
  async kind => {
    const key = await creationConfirmationKey();
    const now = Date.now();
    const value: any = { ...fixture(), updatedAt: now };
    if (kind === 'expired') value.updatedAt -= CONFIRMATION_TTL;
    if (kind === 'future') value.updatedAt += 60001;
    if (kind === 'extra') value.preview = { sql: 'never restore' };
    if (kind === 'request-extra') value.request.sourceId = 30;
    sessionStorage.setItem(
      key,
      kind === 'malformed' ? '{' : kind === 'oversized' ? 'x'.repeat(9000) : JSON.stringify(value),
    );
    expect(readCreationConfirmation(key, now)).toBeNull();
    expect(sessionStorage.getItem(key)).toBeNull();
  },
);
it('reports storage failure before a caller can send the write', async () => {
  const key = await creationConfirmationKey();
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('quota');
  });
  expect(() => writeCreationConfirmation(key, fixture())).toThrow('quota');
});

it.each([
  ['future limit', 60000, true],
  ['beyond future limit', 60001, false],
  ['before expiry', -CONFIRMATION_TTL + 1, true],
  ['at expiry', -CONFIRMATION_TTL, false],
] as const)('checks %s against the same captured clock', async (_label, offset, accepted) => {
  const key = await creationConfirmationKey();
  const now = 1700000000000;
  const value = { ...fixture(), updatedAt: now + offset };
  sessionStorage.setItem(key, JSON.stringify(value));
  expect(readCreationConfirmation(key, now)).toEqual(accepted ? value : null);
  expect(sessionStorage.getItem(key)).toBe(accepted ? JSON.stringify(value) : null);
});
