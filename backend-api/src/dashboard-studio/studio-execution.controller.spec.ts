jest.mock('../ai/ai.service', () => ({ AiService: class {} }));
import { EventEmitter } from 'events';
import { StreamableFile } from '@nestjs/common';
import { StudioExecutionController } from './studio-execution.controller';
describe('T7 execution POST disconnect boundary', () => {
  it.each(['aborted', 'close'])('forwards %s as AbortSignal and removes listeners', async event => {
    const req = Object.assign(new EventEmitter(), {
      user: { accessKeyData: { id: 7 } },
      aborted: false,
    });
    const res = Object.assign(new EventEmitter(), { writableFinished: false });
    let signal: AbortSignal;
    const service = {
      create: jest.fn(async (_body, _actor, s: AbortSignal) => {
        signal = s;
        return new Promise(resolve =>
          s.addEventListener('abort', () => resolve({ status: 'cancelled' }), { once: true }),
        );
      }),
    };
    const controller = new StudioExecutionController(service as any);
    const pending = controller.create({}, req, res);
    expect(signal.aborted).toBe(false);
    (event === 'close' ? res : req).emit(event);
    expect(await pending).toEqual({ status: 'cancelled' });
    expect(signal.aborted).toBe(true);
    expect(req.listenerCount('aborted')).toBe(0);
    expect(res.listenerCount('close')).toBe(0);
  });
  it('links retry disconnect but does not cancel a normally finished response', async () => {
    const req = Object.assign(new EventEmitter(), {
      user: { accessKeyData: { id: 7 } },
      aborted: false,
    });
    const res = Object.assign(new EventEmitter(), { writableFinished: true });
    const service = {
      retry: jest.fn(async (_id, _body, _actor, signal) => {
        res.emit('close');
        expect(signal.aborted).toBe(false);
        return { status: 'succeeded' };
      }),
    };
    const controller = new StudioExecutionController(service as any);
    expect(await controller.retry('id', {}, req, res)).toEqual({ status: 'succeeded' });
    expect(service.retry).toHaveBeenCalledWith('id', {}, 7, expect.any(AbortSignal), 0);
  });
  it.each([9, 4])(
    'forwards the exact request epoch %s for explicit remix confirmation',
    async epoch => {
      const remix = jest.fn().mockResolvedValue({ status: 'succeeded' });
      const controller = new StudioExecutionController({ remix } as any);
      const body = { requestId: 'confirm' };
      await controller.remix('run-id', body, {
        user: { accessKeyData: { id: 7, authVersion: epoch } },
      });
      expect(remix).toHaveBeenCalledWith('run-id', body, 7, epoch);
    },
  );
});

describe('execution POSTs as an NDJSON stream', () => {
  const streamReq = () =>
    Object.assign(new EventEmitter(), {
      user: { accessKeyData: { id: 7, authVersion: 3 } },
      headers: { accept: 'application/x-ndjson' },
      aborted: false,
    });
  const res = () =>
    Object.assign(new EventEmitter(), { writableFinished: false, setHeader: jest.fn() });
  const read = async (file: StreamableFile) => {
    let text = '';
    for await (const chunk of file.getStream()) text += chunk.toString();
    return text
      .split('\n')
      .filter(Boolean)
      .map(line => JSON.parse(line));
  };

  it.each([
    ['create', (c: any, r: any, w: any) => c.create({ requestId: 'req-1' }, r, w), 'req:7:req-1'],
    ['retry', (c: any, r: any, w: any) => c.retry('run-9', {}, r, w), 'run:7:run-9'],
  ])('%s streams the persisted steps and then the result, watching %#', async (name, call, key) => {
    let listener: (event: any) => void = () => undefined;
    const unwatch = jest.fn();
    const watch = jest.fn((_key: string, fn: any) => {
      listener = fn;
      return unwatch;
    });
    const finish = async () => {
      listener({ type: 'step', runId: 'run-9', status: 'running', steps: [] });
      return { status: 'succeeded' };
    };
    const service: any = { watch, [name]: jest.fn(finish) };
    const out = call(new StudioExecutionController(service), streamReq(), res());
    expect(out).toBeInstanceOf(StreamableFile);
    expect(await read(out)).toEqual([
      { type: 'start' },
      { type: 'step', runId: 'run-9', status: 'running', steps: [] },
      { type: 'result', data: { status: 'succeeded' } },
    ]);
    expect(watch).toHaveBeenCalledWith(key, expect.any(Function));
    expect(unwatch).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['creationMessage', (c: any, r: any, w: any) => c.creationMessage('run-9', {}, r, w)],
    ['clarifyCreation', (c: any, r: any, w: any) => c.clarifyCreation('run-9', {}, r, w)],
  ])(
    '%s has no persisted steps to report: it streams only start and the result',
    async (name, call) => {
      // No `watch` on the service: the route must not subscribe to events nothing publishes.
      const service: any = { [name]: jest.fn(async () => ({ status: 'succeeded' })) };
      const out = call(new StudioExecutionController(service), streamReq(), res());
      expect(out).toBeInstanceOf(StreamableFile);
      expect(await read(out)).toEqual([
        { type: 'start' },
        { type: 'result', data: { status: 'succeeded' } },
      ]);
    },
  );

  it('still answers a plain JSON request with the bare result', async () => {
    const req = Object.assign(new EventEmitter(), {
      user: { accessKeyData: { id: 7 } },
      headers: { accept: 'application/json' },
      aborted: false,
    });
    const service: any = {
      watch: jest.fn(),
      create: jest.fn(async () => ({ status: 'succeeded' })),
    };
    const out = new StudioExecutionController(service).create({ requestId: 'r' }, req, res());
    await expect(out).resolves.toEqual({ status: 'succeeded' });
    expect(service.watch).not.toHaveBeenCalled();
  });

  it('closing the connection mid-stream aborts the run it started', async () => {
    const r = res();
    let signal!: AbortSignal;
    const service: any = {
      watch: jest.fn(() => () => undefined),
      create: jest.fn(
        (_b, _a, s: AbortSignal) =>
          (signal = s) &&
          new Promise((_resolve, reject) =>
            s.addEventListener('abort', () => reject(new Error('LLM_REQUEST_ABORTED'))),
          ),
      ),
    };
    const out = new StudioExecutionController(service).create(
      { requestId: 'r' },
      streamReq(),
      r,
    ) as StreamableFile;
    r.emit('close');
    await new Promise(resolve => setImmediate(resolve));
    expect(signal.aborted).toBe(true);
    out.getStream().destroy();
  });
});
