import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHmac, randomBytes } from 'crypto';
import { DataSource, EntityManager, QueryFailedError } from 'typeorm';
import { metadataTransaction, serializeMetadataWork } from '../common/metadata-work';
import { lockStaffWrite } from './staff-write-lock';
import { lockDashboardWrite } from '../dashboard/dashboard-write-lock';
import { lockMetricSources } from '../metric/metric-write-lock';
import { Database } from '../database/entities/database.entity';
import { Dashboard } from '../dashboard/entities/dashboard.entity';
import { UserMapping } from '../user/entities/user-mapping.entity';
import { StudioState } from '../dashboard-studio/entities/studio-state.entity';
import { dashboardRevision } from '../dashboard/dashboard-revision';
import { EnterpriseHandoverProposal } from './entities/enterprise-handover-proposal.entity';
import { EnterpriseHandoverTransfer } from './entities/enterprise-handover-transfer.entity';
import { EnterpriseOrganization } from './entities/enterprise-organization.entity';
import { EnterpriseAuditEvent } from './entities/enterprise-audit-event.entity';
import { HandoverProposalService } from './handover-proposal.service';
import { inspectTransfer, transferHash, transferSourceIds } from './handover-transfer-basis';

@Injectable()
export class HandoverTransferService {
  constructor(private readonly db: DataSource, private readonly intent: HandoverProposalService) {}
  private uuid(value: unknown) {
    if (
      typeof value !== 'string' ||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value)
    )
      throw new BadRequestException('요청 UUID를 확인해 주세요.');
    return value;
  }
  private input(body: any, prepare: boolean) {
    const keys = prepare
      ? ['requestId', 'expectedProposalVersion', 'basis', 'acknowledgedTransfer']
      : ['expectedVersion', 'reviewBasis', 'acknowledgedTransfer'];
    if (
      !body ||
      typeof body !== 'object' ||
      Array.isArray(body) ||
      Object.keys(body).length !== keys.length ||
      Object.keys(body).some(k => !keys.includes(k)) ||
      body.acknowledgedTransfer !== true ||
      !Number.isSafeInteger(body[prepare ? 'expectedProposalVersion' : 'expectedVersion']) ||
      body[prepare ? 'expectedProposalVersion' : 'expectedVersion'] < 1 ||
      typeof body[prepare ? 'basis' : 'reviewBasis'] !== 'string' ||
      !/^[a-f0-9]{64}$/.test(body[prepare ? 'basis' : 'reviewBasis'])
    )
      throw new BadRequestException('최종 인계 기준과 별도 동의를 확인해 주세요.');
    if (prepare) this.uuid(body.requestId);
    return body;
  }
  private lock(manager: EntityManager) {
    return ['mysql', 'mariadb'].includes(manager.connection.options.type)
      ? { lock: { mode: 'pessimistic_write' as const } }
      : {};
  }
  private opaque(id: string, basis: string) {
    const secret = process.env.ACCESS_SECRET;
    if (!secret) throw new Error('Transfer basis secret is not configured');
    return createHmac('sha256', secret).update(`handover-transfer-v1:${id}:${basis}`).digest('hex');
  }
  private async proposal(
    manager: EntityManager,
    id: string,
    actor: number,
    scope: any,
    locked = false,
  ) {
    const row = await manager.findOne(EnterpriseHandoverProposal, {
      where: { requestId: id },
      ...(locked ? this.lock(manager) : {}),
    });
    this.intent.access(row, actor, scope);
    return row;
  }
  private async projection(
    manager: EntityManager,
    proposal: EnterpriseHandoverProposal,
    row: EnterpriseHandoverTransfer,
    actor: number,
    epoch: number,
    replayed: boolean,
  ) {
    const scope = await this.intent.context(manager, actor, epoch, proposal.requestId);
    const detailsAvailable =
      row.status !== 'cancelled' &&
      this.intent.available(scope, proposal) &&
      (row.status === 'completed' || row.expiresAt.getTime() > Date.now());
    return {
      proposalId: row.proposalId,
      requestId: row.requestId,
      organizationId: row.organizationId,
      ownerId: row.ownerId,
      recipientId: row.recipientId,
      version: row.version,
      status: row.status,
      reviewBasis: row.reviewBasis,
      expiresAt: row.expiresAt.toISOString(),
      acceptedAt: row.acceptedAt?.toISOString() ?? null,
      completedAt: row.completedAt?.toISOString() ?? null,
      detailsAvailable,
      dashboards: detailsAvailable ? JSON.parse(row.manifestJson) : [],
      replayed,
    };
  }
  private async current(
    manager: EntityManager,
    scope: any,
    proposal: EnterpriseHandoverProposal,
    locked: boolean,
  ) {
    if (
      proposal.status !== 'accepted' ||
      !proposal.acceptedAt ||
      !this.intent.available(scope, proposal)
    )
      throw new ConflictException('현재 수락된 인계 의향을 다시 확인해 주세요.');
    const manifest = JSON.parse(proposal.manifestJson);
    const ids = manifest
      .filter(a => a.kind === 'dashboard')
      .map(a => a.id)
      .sort((a, b) => a - b);
    if (locked) {
      for (const id of ids) await lockDashboardWrite(manager, id);
      const sources = await transferSourceIds(manager, ids);
      // Missing sources must remain a safe eligibility blocker, not a source lookup leak.
      const present = [];
      for (const id of sources) if (await manager.findOneBy(Database, { id })) present.push(id);
      await lockMetricSources(manager, present);
    }
    const org = await manager.findOneBy(EnterpriseOrganization, { id: proposal.organizationId });
    if (!org) throw new ConflictException('조직 기준이 변경됐습니다.');
    await this.intent.issued(manager, proposal, org, true);
    const inspected = await inspectTransfer(manager, manifest, proposal.recipientId, locked);
    if (!this.intent.available(scope, proposal))
      throw new ConflictException('인계 의향이 만료됐습니다.');
    const basisHash = transferHash({
      proposal: {
        id: proposal.requestId,
        version: proposal.version,
        reviewBasis: proposal.reviewBasis,
        ownerEpoch: proposal.ownerAuthVersion,
        recipientEpoch: proposal.recipientAuthVersion,
        organizationVersion: proposal.organizationVersion,
      },
      inspected: inspected.hash,
    });
    return {
      ...inspected,
      basisHash,
      dashboards: manifest
        .filter(a => a.kind === 'dashboard')
        .map(({ id, title }) => ({ id, title })),
    };
  }
  private async reading<T>(
    id: string,
    actor: number,
    epoch: number,
    run: (manager: EntityManager, scope: any, proposal: EnterpriseHandoverProposal) => Promise<T>,
    final = false,
  ) {
    return serializeMetadataWork(this.db, async () => {
      const capture = async (manager: EntityManager) => {
        const scope = await this.intent.context(manager, actor, epoch, id);
        const proposal = await this.proposal(manager, id, actor, scope);
        const row = final
          ? await manager.findOneBy(EnterpriseHandoverTransfer, { proposalId: id })
          : null;
        const result = await run(manager, scope, proposal);
        return { scope, row, result };
      };
      const snap = ['mysql', 'mariadb'].includes(this.db.options.type)
        ? await this.db.transaction('REPEATABLE READ', capture)
        : await this.db.transaction(capture);
      const fresh = await this.intent.context(this.db.manager, actor, epoch, id);
      if (Number(fresh.organizationId) !== Number(snap.scope.organizationId))
        throw new ForbiddenException('현재 조직이 변경됐습니다.');
      if (transferHash(fresh) !== transferHash(snap.scope))
        throw new ConflictException('인계 기준이 변경됐습니다. 다시 확인해 주세요.');
      if (
        final &&
        transferHash(
          await this.db.manager.findOneBy(EnterpriseHandoverTransfer, { proposalId: id }),
        ) !== transferHash(snap.row)
      )
        throw new ConflictException('최종 요청이 변경됐습니다.');
      const result = snap.result as any;
      if (
        final &&
        (Date.parse(fresh.expiresAt) <= Date.now() ||
          (result.status !== 'completed' && Date.parse(result.expiresAt) <= Date.now()))
      ) {
        result.detailsAvailable = false;
        result.dashboards = [];
      }
      if (!final && Date.parse(fresh.expiresAt) <= Date.now())
        throw new ConflictException('인계 의향이 만료됐습니다.');
      if (!final) {
        const proposal = await this.proposal(this.db.manager, id, actor, fresh);
        const current = await this.current(this.db.manager, fresh, proposal, false);
        if (this.opaque(id, current.basisHash) !== result.basis)
          throw new ConflictException('검토 후 자료 기준이 변경됐습니다.');
      }
      return snap.result;
    });
  }
  async review(value: unknown, actor: number, epoch: number) {
    const id = this.uuid(value);
    return this.reading(id, actor, epoch, async (manager, scope, proposal) => {
      if (proposal.ownerId !== actor)
        throw new ForbiddenException('소유자만 최종 인계를 검토할 수 있습니다.');
      const current = await this.current(manager, scope, proposal, false);
      return {
        proposalId: id,
        organizationId: proposal.organizationId,
        ownerId: proposal.ownerId,
        recipientId: proposal.recipientId,
        proposalVersion: proposal.version,
        checkedAt: new Date().toISOString(),
        basis: this.opaque(id, current.basisHash),
        eligible: current.blockers.length === 0,
        blockers: current.blockers,
        dashboards: current.dashboards,
      };
    });
  }
  async detail(value: unknown, actor: number, epoch: number) {
    const id = this.uuid(value);
    return this.reading(
      id,
      actor,
      epoch,
      async (manager, _scope, proposal) => {
        const row = await manager.findOneBy(EnterpriseHandoverTransfer, { proposalId: id });
        if (!row) throw new NotFoundException('최종 인계 요청을 찾을 수 없습니다.');
        return this.projection(manager, proposal, row, actor, epoch, false);
      },
      true,
    );
  }
  private async transaction<T>(run: (manager: EntityManager) => Promise<T>) {
    try {
      return await (['mysql', 'mariadb'].includes(this.db.options.type)
        ? metadataTransaction(this.db, 'READ COMMITTED', run)
        : metadataTransaction(this.db, run));
    } catch (e) {
      if (
        e instanceof QueryFailedError &&
        (/UNIQUE|PRIMARY KEY/i.test(e.driverError?.message ?? '') ||
          [
            'SQLITE_BUSY',
            'SQLITE_LOCKED',
            'ER_DUP_ENTRY',
            'ER_LOCK_DEADLOCK',
            'ER_LOCK_WAIT_TIMEOUT',
          ].includes(e.driverError?.code))
      )
        throw new ConflictException('최종 요청이 경합 중입니다. 같은 번호로 상태를 확인해 주세요.');
      throw e;
    }
  }
  private async audit(
    manager: EntityManager,
    row: EnterpriseHandoverTransfer,
    actor: number,
    action: string,
  ) {
    const inserted = await manager.insert(EnterpriseAuditEvent, {
      organizationId: row.organizationId,
      actorId: actor,
      subjectId: row.recipientId,
      resourceId: row.ownerId,
      version: row.version,
      action: `handover.transfer.${action}`,
    });
    return Number(inserted.identifiers[0].id);
  }
  private async locked(
    manager: EntityManager,
    id: string,
    actor: number,
    epoch: number,
    hint: EnterpriseHandoverProposal,
  ) {
    await lockStaffWrite(manager, [hint.ownerId, hint.recipientId]);
    const scope = await this.intent.context(manager, actor, epoch, id);
    const proposal = await this.proposal(manager, id, actor, scope, true);
    const row = await manager.findOne(EnterpriseHandoverTransfer, {
      where: { proposalId: id },
      ...this.lock(manager),
    });
    await manager.findOne(EnterpriseOrganization, {
      where: { id: proposal.organizationId },
      ...this.lock(manager),
    });
    return { scope, proposal, row };
  }
  async prepare(value: unknown, actor: number, epoch: number, input: unknown) {
    const id = this.uuid(value),
      body = this.input(input, true);
    return serializeMetadataWork(this.db, async () => {
      const initialScope = await this.intent.context(this.db.manager, actor, epoch, id);
      const hint = await this.proposal(this.db.manager, id, actor, initialScope);
      return this.transaction(async manager => {
        const {
          scope,
          proposal,
          row: existing,
        } = await this.locked(manager, id, actor, epoch, hint);
        if (proposal.ownerId !== actor)
          throw new ForbiddenException('소유자만 최종 요청을 준비할 수 있습니다.');
        const payloadHash = transferHash(body);
        if (existing) {
          if (existing.requestId !== body.requestId || existing.payloadHash !== payloadHash)
            throw new ConflictException('이미 다른 최종 요청이 있습니다.');
          return this.projection(manager, proposal, existing, actor, epoch, true);
        }
        if (proposal.version !== body.expectedProposalVersion)
          throw new ConflictException('의향 버전이 변경됐습니다.');
        const current = await this.current(manager, scope, proposal, true);
        if (current.blockers.length || this.opaque(id, current.basisHash) !== body.basis)
          throw new ConflictException('최종 이전 기준이 변경되었거나 지원하지 않습니다.');
        const row = manager.create(EnterpriseHandoverTransfer, {
          proposalId: id,
          requestId: body.requestId,
          organizationId: proposal.organizationId,
          ownerId: proposal.ownerId,
          recipientId: proposal.recipientId,
          ownerAuthVersion: proposal.ownerAuthVersion,
          recipientAuthVersion: proposal.recipientAuthVersion,
          organizationVersion: proposal.organizationVersion,
          version: 1,
          status: 'prepared',
          expiresAt: new Date(
            Math.floor(Math.min(proposal.expiresAt.getTime(), Date.now() + 15 * 60000) / 1000) *
              1000,
          ),
          acceptedAt: null,
          completedAt: null,
          acceptedAuditId: null,
          completedAuditId: null,
          cancelledAuditId: null,
          manifestJson: JSON.stringify(current.dashboards),
          basisHash: current.basisHash,
          payloadHash,
          reviewBasis: randomBytes(32).toString('hex'),
        });
        row.preparedAuditId = await this.audit(manager, row, actor, 'prepared');
        await manager.insert(EnterpriseHandoverTransfer, row);
        return this.projection(manager, proposal, row, actor, epoch, false);
      });
    });
  }
  async change(
    value: unknown,
    actor: number,
    epoch: number,
    input: unknown,
    action: 'accept' | 'execute' | 'cancel',
  ) {
    const id = this.uuid(value),
      body = this.input(input, false);
    return serializeMetadataWork(this.db, async () => {
      const initialScope = await this.intent.context(this.db.manager, actor, epoch, id);
      const hint = await this.proposal(this.db.manager, id, actor, initialScope);
      return this.transaction(async manager => {
        const { scope, proposal, row } = await this.locked(manager, id, actor, epoch, hint);
        if (!row) throw new NotFoundException('최종 인계 요청을 찾을 수 없습니다.');
        if ((action === 'accept' ? row.recipientId : row.ownerId) !== actor)
          throw new ForbiddenException('최종 인계 동의 당사자를 확인해 주세요.');
        if (row.reviewBasis !== body.reviewBasis)
          throw new ConflictException('최종 검토 기준이 다릅니다.');
        if (
          (action === 'accept' && body.expectedVersion === 1 && row.acceptedAt) ||
          (action === 'execute' && body.expectedVersion === 2 && row.status === 'completed') ||
          (action === 'cancel' &&
            row.status === 'cancelled' &&
            body.expectedVersion === row.version - 1)
        )
          return this.projection(manager, proposal, row, actor, epoch, true);
        if (row.version !== body.expectedVersion || ['completed', 'cancelled'].includes(row.status))
          throw new ConflictException('최종 요청 상태가 변경됐습니다.');
        if (action !== 'cancel') {
          if (
            (action === 'accept' ? row.status !== 'prepared' : row.status !== 'accepted') ||
            row.expiresAt.getTime() <= Date.now()
          )
            throw new ConflictException('최종 요청 상태 또는 기한을 다시 확인해 주세요.');
          const current = await this.current(manager, scope, proposal, true);
          if (current.blockers.length || current.basisHash !== row.basisHash)
            throw new ConflictException('최종 이전 기준이 변경됐습니다.');
          // Parent/child locks may have waited beyond the final consent window.
          // Replays returned above; new acceptance/execution must still be live now.
          if (row.expiresAt.getTime() <= Date.now())
            throw new ConflictException('최종 인계 요청이 만료됐습니다.');
          if (action === 'execute') {
            for (const item of current.boards) {
              const mapping = item.mappings[0];
              const changed = await manager.update(
                UserMapping,
                { id: mapping.id, dashboardId: item.dashboard.id, userInfoId: row.ownerId },
                { userInfoId: row.recipientId },
              );
              if (changed.affected !== 1) throw new ConflictException('소유 매핑이 변경됐습니다.');
              const next = { ...item.dashboard, assetVersion: item.dashboard.assetVersion + 1 };
              const bumped = await manager.update(
                Dashboard,
                { id: next.id, assetVersion: item.dashboard.assetVersion },
                { assetVersion: next.assetVersion },
              );
              if (bumped.affected !== 1)
                throw new ConflictException('대시보드 버전이 변경됐습니다.');
              if (item.studio) {
                const rebound = await manager.update(
                  StudioState,
                  { dashboardId: next.id, legacyRevision: item.studio.legacyRevision },
                  { legacyRevision: dashboardRevision(next) },
                );
                if (rebound.affected !== 1)
                  throw new ConflictException('Studio 기준이 변경됐습니다.');
              }
            }
          }
        }
        const previous = row.version;
        row.version++;
        row.status =
          action === 'accept' ? 'accepted' : action === 'execute' ? 'completed' : 'cancelled';
        if (action === 'accept') row.acceptedAt = new Date(Math.floor(Date.now() / 1000) * 1000);
        if (action === 'execute') row.completedAt = new Date(Math.floor(Date.now() / 1000) * 1000);
        row[
          action === 'accept'
            ? 'acceptedAuditId'
            : action === 'execute'
            ? 'completedAuditId'
            : 'cancelledAuditId'
        ] = await this.audit(
          manager,
          row,
          actor,
          action === 'accept' ? 'accepted' : action === 'execute' ? 'completed' : 'cancelled',
        );
        const changed = await manager.update(
          EnterpriseHandoverTransfer,
          { proposalId: id, version: previous, reviewBasis: row.reviewBasis },
          row,
        );
        if (changed.affected !== 1) throw new ConflictException('최종 요청 버전이 변경됐습니다.');
        return this.projection(manager, proposal, row, actor, epoch, false);
      });
    });
  }
}
