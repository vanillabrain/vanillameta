import { lockStaffWrite } from './staff-write-lock';
import { groupMembershipNotifications, groupRecipients } from './group-notification';
import { createHash } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { DataSource, EntityManager, QueryFailedError } from 'typeorm';
import { metadataTransaction, serializeMetadataWork } from '../common/metadata-work';
import { User } from '../user/entities/user.entity';
import { EnterpriseMembership } from './entities/enterprise-membership.entity';
import { EnterpriseAuditEvent } from './entities/enterprise-audit-event.entity';
import {
  EnterpriseGroup,
  EnterpriseGroupMember,
  EnterpriseGroupRequest,
} from './entities/enterprise-group.entity';
export function groupKeys(value: any, keys: string[]) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).length !== keys.length ||
    Object.keys(value).some(k => !keys.includes(k))
  )
    throw new BadRequestException('그룹 변경 항목을 확인해 주세요.');
}
export async function groupAdmin(actor: number, manager: EntityManager, lock = false) {
  if (!Number.isSafeInteger(actor) || actor <= 0)
    throw new ForbiddenException('조직 관리자 확인이 필요합니다.');
  const locking =
    lock && ['mysql', 'mariadb'].includes(manager.connection.options.type)
      ? { lock: { mode: 'pessimistic_write' as const } }
      : {};
  const user = await manager.findOne(User, {
    where: { id: actor },
    select: { id: true, active: true },
    ...locking,
  });
  const member = await manager.findOne(EnterpriseMembership, {
    where: { userId: actor },
    ...locking,
  });
  if (!user?.active || member?.role !== 'admin')
    throw new ForbiddenException('조직 관리자만 그룹을 관리할 수 있습니다.');
  return member;
}
export async function groupWrite<T>(
  db: DataSource,
  run: (manager: EntityManager) => Promise<T>,
): Promise<T> {
  try {
    return await metadataTransaction(db, run);
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
      throw new ConflictException(
        '그룹 변경이 경합 중이거나 같은 이름이 있습니다. 최신 상태를 확인해 주세요.',
      );
    throw error;
  }
}
@Injectable()
export class EnterpriseGroupService {
  constructor(private readonly db: DataSource) {}
  private name(value: unknown) {
    if (typeof value !== 'string' || !value.trim() || value.length > 100)
      throw new BadRequestException('그룹 이름(1~100자)을 확인해 주세요.');
    const name = value.trim(),
      nameKey = name.normalize('NFKC').toLowerCase();
    if (nameKey.length > 100) throw new BadRequestException('그룹 이름이 너무 깁니다.');
    return { name, nameKey };
  }
  async list(actor: number, afterId?: unknown) {
    if (afterId !== undefined && (!Number.isSafeInteger(afterId) || Number(afterId) <= 0))
      throw new BadRequestException('목록 위치를 확인해 주세요.');
    return serializeMetadataWork(this.db, async () => {
      const scope = await groupAdmin(actor, this.db.manager);
      const rows = await this.db
        .getRepository(EnterpriseGroup)
        .createQueryBuilder('egroup')
        .where('egroup.organizationId = :org AND egroup.id > :after', {
          org: scope.organizationId,
          after: afterId ?? 0,
        })
        .orderBy('egroup.id', 'ASC')
        .take(21)
        .getMany();
      return {
        entries: rows
          .slice(0, 20)
          .map(({ id, name, active, version }) => ({ id, name, active, version })),
        nextAfterId: rows.length > 20 ? rows[19].id : null,
      };
    });
  }
  async detail(id: number, actor: number, manager = this.db.manager) {
    return serializeMetadataWork(this.db, async () => {
      const scope = await groupAdmin(actor, manager);
      const group = await manager.findOneBy(EnterpriseGroup, {
        id,
        organizationId: scope.organizationId,
      });
      if (!group) throw new ForbiddenException('본인 조직의 그룹만 확인할 수 있습니다.');
      const members = await manager
        .createQueryBuilder(EnterpriseGroupMember, 'gm')
        .leftJoin(
          EnterpriseMembership,
          'membership',
          'membership.userId = gm.userId AND membership.organizationId = :org',
          { org: scope.organizationId },
        )
        .leftJoin(User, 'employee', 'employee.id = membership.userId')
        .where('gm.groupId = :id', { id })
        .select('gm.userId', 'id')
        .addSelect('employee.userId', 'userId')
        .addSelect('employee.active', 'active')
        .orderBy('gm.userId', 'ASC')
        .limit(201)
        .getRawMany();
      if (members.length > 200)
        throw new ConflictException('그룹 구성원을 관리자에게 확인해 주세요.');
      return {
        id: group.id,
        name: group.name,
        active: group.active,
        version: group.version,
        members: members.map(row => ({
          id: Number(row.id),
          current: typeof row.userId === 'string',
          active: row.active === true || Number(row.active) === 1,
          userId:
            typeof row.userId === 'string'
              ? row.userId.length <= 255
                ? row.userId
                : row.userId.slice(0, 254).replace(/[\uD800-\uDBFF]$/, '') + '…'
              : null,
        })),
      };
    });
  }
  async create(actor: number, body: any) {
    groupKeys(body, ['name', 'requestId']);
    if (
      typeof body.requestId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(body.requestId)
    )
      throw new BadRequestException('그룹 생성 요청 번호를 확인해 주세요.');
    const requestId = body.requestId as string;
    const name = this.name(body.name);
    return groupWrite(this.db, async manager => {
      const scope = await groupAdmin(actor, manager, true);
      const key = { actorId: actor, requestId },
        payloadHash = createHash('sha256').update(JSON.stringify(name)).digest('hex');
      const prior = await manager.findOneBy(EnterpriseGroupRequest, key);
      if (prior) {
        if (prior.organizationId !== scope.organizationId || prior.payloadHash !== payloadHash)
          throw new ConflictException('같은 생성 요청 번호의 이름·조직이 다릅니다.');
        return { ...(await this.detail(prior.groupId, actor, manager)), replayed: true };
      }
      const group = await manager.save(EnterpriseGroup, {
        organizationId: scope.organizationId,
        ...name,
        active: true,
        version: 1,
      });
      await manager.insert(EnterpriseAuditEvent, {
        organizationId: scope.organizationId,
        actorId: actor,
        action: 'group.created',
        resourceId: group.id,
        subjectId: null,
        version: 1,
      });
      await manager.insert(EnterpriseGroupRequest, {
        ...key,
        organizationId: scope.organizationId,
        payloadHash,
        groupId: group.id,
      });
      return { ...(await this.detail(group.id, actor, manager)), replayed: false };
    });
  }
  async set(id: number, actor: number, body: any) {
    groupKeys(body, ['expectedVersion', 'name', 'active', 'memberIds']);
    const name = this.name(body.name),
      version = body.expectedVersion;
    if (
      !Number.isSafeInteger(version) ||
      version < 1 ||
      version >= 2147483647 ||
      typeof body.active !== 'boolean' ||
      !Array.isArray(body.memberIds) ||
      body.memberIds.length > 200 ||
      new Set(body.memberIds).size !== body.memberIds.length ||
      body.memberIds.some(v => !Number.isSafeInteger(v) || v <= 0)
    )
      throw new BadRequestException('그룹 버전·상태·구성원(최대200명)을 확인해 주세요.');
    const memberIds: number[] = [...body.memberIds].sort((a, b) => a - b),
      active = body.active;
    return groupWrite(this.db, async manager => {
      await lockStaffWrite(manager, [actor, ...memberIds]);
      const scope = await groupAdmin(actor, manager, true);
      const group = await manager.findOne(EnterpriseGroup, {
        where: { id, organizationId: scope.organizationId },
        ...(['mysql', 'mariadb'].includes(manager.connection.options.type)
          ? { lock: { mode: 'pessimistic_write' as const } }
          : {}),
      });
      if (!group) throw new ForbiddenException('본인 조직의 그룹만 변경할 수 있습니다.');
      if (group.version !== version)
        throw new ConflictException('그룹이 변경됐습니다. 최신 구성을 확인해 주세요.');
      const prior = await manager.findBy(EnterpriseGroupMember, { groupId: id }),
        existing = new Set(prior.map(row => row.userId));
      for (const userId of memberIds) {
        if (existing.has(userId)) continue;
        const member = await manager.findOneBy(EnterpriseMembership, {
          userId,
          organizationId: scope.organizationId,
        });
        const user = await manager.findOne(User, {
          where: { id: userId, active: true },
          select: { id: true },
        });
        if (!member || !user)
          throw new ForbiddenException('같은 조직의 활성 직원만 새로 추가할 수 있습니다.');
      }
      const beforeRecipients = group.active
        ? await groupRecipients(manager, id, scope.organizationId)
        : [];
      const changed = await manager.update(
        EnterpriseGroup,
        { id, organizationId: scope.organizationId, version },
        { ...name, active, version: version + 1 },
      );
      if (changed.affected !== 1)
        throw new ConflictException('그룹이 변경됐습니다. 다시 읽어 주세요.');
      await manager.delete(EnterpriseGroupMember, { groupId: id });
      if (memberIds.length)
        await manager.insert(
          EnterpriseGroupMember,
          memberIds.map(userId => ({ groupId: id, userId })),
        );
      await manager.insert(EnterpriseAuditEvent, {
        organizationId: scope.organizationId,
        actorId: actor,
        action: 'group.updated',
        resourceId: id,
        subjectId: null,
        version: version + 1,
      });
      await groupMembershipNotifications(
        manager,
        id,
        scope.organizationId,
        actor,
        beforeRecipients,
        active ? await groupRecipients(manager, id, scope.organizationId) : [],
      );
      return this.detail(id, actor, manager);
    });
  }
}
