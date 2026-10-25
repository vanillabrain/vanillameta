import { HttpException, Logger, StreamableFile } from '@nestjs/common';
import { PassThrough } from 'stream';
import { failureCode, llmFailure } from '../ai/ai-caller';
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
      // Only this public formula refusal code is safe to forward; arbitrary codes may carry details.
      ...(fields.code === 'FORMULA_SELF_RATIO' ? { code: 'FORMULA_SELF_RATIO' } : {}),
      ...Object.fromEntries(
        SHOWN.filter(key => fields[key] !== undefined).map(k => [k, fields[k]]),
      ),
    };
  }
  const failure = llmFailure(error);
  if (failure) {
    logger.error(failure.errorCode);
    return {
      type: 'error',
      status: failure.status,
      error: failure.errorCode,
      message: failure.message,
    };
  }
  // The class only: an unexpected message or stack can carry request text, so neither is logged.
  logger.error(failureCode(error));
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

/** Only execution summaries have a runId and an authoritative top-level cancellation status.
 * Other resolved payloads are transport results; resolution alone does not prove execution success.
 */
function resolvedOutcome(data: unknown): 'result' | 'cancelled' {
  if (data && typeof data === 'object' && 'runId' in data && 'status' in data)
    if (typeof data.runId === 'string' && data.runId.length > 0 && data.status === 'cancelled')
      return 'cancelled';
  return 'result';
}

/**
 * Runs `run` for one request. Closing an unfinished connection requests abort, but does not prove the
 * execution was cancelled. After disconnect both transports log status 499 and disconnected: true:
 * a resolved execution summary with status cancelled logs cancelled; other resolutions log result;
 * a thrown run logs cancelled with only its safe failure code. JSON still resolves with the returned
 * data (undefined on a disconnected throw), but the departed client receives nothing. NDJSON emits
 * no further events after abort. While connected, NDJSON returns a stream immediately and delivers
 * the resolved payload as a result event. Use only with a passthrough @Res handler.
 */
export function serveRun<T>(
  req: any,
  res: any,
  run: (signal: AbortSignal) => Promise<T>,
  options: ServeOptions = {},
): Promise<T | undefined> | StreamableFile {
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

  const startedAt = Date.now();
  const correlationId = CorrelationIdService.getCorrelationId() ?? req?.correlationId;
  // The request logger sees only the handler returning the stream (a 201 after a few ms), so how the run
  // really ended is recorded here. A normal end is info. A stream that failed or was cut off is what an
  // operator looks for, and the production default log level (warn) must still show it.
  const logEnd = (status: number, outcome: string, code?: string) => {
    const record = JSON.stringify({
      msg: 'stream',
      method: req?.method,
      url: safeRouteTemplate(req),
      status,
      outcome,
      disconnected: controller.signal.aborted,
      ...(code ? { error: code } : {}),
      durationMs: Date.now() - startedAt,
      ...(correlationId ? { correlationId } : {}),
    });
    if (outcome === 'result' && !controller.signal.aborted) logger.log(record);
    else logger.warn(record);
  };

  if (!wantsNdjson(req))
    return (async () => {
      try {
        const data = await run(controller.signal);
        // Classify the returned execution state separately from the disconnected transport.
        if (controller.signal.aborted) logEnd(499, resolvedOutcome(data));
        return data;
      } catch (error) {
        // Nobody is left to answer: a client that closed the connection cancelled the run, so this is
        // not a 5xx with an error line. Without a stream there is no event to end; the record is the account.
        if (!controller.signal.aborted) throw error;
        logEnd(499, 'cancelled', failureCode(error));
        return undefined;
      } finally {
        detach();
      }
    })();

  const out = new PassThrough();
  const write = (event: StreamEvent) => {
    if (!controller.signal.aborted && !out.writableEnded && !out.destroyed)
      out.write(`${JSON.stringify(event)}\n`);
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
    let code: string | undefined;
    try {
      unwatch = options.watch?.(write);
      const data = await run(controller.signal);
      // The returned state, not the abort request, determines the resolved outcome.
      if (controller.signal.aborted) {
        outcome = resolvedOutcome(data);
        status = 499;
      }
      write({ type: 'result', data });
    } catch (error) {
      if (controller.signal.aborted) {
        // The client left and the run ended by throwing (services word an abort in many ways). Nobody
        // receives an event, and it is neither a server fault nor worth an error line with a stack.
        status = 499;
        outcome = 'cancelled';
        // The code only: a message can carry the model's text. A real fault still shows as its class.
        code = failureCode(error);
      } else {
        const event = errorEvent(error, correlationId);
        status = Number(event.status);
        outcome = 'error';
        code = String(event.error);
        write(event);
        // What the exception filter does for a 5xx on the JSON path, which a stream never reaches.
        if (status >= 500 && process.env.SENTRY_DSN)
          void import('@sentry/nestjs')
            .then(sentry => sentry.captureException(error))
            .catch(() => undefined);
      }
    } finally {
      clearInterval(timer);
      detach();
      out.end();
      try {
        unwatch?.();
      } catch (error) {
        // The stream is already closed; a failing unsubscribe must not keep it from ending.
        logger.warn(`stream unsubscribe failed: ${failureCode(error)}`);
      }
      logEnd(status, outcome, code);
    }
  })().catch(error => logger.error(`stream bookkeeping failed: ${failureCode(error)}`));
  return new StreamableFile(out, { type: `${NDJSON}; charset=utf-8` }).setErrorLogger(error => {
    // A client that closes the connection is how a request is cancelled, not an error.
    if ((error as NodeJS.ErrnoException).code !== 'ERR_STREAM_PREMATURE_CLOSE')
      logger.error(failureCode(error));
  });
}
