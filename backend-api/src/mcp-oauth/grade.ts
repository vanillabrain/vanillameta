import { ForbiddenException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import type { RouteCapability } from '../auth/route-capabilities';
import { roleAllows } from '../enterprise/role-capabilities';
import { EnterpriseMembership } from '../enterprise/entities/enterprise-membership.entity';

/**
 * The grade bounds what a connection may do, whatever scope the user approved: an AI acts with the
 * account's own rights, never more. The grade is read on every call, so a demotion applies at once
 * (it does not bump authVersion, so the token stays valid). A role the table does not know, such as
 * a stale value, allows nothing.
 */
export async function assertGradeAllows(
  manager: EntityManager,
  principal: { actorId: number; organizationId: number },
  capability: RouteCapability,
): Promise<void> {
  const member = await manager.findOneBy(EnterpriseMembership, {
    userId: principal.actorId,
    organizationId: principal.organizationId,
  });
  if (!member || !roleAllows(member.role, capability)) throw new ForbiddenException();
}
