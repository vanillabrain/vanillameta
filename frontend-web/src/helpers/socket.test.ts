import { afterEach, describe, expect, it, vi } from 'vitest';

const io = vi.fn(() => ({ connected: false, id: undefined }));
vi.mock('socket.io-client', () => ({ io }));

async function connectWith(apiUrl: string | undefined) {
  vi.resetModules();
  io.mockClear();
  vi.stubEnv('REACT_APP_API_URL', apiUrl ?? '');
  const { connectSocket } = await import('./socket');
  connectSocket();
  return io.mock.calls[0] as unknown as [string, unknown];
}

describe('connectSocket', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('uses the page origin when the API URL is relative (production image)', async () => {
    const [url] = await connectWith('/v1');
    expect(url).toBe(`${window.location.origin}/query-progress`);
  });

  it('uses the origin of an absolute API URL', async () => {
    const [url] = await connectWith('https://api.example.com/v1');
    expect(url).toBe('https://api.example.com/query-progress');
  });

  it('falls back to the page origin when no API URL is set', async () => {
    const [url] = await connectWith(undefined);
    expect(url).toBe(`${window.location.origin}/query-progress`);
  });
});
