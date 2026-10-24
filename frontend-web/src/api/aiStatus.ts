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

/** "OpenAI · gpt-4o-mini", "AI 미설정", or just "AI" while it is not known. */
export function aiStatusLabel(status: AiStatus | null | undefined): string {
  if (!status) return 'AI';
  if (!status.configured) return 'AI 미설정';
  const provider = status.provider ? PROVIDER_NAMES[status.provider] ?? status.provider : 'AI';
  return status.model ? `${provider} · ${status.model}` : provider;
}

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
      // The request could not even be made: the label stays the plain "AI".
      cached = undefined;
      return Promise.resolve(null);
    }
  }
  return cached;
}

export const resetAiStatusCache = () => {
  cached = undefined;
};
