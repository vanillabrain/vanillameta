import { HttpException, HttpStatus } from '@nestjs/common';
import type { McpErrorCode } from './mcp-server';

/** Why a dashboard tool call failed, beyond its code. Agents branch on this, never on message text. */
export type DashboardReason =
  | 'REVISION_CHANGED'
  | 'SOURCE_CHANGED'
  | 'PREVIEW_STALE'
  | 'RESTORE_STALE'
  | 'HAS_DEPENDENCIES'
  | 'UNSUPPORTED_CHANGE'
  | 'INVALID_INPUT'
  | 'STATE_CHANGED'
  | 'BUSY'
  | 'CARDINALITY_LIMIT'
  | 'RATE_LIMITED'
  | 'QUEUE_FULL'
  | 'REQUEST_REUSED';

const STATUS: Record<'CONFLICT' | 'REQUEST_REUSED' | 'INVALID' | 'LIMIT', number> = {
  CONFLICT: HttpStatus.CONFLICT,
  REQUEST_REUSED: HttpStatus.CONFLICT,
  INVALID: HttpStatus.BAD_REQUEST,
  LIMIT: HttpStatus.TOO_MANY_REQUESTS,
};

export class DashboardToolException extends HttpException {
  constructor(
    readonly code: Extract<McpErrorCode, keyof typeof STATUS>,
    readonly reason: DashboardReason,
    message = reason,
  ) {
    super({ statusCode: STATUS[code], message, reason }, STATUS[code]);
  }
}

/**
 * Turns the codes the Studio services attach to their exceptions into tool errors. The services
 * keep their Korean messages for people; an agent gets the code. An error with no known code is
 * returned unchanged, so a refusal, a 404 or a bug is never relabelled as one of these.
 */
export function toDashboardFailure(error: unknown): unknown {
  if (!(error instanceof HttpException) || error instanceof DashboardToolException) return error;
  const body = error.getResponse();
  const code = typeof body === 'object' && body !== null ? (body as { code?: unknown }).code : null;
  switch (code) {
    case 'PREVIEW_STALE':
    case 'SOURCE_CHANGED':
    case 'REVISION_CHANGED':
    case 'STATE_CHANGED':
      return new DashboardToolException('CONFLICT', code);
    case 'REQUEST_REUSED':
    case 'REPLAY_UNREADABLE':
      // A record exists for this request ID. Asking again with it cannot work; look the dashboard up.
      return new DashboardToolException('REQUEST_REUSED', 'REQUEST_REUSED');
    case 'CARDINALITY_LIMIT':
      return new DashboardToolException('INVALID', 'CARDINALITY_LIMIT');
    case 'UNSUPPORTED_CHANGE':
      return new DashboardToolException('INVALID', 'UNSUPPORTED_CHANGE');
    case 'RESTORE_STALE':
      // The saved state cannot be rebuilt on today's metrics or data. Asking again changes nothing,
      // so this is not a retryable CONFLICT: the agent reads the dashboard and decides.
      return new DashboardToolException('INVALID', 'RESTORE_STALE');
    case 'QUEUE_FULL':
      // Transient, so a retryable code: LIMIT tells an agent not to retry.
      return new DashboardToolException('CONFLICT', 'QUEUE_FULL');
    default:
      // A 409 without a code means the data or a definition moved underneath: preview again and
      // retry. A 503 without one is a worker that is busy: retry later. Other statuses (a refusal,
      // a 404, a bug) pass through as they are, and so does a 409 that carries a code not named here.
      if (code == null && error.getStatus() === HttpStatus.CONFLICT)
        return new DashboardToolException('CONFLICT', 'STATE_CHANGED');
      if (code == null && error.getStatus() === HttpStatus.SERVICE_UNAVAILABLE)
        return new DashboardToolException('CONFLICT', 'BUSY');
      return error;
  }
}
