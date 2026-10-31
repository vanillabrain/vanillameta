import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { DataSource, EntityManager, QueryFailedError } from 'typeorm';
import { metadataTransaction, serializeMetadataWork } from '../common/metadata-work';
import { Dashboard } from '../dashboard/entities/dashboard.entity';
import { UserMapping } from '../user/entities/user-mapping.entity';
import { User } from '../user/entities/user.entity';
import { lockDashboardWrite } from '../dashboard/dashboard-write-lock';
import {
  dashboardDependencyCounts,
  deletionRevision,
} from '../dashboard/dashboard-deletion.service';
import { EnterpriseMembership } from './entities/enterprise-membership.entity';
import { EnterpriseAuditEvent } from './entities/enterprise-audit-event.entity';
import { DashboardLifecycleReceipt } from './entities/dashboard-lifecycle-receipt.entity';

const MAX_VERSION = 2147483647;
const positive = (value: unknown): value is number =>
  Number.isSafeInteger(value) && Number(value) > 0;
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export type DashboardLifecycleDependencies = Awaited<ReturnType<typeof dashboardDependencyCounts>>;
export type DashboardLifecycleImpact = {
  dashboardId: number;
  actorId: number;
  organizationId: number;
  active: boolean;
  version: number;
  revision: string;
  dependencies: DashboardLifecycleDependencies;
};
export type DashboardLifecycleChangeRequest = {
  requestId: string;
  expectedActorId: number;
  expectedOrganizationId: number;
  expectedVersion: number;
  expectedRevision: string;
  active: boolean;
  acknowledgedImpact: true;
};
export type DashboardLifecycleResult = {
  dashboardId: number;
  actorId: number;
  organizationId: number;
  requestId: string;
  receiptId: number;
  active: boolean;
  version: number;
  replayed: boolean;
};
export function dashboardLifecycleRevision(
  row: Dashboard,
  dependencies: DashboardLifecycleDependencies,
) {
  return hash([deletionRevision(row), dependencies]);
}

@Injectable()
export class DashboardLifecycleService {
  constructor(private readonly db: DataSource) {}
  private stale(message: string) {
    return new ConflictException({
      statusCode: 409,
      error: 'Conflict',
      code: 'DASHBOARD_LIFECYCLE_STALE',
      message,
    });
  }
  private id(raw: unknown) {
    const value = typeof raw === 'string' && /^[1-9][0-9]*$/.test(raw) ? Number(raw) : raw;
    if (!positive(value)) throw new BadRequestException('대시보드 번호를 확인해 주세요.');
    return value;
  }
  private async scope(actor: number, epoch: number, manager: EntityManager, lock = false) {
    if (!positive(actor)) throw new ForbiddenException('활성 본인 계정이 필요합니다.');
    const locking =
      lock && this.db.options.type !== 'sqlite'
        ? { lock: { mode: 'pessimistic_write' as const } }
        : {};
    const user = await manager.findOne(User, {
      where: { id: actor },
      select: { id: true, active: true, authVersion: true },
      ...locking,
    });
    if (!user?.active) throw new ForbiddenException('활성 본인 계정이 필요합니다.');
    if (!Number.isSafeInteger(epoch) || epoch < 0 || user.authVersion !== epoch)
      throw new UnauthorizedException('로그인 상태를 다시 확인해 주세요.');
    const membership = await manager.findOne(EnterpriseMembership, {
      where: { userId: actor },
      ...locking,
    });
    if (!membership || membership.role !== 'admin' || !positive(membership.organizationId))
      throw new ForbiddenException('현재 조직의 소유 관리자만 상태를 관리할 수 있습니다.');
    return membership.organizationId;
  }
  private async owned(id: number, actor: number, manager: EntityManager, locked?: Dashboard) {
    const row = locked ?? (await manager.findOneBy(Dashboard, { id }));
    const owners = await manager.find(UserMapping, { where: { dashboardId: id }, take: 2 });
    if (!row || row.delYn !== 'N' || owners.length !== 1 || owners[0].userInfoId !== actor)
      throw new ForbiddenException('본인 소유 대시보드를 확인할 수 없습니다.');
    if (
      typeof row.assetActive !== 'boolean' ||
      !Number.isInteger(row.assetVersion) ||
      row.assetVersion < 0 ||
      row.assetVersion > MAX_VERSION
    )
      throw new InternalServerErrorException('대시보드 상태를 확인할 수 없습니다.');
    return row;
  }
  async read(
    value: unknown,
    actor: number,
    expectedEpoch = 0,
  ): Promise<{ status: 'SUCCESS'; data: DashboardLifecycleImpact }> {
    const id = this.id(value);
    return serializeMetadataWork(this.db, async () => {
      const organizationId = await this.scope(actor, expectedEpoch, this.db.manager);
      const row = await this.owned(id, actor, this.db.manager);
      const dependencies = await dashboardDependencyCounts(row, this.db.manager);
      const current = await this.owned(id, actor, this.db.manager);
      if (
        (await this.scope(actor, expectedEpoch, this.db.manager)) !== organizationId ||
        deletionRevision(current) !== deletionRevision(row)
      )
        throw this.stale('대시보드 상태가 변경되었습니다. 영향을 다시 확인해 주세요.');
      return {
        status: 'SUCCESS',
        data: {
          dashboardId: id,
          actorId: actor,
          organizationId,
          active: row.assetActive,
          version: row.assetVersion,
          revision: dashboardLifecycleRevision(row, dependencies),
          dependencies,
        },
      };
    });
  }
  private input(body: unknown): DashboardLifecycleChangeRequest {
    const keys = [
      'requestId',
      'expectedActorId',
      'expectedOrganizationId',
      'expectedVersion',
      'expectedRevision',
      'active',
      'acknowledgedImpact',
    ];
    const value = body as DashboardLifecycleChangeRequest;
    if (
      !value ||
      typeof value !== 'object' ||
      Array.isArray(value) ||
      Reflect.ownKeys(value).length !== keys.length ||
      Reflect.ownKeys(value).some(key => typeof key !== 'string' || !keys.includes(key)) ||
      typeof value.requestId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
        value.requestId,
      ) ||
      !positive(value.expectedActorId) ||
      !positive(value.expectedOrganizationId) ||
      !Number.isSafeInteger(value.expectedVersion) ||
      value.expectedVersion < 0 ||
      typeof value.expectedRevision !== 'string' ||
      !/^[0-9a-f]{64}$/.test(value.expectedRevision) ||
      typeof value.active !== 'boolean' ||
      value.acknowledgedImpact !== true
    )
      throw new BadRequestException('대시보드 상태와 중단 영향을 먼저 확인해 주세요.');
    return {
      requestId: value.requestId,
      expectedActorId: value.expectedActorId,
      expectedOrganizationId: value.expectedOrganizationId,
      expectedVersion: value.expectedVersion,
      expectedRevision: value.expectedRevision,
      active: value.active,
      acknowledgedImpact: true,
    };
  }
  private receipt(
    row: DashboardLifecycleReceipt,
    replayed: boolean,
  ): { status: 'SUCCESS'; data: DashboardLifecycleResult } {
    return {
      status: 'SUCCESS',
      data: {
        dashboardId: row.dashboardId,
        actorId: row.actorId,
        organizationId: row.organizationId,
        requestId: row.requestId,
        receiptId: row.id,
        active: row.active,
        version: row.version,
        replayed,
      },
    };
  }
  async set(
    value: unknown,
    actor: number,
    body: unknown,
    expectedEpoch = 0,
  ): Promise<{ status: 'SUCCESS'; data: DashboardLifecycleResult }> {
    const id = this.id(value),
      input = this.input(body),
      payloadDigest = hash([id, input]);
    const run = async (manager: EntityManager) => {
      const organizationId = await this.scope(actor, expectedEpoch, manager, true);
      if (input.expectedActorId !== actor || input.expectedOrganizationId !== organizationId)
        throw this.stale('계정 또는 조직이 변경되었습니다. 영향을 다시 확인해 주세요.');
      const row = await this.owned(
        id,
        actor,
        manager,
        await lockDashboardWrite(manager, id, { allowInactive: true }),
      );
      const key = { actorId: actor, requestId: input.requestId };
      const prior = await manager.findOneBy(DashboardLifecycleReceipt, key);
      if (prior) {
        if (
          prior.organizationId !== organizationId ||
          prior.dashboardId !== id ||
          prior.payloadDigest !== payloadDigest
        )
          throw this.stale('같은 요청 번호의 상태 변경 기준이 다릅니다.');
        return this.receipt(prior, true);
      }
      const dependencies = await dashboardDependencyCounts(row, manager);
      if (
        row.assetVersion !== input.expectedVersion ||
        dashboardLifecycleRevision(row, dependencies) !== input.expectedRevision ||
        row.assetVersion === MAX_VERSION
      )
        throw this.stale('대시보드 상태나 중단 영향이 변경되었습니다. 다시 확인해 주세요.');
      const version = row.assetVersion + 1;
      const updated = await manager.update(
        Dashboard,
        { id, assetVersion: row.assetVersion, assetActive: row.assetActive },
        { assetActive: input.active, assetVersion: version },
      );
      if (updated.affected !== 1)
        throw this.stale('대시보드 상태가 변경되었습니다. 다시 확인해 주세요.');
      const receipt = await manager.save(DashboardLifecycleReceipt, {
        ...key,
        organizationId,
        dashboardId: id,
        payloadDigest,
        active: input.active,
        version,
      });
      await manager.insert(EnterpriseAuditEvent, {
        organizationId,
        actorId: actor,
        action: input.active ? 'dashboard.activate' : 'dashboard.deactivate',
        resourceId: id,
        subjectId: null,
        version,
      });
      return this.receipt(receipt, false);
    };
    try {
      return await (this.db.options.type !== 'sqlite'
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
            '40001',
            '40P01',
            '55P03',
          ].includes(error.driverError?.code))
      )
        throw new ConflictException({
          statusCode: 409,
          error: 'Conflict',
          code: 'DASHBOARD_LIFECYCLE_RETRY_REQUIRED',
          message: '상태 변경 요청이 경합 중입니다. 같은 요청으로 결과를 확인해 주세요.',
        });
      throw error;
    }
  }
}
