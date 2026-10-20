import { post } from '@/helpers/apiHelper';
import { captureAuthResponseFence } from '@/helpers/authResponseFence';

type Entry = { controller: AbortController; promise: ReturnType<typeof post>; users: number; checkAuth: () => void };
/** One dashboard mount owns this pool; settled data is never cached. */
export type PivotRequestPool = Map<string, Entry>;
export function acquirePivotRequest(pool: PivotRequestPool, key: string, body: object, endpoint = '/bi/explore/pivot') {
  const poolKey = endpoint === '/bi/explore/pivot' ? key : `${endpoint}:${key}`;
  let entry = pool.get(poolKey);
  if (entry) {
    try {
      entry.checkAuth();
    } catch {
      entry = undefined;
    }
  }
  if (!entry) {
    const controller = new AbortController();
    const checkAuth = captureAuthResponseFence();
    let request: ReturnType<typeof post>;
    try {
      checkAuth();
      request = post(endpoint, body, { signal: controller.signal });
    } catch (error) {
      request = Promise.reject(error);
    }
    const created: Entry = {
      controller,
      users: 0,
      checkAuth,
      promise: request.then(response => {
        checkAuth();
        return response;
      }),
    };
    entry = created;
    pool.set(poolKey, entry);
    void entry.promise.then(
      () => {
        if (pool.get(poolKey) === created) pool.delete(poolKey);
      },
      () => {
        if (pool.get(poolKey) === created) pool.delete(poolKey);
      },
    );
  }
  entry.users += 1;
  const shared = entry;
  let released = false;
  return {
    promise: shared.promise,
    release: () => {
      if (released) return;
      released = true;
      shared.users -= 1;
      if (shared.users === 0) {
        shared.controller.abort();
        if (pool.get(poolKey) === shared) pool.delete(poolKey);
      }
    },
  };
}
