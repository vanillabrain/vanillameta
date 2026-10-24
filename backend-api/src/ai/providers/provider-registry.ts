import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModel } from 'ai';
import { codexSdkModel } from '../codex-sdk-model';
import { AiProviderConfig, OPENAI_BASE_URL } from './ai-config';

export * from './ai-config';

const ANTHROPIC_BASE_URL = 'https://api.anthropic.com/v1';

/** The AI SDK model for a configuration. `jsonMode` only matters to the Codex adapter. */
export function resolveLanguageModel(config: AiProviderConfig, jsonMode = false): LanguageModel {
  switch (config.provider) {
    case 'codex':
      return codexSdkModel(jsonMode);
    case 'anthropic':
      return; // The SDKs read ANTHROPIC_BASE_URL / OPENAI_BASE_URL from the environment when none is given, which
      // could send the operator's key to a host nobody configured here: always pass one.
      createAnthropic({ apiKey: config.apiKey, baseURL: config.baseUrl ?? ANTHROPIC_BASE_URL })(
        config.model,
      );
    case 'openai-compatible':
      return createOpenAICompatible({
        name: 'openai-compatible',
        baseURL: config.baseUrl as string,
        apiKey: config.apiKey,
        includeUsage: true,
      }).chatModel(config.model);
    default:
      // `.chat()`, not the default call: the plain call uses the Responses API, and this has always
      // been chat/completions.
      return createOpenAI({ apiKey: config.apiKey, baseURL: OPENAI_BASE_URL }).chat(config.model);
  }
}
