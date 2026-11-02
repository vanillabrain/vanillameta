jest.mock('../ai/ai.service', () => ({ AiService: class {} }));
jest.mock('@ai-sdk/provider', () => ({}));
jest.mock('@ai-sdk/anthropic', () => ({ createAnthropic: jest.fn() }));
jest.mock('@ai-sdk/openai', () => ({ createOpenAI: jest.fn() }));
jest.mock('@ai-sdk/openai-compatible', () => ({ createOpenAICompatible: jest.fn() }));
import { BadRequestException } from '@nestjs/common';
import { COMMENT_LIMITS } from '../reports/report-comment-contract';
import { quoteRange, widenParagraphDeletion } from './mcp-report.service';

const SEP = '\n\n';

describe('widenParagraphDeletion', () => {
  const doc = ['First paragraph.', 'Middle one. Second sentence.', 'Last paragraph.'].join(SEP);
  const range = (part: string, from = 0) => {
    const start = doc.indexOf(part, from);
    return { start, end: start + part.length };
  };

  it('leaves a whole-document deletion alone', () => {
    const all = { start: 0, end: doc.length };
    expect(widenParagraphDeletion(doc, all)).toBe(all);
    const single = 'Only paragraph.';
    const only = { start: 0, end: single.length };
    expect(widenParagraphDeletion(single, only)).toBe(only);
  });

  it('leaves a sentence inside a paragraph alone', () => {
    for (const part of ['Second sentence.', 'Middle one. ', 'paragraph', 'First']) {
      const inside = range(part);
      expect(widenParagraphDeletion(doc, inside)).toBe(inside);
    }
  });

  it('takes the following separator for the first paragraph', () => {
    const first = range('First paragraph.');
    const widened = widenParagraphDeletion(doc, first);
    expect(widened).toEqual({ start: 0, end: first.end + SEP.length });
    expect(doc.slice(0, widened.start) + doc.slice(widened.end)).toBe(
      ['Middle one. Second sentence.', 'Last paragraph.'].join(SEP),
    );
  });

  it('takes the following separator for a middle paragraph', () => {
    const middle = range('Middle one. Second sentence.');
    const widened = widenParagraphDeletion(doc, middle);
    expect(widened).toEqual({ start: middle.start, end: middle.end + SEP.length });
    expect(doc.slice(0, widened.start) + doc.slice(widened.end)).toBe(
      ['First paragraph.', 'Last paragraph.'].join(SEP),
    );
  });

  it('takes the preceding separator for the last paragraph', () => {
    const last = range('Last paragraph.');
    const widened = widenParagraphDeletion(doc, last);
    expect(widened).toEqual({ start: last.start - SEP.length, end: doc.length });
    expect(doc.slice(0, widened.start) + doc.slice(widened.end)).toBe(
      ['First paragraph.', 'Middle one. Second sentence.'].join(SEP),
    );
  });

  it('widens a range spanning several whole paragraphs once', () => {
    const span = { start: 0, end: doc.indexOf('Last paragraph.') - SEP.length };
    const widened = widenParagraphDeletion(doc, span);
    expect(widened).toEqual({ start: 0, end: span.end + SEP.length });
    expect(doc.slice(widened.end)).toBe('Last paragraph.');
    const tail = {
      start: doc.indexOf('Middle one.'),
      end: doc.length,
    };
    expect(widenParagraphDeletion(doc, tail)).toEqual({
      start: tail.start - SEP.length,
      end: doc.length,
    });
  });

  it('leaves a range that starts or ends mid-paragraph alone', () => {
    const partial = {
      start: doc.indexOf('paragraph.'),
      end: doc.indexOf('Middle') + 'Middle'.length,
    };
    expect(widenParagraphDeletion(doc, partial)).toBe(partial);
  });

  it('does not widen past the 2000 unit quote limit', () => {
    const limit = COMMENT_LIMITS.quote;
    const at = (paragraph: string) => {
      const text = ['Head.', paragraph, 'Tail.'].join(SEP);
      const start = text.indexOf(paragraph);
      const found = { start, end: start + paragraph.length };
      return { found, widened: widenParagraphDeletion(text, found) };
    };
    const fits = at('x'.repeat(limit - SEP.length));
    expect(fits.widened.end - fits.widened.start).toBe(limit);
    expect(fits.widened).toEqual({ start: fits.found.start, end: fits.found.end + SEP.length });

    const over = at('x'.repeat(limit - SEP.length + 1));
    expect(over.widened).toBe(over.found);
    const exactlyLimit = at('x'.repeat(limit));
    expect(exactlyLimit.widened).toBe(exactlyLimit.found);
  });
});

describe('quoteRange', () => {
  it('returns the single match and 1-based occurrences in document order', () => {
    const text = 'ab ab ab';
    expect(quoteRange(text, 1, 'ab ab', 1)).toEqual({ start: 0, end: 5 });
    expect(quoteRange(text, 1, 'ab', 3)).toEqual({ start: 6, end: 8 });
    expect(quoteRange('one two', 1, 'two')).toEqual({ start: 4, end: 7 });
  });

  it('skips a match that would split a surrogate pair', () => {
    const emoji = '\u{1F600}';
    const text = `${emoji}${emoji}`;
    const lowHigh = text.slice(1, 3);
    expect(() => quoteRange(text, 1, lowHigh)).toThrow('quote is not in version 1');
    expect(quoteRange(text, 1, emoji, 2)).toEqual({ start: 2, end: 4 });
  });

  it('reports the counted matches, and an out-of-range occurrence', () => {
    expect(() => quoteRange('a a a', 1, 'a')).toThrow(
      'quote matches 3 places. Pass occurrence 1-3',
    );
    expect(() => quoteRange('a a', 1, 'a', 3)).toThrow(
      'occurrence 3 is out of range: quote matches 2 place(s).',
    );
    const exactlyCap = Array.from({ length: 100 }, () => 'a').join(' ');
    expect(() => quoteRange(exactlyCap, 1, 'a')).toThrow('quote matches 100 places.');
  });

  it('stops counting past 100 matches and never echoes the quote', () => {
    const text = 'secret '.repeat(5000);
    const indexOf = jest.spyOn(String.prototype, 'indexOf');
    let error: unknown;
    try {
      quoteRange(text, 1, 'secret');
    } catch (caught) {
      error = caught;
    }
    const calls = indexOf.mock.calls.filter(([needle]) => needle === 'secret').length;
    indexOf.mockRestore();
    expect(error).toBeInstanceOf(BadRequestException);
    const message = (error as BadRequestException).message;
    expect(message).toBe(
      'quote matches 100+ places. Pass occurrence (document order) or quote more text.',
    );
    expect(message).not.toContain('secret');
    expect(calls).toBe(101);
  });

  it('stops scanning at the requested occurrence', () => {
    const text = 'secret '.repeat(5000);
    const indexOf = jest.spyOn(String.prototype, 'indexOf');
    const found = quoteRange(text, 1, 'secret', 2);
    const calls = indexOf.mock.calls.filter(([needle]) => needle === 'secret').length;
    indexOf.mockRestore();
    expect(found).toEqual({ start: 7, end: 13 });
    expect(calls).toBe(2);
    expect(quoteRange(text, 1, 'secret', 4999).start).toBe(7 * 4998);
  });
});
