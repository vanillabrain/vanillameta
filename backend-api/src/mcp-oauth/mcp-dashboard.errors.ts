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
  if (!(error instanceof HttpException)) return error;
  const body = error.getResponse();
  const code = typeof body === 'object' && body !== null ? (body as { code?: unknown }).code : null;
  switch (code) {
    case 'PREVIEW_STALE':
    case 'SOURCE_CHANGED':
      return new DashboardToolException('CONFLICT', code);
    case 'REQUEST_REUSED':
      return new DashboardToolException('REQUEST_REUSED', 'REQUEST_REUSED');
    case 'CARDINALITY_LIMIT':
      return new DashboardToolException('INVALID', 'CARDINALITY_LIMIT');
    case 'UNSUPPORTED_CHANGE':
      return new DashboardToolException('INVALID', 'UNSUPPORTED_CHANGE');
    default:
      return error.getStatus() === HttpStatus.SERVICE_UNAVAILABLE
        ? new DashboardToolException('LIMIT', 'QUEUE_FULL')
        : error;
  }
}
