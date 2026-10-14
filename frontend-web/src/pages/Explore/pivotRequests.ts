import { post } from '@/helpers/apiHelper';

type Entry = { controller: AbortController; promise: ReturnType<typeof post>; users: number };
/** One dashboard mount owns this pool; settled data is never cached. */
export type PivotRequestPool = Map<string, Entry>;
export function acquirePivotRequest(pool: PivotRequestPool, key: string, body: object) {
  let entry = pool.get(key);
  if (!entry) {
    const controller = new AbortController();
    const created: Entry = { controller, users: 0, promise: post('/bi/explore/pivot', body, { signal: controller.signal }) };
    entry = created;
    pool.set(key, entry);
    void entry.promise.then(
      () => {
        if (pool.get(key) === created) pool.delete(key);
      },
      () => {
        if (pool.get(key) === created) pool.delete(key);
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
        if (pool.get(key) === shared) pool.delete(key);
      }
    },
  };
}
