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
