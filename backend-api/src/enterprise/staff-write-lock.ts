import { ForbiddenException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { EnterpriseMembership } from './entities/enterprise-membership.entity';

/** UC051: take current identity locks before a writer establishes its authority snapshot. */
export async function lockStaffWrite(manager: EntityManager, ids: number[]) {
  if (ids.some(id => !Number.isSafeInteger(id) || id <= 0))
    throw new ForbiddenException('직원 계정을 확인해 주세요.');
  if (!['mysql', 'mariadb'].includes(manager.connection.options.type)) return;
  for (const id of [...new Set(ids)].sort((a, b) => a - b)) {
    await manager.findOne(User, {
      where: { id },
      select: { id: true },
      lock: { mode: 'pessimistic_write' },
    });
    await manager.findOne(EnterpriseMembership, {
      where: { userId: id },
      lock: { mode: 'pessimistic_write' },
    });
  }
}
