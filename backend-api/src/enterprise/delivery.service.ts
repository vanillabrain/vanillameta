import { Dashboard } from '../dashboard/entities/dashboard.entity';
import { UserMapping } from '../user/entities/user-mapping.entity';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { DataSource, QueryFailedError } from 'typeorm';
import { metadataTransaction, serializeMetadataWork } from '../common/metadata-work';
import { SourceAccessService } from '../ownership/source-access.service';
import { User } from '../user/entities/user.entity';
import { EnterpriseResourcePolicyService } from './resource-policy.service';
import { EnterpriseMembership } from './entities/enterprise-membership.entity';
import { EnterpriseAuditEvent } from './entities/enterprise-audit-event.entity';
import {
  EnterpriseDashboardDelivery,
  EnterpriseDeliveryReceipt,
} from './entities/enterprise-dashboard-delivery.entity';

const exact = (value: any, keys: string[]) =>
  !!value &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  Object.keys(value).length === keys.length &&
  Object.keys(value).every(key => keys.includes(key));
@Injectable()
export class EnterpriseDeliveryService {
  constructor(
    private readonly db: DataSource,
    private readonly policy: EnterpriseResourcePolicyService,
    private readonly access: SourceAccessService,
  ) {}
  private input(body: any) {
    if (
      !exact(body, [
        'requestId',
        'active',
        'recipients',
        ...(body?.allowCopy === undefined ? [] : ['allowCopy']),
      ]) ||
      typeof body.requestId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
        body.requestId,
      ) ||
      typeof body.active !== 'boolean' ||
      (body.allowCopy !== undefined &&
        (typeof body.allowCopy !== 'boolean' || (!body.active && body.allowCopy))) ||
      !Array.isArray(body.recipients) ||
      body.recipients.length < 1 ||
      body.recipients.length > 50
    )
      throw new BadRequestException('공유 요청·수신자(1~50명)를 확인해 주세요.');
    const recipients: Array<{ recipientId: number; expectedVersion: number }> = body.recipients.map(
      (entry: any) => {
        if (
          !exact(entry, ['recipientId', 'expectedVersion']) ||
          !Number.isSafeInteger(entry.recipientId) ||
          entry.recipientId <= 0 ||
          !Number.isSafeInteger(entry.expectedVersion) ||
          entry.expectedVersion < 0 ||
          entry.expectedVersion >= 2147483647
        )
          throw new BadRequestException('수신자·공유 버전을 확인해 주세요.');
        return { recipientId: entry.recipientId, expectedVersion: entry.expectedVersion };
      },
    );
    recipients.sort((a, b) => a.recipientId - b.recipientId);
    if (new Set(recipients.map(entry => entry.recipientId)).size !== recipients.length)
      throw new BadRequestException('수신자가 중복됐습니다.');
    return {
      requestId: body.requestId as string,
      active: body.active as boolean,
      ...(body.allowCopy !== undefined ? { allowCopy: body.allowCopy as boolean } : {}),
      recipients,
    };
  }
  async received(actor: number, afterId?: unknown) {
    if (!Number.isSafeInteger(actor) || actor <= 0)
      throw new ForbiddenException('계정 확인이 필요합니다.');
    const after = afterId === undefined ? 0 : afterId;
    if (
      !Number.isSafeInteger(after) ||
      Number(after) < 0 ||
      (afterId !== undefined && Number(after) === 0)
    )
      throw new BadRequestException('받은 자료 목록 위치를 확인해 주세요.');
    return serializeMetadataWork(this.db, async () => {
      const user = await this.db.manager.findOne(User, {
        where: { id: actor, active: true },
        select: { id: true },
      });
      const member = await this.db.manager.findOneBy(EnterpriseMembership, { userId: actor });
      if (!user || !member)
        throw new ForbiddenException('본인 조직의 받은 자료만 확인할 수 있습니다.');
      const candidates = await this.db
        .getRepository(EnterpriseDashboardDelivery)
        .createQueryBuilder('delivery')
        .innerJoin(User, 'owner', 'owner.id = delivery.ownerId AND owner.active = :active', {
          active: true,
        })
        .innerJoin(
          EnterpriseMembership,
          'ownerMember',
          'ownerMember.userId = owner.id AND ownerMember.organizationId = delivery.organizationId',
        )
        .innerJoin(
          Dashboard,
          'dashboard',
          'dashboard.id = delivery.dashboardId AND dashboard.delYn <> :deleted',
          { deleted: 'Y' },
        )
        .innerJoin(
          UserMapping,
          'mapping',
          'mapping.dashboardId = dashboard.id AND mapping.userInfoId = delivery.ownerId',
        )
        .where(
          'delivery.recipientId = :actor AND delivery.organizationId = :org AND delivery.active = :active',
          { actor, org: member.organizationId, active: true },
        )
        .andWhere('delivery.dashboardId > :after', { after })
        .andWhere(
          '(SELECT COUNT(*) FROM user_mapping owning WHERE owning.dashboardId = dashboard.id) = 1',
        )
        .select(['delivery.dashboardId', 'delivery.version', 'delivery.allowCopy'])
        .orderBy('delivery.dashboardId', 'ASC')
        .limit(21)
        .getMany();
      const entries: Array<{
        dashboardId: number;
        title: string;
        version: number;
        allowCopy: boolean;
      }> = [];
      for (const row of candidates.slice(0, 20)) {
        try {
          await this.access.dashboard(row.dashboardId, actor, 'read');
          const dashboard = await this.db.manager.findOneOrFail(Dashboard, {
            where: { id: row.dashboardId },
            select: { id: true, title: true },
          });
          const title =
            dashboard.title.length <= 300
              ? dashboard.title
              : dashboard.title.slice(0, 299).replace(/[\uD800-\uDBFF]$/, '') + '…';
          entries.push({
            dashboardId: row.dashboardId,
            title,
            version: row.version,
            allowCopy: row.allowCopy,
          });
        } catch (error) {
          if (!(error instanceof ForbiddenException)) throw error;
        }
      }
      return { entries, nextAfterId: candidates.length > 20 ? candidates[19].dashboardId : null };
    });
  }
  async list(dashboardId: number, actor: number) {
    return serializeMetadataWork(this.db, async () => {
      await this.policy.assertManagement('dashboard', dashboardId, actor);
      const member = await this.db.manager.findOneByOrFail(EnterpriseMembership, { userId: actor });
      const rows = await this.db.manager.find(EnterpriseDashboardDelivery, {
        where: { ownerId: actor, organizationId: member.organizationId, dashboardId },
        order: { recipientId: 'ASC' },
      });
      return {
        dashboardId,
        entries: rows.map(row => ({
          recipientId: row.recipientId,
          version: row.version,
          active: row.active,
          allowCopy: row.allowCopy,
        })),
      };
    });
  }
  async set(dashboardId: number, actor: number, body: unknown) {
    const input = this.input(body);
    const digest = createHash('sha256')
      .update(JSON.stringify({ dashboardId, ...input }))
      .digest('hex');
    try {
      return await metadataTransaction(this.db, async manager => {
        if (['mysql', 'mariadb'].includes(manager.connection.options.type)) {
          // Share the account/membership write boundary before the first authority snapshot.
          // Lock conflicts remain retryable; these locks never grant authority on their own.
          if (!Number.isSafeInteger(actor) || actor <= 0)
            throw new ForbiddenException('계정 확인이 필요합니다.');
          const ids = Array.from(
            new Set([actor, ...input.recipients.map(target => target.recipientId)]),
          ).sort((a, b) => a - b);
          for (const id of ids) {
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
        await this.policy.assertManagement('dashboard', dashboardId, actor, manager);
        const member = await manager.findOneByOrFail(EnterpriseMembership, { userId: actor });
        const receiptKey = { ownerId: actor, requestId: input.requestId };
        const receipt = await manager.findOneBy(EnterpriseDeliveryReceipt, receiptKey);
        if (receipt) {
          if (receipt.organizationId !== member.organizationId || receipt.digest !== digest)
            throw new ConflictException('같은 요청 번호의 공유 내용이 다릅니다.');
          return { ...JSON.parse(receipt.response), replayed: true };
        }
        if (input.active) await this.access.dashboard(dashboardId, actor, 'read', manager);
        const entries = [];
        for (const target of input.recipients) {
          if (target.recipientId === actor)
            throw new BadRequestException('본인에게 공유할 수 없습니다.');
          const key = {
            ownerId: actor,
            organizationId: member.organizationId,
            dashboardId,
            recipientId: target.recipientId,
          };
          const prior = await manager.findOneBy(EnterpriseDashboardDelivery, key);
          if ((prior?.version ?? 0) !== target.expectedVersion)
            throw new ConflictException('공유가 변경됐습니다. 최신 관계를 다시 읽어 주세요.');
          if (input.active) {
            const recipient = await manager.findOneBy(EnterpriseMembership, {
              userId: target.recipientId,
              organizationId: member.organizationId,
            });
            const user = await manager.findOne(User, {
              where: { id: target.recipientId, active: true },
              select: { id: true },
            });
            if (!recipient || !user)
              throw new ForbiddenException('같은 조직의 활성 수신자만 공유할 수 있습니다.');
          }
          const allowCopy = input.active && (input.allowCopy ?? prior?.allowCopy ?? false);
          const changed =
            (prior?.active ?? false) !== input.active || (prior?.allowCopy ?? false) !== allowCopy;
          const version = (prior?.version ?? 0) + (changed ? 1 : 0);
          if (changed) {
            if (prior) {
              const result = await manager.update(
                EnterpriseDashboardDelivery,
                { ...key, version: prior.version },
                { active: input.active, allowCopy, version },
              );
              if (result.affected !== 1)
                throw new ConflictException('공유가 변경됐습니다. 다시 읽어 주세요.');
            } else
              await manager.insert(EnterpriseDashboardDelivery, {
                ...key,
                version,
                active: input.active,
                allowCopy,
              });
            await manager.insert(EnterpriseAuditEvent, {
              organizationId: member.organizationId,
              actorId: actor,
              action: input.active ? 'dashboard.shared' : 'dashboard.unshared',
              resourceId: dashboardId,
              subjectId: target.recipientId,
              version,
            });
          }
          if (input.active)
            await this.access.dashboard(dashboardId, target.recipientId, 'read', manager);
          entries.push({
            recipientId: target.recipientId,
            version,
            active: input.active,
            ...(input.allowCopy !== undefined ? { allowCopy } : {}),
          });
        }
        const response = { requestId: input.requestId, dashboardId, entries };
        await manager.insert(EnterpriseDeliveryReceipt, {
          ...receiptKey,
          organizationId: member.organizationId,
          digest,
          response: JSON.stringify(response),
        });
        return { ...response, replayed: false };
      });
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
          '공유 저장이 경합 중입니다. 같은 요청으로 결과를 확인해 주세요.',
        );
      throw error;
    }
  }
}
