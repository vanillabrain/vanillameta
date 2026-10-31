import { ConflictException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { serializeMetadataWork } from '../common/metadata-work';
import { User } from '../user/entities/user.entity';
import { EnterpriseMembership } from './entities/enterprise-membership.entity';

/** Only construct from the authenticated request, never from client JSON. */
export type ClassificationActor = { id: number; authVersion?: number };
export type ClassificationContext = {
  actorId: number;
  organizationId: number;
  canManage: boolean;
  authVersion: number;
};
export type ClassificationExpectedContext = Pick<
  ClassificationContext,
  'actorId' | 'organizationId'
>;

/** User -> membership lock order; callers needing locks must already be in a transaction. */
export function classificationContext(
  manager: EntityManager,
  actor: ClassificationActor,
  lock = false,
): Promise<ClassificationContext> {
  return serializeMetadataWork(manager.connection, async () => {
    if (!Number.isSafeInteger(actor?.id) || actor.id <= 0)
      throw new ForbiddenException('활성 본인 계정이 필요합니다.');
    const locking =
      lock && manager.connection.options.type !== 'sqlite'
        ? { lock: { mode: 'pessimistic_write' as const } }
        : {};
    const user = await manager.findOne(User, {
      where: { id: actor.id },
      select: { id: true, active: true, authVersion: true },
      ...locking,
    });
    if (!user?.active) throw new ForbiddenException('활성 본인 계정이 필요합니다.');
    const epoch = actor.authVersion ?? 0;
    if (!Number.isSafeInteger(epoch) || epoch < 0 || user.authVersion !== epoch)
      throw new UnauthorizedException('로그인 상태를 다시 확인해 주세요.');
    const membership = await manager.findOne(EnterpriseMembership, {
      where: { userId: actor.id },
      ...locking,
    });
    if (
      !membership ||
      !Number.isSafeInteger(membership.organizationId) ||
      membership.organizationId <= 0 ||
      !['admin', 'member'].includes(membership.role)
    )
      throw new ForbiddenException('현재 조직의 활성 구성원만 분류를 확인할 수 있습니다.');
    return {
      actorId: actor.id,
      organizationId: membership.organizationId,
      canManage: membership.role === 'admin',
      authVersion: epoch,
    };
  });
}

export async function assertClassificationContext(
  manager: EntityManager,
  actor: ClassificationActor,
  expected: ClassificationExpectedContext,
  lock = false,
): Promise<ClassificationContext> {
  const current = await classificationContext(manager, actor, lock);
  if (current.actorId !== expected.actorId || current.organizationId !== expected.organizationId)
    throw new ConflictException('계정 또는 조직이 변경되었습니다. 분류 목록을 다시 확인해 주세요.');
  return current;
}
