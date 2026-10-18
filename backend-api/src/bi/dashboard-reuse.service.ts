import { rejectPivotRemix } from '../dashboard-studio/studio-pivot.service';
import { bindMetricBlockKeys } from '../ai/metric-analysis-links';
import { StudioState } from '../dashboard-studio/entities/studio-state.entity';
import { validateStudioDocument } from '../dashboard-studio/studio-document';
import { importStudio, studioDigest } from '../dashboard-studio/studio-legacy';
import { StudioDocumentV1, STUDIO_BREAKPOINTS } from '../dashboard-studio/studio-contract';
import {
  resolveConditionSemantics,
  latestConditionSemantics,
  assertLatestConditionSemantics,
} from './business-condition-context';
import { ConditionSemantics } from './business-condition-semantics';
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
import {
  StudioConditions,
  StudioDateRange,
  StudioFilter,
} from '../dashboard-studio/studio-contract';
import {
  validateStudioConditions,
  validateStudioFilters,
  validateStudioDateRange,
} from '../dashboard-studio/studio-document';
import { validateDraft } from '../ai/dashboard-draft';
import { responsiveLayouts } from '../ai/responsive-layout';
import { ConnectionService } from '../connection/connection.service';
import { Dashboard } from '../dashboard/entities/dashboard.entity';
import { dashboardRevision } from '../dashboard/dashboard-revision';
import { serializedViewWrite } from '../dashboard/view-write-queue';
import { metadataTransaction, serializeMetadataWork } from '../common/metadata-work';
import { Database } from '../database/entities/database.entity';
import { SourceAccessService } from '../ownership/source-access.service';
import { UserMapping } from '../user/entities/user-mapping.entity';
import { decryptConnectionConfig } from '../utils/crypto.util';
import { AnalysisCreationReceipt } from './analysis-creation-receipt.entity';
import { BiService } from './bi.service';
import { remapDashboard, reuseColumns, reuseScope, usesReuseSemantics } from './dashboard-remap';
import { shape } from './semantic-proposal';
import {
  declaredReuseCurrency,
  prepareStructuredReuse,
  persistStructuredReuse,
  StructuredReusePlan,
} from './structured-reuse';
import { assertReuseCurrency, trustedReuseCurrency } from './reuse-units';
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
  targetColumns?: Array<{ name: string; type: string }>;
  originalColumns?: Array<{ name: string; type: string }>;
  originalSemantics?: ConditionSemantics;
  draft: any;
  conditions?: StudioConditions;
  filters?: StudioFilter[];
  dateRange?: StudioDateRange;
  layouts: any[];
  structured?: StructuredReusePlan;
  studioLayouts?: StudioDocumentV1['layouts'];
  studioBlockIds?: string[];
  originalStudioDigest?: string;
  schemaVersion?: string;
  originalCurrency?: string;
  targetCurrency?: string;
  unitConfirmation?: string;
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
    const storedPivot = await this.db.manager.findOne(Dashboard, { where: { id: originalId } });
    if (
      storedPivot?.structuredDefinition &&
      JSON.parse(storedPivot.structuredDefinition).studioPivots?.length
    )
      throw rejectPivotRemix();
    const profile = await this.bi.profile(analysis.databaseId, actor);
    if (
      analysis.defaultConditions !== undefined &&
      validateStudioConditions(analysis.defaultConditions).sourceRevision !==
        (await this.connection.duckDBVersion(analysis.databaseId))
    )
      throw stale();
    if (!profile.supported)
      throw new BadRequestException('서버에 저장한 파일 분석만 복제할 수 있습니다.');
    await resolveConditionSemantics(
      this.db.manager,
      profile.sourceId,
      profile.columns,
      analysis.defaultConditions === undefined
        ? undefined
        : validateStudioConditions(analysis.defaultConditions).semantics,
    );
    const state = this.db.hasMetadata(StudioState)
      ? await this.db.manager.findOne(StudioState, { where: { dashboardId: originalId } })
      : undefined;
    const studioDocument =
      state?.legacyRevision === analysis.revision
        ? validateStudioDocument({
            ...JSON.parse(state.document).document,
            revision: analysis.revision,
          })
        : undefined;
    if (
      studioDocument &&
      (studioDocument.sourceId !== profile.sourceId ||
        studioDocument.dashboardId !== originalId ||
        studioDocument.blocks.length !== analysis.widgets.length ||
        studioDocument.blocks.some((block, i) => block.id !== analysis.widgets[i].blockId))
    )
      throw stale();
    return {
      originalId,
      originalSourceId: profile.sourceId,
      analysis,
      profile,
      studioDocument,
      reference: undefined as ReuseReference | undefined,
    };
  }
  private columns(analysis: any, profile: any) {
    const result = reuseColumns(analysis, profile);
    const names = [
      ...(analysis.defaultFilters ?? []).map(f => f.column),
      ...(analysis.defaultDateRange ? [analysis.defaultDateRange.column] : []),
    ];
    for (const name of names) {
      const value = profile.columns.find(c => c.name === name);
      if (!value) throw new BadRequestException(`기간·필터 열을 확인해 주세요: ${name}`);
      if (!result.some(c => c.name === name)) result.push(value);
    }
    return result;
  }
  async draft(id: unknown, actor: number, kind = 'owned') {
    const { originalId, analysis, profile } = await this.original(id, actor, kind);
    const columns = this.columns(analysis, profile);
    const source =
      kind === 'owned'
        ? await this.db.manager.findOne(Database, { where: { id: profile.sourceId } })
        : undefined;
    const stored =
      kind === 'owned'
        ? await this.db.manager.findOne(Dashboard, { where: { id: originalId } })
        : undefined;
    const declared = stored?.structuredDefinition
      ? declaredReuseCurrency(JSON.parse(stored.structuredDefinition), analysis)
      : undefined;
    const currency = (source ? trustedReuseCurrency(source) : undefined) ?? declared;
    return {
      ...(currency ? { currency } : {}),
      originalId: kind === 'owned' ? originalId : String(id),
      originalTitle: analysis.title,
      expectedRevision: analysis.revision,
      ...(kind === 'owned' ? { originalSourceId: profile.sourceId } : {}),
      title: `${analysis.title.slice(0, 296)} 복사본`,
      columns,
      blocks: analysis.widgets.map(widget => ({
        id: widget.blockId,
        title: widget.title,
        columns: this.columns({ ...analysis, widgets: [widget] }, profile).map(
          column => column.name,
        ),
      })),
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
    const required = ['expectedRevision', 'sourceId', 'sourceRevision', 'title', 'columnMap'];
    shape(body, [...required, 'blockIds', 'unitConfirmation'], required);
    if (!body.columnMap || typeof body.columnMap !== 'object' || Array.isArray(body.columnMap))
      throw new BadRequestException('열 연결을 확인해 주세요.');
    const origin = await this.original(id, actor, kind);
    const { originalId, originalSourceId, analysis, profile, reference } = origin;
    const studioDocument: StudioDocumentV1 | undefined =
      'studioDocument' in origin ? origin.studioDocument : undefined;
    if (body.expectedRevision !== analysis.revision) throw stale();
    // UC024: explicit selection only; preserve original order regardless of request order.
    if (Object.prototype.hasOwnProperty.call(body, 'blockIds')) {
      const ids = body.blockIds;
      if (
        !Array.isArray(ids) ||
        !ids.length ||
        ids.length > analysis.widgets.length ||
        new Set(ids).size !== ids.length ||
        ids.some(
          value => typeof value !== 'string' || !analysis.widgets.some(w => w.blockId === value),
        )
      )
        throw new BadRequestException('복제할 블록을 하나 이상 선택해 주세요.');
    }
    const selected = {
      ...analysis,
      widgets: analysis.widgets.filter(
        widget => !body.blockIds || body.blockIds.includes(widget.blockId),
      ),
      ...(analysis.layoutSizes
        ? {
            layoutSizes: analysis.layoutSizes.filter(
              (_size, index) =>
                !body.blockIds || body.blockIds.includes(analysis.widgets[index].blockId),
            ),
          }
        : {}),
    };
    const targetId = this.access.id(body.sourceId);
    await this.access.assert('database', targetId, actor);
    return this.connection.withDuckDBSnapshot(targetId, async () => {
      const target = await this.bi.profile(targetId, actor);
      if (!target.supported) throw new BadRequestException('서버 파일 소스를 선택해 주세요.');
      if (target.dataVersion !== body.sourceRevision) throw stale();
      const originSource =
        kind === 'owned'
          ? await this.db.manager.findOne(Database, { where: { id: profile.sourceId } })
          : undefined;
      const targetSource = await this.db.manager.findOne(Database, { where: { id: targetId } });
      const originalRow = await this.db.manager.findOne(Dashboard, { where: { id: originalId } });
      const snapshot =
        kind === 'owned' && originalRow?.structuredDefinition
          ? JSON.parse(originalRow.structuredDefinition)
          : undefined;
      const declaredCurrency = declaredReuseCurrency(snapshot, analysis);
      const originalCurrency =
        (originSource ? trustedReuseCurrency(originSource) : undefined) ?? declaredCurrency;
      const targetCurrency = trustedReuseCurrency(targetSource);
      assertReuseCurrency(originalCurrency, targetCurrency, body.unitConfirmation);
      assertReuseCurrency(declaredCurrency, targetCurrency, body.unitConfirmation);
      await this.currentSource(this.db.manager, targetId, actor, target.dataVersion);
      const originalScope = reuseScope(selected, profile);
      const targetMeaning = usesReuseSemantics(originalScope)
        ? await latestConditionSemantics(this.db.manager, targetId, target.columns)
        : undefined;
      const remapped = remapDashboard(selected, profile, target, body.columnMap, targetMeaning);
      const conditions = remapped.conditionDefinition
        ? {
            sourceRevision: await this.connection.duckDBVersion(targetId),
            definition: remapped.conditionDefinition,
            ...(remapped.conditionSemantics ? { semantics: remapped.conditionSemantics } : {}),
          }
        : undefined;
      const scope = {
        ...(conditions ? { conditions } : {}),
        ...(remapped.defaultFilters !== undefined ? { filters: remapped.defaultFilters } : {}),
        ...(remapped.defaultDateRange ? { dateRange: remapped.defaultDateRange } : {}),
      };
      const filters = remapped.defaultFilters ?? [];
      const structured = prepareStructuredReuse(
        snapshot,
        analysis,
        selected,
        remapped,
        profile,
        target,
        body.columnMap,
      );
      const draft = validateDraft({
        ...remapped,
        title: body.title,
        widgets: remapped.widgets.map(widget => ({ ...widget, blockId: `copy-${randomUUID()}` })),
      });
      // Candidate IDs are local to preview. Persistence assigns fresh IDs and reapplies geometry by order.
      const studioLayouts = studioDocument
        ? (Object.fromEntries(
            STUDIO_BREAKPOINTS.map(bp => [
              bp,
              studioDocument.layouts[bp].filter(g =>
                selected.widgets.some(w => w.blockId === g.id),
              ),
            ]),
          ) as StudioDocumentV1['layouts'])
        : undefined;
      const schemaVersion = studioLayouts
        ? studioDigest(
            (await this.connection.queryDuckDB(targetId, 'DESCRIBE uploaded_data')).datas,
          )
        : undefined;
      const layouts = selected.widgets.map(widget =>
        studioLayouts
          ? Object.fromEntries(
              [
                ['mobile', 'xs'],
                ['tablet', 'md'],
                ['desktop', 'lg'],
              ].map(([name, bp]) => {
                const rect = studioLayouts[bp].find(g => g.id === widget.blockId);
                return [
                  name,
                  { x: rect.x, y: rect.y, w: name === 'mobile' ? 4 : rect.w, h: rect.h },
                ];
              }),
            )
          : Object.fromEntries(
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
      const plan = {
        expiresAt: Date.now() + TTL,
        actor,
        reference,
        originalId,
        originalRevision: analysis.revision,
        originalSourceId: originalSourceId ?? profile.sourceId,
        ...(originalScope.conditionSemantics
          ? {
              originalSemantics: originalScope.conditionSemantics,
              originalColumns: profile.conditionSchema ?? profile.columns,
            }
          : {}),
        originalSourceRevision: profile.dataVersion,
        targetId,
        targetRevision: target.dataVersion,
        ...(conditions?.semantics
          ? { targetColumns: target.columns.map(({ name, type }) => ({ name, type })) }
          : {}),
        draft,
        ...scope,
        filters,
        structured,
        studioLayouts,
        studioBlockIds: selected.widgets.map(w => w.blockId),
        originalStudioDigest: studioDocument ? studioDigest(studioDocument) : undefined,
        schemaVersion,
        originalCurrency,
        targetCurrency,
        unitConfirmation: body.unitConfirmation,
        layouts,
      };
      let result: any;
      try {
        result = (await this.dashboards.preview({ draft, ...scope, includeTrends: true }, actor))
          .data;
      } catch (error) {
        await serializeMetadataWork(this.db, () => this.currentOriginal(this.db.manager, plan));
        throw error;
      }
      // A profile snapshot is not proof the persisted source pointer stayed unchanged.
      await this.currentSource(this.db.manager, targetId, actor, target.dataVersion);
      const current = await this.db.manager.findOne(Dashboard, { where: { id: originalId } });
      if (reference) await this.origins.current(reference, this.db.manager);
      else if (!current || dashboardRevision(current) !== analysis.revision) throw stale();
      if (
        kind === 'owned' &&
        (await this.currentStudioDigest(this.db.manager, originalId, analysis.revision)) !==
          (studioDocument ? studioDigest(studioDocument) : undefined)
      )
        throw stale();
      if (
        conditions &&
        conditions.sourceRevision !== (await this.connection.duckDBVersion(targetId))
      )
        throw stale();
      if (conditions?.semantics)
        await assertLatestConditionSemantics(
          this.db.manager,
          targetId,
          target.columns,
          conditions.semantics,
        );
      const ticket = this.put(plan);
      return {
        ticket,
        expiresAt: new Date(Date.now() + TTL).toISOString(),
        originalId: reference ? String(id) : originalId,
        sourceId: targetId,
        snapshot: {
          schemaVersion: 1,
          title: draft.title,
          capturedAt: new Date().toISOString(),
          ...(conditions ? { conditionsApplied: true as const } : {}),
          scope: `새 소스: ${target.name} · ${
            conditions || remapped.defaultFilters?.length || remapped.defaultDateRange
              ? '저장된 분석 범위 적용'
              : '전체 기간 · 필터 없음'
          } · UTC`,
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
    if (
      !source ||
      source.ownerId !== actor ||
      source.engine !== 'duckdb' ||
      source.catalogActive === false
    )
      throw stale();
    await this.access.assert('database', id, actor, 'read', manager);
    const config = JSON.parse(decryptConnectionConfig(source.connectionConfig));
    if (config.client !== 'duckdb' || typeof config.connection?.filename !== 'string')
      throw stale();
    const version = createHash('sha256').update(config.connection.filename).digest('hex');
    if (sourceRevision(source, version) !== revision) throw stale();
  }
  private async currentStudioDigest(manager: EntityManager, id: number, revision: string) {
    if (!this.db.hasMetadata(StudioState)) return undefined;
    const state = await manager.findOne(StudioState, {
      where: { dashboardId: id },
      ...(manager.queryRunner?.isTransactionActive && this.db.options.type !== 'sqlite'
        ? { lock: { mode: 'pessimistic_write' as const } }
        : {}),
    });
    if (state?.legacyRevision !== revision) return undefined;
    return studioDigest(
      validateStudioDocument({ ...JSON.parse(state.document).document, revision }),
    );
  }
  private async currentOriginal(manager: EntityManager, plan: Plan) {
    if (plan.conditions?.semantics)
      await assertLatestConditionSemantics(
        manager,
        plan.targetId,
        plan.targetColumns,
        plan.conditions.semantics,
      );
    if (plan.originalSemantics)
      await resolveConditionSemantics(
        manager,
        plan.originalSourceId,
        plan.originalColumns,
        plan.originalSemantics,
      );
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
    if (
      (await this.currentStudioDigest(manager, plan.originalId, plan.originalRevision)) !==
      plan.originalStudioDigest
    )
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
    const candidate = this.tickets.get(body.ticket);
    let preparation: Awaited<ReturnType<AiDashboardService['prepareSave']>> | undefined;
    const hasReceipt = await serializeMetadataWork(this.db, () =>
      this.db.manager.findOne(AnalysisCreationReceipt, { where: { actorId: actor, requestId } }),
    );
    if (
      !hasReceipt &&
      candidate?.actor === actor &&
      candidate.conditions?.semantics &&
      candidate.expiresAt > Date.now() &&
      (!candidate.requestId || candidate.requestId === requestId) &&
      (candidate.reference
        ? candidate.reference.key === originalId && candidate.reference.kind === kind
        : kind === 'owned' && candidate.originalId === originalId)
    ) {
      await serializeMetadataWork(this.db, () => this.currentOriginal(this.db.manager, candidate));
      try {
        preparation = await this.connection.withDuckDBSnapshot(candidate.targetId, async () => {
          const profile = await this.bi.profile(candidate.targetId, actor);
          if (profile.dataVersion !== candidate.targetRevision) throw stale();
          // No new full-source business-date scan may execute under the persistence transaction.
          await this.dashboards.assertConditionSemantics(
            candidate.targetId,
            profile.columns,
            candidate.conditions,
          );
          return this.dashboards.prepareSave(
            {
              draft: candidate.draft,
              conditions: candidate.conditions,
              ...(candidate.filters !== undefined ? { filters: candidate.filters } : {}),
              ...(candidate.dateRange ? { dateRange: candidate.dateRange } : {}),
            },
            actor,
            candidate.filters?.length || candidate.dateRange
              ? {
                  schemaVersion: 2,
                  kind: 'structured-bi-dashboard',
                  sourceId: candidate.targetId,
                  studioConditions: candidate.conditions,
                  ...(candidate.filters?.length ? { studioFilters: candidate.filters } : {}),
                  ...(candidate.dateRange ? { studioDateRange: candidate.dateRange } : {}),
                  items: candidate.draft.widgets.map(() => ({})),
                }
              : undefined,
            undefined,
            false,
            [],
            candidate.layouts,
          );
        });
      } catch (error) {
        await serializeMetadataWork(this.db, () =>
          this.currentOriginal(this.db.manager, candidate),
        );
        throw error;
      }
    }
    const run = () =>
      metadataTransaction(this.db, async manager => {
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
          const originalSource = await manager.findOne(Database, {
            where: { id: plan.originalSourceId },
          });
          const targetSource = await manager.findOne(Database, { where: { id: plan.targetId } });
          if (
            (!plan.reference &&
              trustedReuseCurrency(originalSource) !== undefined &&
              trustedReuseCurrency(originalSource) !== plan.originalCurrency) ||
            trustedReuseCurrency(targetSource) !== plan.targetCurrency
          )
            throw stale();
          assertReuseCurrency(plan.originalCurrency, plan.targetCurrency, plan.unitConfirmation);
          if (
            plan.conditions &&
            plan.conditions.sourceRevision !== (await this.connection.duckDBVersion(plan.targetId))
          )
            throw stale();
          const links = plan.structured
            ? await persistStructuredReuse(
                plan.structured,
                plan.targetId,
                profile.dataVersion,
                manager,
              )
            : null;
          const snapshot =
            links || plan.conditions || plan.filters?.length || plan.dateRange
              ? {
                  ...(links ?? {
                    schemaVersion: 2,
                    kind: 'structured-bi-dashboard',
                    sourceId: plan.targetId,
                    dataVersion: profile.dataVersion,
                    items: plan.draft.widgets.map(() => ({})),
                  }),
                  ...(plan.conditions ? { studioConditions: plan.conditions } : {}),
                  ...(plan.filters?.length ? { studioFilters: plan.filters } : {}),
                  ...(plan.dateRange ? { studioDateRange: plan.dateRange } : {}),
                }
              : null;
          const result = plan.conditions?.semantics
            ? await (async () => {
                if (!preparation || plan !== candidate) throw stale();
                const value = await preparation.persist(manager);
                if (snapshot) {
                  const row = await manager.findOne(Dashboard, { where: { id: value.id } });
                  row.structuredDefinition = JSON.stringify(
                    bindMetricBlockKeys(snapshot, value.draft),
                  );
                  await manager.update(Dashboard, row.id, {
                    structuredDefinition: row.structuredDefinition,
                  });
                  value.revision = dashboardRevision(row);
                }
                return value;
              })()
            : (
                await this.dashboards.save(
                  {
                    draft: plan.draft,
                    ...(plan.conditions ? { conditions: plan.conditions } : {}),
                    ...(plan.filters !== undefined ? { filters: plan.filters } : {}),
                    ...(plan.dateRange ? { dateRange: plan.dateRange } : {}),
                  },
                  actor,
                  snapshot ?? (plan.conditions ? undefined : null),
                  undefined,
                  manager,
                  false,
                  [],
                  plan.layouts,
                )
              ).data;
          if (plan.studioLayouts) {
            const document = importStudio(
              result.id,
              { ...result.draft, revision: result.revision },
              snapshot,
              plan.schemaVersion,
            );
            document.layouts = Object.fromEntries(
              STUDIO_BREAKPOINTS.map(bp => [
                bp,
                plan.studioLayouts[bp].map(g => ({
                  ...g,
                  id: document.blocks[plan.studioBlockIds.indexOf(g.id)].id,
                })),
              ]),
            ) as StudioDocumentV1['layouts'];
            validateStudioDocument(document);
            await manager.save(StudioState, {
              dashboardId: result.id,
              legacyRevision: result.revision,
              document: JSON.stringify({
                document,
                sourceRevision: await this.connection.duckDBVersion(plan.targetId),
              }),
            });
          }
          return result;
        });
        // A persistence adapter must never silently widen the captured scope.
        if (plan.conditions || plan.filters?.length || plan.dateRange) {
          const row = await manager.findOne(Dashboard, { where: { id: saved.id } });
          const stored = row?.structuredDefinition ? JSON.parse(row.structuredDefinition) : {};
          const persisted = [
            stored.studioConditions === undefined
              ? undefined
              : validateStudioConditions(stored.studioConditions),
            stored.studioFilters?.length ? validateStudioFilters(stored.studioFilters) : undefined,
            stored.studioDateRange === undefined
              ? undefined
              : validateStudioDateRange(stored.studioDateRange),
          ];
          if (
            JSON.stringify(persisted) !==
            JSON.stringify([
              plan.conditions,
              plan.filters?.length ? plan.filters : undefined,
              plan.dateRange,
            ])
          )
            throw new BadRequestException(
              '복사본의 적용 범위를 확인할 수 없어 저장하지 않았습니다.',
            );
        }
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
