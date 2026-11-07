import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  documentText,
  locate,
  locateAnchor,
  locateImage,
  selectionOffsets,
  textAnchorAt,
  textAnchorProblem,
  textOffset,
} from './reportAnchor';

const vectors = JSON.parse(readFileSync(resolve(__dirname, '../../../../shared/report-anchor-vectors.json'), 'utf8'));
const cases = (group: Array<{ name: string }>) => group.map(vector => [vector.name, vector] as [string, any]);

describe('report anchor shared vectors', () => {
  it.each(cases(vectors.documentText))('documentText: %s', (_, v) => {
    expect(documentText(v.blocks, v.body)).toBe(v.expected);
  });
  it.each(cases(vectors.validate))('validate: %s', (_, v) => {
    expect(textAnchorProblem(v.anchor, v.text)).toBe(v.problem);
  });
  it.each(cases(vectors.anchorAt))('anchorAt: %s', (_, v) => {
    const anchor = textAnchorAt(v.text, v.start, v.end);
    expect(anchor).toEqual(v.expected);
    expect(textAnchorProblem(anchor, v.text)).toBeNull();
  });
  it.each(cases(vectors.locate))('locate: %s', (_, v) => {
    expect(locate(v.anchor, v.text)).toEqual(v.expected);
    expect(locateAnchor(v.anchor, v.text, null)).toEqual(v.expected);
  });
  it.each(cases(vectors.locateImage))('locateImage: %s', (_, v) => {
    expect(locateImage(v.blockId, v.blocks)).toEqual(v.expected);
    expect(locateAnchor({ kind: 'image', blockId: v.blockId }, '', v.blocks)).toEqual(v.expected);
  });
});

describe('selection offsets over highlighted text', () => {
  const text = 'Hi 😀 there, world';
  const article = () => {
    const root = document.createElement('article');
    // 'Hi ' + <mark>'😀 th'</mark> + 'ere, ' + <mark><b>'wor'</b></mark> + 'ld'
    root.append('Hi ');
    const mark = document.createElement('mark');
    mark.textContent = '😀 th';
    root.append(mark, 'ere, ');
    const second = document.createElement('mark');
    const bold = document.createElement('b');
    bold.textContent = 'wor';
    second.append(bold);
    root.append(second, 'ld');
    document.body.append(root);
    return { root, mark, second, bold };
  };
  it('renders exactly the document text', () => {
    const { root } = article();
    expect(root.textContent).toBe(text);
    root.remove();
  });
  it('maps text and element boundary points to UTF-16 offsets', () => {
    const { root, mark, second, bold } = article();
    expect(textOffset(root, root.firstChild, 2)).toBe(2);
    expect(textOffset(root, mark.firstChild, 2)).toBe(5);
    expect(textOffset(root, root, 0)).toBe(0);
    expect(textOffset(root, root, 1)).toBe(3);
    expect(textOffset(root, root, 2)).toBe(8);
    expect(textOffset(root, mark, 1)).toBe(8);
    expect(textOffset(root, second, 0)).toBe(13);
    expect(textOffset(root, bold, 1)).toBe(16);
    expect(textOffset(root, root, root.childNodes.length)).toBe(text.length);
    expect(textOffset(root, document.body, 0)).toBeNull();
    root.remove();
  });
  it('builds a valid anchor across highlight boundaries', () => {
    const { root, mark, bold } = article();
    const range = document.createRange();
    range.setStart(mark.firstChild, 3);
    range.setEnd(bold.firstChild, 2);
    const offsets = selectionOffsets(root, range, text);
    expect(offsets).toEqual({ start: 6, end: 15 });
    expect(text.slice(offsets.start, offsets.end)).toBe('there, wo');
    expect(textAnchorProblem(textAnchorAt(text, offsets.start, offsets.end), text)).toBeNull();
    root.remove();
  });
  it('widens a selection that splits a surrogate pair instead of cutting it', () => {
    const { root, mark } = article();
    const range = document.createRange();
    range.setStart(mark.firstChild, 1);
    range.setEnd(mark.firstChild, 3);
    const offsets = selectionOffsets(root, range, text);
    expect(offsets).toEqual({ start: 3, end: 6 });
    expect(textAnchorProblem(textAnchorAt(text, offsets.start, offsets.end), text)).toBeNull();
    const head = document.createRange();
    head.setStart(root.firstChild, 2);
    head.setEnd(mark.firstChild, 1);
    expect(selectionOffsets(root, head, text)).toEqual({ start: 2, end: 5 });
    root.remove();
  });
  it('ignores collapsed selections and clamps points outside the text to its edges', () => {
    const { root, mark } = article();
    const range = document.createRange();
    range.setStart(mark.firstChild, 2);
    range.setEnd(mark.firstChild, 2);
    expect(selectionOffsets(root, range, text)).toBeNull();
    const before = document.createRange();
    before.setStart(document.body, 0);
    before.setEnd(mark.firstChild, 2);
    expect(selectionOffsets(root, before, text)).toEqual({ start: 0, end: 5 });
    const after = document.createRange();
    after.setStart(mark.firstChild, 2);
    after.setEnd(document.body, document.body.childNodes.length);
    expect(selectionOffsets(root, after, text)).toEqual({ start: 5, end: text.length });
    const outside = document.createRange();
    outside.setStart(document.body, document.body.childNodes.length);
    outside.setEnd(document.body, document.body.childNodes.length);
    expect(selectionOffsets(root, outside, text)).toBeNull();
    root.remove();
  });
});
