import { estimateTokens, normalizeJsonText } from './llm-json';

describe('normalizeJsonText', () => {
  it('returns text that already parses, trimmed', () => {
    expect(normalizeJsonText('  {"a": 1}\n')).toBe('{"a": 1}');
    expect(normalizeJsonText('[1,2]')).toBe('[1,2]');
    expect(normalizeJsonText('﻿{"a":1}')).toBe('{"a":1}');
  });

  it('takes the first fenced block, with or without a language tag, and ignores prose around it', () => {
    expect(normalizeJsonText('```json\n{"a": 1}\n```')).toBe('{"a": 1}');
    expect(normalizeJsonText('```\n[1]\n```')).toBe('[1]');
    expect(normalizeJsonText('Here you go:\n```json\n{"a": 1}\n```\nHope that helps.')).toBe(
      '{"a": 1}',
    );
    expect(normalizeJsonText('```json\n{"a":1}\n```\n```json\n{"b":2}\n```')).toBe('{"a":1}');
  });

  it('falls back to the span from the first brace to the last, when there is no fence', () => {
    expect(normalizeJsonText('The answer is {"a": {"b": [1, 2]}} as requested.')).toBe(
      '{"a": {"b": [1, 2]}}',
    );
  });

  it('refuses anything that is not one JSON value', () => {
    for (const text of ['', 'no json', '{"a": ', '```json\nnot json\n```', '{"a":1} {"b":2}'])
      expect(() => normalizeJsonText(text)).toThrow('LLM_INVALID_JSON');
    expect(() => normalizeJsonText(undefined as never)).toThrow('LLM_INVALID_JSON');
  });
});

describe('estimateTokens', () => {
  it('is characters over four, rounded up', () => {
    expect(estimateTokens('')).toBe(0);
    expect(estimateTokens('abcd')).toBe(1);
    expect(estimateTokens('abcde')).toBe(2);
  });
});
