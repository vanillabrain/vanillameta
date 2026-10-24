jest.mock('../ai/ai.service', () => ({ AiService: class {} }));
import { StreamableFile } from '@nestjs/common';
import { EventEmitter } from 'events';
import { StudioCreationController } from './studio-creation.controller';

describe('POST /studio/proposals', () => {
  const req = (accept: string) =>
    Object.assign(new EventEmitter(), {
      user: { accessKeyData: { id: 7, authVersion: 4 } },
      headers: { accept },
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

  it('answers plain JSON with the proposal and passes the user, the signal and the epoch on', async () => {
    const creation: any = { propose: jest.fn(async () => ({ proposalId: 'p1' })) };
    const out = new StudioCreationController(creation, {} as any).propose(
      { sourceId: 1 },
      req('application/json'),
      res(),
    );
    await expect(out).resolves.toEqual({ proposalId: 'p1' });
    expect(creation.propose).toHaveBeenCalledWith({ sourceId: 1 }, 7, expect.any(AbortSignal), 4);
  });

  it('streams start then result for the NDJSON header', async () => {
    const creation: any = { propose: jest.fn(async () => ({ proposalId: 'p1' })) };
    const out = new StudioCreationController(creation, {} as any).propose(
      { sourceId: 1 },
      req('application/x-ndjson'),
      res(),
    );
    expect(out).toBeInstanceOf(StreamableFile);
    expect(await read(out as StreamableFile)).toEqual([
      { type: 'start' },
      { type: 'result', data: { proposalId: 'p1' } },
    ]);
  });

  it('cancels the proposal when the connection closes mid-stream', async () => {
    const r = res();
    let signal!: AbortSignal;
    const creation: any = {
      propose: jest.fn(
        (_b, _a, s: AbortSignal) =>
          (signal = s) &&
          new Promise((_resolve, reject) =>
            s.addEventListener('abort', () => reject(new Error('LLM_REQUEST_ABORTED'))),
          ),
      ),
    };
    const out = new StudioCreationController(creation, {} as any).propose(
      { sourceId: 1 },
      req('application/x-ndjson'),
      r,
    ) as StreamableFile;
    r.emit('close');
    await new Promise(resolve => setImmediate(resolve));
    expect(signal.aborted).toBe(true);
    out.getStream().destroy();
  });
});
