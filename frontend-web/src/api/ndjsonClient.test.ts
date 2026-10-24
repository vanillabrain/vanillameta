import { beforeEach, describe, expect, it, vi } from 'vitest';

const renew = vi.fn();
// The same reader the axios interceptor uses: it accepts a string payload as well as {message}.
vi.mock('@/helpers/apiHelper', () => ({
  fetchAuthContext: () => ({ baseURL: '/v1', token: 'old-token', epoch: 3 }),
  renewAccessTokenForFetch: (...args: unknown[]) => renew(...args),
  responseMessage: (data: any) => {
    const candidate = typeof data === 'string' ? data : data?.message ?? data?.data;
    if (typeof candidate === 'string') return candidate;
    return typeof candidate?.message === 'string' ? candidate.message : undefined;
  },
}));

import { postNdjson, StreamApiError, StreamEvent } from './ndjsonClient';

const encoder = new TextEncoder();
const NDJSON = 'application/x-ndjson; charset=utf-8';

/** A response whose body yields the given chunks, then ends (or waits for `hold`). */
const streamResponse = (chunks: string[], init: { hold?: Promise<void>; status?: number } = {}) => {
  let index = 0;
  let cancelled = false;
  return {
    status: init.status ?? 201,
    ok: true,
    headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? NDJSON : null) },
    cancelled: () => cancelled,
    body: {
      getReader: () => ({
        read: async () => {
          if (index < chunks.length) {
            const chunk = chunks[index];
            index += 1;
            return { done: false, value: encoder.encode(chunk) };
          }
          if (init.hold) await init.hold;
          return { done: true, value: undefined };
        },
        cancel: async () => {
          cancelled = true;
        },
      }),
    },
  };
};

const jsonResponse = (status: number, body: unknown) => ({
  status,
  ok: status < 300,
  headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? 'application/json' : null) },
  json: async () => body,
  body: null,
});

const line = (event: unknown) => JSON.stringify(event) + '\n';

describe('postNdjson', () => {
  beforeEach(() => renew.mockReset());

  it('sends the request the way axios would and resolves with the result’s data', async () => {
    const fetchImpl = vi.fn(async () =>
      streamResponse([line({ type: 'start' }), line({ type: 'result', data: { status: 'succeeded' } })]),
    );
    const data = await postNdjson('/studio/executions', { requestId: 'r1' }, { fetchImpl: fetchImpl as any });
    expect(data).toEqual({ status: 'succeeded' });
    const [url, init] = fetchImpl.mock.calls[0] as any;
    expect(url).toBe('/v1/studio/executions');
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('include');
    expect(init.headers.Accept).toBe('application/x-ndjson');
    expect(init.headers.Authorization).toBe('Bearer old-token');
    expect(init.headers['X-Correlation-ID']).toBeTruthy();
    expect(JSON.parse(init.body)).toEqual({ requestId: 'r1' });
  });

  it('hands every progress line to onEvent in order, including lines split across chunks', async () => {
    const seen: StreamEvent[] = [];
    const step = line({
      type: 'step',
      runId: 'run-1',
      status: 'running',
      steps: [{ stepId: 'preview', status: 'running' }],
    });
    const fetchImpl = vi.fn(async () =>
      streamResponse([
        line({ type: 'start' }),
        step.slice(0, 20),
        step.slice(20),
        line({ type: 'heartbeat' }),
        line({ type: 'result', data: 1 }),
      ]),
    );
    expect(await postNdjson('/x', {}, { fetchImpl: fetchImpl as any, onEvent: e => seen.push(e) })).toBe(1);
    expect(seen.map(e => e.type)).toEqual(['start', 'step', 'heartbeat']);
    expect((seen[1] as any).steps[0].stepId).toBe('preview');
  });

  it('reads a final line that has no newline, and stops reading once the result came', async () => {
    const response = streamResponse([line({ type: 'start' }), JSON.stringify({ type: 'result', data: 'no newline' })]);
    expect(await postNdjson('/x', {}, { fetchImpl: (async () => response) as any })).toBe('no newline');

    const early = streamResponse([line({ type: 'result', data: 2 }), line({ type: 'heartbeat' })]);
    expect(await postNdjson('/x', {}, { fetchImpl: (async () => early) as any })).toBe(2);
    await Promise.resolve();
    expect(early.cancelled()).toBe(true);
  });

  it('throws the error event as an axios-shaped error with the refusal’s details', async () => {
    const fetchImpl = async () =>
      streamResponse([
        line({ type: 'start' }),
        line({
          type: 'error',
          status: 429,
          error: 'AI_QUOTA_EXCEEDED',
          message: '한도 도달',
          resetsAt: '2026-10-25T00:00:00.000Z',
        }),
      ]);
    const error: any = await postNdjson('/x', {}, { fetchImpl: fetchImpl as any }).catch(e => e);
    expect(error).toBeInstanceOf(StreamApiError);
    expect(error.message).toBe('한도 도달');
    expect(error.response.status).toBe(429);
    // The shape creationError / toStudioApiError read: response.data.data.{error,message}.
    expect(error.response.data.data).toMatchObject({ error: 'AI_QUOTA_EXCEEDED', message: '한도 도달' });
    expect(error.response.data.data.type).toBeUndefined();
  });

  it('turns an HTTP refusal before the stream into the same axios-shaped error', async () => {
    const fetchImpl = async () =>
      jsonResponse(429, { success: false, code: 429, data: { error: 'RATE_LIMITED', message: '너무 많은 요청' } });
    const error: any = await postNdjson('/x', {}, { fetchImpl: fetchImpl as any }).catch(e => e);
    expect(error.response.status).toBe(429);
    expect(error.message).toBe('너무 많은 요청');
    expect(error.response.data.data.error).toBe('RATE_LIMITED');
  });

  it('renews an expired token once and retries with it', async () => {
    renew.mockResolvedValue('new-token');
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, { success: false, code: 401, data: 'accessTokenExpired' }))
      .mockResolvedValueOnce(streamResponse([line({ type: 'result', data: 'after refresh' })]));
    expect(await postNdjson('/x', { a: 1 }, { fetchImpl: fetchImpl as any })).toBe('after refresh');
    expect(renew).toHaveBeenCalledWith({ baseURL: '/v1', token: 'old-token', epoch: 3 });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect((fetchImpl.mock.calls[1] as any)[1].headers.Authorization).toBe('Bearer new-token');
  });

  it('does not retry a 401 that is not an expired token, or loop on a second one', async () => {
    const other = vi.fn(async () => jsonResponse(401, { success: false, code: 401, data: 'invalid' }));
    const error: any = await postNdjson('/x', {}, { fetchImpl: other as any }).catch(e => e);
    expect(error.response.status).toBe(401);
    expect(renew).not.toHaveBeenCalled();

    renew.mockResolvedValue('new-token');
    const expired = vi.fn(async () => jsonResponse(401, { success: false, code: 401, data: 'accessTokenExpired' }));
    const again: any = await postNdjson('/x', {}, { fetchImpl: expired as any }).catch(e => e);
    expect(again.response.status).toBe(401);
    expect(expired).toHaveBeenCalledTimes(2);
    expect(renew).toHaveBeenCalledTimes(1);
  });

  it('closes the connection when a line cannot be read, so the server cancels the model call', async () => {
    let sent!: AbortSignal;
    const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
      sent = init.signal as AbortSignal;
      return streamResponse(['not json\n']);
    });
    await postNdjson('/x', {}, { fetchImpl: fetchImpl as any }).catch(() => undefined);
    expect(sent.aborted).toBe(true);
  });

  it('refuses a line that never ends instead of buffering it without limit', async () => {
    const huge = 'x'.repeat(5 * 1024 * 1024);
    const error: any = await postNdjson('/x', {}, { fetchImpl: (async () => streamResponse([huge])) as any }).catch(e => e);
    expect(error).toBeInstanceOf(StreamApiError);
    expect(error.message).toContain('too long');
  });

  it('accepts more than the cap in total when it is made of complete lines', async () => {
    const heartbeat = line({ type: 'heartbeat' });
    const many = heartbeat.repeat(Math.ceil((5 * 1024 * 1024) / heartbeat.length));
    expect(many.length).toBeGreaterThan(4 * 1024 * 1024);
    const chunk = many + line({ type: 'result', data: 'after many lines' });
    expect(await postNdjson('/x', {}, { fetchImpl: (async () => streamResponse([chunk])) as any })).toBe('after many lines');
  });

  it('does not try to renew a 401 for a request that sent no token, and reports it as a 401', async () => {
    vi.resetModules();
    vi.doMock('@/helpers/apiHelper', () => ({
      fetchAuthContext: () => ({ baseURL: '/v1', token: null, epoch: null }),
      renewAccessTokenForFetch: (...args: unknown[]) => renew(...args),
      responseMessage: (data: any) => (typeof data?.data === 'string' ? data.data : undefined),
    }));
    const { postNdjson: fresh } = await import('./ndjsonClient');
    const expired = async () => jsonResponse(401, { success: false, code: 401, data: 'accessTokenExpired' });
    const error: any = await fresh('/x', {}, { fetchImpl: expired as any }).catch(e => e);
    expect(error.response.status).toBe(401);
    expect(renew).not.toHaveBeenCalled();
    vi.doUnmock('@/helpers/apiHelper');
  });

  it('reports a stream that ends without an outcome as an unknown result, with no response', async () => {
    const fetchImpl = async () => streamResponse([line({ type: 'start' }), line({ type: 'heartbeat' })]);
    const error: any = await postNdjson('/x', {}, { fetchImpl: fetchImpl as any }).catch(e => e);
    expect(error).toBeInstanceOf(StreamApiError);
    expect(error.response).toBeUndefined();
  });

  it('rejects a line that is not JSON or not an event', async () => {
    const bad = (text: string) => async () => streamResponse([text]);
    expect(await postNdjson('/x', {}, { fetchImpl: bad('not json\n') as any }).catch(e => e)).toBeInstanceOf(StreamApiError);
    expect(await postNdjson('/x', {}, { fetchImpl: bad('{"a":1}\n') as any }).catch(e => e)).toBeInstanceOf(StreamApiError);
  });

  it('closes the connection when the caller aborts, and does not report an idle timeout', async () => {
    const controller = new AbortController();
    let sentSignal!: AbortSignal;
    const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
      sentSignal = init.signal as AbortSignal;
      return new Promise((_resolve, reject) =>
        sentSignal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))),
      );
    });
    const pending = postNdjson('/x', {}, { fetchImpl: fetchImpl as any, signal: controller.signal });
    controller.abort();
    const error: any = await pending.catch(e => e);
    expect(sentSignal.aborted).toBe(true);
    expect(error.name).toBe('AbortError');
  });

  it('keeps a long run alive for as long as heartbeats keep coming, however long it lasts in total', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      const beats = 6; // 6 x 600 ms = 3.6 s of run, with a 1 s idle limit: only a re-armed watchdog survives
      const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
        const signal = init.signal as AbortSignal;
        let sent = 0;
        return {
          status: 201,
          ok: true,
          headers: { get: () => NDJSON },
          body: {
            getReader: () => ({
              read: () =>
                new Promise((resolve, reject) => {
                  const timer = setTimeout(() => {
                    sent += 1;
                    resolve({
                      done: false,
                      value: encoder.encode(
                        sent <= beats ? line({ type: 'heartbeat' }) : line({ type: 'result', data: 'finished' }),
                      ),
                    });
                  }, 600);
                  signal.addEventListener('abort', () => {
                    clearTimeout(timer);
                    reject(new Error('aborted'));
                  });
                }),
              cancel: async () => undefined,
            }),
          },
        };
      });
      const pending = postNdjson('/x', {}, { fetchImpl: fetchImpl as any, idleMs: 1000 }).catch(e => e);
      await vi.advanceTimersByTimeAsync(6000);
      expect(await pending).toBe('finished');
    } finally {
      vi.useRealTimers();
    }
  });

  it('gives up on a server that went silent', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
        const signal = init.signal as AbortSignal;
        return {
          status: 201,
          ok: true,
          headers: { get: () => NDJSON },
          body: {
            getReader: () => ({
              read: () =>
                new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')))),
              cancel: async () => undefined,
            }),
          },
        };
      });
      const pending = postNdjson('/x', {}, { fetchImpl: fetchImpl as any, idleMs: 1000 }).catch(e => e);
      await vi.advanceTimersByTimeAsync(1500);
      const error: any = await pending;
      expect(error).toBeInstanceOf(StreamApiError);
      expect(error.message).toContain('stopped sending');
      expect(error.response).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });
});
