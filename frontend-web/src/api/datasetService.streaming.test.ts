import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReadableStream } from 'node:stream/web';
import { TextEncoder, TextDecoder } from 'node:util';
const auth = vi.hoisted(() => ({ token: 'owner-token', epoch: 'epoch-1' }));
vi.mock('@/helpers/authHelper', () => ({ getToken: () => auth.token }));
vi.mock('@/helpers/editorDraftStorage', () => ({ editorDraftSessionEpoch: () => auth.epoch }));
vi.mock('@/helpers/apiHelper', () => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn() }));
import { streamDataset } from './datasetService';

beforeEach(() => {
  auth.token = 'owner-token';
  auth.epoch = 'epoch-1';
  vi.stubGlobal('TextEncoder', TextEncoder);
  vi.stubGlobal('TextDecoder', TextDecoder);
});
afterEach(() => vi.unstubAllGlobals());
function response(chunks: string[]) {
  const encoder = new TextEncoder();
  return {
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'application/x-ndjson' }),
    body: new ReadableStream({
      start(controller) {
        chunks.forEach(chunk => {
          const bytes = encoder.encode(chunk);
          const unicodeByte = bytes.findIndex(byte => byte > 127);
          if (unicodeByte >= 0) {
            controller.enqueue(bytes.slice(0, unicodeByte + 1));
            controller.enqueue(bytes.slice(unicodeByte + 1));
          } else controller.enqueue(bytes);
        });
        controller.close();
      },
    }),
  };
}
describe('retained dataset NDJSON streaming contract', () => {
  it('decodes split JSON/UTF8 and normalizes server row messages without reconnecting', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        response([
          '{"type":"fields","data":[]}\n{"type":"data","da',
          'ta":{"name":"한국","value":4}}\n{"type":"complete","rowCount":1}',
        ]),
      );
    vi.stubGlobal('fetch', fetcher);
    const onData = vi.fn(),
      onComplete = vi.fn();
    await streamDataset('42', { onData, onComplete });
    expect(onData).toHaveBeenCalledExactlyOnceWith({ rows: [{ name: '한국', value: 4 }] });
    expect(onComplete).toHaveBeenCalledOnce();
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher.mock.calls[0][0]).toMatch(/\/dataset\/42\/stream$/);
    expect(fetcher.mock.calls[0][1].headers.Authorization).toBe('Bearer owner-token');
  });
  it('rejects an interrupted or malformed stream instead of reporting completion', async () => {
    const onComplete = vi.fn(),
      onError = vi.fn();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(['{"type":"data","data":{"v":1}}\n'])));
    await expect(streamDataset('42', { onData: vi.fn(), onComplete, onError })).rejects.toThrow('완료 전에');
    expect(onComplete).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledOnce();
  });
  it('does not publish a response from the previous session', async () => {
    const onData = vi.fn(),
      onComplete = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async () => {
        auth.epoch = 'epoch-2';
        return response(['{"type":"data","data":{"private":1}}\n{"type":"complete"}\n']);
      }),
    );
    await streamDataset('42', { onData, onComplete });
    expect(onData).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
  });
});
