import { get } from '@/helpers/apiHelper';

/** What the server says about the AI it calls: whether it works and which model. Never a secret. */
export type AiStatus = { configured: boolean; provider: string | null; model: string | null };

const PROVIDER_NAMES: Record<string, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  'openai-compatible': 'OpenAI 호환',
  codex: 'Codex',
};

/** A reply that is not shaped like a status is "unknown", never "not configured". */
export function validateAiStatus(input: unknown): AiStatus | null {
  const data = (input as { data?: unknown } | null)?.data ?? input;
  const value = data as Partial<AiStatus> | null;
  if (!value || typeof value !== 'object' || typeof value.configured !== 'boolean') return null;
  if (!value.configured) return { configured: false, provider: null, model: null };
  const text = (v: unknown) => (typeof v === 'string' && v.trim() && v.length <= 100 ? v.trim() : null);
  return { configured: true, provider: text(value.provider), model: text(value.model) };
}

/**
 * The noun for the model inside a sentence: "OpenAI · gpt-4o-mini", or plain "AI" while it is not known or
 * not set up (a sentence such as "<label>에 열 이름만 전달합니다" must not name a recipient that does not
 * exist; `aiStatusNote` says the AI is not connected).
 */
export function aiStatusLabel(status: AiStatus | null | undefined): string {
  if (!status || !status.configured) return 'AI';
  const provider = status.provider ? PROVIDER_NAMES[status.provider] ?? status.provider : 'AI';
  return status.model ? `${provider} · ${status.model}` : provider;
}

/** Said next to a request button when the server says no model is set up; empty otherwise. */
export const aiStatusNote = (status: AiStatus | null | undefined): string =>
  status && !status.configured ? ' · AI가 아직 연결되지 않았습니다' : '';

let cached: Promise<AiStatus | null> | undefined;

/** One request per page load, shared by every screen that names the model. */
export function loadAiStatus(force = false): Promise<AiStatus | null> {
  if (!cached || force) {
    try {
      cached = Promise.resolve(get('/ai/status'))
        .then(response => validateAiStatus(response?.data))
        .catch(() => {
          cached = undefined; // try again next time; a failed read is not an answer
          return null;
        });
    } catch {
      // `get` throwing before it returns a promise only happens where apiHelper is mocked without it (other
      // components' tests); in the app a failed read arrives through the promise above. Either way: unknown.
      cached = undefined;
      return Promise.resolve(null);
    }
  }
  return cached;
}

export const resetAiStatusCache = () => {
  cached = undefined;
};
