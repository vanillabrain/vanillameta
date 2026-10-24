import { HttpException, Logger, StreamableFile } from '@nestjs/common';
import { PassThrough } from 'stream';
import { llmFailure } from '../ai/ai-caller';
import { CorrelationIdService } from '../middleware/correlation-id/correlation-id.service';
import { safeRouteTemplate } from './utils/safe-route-template';

export const NDJSON = 'application/x-ndjson';
const HEARTBEAT_MS = 5_000;
const logger = new Logger('NdjsonStream');

/** One line of the stream: `start`, `step`, `heartbeat`, then exactly one `result` or `error`. */
export type StreamEvent = { type: string; [key: string]: unknown };

/** The client asked for the stream with `Accept: application/x-ndjson`; anything else gets plain JSON. */
export const wantsNdjson = (req: any): boolean =>
  String(req?.headers?.accept ?? '')
    .split(',')
    .some(part => {
      const [type, ...params] = part.split(';');
      if (type.trim().toLowerCase() !== NDJSON) return false;
      // `;q=0` means "not acceptable".
      const q = params.map(p => /^\s*q\s*=\s*([\d.]+)\s*$/i.exec(p)?.[1]).find(Boolean);
      return q === undefined || Number(q) > 0;
    });

// What of an error body a client may see: the fields screens use to explain a refusal, nothing else.
const SHOWN = ['reason', 'limit', 'used', 'needed', 'resetsAt'] as const;

/**
 * The `error` event. Headers are already sent when a call fails mid-stream, so the status travels in the
 * event: `{status, error, message, ...refusal details}`. An error nobody expected is logged here and
 * reported without its text.
 */
export function errorEvent(error: unknown, correlationId?: string): StreamEvent {
  const base = errorBody(error);
  return correlationId ? { ...base, correlationId } : base;
}

function errorBody(error: unknown): StreamEvent {
  if (error instanceof HttpException) {
    const body = error.getResponse();
    const fields = typeof body === 'object' && body ? (body as Record<string, unknown>) : {};
    const message = typeof body === 'string' ? body : fields.message;
    return {
      type: 'error',
      status: error.getStatus(),
      error: typeof fields.error === 'string' ? fields.error : error.name,
      message: Array.isArray(message) ? message.join(', ') : message,
      ...Object.fromEntries(
        SHOWN.filter(key => fields[key] !== undefined).map(k => [k, fields[k]]),
      ),
    };
  }
  const failure = llmFailure(error);
  if (failure) {
    logger.error(`${failure.errorCode}: ${(error as Error).message}`, (error as Error).stack);
    return {
      type: 'error',
      status: failure.status,
      error: failure.errorCode,
      message: failure.message,
    };
  }
  logger.error((error as Error)?.message ?? String(error), (error as Error)?.stack);
  return {
    type: 'error',
    status: 500,
    error: 'INTERNAL_ERROR',
    message: '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.',
  };
}

export interface ServeOptions {
  /** Subscribe to progress events of this call; returns the unsubscribe. */
  watch?: (emit: (event: StreamEvent) => void) => () => void;
  heartbeatMs?: number;
}

/**
 * Runs `run` for one request. The caller's connection closing aborts it (so the model call is cancelled
 * and the ledger records `cancelled`). Without `Accept: application/x-ndjson` this returns the promise and
 * the route answers exactly as it always did. With it, this returns a stream at once (first byte now, not
 * when the model answers) and the outcome follows as events. Use only on a handler whose `@Res` is
 * `passthrough`: the returned `StreamableFile` is what Nest pipes to the response.
 */
export function serveRun<T>(
  req: any,
  res: any,
  run: (signal: AbortSignal) => Promise<T>,
  options: ServeOptions = {},
): Promise<T> | StreamableFile {
  const controller = new AbortController();
  const abort = () => controller.abort();
  const close = () => {
    if (!res.writableFinished) abort();
  };
  req.once('aborted', abort);
  res.once('close', close);
  if (req.aborted) abort();
  const detach = () => {
    req.off('aborted', abort);
    res.off('close', close);
  };

  if (!wantsNdjson(req))
    return (async () => {
      try {
        return await run(controller.signal);
      } finally {
        detach();
      }
    })();

  const out = new PassThrough();
  const startedAt = Date.now();
  const correlationId = CorrelationIdService.getCorrelationId() ?? req?.correlationId;
  const write = (event: StreamEvent) => {
    if (!out.writableEnded && !out.destroyed) out.write(`${JSON.stringify(event)}\n`);
  };
  // Proxies must not hold the lines back or recompress them.
  res.setHeader?.('Cache-Control', 'no-cache, no-transform');
  res.setHeader?.('X-Accel-Buffering', 'no');
  write({ type: 'start' });
  // A stalled connection must not make the buffer grow: heartbeats wait while earlier lines are unread.
  const timer = setInterval(() => {
    if (out.readableLength + out.writableLength < 16 * 1024) write({ type: 'heartbeat' });
  }, options.heartbeatMs ?? HEARTBEAT_MS);
  timer.unref?.();
  let unwatch: (() => void) | undefined;
  void (async () => {
    let status = 200;
    let outcome = 'result';
    try {
      unwatch = options.watch?.(write);
      write({ type: 'result', data: await run(controller.signal) });
    } catch (error) {
      const event = errorEvent(error, correlationId);
      status = Number(event.status);
      outcome = 'error';
      write(event);
      // What the exception filter does for a 5xx on the JSON path, which a stream never reaches.
      if (status >= 500 && process.env.SENTRY_DSN)
        void import('@sentry/nestjs')
          .then(sentry => sentry.captureException(error))
          .catch(() => undefined);
    } finally {
      clearInterval(timer);
      unwatch?.();
      detach();
      out.end();
      // The request logger sees only the handler returning the stream (a 201 after a few ms): record how
      // the stream really ended.
      logger.log(
        JSON.stringify({
          msg: 'stream',
          method: req?.method,
          url: safeRouteTemplate(req),
          status,
          outcome,
          disconnected: controller.signal.aborted,
          durationMs: Date.now() - startedAt,
          ...(correlationId ? { correlationId } : {}),
        }),
      );
    }
  })();
  return new StreamableFile(out, { type: `${NDJSON}; charset=utf-8` }).setErrorLogger(error => {
    // A client that closes the connection is how a request is cancelled, not an error.
    if ((error as NodeJS.ErrnoException).code !== 'ERR_STREAM_PREMATURE_CLOSE')
      logger.error(error.message, error.stack);
  });
}
