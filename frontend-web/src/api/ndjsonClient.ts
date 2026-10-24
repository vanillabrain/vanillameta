import { fetchAuthContext, renewAccessTokenForFetch, responseMessage } from '@/helpers/apiHelper';

/** One line of the server's stream (docs/plans/external-beta-m2-llm.md, "M2-3 구현: 스트림 프로토콜"). */
export type StreamStep = { stepId: string; status: string; retryable?: boolean; errorCode?: string };
export type StreamEvent =
  | { type: 'start' }
  | { type: 'heartbeat' }
  | { type: 'step'; runId: string; status: string; steps: StreamStep[] }
  | { type: 'result'; data: unknown }
  | { type: 'error'; status: number; error?: string; message?: string; [detail: string]: unknown };

/** An error shaped like axios's, so every existing mapper (toStudioApiError, creationError) reads it. */
export class StreamApiError extends Error {
  response?: { status: number; data: unknown };
  constructor(message: string, response?: { status: number; data: unknown }) {
    super(message);
    this.name = 'StreamApiError';
    this.response = response;
  }
}

const IDLE_MS = 30_000; // the server sends a heartbeat every 5 s
const MAX_LINE = 4 * 1024 * 1024; // a result carries the whole run, so this is generous

const isNdjson = (response: Response) =>
  (response.headers.get('content-type') ?? '').toLowerCase().includes('application/x-ndjson');

const readJson = async (response: Response): Promise<unknown> => {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
};

const detailOf = (body: any) => body?.data ?? body;

const httpError = async (response: Response) => {
  const body = await readJson(response);
  const message = detailOf(body)?.message;
  return new StreamApiError(typeof message === 'string' ? message : `HTTP ${response.status}`, {
    status: response.status,
    data: body,
  });
};

/** The `error` event, as the error an axios call with the same failure would have thrown. */
const eventError = (event: Extract<StreamEvent, { type: 'error' }>) => {
  const { type: _type, ...detail } = event;
  return new StreamApiError(typeof event.message === 'string' ? event.message : 'AI 요청을 처리하지 못했습니다.', {
    status: Number(event.status) || 500,
    data: { success: false, code: Number(event.status) || 500, data: detail },
  });
};

export type PostNdjsonOptions = {
  signal?: AbortSignal;
  /** Every `start`, `step` and `heartbeat` line; the `result` and `error` lines end the call instead. */
  onEvent?: (event: StreamEvent) => void;
  idleMs?: number;
  fetchImpl?: typeof fetch;
};

/**
 * POSTs `body` asking for a stream and resolves with the `result` event's data, which is what the same
 * route returns as plain JSON. Rejects like axios would: with `response.status/data` for an HTTP refusal or
 * an `error` event, without a response for a dropped connection or a stream that ended without an outcome.
 * Aborting `signal` closes the connection, which is how the server learns to cancel the model call.
 */
export async function postNdjson(url: string, body: unknown, options: PostNdjsonOptions = {}): Promise<unknown> {
  const doFetch = options.fetchImpl ?? fetch;
  const idleMs = options.idleMs ?? IDLE_MS;
  const link = new AbortController();
  const abort = () => link.abort();
  options.signal?.addEventListener('abort', abort, { once: true });
  if (options.signal?.aborted) abort();
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  let idle = false;
  const touch = () => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      idle = true;
      link.abort();
    }, idleMs);
  };
  const context = fetchAuthContext();
  const send = (token: string | null) =>
    doFetch(context.baseURL + url, {
      method: 'POST',
      credentials: 'include',
      signal: link.signal,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/x-ndjson',
        'X-Correlation-ID': globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
  try {
    touch();
    let response = await send(context.token);
    if (response.status === 401 && !isNdjson(response)) {
      const detail = await readJson(response);
      // The guard answers with a string payload: {success:false, code:401, data:'accessTokenExpired'}.
      const expired = responseMessage(detail) === 'accessTokenExpired';
      if (!expired) throw new StreamApiError('HTTP 401', { status: 401, data: detail });
      // The same renewal the axios interceptor runs; one retry, with the renewed token.
      const token = await renewAccessTokenForFetch(context);
      touch(); // the renewal may have waited for the cross-tab lock
      response = await send(token);
    }
    if (!response.ok || !isNdjson(response)) throw await httpError(response);
    if (!response.body) throw new StreamApiError('The server sent no stream.');
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    const handle = (line: string): { done: boolean; value?: unknown } => {
      if (!line.trim()) return { done: false };
      let event: StreamEvent;
      try {
        event = JSON.parse(line);
      } catch {
        throw new StreamApiError('The stream carried a line that is not JSON.');
      }
      if (!event || typeof event !== 'object' || typeof (event as any).type !== 'string')
        throw new StreamApiError('The stream carried an unknown event.');
      if (event.type === 'result') return { done: true, value: event.data };
      if (event.type === 'error') throw eventError(event);
      options.onEvent?.(event);
      return { done: false };
    };
    for (;;) {
      const { value, done } = await reader.read();
      touch();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      if (buffer.length > MAX_LINE) throw new StreamApiError('The stream carried a line that is too long.');
      let newline: number;
      while ((newline = buffer.indexOf('\n')) >= 0) {
        const outcome = handle(buffer.slice(0, newline));
        buffer = buffer.slice(newline + 1);
        if (outcome.done) {
          void reader.cancel().catch(() => undefined);
          return outcome.value;
        }
      }
    }
    buffer += decoder.decode();
    const last = handle(buffer);
    if (last.done) return last.value;
    // The connection ended with neither a result nor an error: the run's fate is unknown.
    throw new StreamApiError('The stream ended before the server reported an outcome.');
  } catch (error) {
    if (options.signal?.aborted) throw error;
    if (idle) throw new StreamApiError('The server stopped sending; the connection was closed.');
    throw error;
  } finally {
    clearTimeout(idleTimer);
    options.signal?.removeEventListener('abort', abort);
    // Closing the connection is how the server learns to cancel the model call: never leave one open
    // behind a parse failure. After a completed body this does nothing.
    link.abort();
  }
}
