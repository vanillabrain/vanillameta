import { AsyncLocalStorage } from 'async_hooks';
import { DataSource, EntityManager } from 'typeorm';
import { IsolationLevel } from 'typeorm/driver/types/IsolationLevel';

type Lease = { active: boolean };
const context = new AsyncLocalStorage<Map<DataSource, Lease>>();
const queues = new WeakMap<DataSource, Promise<unknown>>();

/**
 * NFR005/008: independent SQLite operations share one physical connection. Awaited service
 * composition may re-enter its live operation; detached work cannot re-use an expired lease.
 * This coordinates in-process work, never substitutes for database CAS/locks or user permission.
 */
export function serializeMetadataWork<T>(db: DataSource, operation: () => Promise<T>): Promise<T> {
  if (!db?.options) throw new TypeError('A metadata DataSource is required.');
  if (db.options.type !== 'sqlite') return operation();
  if (context.getStore()?.get(db)?.active) return operation();
  const run = () => {
    const lease: Lease = { active: true };
    const scope = new Map(context.getStore());
    scope.set(db, lease);
    return context.run(scope, async () => {
      try {
        return await operation();
      } finally {
        lease.active = false;
      }
    });
  };
  const result = (queues.get(db) ?? Promise.resolve()).then(run, run);
  queues.set(
    db,
    result.catch(() => undefined),
  );
  return result;
}

export function metadataTransaction<T>(
  target: DataSource | EntityManager,
  run: (manager: EntityManager) => Promise<T>,
): Promise<T>;
export function metadataTransaction<T>(
  target: DataSource | EntityManager,
  isolation: IsolationLevel,
  run: (manager: EntityManager) => Promise<T>,
): Promise<T>;
export function metadataTransaction<T>(
  target: DataSource | EntityManager,
  first: IsolationLevel | ((manager: EntityManager) => Promise<T>),
  second?: (manager: EntityManager) => Promise<T>,
): Promise<T> {
  const db = 'connection' in target ? target.connection : target;
  return serializeMetadataWork(db, () =>
    typeof first === 'function' ? target.transaction(first) : target.transaction(first, second),
  );
}
