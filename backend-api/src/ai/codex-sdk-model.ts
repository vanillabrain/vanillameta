import type { LanguageModelV3 } from '@ai-sdk/provider';
import { callCodingAgent, CODEX_MODEL } from './coding-agent';

/** AI SDK provider boundary for the existing logged-in Codex CLI; no model fallback. */
export function codexSdkModel(jsonMode = false): LanguageModelV3 {
  return {
    specificationVersion: 'v3',
    provider: 'codex-cli',
    modelId: CODEX_MODEL,
    supportedUrls: {},
    async doGenerate({ prompt, tools, abortSignal }) {
      if (abortSignal?.aborted) throw new Error('LLM_REQUEST_ABORTED');
      if (tools?.length) throw new Error('LLM_CODEX_TOOLS_UNSUPPORTED');
      const system: string[] = [];
      const messages: string[] = [];
      for (const message of prompt) {
        if (message.role === 'system') system.push(message.content);
        else {
          const parts = message.content;
          if (parts.some(part => part.type !== 'text'))
            throw new Error('LLM_CODEX_CONTENT_UNSUPPORTED');
          messages.push(parts.map(part => (part.type === 'text' ? part.text : '')).join('\n'));
        }
      }
      const text = await callCodingAgent(system.join('\n\n'), messages.join('\n\n'), jsonMode);
      if (abortSignal?.aborted) throw new Error('LLM_REQUEST_ABORTED');
      return {
        content: [{ type: 'text', text }],
        finishReason: { unified: 'stop', raw: undefined },
        usage: {
          inputTokens: {
            total: undefined,
            noCache: undefined,
            cacheRead: undefined,
            cacheWrite: undefined,
          },
          outputTokens: { total: undefined, text: undefined, reasoning: undefined },
        },
        warnings: [],
      };
    },
    async doStream() {
      throw new Error('LLM_CODEX_STREAMING_UNSUPPORTED');
    },
  };
}
