// Port of backend-api/src/reports/report-anchor.ts; both run shared/report-anchor-vectors.json.
// Offsets are UTF-16 code units of documentText().

export const ANCHOR_LIMITS = { quote: 2000, context: 32 } as const;
export type TextAnchor = { kind: 'text'; start: number; end: number; quote: string; prefix: string; suffix: string };
export type ReportAnchor = { kind: 'whole' } | TextAnchor | { kind: 'image'; blockId: string };
export type AnchorStatus = 'exact' | 'moved' | 'ambiguous' | 'detached';
export type AnchorLocation = { status: AnchorStatus; start?: number; end?: number };
type Block = { id?: string; kind?: string; text?: string };

/** TEXT blocks joined by a blank line, untrimmed (the editor textarea value); legacy reports use `body`. */
export function documentText(blocks: readonly Block[] | null | undefined, body: string): string {
  if (!blocks?.length) return body;
  return blocks
    .filter(block => block.kind === 'TEXT')
    .map(block => block.text ?? '')
    .join('\n\n');
}

const high = (code: number) => code >= 0xd800 && code <= 0xdbff;
const low = (code: number) => code >= 0xdc00 && code <= 0xdfff;
export function splitsSurrogate(text: string, position: number): boolean {
  return position > 0 && position < text.length && high(text.charCodeAt(position - 1)) && low(text.charCodeAt(position));
}

export function textAnchorProblem(anchor: TextAnchor, text: string): string | null {
  const { start, end, quote, prefix, suffix } = anchor;
  if (![start, end].every(value => Number.isSafeInteger(value) && value >= 0)) return 'offset';
  if (start >= end || end > text.length) return 'range';
  if (end - start > ANCHOR_LIMITS.quote) return 'quote-length';
  if (splitsSurrogate(text, start) || splitsSurrogate(text, end)) return 'surrogate';
  if (text.slice(start, end) !== quote) return 'quote';
  if (prefix.length > ANCHOR_LIMITS.context || suffix.length > ANCHOR_LIMITS.context) return 'context-length';
  if (prefix.length > start || text.slice(start - prefix.length, start) !== prefix) return 'prefix';
  if (text.slice(end, end + suffix.length) !== suffix) return 'suffix';
  return null;
}

export function textAnchorAt(text: string, start: number, end: number): TextAnchor {
  let from = Math.max(0, start - ANCHOR_LIMITS.context);
  if (splitsSurrogate(text, from)) from += 1;
  let to = Math.min(text.length, end + ANCHOR_LIMITS.context);
  if (splitsSurrogate(text, to)) to -= 1;
  return {
    kind: 'text',
    start,
    end,
    quote: text.slice(start, end),
    prefix: text.slice(from, start),
    suffix: text.slice(end, to),
  };
}

export function locate(anchor: TextAnchor, text: string): AnchorLocation {
  const { start, end, quote, prefix, suffix } = anchor;
  if (!quote) return { status: 'detached' };
  if (end - start === quote.length && text.slice(start, end) === quote) return { status: 'exact', start, end };
  const found: number[] = [];
  for (let at = text.indexOf(quote); at !== -1; at = text.indexOf(quote, at + 1)) found.push(at);
  if (!found.length) return { status: 'detached' };
  const candidates =
    found.length === 1
      ? found
      : found.filter(
          at =>
            at >= prefix.length &&
            text.slice(at - prefix.length, at) === prefix &&
            text.slice(at + quote.length, at + quote.length + suffix.length) === suffix,
        );
  if (candidates.length !== 1) return { status: 'ambiguous' };
  return { status: 'moved', start: candidates[0], end: candidates[0] + quote.length };
}

export function locateImage(blockId: string, blocks: readonly Block[] | null | undefined): AnchorLocation {
  return (blocks ?? []).some(block => block.kind === 'IMAGE' && block.id === blockId)
    ? { status: 'exact' }
    : { status: 'detached' };
}

export function locateAnchor(anchor: ReportAnchor, text: string, blocks: readonly Block[] | null | undefined) {
  if (anchor.kind === 'whole') return { status: 'exact' } as AnchorLocation;
  if (anchor.kind === 'image') return locateImage(anchor.blockId, blocks);
  return locate(anchor, text);
}

/**
 * UTF-16 offset of a DOM boundary point inside `root`, counting only text nodes so highlight
 * elements that split the text do not shift it. Null when the point is outside `root`.
 */
export function textOffset(root: Node, container: Node, offset: number): number | null {
  if (!root.contains(container)) return null;
  const isText = container.nodeType === Node.TEXT_NODE;
  const boundary = isText ? null : container.childNodes[offset] ?? null;
  const preceding = (reference: Node, node: Node) =>
    (reference.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_PRECEDING) !== 0;
  const before = (node: Node) =>
    isText || (boundary ? preceding(boundary, node) : container.contains(node) || preceding(container, node));
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let total = 0;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node === container) return total + offset;
    if (!before(node)) return total;
    total += node.nodeValue?.length ?? 0;
  }
  return total;
}

/** Selection range in document-text offsets, widened so it never splits a surrogate pair. */
export function selectionOffsets(root: Node, range: Range, text: string): { start: number; end: number } | null {
  const whole = document.createRange();
  whole.selectNodeContents(root);
  // A point before or after the article (triple-click, drag past its edge) clamps to the text edge.
  const at = (container: Node, offset: number) => {
    const side = whole.comparePoint(container, offset);
    return side < 0 ? 0 : side > 0 ? text.length : textOffset(root, container, offset);
  };
  const a = at(range.startContainer, range.startOffset);
  const b = at(range.endContainer, range.endOffset);
  if (a === null || b === null) return null;
  let start = Math.min(a, b);
  let end = Math.min(Math.max(a, b), text.length);
  if (splitsSurrogate(text, start)) start -= 1;
  if (splitsSurrogate(text, end)) end += 1;
  return end > start ? { start, end } : null;
}
