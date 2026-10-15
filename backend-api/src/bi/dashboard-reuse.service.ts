import { SharedReuseOriginService, ReuseReference } from './shared-reuse-origin.service';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { DataSource, EntityManager } from 'typeorm';
import { AiDashboardService } from '../ai/ai-dashboard.service';
import { validateDraft } from '../ai/dashboard-draft';
import { responsiveLayouts } from '../ai/responsive-layout';
import { ConnectionService } from '../connection/connection.service';
import { Dashboard } from '../dashboard/entities/dashboard.entity';
import { dashboardRevision } from '../dashboard/dashboard-revision';
import { serializedViewWrite } from '../dashboard/view-write-queue';
import { Database } from '../database/entities/database.entity';
import { SourceAccessService } from '../ownership/source-access.service';
import { UserMapping } from '../user/entities/user-mapping.entity';
import { decryptConnectionConfig } from '../utils/crypto.util';
import { AnalysisCreationReceipt } from './analysis-creation-receipt.entity';
import { BiService } from './bi.service';
import { remapDashboard, reuseColumns } from './dashboard-remap';
import { shape } from './semantic-proposal';
import { sourceRevision } from './source-revision';

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const TTL = 5 * 60 * 1000;
type Plan = {
  actor: number;
  reference?: ReuseReference;
  originalId: number;
  originalRevision: string;
  originalSourceId: number;
  originalSourceRevision: string;
  targetId: number;
  targetRevision: string;
  draft: any;
  layouts: any[];
  expiresAt: number;
  requestId?: string;
};
const stale = () =>
  new ConflictException(
    '원본 또는 데이터 소스가 변경되었습니다. 현재 입력을 유지하고 다시 미리보기해 주세요.',
  );
@Injectable()
export class DashboardReuseService {
  private readonly tickets = new Map<string, Plan>();
  constructor(
    private readonly db: DataSource,
    private readonly bi: BiService,
    private readonly dashboards: AiDashboardService,
    private readonly connection: ConnectionService,
    private readonly access: SourceAccessService,
    private readonly origins?: SharedReuseOriginService,
  ) {}
  private async original(id: unknown, actor: number, kind = 'owned') {
    this.access.actor(actor);
    if (kind !== 'owned') return this.origins.resolve(kind, String(id));
    await this.access.assert('dashboard', id, actor);
    const originalId = this.access.id(id);
    const analysis = (await this.dashboards.analysis(originalId, actor, true)).data;
    const profile = await this.bi.profile(analysis.databaseId, actor);
    if (!profile.supported)
      throw new BadRequestException('서버에 저장한 파일 분석만 복제할 수 있습니다.');
    return { originalId, analysis, profile, reference: undefined as ReuseReference | undefined };
  }
  async draft(id: unknown, actor: number, kind = 'owned') {
    const { originalId, analysis, profile } = await this.original(id, actor, kind);
    const columns = reuseColumns(analysis, profile);
    return {
      originalId: kind === 'owned' ? originalId : String(id),
      originalTitle: analysis.title,
      expectedRevision: analysis.revision,
      ...(kind === 'owned' ? { originalSourceId: profile.sourceId } : {}),
      title: `${analysis.title.slice(0, 296)} 복사본`,
      columns,
      sources: (await this.bi.sources(actor)).filter(source => source.engine === 'duckdb'),
    };
  }
  private put(plan: Omit<Plan, 'expiresAt'>) {
    const now = Date.now();
    for (const [key, value] of this.tickets) if (value.expiresAt <= now) this.tickets.delete(key);
    if (Buffer.byteLength(JSON.stringify(plan)) > 128 * 1024)
      throw new BadRequestException('복제할 정의가 너무 큽니다.');
    while (this.tickets.size >= 100) this.tickets.delete(this.tickets.keys().next().value);
    const ticket = randomUUID();
    this.tickets.set(ticket, { ...plan, expiresAt: now + TTL });
    return ticket;
  }
  async preview(id: unknown, body: any, actor: number, kind = 'owned') {
    shape(body, ['expectedRevision', 'sourceId', 'sourceRevision', 'title', 'columnMap']);
    const { originalId, analysis, profile, reference } = await this.original(id, actor, kind);
    if (body.expectedRevision !== analysis.revision) throw stale();
    const targetId = this.access.id(body.sourceId);
    await this.access.assert('database', targetId, actor);
    return this.connection.withDuckDBSnapshot(targetId, async () => {
      const target = await this.bi.profile(targetId, actor);
      if (!target.supported) throw new BadRequestException('서버 파일 소스를 선택해 주세요.');
      if (target.dataVersion !== body.sourceRevision) throw stale();
      const remapped = remapDashboard(analysis, profile, target, body.columnMap);
      const draft = validateDraft({
        ...remapped,
        title: body.title,
        widgets: remapped.widgets.map(widget => ({ ...widget, blockId: `copy-${randomUUID()}` })),
      });
      // Candidate IDs are local to preview. Persistence assigns fresh IDs and reapplies geometry by order.
      const layouts = analysis.widgets.map(widget =>
        Object.fromEntries(
          ['mobile', 'tablet', 'desktop']
            .map(name => [name, analysis.responsiveLayouts?.[name]?.[widget.blockId]])
            .filter(([, rect]) => rect !== undefined),
        ),
      );
      if (layouts.some(value => !value.desktop))
        throw new BadRequestException(
          '원본 배치를 차트·배치 편집에서 저장한 뒤 다시 복제해 주세요.',
        );
      const responsive = responsiveLayouts(
        draft.widgets.map(widget => widget.blockId),
        layouts.map(value => value.desktop),
        undefined,
        layouts,
      );
      const result = (await this.dashboards.preview({ draft, includeTrends: true }, actor)).data;
      // A profile snapshot is not proof the persisted source pointer stayed unchanged.
      await this.currentSource(this.db.manager, targetId, actor, target.dataVersion);
      const current = await this.db.manager.findOne(Dashboard, { where: { id: originalId } });
      if (reference) await this.origins.current(reference, this.db.manager);
      else if (!current || dashboardRevision(current) !== analysis.revision) throw stale();
      const ticket = this.put({
        actor,
        reference,
        originalId,
        originalRevision: analysis.revision,
        originalSourceId: profile.sourceId,
        originalSourceRevision: profile.dataVersion,
        targetId,
        targetRevision: target.dataVersion,
        draft,
        layouts,
      });
      return {
        ticket,
        expiresAt: new Date(Date.now() + TTL).toISOString(),
        originalId: reference ? String(id) : originalId,
        sourceId: targetId,
        snapshot: {
          schemaVersion: 1,
          title: draft.title,
          capturedAt: new Date().toISOString(),
          scope: `새 소스: ${target.name} · 전체 기간 · 필터 없음 · UTC`,
          widgets: result.widgets.map((widget, index) => {
            const visible = reference
              ? Object.fromEntries(
                  [
                    'title',
                    'description',
                    'type',
                    'valueField',
                    'categoryField',
                    'decimalPlaces',
                    'numberNotation',
                    'prefix',
                    'suffix',
                    'fields',
                    'datas',
                  ]
                    .filter(key => widget[key] !== undefined)
                    .map(key => [key, widget[key]]),
                )
              : widget;
            if (reference && widget.trend)
              visible.trend = {
                column: widget.trend.column,
                grain: widget.trend.grain,
                points: widget.trend.points,
              };
            return { ...visible, blockId: draft.widgets[index].blockId };
          }),
          responsiveLayouts: responsive,
        },
      };
    });
  }
  private async currentSource(manager: EntityManager, id: number, actor: number, revision: string) {
    const source = await manager.findOne(Database, {
      where: { id },
      ...(manager.queryRunner?.isTransactionActive && this.db.options.type !== 'sqlite'
        ? { lock: { mode: 'pessimistic_write' as const } }
        : {}),
    });
    if (!source || source.ownerId !== actor || source.engine !== 'duckdb') throw stale();
    const config = JSON.parse(decryptConnectionConfig(source.connectionConfig));
    if (config.client !== 'duckdb' || typeof config.connection?.filename !== 'string')
      throw stale();
    const version = createHash('sha256').update(config.connection.filename).digest('hex');
    if (sourceRevision(source, version) !== revision) throw stale();
  }
  private async currentOriginal(manager: EntityManager, plan: Plan) {
    if (plan.reference) {
      await this.origins.current(plan.reference, manager);
      await this.currentSource(manager, plan.targetId, plan.actor, plan.targetRevision);
      return;
    }
    const row = await manager.findOne(Dashboard, {
      where: { id: plan.originalId },
      ...(manager.queryRunner?.isTransactionActive && this.db.options.type !== 'sqlite'
        ? { lock: { mode: 'pessimistic_write' as const } }
        : {}),
    });
    const owner = await manager.findOne(UserMapping, {
      where: { dashboardId: plan.originalId, userInfoId: plan.actor },
    });
    if (!row || row.delYn === 'Y' || !owner || dashboardRevision(row) !== plan.originalRevision)
      throw stale();
    await this.currentSource(
      manager,
      plan.originalSourceId,
      plan.actor,
      plan.originalSourceRevision,
    );
    await this.currentSource(manager, plan.targetId, plan.actor, plan.targetRevision);
  }
  async save(id: unknown, body: any, actor: number, kind = 'owned') {
    shape(body, ['ticket', 'requestId']);
    this.access.actor(actor);
    const originalId = kind === 'owned' ? this.access.id(id) : String(id);
    if (kind !== 'owned' && kind !== 'share' && kind !== 'publication')
      throw new BadRequestException('invalid reuse origin');
    if (
      typeof body.ticket !== 'string' ||
      !UUID.test(body.ticket) ||
      typeof body.requestId !== 'string' ||
      !UUID.test(body.requestId)
    )
      throw new BadRequestException('복사본 저장 요청을 확인해 주세요.');
    const requestId = body.requestId.toLowerCase();
    const digest = createHash('sha256')
      .update(
        JSON.stringify([
          'dashboard-reuse',
          ...(kind === 'owned' ? [] : [kind]),
          originalId,
          body.ticket,
        ]),
      )
      .digest('hex');
    const run = () =>
      this.db.transaction(async manager => {
        const receipt = await manager.findOne(AnalysisCreationReceipt, {
          where: { actorId: actor, requestId },
        });
        if (receipt) {
          if (receipt.payloadDigest !== digest)
            throw new ConflictException('같은 요청의 내용이 다릅니다.');
          const row =
            receipt.dashboardId &&
            (await manager.findOne(Dashboard, { where: { id: receipt.dashboardId } }));
          const owner =
            row &&
            (await manager.findOne(UserMapping, {
              where: { dashboardId: row.id, userInfoId: actor },
            }));
          if (!row || row.delYn === 'Y' || !owner)
            throw new NotFoundException('저장한 복사본을 사용할 수 없습니다.');
          return { id: row.id, replayed: true };
        }
        const plan = this.tickets.get(body.ticket);
        if (
          !plan ||
          plan.expiresAt <= Date.now() ||
          plan.actor !== actor ||
          (plan.reference
            ? plan.reference.key !== originalId || plan.reference.kind !== kind
            : kind !== 'owned' || plan.originalId !== originalId)
        )
          throw new BadRequestException(
            '미리보기가 만료되었습니다. 현재 입력으로 다시 미리보기해 주세요.',
          );
        if (plan.requestId && plan.requestId !== requestId)
          throw new ConflictException(
            '이미 저장을 요청한 미리보기입니다. 같은 저장 요청을 다시 확인해 주세요.',
          );
        plan.requestId = requestId;
        if (plan.draft.databaseId !== plan.targetId) throw stale();
        await this.currentOriginal(manager, plan);
        const record = await manager.save(AnalysisCreationReceipt, {
          actorId: actor,
          requestId,
          payloadDigest: digest,
          dashboardId: null,
        });
        const saved = await this.connection.withDuckDBSnapshot(plan.targetId, async () => {
          const profile = await this.bi.profile(plan.targetId, actor);
          if (profile.dataVersion !== plan.targetRevision) throw stale();
          return (
            await this.dashboards.save(
              { draft: plan.draft },
              actor,
              null,
              undefined,
              manager,
              false,
              [],
              plan.layouts,
            )
          ).data;
        });
        await this.currentOriginal(manager, plan);
        await manager.update(AnalysisCreationReceipt, { id: record.id }, { dashboardId: saved.id });
        return { id: saved.id, replayed: false };
      });
    return serializedViewWrite(this.db.getRepository(Dashboard), async () => {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          return await run();
        } catch (failure) {
          const code = String(failure?.code ?? failure?.driverError?.code);
          if (
            !/SQLITE_BUSY|SQLITE_LOCKED|SQLITE_CONSTRAINT|ER_DUP_ENTRY|ER_LOCK_DEADLOCK|ER_LOCK_WAIT_TIMEOUT/.test(
              code,
            )
          )
            throw failure;
          if (attempt === 2)
            throw new ServiceUnavailableException(
              '저장이 경합 중입니다. 같은 요청 ID로 다시 확인해 주세요.',
            );
          await new Promise(resolve => setTimeout(resolve, 25 * (attempt + 1)));
        }
      }
    });
  }
}
