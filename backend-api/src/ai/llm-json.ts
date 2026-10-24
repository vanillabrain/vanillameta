/**
 * Models answer JSON requests in different shapes: OpenAI honours a JSON response format, Anthropic has
 * none and often adds prose or wraps the object in a code fence. Every caller that asked for JSON gets
 * the bare text of one JSON value, or `LLM_INVALID_JSON` from `normalizeJsonText` (the gateway uses
 * `normalizeJsonOrRaw`, which hands unparseable text back to the call site). The text is taken as it is when it parses;
 * otherwise from the first fenced block; otherwise from the first `{` or `[` to the last matching close.
 */
export function normalizeJsonText(raw: string): string {
  const text = (raw ?? '').trim();
  const candidates = [text];
  const fenced = /```[A-Za-z0-9_-]*[ \t]*\r?\n?([\s\S]*?)```/.exec(text);
  if (fenced) candidates.push(fenced[1].trim());
  const open = text.search(/[{[]/);
  if (open >= 0) {
    const close = Math.max(text.lastIndexOf('}'), text.lastIndexOf(']'));
    if (close > open) candidates.push(text.slice(open, close + 1));
  }
  for (const candidate of candidates) {
    try {
      JSON.parse(candidate);
      return candidate;
    } catch {
      // Try the next reading of the answer.
    }
  }
  throw new Error('LLM_INVALID_JSON');
}

/** The same, but text that is not JSON is returned trimmed instead of throwing. */
export function normalizeJsonOrRaw(raw: string): string {
  try {
    return normalizeJsonText(raw);
  } catch {
    return (raw ?? '').trim();
  }
}

/** Rough token count (characters / 4) for a missing `usage` or a pre-call reservation. */
export const estimateTokens = (text: string): number => Math.ceil((text ?? '').length / 4);

/** True when the text is one complete JSON value. */
export function isJson(text: string): boolean {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}
