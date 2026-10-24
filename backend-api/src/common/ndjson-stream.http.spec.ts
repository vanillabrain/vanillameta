import { Controller, Get, Module, Post, Req, Res } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { AddressInfo } from 'net';
import { ApiExceptionFilter } from '../nest-utils/api-exception.filter';
import { HttpExceptionFilter } from '../nest-utils/http-exception.filter';
import { serveRun } from './ndjson-stream';

/**
 * The route-level behaviour over a real socket: what the browser would see, through the same global
 * filter main.ts registers. No database; the run is a controllable promise.
 */
const state: {
  release?: (value: unknown) => void;
  reject?: (error: unknown) => void;
  signal?: AbortSignal;
  watcher?: (event: any) => void;
} = {};

@Controller('t')
class ProbeController {
  @Post('run')
  run(@Req() req, @Res({ passthrough: true }) res) {
    return serveRun(
      req,
      res,
      signal => {
        state.signal = signal;
        return new Promise((resolve, reject) => {
          state.release = resolve;
          state.reject = reject;
        });
      },
      {
        heartbeatMs: 50,
        watch: emit => {
          state.watcher = emit;
          return () => undefined;
        },
      },
    );
  }
  @Get('plain')
  plain() {
    return { ok: true };
  }
}
@Module({ controllers: [ProbeController] })
class ProbeModule {}

describe('NDJSON over a real socket', () => {
  let app: any;
  let base: string;
  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [ProbeModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalFilters(
      new ApiExceptionFilter(app.get(HttpAdapterHost).httpAdapter, new HttpExceptionFilter()),
    );
    await app.listen(0, '127.0.0.1');
    base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
  });
  afterAll(async () => app.close());
  beforeEach(() => {
    for (const key of Object.keys(state)) delete state[key];
  });

  const open = (headers: Record<string, string>, init: RequestInit = {}) =>
    fetch(`${base}/t/run`, { method: 'POST', headers, ...init });
  const nextLine = async (
    reader: ReadableStreamDefaultReader<Uint8Array>,
    buffer: { text: string },
  ) => {
    const decoder = new TextDecoder();
    while (!buffer.text.includes('\n')) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer.text += decoder.decode(value);
    }
    const index = buffer.text.indexOf('\n');
    const line = buffer.text.slice(0, index);
    buffer.text = buffer.text.slice(index + 1);
    return line ? JSON.parse(line) : undefined;
  };

  it('sends the first line before the run finishes, then progress, heartbeats and the result', async () => {
    const response = await open({ accept: 'application/x-ndjson' });
    expect(response.headers.get('content-type')).toContain('application/x-ndjson');
    expect(response.headers.get('x-accel-buffering')).toBe('no');
    expect(response.headers.get('cache-control')).toContain('no-transform');
    const reader = response.body!.getReader();
    const buffer = { text: '' };
    // The headers and this line arrived while the run is still pending: nothing waited for the model.
    expect(await nextLine(reader, buffer)).toEqual({ type: 'start' });
    expect(state.release).toBeDefined();
    state.watcher!({ type: 'step', runId: 'r', status: 'running', steps: [] });
    expect(await nextLine(reader, buffer)).toMatchObject({ type: 'step', status: 'running' });
    expect((await nextLine(reader, buffer)).type).toBe('heartbeat');
    state.release!({ status: 'succeeded' });
    let last: any;
    for (;;) {
      const line = await nextLine(reader, buffer);
      if (!line) break;
      last = line;
      if (line.type === 'result') break;
    }
    expect(last).toEqual({ type: 'result', data: { status: 'succeeded' } });
  });

  it('reports a gateway failure as an error event in the stream, status 200 already sent', async () => {
    const response = await open({ accept: 'application/x-ndjson' });
    const reader = response.body!.getReader();
    const buffer = { text: '' };
    await nextLine(reader, buffer);
    state.reject!(new Error('LLM_TIMEOUT'));
    let line: any;
    do line = await nextLine(reader, buffer);
    while (line && line.type === 'heartbeat');
    expect(response.status).toBeLessThan(300);
    expect(line).toMatchObject({ type: 'error', status: 504, error: 'LLM_TIMEOUT' });
  });

  it('cancels the run when the browser goes away', async () => {
    const client = new AbortController();
    const response = await open({ accept: 'application/x-ndjson' }, { signal: client.signal });
    const reader = response.body!.getReader();
    await nextLine(reader, { text: '' });
    expect(state.signal!.aborted).toBe(false);
    client.abort();
    for (let i = 0; i < 100 && !state.signal!.aborted; i++)
      await new Promise(resolve => setTimeout(resolve, 20));
    expect(state.signal!.aborted).toBe(true);
    state.reject!(new Error('LLM_REQUEST_ABORTED'));
  });

  it('answers the same route as plain JSON, with the old status, without the header', async () => {
    const pending = open({ accept: 'application/json' });
    for (let i = 0; i < 100 && !state.release; i++)
      await new Promise(resolve => setTimeout(resolve, 20));
    state.release!({ status: 'succeeded' });
    const response = await pending;
    expect(response.status).toBe(201);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toEqual({ status: 'succeeded' });
  });

  it('answers a failing JSON run through the global filter: 504 in the HttpException body shape', async () => {
    const pending = open({ accept: 'application/json' });
    for (let i = 0; i < 100 && !state.reject; i++)
      await new Promise(resolve => setTimeout(resolve, 20));
    state.reject!(new Error('LLM_TIMEOUT'));
    const response = await pending;
    expect(response.status).toBe(504);
    expect(await response.json()).toMatchObject({
      success: false,
      code: 504,
      data: { error: 'LLM_TIMEOUT', message: expect.any(String) },
    });
  });

  it('leaves unrelated routes alone', async () => {
    expect(await (await fetch(`${base}/t/plain`)).json()).toEqual({ ok: true });
  });
});
