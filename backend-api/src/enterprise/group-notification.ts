import { EntityManager } from 'typeorm';
import { EnterpriseGroupMember } from './entities/enterprise-group.entity';
import { EnterpriseMembership } from './entities/enterprise-membership.entity';
import { EnterpriseAuditEvent } from './entities/enterprise-audit-event.entity';
import { EnterpriseNotificationAudience } from './entities/enterprise-notification-audience.entity';
import { EnterpriseGroupDelivery } from './entities/enterprise-group-delivery.entity';
import { User } from '../user/entities/user.entity';
import { Dashboard } from '../dashboard/entities/dashboard.entity';
import { UserMapping } from '../user/entities/user-mapping.entity';
export async function groupRecipients(
  manager: EntityManager,
  groupId: number,
  org: number,
): Promise<number[]> {
  const rows = await manager
    .getRepository(EnterpriseGroupMember)
    .createQueryBuilder('gm')
    .innerJoin(User, 'recipient', 'recipient.id = gm.userId AND recipient.active = :active', {
      active: true,
    })
    .innerJoin(
      EnterpriseMembership,
      'member',
      'member.userId = gm.userId AND member.organizationId = :org',
      { org },
    )
    .where('gm.groupId = :groupId', { groupId })
    .select('gm.userId', 'id')
    .orderBy('gm.userId', 'ASC')
    .getRawMany();
  return rows.map(row => Number(row.id));
}
export async function groupNotification(
  manager: EntityManager,
  event: {
    organizationId: number;
    actorId: number;
    resourceId: number;
    subjectId: number;
    version: number;
    action: string;
  },
  recipients: number[],
) {
  const saved = await manager.save(EnterpriseAuditEvent, event);
  if (recipients.length)
    await manager.insert(
      EnterpriseNotificationAudience,
      Array.from(new Set(recipients)).map(recipientId => ({ eventId: saved.id, recipientId })),
    );
  return saved.id;
}
/** Only explicit roster/active edits generate new membership incidents. */
export async function groupMembershipNotifications(
  manager: EntityManager,
  groupId: number,
  org: number,
  actor: number,
  before: number[],
  after: number[],
) {
  const added = after.filter(id => !before.includes(id)),
    removed = before.filter(id => !after.includes(id));
  if (!added.length && !removed.length) return;
  const bindings = await manager
    .getRepository(EnterpriseGroupDelivery)
    .createQueryBuilder('gd')
    .innerJoin(User, 'owner', 'owner.id = gd.ownerId AND owner.active = :active', { active: true })
    .innerJoin(
      EnterpriseMembership,
      'om',
      'om.userId = owner.id AND om.organizationId = gd.organizationId',
    )
    .innerJoin(
      Dashboard,
      'dashboard',
      'dashboard.id = gd.dashboardId AND dashboard.delYn <> :deleted',
      { deleted: 'Y' },
    )
    .innerJoin(
      UserMapping,
      'mapping',
      'mapping.dashboardId = gd.dashboardId AND mapping.userInfoId = gd.ownerId',
    )
    .where('gd.groupId = :groupId AND gd.organizationId = :org AND gd.active = :active', {
      groupId,
      org,
      active: true,
    })
    .andWhere(
      '(SELECT COUNT(*) FROM user_mapping owning WHERE owning.dashboardId = gd.dashboardId) = 1',
    )
    .getMany();
  for (const binding of bindings) {
    for (const [action, targets] of [
      ['dashboard.group-joined', added],
      ['dashboard.group-left', removed],
    ] as const) {
      const recipients = targets.filter(id => id !== binding.ownerId);
      if (recipients.length)
        await groupNotification(
          manager,
          {
            organizationId: org,
            actorId: actor,
            resourceId: binding.dashboardId,
            subjectId: groupId,
            version: binding.version,
            action,
          },
          recipients,
        );
    }
  }
}
