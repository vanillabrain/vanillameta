import { HttpException, ServiceUnavailableException } from '@nestjs/common';
import type { AiCaller } from './llm-gateway.service';

/**
 * The `authVersion` of the verified token, as `JwtAuthGuard` compares it (a token from before the
 * field existed counts as 0). Never read from the database: the gateway's actor lock checks it there.
 */
export const requestEpoch = (req: any): number => req?.user?.accessKeyData?.authVersion ?? 0;

/** Who a model call made while handling this request is for. */
export const callerOf = (req: any, feature: string): AiCaller => ({
  userId: req?.user?.accessKeyData?.id,
  epoch: requestEpoch(req),
  feature,
});

const httpErrorCode = (error: unknown): unknown => {
  if (!(error instanceof HttpException)) return undefined;
  const body = error.getResponse();
  return typeof body === 'object' && body ? (body as { error?: unknown }).error : undefined;
};

/**
 * The code of an error that no retry will fix because the user or the operator has to act first: a
 * refusal (quota, budget, input too large) or a missing AI setup. A run records it as the step's error.
 */
export function aiBlockingCode(error: unknown): string | undefined {
  if (isAiRefusal(error)) return httpErrorCode(error) as string;
  const code = httpErrorCode(error);
  if (code === 'AI_NOT_CONFIGURED' || (error as Error)?.message === 'AI_NOT_CONFIGURED')
    return 'AI_NOT_CONFIGURED';
  return undefined;
}

/**
 * How the gateway's own failures, which are plain errors with a code as the message, look to a client.
 * A call site that has no answer of its own for them lets them go up, and the exception filter uses this
 * instead of turning them into a 500.
 */
export function llmFailure(
  error: unknown,
): { status: number; errorCode: string; message: string } | undefined {
  const message = (error as Error)?.message;
  if (typeof message !== 'string') return undefined;
  if (message === 'AI_NOT_CONFIGURED')
    return {
      status: 503,
      errorCode: 'AI_NOT_CONFIGURED',
      message: 'AI 기능이 설정되지 않았습니다. 운영자에게 문의해 주세요.',
    };
  if (message === 'LLM_TIMEOUT')
    return {
      status: 504,
      errorCode: 'LLM_TIMEOUT',
      message: 'AI 응답이 늦어 중단했습니다. 다시 시도해 주세요.',
    };
  if (message === 'LLM_OUTPUT_TRUNCATED')
    return {
      status: 502,
      errorCode: 'LLM_OUTPUT_TRUNCATED',
      message: 'AI 답변이 길어 중간에 끊겼습니다. 요청 범위를 줄여 다시 시도해 주세요.',
    };
  if (/^LLM_API_ERROR_/.test(message))
    return {
      status: 502,
      errorCode: 'LLM_UNAVAILABLE',
      message: 'AI 서비스에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.',
    };
  return undefined;
}

/**
 * The gateway refused the call: the user's quota, the server-wide budget, or an input too large to send.
 * These are answers for the user, not model failures: a call site that turns errors into a generic
 * message must let them through unchanged. (`AI_NOT_CONFIGURED` is a plain `Error`, not matched here.)
 */
export function isAiRefusal(error: unknown): error is HttpException {
  const code = httpErrorCode(error);
  return (
    code === 'AI_QUOTA_EXCEEDED' || code === 'AI_BUDGET_EXHAUSTED' || code === 'AI_INPUT_TOO_LARGE'
  );
}

/** 503 for a feature that needs a model when none is configured; tells a missing setup from a hiccup. */
export const aiNotConfigured = () =>
  new ServiceUnavailableException({
    error: 'AI_NOT_CONFIGURED',
    message: 'AI 기능이 설정되지 않았습니다. 운영자에게 문의해 주세요.',
  });
