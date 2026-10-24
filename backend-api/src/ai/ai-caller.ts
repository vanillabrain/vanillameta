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
  const code = httpErrorCode(error);
  return isAiRefusal(error) || code === 'AI_NOT_CONFIGURED' ? (code as string) : undefined;
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
