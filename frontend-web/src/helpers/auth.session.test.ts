import { webcrypto } from 'node:crypto';
import { editorDraftKey } from './editorDraftStorage';
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
    vi.stubGlobal('crypto', webcrypto);
    const draftKey = await editorDraftKey('unit-expired-fixture', 8);
    if (!draftKey) throw new Error('missing scope');
    sessionStorage.setItem(draftKey, 'preserved-draft');
    seam.refresh.mockResolvedValue({ data: { accessToken: 'unit-new-fixture' } });
    const api = await load();
    expect(api.defaults.withCredentials).toBe(true);
    api.defaults.adapter = async config => {
      if ((config.headers as any).Authorization === 'Bearer unit-new-fixture') return ok(config, 'retried');
      throw expired(config);
    };
    expect((await api.get('/unit-private')).data).toEqual({ value: 'retried' });
    expect(await editorDraftKey('unit-new-fixture', 8)).toBe(draftKey);
    expect(sessionStorage.getItem(draftKey)).toBe('preserved-draft');
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
    rejectRefresh(Object.assign(new Error('unit-refresh-denied'), { response: { status: 401 } }));
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

describe('logged-in shared widget boundary', () => {
  afterEach(() => window.history.replaceState({}, '', '/'));
  it('uses only the scoped share token for widget reads on a share page, but user auth for reuse', async () => {
    window.history.replaceState({}, '', '/share/unit-link');
    setToken('unit-owner-session');
    seam.share.mockReturnValue('unit-scoped-share');
    const api = await load();
    api.defaults.adapter = async config => {
      if (config.url === '/database/data') {
        expect(config.headers.Authorization).toBeUndefined();
        expect(config.headers['Authorization-url']).toBe('Bearer unit-scoped-share');
      } else {
        expect(config.headers.Authorization).toBe('Bearer unit-owner-session');
        expect(config.headers['Authorization-url']).toBeUndefined();
      }
      return ok(config, 'allowed');
    };
    await api.get('/database/data');
    await api.get('/bi/reuse/share/unit-link');
    await api.get('/database/info/23');
  });
});

describe('UC028 refresh completion after another tab changes authentication', () => {
  it.each(['success', 'failure'])('preserves a newer login on a late refresh %s', async outcome => {
    vi.stubGlobal('crypto', webcrypto);
    setToken('unit-previous-login');
    let resolve: (value: any) => void, reject: (error: Error) => void;
    seam.refresh.mockImplementation(
      () =>
        new Promise((yes, no) => {
          resolve = yes;
          reject = no;
        }),
    );
    const api = await load();
    const assign = vi.fn();
    vi.stubGlobal('window', { location: { assign }, localStorage });
    api.defaults.adapter = async config => {
      throw expired(config);
    };
    const settled = Promise.allSettled([api.get('/unit-private')]);
    await vi.waitFor(() => expect(seam.refresh).toHaveBeenCalledTimes(1));
    setToken('unit-new-login');
    const namespace = localStorage.getItem('vm:editor-draft-auth:v1');
    if (outcome === 'success') resolve({ data: { accessToken: 'unit-stale-refresh' } });
    else reject(new Error('late refresh denied'));
    expect((await settled)[0].status).toBe('rejected');
    expect(getToken()).toBe('unit-new-login');
    expect(localStorage.getItem('vm:editor-draft-auth:v1')).toBe(namespace);
    expect(assign).not.toHaveBeenCalled();
  });
});

it('UC028 keeps a successful token renewal usable when only shared draft metadata writes fail', async () => {
  vi.stubGlobal('crypto', webcrypto);
  setToken('unit-old');
  const original = Storage.prototype.setItem;
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
    if (this === localStorage && key === 'vm:editor-draft-auth:v1') throw new Error('metadata quota');
    return original.call(this, key, value);
  });
  seam.refresh.mockResolvedValue({ data: { accessToken: 'unit-new' } });
  const api = await load();
  api.defaults.adapter = async config => {
    if ((config.headers as any).Authorization === 'Bearer unit-new') return ok(config, 'retried');
    throw expired(config);
  };
  expect((await api.get('/unit-private')).data).toEqual({ value: 'retried' });
  expect(getToken()).toBe('unit-new');
});

describe('UC029 cross-tab renewal coordination', () => {
  it('uses one refresh for two independent axios modules waiting on the same browser lock', async () => {
    vi.stubGlobal('crypto', webcrypto);
    setToken('unit-old');
    let tail = Promise.resolve();
    const lock = vi.fn((_name, _options, run) => {
      const next = tail.then(run);
      tail = next.catch(() => undefined);
      return next;
    });
    vi.stubGlobal('navigator', { locks: { request: lock } });
    const first = await load();
    vi.resetModules();
    const second = await load();
    let release: (value: any) => void;
    seam.refresh.mockImplementation(
      () =>
        new Promise(resolve => {
          release = resolve;
        }),
    );
    const adapter = async config => {
      if (config.headers.Authorization === 'Bearer unit-new') return ok(config, 'retried');
      throw expired(config);
    };
    first.defaults.adapter = adapter;
    second.defaults.adapter = adapter;
    const results = Promise.all([first.get('/unit-first'), second.get('/unit-second')]);
    await vi.waitFor(() => expect(lock).toHaveBeenCalledTimes(2));
    expect(seam.refresh).toHaveBeenCalledTimes(1);
    release({ data: { accessToken: 'unit-new' } });
    expect((await results).map(r => r.data.value)).toEqual(['retried', 'retried']);
    expect(seam.refresh).toHaveBeenCalledTimes(1);
  });
  it('reuses a winning token when an old 401 arrives after another tab already renewed', async () => {
    vi.stubGlobal('crypto', webcrypto);
    setToken('unit-old');
    let reject: (error: unknown) => void, original: any;
    const api = await load();
    api.defaults.adapter = async config => {
      if (config.headers.Authorization === 'Bearer unit-new') return ok(config, 'retried');
      original = config;
      return new Promise((_yes, no) => {
        reject = no;
      });
    };
    const pending = api.get('/unit-late');
    await vi.waitFor(() => expect(original).toBeDefined());
    const { retainEditorDraftSession } = await import('./editorDraftStorage');
    await retainEditorDraftSession('unit-old', 'unit-new');
    setToken('unit-new', true);
    reject(expired(original));
    expect((await pending).data.value).toBe('retried');
    expect(seam.refresh).not.toHaveBeenCalled();
  });
  it('rejects a queued old request on same-token new login without refreshing or deleting the new auth', async () => {
    vi.stubGlobal('crypto', webcrypto);
    setToken('unit-old');
    let release: () => void;
    const lock = vi.fn(
      (_name, _options, run) =>
        new Promise((resolve, reject) => {
          release = () => Promise.resolve().then(run).then(resolve, reject);
        }),
    );
    vi.stubGlobal('navigator', { locks: { request: lock } });
    const api = await load();
    api.defaults.adapter = async config => {
      throw expired(config);
    };
    const settled = Promise.allSettled([api.get('/unit-queued')]);
    await vi.waitFor(() => expect(lock).toHaveBeenCalledTimes(1));
    setToken('unit-old');
    const generation = localStorage.getItem('vm:editor-draft-auth:v1');
    release();
    expect((await settled)[0].status).toBe('rejected');
    expect(getToken()).toBe('unit-old');
    expect(localStorage.getItem('vm:editor-draft-auth:v1')).toBe(generation);
    expect(seam.refresh).not.toHaveBeenCalled();
  });
  it('preserves the auth and draft on lock failure without trying an unlocked refresh', async () => {
    vi.stubGlobal('crypto', webcrypto);
    setToken('unit-old');
    const key = await editorDraftKey('unit-old', 8);
    sessionStorage.setItem(key, 'preserved');
    vi.stubGlobal('navigator', { locks: { request: vi.fn().mockRejectedValue(new Error('lock denied')) } });
    const api = await load();
    api.defaults.adapter = async config => {
      throw expired(config);
    };
    await expect(api.get('/unit-lock-failure')).rejects.toThrow('lock denied');
    expect(getToken()).toBe('unit-old');
    expect(sessionStorage.getItem(key)).toBe('preserved');
    expect(seam.refresh).not.toHaveBeenCalled();
  });
  it('bounds lock waiting to ten seconds and leaves the next explicit request retryable', async () => {
    vi.useFakeTimers();
    try {
      vi.stubGlobal('crypto', webcrypto);
      setToken('unit-old');
      const lock = vi
        .fn()
        .mockImplementationOnce(
          (_name, options) =>
            new Promise((_yes, no) => {
              options.signal.addEventListener('abort', () => no(new DOMException('lock wait expired', 'AbortError')));
            }),
        )
        .mockImplementation((_name, _options, run) => run());
      vi.stubGlobal('navigator', { locks: { request: lock } });
      const api = await load();
      api.defaults.adapter = async config => {
        if (config.headers.Authorization === 'Bearer unit-new') return ok(config, 'retried');
        throw expired(config);
      };
      const settled = Promise.allSettled([api.get('/unit-timeout')]);
      await vi.waitFor(() => expect(lock).toHaveBeenCalledTimes(1));
      await vi.advanceTimersByTimeAsync(10000);
      expect((await settled)[0].status).toBe('rejected');
      expect(getToken()).toBe('unit-old');
      expect(seam.refresh).not.toHaveBeenCalled();
      seam.refresh.mockResolvedValue({ data: { accessToken: 'unit-new' } });
      expect((await api.get('/unit-retry')).data.value).toBe('retried');
    } finally {
      vi.useRealTimers();
    }
  });
});

it('UC029 does not replay a late old 401 under a newer login generation', async () => {
  vi.stubGlobal('crypto', webcrypto);
  setToken('unit-old');
  const lock = vi.fn((_name, _options, run) => run());
  vi.stubGlobal('navigator', { locks: { request: lock } });
  let reject: (error: unknown) => void, original: any;
  const api = await load();
  api.defaults.adapter = async config => {
    original = config;
    return new Promise((_yes, no) => {
      reject = no;
    });
  };
  const settled = Promise.allSettled([api.get('/unit-delayed-old')]);
  await vi.waitFor(() => expect(original).toBeDefined());
  setToken('unit-new-login');
  reject(expired(original));
  expect((await settled)[0].status).toBe('rejected');
  expect(getToken()).toBe('unit-new-login');
  expect(lock).not.toHaveBeenCalled();
  expect(seam.refresh).not.toHaveBeenCalled();
});

describe('UC030 interrupted token renewal', () => {
  it.each([
    ['server unavailable', { response: { status: 503 } }],
    ['network error', {}],
    ['network timeout', { code: 'ECONNABORTED' }],
    ['malformed success', null],
  ])('preserves drafts and login after %s and permits explicit retry', async (_label, failure) => {
    vi.stubGlobal('crypto', webcrypto);
    setToken('unit-old');
    const key = await editorDraftKey('unit-old', 8);
    sessionStorage.setItem(key, JSON.stringify({ prompt: 'keep my question', draft: 'unsaved' }));
    const generation = localStorage.getItem('vm:editor-draft-auth:v1');
    const assign = vi.fn();
    vi.stubGlobal('window', { location: { assign }, localStorage });
    if (failure === null) seam.refresh.mockResolvedValueOnce({ data: {} });
    else seam.refresh.mockRejectedValueOnce(Object.assign(new Error('temporary renewal failure'), failure));
    const api = await load();
    api.defaults.adapter = async config => {
      if (config.headers.Authorization === 'Bearer unit-new') return ok(config, 'recovered');
      throw expired(config);
    };
    await expect(api.get('/unit-transient')).rejects.toThrow();
    expect(getToken()).toBe('unit-old');
    expect(localStorage.getItem('vm:editor-draft-auth:v1')).toBe(generation);
    expect(JSON.parse(sessionStorage.getItem(key))).toEqual({ prompt: 'keep my question', draft: 'unsaved' });
    expect(assign).not.toHaveBeenCalled();
    expect(seam.refresh).toHaveBeenCalledTimes(1);
    seam.refresh.mockResolvedValueOnce({ data: { accessToken: 'unit-new' } });
    expect((await api.get('/unit-explicit-retry')).data.value).toBe('recovered');
    expect(await editorDraftKey('unit-new', 8)).toBe(key);
    expect(seam.refresh).toHaveBeenCalledTimes(2);
  });
  it.each([401, 403])('retains the explicit authentication rejection contract for refresh %s', async status => {
    vi.stubGlobal('crypto', webcrypto);
    setToken('unit-old');
    const key = await editorDraftKey('unit-old', 8);
    sessionStorage.setItem(key, 'old draft');
    const assign = vi.fn();
    vi.stubGlobal('window', { location: { assign }, localStorage });
    seam.refresh.mockRejectedValueOnce(Object.assign(new Error('renewal rejected'), { response: { status } }));
    const api = await load();
    api.defaults.adapter = async config => {
      throw expired(config);
    };
    await expect(api.get('/unit-rejected')).rejects.toThrow();
    expect(getToken()).toBeNull();
    expect(sessionStorage.getItem(key)).toBeNull();
    expect(assign).toHaveBeenCalledWith('/login');
  });
});
