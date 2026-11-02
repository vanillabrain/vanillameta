/**
 * Pure anchor functions shared (by test vectors) with the frontend:
 * shared/report-anchor-vectors.json. Offsets are UTF-16 code units of documentText().
 */
import { COMMENT_LIMITS } from './report-comment-contract';
import type { AnchorLocation, ReportAnchor, ReportTextAnchor } from './report-comment-contract';

type Block = { id?: string; kind?: string; text?: string };

/**
 * TEXT block texts in order joined by a blank line (untrimmed), exactly the editor textarea value.
 * Only a legacy report without any blocks uses `body`; an image-only report has empty text.
 */
export function documentText(blocks: readonly Block[] | null | undefined, body: string): string {
  if (!blocks?.length) return body;
  return blocks
    .filter(block => block.kind === 'TEXT')
    .map(block => block.text ?? '')
    .join('\n\n');
}

const high = (code: number) => code >= 0xd800 && code <= 0xdbff;
const low = (code: number) => code >= 0xdc00 && code <= 0xdfff;
/** True when `position` falls between the two halves of a surrogate pair. */
export function splitsSurrogate(text: string, position: number): boolean {
  return (
    position > 0 &&
    position < text.length &&
    high(text.charCodeAt(position - 1)) &&
    low(text.charCodeAt(position))
  );
}

/** Returns null when the text anchor is valid for `text`, otherwise a short reason. */
export function textAnchorProblem(anchor: ReportTextAnchor, text: string): string | null {
  const { start, end, quote, prefix, suffix } = anchor;
  if (![start, end].every(value => Number.isSafeInteger(value) && value >= 0)) return 'offset';
  if (start >= end || end > text.length) return 'range';
  if (end - start > COMMENT_LIMITS.quote) return 'quote-length';
  if (splitsSurrogate(text, start) || splitsSurrogate(text, end)) return 'surrogate';
  if (text.slice(start, end) !== quote) return 'quote';
  if (prefix.length > COMMENT_LIMITS.context || suffix.length > COMMENT_LIMITS.context)
    return 'context-length';
  if (prefix.length > start || text.slice(start - prefix.length, start) !== prefix) return 'prefix';
  if (text.slice(end, end + suffix.length) !== suffix) return 'suffix';
  return null;
}

/** Builds the canonical anchor for a selection: up to 32 units of context, never half a pair. */
export function textAnchorAt(text: string, start: number, end: number): ReportTextAnchor {
  let from = Math.max(0, start - COMMENT_LIMITS.context);
  if (splitsSurrogate(text, from)) from += 1;
  let to = Math.min(text.length, end + COMMENT_LIMITS.context);
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

/** Finds a text anchor in another version's or a draft's text. */
export function locate(anchor: ReportTextAnchor, text: string): AnchorLocation {
  const { start, end, quote, prefix, suffix } = anchor;
  if (!quote) return { status: 'detached' };
  if (end - start === quote.length && text.slice(start, end) === quote)
    return { status: 'exact', start, end };
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

export function locateImage(blockId: string, blocks: readonly Block[] | null | undefined) {
  return (blocks ?? []).some(block => block.kind === 'IMAGE' && block.id === blockId)
    ? ({ status: 'exact' } as AnchorLocation)
    : ({ status: 'detached' } as AnchorLocation);
}

/** Location of any anchor in a version (`text` must be documentText of the same version). */
export function locateAnchor(
  anchor: ReportAnchor,
  text: string,
  blocks: readonly Block[] | null | undefined,
): AnchorLocation {
  if (anchor.kind === 'whole') return { status: 'exact' };
  if (anchor.kind === 'image') return locateImage(anchor.blockId, blocks);
  return locate(anchor, text);
}

/** Document length after replacing the anchored range, in UTF-16 units. */
export const appliedLength = (text: string, anchor: ReportTextAnchor, replacement: string) =>
  text.length - (anchor.end - anchor.start) + replacement.length;
