import { Repository } from 'typeorm';

// Both dashboard and source views share the local connection's transaction queue.
const queues = new WeakMap<object, Promise<unknown>>();
export function serializedViewWrite<T>(
  repository: Repository<any>,
  operation: () => Promise<T>,
): Promise<T> {
  const connection = repository.manager.connection;
  if (connection.options.type !== 'sqlite') return operation();
  const result = (queues.get(connection) ?? Promise.resolve()).then(operation);
  queues.set(
    connection,
    result.then(
      () => undefined,
      () => undefined,
    ),
  );
  return result;
}
