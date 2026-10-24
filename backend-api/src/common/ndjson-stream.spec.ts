import { BadRequestException, HttpException, StreamableFile } from '@nestjs/common';
import { EventEmitter } from 'events';
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
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
    try {
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
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
    try {
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
      const stream = out.getStream();
      const before = stream.readableLength;
      jest.advanceTimersByTime(5000);
      // The 20 KiB step line is still unread, so no heartbeat was added on top of it.
      expect(stream.readableLength).toBe(before);
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

describe('errorEvent', () => {
  it('reports an unexpected error without its text', () => {
    const event = errorEvent(new Error('connect ECONNREFUSED 10.0.0.5:3306 password=hunter2'));
    expect(event).toMatchObject({ type: 'error', status: 500, error: 'INTERNAL_ERROR' });
    expect(JSON.stringify(event)).not.toContain('hunter2');
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
