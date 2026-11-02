import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  appliedLength,
  documentText,
  locate,
  locateAnchor,
  locateImage,
  textAnchorAt,
  textAnchorProblem,
} from './report-anchor';
import { reportAnchor, suggestionCreateRequest, textAnchor } from './report-comment-contract';

/** Shared with frontend-web: the same file must drive both implementations. */
const vectors = JSON.parse(
  readFileSync(resolve(__dirname, '../../../shared/report-anchor-vectors.json'), 'utf8'),
);

describe('report anchor shared vectors', () => {
  it.each(vectors.documentText.map(v => [v.name, v]))('documentText: %s', (_, v: any) => {
    expect(documentText(v.blocks, v.body)).toBe(v.expected);
  });
  it.each(vectors.validate.map(v => [v.name, v]))('validate: %s', (_, v: any) => {
    expect(textAnchorProblem(v.anchor, v.text)).toBe(v.problem);
  });
  it.each(vectors.anchorAt.map(v => [v.name, v]))('anchorAt: %s', (_, v: any) => {
    const anchor = textAnchorAt(v.text, v.start, v.end);
    expect(anchor).toEqual(v.expected);
    expect(textAnchorProblem(anchor, v.text)).toBeNull();
  });
  it.each(vectors.locate.map(v => [v.name, v]))('locate: %s', (_, v: any) => {
    expect(locate(v.anchor, v.text)).toEqual(v.expected);
    expect(locateAnchor(v.anchor, v.text, null)).toEqual(v.expected);
  });
  it.each(vectors.locateImage.map(v => [v.name, v]))('locateImage: %s', (_, v: any) => {
    expect(locateImage(v.blockId, v.blocks)).toEqual(v.expected);
    expect(locateAnchor({ kind: 'image', blockId: v.blockId }, '', v.blocks)).toEqual(v.expected);
  });
  it('covers every outcome the design names', () => {
    const statuses = new Set(vectors.locate.map(v => v.expected.status));
    expect([...statuses].sort()).toEqual(['ambiguous', 'detached', 'exact', 'moved']);
  });
});

describe('report anchor limits', () => {
  it('rejects quotes over 2000 units and accepts exactly 2000', () => {
    const text = 'b'.repeat(2001);
    expect(
      textAnchorProblem(
        { kind: 'text', start: 0, end: 2001, quote: text, prefix: '', suffix: '' },
        text,
      ),
    ).toBe('quote-length');
    expect(
      textAnchorProblem(
        { kind: 'text', start: 1, end: 2001, quote: text.slice(1), prefix: 'b', suffix: '' },
        text,
      ),
    ).toBeNull();
    expect(
      textAnchor.safeParse({
        kind: 'text',
        start: 0,
        end: 2001,
        quote: text,
        prefix: '',
        suffix: '',
      }).success,
    ).toBe(false);
  });
  it('rejects lone surrogates and unknown anchor shapes at the schema', () => {
    for (const anchor of [
      { kind: 'text', start: 0, end: 1, quote: '\ud83d', prefix: '', suffix: '' },
      { kind: 'text', start: 0, end: 1, quote: 'x', prefix: '\ude00', suffix: '' },
      { kind: 'text', start: 0, end: 1, quote: '\u0000', prefix: '', suffix: '' },
      { kind: 'text', start: -1, end: 1, quote: 'x', prefix: '', suffix: '' },
      { kind: 'image', blockId: 'bad id' },
      { kind: 'whole', extra: true },
      { kind: 'kpi' },
    ])
      expect(reportAnchor.safeParse(anchor).success).toBe(false);
    expect(reportAnchor.safeParse({ kind: 'whole' }).success).toBe(true);
  });
  it('measures the document after a replacement in UTF-16 units', () => {
    const anchor = {
      kind: 'text' as const,
      start: 2,
      end: 4,
      quote: 'cd',
      prefix: 'ab',
      suffix: '',
    };
    expect(appliedLength('abcd', anchor, '😀😀😀')).toBe(8);
    expect(appliedLength('abcd', anchor, '')).toBe(2);
  });
  it('allows deletion but limits replacement and rationale size', () => {
    const base = {
      requestId: 'a2345678-1234-4234-8234-123456789abc',
      version: 1,
      anchor: { kind: 'text', start: 0, end: 1, quote: 'x', prefix: '', suffix: '' },
    };
    expect(suggestionCreateRequest.safeParse({ ...base, replacement: '' }).success).toBe(true);
    expect(
      suggestionCreateRequest.safeParse({ ...base, replacement: 'y'.repeat(20001) }).success,
    ).toBe(false);
    expect(
      suggestionCreateRequest.safeParse({ ...base, replacement: 'y', rationale: 'r'.repeat(2001) })
        .success,
    ).toBe(false);
    expect(
      suggestionCreateRequest.safeParse({ ...base, replacement: 'y', anchor: { kind: 'whole' } })
        .success,
    ).toBe(false);
  });
});
