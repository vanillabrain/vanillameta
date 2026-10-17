import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import {
  creationQuestionKey,
  readCreationQuestion,
  writeCreationQuestion,
  removeCreationQuestion,
} from './studioCreationQuestion';
beforeEach(() => sessionStorage.clear());
afterEach(() => vi.restoreAllMocks());
it('keeps a full2000 character prompt and source ID separately from save confirmation', () => {
  const key = creationQuestionKey('scope:save');
  sessionStorage.setItem('scope:save', 'keep');
  const value = { sourceId: 4, prompt: '한'.repeat(2000) };
  expect(writeCreationQuestion(key, value)).toBe(true);
  expect(readCreationQuestion(key)).toEqual(value);
  expect(removeCreationQuestion(key)).toBe(true);
  expect(sessionStorage.getItem('scope:save')).toBe('keep');
});
it.each(['expired', 'future', 'oversized', 'extra', 'bad-source', 'malformed'])(
  'rejects %s data without touching other records',
  kind => {
    const value: any = { version: 1, updatedAt: Date.now(), sourceId: 4, prompt: 'keep' };
    if (kind === 'expired') value.updatedAt -= 24 * 60 * 60 * 1000;
    if (kind === 'future') value.updatedAt += 61000;
    if (kind === 'oversized') value.prompt = 'x'.repeat(9000);
    if (kind === 'extra') value.sql = 'not stored';
    if (kind === 'bad-source') value.sourceId = -1;
    sessionStorage.setItem('key', kind === 'malformed' ? 'invalid' : JSON.stringify(value));
    sessionStorage.setItem('other', 'keep');
    expect(readCreationQuestion('key')).toBeNull();
    expect(sessionStorage.getItem('other')).toBe('keep');
  },
);
it('handles no source, cleared questions, missing scope and storage errors', () => {
  expect(writeCreationQuestion('key', { sourceId: null, prompt: 'before choosing' })).toBe(true);
  expect(readCreationQuestion('key')?.sourceId).toBeNull();
  expect(writeCreationQuestion('key', { sourceId: null, prompt: '' })).toBe(true);
  expect(readCreationQuestion('key')).toBeNull();
  expect(writeCreationQuestion(null, { sourceId: 4, prompt: 'question' })).toBe(false);
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw Error('quota');
  });
  expect(writeCreationQuestion('key', { sourceId: 4, prompt: 'question' })).toBe(false);
});
