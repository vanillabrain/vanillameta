import {
  BadRequestException,
  HttpException,
  Logger,
  ServiceUnavailableException,
  StreamableFile,
} from '@nestjs/common';
import { EventEmitter } from 'events';
import { PassThrough } from 'stream';
import { errorEvent, serveRun, wantsNdjson } from './ndjson-stream';

const request = (accept?: string) =>
  Object.assign(new EventEmitter(), { headers: accept ? { accept } : {}, aborted: false });
const response = () =>
  Object.assign(new EventEmitter(), { writableFinished: false, setHeader: jest.fn() });
const lines = async (file: StreamableFile) => {
  let text = '';
  for await (const chunk of file.getStream()) text += chunk.toString();
  return text
    .split('\n')
    .filter(Boolean)
    .map(line => JSON.parse(line));
};

describe('wantsNdjson', () => {
  it.each([
    ['application/x-ndjson', true],
    ['application/json, application/x-ndjson;q=0.9', true],
    ['APPLICATION/X-NDJSON', true],
    ['application/x-ndjson;q=0', false],
    ['application/x-ndjson; q=0.5', true],
    ['application/x-ndjsonfoo', false],
    ['application/json', false],
    ['*/*', false],
    [undefined, false],
  ])('Accept %s -> %s', (accept, expected) => {
    expect(wantsNdjson(request(accept))).toBe(expected);
  });
  it('is false for a request without headers', () => expect(wantsNdjson({})).toBe(false));
});

describe('serveRun without the stream header', () => {
  it('returns the result as a promise, exactly as before, and detaches its listeners', async () => {
    const req = request();
    const res = response();
    const out = serveRun(req, res, async () => ({ status: 'succeeded' }));
    expect(out).not.toBeInstanceOf(StreamableFile);
    await expect(out).resolves.toEqual({ status: 'succeeded' });
    expect(req.listenerCount('aborted')).toBe(0);
    expect(res.listenerCount('close')).toBe(0);
    expect(res.setHeader).not.toHaveBeenCalled();
  });

  it('rejects with the error, so the existing exception filter answers it', async () => {
    const failure = new BadRequestException('bad');
    await expect(
      serveRun(request(), response(), async () => {
        throw failure;
      }),
    ).rejects.toBe(failure);
  });

  it('ends a plain run that fails after the client left as cancelled, with no error line and no 5xx', async () => {
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const req = request();
    const res = response();
    const out = serveRun(req, res, async () => {
      res.emit('close');
      throw new ServiceUnavailableException('AI 요청을 취소했습니다.');
    });
    await expect(out).resolves.toBeUndefined();
    expect(error).not.toHaveBeenCalled();
    // The record carries the class, not the sentence the user was never shown.
    expect(JSON.parse(warn.mock.calls[0][0] as string)).toMatchObject({
      msg: 'stream',
      status: 499,
      outcome: 'cancelled',
      disconnected: true,
      error: 'ServiceUnavailableException',
    });
    expect(warn.mock.calls[0][0]).not.toContain('취소');
    error.mockRestore();
    warn.mockRestore();
  });

  it('logs a plain run that resolves after the client left as a result, since the ledger holds it', async () => {
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const req = request();
    const res = response();
    const out = serveRun(req, res, async () => {
      res.emit('close');
      return { status: 'succeeded' };
    });
    await expect(out).resolves.toEqual({ status: 'succeeded' });
    expect(log).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(JSON.parse(warn.mock.calls[0][0] as string)).toMatchObject({
      msg: 'stream',
      status: 499,
      outcome: 'result',
      disconnected: true,
    });
    log.mockRestore();
    warn.mockRestore();
  });

  it('aborts the run when the connection closes before the response finished', async () => {
    const req = request();
    const res = response();
    let signal!: AbortSignal;
    const out = serveRun(req, res, s => {
      signal = s;
      return new Promise(resolve => s.addEventListener('abort', () => resolve('stopped')));
    });
    res.emit('close');
    await expect(out).resolves.toBe('stopped');
    expect(signal.aborted).toBe(true);
  });

  it('does not abort a run whose response already finished', async () => {
    const req = request();
    const res = response();
    let signal!: AbortSignal;
    const out = serveRun(req, res, async s => {
      signal = s;
      res.writableFinished = true;
      res.emit('close');
      return 'done';
    });
    await out;
    expect(signal.aborted).toBe(false);
  });
});

describe('serveRun with Accept: application/x-ndjson', () => {
  let log: jest.SpyInstance;
  let warn: jest.SpyInstance;
  beforeEach(() => {
    log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('logs how the stream really ended, with its status and outcome', async () => {
    const ok = serveRun(request('application/x-ndjson'), response(), async () => 1);
    await lines(ok as StreamableFile);
    const refused = serveRun(request('application/x-ndjson'), response(), async () => {
      throw new HttpException({ error: 'AI_QUOTA_EXCEEDED', message: 'limit' }, 429);
    });
    await lines(refused as StreamableFile);
    // A normal end is info; a failed stream is warn, so the production default log level shows it.
    const normal = JSON.parse(log.mock.calls[0][0] as string);
    const failed = JSON.parse(warn.mock.calls[0][0] as string);
    expect(normal).toMatchObject({
      msg: 'stream',
      status: 200,
      outcome: 'result',
      disconnected: false,
    });
    expect(failed).toMatchObject({
      msg: 'stream',
      status: 429,
      outcome: 'error',
      error: 'AI_QUOTA_EXCEEDED',
    });
    expect(typeof normal.durationMs).toBe('number');
    expect(log).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('logs a run that throws after the client left as cancelled, with no error line and no event', async () => {
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const req = request('application/x-ndjson');
    const res = response();
    const out = serveRun(req, res, async () => {
      res.emit('close');
      throw new Error('LLM_REQUEST_ABORTED');
    });
    const events = await lines(out as StreamableFile);
    expect(events.map(e => e.type)).toEqual(['start']);
    expect(JSON.parse(warn.mock.calls[0][0] as string)).toMatchObject({
      status: 499,
      outcome: 'cancelled',
      disconnected: true,
      error: 'LLM_REQUEST_ABORTED',
    });
    expect(error).not.toHaveBeenCalled();
  });

  it('ends the stream and releases listeners even when unsubscribing throws', async () => {
    const req = request('application/x-ndjson');
    const res = response();
    const out = serveRun(req, res, async () => 1, {
      watch: () => () => {
        throw new Error('unwatch failed');
      },
    });
    const events = await lines(out as StreamableFile);
    expect(events[events.length - 1]).toEqual({ type: 'result', data: 1 });
    expect(req.listenerCount('aborted')).toBe(0);
    expect(res.listenerCount('close')).toBe(0);
  });

  it('puts the request’s correlation id on the error event', async () => {
    const req = Object.assign(request('application/x-ndjson'), { correlationId: 'corr-1' });
    const out = serveRun(req, response(), async () => {
      throw new Error('LLM_TIMEOUT');
    });
    const events = await lines(out as StreamableFile);
    expect(events[events.length - 1]).toMatchObject({ type: 'error', correlationId: 'corr-1' });
  });

  it('does not log a closed connection as a stream error', async () => {
    const out = serveRun(
      request('application/x-ndjson'),
      response(),
      async () => 1,
    ) as StreamableFile;
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    // Nest calls this handler when the pipe to the response breaks.
    (out as any).errorLogger(
      Object.assign(new Error('Premature close'), { code: 'ERR_STREAM_PREMATURE_CLOSE' }),
    );
    expect(error).not.toHaveBeenCalled();
    (out as any).errorLogger(new Error('real failure with request text'));
    // The class only: the message and stack are not logged.
    expect(error).toHaveBeenCalledWith('Error');
    expect(JSON.stringify(error.mock.calls)).not.toContain('request text');
  });

  it('releases the timer and listeners even when subscribing to progress throws', async () => {
    const req = request('application/x-ndjson');
    const res = response();
    const out = serveRun(req, res, async () => 1, {
      watch: () => {
        throw new Error('boom');
      },
    });
    const events = await lines(out as StreamableFile);
    expect(events[events.length - 1]).toMatchObject({ type: 'error', status: 500 });
    expect(req.listenerCount('aborted')).toBe(0);
    expect(res.listenerCount('close')).toBe(0);
  });

  it('answers at once with a start line, passes progress through, then ends with the result', async () => {
    const req = request('application/x-ndjson');
    const res = response();
    let emit!: (event: any) => void;
    let release!: () => void;
    const out = serveRun(
      req,
      res,
      async () => {
        emit({ type: 'step', runId: 'r1', status: 'running' });
        await new Promise<void>(resolve => (release = resolve));
        return { status: 'succeeded' };
      },
      {
        watch: listener => {
          emit = listener;
          return () => undefined;
        },
      },
    );
    expect(out).toBeInstanceOf(StreamableFile);
    expect(res.setHeader).toHaveBeenCalledWith('X-Accel-Buffering', 'no');
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache, no-transform');
    // Nothing waits for the model: the first line is already written while the run is unfinished.
    const reader = (out as StreamableFile).getStream();
    expect(reader.readableLength).toBeGreaterThan(0);
    release();
    expect(await lines(out as StreamableFile)).toEqual([
      { type: 'start' },
      { type: 'step', runId: 'r1', status: 'running' },
      { type: 'result', data: { status: 'succeeded' } },
    ]);
    expect(req.listenerCount('aborted')).toBe(0);
    expect(res.listenerCount('close')).toBe(0);
  });

  it('reports a refusal as an error event with its details, in the stream, not as a status', async () => {
    const out = serveRun(request('application/x-ndjson'), response(), async () => {
      throw new HttpException(
        {
          error: 'AI_QUOTA_EXCEEDED',
          message: 'limit',
          reason: 'daily_calls',
          resetsAt: '2026-10-25T00:00:00.000Z',
          secretField: 'must not leak',
        },
        429,
      );
    });
    const events = await lines(out as StreamableFile);
    expect(events[events.length - 1]).toEqual({
      type: 'error',
      status: 429,
      error: 'AI_QUOTA_EXCEEDED',
      message: 'limit',
      reason: 'daily_calls',
      resetsAt: '2026-10-25T00:00:00.000Z',
    });
    expect(events.filter(e => e.type === 'result')).toHaveLength(0);
  });

  it('sends heartbeats while the model is slow and stops them afterwards', async () => {
    try {
      jest.useFakeTimers({
        doNotFake: ['performance', 'nextTick', 'setImmediate', 'queueMicrotask'],
      });
      let release!: () => void;
      const out = serveRun(
        request('application/x-ndjson'),
        response(),
        () => new Promise<string>(resolve => (release = () => resolve('ok'))),
        { heartbeatMs: 1000 },
      );
      jest.advanceTimersByTime(3500);
      release();
      await Promise.resolve();
      await Promise.resolve();
      const events = await lines(out as StreamableFile);
      expect(events.filter(e => e.type === 'heartbeat')).toHaveLength(3);
      expect(events[events.length - 1]).toEqual({ type: 'result', data: 'ok' });
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });

  it('holds heartbeats back while the client is not reading, so a stalled connection cannot grow the buffer', async () => {
    try {
      jest.useFakeTimers({
        doNotFake: ['performance', 'nextTick', 'setImmediate', 'queueMicrotask'],
      });
      let release!: () => void;
      const out = serveRun(
        request('application/x-ndjson'),
        response(),
        () => new Promise<string>(resolve => (release = () => resolve('ok'))),
        {
          heartbeatMs: 1000,
          watch: emit => (emit({ type: 'step', blob: 'x'.repeat(20 * 1024) }), () => undefined),
        },
      ) as StreamableFile;
      const stream = out.getStream() as unknown as PassThrough;
      const backlog = () => stream.readableLength + stream.writableLength;
      const before = backlog();
      jest.advanceTimersByTime(5000);
      // The 20 KiB step line is still unread, so no heartbeat was added on top of it.
      expect(backlog()).toBe(before);
      release();
      await Promise.resolve();
      await Promise.resolve();
      const events = await lines(out);
      expect(events.filter(e => e.type === 'heartbeat')).toHaveLength(0);
      expect(events[events.length - 1]).toEqual({ type: 'result', data: 'ok' });
    } finally {
      jest.useRealTimers();
    }
  });

  it('cancels the run when the client goes away and writes nothing to the dead stream', async () => {
    const req = request('application/x-ndjson');
    const res = response();
    let signal!: AbortSignal;
    const out = serveRun(req, res, s => {
      signal = s;
      return new Promise((_resolve, reject) =>
        s.addEventListener('abort', () => reject(new Error('LLM_REQUEST_ABORTED'))),
      );
    }) as StreamableFile;
    const stream = out.getStream();
    stream.destroy();
    res.emit('close');
    await new Promise(resolve => setImmediate(resolve));
    expect(signal.aborted).toBe(true);
    expect(req.listenerCount('aborted')).toBe(0);
  });

  it('unsubscribes from progress when the run ends', async () => {
    const unwatch = jest.fn();
    const out = serveRun(request('application/x-ndjson'), response(), async () => 1, {
      watch: () => unwatch,
    });
    await lines(out as StreamableFile);
    expect(unwatch).toHaveBeenCalledTimes(1);
  });
});

describe.each([
  ['JSON', undefined],
  ['NDJSON', 'application/x-ndjson'],
])('serveRun disconnected outcome consistency: %s', (_transport, accept) => {
  let log: jest.SpyInstance;
  let warn: jest.SpyInstance;
  let error: jest.SpyInstance;
  beforeEach(() => {
    log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it.each([
    [{ runId: 'r1', status: 'succeeded', steps: [] }, 'result'],
    [{ runId: 'r1', status: 'cancelled', steps: [] }, 'cancelled'],
    [{ runId: 'r1', status: 'partial', steps: [{ status: 'cancelled' }] }, 'result'],
    [{ status: 'cancelled' }, 'result'],
  ])('classifies resolved %j as %s after close', async (data, outcome) => {
    const req = request(accept);
    const res = response();
    let signal!: AbortSignal;
    let release!: (value: typeof data) => void;
    let emit: ((event: any) => void) | undefined;
    const unwatch = jest.fn();
    const out = serveRun(
      req,
      res,
      s => {
        signal = s;
        return new Promise<typeof data>(resolve => (release = resolve));
      },
      {
        watch: listener => {
          emit = listener;
          return unwatch;
        },
      },
    );
    res.emit('close');
    expect(signal.aborted).toBe(true);
    emit?.({ type: 'step', secret: 'after-disconnect' });
    release(data);
    if (out instanceof StreamableFile) {
      expect(await lines(out)).toEqual([{ type: 'start' }]);
      expect(unwatch).toHaveBeenCalledTimes(1);
    } else await expect(out).resolves.toEqual(data);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(log).not.toHaveBeenCalled();
    expect(JSON.parse(warn.mock.calls[0][0] as string)).toMatchObject({
      status: 499,
      outcome,
      disconnected: true,
    });
    expect(error).not.toHaveBeenCalled();
    expect(req.listenerCount('aborted')).toBe(0);
    expect(res.listenerCount('close')).toBe(0);
  });

  it('classifies a disconnected throw as cancelled without exposing raw errors', async () => {
    const req = request(accept);
    const res = response();
    const out = serveRun(req, res, async signal => {
      res.emit('close');
      expect(signal.aborted).toBe(true);
      throw new Error('private request text and password');
    });
    if (out instanceof StreamableFile) expect(await lines(out)).toEqual([{ type: 'start' }]);
    else await expect(out).resolves.toBeUndefined();
    expect(log).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(JSON.parse(warn.mock.calls[0][0] as string)).toMatchObject({
      status: 499,
      outcome: 'cancelled',
      disconnected: true,
      error: 'Error',
    });
    expect(JSON.stringify(warn.mock.calls)).not.toContain('private request');
    expect(req.listenerCount('aborted')).toBe(0);
    expect(res.listenerCount('close')).toBe(0);
  });
});

describe('errorEvent', () => {
  it('forwards only the known formula refusal code and no private exception fields', async () => {
    const message = '분자와 분모에 같은 값을 사용할 수 없습니다.';
    const out = serveRun(request('application/x-ndjson'), response(), async () => {
      throw new BadRequestException({
        code: 'FORMULA_SELF_RATIO',
        message,
        sql: 'SELECT private_column FROM private_table',
        details: { password: 'private-password' },
      });
    });
    const events = await lines(out as StreamableFile);
    expect(events).toEqual([
      { type: 'start' },
      {
        type: 'error',
        status: 400,
        error: 'BadRequestException',
        code: 'FORMULA_SELF_RATIO',
        message,
      },
    ]);
    expect(JSON.stringify(events)).not.toContain('private');
  });

  it.each(['PRIVATE_CODE', 'FORMULA_SELF_RATIO private SQL', { sql: 'private SQL' }])(
    'does not forward an unrecognized code %j',
    code => {
      expect(errorEvent(new BadRequestException({ code, message: 'Invalid formula' }))).toEqual({
        type: 'error',
        status: 400,
        error: 'BadRequestException',
        message: 'Invalid formula',
      });
    },
  );

  it('reports an unexpected error without its text', () => {
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const event = errorEvent(new Error('connect ECONNREFUSED 10.0.0.5:3306 password=hunter2'));
    expect(event).toMatchObject({ type: 'error', status: 500, error: 'INTERNAL_ERROR' });
    expect(JSON.stringify(event)).not.toContain('hunter2');
    // The log keeps the class only: no message and no stack, which can carry the same text.
    expect(error).toHaveBeenCalledWith('Error');
    expect(JSON.stringify(error.mock.calls)).not.toContain('hunter2');
    error.mockRestore();
  });

  it('logs a model failure by its code only, not its message', () => {
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    errorEvent(new Error('LLM_TIMEOUT'));
    expect(error).toHaveBeenCalledWith('LLM_TIMEOUT');
    expect(error.mock.calls[0]).toHaveLength(1);
    error.mockRestore();
  });

  it('maps the gateway’s plain failures like the exception filter does', () => {
    expect(errorEvent(new Error('LLM_TIMEOUT'))).toMatchObject({
      status: 504,
      error: 'LLM_TIMEOUT',
    });
    expect(errorEvent(new Error('AI_NOT_CONFIGURED'))).toMatchObject({
      status: 503,
      error: 'AI_NOT_CONFIGURED',
    });
  });

  it('joins a validation message list and keeps a plain string message', () => {
    expect(errorEvent(new BadRequestException(['a', 'b']))).toMatchObject({
      status: 400,
      message: 'a, b',
    });
    expect(errorEvent(new HttpException('plain', 409))).toMatchObject({
      status: 409,
      message: 'plain',
    });
  });
});
