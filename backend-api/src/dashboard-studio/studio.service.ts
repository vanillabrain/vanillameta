import { resolveBusinessBasis } from '../bi/semantic-business-basis';
import {
  latestConditionSemantics,
  resolveConditionSemantics,
  assertLatestConditionSemantics,
} from '../bi/business-condition-context';
import type { ConditionSemantics } from '../bi/business-condition-semantics';
import { lockMetricReferences, lockMetricSources } from '../metric/metric-write-lock';
import { lockDashboardWrite } from '../dashboard/dashboard-write-lock';
import { sourceConditionProfile } from '../bi/source-condition-profile';
import { conditionColumns } from '../bi/source-condition-definition';
import { serializeMetadataWork, metadataTransaction } from '../common/metadata-work';
import { canonicalMetricSql, captureRemixTemplate } from './studio-remix-template';
import { compileContribution } from '../ai/dashboard-contribution';
import { createHash } from 'crypto';
import {
  BadRequestException,
  ServiceUnavailableException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { AiDashboardService } from '../ai/ai-dashboard.service';
import { ConnectionService } from '../connection/connection.service';
import { SourceAccessService } from '../ownership/source-access.service';
import { ResourceAction } from '../enterprise/resource-policy.service';
import { Dashboard } from '../dashboard/entities/dashboard.entity';
import { DashboardWidget } from '../dashboard/dashboard-widget/entities/dashboard-widget.entity';
import { Database } from '../database/entities/database.entity';
import { UserMapping } from '../user/entities/user-mapping.entity';
import { Metric } from '../metric/entities/metric.entity';
import { dashboardRevision } from '../dashboard/dashboard-revision';
import { metricLinkItems } from '../ai/metric-analysis-links';
import { isTemporaryStudioId, STUDIO_BREAKPOINTS, StudioDocumentV1 } from './studio-contract';
import { studioKeys, validateStudioDocument, validateStudioConditions } from './studio-document';
import { importStudio, studioDefinitions, studioDigest } from './studio-legacy';
import { StudioState } from './entities/studio-state.entity';
import { StudioRun } from './entities/studio-run.entity';
import { buildStudioEvidence } from './studio-evidence';
@Injectable()
export class StudioService {
  private queued = 0;
  private tail: Promise<unknown> = Promise.resolve();
  constructor(
    private readonly db: DataSource,
    private readonly ai: AiDashboardService,
    private readonly connection: ConnectionService,
    private readonly access: SourceAccessService,
  ) {}
  /**
   * UC-051: the legacy owner mapping stays the default, and an explicit action is delegated to the
   * shared policy. Linked sources remain a separate read dependency of that action.
   */
  private async owner(
    id: number,
    actor: number,
    action: ResourceAction | 'owner' = 'owner',
    manager = this.db.manager,
  ) {
    const row = await manager.findOne(Dashboard, { where: { id } });
    if (!row || row.delYn === 'Y')
      throw new ForbiddenException('대시보드 소유자만 편집할 수 있습니다.');
    await this.access.dashboard(id, actor, action, manager);
    return row;
  }
  /** Dashboard read/edit/publish never needs source edit rights, only a separate source read. */
  private async source(
    id: number,
    actor: number,
    action: ResourceAction | 'owner' = 'read',
    manager = this.db.manager,
  ) {
    await this.access.assert('database', id, actor, action, manager);
  }
  private async load(
    id: number,
    actor: number,
    action: ResourceAction | 'owner' = 'owner',
    manager = this.db.manager,
  ) {
    const row = await this.owner(id, actor, action, manager);
    const analysis = (await this.ai.analysis(id, actor, true, action)).data;
    analysis.title = row.title;
    await this.source(analysis.databaseId, actor, 'read', manager);
    if (!(await this.connection.isDuckDB(analysis.databaseId)))
      throw new BadRequestException('Studio는 서버 DuckDB 분석을 지원합니다.');
    const schema = (
      await this.connection.queryDuckDB(analysis.databaseId, 'DESCRIBE uploaded_data')
    ).datas;
    const schemaVersion = studioDigest(schema);
    const snapshot = row.structuredDefinition ? JSON.parse(row.structuredDefinition) : null;
    const profile = { columns: schema.map(c => ({ name: c.column_name, type: c.column_type })) };
    await resolveBusinessBasis(
      manager,
      analysis.databaseId,
      profile,
      analysis.businessBasis,
      profile.columns.map(c => c.name),
    );
    const items = metricLinkItems(snapshot, analysis);
    // The legacy single-block form explicitly describes index 0 only. Newly attached legacy
    // widgets have no canonical link; record that fact rather than guessing a metric for them.
    if (snapshot?.schemaVersion === 1 && snapshot.kind === 'structured-bi' && items.length === 1)
      while (items.length < analysis.widgets.length)
        items.push({ kind: 'studio-unlinked-legacy', sourceId: analysis.databaseId });
    if (snapshot && items.length !== analysis.widgets.length)
      throw new ConflictException(
        '지표 연결 정보를 다시 불러와 주세요. 기존 편집 화면에서 연결을 확인해 주세요.',
      );
    const sourceRevision = await this.connection.duckDBVersion(analysis.databaseId);
    const source = await manager.findOne(Database, { where: { id: analysis.databaseId } });
    const dataVersion = createHash('sha256')
      .update(JSON.stringify([source.id, source.createdAt, source.updatedAt, sourceRevision]))
      .digest('hex');
    const saved = await manager.findOne(StudioState, { where: { dashboardId: id } });
    const revision = dashboardRevision(row);
    if (analysis.revision !== revision)
      throw new ConflictException('분석이 변경되었습니다. 다시 불러와 주세요.');
    const document =
      saved?.legacyRevision === revision
        ? validateStudioDocument({ ...JSON.parse(saved.document).document, revision })
        : importStudio(id, analysis, snapshot, schemaVersion);
    if (document.blocks.length !== analysis.widgets.length)
      throw new ConflictException('블록 연결 정보를 다시 불러와 주세요.');
    return {
      row,
      analysis,
      snapshot,
      schema,
      schemaVersion,
      sourceRevision,
      dataVersion,
      document,
      items,
      definitions: studioDefinitions(document, analysis, snapshot),
    };
  }
  /** Internal, read-authorized semantic recipe. Never return this template from a read endpoint. */
  async captureRemix(id: number, actor: number, manager = this.db.manager) {
    const state = await this.load(id, actor, 'read', manager);
    const template = captureRemixTemplate(
      state.document,
      state.items,
      state.schema,
      state.analysis.widgets,
    );
    return {
      template,
      fingerprint: studioDigest([
        state.row.assetVersion ?? 0,
        state.document.revision,
        state.schemaVersion,
        state.sourceRevision,
        template,
      ]),
    };
  }
  /** Read-only handoff of one saved canonical block. URL references never grant source access. */
  async exploreHandoff(id: number, query: any, actor: number) {
    try {
      studioKeys(query, ['blockId', 'expectedRevision', 'expectedSourceRevision']);
      if (
        typeof query.blockId !== 'string' ||
        query.blockId.length > 128 ||
        typeof query.expectedRevision !== 'string' ||
        !/^[a-f0-9]{64}$/.test(query.expectedRevision) ||
        typeof query.expectedSourceRevision !== 'string' ||
        !/^[a-f0-9]{64}$/.test(query.expectedSourceRevision)
      )
        throw new Error();
    } catch {
      throw new BadRequestException('탐색으로 넘길 저장 기준을 확인해 주세요.');
    }
    await this.access.dashboard(id, actor);
    const analysis = (await this.ai.analysis(id, actor, true)).data;
    return this.connection.withDuckDBSnapshot(analysis.databaseId, async () => {
      const current = await this.load(id, actor);
      if (
        current.document.revision !== query.expectedRevision ||
        current.sourceRevision !== query.expectedSourceRevision
      )
        throw new ConflictException(
          '보고서나 데이터가 변경되었습니다. Studio에서 다시 조회해 주세요.',
        );
      const index = current.document.blocks.findIndex(block => block.id === query.blockId);
      const block = current.document.blocks[index],
        item = current.items[index];
      const definition = item?.definition;
      const unsupported = () =>
        new BadRequestException(
          '이 블록은 같은 조건 탐색을 지원하지 않습니다. 원본 Studio를 유지했습니다.',
        );
      if (
        !block ||
        block.kind === 'CHART_LINE' ||
        block.measureRefs.length !== 1 ||
        block.dimensionRefs.length > 1 ||
        !definition ||
        definition.sourceId !== current.document.sourceId ||
        item.metricId !== block.measureRefs[0].id ||
        String(definition.definitionVersion) !== block.measureRefs[0].definitionVersion ||
        current.document.dateRange?.precision === 'timestamp'
      )
        throw unsupported();
      const profile = {
        sourceId: current.document.sourceId,
        columns: current.schema.map(c => ({
          name: c.column_name,
          type: c.column_type,
          numeric: /^(U?BIGINT|U?INTEGER|U?SMALLINT|U?TINYINT|HUGEINT|FLOAT|DOUBLE|DECIMAL)/i.test(
            c.column_type,
          ),
          temporal: /^(DATE|TIMESTAMP)/i.test(c.column_type),
        })),
      };
      if (
        current.analysis.widgets[index].sql !==
        canonicalMetricSql(definition, block.kind, item.dimension, profile)
      )
        throw unsupported();
      const metric = await this.db.manager.findOne(Metric, {
        where: { id: item.metricId, databaseId: current.document.sourceId, useYn: 'Y' },
      });
      if (!metric || studioDigest(JSON.parse(metric.definition)) !== studioDigest(definition))
        throw new ConflictException('지표 정의가 변경되었습니다. Studio에서 다시 확인해 주세요.');
      return {
        dashboardId: id,
        blockId: block.id,
        dashboardTitle: current.document.title,
        blockTitle: block.title,
        revision: current.document.revision,
        sourceId: current.document.sourceId,
        sourceRevision: current.sourceRevision,
        measureGuards: [
          {
            id: item.metricId,
            definitionVersion: String(definition.definitionVersion),
            digest: studioDigest(definition),
          },
        ],
        state: {
          version: 1,
          mode: 'explore',
          measureIds: [item.metricId],
          rankingMeasureId: item.metricId,
          dimensionColumns: block.dimensionRefs.map(ref => ref.key),
          leaderboardSort: { by: 'value', direction: 'desc' },
          filters: current.document.filters ?? [],
          dateRange: current.document.dateRange ?? null,
          relativePeriod: null,
          trendGrain: 'day',
          comparePrevious: false,
          includeRows: false,
        },
      };
    });
  }
  async get(id: number, actor: number) {
    const context = await serializeMetadataWork(this.db, async () => {
      const capabilities = await this.access.dashboardCapabilities(id, actor);
      const owned = Boolean(
        await this.db.manager.findOne(UserMapping, {
          where: { dashboardId: id, userInfoId: actor },
        }),
      );
      const analysis = (await this.ai.analysis(id, actor, true)).data;
      return { capabilities, owned, analysis };
    });
    const pin = await this.connection.captureDuckDBSnapshot(context.analysis.databaseId);
    const result = await pin.run(() => this.getPinned(id, actor, context.analysis.databaseId));
    return { ...result, access: context.capabilities, owned: context.owned };
  }
  private async getPinned(id: number, actor: number, sourceId: number) {
    const state = await serializeMetadataWork(this.db, () => this.load(id, actor, 'read'));
    if (state.document.sourceId !== sourceId)
      throw new ConflictException('데이터 소스가 변경되었습니다. 다시 불러와 주세요.');
    let preview = null,
      previewError: string | undefined;
    try {
      preview = (
        await this.ai.preview(
          {
            draft: state.analysis,
            filters: state.document.filters ?? [],
            ...(state.document.conditions ? { conditions: state.document.conditions } : {}),
            ...(state.document.dateRange ? { dateRange: state.document.dateRange } : {}),
            includeTrends: true,
          },
          actor,
          'read',
        )
      ).data;
      preview.evidence = buildStudioEvidence({
        document: state.document,
        sourceRevision: state.sourceRevision,
        schemaVersion: state.schemaVersion,
        dataVersion: state.dataVersion,
        definitionBlocks: state.document.blocks,
        calculationItems: state.items,
        schema: state.schema,
        preview,
      });
    } catch {
      previewError =
        '데이터를 불러오지 못했습니다. 편집 내용은 유지됩니다. 잠시 후 다시 조회해 주세요.';
    }
    const freshPin = await this.connection.captureDuckDBSnapshot(sourceId);
    await freshPin.run(() =>
      serializeMetadataWork(this.db, async () => {
        const fresh = await this.load(id, actor, 'read');
        if (
          fresh.document.revision !== state.document.revision ||
          fresh.sourceRevision !== state.sourceRevision
        )
          throw new ConflictException(
            '조회 중 분석이나 원본이 변경됐습니다. 초안을 유지하고 다시 조회해 주세요.',
          );
      }),
    );
    let profileColumns: ReturnType<typeof conditionColumns> = [];
    try {
      if (state.schema.length <= 128)
        profileColumns = conditionColumns(
          state.schema.map(c => ({ name: c.column_name, type: c.column_type })),
          state.document.conditions?.semantics,
        );
    } catch {
      previewError =
        '조건의 업무 의미가 현재 원본 열과 다릅니다. 초안을 유지하고 조건을 다시 검토하거나 명시 제거해 주세요.';
    }
    return {
      document: state.document,
      sourceRevision: state.sourceRevision,
      definitions: state.definitions,
      profileColumns,
      preview,
      ...(previewError ? { previewError } : {}),
    };
  }
  private async validateCurrentReferences(
    block: StudioDocumentV1['blocks'][number],
    sourceId: number,
    schemaVersion: string,
    schema: any[],
    manager = this.db.manager,
  ) {
    const basisProfile = {
      columns: schema.map(c => ({ name: c.column_name, type: c.column_type })),
    };
    const usedBasisColumns: string[] = [
      ...block.dimensionRefs.map(ref => ref.key),
      ...(block.defaultDateColumn ? [block.defaultDateColumn] : []),
    ];
    for (const ref of block.measureRefs) {
      const metric = await manager.findOne(Metric, {
        where: { id: ref.id, databaseId: sourceId, useYn: 'Y' },
      });
      let definition: any;
      try {
        definition = metric && JSON.parse(metric.definition);
      } catch {}
      if (
        !definition ||
        definition.schemaVersion !== 1 ||
        definition.sourceId !== sourceId ||
        String(definition.definitionVersion) !== ref.definitionVersion
      )
        throw new ConflictException('지표 정의가 변경되었습니다. 최신 지표를 다시 확인해 주세요.');
      usedBasisColumns.push(
        ...[
          definition.aggregation === 'COUNT' ? undefined : definition.column,
          definition.denominatorColumn,
          definition.weightColumn,
        ].filter(Boolean),
      );
      await resolveBusinessBasis(
        manager,
        sourceId,
        { columns: schema.map(c => ({ name: c.column_name, type: c.column_type })) },
        definition.businessBasis,
        [
          definition.aggregation === 'COUNT' ? undefined : definition.column,
          definition.denominatorColumn,
          definition.weightColumn,
        ].filter(Boolean),
      );
    }
    await resolveBusinessBasis(
      manager,
      sourceId,
      basisProfile,
      block.businessBasis,
      usedBasisColumns,
    );
    for (const ref of block.dimensionRefs) {
      await resolveBusinessBasis(
        manager,
        sourceId,
        { columns: schema.map(c => ({ name: c.column_name, type: c.column_type })) },
        ref.businessBasis,
        [ref.key],
      );
      if (ref.schemaVersion !== schemaVersion || !schema.some(c => c.column_name === ref.key))
        throw new ConflictException('소스 열 구성이 변경되었습니다. 다시 불러와 주세요.');
    }
  }
  /** Unsaved document preview under the current explicit edit grant. References come from the server catalog. */
  async prepare(id: number, body: any, actor: number) {
    const analysis = await serializeMetadataWork(this.db, async () => {
      await this.access.dashboard(id, actor, 'edit');
      return (await this.ai.analysis(id, actor, true)).data;
    });
    const pin = await this.connection.captureDuckDBSnapshot(analysis.databaseId);
    return pin.run(async () => {
      const captured = await serializeMetadataWork(this.db, async () => {
        const current = await this.load(id, actor, 'edit');
        if (
          studioDigest(body.document?.businessBasis ?? null) !==
          studioDigest(current.document.businessBasis ?? null)
        )
          throw new BadRequestException('저장된 업무 기준은 편집 문서에서 바꿀 수 없습니다.');
        if (
          current.document.revision !== body.expectedRevision ||
          current.sourceRevision !== body.expectedSourceRevision
        )
          throw new ConflictException(
            '기준 데이터가 변경되었습니다. 내 편집을 보존한 채 최신 내용을 확인해 주세요.',
          );
        let document: StudioDocumentV1;
        try {
          document = validateStudioDocument(body.document);
        } catch {
          throw new BadRequestException('블록과 공통 필터를 확인해 주세요.');
        }
        if (
          document.dashboardId !== id ||
          document.sourceId !== current.document.sourceId ||
          !document.blocks.length ||
          (document.revision && document.revision !== body.expectedRevision)
        )
          throw new BadRequestException('요청의 대시보드와 소스를 확인해 주세요.');
        if (document.conditions && document.conditions.sourceRevision !== current.sourceRevision)
          throw new ConflictException(
            '조건의 데이터 파일이 변경됐습니다. 조건을 다시 적용하거나 명시 제거해 주세요.',
          );
        if (
          current.document.conditions?.semantics &&
          document.conditions &&
          !document.conditions.semantics
        )
          throw new BadRequestException(
            '기존 조건의 업무 의미를 유지하거나 전체 조건을 명시 제거해 주세요.',
          );
        const widgets = await Promise.all(
          document.blocks.map(async block => {
            const original =
              current.document.blocks.find(b => b.id === block.id) ??
              (isTemporaryStudioId(block.id)
                ? current.document.blocks.find(b => b.definitionKey === block.definitionKey)
                : undefined);
            if (
              !original ||
              original.kind !== block.kind ||
              original.definitionKey !== block.definitionKey ||
              studioDigest(original.measureRefs) !== studioDigest(block.measureRefs) ||
              studioDigest(original.dimensionRefs) !== studioDigest(block.dimensionRefs) ||
              studioDigest(original.businessBasis ?? null) !==
                studioDigest(block.businessBasis ?? null) ||
              original.defaultDateColumn !== block.defaultDateColumn
            )
              throw new BadRequestException('기존 계산과 지표 연결을 유지해 주세요.');
            await this.validateCurrentReferences(
              block,
              document.sourceId,
              current.schemaVersion,
              current.schema,
            );
            const template = current.definitions.entries[block.definitionKey].widget;
            return {
              ...template,
              ...block.display,
              blockId: isTemporaryStudioId(block.id) ? undefined : block.id,
              title: block.title,
              description: block.description,
            };
          }),
        );
        const draft = {
          databaseId: document.sourceId,
          ...(current.analysis.businessBasis
            ? { businessBasis: current.analysis.businessBasis }
            : {}),
          title: document.title,
          explanation: current.analysis.explanation,
          widgets,
        };

        const columns = current.schema.map(c => ({ name: c.column_name, type: c.column_type }));
        const conditionSemantics = document.conditions
          ? await resolveConditionSemantics(
              this.db.manager,
              document.sourceId,
              columns,
              document.conditions.semantics,
            )
          : await latestConditionSemantics(this.db.manager, document.sourceId, columns);
        return { current, document, draft, columns, conditionSemantics };
      });
      const { current, document, draft, columns, conditionSemantics } = captured;
      // Full business-date validation and all aggregate SQL run outside the SQLite metadata lease.
      const preview = (
        await this.ai.preview(
          {
            draft,
            filters: document.filters ?? [],
            ...(document.conditions ? { conditions: document.conditions } : {}),
            ...(document.dateRange ? { dateRange: document.dateRange } : {}),
            includeTrends: true,
          },
          actor,
          'edit',
        )
      ).data;
      preview.widgets.forEach((widget, i) => {
        if (
          document.blocks[i].display.timeGrain &&
          document.blocks[i].display.timeGrain !== 'auto' &&
          widget.grainUnavailable
        )
          throw new BadRequestException(
            '이 차트는 요청한 시간 단위로 안전하게 집계할 수 없습니다. 기존 내용을 유지했습니다.',
          );
      });
      preview.evidence = buildStudioEvidence({
        document,
        sourceRevision: current.sourceRevision,
        schemaVersion: current.schemaVersion,
        dataVersion: current.dataVersion,
        definitionBlocks: current.document.blocks,
        calculationItems: current.items,
        schema: current.schema,
        preview,
      });
      const latest = await this.connection.captureDuckDBSnapshot(document.sourceId);
      await latest.run(() =>
        serializeMetadataWork(this.db, async () => {
          const fresh = await this.load(id, actor, 'edit');
          if (
            fresh.document.revision !== current.document.revision ||
            fresh.sourceRevision !== current.sourceRevision ||
            studioDigest(fresh.definitions) !== studioDigest(current.definitions)
          )
            throw new ConflictException(
              '검토 중 분석이나 원본이 변경됐습니다. 초안과 질문을 유지하고 다시 검토해 주세요.',
            );
          if (!document.conditions)
            await assertLatestConditionSemantics(
              this.db.manager,
              document.sourceId,
              columns,
              conditionSemantics,
            );
        }),
      );
      return {
        document,
        preview,
        conditionColumns: conditionColumns(columns, conditionSemantics),
        ...(conditionSemantics ? { conditionSemantics } : {}),
        conditionSemanticsLatest: !document.conditions,
        conditionSourceRevision: current.sourceRevision,
      };
    });
  }
  /** AI creates a wrapper from this server-selected context, never from model-provided metadata. */
  async validateConditionProposalContext(
    prepared: {
      document: StudioDocumentV1;
      conditionSemantics?: ConditionSemantics;
      conditionSemanticsLatest?: boolean;
      conditionSourceRevision?: string;
      conditionColumns: Array<{ name: string; type: string }>;
    },
    actor: number,
  ) {
    if (!prepared.conditionSemantics) return;
    const sourceId = prepared.document.sourceId;
    const currentAccess = async () => {
      await this.access.dashboard(prepared.document.dashboardId, actor, 'edit');
      await this.source(sourceId, actor, 'read');
    };
    await currentAccess();
    const pin = await this.connection.captureDuckDBSnapshot(sourceId);
    let failure: unknown;
    try {
      await pin.run(async () => {
        if (
          prepared.conditionSourceRevision &&
          prepared.conditionSourceRevision !== (await this.connection.duckDBVersion(sourceId))
        )
          throw new ConflictException(
            '업무 조건의 파일이 변경됐습니다. 질문과 초안을 유지하고 다시 검토해 주세요.',
          );
        await this.ai.assertConditionSemantics(sourceId, prepared.conditionColumns, {
          sourceRevision: await this.connection.duckDBVersion(sourceId),
          definition: { include: null, exclude: null },
          semantics: prepared.conditionSemantics,
        });
        if (prepared.conditionSemanticsLatest)
          await serializeMetadataWork(this.db, () =>
            assertLatestConditionSemantics(
              this.db.manager,
              sourceId,
              prepared.conditionColumns,
              prepared.conditionSemantics,
            ),
          );
      });
    } catch (error) {
      failure = error;
    }
    // Invalid-date counts are also data: denial/fresh-file conflict must precede their response.
    await currentAccess();
    const fresh = await this.connection.captureDuckDBSnapshot(sourceId);
    if (
      prepared.conditionSourceRevision &&
      (await fresh.run(() => this.connection.duckDBVersion(sourceId))) !==
        prepared.conditionSourceRevision
    )
      throw new ConflictException(
        '업무 조건 검증 중 원본 파일이 변경됐습니다. 질문을 유지해 주세요.',
      );
    if (failure) throw failure;
  }
  /** UC052: read-only profile captures metadata, releases the lease for SQL, then checks fresh authority/file. */
  async profile(id: number, body: any, actor: number) {
    studioKeys(body, ['expectedRevision', 'expectedSourceRevision', 'document', 'columns']);
    const captured = await serializeMetadataWork(this.db, async () => {
      await this.access.dashboard(id, actor, 'read');
      const analysis = (await this.ai.analysis(id, actor, true, 'read')).data;
      await this.source(analysis.databaseId, actor, 'read');
      const pin = await this.connection.captureDuckDBSnapshot(analysis.databaseId);
      const current = await pin.run(() => this.load(id, actor, 'read'));
      if (
        current.document.revision !== body.expectedRevision ||
        current.sourceRevision !== body.expectedSourceRevision
      )
        throw new ConflictException(
          '분포 조회의 기준이 변경됐습니다. 현재 초안을 유지하고 최신 상태를 확인하세요.',
        );
      const document = validateStudioDocument(body.document);
      if (
        document.dashboardId !== id ||
        document.sourceId !== current.document.sourceId ||
        (document.revision && document.revision !== body.expectedRevision)
      )
        throw new BadRequestException('조회할 문서와 소스를 확인해 주세요.');
      if (document.conditions && document.conditions.sourceRevision !== current.sourceRevision)
        throw new ConflictException('조건 파일이 변경됐습니다. 초안을 유지하고 조건을 확인하세요.');
      return { current, pin, document };
    });
    const { current, pin, document } = captured;
    let failure: unknown;
    const result = await pin
      .run(async () => {
        if (document.conditions?.semantics)
          await this.ai.assertConditionSemantics(
            document.sourceId,
            current.schema.map(c => ({ name: c.column_name, type: c.column_type })),
            document.conditions,
          );
        return sourceConditionProfile({
          schema: current.schema.map(c => ({ name: c.column_name, type: c.column_type })),
          columns: body.columns,
          definition: document.conditions?.definition ?? { include: null, exclude: null },
          semantics: document.conditions?.semantics,
          filters: document.filters,
          dateRange: document.dateRange,
          query: (sql, bindings) => this.connection.queryDuckDB(document.sourceId, sql, bindings),
        });
      })
      .catch(error => {
        failure = error;
        return null;
      });
    await serializeMetadataWork(this.db, async () => {
      const row = await this.owner(id, actor, 'read');
      await this.source(document.sourceId, actor, 'read');
      if (dashboardRevision(row) !== current.document.revision)
        throw new ConflictException('분포 조회 중 저장본이 변경됐습니다. 다시 조회하세요.');
      const latest = (await this.ai.analysis(id, actor, true, 'read')).data;
      if (latest.databaseId !== document.sourceId)
        throw new ConflictException('분포 조회 중 소스가 변경됐습니다.');
      const fresh = await this.connection.captureDuckDBSnapshot(document.sourceId);
      if (
        (await fresh.run(() => this.connection.duckDBVersion(document.sourceId))) !==
        current.sourceRevision
      )
        throw new ConflictException('분포 조회 중 파일이 변경됐습니다. 다시 조회하세요.');
    });
    if (failure) throw failure;
    return {
      scope: {
        dashboardId: id,
        sourceId: document.sourceId,
        expectedRevision: body.expectedRevision,
        expectedSourceRevision: body.expectedSourceRevision,
        filters: document.filters ?? [],
        dateRange: document.dateRange ?? null,
        conditions: document.conditions ?? null,
      },
      ...result,
    };
  }
  /** Recheck both the original source and the current dashboard source on every execution read/replay. */
  async assertExecutionAccess(
    id: number,
    originalSourceId: number,
    actor: number,
    action: ResourceAction | 'owner' = 'read',
    manager?: EntityManager,
  ) {
    if (manager) {
      await this.owner(id, actor, action, manager);
      await this.source(originalSourceId, actor, 'read', manager);
      return;
    }
    await this.owner(id, actor, action);
    await this.source(originalSourceId, actor, 'read');
    const analysis = (await this.ai.analysis(id, actor, true, action)).data;
    await this.source(analysis.databaseId, actor, 'read');
  }
  /**
   * Publication uses persisted definitions only and computes fresh aggregates under one pinned
   * source. UC-051: an explicit publish grant authorizes publishing; ownership never moves.
   */
  async assertPublicationOwner(id: number, actor: number) {
    await this.owner(id, actor, 'publish');
    const analysis = (await this.ai.analysis(id, actor, true, 'publish')).data;
    await this.source(analysis.databaseId, actor, 'read');
  }
  async publicationSnapshot<T>(
    id: number,
    expectedRevision: string,
    actor: number,
    commit: (
      value: {
        document: StudioDocumentV1;
        preview: any;
        dataVersion: string;
        schema: any[];
        items: any[];
        analysis: any;
      },
      manager: EntityManager,
    ) => Promise<T>,
  ): Promise<T> {
    await this.assertPublicationOwner(id, actor);
    const analysis = (await this.ai.analysis(id, actor, true, 'publish')).data;
    const initialSource = await this.db.manager.findOne(Database, {
      where: { id: analysis.databaseId },
    });
    return this.connection.withDuckDBSnapshot(analysis.databaseId, async () => {
      const current = await this.load(id, actor, 'publish');
      if (
        current.document.revision !== expectedRevision ||
        current.document.sourceId !== analysis.databaseId
      )
        throw new ConflictException('저장한 최신 초안을 확인한 뒤 게시해 주세요.');
      for (const [index, block] of current.document.blocks.entries()) {
        await this.validateCurrentReferences(
          block,
          current.document.sourceId,
          current.schemaVersion,
          current.schema,
        );
        const widget = current.analysis.widgets[index];
        const proven = compileContribution(widget, current.schema).supported;
        // Snapshot charts may group by an exact timestamp without inferring a time bucket.
        // Reuse the same strict aggregate/group parser, treating time as a scalar category only
        // for this publication check. This is not evidence for time-point source-row drilldown.
        const exactTimeAggregate =
          widget.type === 'CHART_LINE' &&
          compileContribution(
            widget,
            current.schema.map(column =>
              /^(DATE|TIMESTAMP)/i.test(column.column_type)
                ? { ...column, column_type: 'VARCHAR' }
                : column,
            ),
          ).supported;
        // DISTINCT is safe for publication when the exact server canonical compiler proves it;
        // contribution drilldown intentionally declines DISTINCT and keeps its narrower contract.
        const canonicalDistinct =
          (current.items[index]?.definition?.aggregation === 'COUNT_DISTINCT' ||
            current.items[index]?.dimensionBusinessBasis ||
            current.items[index]?.definition?.businessBasis) &&
          captureRemixTemplate(
            current.document,
            current.items,
            current.schema,
            current.analysis.widgets,
          ).blocks[index].supported;
        if (!proven && !exactTimeAggregate && !canonicalDistinct)
          throw new BadRequestException('안전한 집계로 확인된 차트만 게시할 수 있습니다.');
      }
      const preview = (
        await this.ai.preview(
          {
            draft: current.analysis,
            filters: current.document.filters ?? [],
            ...(current.document.conditions ? { conditions: current.document.conditions } : {}),
            ...(current.document.dateRange ? { dateRange: current.document.dateRange } : {}),
            includeTrends: true,
          },
          actor,
          'publish',
        )
      ).data;
      // Publication and save share the metadata queue; recheck against legacy writes during aggregation too.
      return metadataTransaction(this.db, async manager => {
        const dashboard = await this.lockDashboard(manager, id);
        await lockMetricSources(manager, [analysis.databaseId]);
        await this.access.dashboard(id, actor, 'publish', manager);
        await this.source(analysis.databaseId, actor, 'read', manager);
        const source = await manager.findOne(Database, { where: { id: analysis.databaseId } });
        if (
          dashboardRevision(dashboard) !== expectedRevision ||
          !initialSource ||
          source.connectionConfig !== initialSource.connectionConfig ||
          String(source.updatedAt) !== String(initialSource.updatedAt)
        )
          throw new ConflictException(
            '집계 중 초안이나 데이터가 변경되었습니다. 다시 게시해 주세요.',
          );
        for (const block of current.document.blocks)
          await this.validateCurrentReferences(
            block,
            current.document.sourceId,
            current.schemaVersion,
            current.schema,
            manager,
          );
        return commit(
          {
            document: current.document,
            preview,
            dataVersion: current.dataVersion,
            schema: current.schema,
            items: current.items,
            analysis: current.analysis,
          },
          manager,
        );
      });
    });
  }
  private async preflightConditionData(
    id: number,
    actor: number,
    action: 'edit' | 'publish',
    sourceId: number,
    input: unknown,
  ) {
    const conditions = validateStudioConditions(input);
    const authorize = async () => {
      await this.access.dashboard(id, actor, action);
      await this.source(sourceId, actor, 'read');
    };
    await authorize();
    const pin = await this.connection.captureDuckDBSnapshot(sourceId);
    let failure: unknown;
    try {
      await pin.run(async () => {
        if (conditions.sourceRevision !== (await this.connection.duckDBVersion(sourceId)))
          throw new ConflictException('조건의 파일 기준이 변경됐습니다. 초안을 유지해 주세요.');
        const schema = (await this.connection.queryDuckDB(sourceId, 'DESCRIBE uploaded_data'))
          .datas;
        await this.ai.assertConditionSemantics(
          sourceId,
          schema.map(c => ({ name: c.column_name, type: c.column_type })),
          conditions,
        );
      });
    } catch (error) {
      failure = error;
    }
    await authorize();
    const fresh = await this.connection.captureDuckDBSnapshot(sourceId);
    if (
      (await fresh.run(() => this.connection.duckDBVersion(sourceId))) !== conditions.sourceRevision
    )
      throw new ConflictException('업무 날짜 검증 중 파일이 변경됐습니다. 초안을 유지해 주세요.');
    if (failure) throw failure;
  }
  /** No publication write: establish immutable date validation before the publication queue. */
  async preflightPublicationConditions(id: number, actor: number, expectedRevision: string) {
    const state = await serializeMetadataWork(this.db, async () => {
      await this.assertPublicationOwner(id, actor);
      const current = await this.load(id, actor, 'publish');
      if (current.document.revision !== expectedRevision)
        throw new ConflictException('저장한 최신 분석을 다시 확인해 주세요.');
      return current;
    });
    if (!state.document.conditions?.semantics) return;
    await this.preflightConditionData(
      id,
      actor,
      'publish',
      state.document.sourceId,
      state.document.conditions,
    );
  }
  async save(id: number, body: any, actor: number, signal?: AbortSignal) {
    // Receipt replay stays metadata-only. A new semantic write validates its immutable date file
    // before entering the write queue; saveOnce still rechecks rights/file/revision atomically.
    if (body?.document?.conditions?.semantics) {
      const hasReceipt = await serializeMetadataWork(this.db, async () => {
        await this.access.dashboard(id, actor, 'edit');
        if (typeof body.requestId !== 'string') return false;
        return Boolean(
          await this.db.manager.findOne(StudioRun, {
            where: { actorId: actor, requestId: body.requestId },
          }),
        );
      });
      if (!hasReceipt) {
        const document = validateStudioDocument(body.document);
        if (document.dashboardId !== id)
          throw new BadRequestException('저장할 분석을 확인해 주세요.');
        await this.preflightConditionData(
          id,
          actor,
          'edit',
          document.sourceId,
          document.conditions,
        );
      }
    }
    return this.serializeWrite(() => this.saveOnce(id, body, actor, signal));
  }
  /** Cross-process Studio writes lock an existing row, including the first publication. */
  private async lockDashboard(manager: EntityManager, id: number) {
    return lockDashboardWrite(manager, id);
  }
  /** All Studio metadata transactions share the single SQLite connection's queue. */
  async serializeWrite<T>(run: () => Promise<T>): Promise<T> {
    // Serialize Studio transactions for the single SQLite connection; DB CAS/unique keys remain authoritative.
    if (this.queued >= 32)
      throw new ServiceUnavailableException(
        '저장 요청이 많습니다. 잠시 후 같은 요청으로 다시 시도해 주세요.',
      );
    this.queued += 1;
    const result = this.tail
      .then(
        () => serializeMetadataWork(this.db, run),
        () => serializeMetadataWork(this.db, run),
      )
      .finally(() => {
        this.queued -= 1;
      });
    this.tail = result.catch(() => undefined);
    return result;
  }
  private async saveOnce(id: number, body: any, actor: number, signal?: AbortSignal) {
    await this.access.dashboard(id, actor, 'edit');
    if (
      !body ||
      !/^[-a-zA-Z0-9_]{1,128}$/.test(body.requestId) ||
      typeof body.requestId !== 'string' ||
      typeof body.expectedRevision !== 'string' ||
      !/^[a-f0-9]{64}$/.test(body.expectedRevision) ||
      typeof body.expectedSourceRevision !== 'string' ||
      !/^[a-f0-9]{64}$/.test(body.expectedSourceRevision) ||
      Object.keys(body).some(
        k => !['requestId', 'expectedRevision', 'expectedSourceRevision', 'document'].includes(k),
      )
    )
      throw new BadRequestException('저장 요청을 확인해 주세요.');
    let document: StudioDocumentV1;
    try {
      document = validateStudioDocument(body.document);
    } catch {
      throw new BadRequestException('블록 정의와 배치를 확인해 주세요.');
    }
    if (
      document.dashboardId !== id ||
      !document.blocks.length ||
      (document.revision && document.revision !== body.expectedRevision)
    )
      throw new BadRequestException('저장할 대시보드와 블록을 확인해 주세요.');
    await this.source(document.sourceId, actor, 'read');
    const payloadHash = studioDigest({
      id,
      expectedRevision: body.expectedRevision,
      expectedSourceRevision: body.expectedSourceRevision,
      document,
    });
    const replay = async () => {
      const prior = await this.db.manager.findOne(StudioRun, {
        where: { actorId: actor, requestId: body.requestId },
      });
      if (!prior) return null;
      if (prior.payloadHash !== payloadHash)
        throw new ConflictException('같은 저장 요청 ID에 다른 변경을 보낼 수 없습니다.');
      try {
        const result = JSON.parse(prior.result);
        if (!result?.document || !result?.idMap) throw new Error();
        return result;
      } catch {
        throw new ConflictException(
          '이 저장 요청의 완료 기록을 확인할 수 없습니다. 최신 내용을 다시 불러와 주세요.',
        );
      }
    };
    const previous = await replay();
    if (previous) return previous;
    const checkCancelled = () => {
      if (signal?.aborted) throw new BadRequestException('저장 요청을 취소했습니다.');
    };
    checkCancelled();
    try {
      return await this.connection.withDuckDBSnapshot(document.sourceId, async () => {
        checkCancelled();
        const sourceBefore = await this.db.manager.findOne(Database, {
          where: { id: document.sourceId },
        });
        const current = await this.load(id, actor, 'edit');
        if (
          studioDigest(body.document?.businessBasis ?? null) !==
          studioDigest(current.document.businessBasis ?? null)
        )
          throw new BadRequestException('저장된 업무 기준은 편집 문서에서 바꿀 수 없습니다.');
        if (
          current.document.conditions?.semantics &&
          document.conditions &&
          !document.conditions.semantics
        )
          throw new BadRequestException(
            '기존 조건의 업무 의미를 유지하거나 전체 조건을 명시 제거해 주세요.',
          );
        if (current.sourceRevision !== body.expectedSourceRevision)
          throw new ConflictException(
            '데이터 파일이 교체되었습니다. 최신 결과를 확인한 뒤 다시 저장해 주세요.',
          );
        if (current.document.revision !== body.expectedRevision)
          throw new ConflictException(
            '다른 화면에서 변경되었습니다. 내 변경을 보존한 채 최신 내용을 확인해 주세요.',
          );
        if (current.document.sourceId !== document.sourceId)
          throw new ForbiddenException('데이터 소스를 바꿀 수 없습니다.');
        if (document.conditions && document.conditions.sourceRevision !== current.sourceRevision)
          throw new ConflictException(
            '조건의 데이터 파일이 변경됐습니다. 조건을 다시 적용하거나 명시 제거해 주세요.',
          );
        const old = current.document;
        const items = current.items;
        const indices = new Map(old.blocks.map((b, i) => [b.definitionKey, i]));
        const snapshots = [];
        const widgets = [];
        for (const block of document.blocks) {
          const persistedIndex = old.blocks.findIndex(b => b.id === block.id);
          const index = persistedIndex >= 0 ? persistedIndex : indices.get(block.definitionKey);
          const original = index === undefined ? undefined : old.blocks[index];
          const prior = old.blocks.find(b => b.id === block.id);
          if (
            !original ||
            original.kind !== block.kind ||
            (!isTemporaryStudioId(block.id) &&
              (!prior || prior.definitionKey !== block.definitionKey)) ||
            studioDigest(original.measureRefs) !== studioDigest(block.measureRefs) ||
            studioDigest(original.dimensionRefs) !== studioDigest(block.dimensionRefs) ||
            studioDigest(original.businessBasis ?? null) !==
              studioDigest(block.businessBasis ?? null) ||
            original.defaultDateColumn !== block.defaultDateColumn
          )
            throw new BadRequestException(
              '기존 블록의 계산 정의와 참조를 유지해 주세요. 새 지표 생성은 아직 지원하지 않습니다.',
            );
          await this.validateCurrentReferences(
            block,
            document.sourceId,
            current.schemaVersion,
            current.schema,
            this.db.manager,
          );
          const template = current.analysis.widgets[index];
          widgets.push({
            ...template,
            ...block.display,
            title: block.title,
            description: block.description,
            ...(isTemporaryStudioId(block.id) ? { blockId: undefined } : { blockId: block.id }),
          });
          snapshots.push(
            current.snapshot
              ? {
                  ...items[index],
                  ...(items[index]?.dataVersion ? { dataVersion: current.dataVersion } : {}),
                }
              : {},
          );
        }
        const draft = {
          databaseId: document.sourceId,
          ...(current.analysis.businessBasis
            ? { businessBasis: current.analysis.businessBasis }
            : {}),
          title: document.title,
          explanation: current.analysis.explanation,
          widgets,
        };
        // Validate source columns/types and the scoped query before committing any writes.
        if (document.filters?.length || document.dateRange || document.conditions)
          await this.ai.preview(
            {
              draft,
              filters: document.filters ?? [],
              ...(document.conditions ? { conditions: document.conditions } : {}),
              ...(document.dateRange ? { dateRange: document.dateRange } : {}),
            },
            actor,
            'edit',
          );
        const previousSnapshot = { ...current.snapshot };
        delete previousSnapshot.studioFilters;
        delete previousSnapshot.studioDateRange;
        delete previousSnapshot.studioConditions;
        const snapshot =
          current.snapshot || document.filters?.length || document.dateRange || document.conditions
            ? {
                ...previousSnapshot,
                ...(document.filters?.length ? { studioFilters: document.filters } : {}),
                ...(document.dateRange ? { studioDateRange: document.dateRange } : {}),
                ...(document.conditions ? { studioConditions: document.conditions } : {}),
                schemaVersion: 2,
                kind: 'structured-bi-dashboard',
                sourceId: document.sourceId,
                dataVersion: current.dataVersion,
                items: snapshots,
              }
            : undefined;
        const prepared = await this.ai.prepareSave(
          {
            dashboardId: id,
            expectedRevision: body.expectedRevision,
            draft,
            ...(document.conditions
              ? {
                  conditions: document.conditions,
                  filters: document.filters ?? [],
                  ...(document.dateRange ? { dateRange: document.dateRange } : {}),
                }
              : {}),
          },
          actor,
          snapshot,
          undefined,
          true,
        );
        return metadataTransaction(this.db, async manager => {
          const locked = await this.lockDashboard(manager, id);
          if (dashboardRevision(locked) !== body.expectedRevision)
            throw new ConflictException('다른 화면에서 변경되었습니다.');
          await this.access.dashboard(id, actor, 'edit', manager);
          await lockMetricReferences(
            manager,
            document.sourceId,
            document.blocks.flatMap(block => block.measureRefs.map(ref => ref.id)),
          );
          await this.source(document.sourceId, actor, 'read', manager);
          const sourceNow = await manager.findOne(Database, { where: { id: document.sourceId } });
          if (!sourceBefore || sourceNow.connectionConfig !== sourceBefore.connectionConfig)
            throw new ConflictException('데이터 파일이 교체되었습니다.');
          for (const block of document.blocks)
            await this.validateCurrentReferences(
              block,
              document.sourceId,
              current.schemaVersion,
              current.schema,
              manager,
            );
          const saved = await prepared.persist(manager);
          const idMap: Record<string, string> = {};
          document.blocks.forEach((b, i) => {
            if (isTemporaryStudioId(b.id)) idMap[b.id] = saved.draft.widgets[i].blockId;
          });
          const map = (value: string) => idMap[value] ?? value;
          const remapped = validateStudioDocument({
            ...document,
            blocks: document.blocks.map(b => ({ ...b, id: map(b.id) })),
            layouts: Object.fromEntries(
              STUDIO_BREAKPOINTS.map(bp => [
                bp,
                document.layouts[bp].map(g => ({ ...g, id: map(g.id) })),
              ]),
            ),
          });
          const links = await manager.find(DashboardWidget, {
            where: { dashboardId: id },
            order: { id: 'ASC' },
          });
          if (links.length !== remapped.blocks.length)
            throw new ConflictException('차트 배치를 다시 불러와 주세요.');
          const layout = remapped.layouts.lg.map(g => {
            const index = remapped.blocks.findIndex(b => b.id === g.id);
            return { i: String(links[index].widgetId), x: g.x, y: g.y, w: g.w, h: g.h };
          });
          await manager.update(Dashboard, { id }, { layout: JSON.stringify(layout) });
          const row = await this.owner(id, actor, 'edit', manager);
          remapped.revision = dashboardRevision(row);
          await manager.save(StudioState, {
            dashboardId: id,
            document: JSON.stringify({
              document: remapped,
              sourceRevision: current.sourceRevision,
            }),
            legacyRevision: remapped.revision,
          });
          const result = { document: remapped, idMap };
          await manager.insert(StudioRun, {
            actorId: actor,
            requestId: body.requestId,
            payloadHash,
            result: JSON.stringify(result),
          });
          checkCancelled();
          return result;
        });
      });
    } catch (error) {
      const recovered = await replay();
      if (recovered) return recovered;
      throw error;
    }
  }
}
