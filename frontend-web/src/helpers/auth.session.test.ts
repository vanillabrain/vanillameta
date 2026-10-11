import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getToken, setToken, STORAGE_ACCESS_TOKEN } from './authHelper';

const seam = vi.hoisted(() => ({ refresh: vi.fn(), share: vi.fn() }));
vi.mock('@/api/authService', () => ({ default: { refreshAccessToken: seam.refresh } }));
vi.mock('@/helpers/shareHelper', () => ({ getShareToken: seam.share }));
vi.mock('@/helpers/socket', () => ({ getSocketId: () => undefined }));

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
  seam.refresh.mockReset();
  seam.share.mockReset();
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('access-token storage recovery', () => {
  it.each(['malformed-json', '{}', '[]', '1', 'null', '""', '"   "'])(
    'returns null and removes only the malformed access key %s',
    value => {
      localStorage.setItem(STORAGE_ACCESS_TOKEN, value);
      localStorage.setItem('profile', 'retain-profile');
      expect(getToken()).toBeNull();
      expect(localStorage.getItem(STORAGE_ACCESS_TOKEN)).toBeNull();
      expect(localStorage.getItem('profile')).toBe('retain-profile');
    },
  );
  it('accepts a nonempty JSON string token', () => {
    setToken('unit-access-fixture');
    expect(getToken() === 'unit-access-fixture').toBe(true);
  });
});

const expired = (config: any, body: unknown = { data: 'accessTokenExpired' }) =>
  Object.assign(new Error('expired-unit-session'), { config, response: { status: 401, data: body, config } });
const ok = (config: any, value: string) => ({ config, status: 200, statusText: 'OK', headers: {}, data: { value } });

const load = async () => {
  const { default: api } = await import('./apiHelper');
  return api;
};

describe('axios refresh response forwarding and shared inflight recovery', () => {
  it('enables credential cookies and returns the retried response for legacy error data', async () => {
    setToken('unit-expired-fixture');
    seam.refresh.mockResolvedValue({ data: { accessToken: 'unit-new-fixture' } });
    const api = await load();
    expect(api.defaults.withCredentials).toBe(true);
    api.defaults.adapter = async config => {
      if ((config.headers as any).Authorization === 'Bearer unit-new-fixture') return ok(config, 'retried');
      throw expired(config);
    };
    expect((await api.get('/unit-private')).data).toEqual({ value: 'retried' });
    expect(seam.refresh).toHaveBeenCalledTimes(1);
  });

  it('shares a single pending refresh across concurrent expired requests', async () => {
    setToken('unit-expired-fixture');
    let release: (result: any) => void;
    seam.refresh.mockImplementation(
      () =>
        new Promise(resolve => {
          release = resolve;
        }),
    );
    const api = await load();
    api.defaults.adapter = async config => {
      if ((config.headers as any).Authorization === 'Bearer unit-new-fixture') return ok(config, config.url);
      throw expired(config, { message: 'accessTokenExpired' });
    };
    const settled = Promise.allSettled([api.get('/unit-one'), api.get('/unit-two')]);
    await vi.waitFor(() => expect(seam.refresh).toHaveBeenCalledTimes(1));
    release({ data: { accessToken: 'unit-new-fixture' } });
    const results = await settled;
    expect(results.map(result => result.status)).toEqual(['fulfilled', 'fulfilled']);
    expect(seam.refresh).toHaveBeenCalledTimes(1);
  });

  it('rejects every queued request on refresh failure, removes only access state and releases inflight state', async () => {
    setToken('unit-expired-fixture');
    localStorage.setItem('profile', 'retain-profile');
    let rejectRefresh: (error: Error) => void;
    seam.refresh.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectRefresh = reject;
        }),
    );
    const api = await load();
    const assign = vi.fn();
    vi.stubGlobal('window', { location: { assign }, localStorage });
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    api.defaults.adapter = async config => {
      throw expired(config, { message: 'accessTokenExpired' });
    };
    const settled = Promise.allSettled([api.get('/unit-one'), api.get('/unit-two')]);
    await vi.waitFor(() => expect(seam.refresh).toHaveBeenCalledTimes(1));
    rejectRefresh(new Error('unit-refresh-denied'));
    const results = await Promise.race([settled, new Promise(resolve => setTimeout(() => resolve('still-pending'), 500))]);
    expect(Array.isArray(results)).toBe(true);
    if (Array.isArray(results)) expect(results.map(result => result.status)).toEqual(['rejected', 'rejected']);
    expect(localStorage.getItem(STORAGE_ACCESS_TOKEN)).toBeNull();
    expect(localStorage.getItem('profile')).toBe('retain-profile');
    expect(assign).toHaveBeenCalledWith('/login');
    expect(log.mock.calls.length === 0).toBe(true);
    seam.refresh.mockResolvedValue({ data: { accessToken: 'unit-new-fixture' } });
    setToken('unit-expired-again');
    api.defaults.adapter = async config => {
      if ((config.headers as any).Authorization === 'Bearer unit-new-fixture') return ok(config, 'recovered');
      throw expired(config, { data: { message: 'accessTokenExpired' } });
    };
    expect((await api.get('/unit-three')).data).toEqual({ value: 'recovered' });
    expect(seam.refresh).toHaveBeenCalledTimes(2);
  });

  it('does not refresh indefinitely when the retried request still returns 401', async () => {
    setToken('unit-expired-fixture');
    seam.refresh.mockResolvedValue({ data: { accessToken: 'unit-new-fixture' } });
    const api = await load();
    api.defaults.adapter = async config => {
      throw expired(config);
    };
    const result = await Promise.allSettled([api.get('/unit-still-denied')]);
    expect(result[0].status).toBe('rejected');
    expect(seam.refresh).toHaveBeenCalledTimes(1);
  });

  it('a prior public-share request does not poison subsequent normal-bearer recovery', async () => {
    seam.share.mockReturnValue('unit-share-fixture');
    const api = await load();
    api.defaults.adapter = async config => ok(config, 'public');
    await api.get('/database/data');
    setToken('unit-expired-fixture');
    seam.refresh.mockResolvedValue({ data: { accessToken: 'unit-new-fixture' } });
    api.defaults.adapter = async config => {
      if ((config.headers as any).Authorization === 'Bearer unit-new-fixture') return ok(config, 'normal');
      throw expired(config);
    };
    expect((await api.get('/unit-private')).data).toEqual({ value: 'normal' });
    expect(seam.refresh).toHaveBeenCalledTimes(1);
  });
});
