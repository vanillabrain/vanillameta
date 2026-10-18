import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { metadataTransaction } from '../common/metadata-work';
import { User } from '../user/entities/user.entity';
import { Database } from './entities/database.entity';

/** Lock the verified actor before acquiring Source parents; never accept an absent actor. */
export async function lockSourceActor(manager: EntityManager, actor: number, epoch: number) {
  if (!manager.queryRunner?.isTransactionActive)
    throw new Error('Source actor lock requires an active transaction.');
  if (!Number.isSafeInteger(actor) || actor <= 0 || !Number.isSafeInteger(epoch) || epoch < 0)
    throw new ForbiddenException('Current actor required.');
  const user = await manager.findOne(User, {
    where: { id: actor },
    ...(['mysql', 'mariadb'].includes(manager.connection.options.type)
      ? { lock: { mode: 'pessimistic_write' as const } }
      : {}),
  });
  if (!user || user.active !== true || user.authVersion !== epoch)
    throw new ForbiddenException('Current actor required.');
}

export function assertSourceOwner(source: Database, actor: number) {
  if (!source || source.ownerId !== actor || source.catalogActive === false)
    throw new ForbiddenException('Source ownership required.');
}

export function sourceWriteFields<T>(input: T, fields: readonly string[]): T {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Reflect.ownKeys(input).some(key => typeof key !== 'string' || !fields.includes(key))
  )
    throw new BadRequestException('저장 요청 항목을 확인해 주세요.');
  return Object.fromEntries(Object.keys(input).map(key => [key, input[key]])) as T;
}

/** Use only where a nonlocking lookup precedes a parent-lock wait and must be reread current. */
export function sourceWriteTransaction<T>(
  target: DataSource | EntityManager,
  run: (manager: EntityManager) => Promise<T>,
): Promise<T> {
  const db = 'connection' in target ? target.connection : target;
  return ['mysql', 'mariadb'].includes(db.options.type)
    ? metadataTransaction(target, 'READ COMMITTED', run)
    : metadataTransaction(target, run);
}
