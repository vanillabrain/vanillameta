import { ConflictException, ForbiddenException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Database } from '../database/entities/database.entity';
import { Metric } from './entities/metric.entity';

function transaction(manager: EntityManager) {
  if (!manager.queryRunner?.isTransactionActive)
    throw new Error('Metric write lock requires an active transaction.');
}
function positive(id: number) {
  if (!Number.isSafeInteger(id) || id <= 0) throw new ForbiddenException('Metric unavailable.');
}
function currentLock(manager: EntityManager) {
  return manager.connection.options.type !== 'sqlite'
    ? { lock: { mode: 'pessimistic_write' as const } }
    : {};
}

/** Caller acquires any User/Dashboard fences, then ALL sources, before any Metric fence. */
export async function lockMetricSources(
  manager: EntityManager,
  ids: readonly number[],
): Promise<Map<number, Database>> {
  transaction(manager);
  ids.forEach(positive);
  const rows = new Map<number, Database>();
  for (const id of [...new Set(ids)].sort((a, b) => a - b)) {
    const row = await manager.findOne(Database, { where: { id }, ...currentLock(manager) });
    if (!row) throw new ForbiddenException('Source unavailable.');
    rows.set(id, row);
  }
  return rows;
}

/** Source must already be fenced; inactive rows are admitted only for explicit reactivation. */
export async function lockMetricWrite(
  manager: EntityManager,
  id: number,
  options?: { allowInactive?: boolean },
): Promise<Metric> {
  transaction(manager);
  positive(id);
  const row = await manager.findOne(Metric, { where: { id }, ...currentLock(manager) });
  if (!row || (row.useYn !== 'Y' && !(options?.allowInactive && row.useYn === 'N')))
    throw new ForbiddenException('Metric unavailable.');
  return row;
}

export async function lockMetricReferenceSets(
  manager: EntityManager,
  sets: readonly { sourceId: number; ids: readonly number[] }[],
): Promise<Map<number, Metric>> {
  transaction(manager);
  const sources = new Map<number, number>();
  for (const set of sets) {
    positive(set.sourceId);
    for (const id of set.ids) {
      positive(id);
      if (sources.has(id) && sources.get(id) !== set.sourceId)
        throw new ConflictException('Metric source changed.');
      sources.set(id, set.sourceId);
    }
  }
  await lockMetricSources(
    manager,
    sets.map(set => set.sourceId),
  );
  const rows = new Map<number, Metric>();
  for (const id of [...sources.keys()].sort((a, b) => a - b)) {
    const row = await lockMetricWrite(manager, id);
    if (row.databaseId !== sources.get(id)) throw new ConflictException('Metric source changed.');
    rows.set(id, row);
  }
  return rows;
}

/** Version/definition checks use these authoritative rows and remain the caller's responsibility. */
export function lockMetricReferences(
  manager: EntityManager,
  sourceId: number,
  ids: readonly number[],
): Promise<Map<number, Metric>> {
  return lockMetricReferenceSets(manager, [{ sourceId, ids }]);
}
