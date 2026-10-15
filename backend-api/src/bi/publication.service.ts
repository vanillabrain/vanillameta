import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomUUID } from 'crypto';
import { EntityManager, Repository } from 'typeorm';
import { AiDashboardService } from '../ai/ai-dashboard.service';
import { responsiveLayouts } from '../ai/responsive-layout';
import { Dashboard } from '../dashboard/entities/dashboard.entity';
import { DashboardPublication } from '../dashboard/entities/dashboard-publication.entity';
import { dashboardRevision } from '../dashboard/dashboard-revision';
import { DashboardWidget } from '../dashboard/dashboard-widget/entities/dashboard-widget.entity';
import { serializedViewWrite } from '../dashboard/view-write-queue';
import { SourceAccessService } from '../ownership/source-access.service';
import { buildPublicationSnapshot } from './publication-snapshot';

export const PUBLICATION_TICKET_TTL_MS = 5 * 60 * 1000;
export const PUBLICATION_TICKET_LIMIT = 100;
export const PUBLICATION_TICKET_BYTES = 20 * 1024 * 1024;
export const PUBLICATION_MAX_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REVISION = /^[a-f0-9]{64}$/;
const SHAPE_MESSAGE = '게시 요청을 확인해 주세요.';
const RETRY_MESSAGE =
  '다른 게시 요청이 이미 처리되었습니다. 상태를 확인한 뒤 새 미리보기로 다시 시도해 주세요.';
const STALE_SAVE_MESSAGE =
  '저장 분석이 다른 화면에서 변경되었습니다. 새로고침 후 미리보기를 다시 실행해 주세요.';
const STALE_VERSION_MESSAGE = '게시 버전이 변경되었습니다. 상태를 확인한 뒤 다시 시도해 주세요.';
const TICKET_MESSAGE = '게시 미리보기가 만료되었습니다. 미리보기를 다시 실행해 주세요.';
const LAYOUT_RECOMPILE_MESSAGE =
  '게시할 블록 배치 정보를 확인할 수 없습니다. 저장 화면에서 배치를 다시 저장해 주세요.';

type PublicationTicket = {
  actorId: number;
  dashboardId: number;
  revision: string;
  snapshot: string;
  bytes: number;
  expiresAt: number;
};

/** Writes an unknown snapshot into memory with a 5 minute TTL, at most 100 tickets and 20MiB. */
export class PublicationTicketStore {
  private readonly tickets = new Map<string, PublicationTicket>();
  private bytes = 0;

  constructor(private readonly clock: () => number = () => Date.now()) {}

  private drop(id: string) {
    const ticket = this.tickets.get(id);
    if (!ticket) return;
    this.bytes -= ticket.bytes;
    this.tickets.delete(id);
  }

  private sweep() {
    const now = this.clock();
    for (const [id, ticket] of [...this.tickets]) if (ticket.expiresAt <= now) this.drop(id);
  }

  put(value: Omit<PublicationTicket, 'expiresAt'>): string {
    this.sweep();
    while (
      this.tickets.size &&
      (this.tickets.size >= PUBLICATION_TICKET_LIMIT ||
        this.bytes + value.bytes > PUBLICATION_TICKET_BYTES)
    )
      this.drop(this.tickets.keys().next().value);
    if (this.bytes + value.bytes > PUBLICATION_TICKET_BYTES)
      throw new ServiceUnavailableException(TICKET_MESSAGE);
    const id = randomUUID();
    this.tickets.set(id, { ...value, expiresAt: this.clock() + PUBLICATION_TICKET_TTL_MS });
    this.bytes += value.bytes;
    return id;
  }

  take(id: unknown): PublicationTicket | undefined {
    if (typeof id !== 'string' || !UUID.test(id)) return undefined;
    this.sweep();
    const ticket = this.tickets.get(id);
    if (!ticket) return undefined;
    this.drop(id);
    return ticket;
  }

  get size() {
    return this.tickets.size;
  }
}

@Injectable()
export class PublicationService {
  private readonly tickets = new PublicationTicketStore();

  constructor(
    @InjectRepository(DashboardPublication)
    private readonly publications: Repository<DashboardPublication>,
    @InjectRepository(Dashboard) private readonly dashboards: Repository<Dashboard>,
    private readonly access: SourceAccessService,
    private readonly ai: AiDashboardService,
  ) {}

  private expiry(value: unknown): string {
    if (typeof value !== 'string' || !value.length || value.length > 40)
      throw new BadRequestException('만료일을 확인해 주세요.');
    const time = Date.parse(value);
    if (!Number.isFinite(time) || new Date(time).toISOString() !== value)
      throw new BadRequestException('만료일을 확인해 주세요.');
    if (time <= Date.now()) throw new BadRequestException('만료일은 미래여야 합니다.');
    if (time > Date.now() + PUBLICATION_MAX_EXPIRY_MS)
      throw new BadRequestException('만료일은 최대 30일까지 지정할 수 있습니다.');
    return value;
  }

  private shape(body: any, keys: string[]) {
    if (
      !body ||
      typeof body !== 'object' ||
      Array.isArray(body) ||
      Object.keys(body).some(key => !keys.includes(key))
    )
      throw new BadRequestException(SHAPE_MESSAGE);
  }

  private publication(row: DashboardPublication | null) {
    return row
      ? {
          uuid: row.uuid,
          version: row.version,
          publishedAt: row.publishedAt,
          expiresAt: row.expiresAt,
          dashboardRevision: row.dashboardRevision,
          active: row.active === true,
        }
      : null;
  }

  private serializeState(dashboardId: number, revision: string, row: DashboardPublication | null) {
    return {
      dashboardId,
      revision,
      version: row?.version ?? 0,
      publication: this.publication(row),
    };
  }

  private expired(row: DashboardPublication, now = Date.now()) {
    const time = Date.parse(row.expiresAt);
    return !Number.isFinite(time) || time <= now;
  }

  private async dashboardRow(id: number, manager: EntityManager = this.dashboards.manager) {
    const row = await manager.findOne(Dashboard, { where: { id } });
    if (!row || row.delYn === 'Y') throw new NotFoundException('저장 분석을 찾을 수 없습니다.');
    return row;
  }

  async state(id: unknown, actor: number) {
    const dashboardId = this.access.id(id);
    await this.access.dashboard(dashboardId, actor);
    const row = await this.publications.findOne({ where: { dashboardId } });
    const dashboard = await this.dashboardRow(dashboardId);
    return this.serializeState(dashboardId, dashboardRevision(dashboard), row);
  }

  /** Owner preview: read-only capture of the saved analysis, its revision and its block layout. */
  async preview(id: unknown, actor: number, body: any) {
    this.shape(body, ['expectedRevision']);
    const dashboardId = this.access.id(id);
    await this.access.dashboard(dashboardId, actor);
    if (typeof body.expectedRevision !== 'string' || !REVISION.test(body.expectedRevision))
      throw new BadRequestException('저장 화면을 다시 불러온 뒤 미리보기를 실행해 주세요.');
    const before = await this.dashboardRow(dashboardId);
    if (dashboardRevision(before) !== body.expectedRevision)
      throw new ConflictException(STALE_SAVE_MESSAGE);
    const analysis = (await this.ai.analysis(dashboardId, actor, true)).data;
    const captured = (await this.ai.preview({ draft: analysis, includeTrends: true }, actor)).data;
    if (
      !Array.isArray(captured?.widgets) ||
      captured.widgets.some(widget => widget.contribution?.supported !== true)
    )
      throw new BadRequestException(
        '집계로 확인된 지표·분류 차트만 게시할 수 있습니다. 원본 행 조회는 게시하지 않습니다.',
      );
    // The capture must not race another save: ownership and revision are re-checked afterwards.
    await this.access.dashboard(dashboardId, actor);
    const after = await this.dashboardRow(dashboardId);
    if (dashboardRevision(after) !== body.expectedRevision)
      throw new ConflictException(STALE_SAVE_MESSAGE);
    const { snapshot, bytes } = buildPublicationSnapshot({
      title: analysis?.title ?? after.title,
      widgets: captured?.widgets,
      responsiveLayouts: await this.blockLayouts(dashboardId, analysis, after),
      capturedAt: new Date(),
    });
    if (this.publications.manager.connection.options.type === 'mysql' && bytes > 60 * 1024)
      throw new BadRequestException('이 서버의 게시 결과 한도는 60KiB입니다. 블록을 줄여 주세요.');
    const ticket = this.tickets.put({
      actorId: actor,
      dashboardId,
      revision: body.expectedRevision,
      snapshot: JSON.stringify(snapshot),
      bytes,
    });
    return { dashboardId, revision: body.expectedRevision, ticket, snapshot };
  }

  /** Stored responsive layouts win; legacy dashboards are rebuilt from the persisted grid. */
  private async blockLayouts(dashboardId: number, analysis: any, dashboard: Dashboard) {
    if (analysis?.responsiveLayouts) return analysis.responsiveLayouts;
    const mappings = await this.dashboards.manager.find(DashboardWidget, {
      where: { dashboardId },
      order: { id: 'ASC' },
    });
    let stored: any[];
    try {
      stored = dashboard.layout ? JSON.parse(dashboard.layout) : [];
    } catch {
      throw new BadRequestException(LAYOUT_RECOMPILE_MESSAGE);
    }
    const byWidget = new Map<string, any>(
      (Array.isArray(stored) ? stored : []).map((rect: any) => [String(rect?.i), rect]),
    );
    const desktop = (analysis?.widgets ?? []).map((widget: any, index: number) => {
      const rect = byWidget.get(String(mappings[index]?.widgetId));
      if (
        !widget?.blockId ||
        !rect ||
        ![rect.x, rect.y, rect.w, rect.h].every((value: unknown) => Number.isSafeInteger(value))
      )
        throw new BadRequestException(LAYOUT_RECOMPILE_MESSAGE);
      return { x: rect.x, y: rect.y, w: rect.w, h: rect.h };
    });
    return responsiveLayouts(
      (analysis?.widgets ?? []).map((widget: any) => widget.blockId),
      desktop,
    );
  }

  private digest(dashboardId: number, body: any, requestId: string, expiresAt: string): string {
    return createHash('sha256')
      .update(
        JSON.stringify([
          dashboardId,
          body.expectedRevision,
          body.expectedVersion,
          body.ticket,
          requestId,
          expiresAt,
          body.visibility,
        ]),
      )
      .digest('hex');
  }

  private replay(
    row: DashboardPublication | null,
    requestId: string,
    payloadDigest: string,
    expectedVersion: number,
  ) {
    if (!row || row.requestId !== requestId) return null;
    // A reused request id must carry the same payload, and never returns a newer version.
    if (
      !row.active ||
      this.expired(row) ||
      row.version !== expectedVersion + 1 ||
      row.payloadDigest !== payloadDigest
    )
      throw new ConflictException(RETRY_MESSAGE);
    return row;
  }

  async publish(id: unknown, actor: number, body: any) {
    this.shape(body, [
      'expectedRevision',
      'expectedVersion',
      'ticket',
      'requestId',
      'expiresAt',
      'visibility',
    ]);
    const dashboardId = this.access.id(id);
    await this.access.dashboard(dashboardId, actor);
    if (typeof body.expectedRevision !== 'string' || !REVISION.test(body.expectedRevision))
      throw new BadRequestException('저장 화면을 다시 불러온 뒤 다시 시도해 주세요.');
    if (!Number.isSafeInteger(body.expectedVersion) || body.expectedVersion < 0)
      throw new BadRequestException(SHAPE_MESSAGE);
    if (typeof body.ticket !== 'string' || !UUID.test(body.ticket))
      throw new BadRequestException(TICKET_MESSAGE);
    if (typeof body.requestId !== 'string' || !UUID.test(body.requestId))
      throw new BadRequestException(SHAPE_MESSAGE);
    if (body.visibility !== 'link') throw new BadRequestException(SHAPE_MESSAGE);
    const requestId = body.requestId.toLowerCase();
    const expiresAt = this.expiry(body.expiresAt);
    const payloadDigest = this.digest(dashboardId, { ...body, requestId }, requestId, expiresAt);
    // The last successful request is replayed before the ticket is resolved, so a lost response retry is safe.
    const replayed = this.replay(
      await this.publications.findOne({ where: { dashboardId } }),
      requestId,
      payloadDigest,
      body.expectedVersion,
    );
    if (replayed)
      return this.serializeState(
        dashboardId,
        dashboardRevision(await this.dashboardRow(dashboardId)),
        replayed,
      );
    const result = await serializedViewWrite(this.publications, () =>
      this.publications.manager.transaction(async manager => {
        await this.access.dashboard(dashboardId, actor);
        const current = await this.find(manager, dashboardId);
        const concurrent = this.replay(current, requestId, payloadDigest, body.expectedVersion);
        if (concurrent)
          return this.serializeState(
            dashboardId,
            dashboardRevision(await this.dashboardRow(dashboardId, manager)),
            concurrent,
          );
        const dashboard = await manager.findOne(Dashboard, {
          where: { id: dashboardId },
          ...(manager.connection.options.type === 'mysql'
            ? { lock: { mode: 'pessimistic_write' as const } }
            : {}),
        });
        if (!dashboard || dashboard.delYn === 'Y')
          throw new NotFoundException('저장 분석을 찾을 수 없습니다.');
        const revision = dashboardRevision(dashboard);
        if (revision !== body.expectedRevision) throw new ConflictException(STALE_SAVE_MESSAGE);
        if ((current?.version ?? 0) !== body.expectedVersion)
          throw new ConflictException(STALE_VERSION_MESSAGE);
        const ticket = this.tickets.take(body.ticket);
        if (
          !ticket ||
          ticket.actorId !== actor ||
          ticket.dashboardId !== dashboardId ||
          ticket.revision !== body.expectedRevision
        )
          throw new BadRequestException(TICKET_MESSAGE);
        // Conditional no-op update: a save that slips in between fails this CAS and rolls back.
        const guard = manager
          .createQueryBuilder()
          .update(Dashboard)
          .set({ title: dashboard.title, updatedAt: () => 'updatedAt' })
          .where('id = :id', { id: dashboardId });
        for (const field of [
          'title',
          'layout',
          'analysisDefinition',
          'structuredDefinition',
          'delYn',
        ]) {
          if ((dashboard as any)[field] === null || (dashboard as any)[field] === undefined)
            guard.andWhere(`${field} IS NULL`);
          else
            guard.andWhere(`${field} = :previous_${field}`, {
              [`previous_${field}`]: (dashboard as any)[field],
            });
        }
        if ((await guard.execute()).affected !== 1) throw new ConflictException(STALE_SAVE_MESSAGE);
        const version = (current?.version ?? 0) + 1;
        // An active link keeps its UUID; revoked or expired links are replaced by a fresh public link.
        const uuid =
          current && current.active && !this.expired(current) ? current.uuid : randomUUID();
        const publishedAt = new Date().toISOString();
        const values = {
          uuid,
          version,
          dashboardRevision: revision,
          snapshot: ticket.snapshot,
          publishedAt,
          expiresAt,
          active: true,
          requestId,
          payloadDigest,
        };
        if (current) {
          const update = await manager.update(
            DashboardPublication,
            { dashboardId, version: current.version },
            values,
          );
          if (update.affected !== 1) throw new ConflictException(STALE_VERSION_MESSAGE);
        } else {
          try {
            await manager.insert(DashboardPublication, { dashboardId, ...values });
          } catch (error) {
            if (isDuplicate(error)) throw new ConflictException(STALE_VERSION_MESSAGE);
            throw error;
          }
        }
        return this.serializeState(dashboardId, revision, {
          ...current,
          dashboardId,
          ...values,
        } as DashboardPublication);
      }),
    );
    return result;
  }

  private find(manager: EntityManager, dashboardId: number) {
    return manager.findOne(DashboardPublication, {
      where: { dashboardId },
      ...(manager.connection.options.type === 'mysql'
        ? { lock: { mode: 'pessimistic_write' as const } }
        : {}),
    });
  }

  /** Revoke keeps the snapshot; only a running version increments, and an inactive row is returned as is. */
  async revoke(id: unknown, actor: number, body: any) {
    this.shape(body, ['expectedVersion']);
    const dashboardId = this.access.id(id);
    await this.access.dashboard(dashboardId, actor);
    if (!Number.isSafeInteger(body.expectedVersion) || body.expectedVersion < 0)
      throw new BadRequestException('게시 버전을 확인해 주세요.');
    const expectedVersion = body.expectedVersion;
    return serializedViewWrite(this.publications, () =>
      this.publications.manager.transaction(async manager => {
        await this.access.dashboard(dashboardId, actor);
        const current = await this.find(manager, dashboardId);
        if (!current) throw new NotFoundException('게시 버전이 없습니다.');
        const dashboard = await manager.findOne(Dashboard, { where: { id: dashboardId } });
        const revision = dashboard ? dashboardRevision(dashboard) : current.dashboardRevision;
        if (current.version !== expectedVersion) throw new ConflictException(STALE_VERSION_MESSAGE);
        if (!current.active) return this.serializeState(dashboardId, revision, current);
        const update = await manager.update(
          DashboardPublication,
          { dashboardId, version: expectedVersion, active: true },
          { active: false, version: expectedVersion + 1 },
        );
        if (update.affected !== 1) throw new ConflictException(STALE_VERSION_MESSAGE);
        return this.serializeState(dashboardId, revision, {
          ...current,
          active: false,
          version: expectedVersion + 1,
        });
      }),
    );
  }

  /** Public read: no AI, no SQL, no source access and no token; only the stored snapshot. */
  async publicResult(uuid: unknown) {
    if (typeof uuid !== 'string' || !UUID.test(uuid))
      throw new NotFoundException('게시가 중지되었거나 만료된 링크입니다.');
    const row = await this.publications.findOne({ where: { uuid } });
    if (!row || !row.active || this.expired(row))
      throw new NotFoundException('게시가 중지되었거나 만료된 링크입니다.');
    const dashboard = await this.dashboards.findOne({ where: { id: row.dashboardId } });
    if (!dashboard || dashboard.delYn === 'Y')
      throw new NotFoundException('게시가 중지되었거나 만료된 링크입니다.');
    let snapshot: unknown;
    try {
      snapshot = JSON.parse(row.snapshot);
    } catch {
      throw new ServiceUnavailableException('게시 결과를 불러올 수 없습니다.');
    }
    return {
      version: row.version,
      publishedAt: row.publishedAt,
      expiresAt: row.expiresAt,
      visibility: 'link',
      dataMode: 'snapshot',
      snapshot,
    };
  }
}

function isDuplicate(error: unknown): boolean {
  const message = String((error as any)?.message ?? '');
  return /UNIQUE constraint|Duplicate entry|ER_DUP_ENTRY/i.test(message);
}
