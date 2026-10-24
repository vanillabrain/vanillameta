import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { APICallError, LanguageModel, NoObjectGeneratedError, Output, generateText } from 'ai';
import { randomUUID } from 'crypto';
import { AiQuotaService } from '../usage/ai-quota.service';
import { estimateTokens, isJson, normalizeJsonOrRaw } from './llm-json';
import { AiProviderConfig, aiProviderConfig, globalMonthlyTokens } from './providers/ai-config';
import { resolveLanguageModel } from './providers/provider-registry';

/** Who a model call is for. `epoch` is the `authVersion` of the verified token, never looked up here. */
export interface AiCaller {
  userId: number;
  epoch: number;
  /** A short stable name for the product feature, e.g. `studio-creation`. Shown to the operator. */
  feature: string;
}

export interface LlmRequest {
  system: string;
  prompt: string;
  /** The caller wants one JSON value back. The text is normalized and checked before it is returned. */
  jsonMode?: boolean;
  caller: AiCaller;
  /** The caller's own cancellation (a closed connection, a cancel button). */
  abortSignal?: AbortSignal;
}

const DEFAULT_TIMEOUT_MS = 120_000;
const MAX_TIMEOUT_MS = 180_000;
const DEFAULT_MAX_INPUT_TOKENS = 60_000;
const JSON_OUTPUT_TOKENS = 4096;
const TEXT_OUTPUT_TOKENS = 2048;
/** Reasoning models spend output tokens on thinking first; without room the visible answer is cut off. */
const REASONING_OUTPUT_TOKENS = 12_288;
const BUDGET_CACHE_MS = 30_000;

const positive = (raw: string | undefined, fallback: number, cap = Infinity) => {
  const value = Number(raw);
  return Number.isSafeInteger(value) && value > 0 ? Math.min(value, cap) : fallback;
};

/** `AI_TIMEOUT_MS` (default 120 s, at most 180 s) for one model call. */
export const llmTimeoutMs = (env: NodeJS.ProcessEnv = process.env) =>
  positive(env.AI_TIMEOUT_MS, DEFAULT_TIMEOUT_MS, MAX_TIMEOUT_MS);

/**
 * The only way the server asks a model anything. Every call, whatever the provider:
 * 1. is refused if the server-wide monthly ceiling is spent (before it takes a user's slot);
 * 2. takes one slot of the user's quota (429 `AI_QUOTA_EXCEEDED`), with an estimate counted at once;
 * 3. runs with a timeout of its own, separate from the caller's cancellation;
 * 4. leaves exactly one ledger row, settled in a `finally`: `ok`, `error` (provider failure or
 *    timeout) or `cancelled` (the caller gave up).
 *
 * A call is one slot however many a user action makes. It must not run inside a transaction: `reserve`
 * opens its own and locks the user row.
 */
@Injectable()
export class LlmGateway implements OnModuleInit {
  private readonly logger = new Logger(LlmGateway.name);
  /** Replaced in tests. */
  modelFor: (config: AiProviderConfig, jsonMode: boolean) => LanguageModel = resolveLanguageModel;
  private budget?: { at: number; month: number; total: number };

  constructor(private readonly quota: AiQuotaService) {}

  /** One instance runs at a time, so any call still `reserved` at boot is an orphan of a crash. */
  async onModuleInit() {
    try {
      const settled = await this.quota.settleOrphans(new Date());
      if (settled)
        this.logger.warn(
          `${settled} unfinished AI call(s) from before this start settled as errors`,
        );
    } catch (error) {
      this.logger.warn(`could not settle unfinished AI calls: ${(error as Error).message}`);
    }
  }

  private async assertBudget(now = new Date()) {
    const limit = globalMonthlyTokens();
    if (limit === null) return;
    const month = now.getUTCFullYear() * 12 + now.getUTCMonth();
    if (
      !this.budget ||
      this.budget.month !== month ||
      now.getTime() - this.budget.at > BUDGET_CACHE_MS
    )
      this.budget = { at: now.getTime(), month, total: await this.quota.monthlyTokensTotal(now) };
    if (this.budget.total >= limit)
      throw new ServiceUnavailableException({
        error: 'AI_BUDGET_EXHAUSTED',
        message: '이번 달 AI 사용 예산을 모두 사용했습니다. 다음 달에 다시 사용할 수 있습니다.',
      });
  }

  /**
   * For an action that makes several model calls: refuses up front, with the same 429 a single call
   * gets, when the day's remaining calls cannot cover `calls`, so the action does not stop half-spent.
   */
  async assertCallsAvailable(caller: AiCaller, calls: number): Promise<void> {
    const { daily } = await this.quota.summary(caller.userId);
    if (daily.limit - daily.used >= calls) return;
    throw new HttpException(
      {
        error: 'AI_QUOTA_EXCEEDED',
        message: `이 작업에는 AI 호출이 ${calls}번 필요하지만 오늘 남은 호출이 부족합니다.`,
        reason: 'daily_calls',
        limit: daily.limit,
        used: daily.used,
        needed: calls,
        resetsAt: daily.resetsAt.toISOString(),
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  async generate(request: LlmRequest): Promise<string> {
    const config = aiProviderConfig();
    if (!config) throw new Error('AI_NOT_CONFIGURED');
    const { caller, system, prompt } = request;
    const jsonMode = Boolean(request.jsonMode);
    const estimatedInput = estimateTokens(system) + estimateTokens(prompt);
    const maxInput = positive(process.env.AI_MAX_INPUT_TOKENS, DEFAULT_MAX_INPUT_TOKENS);
    if (estimatedInput > maxInput)
      throw new BadRequestException({
        error: 'AI_INPUT_TOO_LARGE',
        message: 'AI에 보낼 내용이 너무 큽니다. 범위를 줄여 다시 시도해 주세요.',
      });
    const maxOutputTokens =
      (jsonMode ? JSON_OUTPUT_TOKENS : TEXT_OUTPUT_TOKENS) +
      (config.reasoningEffort ? REASONING_OUTPUT_TOKENS : 0);

    // A caller that has already given up must not take a slot.
    if (request.abortSignal?.aborted) throw new Error('LLM_REQUEST_ABORTED');
    await this.assertBudget();
    const callId = `ai_${randomUUID().replace(/-/g, '')}`;
    // Nothing that can throw sits between the reservation and the `try` that settles it.
    await this.quota.reserve(caller.userId, caller.epoch, caller.feature, callId, new Date(), {
      inputTokens: estimatedInput,
      outputTokens: maxOutputTokens,
    });

    // Charge the estimate to the cached server-wide total now, so calls that start within the cache
    // window count each other; the settlement below swaps it for what was really used.
    const reservedTokens = estimatedInput + maxOutputTokens;
    if (this.budget) this.budget.total += reservedTokens;
    const startedAt = Date.now();
    const timeout = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      timeout.abort();
    }, llmTimeoutMs());
    let status: 'ok' | 'error' | 'cancelled' = 'error';
    let inputTokens = estimatedInput;
    let outputTokens = 0;
    let estimated = true;
    let text = '';
    let truncated = false;
    const settleUsage = (usage?: { inputTokens?: number; outputTokens?: number }) => {
      if (usage && (usage.inputTokens !== undefined || usage.outputTokens !== undefined)) {
        inputTokens = usage.inputTokens ?? 0;
        outputTokens = usage.outputTokens ?? 0;
        estimated = false;
      } else {
        // The provider reported nothing: an estimate keeps the monthly limits meaningful.
        outputTokens = estimateTokens(text);
      }
    };
    try {
      const signal = request.abortSignal
        ? AbortSignal.any([timeout.signal, request.abortSignal])
        : timeout.signal;
      const result = await generateText({
        model: this.modelFor(config, jsonMode),
        system,
        prompt,
        temperature: 0,
        maxRetries: 0,
        maxOutputTokens,
        abortSignal: signal,
        // A JSON response format only where the provider has one; the rest is normalized below.
        ...(jsonMode && config.provider !== 'anthropic' && config.provider !== 'codex'
          ? { output: Output.json() }
          : {}),
        ...(config.reasoningEffort
          ? {
              providerOptions:
                config.provider === 'openai'
                  ? { openai: { reasoningEffort: config.reasoningEffort } }
                  : { openaiCompatible: { reasoningEffort: config.reasoningEffort } },
            }
          : {}),
      } as Parameters<typeof generateText>[0]);
      text = result.text;
      truncated = result.finishReason === 'length';
      status = 'ok';
      settleUsage(result.usage);
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error)) {
        // With a JSON response format the SDK parses the answer itself and throws when it is not clean
        // JSON (fenced, prose around it, cut off at the output limit). The call succeeded and its tokens
        // were spent, so it is `ok`; the text goes through the same normalization as every provider's.
        status = 'ok';
        text = error.text ?? '';
        truncated = error.finishReason === 'length';
        settleUsage(error.usage);
      } else if (request.abortSignal?.aborted) {
        status = 'cancelled';
        throw error;
      } else if (timedOut) throw new Error('LLM_TIMEOUT');
      else if (APICallError.isInstance(error))
        throw new Error(`LLM_API_ERROR_${error.statusCode ?? 'UNKNOWN'}`);
      else throw error;
    } finally {
      clearTimeout(timer);
      // A ledger failure must not replace the answer, or hide the error, the caller is about to get.
      await this.quota
        .record(caller.userId, callId, {
          status,
          inputTokens,
          outputTokens,
          latencyMs: Date.now() - startedAt,
          provider: config.provider,
          model: config.model,
          usageEstimated: estimated,
        })
        .catch(error =>
          this.logger.error(`AI ledger settlement failed: ${(error as Error).message}`),
        );
      if (this.budget) this.budget.total += inputTokens + outputTokens - reservedTokens;
    }
    // A JSON answer comes back as the bare JSON text when it can be read as one. When it cannot, the text
    // is returned as it is: every call site already has its own answer to unparseable output (a 400, or a
    // corrective retry), and an exception here would skip it.
    if (!jsonMode) return text;
    const normalized = normalizeJsonOrRaw(text);
    // Cut off at the output limit: another attempt with the same limit is cut off again, so say so
    // instead of handing back half a JSON value for a correction round that cannot succeed.
    if (truncated && !isJson(normalized)) throw new Error('LLM_OUTPUT_TRUNCATED');
    return normalized;
  }
}
