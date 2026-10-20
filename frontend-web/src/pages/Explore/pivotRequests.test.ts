import { expect, it, vi } from 'vitest';
import { acquirePivotRequest } from './pivotRequests';
const api = vi.hoisted(() => ({ post: vi.fn(), scope: 'A', missing: false }));
vi.mock('@/helpers/apiHelper', () => ({ post: api.post }));
vi.mock('@/helpers/authResponseFence', () => ({
  captureAuthResponseFence: () => {
    const scope = api.scope;
    return () => {
      if (api.missing || scope !== api.scope) throw new Error('changed identity');
    };
  },
}));
it('shares pending queries without aborting surviving subscribers or caching settled data', async () => {
  let resolve: (value: any) => void = () => {
    throw new Error('missing resolver');
  };
  api.post.mockImplementationOnce(() => new Promise(r => (resolve = r))).mockResolvedValue({ data: 2 });
  const pool = new Map();
  const first = acquirePivotRequest(pool, 'same', {});
  const second = acquirePivotRequest(pool, 'same', {});
  expect(api.post).toHaveBeenCalledTimes(1);
  first.release();
  expect(api.post.mock.calls[0][2].signal.aborted).toBe(false);
  resolve({ data: 1 });
  expect(await second.promise).toEqual({ data: 1 });
  const fresh = acquirePivotRequest(pool, 'same', {});
  expect(await fresh.promise).toEqual({ data: 2 });
  expect(api.post).toHaveBeenCalledTimes(2);
  second.release();
  fresh.release();
});
it('separates keys, aborts the last subscriber and permits failed-query retry', async () => {
  api.post.mockClear();
  api.post.mockImplementation(() => new Promise(() => undefined));
  const pool = new Map();
  const a = acquirePivotRequest(pool, 'a', {});
  const b = acquirePivotRequest(pool, 'b', {});
  expect(api.post).toHaveBeenCalledTimes(2);
  a.release();
  expect(api.post.mock.calls[0][2].signal.aborted).toBe(true);
  expect(api.post.mock.calls[1][2].signal.aborted).toBe(false);
  b.release();
  api.post.mockRejectedValueOnce(new Error('503'));
  await expect(acquirePivotRequest(pool, 'b', {}).promise).rejects.toThrow('503');
  api.post.mockResolvedValueOnce({ data: 3 });
  expect(await acquirePivotRequest(pool, 'b', {}).promise).toEqual({ data: 3 });
});

it('never lets a new identity subscribe to an earlier identity pending request', async () => {
  api.post.mockClear();
  api.scope = 'A';
  const resolvers: Array<(r: any) => void> = [];
  api.post.mockImplementation(() => new Promise(resolve => resolvers.push(resolve)));
  const pool = new Map();
  const a = acquirePivotRequest(pool, 'same', {}, '/bi/explore/segments');
  api.scope = 'B';
  const b = acquirePivotRequest(pool, 'same', {}, '/bi/explore/segments');
  expect(api.post).toHaveBeenCalledTimes(2);
  const rejected = expect(a.promise).rejects.toThrow('changed identity');
  resolvers[0]({ data: 'private A' });
  resolvers[1]({ data: 'B' });
  await rejected;
  expect(await b.promise).toEqual({ data: 'B' });
  a.release();
  b.release();
  api.scope = 'A';
});

it('rejects asynchronously without POST when auth disappears before dispatch', async () => {
  api.post.mockClear();
  api.missing = true;
  const request = acquirePivotRequest(new Map(), 'missing', {});
  await expect(request.promise).rejects.toThrow('changed identity');
  expect(api.post).not.toHaveBeenCalled();
  request.release();
  api.missing = false;
});
