import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { DataSource, EntityManager, Not, QueryFailedError } from 'typeorm';
import { metadataTransaction, serializeMetadataWork } from '../common/metadata-work';
import { User } from '../user/entities/user.entity';
import { UserMapping } from '../user/entities/user-mapping.entity';
import { EnterpriseMembership } from '../enterprise/entities/enterprise-membership.entity';
import { EnterpriseAuditEvent } from '../enterprise/entities/enterprise-audit-event.entity';
import { EnterpriseResourceGrant } from '../enterprise/entities/enterprise-resource-grant.entity';
import { EnterpriseGroupGrant } from '../enterprise/entities/enterprise-group.entity';
import { EnterpriseDashboardDelivery } from '../enterprise/entities/enterprise-dashboard-delivery.entity';
import { EnterpriseGroupDelivery } from '../enterprise/entities/enterprise-group-delivery.entity';
import { StudioPublication } from '../dashboard-studio/entities/studio-publication.entity';
import { Dashboard } from './entities/dashboard.entity';
import { DashboardShare } from './entities/dashboard_share.entity';
import { DashboardPublication } from './entities/dashboard-publication.entity';
import { DashboardWidget } from './dashboard-widget/entities/dashboard-widget.entity';
import { DashboardDeleteReceipt } from './entities/dashboard-delete-receipt.entity';
import { lockDashboardWrite } from './dashboard-write-lock';

const positive = (value: unknown): value is number =>
  Number.isSafeInteger(value) && Number(value) > 0;
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const DELETE_DEPENDENCY_KINDS = [
  'directPermissions',
  'groupPermissions',
  'directDeliveries',
  'groupDeliveries',
  'liveShare',
  'legacyPublications',
  'studioPublications',
  'sharedShareRecords',
] as const;
export function deletionRevision(row: Dashboard) {
  return hash([
    row.id,
    row.title,
    row.layout,
    row.analysisDefinition,
    row.structuredDefinition,
    row.pivotDefinitions,
    row.templateId,
    row.seq,
    row.shareId,
    row.delYn,
    row.assetActive,
    row.assetVersion,
    row.updatedAt,
  ]);
}
export async function dashboardDependencyCounts(row: Dashboard, m: EntityManager) {
  const result: Array<{ kind: (typeof DELETE_DEPENDENCY_KINDS)[number]; count: number }> = [];
  const count = (kind: (typeof DELETE_DEPENDENCY_KINDS)[number], value: number) => {
    if (!Number.isSafeInteger(value) || value < 0)
      throw new InternalServerErrorException('사용처를 확인할 수 없습니다.');
    result.push({ kind, count: value });
  };
  for (const [entity, kind] of [
    [EnterpriseResourceGrant, 'directPermissions'],
    [EnterpriseGroupGrant, 'groupPermissions'],
  ] as const) {
    count(
      kind,
      await m
        .createQueryBuilder(entity, 'g')
        .where('g.resourceKind = :kind AND g.resourceId = :id', { kind: 'dashboard', id: row.id })
        .andWhere('(g.read <> :off OR g.edit <> :off OR g.publish <> :off OR g.export <> :off)', {
          off: false,
        })
        .getCount(),
    );
  }
  for (const [entity, kind] of [
    [EnterpriseDashboardDelivery, 'directDeliveries'],
    [EnterpriseGroupDelivery, 'groupDeliveries'],
  ] as const) {
    count(
      kind,
      await m
        .createQueryBuilder(entity, 'd')
        .where('d.dashboardId = :id AND d.active <> :off', { id: row.id, off: false })
        .getCount(),
    );
  }
  const shareId = row.shareId;
  if (shareId !== null && shareId !== undefined && !positive(shareId))
    throw new ConflictException('공유 연결을 확인한 뒤 다시 시도해 주세요.');
  const share = positive(shareId) ? await m.findOneBy(DashboardShare, { id: shareId }) : null;
  count('liveShare', share && share.shareYn !== 'N' ? 1 : 0);
  count(
    'legacyPublications',
    await m
      .createQueryBuilder(DashboardPublication, 'p')
      .where('p.dashboardId = :id AND p.active <> :off', { id: row.id, off: false })
      .getCount(),
  );
  count(
    'studioPublications',
    await m
      .createQueryBuilder(StudioPublication, 'p')
      .where('p.dashboardId = :id', { id: row.id })
      .andWhere('(p.revokedAt IS NULL OR p.revokedAt = :empty)', { empty: '' })
      .getCount(),
  );
  count(
    'sharedShareRecords',
    positive(shareId) ? await m.count(Dashboard, { where: { shareId, id: Not(row.id) } }) : 0,
  );
  return result;
}
@Injectable()
export class DashboardDeletionService {
  constructor(private readonly db: DataSource) {}
  private id(value: unknown) {
    const id = typeof value === 'string' && /^[1-9][0-9]*$/.test(value) ? Number(value) : value;
    if (!positive(id)) throw new BadRequestException('대시보드 번호를 확인해 주세요.');
    return id;
  }
  private async scope(actor: number, epoch: number, m: EntityManager, lock = false) {
    if (!positive(actor)) throw new ForbiddenException('본인 계정 확인이 필요합니다.');
    const locking =
      lock && ['mysql', 'mariadb'].includes(this.db.options.type)
        ? { lock: { mode: 'pessimistic_write' as const } }
        : {};
    const user = await m.findOne(User, {
      where: { id: actor },
      select: { id: true, active: true, authVersion: true },
      ...locking,
    });
    if (!user?.active) throw new ForbiddenException('활성 본인 계정이 필요합니다.');
    if (!Number.isSafeInteger(epoch) || epoch < 0 || (user.authVersion ?? 0) !== epoch)
      throw new UnauthorizedException('로그인 상태를 다시 확인해 주세요.');
    const member = await m.findOne(EnterpriseMembership, { where: { userId: actor }, ...locking });
    if (member && !positive(member.organizationId))
      throw new InternalServerErrorException('현재 조직을 확인할 수 없습니다.');
    return member?.organizationId ?? null;
  }
  private async owned(id: number, actor: number, m: EntityManager, locked?: Dashboard) {
    const row = locked ?? (await m.findOneBy(Dashboard, { id }));
    const owners = await m.find(UserMapping, { where: { dashboardId: id } });
    if (!row || row.delYn !== 'N' || owners.length !== 1 || owners[0].userInfoId !== actor)
      throw new ForbiddenException('삭제할 본인 대시보드를 확인할 수 없습니다.');
    return row;
  }

  private async inactiveManagement(
    row: Dashboard,
    actor: number,
    organizationId: number | null,
    manager: EntityManager,
  ) {
    if (row.assetActive !== false) return;
    const member = await manager.findOneBy(EnterpriseMembership, { userId: actor });
    if (
      !positive(organizationId) ||
      !member ||
      member.role !== 'admin' ||
      member.organizationId !== organizationId
    )
      throw new ForbiddenException(
        '비활성 대시보드는 현재 조직의 소유 관리자만 삭제할 수 있습니다.',
      );
  }

  async impact(value: unknown, actor: number, expectedEpoch = 0) {
    const id = this.id(value);
    return serializeMetadataWork(this.db, async () => {
      const org = await this.scope(actor, expectedEpoch, this.db.manager);
      const row = await this.owned(id, actor, this.db.manager);
      await this.inactiveManagement(row, actor, org, this.db.manager);
      const dependencies = await dashboardDependencyCounts(row, this.db.manager);
      const current = await this.owned(id, actor, this.db.manager);
      if (
        (await this.scope(actor, expectedEpoch, this.db.manager)) !== org ||
        deletionRevision(current) !== deletionRevision(row)
      )
        throw new ConflictException('삭제 기준이 변경되었습니다. 다시 확인해 주세요.');
      await this.inactiveManagement(current, actor, org, this.db.manager);
      return {
        status: 'SUCCESS',
        data: {
          dashboardId: id,
          actorId: actor,
          organizationId: org,
          revision: deletionRevision(row),
          canDelete: dependencies.every(item => item.count === 0),
          dependencies,
        },
      };
    });
  }
  private input(body: any) {
    const keys = ['requestId', 'expectedRevision', 'expectedActorId', 'expectedOrganizationId'];
    if (
      !body ||
      typeof body !== 'object' ||
      Array.isArray(body) ||
      Object.keys(body).length !== keys.length ||
      Object.keys(body).some(key => !keys.includes(key)) ||
      typeof body.requestId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
        body.requestId,
      ) ||
      typeof body.expectedRevision !== 'string' ||
      !/^[a-f0-9]{64}$/.test(body.expectedRevision) ||
      !positive(body.expectedActorId) ||
      !(body.expectedOrganizationId === null || positive(body.expectedOrganizationId))
    )
      throw new BadRequestException('사용처와 삭제 요청을 먼저 확인해 주세요.');
    return {
      requestId: body.requestId as string,
      expectedRevision: body.expectedRevision as string,
      expectedActorId: body.expectedActorId as number,
      expectedOrganizationId: body.expectedOrganizationId as number | null,
    };
  }
  private receipt(row: DashboardDeleteReceipt, replayed: boolean) {
    return {
      status: 'SUCCESS',
      data: {
        dashboardId: row.dashboardId,
        requestId: row.requestId,
        receiptId: row.id,
        deleted: true,
        replayed,
      },
    };
  }
  async remove(value: unknown, actor: number, body: unknown, expectedEpoch = 0) {
    const id = this.id(value),
      input = this.input(body);
    const digest = hash([
      id,
      input.expectedRevision,
      input.expectedActorId,
      input.expectedOrganizationId,
    ]);
    const run = async (m: EntityManager) => {
      const org = await this.scope(actor, expectedEpoch, m, true);
      if (input.expectedActorId !== actor || input.expectedOrganizationId !== org)
        throw new ConflictException(
          '계정 또는 조직이 변경되었습니다. 삭제 영향을 다시 확인해 주세요.',
        );
      const key = { actorId: actor, requestId: input.requestId };
      const prior = await m.findOneBy(DashboardDeleteReceipt, key);
      if (prior) {
        if (prior.organizationId !== org || prior.digest !== digest)
          throw new ConflictException('같은 요청 번호의 삭제 기준이 다릅니다.');
        return this.receipt(prior, true);
      }
      const row = await this.owned(
        id,
        actor,
        m,
        await lockDashboardWrite(m, id, { allowInactive: true }),
      );
      // Historical receipt replay above remains available without authorizing a new deletion.
      await this.inactiveManagement(row, actor, org, m);
      if (deletionRevision(row) !== input.expectedRevision)
        throw new ConflictException('저장 내용이 변경되었습니다. 삭제 영향을 다시 확인해 주세요.');
      const dependencies = await dashboardDependencyCounts(row, m);
      if (dependencies.some(item => item.count > 0))
        throw new ConflictException(
          '사용처가 남아 있습니다. 공유·권한·게시 설정을 중지하고 삭제 영향을 다시 확인해 주세요.',
        );
      await m.delete(DashboardWidget, { dashboardId: id });
      const mapping = await m.delete(UserMapping, { dashboardId: id, userInfoId: actor });
      if (mapping.affected !== 1) throw new ConflictException('소유 연결이 변경되었습니다.');
      const removed = await m.delete(Dashboard, { id });
      if (removed.affected !== 1) throw new ConflictException('삭제할 대시보드가 변경되었습니다.');
      if (positive(row.shareId)) await m.delete(DashboardShare, { id: row.shareId });
      const saved = await m.save(DashboardDeleteReceipt, {
        ...key,
        dashboardId: id,
        organizationId: org,
        expectedRevision: input.expectedRevision,
        digest,
      });
      if (org !== null)
        await m.insert(EnterpriseAuditEvent, {
          organizationId: org,
          actorId: actor,
          subjectId: actor,
          action: 'dashboard-deletion.completed',
          resourceId: saved.id,
          version: 1,
        });
      if ((await this.scope(actor, expectedEpoch, m)) !== org)
        throw new ConflictException('현재 조직이 변경되었습니다.');
      return this.receipt(saved, false);
    };
    try {
      return await (['mysql', 'mariadb'].includes(this.db.options.type)
        ? metadataTransaction(this.db, 'READ COMMITTED', run)
        : metadataTransaction(this.db, run));
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
          '삭제 요청이 경합 중입니다. 같은 요청으로 결과를 확인해 주세요.',
        );
      throw error;
    }
  }
}
