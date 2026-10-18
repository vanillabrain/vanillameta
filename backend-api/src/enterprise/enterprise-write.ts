import { DataSource } from 'typeorm';
const sqliteQueues = new WeakMap<DataSource, Promise<unknown>>();
/** Organization and grant transactions share the driver's single SQLite connection. */
export function serializeEnterpriseWrite<T>(db: DataSource, run: () => Promise<T>): Promise<T> {
  if (db.options.type !== 'sqlite') return run();
  const pending = (sqliteQueues.get(db) ?? Promise.resolve()).then(run, run);
  sqliteQueues.set(
    db,
    pending.catch(() => undefined),
  );
  return pending;
}
