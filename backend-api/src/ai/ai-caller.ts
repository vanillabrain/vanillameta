import { HttpException } from '@nestjs/common';
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

/**
 * The gateway refused the call: the user's quota, the server-wide budget, or an input too large to send.
 * These are answers for the user, not model failures: a call site that turns errors into a generic
 * message must let them through unchanged. (`AI_NOT_CONFIGURED` is a plain `Error`, not matched here.)
 */
export function isAiRefusal(error: unknown): error is HttpException {
  if (!(error instanceof HttpException)) return false;
  const body = error.getResponse();
  const code = typeof body === 'object' && body ? (body as { error?: unknown }).error : undefined;
  return (
    code === 'AI_QUOTA_EXCEEDED' || code === 'AI_BUDGET_EXHAUSTED' || code === 'AI_INPUT_TOO_LARGE'
  );
}
