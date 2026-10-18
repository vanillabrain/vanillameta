import { EnterpriseNotificationAudience } from './entities/enterprise-notification-audience.entity';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { metadataTransaction, serializeMetadataWork } from '../common/metadata-work';
import { User } from '../user/entities/user.entity';
import { EnterpriseMembership } from './entities/enterprise-membership.entity';
import { EnterpriseAuditEvent } from './entities/enterprise-audit-event.entity';
import { EnterpriseNotificationState } from './entities/enterprise-notification-state.entity';

const ACTIONS = [
  'source.permissions',
  'dashboard.permissions',
  'dashboard.shared',
  'dashboard.unshared',
];
const EXPORT_ACTIONS = ['export.ready', 'export.failed', 'export.cancelled'];
const GROUP_ACTIONS = [
  'dashboard.group-shared',
  'dashboard.group-unshared',
  'dashboard.group-joined',
  'dashboard.group-left',
];
@Injectable()
export class EnterpriseNotificationService {
  constructor(private readonly db: DataSource) {}
  private id(value: unknown): number {
    if (!Number.isSafeInteger(value) || Number(value) <= 0)
      throw new BadRequestException('알림 번호를 확인해 주세요.');
    return Number(value);
  }
  private async membership(actor: number, manager: EntityManager, expectedEpoch?: number) {
    this.id(actor);
    const user = await manager.findOne(User, {
      where: { id: actor, active: true },
      select: { id: true, authVersion: true },
    });
    const member = await manager.findOneBy(EnterpriseMembership, { userId: actor });
    if (!user || !member) throw new ForbiddenException('본인 조직 알림만 확인할 수 있습니다.');
    if (expectedEpoch !== undefined && (user.authVersion ?? 0) !== expectedEpoch)
      throw new UnauthorizedException('로그인 상태를 다시 확인해 주세요.');
    return member;
  }
  async list(actor: number, beforeId?: unknown, expectedEpoch?: number) {
    const before = beforeId === undefined ? undefined : this.id(beforeId);
    return serializeMetadataWork(this.db, async () => {
      const member = await this.membership(actor, this.db.manager, expectedEpoch);
      const query = this.db.manager
        .createQueryBuilder(EnterpriseAuditEvent, 'event')
        .leftJoin(
          EnterpriseNotificationState,
          'state',
          'state.eventId = event.id AND state.recipientId = :actor',
          { actor },
        )
        .leftJoin(
          EnterpriseNotificationAudience,
          'audience',
          'audience.eventId = event.id AND audience.recipientId = :actor',
          { actor },
        )
        .where('event.organizationId = :org', { org: member.organizationId })
        .andWhere(
          '((event.subjectId = :actor AND event.action IN (:...actions)) OR (event.subjectId = :actor AND event.actorId = :actor AND event.action IN (:...exportActions)) OR (audience.recipientId = :actor AND event.action IN (:...groupActions)))',
          { actor, actions: ACTIONS, exportActions: EXPORT_ACTIONS, groupActions: GROUP_ACTIONS },
        )
        .andWhere('(state.removed IS NULL OR state.removed = :removed)', { removed: false });
      if (before !== undefined) query.andWhere('event.id < :before', { before });
      const rows = await query
        .select('event.id', 'id')
        .addSelect('event.action', 'action')
        .addSelect('event.resourceId', 'resourceId')
        .addSelect('event.version', 'version')
        .addSelect('event.createdAt', 'createdAt')
        .addSelect('state.read', 'read')
        .orderBy('event.id', 'DESC')
        .limit(21)
        .getRawMany();
      const entries = rows.slice(0, 20).map(row => ({
        id: Number(row.id),
        resourceKind: EXPORT_ACTIONS.includes(row.action)
          ? 'export'
          : row.action === 'source.permissions'
          ? 'source'
          : 'dashboard',
        resourceId: Number(row.resourceId),
        eventType: EXPORT_ACTIONS.includes(row.action)
          ? row.action.slice('export.'.length)
          : ['dashboard.shared', 'dashboard.group-shared', 'dashboard.group-joined'].includes(
              row.action,
            )
          ? 'shared'
          : ['dashboard.unshared', 'dashboard.group-unshared', 'dashboard.group-left'].includes(
              row.action,
            )
          ? 'unshared'
          : 'permissions',
        ...(GROUP_ACTIONS.includes(row.action) ? { viaGroup: true } : {}),
        version: Number(row.version),
        createdAt: new Date(
          typeof row.createdAt === 'string' && !/[zZ]|[+-][0-9]{2}:[0-9]{2}$/.test(row.createdAt)
            ? row.createdAt.replace(' ', 'T') + 'Z'
            : row.createdAt,
        ).toISOString(),
        read: row.read === true || Number(row.read) === 1,
      }));
      return {
        entries,
        nextBeforeId: rows.length > 20 ? entries[entries.length - 1].id : null,
      };
    });
  }
  async mark(actor: number, eventId: number, action: 'read' | 'remove', expectedEpoch?: number) {
    this.id(eventId);
    if (action !== 'read' && action !== 'remove') throw new BadRequestException('알림 동작 오류');
    return metadataTransaction(this.db, async manager => {
      const member = await this.membership(actor, manager, expectedEpoch);
      const event = await manager.findOneBy(EnterpriseAuditEvent, {
        id: eventId,
        organizationId: member.organizationId,
      });
      const personal =
        event &&
        event.subjectId === actor &&
        (ACTIONS.includes(event.action) ||
          (EXPORT_ACTIONS.includes(event.action) && event.actorId === actor));
      const grouped =
        event &&
        GROUP_ACTIONS.includes(event.action) &&
        (await manager.findOneBy(EnterpriseNotificationAudience, { eventId, recipientId: actor }));
      if (!event || (!personal && !grouped))
        throw new ForbiddenException('본인 조직 알림만 변경할 수 있습니다.');
      const key = { recipientId: actor, eventId };
      await manager
        .createQueryBuilder()
        .insert()
        .into(EnterpriseNotificationState)
        .values({ ...key, read: false, removed: false })
        .orIgnore()
        .execute();
      await manager.update(
        EnterpriseNotificationState,
        key,
        action === 'read' ? { read: true } : { removed: true },
      );
      const state = await manager.findOneByOrFail(EnterpriseNotificationState, key);
      return { id: eventId, read: state.read, removed: state.removed };
    });
  }
}
