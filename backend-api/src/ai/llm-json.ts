/**
 * Models answer JSON requests in different shapes: OpenAI honours a JSON response format, Anthropic has
 * none and often wraps the object in a code fence. Every caller that asked for JSON gets the bare text
 * of one JSON value, or `LLM_INVALID_JSON`.
 */
export function normalizeJsonText(raw: string): string {
  let text = (raw ?? '').trim();
  const fenced = /^```[A-Za-z0-9_-]*\s*\n?([\s\S]*?)\n?```$/.exec(text);
  if (fenced) text = fenced[1].trim();
  try {
    JSON.parse(text);
  } catch {
    throw new Error('LLM_INVALID_JSON');
  }
  return text;
}

/** Rough token count (characters / 4) for a missing `usage` or a pre-call reservation. */
export const estimateTokens = (text: string): number => Math.ceil((text ?? '').length / 4);
