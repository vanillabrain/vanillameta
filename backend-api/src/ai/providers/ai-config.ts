import { CODEX_MODEL } from '../coding-agent';

export type AiProviderName = 'anthropic' | 'openai' | 'openai-compatible' | 'codex';
const PROVIDERS: AiProviderName[] = ['anthropic', 'openai', 'openai-compatible', 'codex'];
export const OPENAI_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';

export interface AiProviderConfig {
  /** The provider actually used: `openai` with a non-OpenAI base URL resolves to `openai-compatible`. */
  provider: AiProviderName;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  reasoningEffort?: string;
}

const clean = (value: string | undefined) => value?.trim() || undefined;

function validBaseUrl(raw: string, name: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`${name} must be an http(s) URL`);
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
    throw new Error(`${name} must be an http(s) URL without credentials`);
  return raw.replace(/\/+$/, '');
}

/**
 * The model the server is configured to call, or `null` when AI is not configured (no key, and not the
 * local Codex provider). A configuration that is present but wrong throws: there is never a silent
 * substitute model.
 *
 * Without `AI_PROVIDER`, an `AI_API_KEY` alone means an OpenAI-style API, as before this registry.
 */
export function aiProviderConfig(env: NodeJS.ProcessEnv = process.env): AiProviderConfig | null {
  const apiKey = clean(env.AI_API_KEY);
  const requested = clean(env.AI_PROVIDER)?.toLowerCase() ?? (apiKey ? 'openai' : undefined);
  if (!requested) return null;
  if (!PROVIDERS.includes(requested as AiProviderName))
    throw new Error(`AI_PROVIDER must be one of ${PROVIDERS.join(', ')}`);
  const provider = requested as AiProviderName;
  if (provider === 'codex') return { provider, model: CODEX_MODEL };
  if (!apiKey) return null;

  const model = clean(env.AI_MODEL);
  const reasoningEffort = clean(env.AI_REASONING_EFFORT);
  const baseUrl = clean(env.AI_API_BASE_URL)
    ? validBaseUrl(clean(env.AI_API_BASE_URL) as string, 'AI_API_BASE_URL')
    : undefined;

  if (provider === 'anthropic') {
    if (!model) throw new Error('AI_MODEL is required for AI_PROVIDER=anthropic');
    if (reasoningEffort)
      throw new Error('AI_REASONING_EFFORT is not supported for AI_PROVIDER=anthropic');
    return { provider, model, apiKey, baseUrl };
  }
  if (provider === 'openai-compatible') {
    if (!baseUrl) throw new Error('AI_API_BASE_URL is required for AI_PROVIDER=openai-compatible');
    if (!model) throw new Error('AI_MODEL is required for AI_PROVIDER=openai-compatible');
    return { provider, model, apiKey, baseUrl, reasoningEffort };
  }
  // openai: the official endpoint, or any other URL that speaks chat/completions.
  if (baseUrl && baseUrl !== OPENAI_BASE_URL)
    return {
      provider: 'openai-compatible',
      model: model ?? DEFAULT_OPENAI_MODEL,
      apiKey,
      baseUrl,
      reasoningEffort,
    };
  return { provider, model: model ?? DEFAULT_OPENAI_MODEL, apiKey, reasoningEffort };
}

/** True when a model is configured and the configuration is valid. */
export function isAiConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  try {
    return aiProviderConfig(env) !== null;
  } catch {
    return false;
  }
}

/** Problems with the AI settings, as messages for the production boot check. */
export function aiConfigProblems(env: NodeJS.ProcessEnv): string[] {
  try {
    const config = aiProviderConfig(env);
    // AI that is on without a ceiling on total spend is refused; a stack with no key needs none.
    // A malformed ceiling must stop the boot, not make every AI call fail later.
    const ceiling = globalMonthlyTokens(env);
    if (config && ceiling === null)
      return [
        'AI_GLOBAL_MONTHLY_TOKENS must be set when AI is configured (the monthly spend ceiling)',
      ];
    return [];
  } catch (error) {
    return [(error as Error).message];
  }
}

/** The spend ceiling for the whole server this month (tokens), or `null` when none is set. */
export function globalMonthlyTokens(env: NodeJS.ProcessEnv = process.env): number | null {
  const raw = env.AI_GLOBAL_MONTHLY_TOKENS?.trim();
  if (!raw) return null;
  if (!/^[1-9]\d*$/.test(raw) || !Number.isSafeInteger(Number(raw)))
    throw new Error('AI_GLOBAL_MONTHLY_TOKENS must be a positive integer');
  return Number(raw);
}
