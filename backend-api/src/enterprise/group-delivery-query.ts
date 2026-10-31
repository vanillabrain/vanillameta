import { EntityManager } from 'typeorm';
import { EnterpriseGroupDelivery } from './entities/enterprise-group-delivery.entity';
import { EnterpriseGroup, EnterpriseGroupMember } from './entities/enterprise-group.entity';
import { EnterpriseMembership } from './entities/enterprise-membership.entity';
import { User } from '../user/entities/user.entity';
import { UserMapping } from '../user/entities/user-mapping.entity';
import { Dashboard } from '../dashboard/entities/dashboard.entity';
/** Current bindings, never a cached membership snapshot. Source read remains independent. */
export function currentGroupDeliveries(manager: EntityManager, actor: number) {
  return manager
    .getRepository(EnterpriseGroupDelivery)
    .createQueryBuilder('gd')
    .innerJoin(
      EnterpriseGroup,
      'egroup',
      'egroup.id = gd.groupId AND egroup.organizationId = gd.organizationId AND egroup.active = :gdActive',
      { gdActive: true },
    )
    .innerJoin(EnterpriseGroupMember, 'gm', 'gm.groupId = egroup.id AND gm.userId = :gdActor', {
      gdActor: actor,
    })
    .innerJoin(User, 'gdRecipient', 'gdRecipient.id = gm.userId AND gdRecipient.active = :gdActive')
    .innerJoin(
      EnterpriseMembership,
      'gdMember',
      'gdMember.userId = gm.userId AND gdMember.organizationId = gd.organizationId',
    )
    .innerJoin(User, 'gdOwner', 'gdOwner.id = gd.ownerId AND gdOwner.active = :gdActive')
    .innerJoin(
      EnterpriseMembership,
      'gdOwnerMember',
      'gdOwnerMember.userId = gd.ownerId AND gdOwnerMember.organizationId = gd.organizationId',
    )
    .innerJoin(
      Dashboard,
      'gdDashboard',
      'gdDashboard.id = gd.dashboardId AND gdDashboard.delYn <> :gdDeleted',
      { gdDeleted: 'Y' },
    )
    .innerJoin(
      UserMapping,
      'gdMapping',
      'gdMapping.dashboardId = gd.dashboardId AND gdMapping.userInfoId = gd.ownerId',
    )
    .where('gd.active = :gdActive AND gd.ownerId <> :gdActor')
    .andWhere(
      '(SELECT COUNT(*) FROM "user_mapping" gdOwning WHERE gdOwning."dashboardId" = "gd"."dashboardId") = 1',
    );
}
