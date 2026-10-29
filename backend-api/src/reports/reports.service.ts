import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { DataSource, EntityManager, QueryFailedError } from 'typeorm';
import { catalogActorContext } from '../bi/source-classifications';
import { sourceWriteTransaction } from '../database/source-write-lock';
import { lockDashboardWrite } from '../dashboard/dashboard-write-lock';
import { lockMetricSources } from '../metric/metric-write-lock';
import { Dashboard } from '../dashboard/entities/dashboard.entity';
import { Database } from '../database/entities/database.entity';
import { UserMapping } from '../user/entities/user-mapping.entity';
import { StudioState } from '../dashboard-studio/entities/studio-state.entity';
import { dashboardRevision } from '../dashboard/dashboard-revision';
import { validateStudioDocument } from '../dashboard-studio/studio-document';
import { SourceAccessService } from '../ownership/source-access.service';
import { StudioService, PrivateReportSnapshot } from '../dashboard-studio/studio.service';
import {
  PrivateReport,
  PrivateReportRevision,
  PrivateReportChunk,
  PrivateReportRequest,
} from './report.entity';
import {
  ReportActor,
  canonicalReport,
  encodeReport,
  parseReport,
  reportHash,
  reportId,
  reportPreviewRequest,
  reportSaveRequest,
  REPORT_OWNER_LIMIT,
  REPORT_PAYLOAD_LIMIT,
} from './report-contract';

export type ReportPayload = {
  reportId: string;
  version: number;
  title: string;
  body: string;
  savedAt: string;
  snapshot: PrivateReportSnapshot;
};
export type ReportResult = ReportPayload & { revision: string; organizationId: number | null };
@Injectable()
export class ReportsService {
  constructor(
    private readonly db: DataSource,
    private readonly studio: StudioService,
    private readonly access: SourceAccessService,
  ) {}

  private async root(
    manager: EntityManager,
    dashboardId: number,
    actor: ReportActor,
    lock: boolean,
  ) {
    if (!Number.isSafeInteger(dashboardId) || dashboardId < 1)
      throw new BadRequestException('보고서의 저장 분석을 확인해 주세요.');
    if (!Number.isSafeInteger(actor?.authVersion) || actor.authVersion < 0)
      throw new ForbiddenException('현재 로그인 세션이 필요합니다.');
    const context = await catalogActorContext(manager, actor.id, actor.authVersion, lock);
    const dashboard = lock
      ? await lockDashboardWrite(manager, dashboardId)
      : await manager.findOne(Dashboard, { where: { id: dashboardId } });
    const owners = await manager.find(UserMapping, { where: { dashboardId } });
    if (
      !dashboard ||
      dashboard.delYn === 'Y' ||
      dashboard.assetActive === false ||
      owners.length !== 1 ||
      owners[0].userInfoId !== actor.id
    )
      throw new ForbiddenException('현재 소유한 활성 분석만 사용할 수 있습니다.');
    const state = await manager.findOne(StudioState, { where: { dashboardId } });
    if (!state) throw new ForbiddenException('Studio에 저장한 분석이 필요합니다.');
    const document = validateStudioDocument(JSON.parse(state.document).document);
    if (
      !dashboard.analysisDefinition ||
      JSON.parse(dashboard.analysisDefinition).databaseId !== document.sourceId
    )
      throw new ForbiddenException('보고서 원본의 소스가 변경됐습니다.');
    const source = lock
      ? (await lockMetricSources(manager, [document.sourceId])).get(document.sourceId)
      : await manager.findOne(Database, { where: { id: document.sourceId } });
    if (!source || source.ownerId !== actor.id || source.catalogActive === false)
      throw new ForbiddenException('U1 보고서는 본인이 소유한 활성 소스만 지원합니다.');
    await this.access.dashboard(dashboardId, actor.id, 'read', manager);
    await this.access.assert('database', source.id, actor.id, 'read', manager);
    return { context, dashboard, source, document, state };
  }
  private async allowed(
    manager: EntityManager,
    head: PrivateReport,
    actor: ReportActor,
    lock: boolean,
  ) {
    if (head.ownerId !== actor.id)
      throw new ForbiddenException('본인의 비공개 보고서만 볼 수 있습니다.');
    const root = await this.root(manager, head.dashboardId, actor, lock);
    if (
      head.organizationKey !== (root.context.organizationId ?? 0) ||
      head.sourceId !== root.source.id
    )
      throw new ForbiddenException('보고서의 현재 조직과 소스를 확인해 주세요.');
    return root;
  }
  private requireHead(manager: EntityManager, id: string) {
    return manager.findOneOrFail(PrivateReport, { where: { id } }).catch(() => {
      throw new NotFoundException('보고서를 찾을 수 없습니다.');
    });
  }
  private async stored(
    manager: EntityManager,
    head: PrivateReport,
    version = head.version,
  ): Promise<ReportResult> {
    const metadata = await manager.findOne(PrivateReportRevision, {
      where: { reportId: head.id, version },
    });
    const chunks = await manager.find(PrivateReportChunk, {
      where: { reportId: head.id, version },
      order: { ordinal: 'ASC' },
    });
    const corrupt = () => {
      throw new InternalServerErrorException('보고서 저장 무결성을 확인하지 못했습니다.');
    };
    if (
      !metadata ||
      metadata.ownerId !== head.ownerId ||
      metadata.bytes > REPORT_PAYLOAD_LIMIT ||
      metadata.bytes < 1 ||
      chunks.length !== metadata.chunkCount ||
      chunks.some((chunk, i) => chunk.ordinal !== i || Array.from(chunk.payload).length > 8000)
    )
      corrupt();
    const payload = chunks.map(chunk => chunk.payload).join('');
    if (
      Buffer.byteLength(payload, 'utf8') !== metadata.bytes ||
      reportHash(payload) !== metadata.revision ||
      (version === head.version && metadata.revision !== head.revision)
    )
      corrupt();
    const value: ReportPayload = JSON.parse(payload);
    if (
      value.reportId !== head.id ||
      value.version !== version ||
      canonicalReport(value) !== payload
    )
      corrupt();
    return { ...value, revision: metadata.revision, organizationId: head.organizationKey || null };
  }
  async rootOptions(dashboardId: number, actor: ReportActor) {
    return sourceWriteTransaction(this.db, async manager => {
      const root = await this.root(manager, dashboardId, actor, true);
      if (root.state.legacyRevision !== dashboardRevision(root.dashboard))
        throw new ConflictException('Studio에서 최신 분석을 저장한 뒤 보고서를 작성해 주세요.');
      return {
        dashboardId,
        revision: dashboardRevision(root.dashboard),
        organizationId: root.context.organizationId,
        title: root.document.title,
        blocks: root.document.blocks
          .filter(block =>
            ['BOARD_NUMERIC', 'CHART_BAR', 'CHART_COLUMN', 'CHART_LINE'].includes(block.kind),
          )
          .map(({ id, title, kind }) => ({ id, title, kind })),
      };
    });
  }
  async list(actor: ReportActor) {
    return sourceWriteTransaction(this.db, async manager => {
      const context = await catalogActorContext(manager, actor.id, actor.authVersion, true);
      const heads = await manager.find(PrivateReport, {
        where: { ownerId: actor.id, organizationKey: context.organizationId ?? 0 },
        order: { updatedAt: 'DESC', id: 'ASC' },
      });
      const items: Array<{ id: string; title: string; revision: string; updatedAt: string }> = [];
      for (const head of heads) {
        try {
          await this.allowed(manager, head, actor, true);
          const stored = await this.stored(manager, head);
          items.push({
            id: head.id,
            title: stored.title,
            revision: stored.revision,
            updatedAt: stored.savedAt,
          });
        } catch (error) {
          if (!(error instanceof ForbiddenException)) throw error;
        }
      }
      return items;
    });
  }
  async get(rawId: string, actor: ReportActor) {
    const id = parseReport(reportId, rawId);
    return sourceWriteTransaction(this.db, async manager => {
      const head = await this.requireHead(manager, id);
      await this.allowed(manager, head, actor, true);
      return this.stored(manager, await this.requireHead(manager, id));
    });
  }
  async outcome(rawId: string, rawRequestId: string, dashboardId: number, actor: ReportActor) {
    const id = parseReport(reportId, rawId),
      requestId = parseReport(reportId, rawRequestId);
    return sourceWriteTransaction(this.db, async manager => {
      const root = await this.root(manager, dashboardId, actor, true);
      const head = await manager.findOne(PrivateReport, { where: { id } });
      if (head) await this.allowed(manager, head, actor, false);
      const receipt = await manager.findOne(PrivateReportRequest, {
        where: { ownerId: actor.id, organizationKey: root.context.organizationId ?? 0, requestId },
      });
      if (!receipt) return { status: 'missing' as const };
      if (!head || receipt.reportId !== id || head.dashboardId !== dashboardId)
        throw new ConflictException('요청 대상이 다릅니다.');
      return {
        status: 'committed' as const,
        report: await this.stored(manager, head, receipt.version),
      };
    });
  }
  async preview(rawId: string, input: unknown, actor: ReportActor) {
    const id = parseReport(reportId, rawId),
      body = parseReport(reportPreviewRequest, input);
    const fence = async (manager: EntityManager, lock: boolean) => {
      const root = await this.root(manager, body.capture.dashboardId, actor, lock);
      if (root.context.organizationId !== body.expectedOrganizationId)
        throw new ConflictException('현재 조직이 변경됐습니다.');
      const head = await manager.findOne(PrivateReport, { where: { id } });
      if (head) {
        await this.allowed(manager, head, actor, false);
        if (head.dashboardId !== body.capture.dashboardId)
          throw new ConflictException('보고서 원본은 변경할 수 없습니다.');
      }
    };
    return this.studio.capturePrivateReport(body.capture, actor.id, fence, async snapshot => {
      encodeReport(snapshot);
      return { snapshot, previewDigest: this.previewDigest(snapshot) };
    });
  }
  private previewDigest(snapshot: PrivateReportSnapshot) {
    return reportHash(canonicalReport({ rendered: snapshot.rendered, basis: snapshot.basis }));
  }
  async save(rawId: string, input: unknown, actor: ReportActor) {
    const id = parseReport(reportId, rawId),
      body = parseReport(reportSaveRequest, input);
    const payloadHash = reportHash(canonicalReport({ id, ...body }));
    const read = async (manager: EntityManager, lock: boolean) => {
      const hint = await manager.findOne(PrivateReport, { where: { id } });
      if (!hint && body.data.mode === 'retain')
        throw new NotFoundException('먼저 보고서를 저장해 주세요.');
      const dashboardId =
        hint?.dashboardId ?? (body.data.mode === 'capture' ? body.data.capture.dashboardId : 0);
      const root = await this.root(manager, dashboardId, actor, lock);
      if (root.context.organizationId !== body.expectedOrganizationId)
        throw new ConflictException('현재 조직이 변경됐습니다.');
      const head = await manager.findOne(PrivateReport, { where: { id } });
      if (head) await this.allowed(manager, head, actor, false);
      if (body.data.mode === 'capture' && body.data.capture.dashboardId !== dashboardId)
        throw new ConflictException('보고서 원본은 변경할 수 없습니다.');
      const receipt = await manager.findOne(PrivateReportRequest, {
        where: {
          ownerId: actor.id,
          organizationKey: root.context.organizationId ?? 0,
          requestId: body.requestId,
        },
      });
      if (receipt && (receipt.payloadHash !== payloadHash || receipt.reportId !== id))
        throw new ConflictException('같은 요청 ID에 다른 내용을 저장할 수 없습니다.');
      return { root, head, receipt };
    };
    const prior = await sourceWriteTransaction(this.db, async manager => {
      const current = await read(manager, true);
      return current.receipt
        ? {
            report: await this.stored(manager, current.head, current.receipt.version),
            replayed: true,
          }
        : null;
    });
    if (prior) return prior;
    const persist = async (snapshot: PrivateReportSnapshot | null, manager: EntityManager) => {
      const { root, head, receipt } = await read(manager, false);
      if (receipt)
        return { report: await this.stored(manager, head, receipt.version), replayed: true };
      if ((head?.revision ?? null) !== body.expectedRevision)
        throw new ConflictException(
          '보고서가 변경됐습니다. 초안을 유지하고 최신 저장본을 확인해 주세요.',
        );
      if (body.data.mode === 'retain') {
        if (body.data.fromRevision !== head.revision)
          throw new ConflictException('본문 수정의 기준 보고서가 변경됐습니다.');
        snapshot = (await this.stored(manager, head)).snapshot;
      } else if (this.previewDigest(snapshot) !== body.data.previewDigest)
        throw new ConflictException('미리보기 기준이 변경됐습니다. 다시 미리보기 해 주세요.');
      const version = (head?.version ?? 0) + 1;
      const payload: ReportPayload = {
        reportId: id,
        version,
        title: body.title,
        body: body.body,
        savedAt: new Date().toISOString(),
        snapshot,
      };
      const encoded = encodeReport(payload);
      const retained = await manager
        .createQueryBuilder(PrivateReportRevision, 'revision')
        .select('COALESCE(SUM(revision.bytes), 0)', 'bytes')
        .where('revision.ownerId = :owner', { owner: actor.id })
        .getRawOne();
      if (Number(retained.bytes) + encoded.bytes > REPORT_OWNER_LIMIT)
        throw new PayloadTooLargeException('소유자별 보고서 보존 한도 20MiB를 초과했습니다.');
      const next: PrivateReport = {
        id,
        ownerId: actor.id,
        organizationKey: root.context.organizationId ?? 0,
        dashboardId: root.dashboard.id,
        sourceId: root.source.id,
        version,
        revision: encoded.hash,
        title: body.title,
        updatedAt: payload.savedAt,
      };
      if (head) {
        const updated = await manager.update(
          PrivateReport,
          { id, ownerId: actor.id, revision: body.expectedRevision },
          next,
        );
        if (updated.affected !== 1)
          throw new ConflictException('보고서가 변경됐습니다. 초안을 유지하고 다시 확인해 주세요.');
      } else {
        try {
          await manager.insert(PrivateReport, next);
        } catch (error) {
          if (
            error instanceof QueryFailedError &&
            ['ER_DUP_ENTRY', 'SQLITE_CONSTRAINT'].includes(error.driverError?.code)
          )
            throw new ConflictException(
              '보고서 ID가 이미 사용 중입니다. 새 보고서에서 다시 시도해 주세요.',
            );
          throw error;
        }
      }
      await manager.insert(PrivateReportRevision, {
        reportId: id,
        version,
        ownerId: actor.id,
        revision: encoded.hash,
        bytes: encoded.bytes,
        chunkCount: encoded.chunks.length,
      });
      for (const [ordinal, chunk] of encoded.chunks.entries())
        await manager.insert(PrivateReportChunk, {
          reportId: id,
          version,
          ordinal,
          payload: chunk,
        });
      await manager.insert(PrivateReportRequest, {
        ownerId: actor.id,
        organizationKey: next.organizationKey,
        requestId: body.requestId,
        reportId: id,
        payloadHash,
        version,
      });
      return { report: await this.stored(manager, next), replayed: false };
    };
    if (body.data.mode === 'capture')
      return this.studio.capturePrivateReport(
        body.data.capture,
        actor.id,
        async (manager, lock) => {
          await read(manager, lock);
        },
        persist,
      );
    return sourceWriteTransaction(this.db, async manager => {
      await read(manager, true);
      return persist(null, manager);
    });
  }
}
