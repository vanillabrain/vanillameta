import { serializeMetadataWork } from '../common/metadata-work';
import { serializeEnterpriseWrite } from './enterprise-write';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { DataSource, EntityManager, QueryFailedError } from 'typeorm';
import { Database } from '../database/entities/database.entity';
import { Dashboard } from '../dashboard/entities/dashboard.entity';
import { UserMapping } from '../user/entities/user-mapping.entity';
import { User } from '../user/entities/user.entity';
import { EnterpriseMembership } from './entities/enterprise-membership.entity';
import { EnterpriseAuditEvent } from './entities/enterprise-audit-event.entity';
import {
  EnterpriseResourceGrant,
  ResourceKind,
  ResourceAction,
  ResourceRights,
} from './entities/enterprise-resource-grant.entity';
export {
  ResourceKind,
  ResourceAction,
  ResourceRights,
} from './entities/enterprise-resource-grant.entity';
/** Discovery labels are summaries; legacy SQLite strings may exceed entity varchar lengths. */
const resourceLabel = (value: string) =>
  value.length <= 300 ? value : value.slice(0, 299).replace(/[\uD800-\uDBFF]$/, '') + '…';
const actions: ResourceAction[] = ['read', 'edit', 'publish', 'export'];
@Injectable()
export class EnterpriseResourcePolicyService {
  constructor(private readonly db: DataSource) {}
  private denied(): never {
    throw new ForbiddenException('자원 권한이 없습니다.');
  }
  private id(value: unknown): number {
    if (!Number.isSafeInteger(value) || Number(value) <= 0)
      throw new BadRequestException('자원·직원 번호를 확인해 주세요.');
    return Number(value);
  }
  kind(value: unknown): ResourceKind {
    if (value !== 'source' && value !== 'dashboard')
      throw new BadRequestException('자원 유형을 확인해 주세요.');
    return value;
  }
  private rights(row: ResourceRights): ResourceRights {
    return {
      read: row.read === true,
      edit: row.edit === true,
      publish: row.publish === true,
      export: row.export === true,
    };
  }
  private async member(actor: number, manager: EntityManager) {
    const user = await manager.findOne(User, {
      where: { id: this.id(actor) },
      select: { id: true, active: true },
    });
    if (!user || user.active === false) this.denied();
    return manager.findOneBy(EnterpriseMembership, { userId: actor });
  }
  private async resource(kind: ResourceKind, id: number, manager: EntityManager) {
    this.id(id);
    if (kind === 'source') {
      const source = await manager.findOne(Database, {
        where: { id },
        select: { id: true, ownerId: true, name: true, catalogActive: true },
      });
      if (!source || !Number.isSafeInteger(source.ownerId) || source.ownerId <= 0) this.denied();
      return { ownerId: source.ownerId, label: source.name, active: source.catalogActive };
    }
    const row = await manager.findOne(Dashboard, {
      where: { id },
      select: { id: true, title: true, delYn: true },
    });
    const owners = await manager.find(UserMapping, { where: { dashboardId: id }, take: 2 });
    if (!row || row.delYn === 'Y' || owners.length !== 1) this.denied();
    return { ownerId: owners[0].userInfoId, label: row.title };
  }
  private async management(kind: ResourceKind, id: number, actor: number, manager: EntityManager) {
    const [membership, resource] = await Promise.all([
      this.member(actor, manager),
      this.resource(kind, id, manager),
    ]);
    if (!membership || membership.role !== 'admin' || resource.ownerId !== actor) this.denied();
    return { membership, resource };
  }
  /** UC050: management remains available while normal source access is disabled. */
  async assertManagement(kind: ResourceKind, id: number, actor: number, manager = this.db.manager) {
    return serializeMetadataWork(this.db, async () => {
      await this.management(kind, id, actor, manager);
    });
  }
  private async currentRights(
    kind: ResourceKind,
    id: number,
    actor: number,
    manager: EntityManager,
  ): Promise<ResourceRights> {
    this.kind(kind);
    this.id(actor);
    this.id(id);
    const resource = await this.resource(kind, id, manager);
    const membership = await this.member(actor, manager);
    if (kind === 'source' && resource.active === false) this.denied();
    if (resource.ownerId === actor)
      return { read: true, edit: true, publish: kind === 'dashboard', export: true };
    const owner = await this.member(resource.ownerId, manager);
    if (!membership || !owner || membership.organizationId !== owner.organizationId) this.denied();
    const grant = await manager.findOneBy(EnterpriseResourceGrant, {
      resourceKind: kind,
      resourceId: id,
      recipientId: actor,
      organizationId: membership.organizationId,
      ownerId: resource.ownerId,
    });
    if (!grant || grant.read !== true) this.denied();
    return { ...this.rights(grant), publish: kind === 'dashboard' && grant.publish === true };
  }
  async assert(
    kind: ResourceKind,
    id: number,
    actor: number,
    action: ResourceAction,
    manager = this.db.manager,
  ): Promise<void> {
    return serializeMetadataWork(this.db, async () => {
      if (!actions.includes(action) || (kind === 'source' && action === 'publish')) this.denied();
      const rights = await this.currentRights(kind, id, actor, manager);
      if (rights[action] !== true) this.denied();
    });
  }
  async capabilities(kind: ResourceKind, id: number, actor: number) {
    return serializeMetadataWork(this.db, async () => {
      return { rights: await this.currentRights(kind, id, actor, this.db.manager) };
    });
  }
  private async allowedIds(kind: ResourceKind, actor: number) {
    this.id(actor);
    // Every identity, membership and resource binding is checked in this single query, not per row.
    const query = this.db
      .getRepository(EnterpriseResourceGrant)
      .createQueryBuilder('grant')
      .innerJoin(
        User,
        'recipient',
        'recipient.id = grant.recipientId AND recipient.active = :active',
        { active: true },
      )
      .innerJoin(
        EnterpriseMembership,
        'member',
        'member.userId = recipient.id AND member.organizationId = grant.organizationId',
      )
      .innerJoin(User, 'owner', 'owner.id = grant.ownerId AND owner.active = :active', {
        active: true,
      })
      .innerJoin(
        EnterpriseMembership,
        'ownerMember',
        'ownerMember.userId = owner.id AND ownerMember.organizationId = grant.organizationId',
      )
      .where('grant.resourceKind = :kind AND grant.recipientId = :actor AND grant.read = :active', {
        kind,
        actor,
        active: true,
      });
    if (kind === 'source')
      query.innerJoin(
        Database,
        'resource',
        'resource.id = grant.resourceId AND resource.ownerId = grant.ownerId AND resource.catalogActive = :resourceActive',
        { resourceActive: true },
      );
    else
      query
        .innerJoin(
          Dashboard,
          'resource',
          'resource.id = grant.resourceId AND resource.delYn <> :deleted',
          { deleted: 'Y' },
        )
        .innerJoin(
          UserMapping,
          'mapping',
          'mapping.dashboardId = resource.id AND mapping.userInfoId = grant.ownerId',
        )
        .andWhere(
          '(SELECT COUNT(*) FROM user_mapping owning WHERE owning.dashboardId = resource.id) = 1',
        );
    const rows = await query
      .select('grant.resourceId', 'id')
      .orderBy('grant.resourceId', 'ASC')
      .getRawMany();
    return rows.map(row => Number(row.id));
  }
  sourceIds(actor: number) {
    return serializeMetadataWork(this.db, async () => {
      return this.allowedIds('source', actor);
    });
  }
  dashboardIds(actor: number) {
    return serializeMetadataWork(this.db, async () => {
      return this.allowedIds('dashboard', actor);
    });
  }
  async resources(actor: number, after?: unknown) {
    return serializeMetadataWork(this.db, async () => {
      const membership = await this.member(actor, this.db.manager);
      if (!membership || membership.role !== 'admin') this.denied();
      let cursor: { kind: ResourceKind; id: number } | undefined;
      if (after !== undefined) {
        const match = typeof after === 'string' && /^(dashboard|source):([1-9][0-9]*)$/.exec(after);
        if (!match) throw new BadRequestException('목록 위치를 확인해 주세요.');
        cursor = { kind: this.kind(match[1]), id: this.id(Number(match[2])) };
      }
      const mappings = await this.db.manager.find(UserMapping, { where: { userInfoId: actor } });
      const dashboardIds = mappings.map(row => row.dashboardId);
      const rows: Array<{ kind: ResourceKind; id: number; label: string }> = [];
      if ((!cursor || cursor.kind === 'dashboard') && dashboardIds.length) {
        const dashboards = await this.db
          .getRepository(Dashboard)
          .createQueryBuilder('d')
          .where('d.id IN (:...ids)', { ids: dashboardIds })
          .andWhere('d.delYn <> :deleted', { deleted: 'Y' })
          .andWhere('d.id > :after', { after: cursor?.id ?? 0 })
          .orderBy('d.id', 'ASC')
          .take(21)
          .select(['d.id', 'd.title'])
          .getMany();
        for (const d of dashboards) {
          try {
            await this.management('dashboard', d.id, actor, this.db.manager);
            rows.push({ kind: 'dashboard', id: d.id, label: resourceLabel(d.title) });
          } catch (error) {
            if (!(error instanceof ForbiddenException)) throw error;
          }
        }
      }
      if (rows.length <= 20) {
        const sources = await this.db
          .getRepository(Database)
          .createQueryBuilder('s')
          .where('s.ownerId = :owner', { owner: actor })
          .andWhere('s.id > :after', { after: cursor?.kind === 'source' ? cursor.id : 0 })
          .orderBy('s.id', 'ASC')
          .take(21)
          .select(['s.id', 's.name'])
          .getMany();
        rows.push(
          ...sources.map(s => ({
            kind: 'source' as const,
            id: s.id,
            label: resourceLabel(s.name),
          })),
        );
      }
      const entries = rows.slice(0, 20),
        last = entries[entries.length - 1];
      return { entries, nextAfter: rows.length > 20 ? `${last.kind}:${last.id}` : null };
    });
  }
  async policies(kind: ResourceKind, id: number, actor: number) {
    return serializeMetadataWork(this.db, async () => {
      this.kind(kind);
      const { membership } = await this.management(kind, id, actor, this.db.manager);
      const rows = await this.db.manager.find(EnterpriseResourceGrant, {
        where: {
          resourceKind: kind,
          resourceId: id,
          organizationId: membership.organizationId,
          ownerId: actor,
        },
        order: { recipientId: 'ASC' },
      });
      const entries = [];
      for (const row of rows) {
        const member = await this.db.manager.findOneBy(EnterpriseMembership, {
          userId: row.recipientId,
          organizationId: membership.organizationId,
        });
        const user =
          member &&
          (await this.db.manager.findOne(User, {
            where: { id: row.recipientId },
            select: { id: true, userId: true },
          }));
        entries.push({
          recipientId: row.recipientId,
          userId: user?.userId ?? `직원 #${row.recipientId} (소속 확인 필요)`,
          version: row.version,
          rights: this.rights(row),
        });
      }
      return { kind, resourceId: id, entries };
    });
  }
  async set(kind: ResourceKind, id: number, actor: number, body: any) {
    this.kind(kind);
    this.id(id);
    const keys = ['recipientId', 'expectedVersion', 'rights'];
    if (
      !body ||
      typeof body !== 'object' ||
      Array.isArray(body) ||
      Object.keys(body).length !== keys.length ||
      Object.keys(body).some(k => !keys.includes(k))
    )
      throw new BadRequestException('권한 변경 항목을 확인해 주세요.');
    const recipientId = this.id(body.recipientId),
      version = body.expectedVersion;
    const rights = body.rights;
    if (
      !Number.isSafeInteger(version) ||
      version < 0 ||
      version >= 2147483647 ||
      !rights ||
      typeof rights !== 'object' ||
      Array.isArray(rights) ||
      Object.keys(rights).length !== 4 ||
      Object.keys(rights).some(k => !actions.includes(k as ResourceAction)) ||
      actions.some(k => typeof rights[k] !== 'boolean') ||
      (!rights.read && (rights.edit || rights.publish || rights.export)) ||
      (kind === 'source' && rights.publish) ||
      recipientId === actor
    )
      throw new BadRequestException('권한·대상·버전을 확인해 주세요.');
    const run = async () =>
      this.db.transaction(async manager => {
        const { membership } = await this.management(kind, id, actor, manager);
        const prior = await manager.findOneBy(EnterpriseResourceGrant, {
          resourceKind: kind,
          resourceId: id,
          recipientId,
        });
        const revocable =
          prior?.ownerId === actor && prior?.organizationId === membership.organizationId;
        const recipient = actions.some(action => rights[action])
          ? await this.member(recipientId, manager)
          : await manager.findOneBy(EnterpriseMembership, { userId: recipientId });
        if (
          (!recipient || recipient.organizationId !== membership.organizationId) &&
          (actions.some(action => rights[action]) || !revocable)
        )
          this.denied();
        const key = { resourceKind: kind, resourceId: id, recipientId };
        const sameAuthority =
          prior?.ownerId === actor && prior?.organizationId === membership.organizationId;
        if ((sameAuthority ? prior.version : 0) !== version)
          throw new ConflictException(
            '다른 권한 변경이 먼저 반영됐습니다. 최신 권한을 확인해 주세요.',
          );
        const values = {
          organizationId: membership.organizationId,
          ownerId: actor,
          version: version + 1,
          ...this.rights(rights),
        };
        if (prior) {
          const changed = await manager.update(
            EnterpriseResourceGrant,
            {
              ...key,
              version: prior.version,
              ownerId: prior.ownerId,
              organizationId: prior.organizationId,
            },
            values,
          );
          if (changed.affected !== 1) throw new ConflictException('최신 권한을 확인해 주세요.');
        } else await manager.insert(EnterpriseResourceGrant, { ...key, ...values });
        await manager.insert(EnterpriseAuditEvent, {
          organizationId: membership.organizationId,
          actorId: actor,
          action: `${kind}.permissions`,
          resourceId: id,
          subjectId: recipientId,
          version: version + 1,
        });
        return {
          kind,
          resourceId: id,
          recipientId,
          version: version + 1,
          rights: this.rights(rights),
        };
      });
    const execute = async () => {
      try {
        return await run();
      } catch (error) {
        if (
          error instanceof QueryFailedError &&
          (/UNIQUE|PRIMARY KEY/i.test(error.driverError?.message ?? '') ||
            [
              'SQLITE_BUSY',
              'SQLITE_LOCKED',
              'ER_DUP_ENTRY',
              'ER_LOCK_DEADLOCK',
              'ER_LOCK_WAIT_TIMEOUT',
            ].includes(error.driverError?.code))
        )
          throw new ConflictException('권한 변경이 경합 중입니다. 최신 권한을 확인해 주세요.');
        throw error;
      }
    };
    return serializeEnterpriseWrite(this.db, execute);
  }
}
