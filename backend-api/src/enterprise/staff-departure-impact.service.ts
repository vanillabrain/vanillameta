import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { DataSource, EntityManager, EntityTarget } from 'typeorm';
import { serializeMetadataWork } from '../common/metadata-work';
import { User } from '../user/entities/user.entity';
import { UserMapping } from '../user/entities/user-mapping.entity';
import { Database } from '../database/entities/database.entity';
import { Metric } from '../metric/entities/metric.entity';
import { Dashboard } from '../dashboard/entities/dashboard.entity';
import { StudioPublication } from '../dashboard-studio/entities/studio-publication.entity';
import { ExportJob } from '../bi/entities/export-job.entity';
import { EnterpriseMembership } from './entities/enterprise-membership.entity';
import { EnterpriseOrganization } from './entities/enterprise-organization.entity';
import { EnterpriseResourceGrant } from './entities/enterprise-resource-grant.entity';
import { EnterpriseDashboardDelivery } from './entities/enterprise-dashboard-delivery.entity';
import {
  EnterpriseGroup,
  EnterpriseGroupGrant,
  EnterpriseGroupMember,
} from './entities/enterprise-group.entity';
import { EnterpriseGroupDelivery } from './entities/enterprise-group-delivery.entity';

@Injectable()
export class StaffDepartureImpactService {
  constructor(private readonly db: DataSource) {}

  private id(value: unknown) {
    if (typeof value === 'string' && /^[1-9]\d*$/.test(value)) value = Number(value);
    if (!Number.isSafeInteger(value) || Number(value) < 1 || Number(value) >= 2147483647)
      throw new BadRequestException('직원 번호를 확인해 주세요.');
    return Number(value);
  }

  /** One statement: no content fields and no fractured fresh authority reads. */
  private basis(manager: EntityManager, actor: number, target: number) {
    return manager
      .createQueryBuilder(User, 'actor')
      .leftJoin(EnterpriseMembership, 'admin', 'admin.userId = actor.id')
      .leftJoin(EnterpriseOrganization, 'org', 'org.id = admin.organizationId')
      .leftJoin(User, 'target', 'target.id = :target', { target })
      .leftJoin(EnterpriseMembership, 'member', 'member.userId = target.id')
      .select('actor.active', 'actorActive')
      .addSelect('actor.authVersion', 'actorEpoch')
      .addSelect('admin.organizationId', 'actorOrg')
      .addSelect('admin.role', 'actorRole')
      .addSelect('admin.team', 'actorTeam')
      .addSelect('org.id', 'organizationId')
      .addSelect('org.version', 'organizationVersion')
      .addSelect('target.id', 'targetId')
      .addSelect('target.active', 'targetActive')
      .addSelect('target.authVersion', 'targetEpoch')
      .addSelect('member.organizationId', 'targetOrg')
      .addSelect('member.role', 'targetRole')
      .addSelect('member.team', 'targetTeam')
      .where('actor.id = :actor', { actor })
      .getRawOne();
  }

  private authority(basis: any, epoch: number, organization?: number) {
    if (
      !basis ||
      !Number(basis.actorActive) ||
      !Number.isSafeInteger(epoch) ||
      Number(basis.actorEpoch ?? 0) !== epoch
    )
      throw new UnauthorizedException('로그인이 변경되었습니다. 다시 로그인해 주세요.');
    if (
      basis.actorRole !== 'admin' ||
      !basis.organizationId ||
      (organization !== undefined && Number(basis.organizationId) !== organization)
    )
      throw new ForbiddenException('현재 조직 관리자 권한을 확인해 주세요.');
  }

  async inspect(actorId: number, epoch: number, targetId: unknown) {
    const actor = this.id(actorId),
      target = this.id(targetId);
    return serializeMetadataWork(this.db, async () => {
      const read = async (manager: EntityManager) => {
        const basis = await this.basis(manager, actor, target);
        this.authority(basis, epoch);
        if (!basis.targetId || basis.targetOrg !== basis.organizationId)
          throw new ForbiddenException('현재 조직의 직원만 확인할 수 있습니다.');
        const organizationId = Number(basis.organizationId);
        const related = (entity: EntityTarget<any>) =>
          manager
            .createQueryBuilder(entity, 'r')
            .where('r.organizationId = :organizationId', { organizationId })
            .andWhere('(r.ownerId = :target OR r.recipientId = :target)', { target });
        const ownedGroup = (entity: EntityTarget<any>) =>
          manager
            .createQueryBuilder(entity, 'r')
            .where('r.organizationId = :organizationId AND r.ownerId = :target', {
              organizationId,
              target,
            });
        const dashboards = (sole: boolean) => {
          const query = manager.createQueryBuilder(Dashboard, 'd');
          const own = query
            .subQuery()
            .select('1')
            .from(UserMapping, 'own')
            .where('own.dashboardId = d.id AND own.userInfoId = :target')
            .getQuery();
          const mappings = query
            .subQuery()
            .select('COUNT(*)')
            .from(UserMapping, 'mapping')
            .where('mapping.dashboardId = d.id')
            .getQuery();
          return query
            .where(`EXISTS ${own}`)
            .andWhere(`${mappings} ${sole ? '= 1' : '>= 2'}`)
            .setParameter('target', target)
            .getCount();
        };
        // Sequential reads use the same transaction manager / RR snapshot; no entity hydration.
        const counts = {
          sources: await manager.count(Database, { where: { ownerId: target } }),
          metrics: await manager
            .createQueryBuilder(Metric, 'metric')
            .innerJoin(Database, 'source', 'source.id = metric.databaseId')
            .where('source.ownerId = :target', { target })
            .getCount(),
          soleDashboards: await dashboards(true),
          ambiguousDashboards: await dashboards(false),
          directGrants: await related(EnterpriseResourceGrant).getCount(),
          personalDeliveries: await related(EnterpriseDashboardDelivery).getCount(),
          groupMemberships: await manager
            .createQueryBuilder(EnterpriseGroupMember, 'member')
            .innerJoin(EnterpriseGroup, 'g', 'g.id = member.groupId')
            .where('member.userId = :target AND g.organizationId = :organizationId', {
              target,
              organizationId,
            })
            .getCount(),
          ownedGroupGrants: await ownedGroup(EnterpriseGroupGrant).getCount(),
          ownedGroupDeliveries: await ownedGroup(EnterpriseGroupDelivery).getCount(),
          publications: await manager.count(StudioPublication, { where: { actorId: target } }),
          exportJobs: await manager
            .createQueryBuilder(ExportJob, 'job')
            .where('job.organizationId = :organizationId', { organizationId })
            .andWhere('(job.ownerId = :target OR job.sourceOwnerId = :target)', { target })
            .getCount(),
        };
        return { basis, counts, observedAt: new Date().toISOString() };
      };
      const snapshot = ['mysql', 'mariadb'].includes(this.db.options.type)
        ? await this.db.transaction('REPEATABLE READ', read)
        : await this.db.transaction(read);
      // Deliberately outside the completed snapshot, using the live manager.
      const fresh = await this.basis(this.db.manager, actor, target);
      this.authority(fresh, epoch, Number(snapshot.basis.organizationId));
      if (JSON.stringify(fresh) !== JSON.stringify(snapshot.basis))
        throw new ConflictException('직원 또는 조직 정보가 변경됐습니다. 다시 확인해 주세요.');
      return {
        organizationId: Number(fresh.organizationId),
        organizationVersion: Number(fresh.organizationVersion),
        targetId: target,
        targetActive: Boolean(Number(fresh.targetActive)),
        observedAt: snapshot.observedAt,
        counts: snapshot.counts,
      };
    });
  }
}
