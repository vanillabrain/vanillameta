// The provider packages are mocked to see how the registry builds each model.
jest.mock('@ai-sdk/anthropic', () => ({ createAnthropic: jest.fn() }));
jest.mock('@ai-sdk/openai', () => ({ createOpenAI: jest.fn() }));
jest.mock('@ai-sdk/openai-compatible', () => ({ createOpenAICompatible: jest.fn() }));
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { productionConfigProblems } from '../config/production-guard';
import {
  OPENAI_BASE_URL,
  aiConfigProblems,
  aiProviderConfig,
  aiStatus,
  governanceAssistantEnabled,
  isAiConfigured,
  resolveLanguageModel,
} from './providers/provider-registry';

const env = (values: Record<string, string>) => values as NodeJS.ProcessEnv;

describe('aiProviderConfig', () => {
  it('is not configured without a key, or with nothing set', () => {
    expect(aiProviderConfig(env({}))).toBeNull();
    expect(aiProviderConfig(env({ AI_PROVIDER: 'openai', AI_API_KEY: '  ' }))).toBeNull();
    expect(aiProviderConfig(env({ AI_PROVIDER: 'anthropic' }))).toBeNull();
    expect(isAiConfigured(env({}))).toBe(false);
  });

  it('treats a key alone as an OpenAI-style API, as it was before the registry', () => {
    expect(aiProviderConfig(env({ AI_API_KEY: 'k' }))).toEqual({
      provider: 'openai',
      model: 'gpt-4o-mini',
      apiKey: 'k',
      reasoningEffort: undefined,
    });
  });

  it('resolves openai with another base URL to openai-compatible, keeping model and effort', () => {
    expect(
      aiProviderConfig(
        env({
          AI_PROVIDER: 'openai',
          AI_API_KEY: 'k',
          AI_API_BASE_URL: 'https://llm.example.test/v1/',
          AI_MODEL: 'local-model',
          AI_REASONING_EFFORT: 'low',
        }),
      ),
    ).toEqual({
      provider: 'openai-compatible',
      model: 'local-model',
      apiKey: 'k',
      baseUrl: 'https://llm.example.test/v1',
      reasoningEffort: 'low',
    });
    expect(
      aiProviderConfig(
        env({ AI_PROVIDER: 'openai', AI_API_KEY: 'k', AI_API_BASE_URL: OPENAI_BASE_URL }),
      )?.provider,
    ).toBe('openai');
  });

  it('requires an explicit model for anthropic and a URL plus model for openai-compatible', () => {
    expect(() => aiProviderConfig(env({ AI_PROVIDER: 'anthropic', AI_API_KEY: 'k' }))).toThrow(
      'AI_MODEL is required for AI_PROVIDER=anthropic',
    );
    expect(() =>
      aiProviderConfig(env({ AI_PROVIDER: 'openai-compatible', AI_API_KEY: 'k', AI_MODEL: 'm' })),
    ).toThrow('AI_API_BASE_URL is required');
    expect(() =>
      aiProviderConfig(
        env({
          AI_PROVIDER: 'openai-compatible',
          AI_API_KEY: 'k',
          AI_API_BASE_URL: 'https://x.test',
        }),
      ),
    ).toThrow('AI_MODEL is required');
  });

  it('refuses a reasoning effort for anthropic instead of ignoring it', () => {
    expect(() =>
      aiProviderConfig(
        env({
          AI_PROVIDER: 'anthropic',
          AI_API_KEY: 'k',
          AI_MODEL: 'claude-x',
          AI_REASONING_EFFORT: 'low',
        }),
      ),
    ).toThrow('not supported for AI_PROVIDER=anthropic');
  });

  it('rejects an unknown provider and a malformed base URL; never substitutes a model', () => {
    expect(() => aiProviderConfig(env({ AI_PROVIDER: 'gemini', AI_API_KEY: 'k' }))).toThrow(
      'AI_PROVIDER must be one of anthropic, openai, openai-compatible, codex',
    );
    for (const url of ['not a url', 'ftp://x.test', 'https://user:pw@x.test'])
      expect(() =>
        aiProviderConfig(env({ AI_PROVIDER: 'openai', AI_API_KEY: 'k', AI_API_BASE_URL: url })),
      ).toThrow('AI_API_BASE_URL');
    expect(isAiConfigured(env({ AI_PROVIDER: 'gemini', AI_API_KEY: 'k' }))).toBe(false);
  });

  it('knows the local Codex provider needs no key', () => {
    expect(aiProviderConfig(env({ AI_PROVIDER: 'codex' }))).toEqual({
      provider: 'codex',
      model: 'gpt-6-luna',
    });
  });
});

describe('aiConfigProblems and the production boot check', () => {
  const prod = {
    NODE_ENV: 'prod',
    ACCESS_SECRET: 'a'.repeat(40),
    REFRESH_SECRET: 'b'.repeat(40),
    JWT_ACCESS_SECRET: 'c'.repeat(40),
    URL_ACCESS_SECRET: 'd'.repeat(40),
    CONFIG_SECRET_KEY: 'e'.repeat(40),
    CORS_ORIGIN: 'https://app.example.test',
  };

  it('asks for the spend ceiling only when AI is configured', () => {
    expect(aiConfigProblems(env({}))).toEqual([]);
    expect(aiConfigProblems(env({ AI_PROVIDER: 'openai', AI_API_KEY: 'k' }))).toEqual([
      expect.stringContaining('AI_GLOBAL_MONTHLY_TOKENS'),
    ]);
    expect(
      aiConfigProblems(
        env({ AI_PROVIDER: 'openai', AI_API_KEY: 'k', AI_GLOBAL_MONTHLY_TOKENS: '9' }),
      ),
    ).toEqual([]);
  });

  it('reports a wrong configuration', () => {
    expect(aiConfigProblems(env({ AI_PROVIDER: 'gemini', AI_API_KEY: 'k' }))).toEqual([
      expect.stringContaining('AI_PROVIDER must be one of'),
    ]);
  });

  it('stops a production boot on those problems and accepts a keyless or complete setup', () => {
    expect(productionConfigProblems({ ...prod, AI_PROVIDER: 'openai' } as any)).toEqual([]);
    expect(
      productionConfigProblems({ ...prod, AI_PROVIDER: 'openai', AI_API_KEY: 'k' } as any),
    ).toEqual([expect.stringContaining('AI_GLOBAL_MONTHLY_TOKENS')]);
    expect(
      productionConfigProblems({
        ...prod,
        AI_PROVIDER: 'openai',
        AI_API_KEY: 'k',
        AI_GLOBAL_MONTHLY_TOKENS: '1000000',
      } as any),
    ).toEqual([]);
  });
});

describe('resolveLanguageModel', () => {
  const sentinel = (kind: string) => ({ kind });
  beforeEach(() => {
    (createAnthropic as jest.Mock).mockReset().mockReturnValue(() => sentinel('anthropic'));
    (createOpenAI as jest.Mock).mockReset().mockReturnValue({
      chat: () => sentinel('openai-chat'),
      responses: () => sentinel('responses'),
    });
    (createOpenAICompatible as jest.Mock)
      .mockReset()
      .mockReturnValue({ chatModel: () => sentinel('compatible-chat') });
  });

  it('uses chat/completions for openai, never the Responses API', () => {
    expect(resolveLanguageModel({ provider: 'openai', model: 'm', apiKey: 'k' })).toEqual({
      kind: 'openai-chat',
    });
    // The base URL is always passed: the SDK would otherwise read OPENAI_BASE_URL from the environment.
    expect(createOpenAI).toHaveBeenCalledWith({
      apiKey: 'k',
      baseURL: 'https://api.openai.com/v1',
    });
  });

  it('builds a compatible provider with usage reporting for any other base URL', () => {
    resolveLanguageModel({
      provider: 'openai-compatible',
      model: 'm',
      apiKey: 'k',
      baseUrl: 'https://llm.example.test/v1',
    });
    expect(createOpenAICompatible).toHaveBeenCalledWith({
      name: 'openai-compatible',
      baseURL: 'https://llm.example.test/v1',
      apiKey: 'k',
      includeUsage: true,
    });
  });

  it('builds anthropic with its key', () => {
    expect(resolveLanguageModel({ provider: 'anthropic', model: 'claude-x', apiKey: 'k' })).toEqual(
      {
        kind: 'anthropic',
      },
    );
    expect(createAnthropic).toHaveBeenCalledWith({
      apiKey: 'k',
      baseURL: 'https://api.anthropic.com/v1',
    });
  });
});

describe('the ceiling in the boot check', () => {
  it('rejects a malformed AI_GLOBAL_MONTHLY_TOKENS instead of failing every call later', () => {
    for (const value of ['1e6', '100k', '0', '-5'])
      expect(
        aiConfigProblems(
          env({ AI_PROVIDER: 'openai', AI_API_KEY: 'k', AI_GLOBAL_MONTHLY_TOKENS: value }),
        ),
      ).toEqual(['AI_GLOBAL_MONTHLY_TOKENS must be a positive integer']);
  });
});

describe('what a screen may be told about the AI', () => {
  it('reports the configured provider and model, never a secret', () => {
    expect(aiStatus({ AI_API_KEY: 'k', AI_MODEL: 'gpt-x' } as any)).toEqual({
      configured: true,
      provider: 'openai',
      model: 'gpt-x',
    });
    expect(JSON.stringify(aiStatus({ AI_API_KEY: 'sk-secret' } as any))).not.toContain('sk-secret');
  });

  it('says not configured for no setup and for a broken one, without throwing', () => {
    const none = { configured: false, provider: null, model: null };
    expect(aiStatus({} as any)).toEqual(none);
    expect(aiStatus({ AI_PROVIDER: 'api', AI_API_KEY: 'k' } as any)).toEqual(none);
  });

  it('keeps the governed-dashboard assistant off unless the operator says true', () => {
    expect(governanceAssistantEnabled({} as any)).toBe(false);
    expect(governanceAssistantEnabled({ GOVERNANCE_AI_ENABLED: 'yes' } as any)).toBe(false);
    expect(governanceAssistantEnabled({ GOVERNANCE_AI_ENABLED: 'true' } as any)).toBe(true);
  });
});
