import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { DataSource } from 'typeorm';
import { serializeMetadataWork } from '../common/metadata-work';
import { SourceAccessService } from '../ownership/source-access.service';
import { EnterpriseResourcePolicyService } from './resource-policy.service';
import { groupAdmin, groupKeys, groupWrite } from './group.service';
import { EnterpriseGroup } from './entities/enterprise-group.entity';
import { EnterpriseGroupDelivery } from './entities/enterprise-group-delivery.entity';
import { EnterpriseDeliveryReceipt } from './entities/enterprise-dashboard-delivery.entity';
import { EnterpriseAuditEvent } from './entities/enterprise-audit-event.entity';
@Injectable()
export class EnterpriseGroupDeliveryService {
  constructor(
    private readonly db: DataSource,
    private readonly policy: EnterpriseResourcePolicyService,
    private readonly access: SourceAccessService,
  ) {}
  async list(dashboardId: number, actor: number) {
    return serializeMetadataWork(this.db, async () => {
      await this.policy.assertManagement('dashboard', dashboardId, actor);
      const scope = await groupAdmin(actor, this.db.manager);
      const entries = await this.db.manager.find(EnterpriseGroupDelivery, {
        where: { ownerId: actor, organizationId: scope.organizationId, dashboardId },
        order: { groupId: 'ASC' },
      });
      return {
        dashboardId,
        entries: entries.map(({ groupId, version, active, allowCopy }) => ({
          groupId,
          version,
          active,
          allowCopy,
        })),
      };
    });
  }
  async set(dashboardId: number, actor: number, body: any) {
    groupKeys(body, [
      'requestId',
      'groupId',
      'expectedGroupVersion',
      'expectedVersion',
      'active',
      'allowCopy',
    ]);
    if (
      typeof body.requestId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
        body.requestId,
      ) ||
      !Number.isSafeInteger(body.groupId) ||
      body.groupId <= 0 ||
      !Number.isSafeInteger(body.expectedGroupVersion) ||
      body.expectedGroupVersion < 1 ||
      !Number.isSafeInteger(body.expectedVersion) ||
      body.expectedVersion < 0 ||
      body.expectedVersion >= 2147483647 ||
      typeof body.active !== 'boolean' ||
      typeof body.allowCopy !== 'boolean' ||
      (!body.active && body.allowCopy)
    )
      throw new BadRequestException('그룹 공유 요청과 버전을 확인해 주세요.');
    const input = {
      requestId: body.requestId as string,
      groupId: body.groupId as number,
      expectedGroupVersion: body.expectedGroupVersion as number,
      expectedVersion: body.expectedVersion as number,
      active: body.active as boolean,
      allowCopy: body.allowCopy as boolean,
    };
    const digest = createHash('sha256')
      .update(JSON.stringify({ domain: 'group-delivery', dashboardId, ...input }))
      .digest('hex');
    return groupWrite(this.db, async manager => {
      const scope = await groupAdmin(actor, manager, true);
      await this.policy.assertManagement('dashboard', dashboardId, actor, manager);
      const key = { ownerId: actor, requestId: input.requestId };
      const receipt = await manager.findOneBy(EnterpriseDeliveryReceipt, key);
      if (receipt) {
        if (receipt.organizationId !== scope.organizationId || receipt.digest !== digest)
          throw new ConflictException('같은 요청 번호의 공유 내용이 다릅니다.');
        return { ...JSON.parse(receipt.response), replayed: true };
      }
      const locking = ['mysql', 'mariadb'].includes(manager.connection.options.type)
        ? { lock: { mode: 'pessimistic_write' as const } }
        : {};
      const group = await manager.findOne(EnterpriseGroup, {
        where: { id: input.groupId, organizationId: scope.organizationId },
        ...locking,
      });
      if (!group || (input.active && !group.active))
        throw new ForbiddenException('같은 조직의 활성 그룹만 공유할 수 있습니다.');
      if (group.version !== input.expectedGroupVersion)
        throw new ConflictException('그룹이 변경됐습니다. 최신 상태를 확인해 주세요.');
      const binding = {
        ownerId: actor,
        organizationId: scope.organizationId,
        dashboardId,
        groupId: group.id,
      };
      const prior = await manager.findOneBy(EnterpriseGroupDelivery, binding);
      if ((prior?.version ?? 0) !== input.expectedVersion)
        throw new ConflictException('그룹 공유가 변경됐습니다. 최신 상태를 확인해 주세요.');
      if (input.active) await this.access.dashboard(dashboardId, actor, 'read', manager);
      const changed =
        (prior?.active ?? false) !== input.active ||
        (prior?.allowCopy ?? false) !== input.allowCopy;
      const version = (prior?.version ?? 0) + (changed ? 1 : 0);
      if (changed) {
        if (prior) {
          const result = await manager.update(
            EnterpriseGroupDelivery,
            { ...binding, version: prior.version },
            { version, active: input.active, allowCopy: input.allowCopy },
          );
          if (result.affected !== 1) throw new ConflictException('그룹 공유가 변경됐습니다.');
        } else
          await manager.insert(EnterpriseGroupDelivery, {
            ...binding,
            version,
            active: input.active,
            allowCopy: input.allowCopy,
          });
        await manager.insert(EnterpriseAuditEvent, {
          organizationId: scope.organizationId,
          actorId: actor,
          resourceId: dashboardId,
          subjectId: group.id,
          version,
          action: input.active ? 'dashboard.group-shared' : 'dashboard.group-unshared',
        });
      }
      const response = {
        requestId: input.requestId,
        dashboardId,
        entry: { groupId: group.id, version, active: input.active, allowCopy: input.allowCopy },
      };
      await manager.insert(EnterpriseDeliveryReceipt, {
        ...key,
        organizationId: scope.organizationId,
        digest,
        response: JSON.stringify(response),
      });
      return { ...response, replayed: false };
    });
  }
}
