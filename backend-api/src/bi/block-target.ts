/**
 * UC-015: bounded, deterministic resolution of the block one question refers to.
 *
 * Pure by design: it reads only the question, the current validated items and the
 * already validated selection/confirmation keys. Titles arrive from the client, so
 * they are matched with indexOf and never compiled into a regular expression.
 *
 * Supported references are exactly the documented ones: a 1-based `2번 차트/블록`
 * or `2번째 차트/블록` number, and an exact block title directly followed by
 * `차트/블록/의` (or a quoted exact title followed by `차트/블록`). Anything else
 * is either a clarification or the current selection context, never a guess.
 */
export type BlockTargetItem = { key: string; title: string };
export type BlockTargetCandidate = { key: string; title: string; position: number };
export type BlockTargetReason = 'unknown-reference' | 'multiple-references' | 'no-selection';
export type BlockTargetResolution =
  | { kind: 'resolved'; key: string }
  | { kind: 'ambiguous'; reason: BlockTargetReason; candidates: BlockTargetCandidate[] };

export const MAX_TARGET_CANDIDATES = 6;

/** `2번 차트`, `2번째 블록`: the number is the 1-based position in the current order. */
const NUMERIC_REFERENCE = /(\d+)\s*(?:번째|번)\s*(?:차트|블록)/g;
/**
 * Bounded list of ordinal words that read like a block reference but are not
 * supported (`두 번째 차트`, `첫번째 블록`, `마지막 차트`). They clarify instead
 * of falling back to a stale selection. This is a word list, not a parser.
 */
const UNSUPPORTED_ORDINAL =
  /(?:첫|두|둘|세|셋|네|넷|다섯|여섯|일곱|여덟|아홉|열|마지막)(?:째)?\s*(?:번째|번)?\s*(?:차트|블록)/g;
/** An exact title counts only with a block marker directly after it. */
const TITLE_MARKER = /^[ \t]*(?:차트|블록|의)/;
/** A quoted title needs its own marker; the quotes of a new title never select. */
const QUOTED_TITLE_MARKER = /^[ \t]*(?:차트|블록)/;
const QUOTE_PAIRS: Record<string, string> = { '"': '"', "'": "'", '“': '”', '‘': '’' };
const WORD_CHAR = /[0-9A-Za-z_가-힣]/;
type QuotedSpan = { start: number; end: number; text: string };

function titleOf(item: BlockTargetItem): string {
  return item && typeof item.title === 'string' ? item.title.trim() : '';
}

function candidatesOf(items: BlockTargetItem[]): BlockTargetCandidate[] {
  return items
    .slice(0, MAX_TARGET_CANDIDATES)
    .map((item, index) => ({ key: item.key, title: titleOf(item), position: index + 1 }));
}

function candidatesFor(items: BlockTargetItem[], keys: string[]): BlockTargetCandidate[] {
  const wanted = new Set(keys);
  return candidatesOf(items).filter(candidate => wanted.has(candidate.key));
}

/** A reference starts its own token: a title or number inside a longer word never counts. */
function isReferenceStart(prompt: string, index: number): boolean {
  if (index === 0) return true;
  return !WORD_CHAR.test(prompt.charAt(index - 1));
}

/**
 * `-1번`, `- 2번` and `1.5번` read as a reference but carry no valid position, so
 * they clarify instead of resolving to a position or falling back to the selection.
 */
function hasSignedPrefix(prompt: string, index: number): boolean {
  return /[.+-]$/.test(prompt.slice(0, index).replace(/[ \t]+$/, ''));
}

function referenceNumbers(prompt: string): { position: number; index: number }[] {
  const source = new RegExp(NUMERIC_REFERENCE.source, 'g');
  const found: { position: number; index: number }[] = [];
  let match = source.exec(prompt);
  while (match) {
    found.push({ position: Number(match[1]), index: match.index });
    match = source.exec(prompt);
  }
  return found;
}

/** A reference written inside quotes is the text of a new title, not a block reference. */
function insideQuote(spans: QuotedSpan[], index: number): boolean {
  return spans.some(span => index >= span.start && index < span.end);
}

function hasUnsupportedOrdinal(prompt: string, spans: QuotedSpan[]): boolean {
  const source = new RegExp(UNSUPPORTED_ORDINAL.source, 'g');
  let match = source.exec(prompt);
  while (match) {
    if (!insideQuote(spans, match.index) && isReferenceStart(prompt, match.index)) return true;
    match = source.exec(prompt);
  }
  return false;
}

/** Inner text of every quoted span, so a quoted new title is never read as a reference. */
function quotedSpans(prompt: string): QuotedSpan[] {
  const spans: QuotedSpan[] = [];
  let index = 0;
  while (index < prompt.length) {
    const closing = QUOTE_PAIRS[prompt.charAt(index)];
    if (!closing) {
      index += 1;
      continue;
    }
    const end = prompt.indexOf(closing, index + 1);
    if (end < 0) break;
    spans.push({ start: index + 1, end, text: prompt.slice(index + 1, end) });
    index = end + 1;
  }
  return spans;
}

export function resolveBlockTarget(input: {
  prompt: string;
  items: BlockTargetItem[];
  selectedKey?: string | null;
  targetChoiceKey?: string | null;
}): BlockTargetResolution {
  const prompt = typeof input.prompt === 'string' ? input.prompt : '';
  const items = (Array.isArray(input.items) ? input.items : []).filter(
    item => item && typeof item.key === 'string' && item.key.length > 0,
  );
  const spans = quotedSpans(prompt);
  const referenced: string[] = [];
  // A new-title clause can contain another block's name/number as the new value.
  // Require confirmation instead of interpreting that value as a different target.
  const inNewTitleClause = (at: number) => /제목\s*(?:을|은)/.test(prompt.slice(0, at));
  let unknown = hasUnsupportedOrdinal(prompt, spans);

  for (const reference of referenceNumbers(prompt)) {
    if (insideQuote(spans, reference.index)) continue;
    if (inNewTitleClause(reference.index) || hasSignedPrefix(prompt, reference.index)) {
      unknown = true;
      continue;
    }
    if (!isReferenceStart(prompt, reference.index)) continue;
    if (reference.position >= 1 && reference.position <= items.length)
      referenced.push(items[reference.position - 1].key);
    else unknown = true;
  }

  for (const span of spans) {
    if (!QUOTED_TITLE_MARKER.test(prompt.slice(span.end + 1))) continue;
    if (inNewTitleClause(span.start)) {
      unknown = true;
      continue;
    }
    const title = span.text.trim();
    const matched = title ? items.filter(item => titleOf(item) === title) : [];
    if (!matched.length) {
      unknown = true;
      continue;
    }
    matched.forEach(item => referenced.push(item.key));
  }

  for (const item of items) {
    const title = titleOf(item);
    if (!title) continue;
    let from = 0;
    for (;;) {
      const at = prompt.indexOf(title, from);
      if (at < 0) break;
      if (
        !insideQuote(spans, at) &&
        isReferenceStart(prompt, at) &&
        TITLE_MARKER.test(prompt.slice(at + title.length))
      ) {
        if (inNewTitleClause(at)) unknown = true;
        else referenced.push(item.key);
        break;
      }
      from = at + 1;
    }
  }

  // A named-but-unmatched block must not quietly reuse an earlier selection.
  // Context-only forms stay supported; quoted new titles are never references.
  if (!referenced.length && !unknown) {
    for (const match of prompt.matchAll(/차트|블록/g)) {
      if (insideQuote(spans, match.index)) continue;
      const before = prompt.slice(0, match.index).trimEnd();
      if (!/(?:^|\s)(?:선택한|현재|이|해당)$/.test(before)) {
        unknown = true;
        break;
      }
    }
  }

  const unique = [...new Set(referenced)];
  if (unique.length === 1 && !unknown) return { kind: 'resolved', key: unique[0] };
  if (unique.length > 0 || unknown)
    return withConfirmation(
      {
        kind: 'ambiguous',
        reason: unknown ? 'unknown-reference' : 'multiple-references',
        candidates: unknown ? candidatesOf(items) : candidatesFor(items, unique),
      },
      input.targetChoiceKey,
    );
  const selection = typeof input.selectedKey === 'string' ? input.selectedKey : '';
  if (selection && items.some(item => item.key === selection))
    return { kind: 'resolved', key: selection };
  return withConfirmation(
    { kind: 'ambiguous', reason: 'no-selection', candidates: candidatesOf(items) },
    input.targetChoiceKey,
  );
}

/** The question's own ambiguous candidates are the only set a confirmation may pick from. */
function withConfirmation(
  resolution: BlockTargetResolution,
  targetChoiceKey: unknown,
): BlockTargetResolution {
  if (resolution.kind !== 'ambiguous') return resolution;
  const choice = typeof targetChoiceKey === 'string' ? targetChoiceKey : '';
  if (!choice || !resolution.candidates.some(candidate => candidate.key === choice))
    return resolution;
  return { kind: 'resolved', key: choice };
}
