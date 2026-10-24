// `ai` ships as ESM only, which Jest does not load; the gateway's own logic is what is under test.
jest.mock('ai', () => {
  class APICallError extends Error {
    statusCode?: number;
    static isInstance(error: unknown) {
      return error instanceof APICallError;
    }
  }
  class NoObjectGeneratedError extends Error {
    text?: string;
    usage?: unknown;
    static isInstance(error: unknown) {
      return error instanceof NoObjectGeneratedError;
    }
  }
  return {
    generateText: jest.fn(),
    Output: { json: jest.fn(() => ({ kind: 'json' })) },
    APICallError,
    NoObjectGeneratedError,
  };
});
jest.mock('@ai-sdk/anthropic', () => ({ createAnthropic: jest.fn() }));
jest.mock('@ai-sdk/openai', () => ({ createOpenAI: jest.fn() }));
jest.mock('@ai-sdk/openai-compatible', () => ({ createOpenAICompatible: jest.fn() }));
import { BadRequestException, HttpException, ServiceUnavailableException } from '@nestjs/common';
import { APICallError, NoObjectGeneratedError, Output, generateText } from 'ai';
import { DataSource } from 'typeorm';
import { AiQuotaService } from '../usage/ai-quota.service';
import { AiUsageLedger } from '../usage/entities/ai-usage-ledger.entity';
import { UserQuota } from '../usage/entities/user-quota.entity';
import { User } from '../user/entities/user.entity';
import { LlmGateway, llmTimeoutMs } from './llm-gateway.service';

const generate = generateText as unknown as jest.Mock;
const ENV_KEYS = [
  'AI_PROVIDER',
  'AI_API_KEY',
  'AI_API_BASE_URL',
  'AI_MODEL',
  'AI_REASONING_EFFORT',
  'AI_TIMEOUT_MS',
  'AI_MAX_INPUT_TOKENS',
  'AI_GLOBAL_MONTHLY_TOKENS',
  'QUOTA_DAILY_CALLS',
  'QUOTA_MONTHLY_TOKENS',
] as const;

describe('LlmGateway (real SQLite ledger, mocked model call)', () => {
  let db: DataSource;
  let quota: AiQuotaService;
  let gateway: LlmGateway;
  let user: number;
  const saved = Object.fromEntries(ENV_KEYS.map(key => [key, process.env[key]]));

  beforeAll(async () => {
    db = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      synchronize: true,
      entities: [User, AiUsageLedger, UserQuota],
    }).initialize();
    quota = new AiQuotaService(db);
  });
  afterAll(async () => {
    await db.destroy();
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });
  beforeEach(async () => {
    for (const key of ENV_KEYS) delete process.env[key];
    process.env.AI_PROVIDER = 'openai';
    process.env.AI_API_KEY = 'test-key-not-real';
    process.env.QUOTA_DAILY_CALLS = '100';
    process.env.QUOTA_MONTHLY_TOKENS = '10000000';
    generate.mockReset();
    (Output.json as jest.Mock).mockClear();
    await db.manager.clear(AiUsageLedger);
    await db.manager.clear(UserQuota);
    await db.manager.clear(User);
    user = (await db.getRepository(User).save({ userId: 'g', email: 'g@x.test', password: 'x' }))
      .id;
    gateway = new LlmGateway(quota);
    gateway.modelFor = jest.fn(() => 'mock-model' as never);
  });

  const caller = () => ({ userId: user, epoch: 0, feature: 'studio-creation' });
  const ask = (extra: Record<string, unknown> = {}) =>
    gateway.generate({ system: 'sys', prompt: 'hello', caller: caller(), ...extra });
  /** Resolves once the model has been called `n` times, i.e. every earlier call has reserved its slot. */
  const calls = async (n: number) => {
    for (let i = 0; i < 400 && generate.mock.calls.length < n; i++)
      await new Promise(resolve => setTimeout(resolve, 10));
    expect(generate.mock.calls.length).toBe(n);
  };
  const rows = () => db.getRepository(AiUsageLedger).find({ order: { id: 'ASC' } });
  const answer = (text: string, usage: unknown = { inputTokens: 120, outputTokens: 30 }) =>
    generate.mockResolvedValue({ text, usage });

  it('answers, takes one slot and settles the ledger row with the provider, model and real tokens', async () => {
    answer('hi there');
    expect(await ask()).toBe('hi there');
    const all = await rows();
    expect(all).toHaveLength(1);
    const [row] = all;
    expect(row).toMatchObject({
      userId: user,
      feature: 'studio-creation',
      status: 'ok',
      provider: 'openai',
      model: 'gpt-4o-mini',
      inputTokens: 120,
      outputTokens: 30,
      usageEstimated: false,
    });
    expect(row.latencyMs).toBeGreaterThanOrEqual(0);
    expect(row.requestId).toMatch(/^ai_[0-9a-f]{32}$/);
    expect(generate.mock.calls[0][0]).toMatchObject({
      system: 'sys',
      prompt: 'hello',
      temperature: 0,
      maxRetries: 0,
      maxOutputTokens: 2048,
    });
  });

  it('mints a new ledger id for every call, so a repeated user action never collides', async () => {
    answer('a');
    await ask();
    await ask();
    const ids = (await rows()).map(row => row.requestId);
    expect(new Set(ids).size).toBe(2);
  });

  it('estimates tokens when the provider reports none, and says so in the ledger', async () => {
    answer('x'.repeat(40), { inputTokens: undefined, outputTokens: undefined });
    await ask();
    expect((await rows())[0]).toMatchObject({
      status: 'ok',
      inputTokens: 3, // ceil(len('sys') / 4) + ceil(len('hello') / 4)
      outputTokens: 10,
      usageEstimated: true,
    });
  });

  it('is not configured without a key: no model call, no ledger row', async () => {
    delete process.env.AI_API_KEY;
    await expect(ask()).rejects.toThrow('AI_NOT_CONFIGURED');
    expect(generate).not.toHaveBeenCalled();
    expect(await rows()).toHaveLength(0);
  });

  it('refuses a user over the daily limit with 429 and never calls the model', async () => {
    process.env.QUOTA_DAILY_CALLS = '1';
    answer('one');
    await ask();
    await expect(ask()).rejects.toMatchObject({ status: 429 });
    expect(generate).toHaveBeenCalledTimes(1);
    expect((await rows()).map(row => row.status)).toEqual(['ok', 'quota_denied']);
  });

  it('counts an in-flight call toward the month at once, so concurrent calls cannot all slip under it', async () => {
    process.env.QUOTA_MONTHLY_TOKENS = '5000';
    // Each reservation is ~2050 tokens (input estimate + the 2048-token output ceiling).
    const releases: Array<(value: unknown) => void> = [];
    generate.mockImplementation(() => new Promise(resolve => releases.push(resolve)));
    const pending = [ask(), ask(), ask()];
    await calls(3);
    await expect(ask()).rejects.toMatchObject({
      status: 429,
      response: expect.objectContaining({ reason: 'monthly_tokens' }),
    });
    expect(generate).toHaveBeenCalledTimes(3);
    for (const release of releases)
      release({ text: 'done', usage: { inputTokens: 5, outputTokens: 5 } });
    await Promise.allSettled(pending);
  });

  it('stops every call with 503 once the server-wide monthly ceiling is spent, without using a user slot', async () => {
    process.env.AI_GLOBAL_MONTHLY_TOKENS = '1000';
    answer('first', { inputTokens: 600, outputTokens: 500 });
    await ask();
    const error = await ask().catch(e => e);
    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect(error.getResponse()).toMatchObject({ error: 'AI_BUDGET_EXHAUSTED' });
    expect(generate).toHaveBeenCalledTimes(1);
    // No second row, in particular no `quota_denied` row: the user did nothing wrong.
    expect((await rows()).map(row => row.status)).toEqual(['ok']);
  });

  it('has no ceiling without AI_GLOBAL_MONTHLY_TOKENS', async () => {
    answer('x', { inputTokens: 9_000_000, outputTokens: 0 });
    await ask();
    await ask();
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it('records a provider failure as an error and throws a stable code', async () => {
    const failure = Object.assign(new (APICallError as any)('upstream'), { statusCode: 503 });
    generate.mockRejectedValue(failure);
    await expect(ask()).rejects.toThrow('LLM_API_ERROR_503');
    expect((await rows())[0]).toMatchObject({
      status: 'error',
      provider: 'openai',
      usageEstimated: true,
    });
  });

  it('times out on its own clock: an error row, LLM_TIMEOUT, and the model call is aborted', async () => {
    process.env.AI_TIMEOUT_MS = '30';
    let signal: AbortSignal | undefined;
    generate.mockImplementation(
      ({ abortSignal }) =>
        new Promise((_, reject) => {
          signal = abortSignal;
          abortSignal.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );
    await expect(ask()).rejects.toThrow('LLM_TIMEOUT');
    expect(signal?.aborted).toBe(true);
    expect((await rows())[0].status).toBe('error');
  });

  it('records the caller giving up as cancelled, and rethrows what the call threw', async () => {
    const controller = new AbortController();
    generate.mockImplementation(
      ({ abortSignal }) =>
        new Promise((_, reject) => {
          abortSignal.addEventListener('abort', () => reject(new Error('AbortError')));
          setTimeout(() => controller.abort(), 10);
        }),
    );
    await expect(ask({ abortSignal: controller.signal })).rejects.toThrow('AbortError');
    expect((await rows())[0].status).toBe('cancelled');
  });

  it('caps AI_TIMEOUT_MS at 180 s and defaults to 120 s', () => {
    expect(llmTimeoutMs({})).toBe(120_000);
    expect(llmTimeoutMs({ AI_TIMEOUT_MS: '999999' } as any)).toBe(180_000);
    expect(llmTimeoutMs({ AI_TIMEOUT_MS: '5000' } as any)).toBe(5000);
    expect(llmTimeoutMs({ AI_TIMEOUT_MS: 'nope' } as any)).toBe(120_000);
  });

  it('returns JSON from a fenced answer, and the text as it is when it is not JSON (the call site decides), with the tokens kept', async () => {
    answer('```json\n{"a": 1}\n```');
    expect(await ask({ jsonMode: true })).toBe('{"a": 1}');
    expect(generate.mock.calls[0][0].maxOutputTokens).toBe(4096);
    answer('  not json at all  ');
    expect(await ask({ jsonMode: true })).toBe('not json at all');
    const statuses = (await rows()).map(row => row.status);
    expect(statuses).toEqual(['ok', 'ok']);
  });

  it('treats a JSON-format answer the SDK rejects as a successful call: it keeps the tokens and salvages the JSON', async () => {
    const rejected = (text: string) =>
      Object.assign(new (NoObjectGeneratedError as any)('no object'), {
        text,
        usage: { inputTokens: 100, outputTokens: 900 },
      });
    generate.mockRejectedValueOnce(rejected('Sure:\n```json\n{"a": 2}\n```'));
    expect(await ask({ jsonMode: true })).toBe('{"a": 2}');
    generate.mockRejectedValueOnce(rejected('no json here, sorry'));
    expect(await ask({ jsonMode: true })).toBe('no json here, sorry');
    expect(
      (await rows()).map(row => [
        row.status,
        row.inputTokens,
        row.outputTokens,
        row.usageEstimated,
      ]),
    ).toEqual([
      ['ok', 100, 900, false],
      ['ok', 100, 900, false],
    ]);
  });

  it('charges a call’s estimate to the server-wide ceiling when it starts, then swaps in the real tokens', async () => {
    process.env.AI_GLOBAL_MONTHLY_TOKENS = '3000';
    const releases: Array<(value: unknown) => void> = [];
    generate.mockImplementation(() => new Promise(resolve => releases.push(resolve)));
    const first = ask();
    await calls(1);
    const second = ask();
    await calls(2);
    // Two reservations of ~2051 are in flight: the ceiling is passed before either has finished.
    await expect(ask()).rejects.toMatchObject({ response: { error: 'AI_BUDGET_EXHAUSTED' } });
    for (const release of releases)
      release({ text: 'ok', usage: { inputTokens: 5, outputTokens: 5 } });
    await Promise.all([first, second]);
    // Their real use (10 tokens each) replaced the estimates, so the next call is allowed again.
    generate.mockReset();
    answer('fine');
    expect(await ask()).toBe('fine');
  });

  it('asks for a JSON response format only from providers that have one', async () => {
    answer('{}');
    await ask({ jsonMode: true });
    expect(generate.mock.calls[0][0].output).toEqual({ kind: 'json' });
    process.env.AI_PROVIDER = 'anthropic';
    process.env.AI_MODEL = 'claude-test';
    await ask({ jsonMode: true });
    expect(generate.mock.calls[1][0].output).toBeUndefined();
  });

  it('passes the reasoning effort under the provider’s own option key', async () => {
    answer('x');
    process.env.AI_REASONING_EFFORT = 'low';
    await ask();
    expect(generate.mock.calls[0][0].providerOptions).toEqual({
      openai: { reasoningEffort: 'low' },
    });
    process.env.AI_API_BASE_URL = 'https://llm.example.test/v1';
    await ask();
    expect(generate.mock.calls[1][0].providerOptions).toEqual({
      openaiCompatible: { reasoningEffort: 'low' },
    });
  });

  it('refuses an oversized input before reserving anything', async () => {
    process.env.AI_MAX_INPUT_TOKENS = '10';
    await expect(ask({ prompt: 'x'.repeat(200) })).rejects.toBeInstanceOf(BadRequestException);
    expect(generate).not.toHaveBeenCalled();
    expect(await rows()).toHaveLength(0);
  });

  it('does not let a ledger failure replace the answer', async () => {
    answer('still here');
    jest.spyOn(quota, 'record').mockRejectedValueOnce(new Error('ledger down'));
    expect(await ask()).toBe('still here');
  });

  it('settles calls left reserved by a crash as errors when it starts, and keeps their estimate', async () => {
    await quota.reserve(user, 0, 'studio-run', 'orphan-1', new Date('2026-01-01T00:00:00Z'), {
      inputTokens: 10,
      outputTokens: 20,
    });
    await gateway.onModuleInit();
    expect((await rows())[0]).toMatchObject({ status: 'error', inputTokens: 10, outputTokens: 20 });
  });

  it('exposes no HttpException for the plain not-configured error, which callers already map', async () => {
    delete process.env.AI_API_KEY;
    const error = await ask().catch(e => e);
    expect(error).not.toBeInstanceOf(HttpException);
    expect(error.message).toBe('AI_NOT_CONFIGURED');
  });
});
