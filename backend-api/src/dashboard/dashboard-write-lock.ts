import { ForbiddenException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Dashboard } from './entities/dashboard.entity';

/** Existing-ID writers and physical deletion share this parent fence through commit. */
export async function lockDashboardWrite(
  manager: EntityManager,
  id: number,
  options?: { allowInactive?: boolean },
): Promise<Dashboard> {
  if (!manager.queryRunner?.isTransactionActive)
    throw new Error('Dashboard write lock requires an active transaction.');
  if (!Number.isSafeInteger(id) || id <= 0) throw new ForbiddenException('Dashboard unavailable.');
  const row = await manager.findOne(Dashboard, {
    where: { id },
    ...(manager.connection.options.type !== 'sqlite'
      ? { lock: { mode: 'pessimistic_write' as const } }
      : {}),
  });
  if (!row || row.delYn === 'Y' || (row.assetActive === false && options?.allowInactive !== true))
    throw new ForbiddenException('Dashboard unavailable.');
  return row;
}
