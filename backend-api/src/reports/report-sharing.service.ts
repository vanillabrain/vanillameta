import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager, QueryFailedError } from 'typeorm';
import { z } from 'zod';
import { catalogActorContext } from '../bi/source-classifications';
import { sourceWriteTransaction } from '../database/source-write-lock';
import { lockStaffWrite } from '../enterprise/staff-write-lock';
import { lockDashboardWrite } from '../dashboard/dashboard-write-lock';
import { lockMetricSources } from '../metric/metric-write-lock';
import { Dashboard } from '../dashboard/entities/dashboard.entity';
import { Database } from '../database/entities/database.entity';
import { User } from '../user/entities/user.entity';
import { UserMapping } from '../user/entities/user-mapping.entity';
import { EnterpriseMembership } from '../enterprise/entities/enterprise-membership.entity';
import { StudioState } from '../dashboard-studio/entities/studio-state.entity';
import { PrivateReport } from './report.entity';
import { ReportDelivery, ReportDeliveryReceipt } from './report-sharing.entity';
import { ReportsService } from './reports.service';
import { canonicalReport, parseReport, reportHash, reportId, ReportActor } from './report-contract';
import {
  reportPeerQuery,
  reportShareCommand,
  reportShareReceipt,
  ShareReceipt,
} from './report-sharing-contract';
import { readerContent } from './report-reader';

const denied = () => new ForbiddenException('현재 이 보고서에 접근할 수 없습니다.');
const sourceBinding = z.object({ sourceId: z.number().int().positive() });
const analysisBinding = z.object({ databaseId: z.number().int().positive() });
const studioBinding = z.object({ document: sourceBinding });
const validEpoch = (value: number) => Number.isSafeInteger(value) && value >= 0;

@Injectable()
export class ReportSharingService {
  constructor(private readonly db: DataSource, private readonly reports: ReportsService) {}

  private actorContext(manager: EntityManager, actor: ReportActor) {
    if (!actor || !validEpoch(actor.authVersion)) throw denied();
    return catalogActorContext(manager, actor.id, actor.authVersion);
  }
  private async transaction<T>(
    actor: ReportActor,
    run: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    if (!actor || !validEpoch(actor.authVersion)) throw denied();
    try {
      return await sourceWriteTransaction(this.db, run);
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        [
          'ER_LOCK_DEADLOCK',
          'ER_LOCK_WAIT_TIMEOUT',
          '40001',
          '40P01',
          '55P03',
          'SQLITE_BUSY',
        ].includes(error.driverError?.code)
      )
        throw new ConflictException(
          '동시 변경을 확인하지 못했습니다. 같은 요청으로 명시적으로 다시 확인해 주세요.',
        );
      throw error;
    }
  }
  private async head(manager: EntityManager, id: string, lock = false) {
    const head = await manager.findOne(PrivateReport, {
      where: { id },
      ...(lock && manager.connection.options.type !== 'sqlite'
        ? { lock: { mode: 'pessimistic_write' as const } }
        : {}),
    });
    if (!head) throw new NotFoundException('보고서를 찾을 수 없습니다.');
    return head;
  }
  private async identity(manager: EntityManager, id: number) {
    const user = await manager.findOne(User, {
      where: { id },
      select: { id: true, userId: true, active: true, authVersion: true },
    });
    const member = await manager.findOneBy(EnterpriseMembership, { userId: id });
    return { user, member };
  }
  private async lockRoots(manager: EntityManager, heads: PrivateReport[], allowInactive = false) {
    for (const id of [...new Set(heads.map(head => head.dashboardId))].sort((a, b) => a - b))
      try {
        await lockDashboardWrite(manager, id, { allowInactive });
      } catch (error) {
        if (!(error instanceof ForbiddenException)) throw error;
      }
    for (const id of [...new Set(heads.map(head => head.sourceId))].sort((a, b) => a - b))
      try {
        await lockMetricSources(manager, [id]);
      } catch (error) {
        if (!(error instanceof ForbiddenException)) throw error;
      }
  }
  private async root(manager: EntityManager, head: PrivateReport, allowInactive: boolean) {
    const dashboard = await manager.findOneBy(Dashboard, { id: head.dashboardId });
    const source = await manager.findOneBy(Database, { id: head.sourceId });
    const mappings = await manager.findBy(UserMapping, { dashboardId: head.dashboardId });
    const state = await manager.findOneBy(StudioState, { dashboardId: head.dashboardId });
    if (
      !dashboard ||
      dashboard.delYn === 'Y' ||
      !source ||
      source.ownerId !== head.ownerId ||
      mappings.length !== 1 ||
      mappings[0].userInfoId !== head.ownerId ||
      !state
    )
      throw denied();
    try {
      if (
        studioBinding.parse(JSON.parse(state.document)).document.sourceId !== head.sourceId ||
        analysisBinding.parse(JSON.parse(dashboard.analysisDefinition)).databaseId !== head.sourceId
      )
        throw denied();
    } catch {
      throw denied();
    }
    const active = dashboard.assetActive !== false && source.catalogActive !== false;
    if (!allowInactive && !active) throw denied();
    return active;
  }
  private async owner(
    manager: EntityManager,
    head: PrivateReport,
    actor: ReportActor,
    allowInactive: boolean,
  ) {
    const context = await this.actorContext(manager, actor);
    if (
      head.ownerId !== actor.id ||
      context.organizationId !== head.organizationKey ||
      !context.organizationId
    )
      throw denied();
    const active = await this.root(manager, head, allowInactive);
    return { context, active };
  }
  private async readable(manager: EntityManager, head: PrivateReport, actor: ReportActor) {
    const context = await this.actorContext(manager, actor);
    if ((context.organizationId ?? 0) !== head.organizationKey) throw denied();
    await this.root(manager, head, false);
    if (head.ownerId === actor.id)
      return { role: 'owner' as const, version: head.version, hash: head.revision };
    const { user, member } = await this.identity(manager, head.ownerId);
    const relation = await manager.findOneBy(ReportDelivery, {
      reportId: head.id,
      recipientId: actor.id,
    });
    if (
      !head.organizationKey ||
      !user?.active ||
      !validEpoch(user.authVersion) ||
      member?.organizationId !== head.organizationKey ||
      !['admin', 'member'].includes(member.role) ||
      !relation?.active ||
      relation.ownerId !== head.ownerId ||
      relation.organizationId !== head.organizationKey ||
      relation.ownerAuthVersion !== user.authVersion ||
      relation.recipientAuthVersion !== context.authVersion
    )
      throw denied();
    return {
      role: 'recipient' as const,
      version: relation.pinnedVersion,
      hash: relation.pinnedHash,
    };
  }
  async reader(rawId: string, actor: ReportActor) {
    const id = parseReport(reportId, rawId);
    return this.transaction(actor, async manager => {
      const hint = await this.head(manager, id);
      await lockStaffWrite(manager, [actor.id, hint.ownerId]);
      await this.lockRoots(manager, [hint]);
      const head = await this.head(manager, id, true);
      const access = await this.readable(manager, head, actor);
      const report = await this.reports.stored(manager, head, access.version);
      if (report.revision !== access.hash) throw denied();
      return { role: access.role, ...readerContent(report) };
    });
  }
  async library(actor: ReportActor, rawAfter?: string) {
    const after = rawAfter === undefined ? '' : parseReport(reportId, rawAfter);
    return this.transaction(actor, async manager => {
      const candidates = await manager
        .createQueryBuilder(PrivateReport, 'r')
        .where('r.id > :after', { after })
        .andWhere(
          '(r.ownerId = :actor OR r.id IN (SELECT d."reportId" FROM private_report_delivery d WHERE d."recipientId" = :actor AND d.active = :active))',
          { actor: actor.id, active: true },
        )
        .orderBy('r.id', 'ASC')
        .take(51)
        .getMany();
      const page = candidates.slice(0, 50);
      await lockStaffWrite(manager, [actor.id, ...page.map(head => head.ownerId)]);
      await this.actorContext(manager, actor);
      await this.lockRoots(manager, page);
      const items: Array<{
        kind: 'report';
        id: string;
        title: string;
        version: number;
        updatedAt: string;
        ownership: 'owned' | 'received';
      }> = [];
      for (const hint of page) {
        const head = await this.head(manager, hint.id, true);
        try {
          const access = await this.readable(manager, head, actor);
          const stored = await this.reports.stored(manager, head, access.version);
          if (stored.revision !== access.hash) throw denied();
          items.push({
            kind: 'report',
            id: head.id,
            title: stored.title,
            version: stored.version,
            updatedAt: stored.savedAt,
            ownership: access.role === 'owner' ? 'owned' : 'received',
          });
        } catch (error) {
          if (!(error instanceof ForbiddenException)) throw error;
        }
      }
      return { items, nextCursor: candidates.length > 50 ? page[page.length - 1].id : null };
    });
  }
  async peers(rawId: string, actor: ReportActor, query: unknown) {
    const id = parseReport(reportId, rawId),
      input = parseReport(reportPeerQuery, query);
    return this.transaction(actor, async manager => {
      const hint = await this.head(manager, id);
      const escaped = input.q.replace(/[!%_]/g, value => '!' + value);
      const candidates = await manager
        .createQueryBuilder(User, 'u')
        .innerJoin(EnterpriseMembership, 'm', 'm.userId = u.id')
        .select(['u.id'])
        .where(
          'm.organizationId = :org AND u.active = :active AND u.id != :owner AND u.id > :after',
          { org: hint.organizationKey, active: true, owner: actor.id, after: input.afterId },
        )
        .andWhere("(u.userId LIKE :q ESCAPE '!' OR m.team LIKE :q ESCAPE '!')", {
          q: '%' + escaped + '%',
        })
        .orderBy('u.id', 'ASC')
        .take(21)
        .getMany();
      await lockStaffWrite(manager, [actor.id, hint.ownerId, ...candidates.map(user => user.id)]);
      await this.lockRoots(manager, [hint]);
      const head = await this.head(manager, id, true);
      await this.owner(manager, head, actor, false);
      const items: Array<{ id: number; userId: string; team: string }> = [];
      for (const candidate of candidates.slice(0, 20)) {
        const { user, member } = await this.identity(manager, candidate.id);
        if (
          user?.active &&
          member?.organizationId === head.organizationKey &&
          ['admin', 'member'].includes(member.role)
        )
          items.push({ id: user.id, userId: user.userId, team: member.team });
      }
      return { items, nextCursor: candidates.length > 20 ? candidates[19].id : null };
    });
  }
  async shares(rawId: string, actor: ReportActor, rawAfter?: string) {
    const id = parseReport(reportId, rawId),
      afterId = parseReport(reportPeerQuery, { afterId: rawAfter }).afterId;
    return this.transaction(actor, async manager => {
      const hint = await this.head(manager, id);
      const page = await manager
        .createQueryBuilder(ReportDelivery, 'd')
        .where('d.reportId = :id AND d.recipientId > :afterId', { id, afterId })
        .orderBy('d.recipientId', 'ASC')
        .take(51)
        .getMany();
      await lockStaffWrite(manager, [actor.id, hint.ownerId, ...page.map(row => row.recipientId)]);
      await this.lockRoots(manager, [hint], true);
      const head = await this.head(manager, id, true);
      const { context, active } = await this.owner(manager, head, actor, true);
      const items = await Promise.all(
        page.slice(0, 50).map(async hint => {
          const row = await manager.findOneByOrFail(ReportDelivery, {
            reportId: id,
            recipientId: hint.recipientId,
          });
          const { user, member } = await this.identity(manager, row.recipientId);
          const current =
            user?.active &&
            validEpoch(user.authVersion) &&
            member?.organizationId === head.organizationKey &&
            ['admin', 'member'].includes(member.role);
          return {
            recipientId: row.recipientId,
            userId: current ? user.userId : null,
            team: current ? member.team : null,
            active: row.active,
            relationVersion: row.relationVersion,
            pinnedVersion: row.pinnedVersion,
            status: !row.active
              ? ('revoked' as const)
              : active &&
                current &&
                row.ownerAuthVersion === context.authVersion &&
                row.recipientAuthVersion === user.authVersion
              ? ('active' as const)
              : ('suspended' as const),
          };
        }),
      );
      return {
        organizationId: head.organizationKey,
        headRevision: active ? head.revision : null,
        headVersion: active ? head.version : null,
        canShare: active,
        items,
        nextCursor: page.length > 50 ? page[49].recipientId : null,
      };
    });
  }
  async change(rawId: string, input: unknown, actor: ReportActor) {
    const id = parseReport(reportId, rawId),
      body = parseReport(reportShareCommand, input);
    const digest = reportHash(canonicalReport({ id, ...body }));
    return this.transaction(actor, async manager => {
      const hint = await this.head(manager, id);
      await lockStaffWrite(manager, [actor.id, hint.ownerId, body.recipientId]);
      await this.lockRoots(manager, [hint], body.operation.kind === 'revoke');
      const head = await this.head(manager, id, true);
      const { context } = await this.owner(manager, head, actor, body.operation.kind === 'revoke');
      if (context.organizationId !== body.expectedOrganizationId)
        throw new ConflictException('현재 조직이 변경됐습니다.');
      const receiptKey = {
        ownerId: actor.id,
        organizationId: head.organizationKey,
        requestId: body.requestId,
      };
      const prior = await manager.findOneBy(ReportDeliveryReceipt, receiptKey);
      if (prior) {
        if (prior.reportId !== id || prior.payloadHash !== digest)
          throw new ConflictException('같은 요청 ID의 입력이 다릅니다.');
        return { receipt: reportShareReceipt.parse(JSON.parse(prior.result)), replayed: true };
      }
      if (body.recipientId === actor.id) throw denied();
      const key = { reportId: id, recipientId: body.recipientId };
      const relation = await manager.findOneBy(ReportDelivery, key);
      if ((relation?.relationVersion ?? 0) !== body.expectedRelationVersion)
        throw new ConflictException('공유 상태가 변경됐습니다. 현재 상태를 다시 확인해 주세요.');
      let version = relation?.relationVersion ?? 0;
      let pinnedVersion = relation?.pinnedVersion ?? null;
      if (body.operation.kind === 'share') {
        if (head.revision !== body.operation.expectedHeadRevision)
          throw new ConflictException('최신 저장본이 변경됐습니다. 다시 검토해 주세요.');
        const { user, member } = await this.identity(manager, body.recipientId);
        if (
          !user?.active ||
          !validEpoch(user.authVersion) ||
          member?.organizationId !== head.organizationKey ||
          !['admin', 'member'].includes(member.role)
        )
          throw denied();
        const report = await this.reports.stored(manager, head);
        readerContent(report);
        if (
          !relation?.active &&
          (await manager.countBy(ReportDelivery, { reportId: id, active: true })) >= 50
        )
          throw new ConflictException(
            '활성 공유는 보고서당 50명까지입니다. 먼저 기존 공유를 회수해 주세요.',
          );
        const changed =
          !relation?.active ||
          relation.pinnedVersion !== head.version ||
          relation.pinnedHash !== head.revision ||
          relation.ownerAuthVersion !== context.authVersion ||
          relation.recipientAuthVersion !== user.authVersion;
        version += changed ? 1 : 0;
        pinnedVersion = head.version;
        const next = {
          ...key,
          ownerId: actor.id,
          organizationId: head.organizationKey,
          active: true,
          relationVersion: version,
          pinnedVersion,
          pinnedHash: head.revision,
          ownerAuthVersion: context.authVersion,
          recipientAuthVersion: user.authVersion,
        };
        if (relation) await manager.update(ReportDelivery, key, next);
        else await manager.insert(ReportDelivery, next);
      } else if (relation?.active) {
        version += 1;
        await manager.update(ReportDelivery, key, { active: false, relationVersion: version });
      }
      const receipt: ShareReceipt = {
        requestId: body.requestId,
        recipientId: body.recipientId,
        operation: body.operation.kind,
        relationVersion: version,
        pinnedVersion,
        committedAt: new Date().toISOString(),
      };
      await manager.insert(ReportDeliveryReceipt, {
        ...receiptKey,
        reportId: id,
        payloadHash: digest,
        result: canonicalReport(receipt),
      });
      return { receipt, replayed: false };
    });
  }
  async outcome(rawId: string, rawRequestId: string, actor: ReportActor) {
    const id = parseReport(reportId, rawId),
      requestId = parseReport(reportId, rawRequestId);
    return this.transaction(actor, async manager => {
      const hint = await this.head(manager, id);
      await lockStaffWrite(manager, [actor.id, hint.ownerId]);
      await this.lockRoots(manager, [hint], true);
      const head = await this.head(manager, id, true);
      await this.owner(manager, head, actor, true);
      const prior = await manager.findOneBy(ReportDeliveryReceipt, {
        ownerId: actor.id,
        organizationId: head.organizationKey,
        requestId,
      });
      if (!prior) return { status: 'missing' as const };
      if (prior.reportId !== id) throw new ConflictException('요청 대상이 다릅니다.');
      return {
        status: 'committed' as const,
        receipt: reportShareReceipt.parse(JSON.parse(prior.result)),
      };
    });
  }
}
