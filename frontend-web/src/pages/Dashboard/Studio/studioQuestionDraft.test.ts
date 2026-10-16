import { webcrypto } from 'node:crypto';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { setToken, removeToken } from '@/helpers/authHelper';
import { retainEditorDraftSession, EDITOR_DRAFT_TTL } from '@/helpers/editorDraftStorage';
import { studioQuestionKey, readStudioQuestion, writeStudioQuestion, removeStudioQuestion } from './studioQuestionDraft';
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
it('isolates dashboard/login keys, retains normal refresh scope and clears on logout', async () => {
  const key = await studioQuestionKey(45);
  expect(key).not.toBe(await studioQuestionKey(46));
  expect(writeStudioQuestion(key, '보관 질문')).toBe(true);
  await retainEditorDraftSession('old', 'new');
  setToken('new', true);
  expect(await studioQuestionKey(45)).toBe(key);
  setToken('different-login');
  expect(await studioQuestionKey(45)).not.toBe(key);
  removeToken();
  expect(readStudioQuestion(key)).toBeNull();
});
it('only restores bounded nonempty unexpired text and removes cleared input', async () => {
  const key = await studioQuestionKey(45),
    now = Date.now();
  expect(writeStudioQuestion(key, '질문', now)).toBe(true);
  expect(readStudioQuestion(key, now)).toBe('질문');
  expect(readStudioQuestion(key, now + EDITOR_DRAFT_TTL)).toBeNull();
  expect(writeStudioQuestion(key, 'x'.repeat(2001))).toBe(false);
  expect(writeStudioQuestion(key, '질문')).toBe(true);
  expect(writeStudioQuestion(key, '   ')).toBe(true);
  expect(readStudioQuestion(key)).toBeNull();
});
it.each([
  '{',
  JSON.stringify({ version: 1, updatedAt: Date.now(), text: 'safe', sql: 'SELECT 1' }),
  'x'.repeat(8193),
  JSON.stringify({ version: 1, updatedAt: Date.now() + 120000, text: 'future' }),
])('rejects damaged, oversized or unexpected payloads', async raw => {
  const key = await studioQuestionKey(45);
  if (!key) throw Error('missing scoped key');
  sessionStorage.setItem(key, raw);
  expect(readStudioQuestion(key)).toBeNull();
  expect(sessionStorage.getItem(key)).toBeNull();
});
it('reports storage failure without throwing or replacing other keys', async () => {
  const key = await studioQuestionKey(45);
  sessionStorage.setItem('unrelated', 'keep');
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw Error('quota');
  });
  expect(writeStudioQuestion(key, 'question')).toBe(false);
  expect(sessionStorage.getItem('unrelated')).toBe('keep');
});

it('does not report successful removal when the tab storage rejects it', async () => {
  const key = await studioQuestionKey(45);
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
    throw Error('blocked');
  });
  expect(removeStudioQuestion(key)).toBe(false);
});
