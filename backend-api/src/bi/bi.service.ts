import { DATE_FORMATS, stringType } from './business-variable';
import { serializeEnterpriseWrite } from '../enterprise/enterprise-write';
import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { randomUUID } from 'crypto';
import { dimensionDefinition } from './semantic-proposal';
import { Database } from '../database/entities/database.entity';
import { SourceCatalogEntry } from './entities/source-catalog-entry.entity';
import { Metric } from '../metric/entities/metric.entity';
import { Dashboard } from '../dashboard/entities/dashboard.entity';
import { SourceAccessService } from '../ownership/source-access.service';
import { ConnectionService } from '../connection/connection.service';
import { AiDashboardService } from '../ai/ai-dashboard.service';
import { sourceRevision } from './source-revision';
import { decryptConnectionConfig } from '../utils/crypto.util';
import { compileMetricWidget } from './structured-widget';
import { metricFields } from './metric-expression';
import { metricExpression } from './metric-expression';
import { collectFormulaReferences, pinMetricFormula } from './metric-formula';
import { quoteColumn, sourceQuery, validateDraft } from '../ai/dashboard-draft';
import { resolveBlockTarget } from './block-target';
import { explicitRenameRequested } from '../ai/saved-metric-reference';
import {
  BATCH_FAILURE_MESSAGES,
  BatchBlockAction,
  BatchEditPlan,
  BatchFailureStage,
  MAX_BATCH_ACTIONS,
  MIN_BATCH_ACTIONS,
  isBatchControlError,
} from '../ai/batch-block-edit';
import {
  validateBlockLayouts,
  responsiveLayouts,
  layoutColumns,
  LayoutSize,
} from '../ai/responsive-layout';

/**
 * UC-013~UC-016 AI editor response. `editMode` discriminates: a batch carries the
 * validated whole preview plus per-target changes, the single modes carry one item.
 */
export type EditorAiResponse = {
  editMode: 'clarify' | 'save' | 'content' | 'layout' | 'batch';
  saveRequested: boolean;
  /** UC-019: true only when the classified question also explicitly asked for publication. */
  publicationRequested?: true;
  item?: any;
  targetKey?: any;
  targetCandidates?: any;
  changes?: any;
  preview?: any;
};

@Injectable()
export class BiService {
  private profiles = new Map<number, { version: string; data: any }>();
  constructor(
    private readonly db: DataSource,
    private readonly access: SourceAccessService,
    private readonly connection: ConnectionService,
    private readonly dashboards: AiDashboardService,
  ) {}
  /**
   * UC051: the export boundary re-checks the current source action instead of trusting an
   * earlier read, so a revoked or downgraded grant is denied before a query runs and again
   * before a file response is serialized.
   */
  async assertSourceAction(
    sourceId: unknown,
    actor: number,
    action: 'read' | 'edit' | 'export',
  ): Promise<void> {
    await this.access.assert('database', sourceId, actor, action);
  }
  /**
   * UC051: discovery lists the acting user's own sources plus the sources a current grant makes
   * readable. The union never impersonates the granting owner: ownerId stays the real actor and
   * granted ids are added explicitly, with the latest organization/active/grant state per request.
   */
  async sources(actor: number, includeCatalog = false) {
    const ownerId = this.access.actor(actor);
    const granted = await this.access.readableSourceIds(actor);
    if (!includeCatalog) {
      const rows = await this.db.getRepository(Database).find({
        where: granted.length
          ? [
              { ownerId, catalogActive: true },
              { id: In(granted), catalogActive: true },
            ]
          : { ownerId, catalogActive: true },
        select: { id: true, name: true, engine: true },
        order: { id: 'ASC' },
      });
      return rows.map(({ id, name, engine }) => ({ id, name, engine }));
    }
    // UC050/UC051: one latest entry per accessible source; metadata is never returned to
    // discovery clients.
    const rows = await this.db
      .getRepository(Database)
      .createQueryBuilder('source')
      .leftJoin(
        SourceCatalogEntry,
        'catalog',
        `catalog.sourceId = source.id AND catalog.version = ${this.db
          .createQueryBuilder()
          .subQuery()
          .select('MAX(latest.version)')
          .from(SourceCatalogEntry, 'latest')
          .where('latest.sourceId = source.id')
          .getQuery()}`,
      )
      .select('source.id', 'id')
      .addSelect('source.name', 'name')
      .addSelect('source.engine', 'engine')
      .addSelect('catalog.version', 'catalogVersion')
      .addSelect('catalog.metadata', 'metadata')
      .where(
        granted.length
          ? '(source.ownerId = :ownerId OR source.id IN (:...granted))'
          : 'source.ownerId = :ownerId',
        granted.length ? { ownerId, granted } : { ownerId },
      )
      .andWhere('source.catalogActive = :catalogActive', { catalogActive: true })
      .orderBy('source.id', 'ASC')
      .getRawMany();
    return rows.map(({ id, name, engine, catalogVersion, metadata }) => {
      const source = { id, name, engine };
      try {
        const label = JSON.parse(metadata)?.label;
        if (
          typeof label === 'string' &&
          label.length <= 100 &&
          label.trim() &&
          Number.isSafeInteger(catalogVersion) &&
          catalogVersion > 0
        )
          return { ...source, catalogLabel: label.trim(), catalogVersion };
      } catch {
        /* A damaged latest label does not hide an otherwise accessible source. */
      }
      return source;
    });
  }
  /** UC050: fixed formats + quoted actual identifiers; only aggregate invalid counts leave DuckDB. */
  async validateBusinessDates(
    sourceId: number,
    actor: number,
    revision: string,
    columns: Array<{ column: string; dateFormat: string }>,
  ) {
    await this.access.assert('database', sourceId, actor, 'edit');
    const issues = await this.connection.withDuckDBSnapshot(sourceId, async () => {
      const before = await this.profile(sourceId, actor);
      if (!before.supported || before.dataVersion !== revision)
        throw new ConflictException('날짜 확인 기준 데이터가 변경됐습니다. 다시 조회해 주세요.');
      if (!Array.isArray(columns) || !columns.length || columns.length > 128)
        throw new BadRequestException('날짜 열 목록을 확인해 주세요.');
      const expressions = columns.map((c, i) => {
        if (
          !c ||
          !Object.prototype.hasOwnProperty.call(DATE_FORMATS, c.dateFormat) ||
          !before.columns.some(s => s.name === c.column && stringType(s.type))
        )
          throw new BadRequestException('날짜 열·형식을 확인해 주세요.');
        const raw = `CAST(${quoteColumn(c.column)} AS VARCHAR)`,
          format = DATE_FORMATS[c.dateFormat];
        const parsed = `try_strptime(${raw}, '${format}')`;
        return `COUNT(*) FILTER (WHERE ${quoteColumn(
          c.column,
        )} IS NOT NULL AND (${parsed} IS NULL OR strftime(${parsed}, '${format}') <> ${raw})) AS invalid_${i}, COUNT(*) FILTER (WHERE ${quoteColumn(
          c.column,
        )} IS NOT NULL AND trim(${raw}) = '') AS blank_${i}`;
      });
      const result = (
        await this.connection.queryDuckDB(
          sourceId,
          `SELECT ${expressions.join(', ')} FROM uploaded_data`,
        )
      ).datas[0];
      await this.access.assert('database', sourceId, actor, 'edit');
      return columns.map((c, i) => ({
        column: c.column,
        invalidCount: String(result?.[`invalid_${i}`]),
        blankCount: String(result?.[`blank_${i}`]),
      }));
    });
    // Re-read outside the pinned file too: replacing the source during validation invalidates it.
    await this.access.assert('database', sourceId, actor, 'edit');
    if ((await this.profile(sourceId, actor)).dataVersion !== revision)
      throw new ConflictException('날짜 확인 중 데이터가 변경됐습니다. 다시 조회해 주세요.');
    if (issues.some(issue => issue.invalidCount !== '0'))
      throw new BadRequestException({
        code: 'INVALID_BUSINESS_DATES',
        message:
          '날짜 형식과 맞지 않는 값이 있습니다. 빈 문자열도 날짜가 아닙니다. 값이 없으면 NULL로 준비해 주세요.',
        details: issues,
      });
  }
  async profile(id: unknown, actor: number) {
    const sourceId = this.access.id(id);
    // Permissions and ownership are resolved per request and merged outside the shared snapshot
    // cache, so one actor's granted rights are never stored in (or served from) another actor's
    // cache entry. sourceCapabilities performs the read check for this request.
    const access = await this.access.sourceCapabilities(sourceId, actor);
    const source = await this.db.getRepository(Database).findOne({ where: { id: sourceId } });
    const owned = source.ownerId === actor;
    if (source.engine !== 'duckdb')
      return { ...(await this.profileSnapshot(id, actor)), access, owned };
    return this.connection.withDuckDBSnapshot(sourceId, async () => ({
      ...(await this.profileSnapshot(id, actor)),
      access,
      owned,
    }));
  }
  private async profileSnapshot(id: unknown, actor: number) {
    await this.access.assert('database', id, actor, 'read');
    const source = await this.db
      .getRepository(Database)
      .findOne({ where: { id: this.access.id(id) } });
    const version = sourceRevision(
      source,
      source.engine === 'duckdb'
        ? await this.connection.duckDBVersion(source.id)
        : source.connectionConfig,
    );
    const base = {
      sourceId: source.id,
      name: source.name,
      engine: source.engine,
      storedAt: source.updatedAt || source.createdAt,
      dataVersion: version,
    };
    if (source.engine !== 'duckdb')
      return { ...base, supported: false, status: 'unsupported', columns: [], preview: [] };
    const cached = this.profiles.get(source.id);
    if (cached?.version === version) return cached.data;
    const schema = (await this.connection.queryDuckDB(source.id, 'DESCRIBE uploaded_data')).datas;
    const model =
      source.connectionConfig &&
      JSON.parse(decryptConnectionConfig(source.connectionConfig)).fileModel;
    const nonAdditive = new Set<string>(model?.nonAdditiveColumns ?? []);
    if (!schema.length || schema.length > 128)
      throw new BadRequestException('지원 컬럼 수는 1~128개입니다.');
    const columns = schema.map(row => ({
      name: row.column_name,
      type: row.column_type,
      numeric: /^(U?BIGINT|U?INTEGER|U?SMALLINT|U?TINYINT|HUGEINT|FLOAT|DOUBLE|DECIMAL)/i.test(
        row.column_type,
      ),
      temporal: /^(DATE|TIMESTAMP)/i.test(row.column_type),
      ...(nonAdditive.has(row.column_name) ? { nonAdditive: true } : {}),
    }));
    const expressions = ['COUNT(*) AS row_count'];
    columns.forEach((c, i) => {
      expressions.push(`COUNT(*)-COUNT(${quoteColumn(c.name)}) AS null_${i}`);
      if (c.temporal)
        expressions.push(
          `MIN(${quoteColumn(c.name)}) AS min_${i}`,
          `MAX(${quoteColumn(c.name)}) AS max_${i}`,
        );
    });
    const stats = (
      await this.connection.queryDuckDB(
        source.id,
        `SELECT ${expressions.join(', ')} FROM uploaded_data`,
      )
    ).datas[0];
    const preview = (
      await this.connection.queryDuckDB(source.id, 'SELECT * FROM uploaded_data LIMIT 5')
    ).datas;
    const data = {
      ...base,
      supported: true,
      status: 'ready',
      rowCount: String(stats.row_count),
      columns: columns.map((c, i) => ({
        ...c,
        nullCount: String(stats[`null_${i}`]),
        ...(c.temporal ? { min: stats[`min_${i}`], max: stats[`max_${i}`] } : {}),
      })),
      preview,
      ...(model
        ? {
            modelInfo: {
              type: model.type,
              grain: model.grain,
              quality: model.quality,
              factSourceId: model.spec.factSourceId,
              lookupSourceId: model.spec.lookupSourceId,
              factKey: model.spec.definition.factKey,
              lookupAttributes: model.spec.definition.attributes.map(a => a.alias),
              nonAdditiveColumns: model.nonAdditiveColumns,
            },
          }
        : {}),
    };
    if (this.profiles.size >= 50) this.profiles.delete(this.profiles.keys().next().value);
    this.profiles.set(source.id, { version, data });
    return data;
  }
  private text(value: unknown, max: number) {
    if (typeof value !== 'string' || !value.trim() || value.length > max)
      throw new BadRequestException('표시 이름을 확인해 주세요.');
    return value.trim();
  }
  async createMetric(body: any, actor: number) {
    // UC051: a stored metric definition is written against the source, so it needs edit; the
    // read used for the profile must not be enough on its own.
    await this.access.assert('database', body?.sourceId, actor, 'edit');
    if (body?.aggregation === 'FORMULA') {
      return this.connection.withDuckDBSnapshot(body.sourceId, async () => {
        const { profile, definition } = await this.prepareFormula(body, actor);
        const row = await serializeEnterpriseWrite(this.db, async () => {
          await this.access.assert('database', body.sourceId, actor, 'edit');
          const repo = this.db.getRepository(Metric);
          return repo.save(
            repo.create({
              name: 'bi_' + randomUUID(),
              databaseId: profile.sourceId,
              tableName: 'uploaded_data',
              aggregation: 'FORMULA' as any,
              expression: 'structured_formula',
              description: definition.label,
              definition: JSON.stringify(definition),
              useYn: 'Y',
            }),
          );
        });
        return { id: row.id, label: definition.label, definitionVersion: 1, definition };
      });
    }
    const profile = await this.profile(body?.sourceId, actor);
    if (!profile.supported)
      throw new BadRequestException('서버에 저장한 DuckDB 파일을 선택해 주세요.');
    const aggregation = body.aggregation;
    const label = this.text(body.label, 100);
    const fields = metricFields(body, profile);
    if (
      !Number.isInteger(body.decimalPlaces) ||
      body.decimalPlaces < 0 ||
      body.decimalPlaces > 6 ||
      !['plain', 'compact'].includes(body.numberNotation)
    )
      throw new BadRequestException('표시 형식을 확인해 주세요.');
    if (typeof body.unit !== 'string' || body.unit.length > 12)
      throw new BadRequestException('단위를 확인해 주세요.');
    const definition = {
      schemaVersion: 1,
      definitionVersion: 1,
      sourceId: profile.sourceId,
      tableName: 'uploaded_data',
      label,
      aggregation,
      ...fields,
      unit: body.unit,
      decimalPlaces: body.decimalPlaces,
      numberNotation: body.numberNotation,
    };
    const row = await serializeEnterpriseWrite(this.db, async () => {
      await this.access.assert('database', profile.sourceId, actor, 'edit');
      const repo = this.db.getRepository(Metric);
      return repo.save(
        repo.create({
          name: 'bi_' + randomUUID(),
          databaseId: profile.sourceId,
          tableName: 'uploaded_data',
          aggregation,
          expression: aggregation === 'COUNT' ? 'count_rows' : fields.column,
          description: label,
          definition: JSON.stringify(definition),
          useYn: 'Y',
        }),
      );
    });
    return { id: row.id, label, definitionVersion: 1, definition };
  }
  /** Resolve live references here; clients can never supply the trusted operand snapshots. */
  async prepareFormula(body: any, actor: number) {
    const allowed = [
      'sourceId',
      'expectedSourceRevision',
      'label',
      'aggregation',
      'expression',
      'decimalPlaces',
      'numberNotation',
    ];
    if (
      !body ||
      typeof body !== 'object' ||
      Array.isArray(body) ||
      Object.keys(body).some(key => !allowed.includes(key)) ||
      body.aggregation !== 'FORMULA'
    )
      throw new BadRequestException('계산 지표 요청을 확인해 주세요.');
    const profile = await this.profile(body.sourceId, actor);
    if (!profile.supported) throw new BadRequestException('서버 DuckDB 소스를 선택해 주세요.');
    if (
      typeof body.expectedSourceRevision !== 'string' ||
      body.expectedSourceRevision !== profile.dataVersion
    )
      throw new ConflictException('원본 버전이 변경되었습니다. 다시 미리보기해 주세요.');
    const references = collectFormulaReferences(body.expression),
      operands = [];
    for (const ref of references) {
      await this.access.assert('metric', ref.metricId, actor);
      const row = await this.db.getRepository(Metric).findOne({ where: { id: ref.metricId } });
      if (!row || row.databaseId !== profile.sourceId || row.useYn !== 'Y' || !row.definition)
        throw new BadRequestException('같은 소스의 활성 저장 지표를 선택해 주세요.');
      const d = JSON.parse(row.definition);
      if (d.definitionVersion !== ref.definitionVersion)
        throw new ConflictException('참조 지표가 변경되었습니다. 다시 미리보기해 주세요.');
      operands.push({ id: row.id, definitionVersion: d.definitionVersion, definition: d });
    }
    const formula = pinMetricFormula(body.expression, operands, profile);
    if (
      !Number.isInteger(body.decimalPlaces) ||
      body.decimalPlaces < 0 ||
      body.decimalPlaces > 6 ||
      !['plain', 'compact'].includes(body.numberNotation)
    )
      throw new BadRequestException('계산 표시 형식을 확인해 주세요.');
    const definition = {
      schemaVersion: 1,
      definitionVersion: 1,
      sourceId: profile.sourceId,
      tableName: 'uploaded_data',
      label: this.text(body.label, 100),
      aggregation: 'FORMULA',
      column: '*',
      formula,
      unit: formula.unit,
      decimalPlaces: body.decimalPlaces,
      numberNotation: body.numberNotation,
    };
    metricFields(definition, profile);
    return { profile, definition };
  }
  async previewFormula(body: any, actor: number) {
    // Prove source ownership before opening a pinned file, including on a malformed foreign source.
    await this.access.assert('database', body?.sourceId, actor);
    return this.connection.withDuckDBSnapshot(body.sourceId, async () => {
      const { profile, definition } = await this.prepareFormula(body, actor);
      const query = sourceQuery(
        `SELECT ${metricExpression(definition, profile)} AS value FROM source`,
        profile.columns.map(column => column.name),
      );
      const result = await this.connection.queryDuckDB(profile.sourceId, query.sql, query.bindings);
      return { sourceRevision: profile.dataVersion, definition, rows: result.datas };
    });
  }
  async metrics(sourceId: unknown, actor: number) {
    await this.access.assert('database', sourceId, actor, 'read');
    const rows = await this.db
      .getRepository(Metric)
      .find({ where: { databaseId: this.access.id(sourceId), useYn: 'Y' } });
    return rows
      .filter(r => r.definition)
      .map(r => {
        const definition = JSON.parse(r.definition);
        return {
          id: r.id,
          label: definition.label,
          definitionVersion: definition.definitionVersion,
          definition,
        };
      });
  }
  async prepare(body: any, actor: number) {
    const profile = await this.profile(body?.sourceId, actor);
    await this.access.assert('metric', body?.metricId, actor, 'read');
    const row = await this.db
      .getRepository(Metric)
      .findOne({ where: { id: this.access.id(body.metricId) } });
    if (!row.definition || row.useYn !== 'Y' || row.databaseId !== profile.sourceId)
      throw new BadRequestException('이 소스의 저장 지표를 선택해 주세요.');
    const definition = JSON.parse(row.definition);
    if (
      !profile.supported ||
      definition.schemaVersion !== 1 ||
      definition.sourceId !== profile.sourceId
    )
      throw new BadRequestException('지표 정의를 확인해 주세요.');
    const title = this.text(body.title, 300);
    const { widget, dimension } = compileMetricWidget(
      definition,
      profile,
      body.chart,
      body.dimension,
      title,
    );
    const draft = {
      databaseId: profile.sourceId,
      title,
      explanation: definition.label,
      widgets: [widget],
    };
    const snapshot = {
      schemaVersion: 1,
      kind: 'structured-bi',
      sourceId: profile.sourceId,
      dataVersion: profile.dataVersion,
      metricId: row.id,
      definitionVersion: definition.definitionVersion,
      definition,
      dimension: dimension?.name,
      ...(dimension ? { dimensionDefinition: dimensionDefinition(profile, dimension) } : {}),
      chart: body.chart,
    };
    return { draft, snapshot, profile, definition };
  }
  async preview(body: any, actor: number) {
    await this.access.assert('database', body?.sourceId, actor, 'read');
    return this.connection.withDuckDBSnapshot(this.access.id(body.sourceId), () =>
      this.previewSnapshot(body, actor),
    );
  }
  private async previewSnapshot(body: any, actor: number) {
    const { draft, snapshot, profile, definition } = await this.prepare(body, actor);
    const rows = (
      await this.connection.queryDuckDB(profile.sourceId, sourceQuery(draft.widgets[0].sql, []).sql)
    ).datas;
    return {
      rows,
      metric: definition,
      sourceRevision: profile.dataVersion,
      definitionVersion: snapshot.definitionVersion,
      sqlGenerated: true,
      limit: 500,
      complete: body.chart === 'number',
    };
  }
  async save(body: any, actor: number) {
    // UC051 bypass guard: a new dashboard minted from a source stays source-owner only, even for
    // an edit grantee, so a granted read/edit cannot turn a foreign source into an artifact the
    // actor then owns with default publish/export rights. Explore and metric/metadata edits are
    // the only granted source capabilities in this slice.
    await this.access.assert('database', body?.sourceId, actor);
    const { draft, snapshot } = await this.prepare(body, actor);
    return (await this.dashboards.save({ draft }, actor, snapshot)).data;
  }
  private async editorState(id: unknown, actor: number) {
    await this.access.assert('dashboard', id, actor);
    const dashboardId = this.access.id(id);
    const analysis = (await this.dashboards.analysis(dashboardId, actor, true)).data;
    const profile = await this.profile(analysis.databaseId, actor);
    if (!profile.supported)
      throw new BadRequestException('서버에 저장한 DuckDB 파일 대시보드를 선택해 주세요.');
    const metrics = await this.metrics(profile.sourceId, actor);
    const row = await this.db.getRepository(Dashboard).findOne({ where: { id: dashboardId } });
    const snapshot = row.structuredDefinition ? JSON.parse(row.structuredDefinition) : null;
    const definitions =
      snapshot?.schemaVersion === 2 && snapshot.kind === 'structured-bi-dashboard'
        ? snapshot.items
        : snapshot?.schemaVersion === 1 && snapshot.kind === 'structured-bi'
        ? [snapshot]
        : [];
    const layout = row.layout ? JSON.parse(row.layout) : [];
    const items = analysis.widgets.map((widget, index) => {
      const stored = definitions?.[index];
      const metricAvailable = !!stored?.metricId && metrics.some(m => m.id === stored.metricId);
      const chart =
        widget.type === 'BOARD_NUMERIC' ? 'number' : widget.type === 'CHART_LINE' ? 'line' : 'bar';
      const sizes = analysis.layoutSizes?.[index];
      return {
        key: widget.blockId || stored?.key || `existing-${index}`,
        kind: metricAvailable ? 'metric' : 'existing',
        title: widget.title,
        ...(stored?.metricId ? { metricId: stored.metricId, metricAvailable } : {}),
        chart,
        dimension: stored?.dimension,
        unit: (widget.suffix || '').trim(),
        decimalPlaces: widget.decimalPlaces ?? 0,
        numberNotation: widget.numberNotation === 'compact' ? 'compact' : 'plain',
        width: sizes?.width ?? (layout[index]?.w === 6 ? 6 : 12),
        savedDefinition: widget,
        height:
          sizes?.height ??
          ([3, 5, 7].includes(layout[index]?.h) ? layout[index].h : chart === 'number' ? 3 : 5),
        ...(analysis.responsiveLayouts
          ? {
              layouts: Object.fromEntries(
                Object.entries(analysis.responsiveLayouts).map(([name, values]: [string, any]) => [
                  name,
                  values[widget.blockId],
                ]),
              ),
            }
          : {}),
      };
    });
    return {
      dashboardId,
      title: analysis.title,
      sourceId: profile.sourceId,
      revision: analysis.revision,
      profile,
      metrics,
      items,
      analysis,
      definitions,
    };
  }
  async editor(id: unknown, actor: number) {
    const state = await this.editorState(id, actor);
    return {
      dashboardId: state.dashboardId,
      title: state.title,
      sourceId: state.sourceId,
      revision: state.revision,
      profile: state.profile,
      metrics: state.metrics,
      items: state.items,
    };
  }
  private async compileEditor(id: unknown, body: any, actor: number) {
    const state = await this.editorState(id, actor);
    if (typeof body?.expectedRevision !== 'string' || !/^[a-f0-9]{64}$/.test(body.expectedRevision))
      throw new BadRequestException('대시보드를 다시 불러와 주세요.');
    if (state.revision !== body.expectedRevision)
      throw new ConflictException(
        '대시보드가 다른 화면에서 변경되었습니다. 작성 중인 내용을 확인하고 다시 불러와 주세요.',
      );
    if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 6)
      throw new BadRequestException('차트는 1~6개까지 저장할 수 있습니다.');
    const title = this.text(body.title, 300);
    const keys = new Set<string>();
    const widgets = [];
    const snapshots = [];
    const layoutSizes = [];
    const preserveSizeIds: string[] = [];
    for (const item of body.items) {
      if (
        !item ||
        typeof item.key !== 'string' ||
        !/^[a-zA-Z0-9_-]{1,128}$/.test(item.key) ||
        keys.has(item.key)
      )
        throw new BadRequestException('차트 식별자를 확인해 주세요.');
      keys.add(item.key);
      if (item.layouts !== undefined) validateBlockLayouts(item.layouts);
      const originalIndex = state.items.findIndex(original => original.key === item.key);
      const originalItem = state.items[originalIndex];
      if (originalItem && item.width === originalItem.width && item.height === originalItem.height)
        preserveSizeIds.push(state.analysis.widgets[originalIndex].blockId);
      if (
        item.copyOf !== undefined &&
        (item.kind !== 'existing' ||
          typeof item.copyOf !== 'string' ||
          item.copyOf === item.key ||
          state.items.some(original => original.key === item.key) ||
          !state.items.some(original => original.key === item.copyOf))
      )
        throw new BadRequestException('복제할 기존 차트를 확인해 주세요.');
      if (![6, 12].includes(item.width) || ![3, 5, 7].includes(item.height))
        throw new BadRequestException('차트 크기를 확인해 주세요.');
      if (
        typeof item.unit !== 'string' ||
        item.unit.length > 12 ||
        !Number.isInteger(item.decimalPlaces) ||
        item.decimalPlaces < 0 ||
        item.decimalPlaces > 6 ||
        !['plain', 'compact'].includes(item.numberNotation)
      )
        throw new BadRequestException('차트 표시 형식을 확인해 주세요.');
      let widget;
      let snapshot;
      if (item.kind === 'metric') {
        const prepared = await this.prepare(
          {
            sourceId: state.sourceId,
            metricId: item.metricId,
            chart: item.chart,
            dimension: item.dimension,
            title: item.title,
          },
          actor,
        );
        widget = prepared.draft.widgets[0];
        snapshot = prepared.snapshot;
      } else if (item.kind === 'existing') {
        const index = state.items.findIndex(original => original.key === (item.copyOf ?? item.key));
        const original = state.items[index];
        if (!original || item.chart !== original.chart || item.dimension !== original.dimension)
          throw new BadRequestException(
            '기존 SQL 차트의 표현을 바꾸려면 저장 지표를 선택해 주세요.',
          );
        widget = { ...state.analysis.widgets[index], title: this.text(item.title, 300) };
        snapshot = state.definitions?.[index] || {};
      } else if (item.kind === 'draft') {
        const validated = validateDraft({
          databaseId: state.sourceId,
          title,
          explanation: '',
          widgets: [item.definition],
        }).widgets[0];
        const chart =
          validated.type === 'BOARD_NUMERIC'
            ? 'number'
            : validated.type === 'CHART_LINE'
            ? 'line'
            : 'bar';
        if (item.chart !== chart) throw new BadRequestException('AI 차트 종류를 확인해 주세요.');
        widget = { ...validated, title: this.text(item.title, 300) };
        snapshot =
          originalIndex >= 0 && validated.sql === state.analysis.widgets[originalIndex].sql
            ? state.definitions?.[originalIndex] || {}
            : {};
      } else throw new BadRequestException('차트 종류를 확인해 주세요.');
      widget = {
        ...widget,
        ...(state.items.some(original => original.key === item.key)
          ? {
              blockId:
                state.analysis.widgets[state.items.findIndex(original => original.key === item.key)]
                  .blockId,
            }
          : { blockId: undefined }),
        decimalPlaces: item.decimalPlaces,
        suffix: item.unit ? ' ' + item.unit : '',
        numberNotation: item.numberNotation === 'plain' ? 'full' : 'compact',
      };
      widgets.push(widget);
      layoutSizes.push({ width: item.width, height: item.height });
      snapshots.push({
        ...snapshot,
        key: item.key,
        chart: item.chart,
        dimension: item.dimension,
        presentation: {
          unit: item.unit,
          decimalPlaces: item.decimalPlaces,
          numberNotation: item.numberNotation,
        },
      });
    }
    const draft = validateDraft({
      databaseId: state.sourceId,
      title,
      explanation: state.analysis.explanation,
      widgets,
      layoutSizes,
    });
    const snapshot = {
      schemaVersion: 2,
      kind: 'structured-bi-dashboard',
      sourceId: state.sourceId,
      dataVersion: state.profile.dataVersion,
      items: snapshots,
    };
    let bottom = Math.max(
      0,
      ...Object.values(state.analysis.blockLayouts || {}).map((g: any) => g.y + g.h),
    );
    const desktop = body.items.map(item => {
      const previous = state.analysis.blockLayouts?.[item.key];
      if (previous) return previous;
      const rect = { x: 0, y: bottom, w: item.width, h: item.height };
      bottom += rect.h;
      return rect;
    });
    const layouts = responsiveLayouts(
      body.items.map(item => item.key),
      desktop,
      state.analysis.responsiveLayouts,
      body.items.map(item => item.layouts),
    );
    return {
      draft,
      snapshot,
      dashboardId: state.dashboardId,
      expectedRevision: body.expectedRevision,
      preserveSizeIds,
      layoutEdits: body.items.map(item => item.layouts),
      layouts,
    };
  }
  async editorPreview(id: unknown, body: any, actor: number) {
    const { draft, layouts } = await this.compileEditor(id, body, actor);
    return {
      ...(await this.dashboards.preview({ draft, includeTrends: true }, actor)).data,
      responsiveLayouts: layouts,
    };
  }
  async editorAi(
    id: unknown,
    body: any,
    actor: number,
    signal?: AbortSignal,
  ): Promise<EditorAiResponse> {
    // UC-014: ownership, revision and the whole-draft compile always run before any provider call.
    const compiled = await this.compileEditor(id, body, actor);
    if (typeof body.prompt !== 'string' || !body.prompt.trim() || body.prompt.length > 2000)
      throw new BadRequestException('변경 요청을 확인해 주세요.');
    if (body.editMode !== undefined && !['auto', 'content', 'layout'].includes(body.editMode))
      throw new BadRequestException('AI 변경 목적을 확인해 주세요.');
    const selection = body.selectedKey;
    // An empty selection means "no target"; any other defined value must be a known block key.
    if (selection !== undefined && selection !== null && typeof selection !== 'string')
      throw new BadRequestException('수정할 블록을 선택해 주세요.');
    const hasSelection = typeof selection === 'string' && selection.length > 0;
    let index = hasSelection ? body.items.findIndex(item => item.key === selection) : -1;
    if (hasSelection && index < 0) throw new BadRequestException('수정할 블록을 선택해 주세요.');
    // UC-015: a confirmation key is a hint only; an unknown or mistyped key never reaches a provider.
    const choice = body.targetChoiceKey;
    if (choice !== undefined && choice !== null && typeof choice !== 'string')
      throw new BadRequestException('선택할 블록 후보를 확인해 주세요.');
    const hasChoice = typeof choice === 'string' && choice.length > 0;
    if (hasChoice && !body.items.some(item => item.key === choice))
      throw new BadRequestException('선택할 블록 후보를 확인해 주세요.');
    const requestedMode: 'auto' | 'content' | 'layout' = body.editMode ?? 'content';
    // A question without a target can only become an explicit save or a clarification.
    if (!hasSelection && requestedMode !== 'auto')
      throw new BadRequestException('수정할 블록을 선택해 주세요.');
    let editMode: 'content' | 'layout' = requestedMode === 'auto' ? 'content' : requestedMode;
    let prompt: string = body.prompt;
    let saveRequested = false;
    let publicationRequested = false;
    let targetKey: string | null = hasSelection ? (selection as string) : null;
    if (requestedMode === 'auto') {
      if (!Object.prototype.hasOwnProperty.call(layoutColumns, body.layoutMode))
        throw new BadRequestException('편집할 화면 폭을 확인해 주세요.');
      const plan = await this.dashboards.classifyBlockIntent(body.prompt, signal);
      if (signal?.aborted) throw new Error('LLM_REQUEST_ABORTED');
      if (plan.intent === 'clarify') return { editMode: 'clarify' as const, saveRequested: false };
      if (plan.intent === 'save') {
        // Explicit save: preview the current draft only. Persisting stays with the existing save API.
        const preview = (
          await this.dashboards.preview({ draft: compiled.draft, includeTrends: true }, actor)
        ).data;
        if (signal?.aborted) throw new Error('LLM_REQUEST_ABORTED');
        return {
          editMode: 'save' as const,
          saveRequested: true,
          preview: { ...preview, responsiveLayouts: compiled.layouts },
          ...(plan.publicationRequested === true ? { publicationRequested: true as const } : {}),
        };
      }
      // UC-016: a bounded batch resolves every target before one sequential staged generation.
      if (plan.intent === 'batch') return this.batchBlocks(id, body, actor, signal, compiled, plan);
      // UC-015: the original question selects the target; the previous selection is context only.
      const resolution = resolveBlockTarget({
        prompt: body.prompt,
        items: body.items.map(item => ({ key: item.key, title: item.title })),
        selectedKey: hasSelection ? selection : null,
        targetChoiceKey: hasChoice ? choice : null,
      });
      if (resolution.kind === 'ambiguous')
        return {
          editMode: 'clarify' as const,
          saveRequested: false,
          targetCandidates: resolution.candidates,
        };
      targetKey = resolution.key;
      index = body.items.findIndex(item => item.key === resolution.key);
      editMode = plan.intent;
      prompt = plan.editPrompt;
      saveRequested = plan.saveRequested;
      publicationRequested = plan.publicationRequested === true;
    }
    if (!targetKey || index < 0) throw new BadRequestException('수정할 블록을 선택해 주세요.');
    if (editMode === 'layout') {
      if (!Object.prototype.hasOwnProperty.call(layoutColumns, body.layoutMode))
        throw new BadRequestException('편집할 화면 폭을 확인해 주세요.');
      const layoutMode = body.layoutMode as LayoutSize;
      const rect = await this.dashboards.proposeBlockLayout(
        {
          selectedKey: targetKey,
          mode: layoutMode,
          blocks: body.items.map(item => ({
            key: item.key,
            title: item.title,
            rect: compiled.layouts[layoutMode][item.key],
          })),
          prompt,
        },
        signal,
      );
      if (signal?.aborted) throw new Error('LLM_REQUEST_ABORTED');
      const item = {
        ...body.items[index],
        layouts: { ...body.items[index].layouts, [layoutMode]: rect },
      };
      const next = await this.compileEditor(
        id,
        { ...body, items: body.items.map((original, i) => (i === index ? item : original)) },
        actor,
      );
      const preview = (
        await this.dashboards.preview({ draft: next.draft, includeTrends: true }, actor)
      ).data;
      if (signal?.aborted) throw new Error('LLM_REQUEST_ABORTED');
      return {
        item,
        editMode: 'layout' as const,
        saveRequested,
        targetKey,
        preview: { ...preview, responsiveLayouts: next.layouts },
        ...(publicationRequested ? { publicationRequested: true as const } : {}),
      };
    }
    const result = await this.dashboards.generate(
      {
        dashboardId: compiled.dashboardId,
        databaseId: compiled.draft.databaseId,
        currentDraft: compiled.draft,
        selectedWidget: index,
        requireSelectedChange: true,
        renameOnly: /(?:제목|이름)\s*만/.test(body.prompt),
        prompt,
      },
      actor,
      signal,
    );
    if (result.status !== 'SUCCESS' || !('data' in result))
      throw new BadRequestException(
        'AI 변경을 적용하지 못했습니다. 초안은 유지됩니다. 다시 요청해 주세요.',
      );
    const generated = validateDraft(result.data);
    const widget = generated.widgets[index];
    if (!widget) throw new BadRequestException('AI 변경 결과를 확인해 주세요.');
    const item = {
      ...body.items[index],
      kind: 'draft',
      copyOf: undefined,
      title: widget.title,
      chart:
        widget.type === 'BOARD_NUMERIC' ? 'number' : widget.type === 'CHART_LINE' ? 'line' : 'bar',
      unit: (widget.suffix || '').trim(),
      decimalPlaces: widget.decimalPlaces ?? 0,
      numberNotation: widget.numberNotation === 'compact' ? 'compact' : 'plain',
      definition: widget,
    };
    if (signal?.aborted) throw new Error('LLM_REQUEST_ABORTED');
    // Recompile only the selected replacement. Recheck revision and all presentation constraints.
    const next = await this.compileEditor(
      id,
      {
        ...body,
        items: body.items.map((original, i) => (i === index ? item : original)),
      },
      actor,
    );
    const preview = (
      await this.dashboards.preview({ draft: next.draft, includeTrends: true }, actor)
    ).data;
    if (signal?.aborted) throw new Error('LLM_REQUEST_ABORTED');
    return {
      item,
      editMode: 'content' as const,
      saveRequested,
      targetKey,
      preview: { ...preview, responsiveLayouts: next.layouts },
      ...(publicationRequested ? { publicationRequested: true as const } : {}),
    };
  }
  async saveEditor(id: unknown, body: any, actor: number) {
    const { draft, snapshot, dashboardId, expectedRevision, preserveSizeIds, layoutEdits } =
      await this.compileEditor(id, body, actor);
    return (
      await this.dashboards.save(
        { draft, dashboardId, expectedRevision },
        actor,
        snapshot,
        undefined,
        undefined,
        false,
        preserveSizeIds,
        layoutEdits,
      )
    ).data;
  }

  /**
   * A structured failure the screen can act on: stage, plus the 1-based position
   * of the block in the current items when the target is known. `message` is
   * sanitized: provider and SQL errors never leave the server (BR-016-04).
   */
  private batchFailure(stage: BatchFailureStage, position?: number) {
    return new BadRequestException({
      batchFailure: { stage, ...(position === undefined ? {} : { position }) },
      message: BATCH_FAILURE_MESSAGES[stage],
    });
  }

  /**
   * UC-016 bounded batch. Every target is resolved deterministically against the
   * question before any provider call, each change is generated, compiled and
   * merged into a request-local staged item list, and one whole preview is
   * returned. Nothing is written; saving stays with the existing save API.
   */
  private async batchBlocks(
    id: unknown,
    body: any,
    actor: number,
    signal: AbortSignal | undefined,
    compiled: { dashboardId: number; draft: any; layouts: any },
    plan: BatchEditPlan,
  ) {
    const layoutMode = body.layoutMode as LayoutSize;
    const actions: BatchBlockAction[] = plan.actions;
    const items: any[] = body.items.map((item: any) => ({ ...item }));
    const targets: {
      key: string;
      index: number;
      position: number;
      editMode: 'content' | 'layout';
      prompt: string;
    }[] = [];
    const seen = new Set<string>();
    if (actions.length < MIN_BATCH_ACTIONS || actions.length > MAX_BATCH_ACTIONS)
      throw this.batchFailure('target');
    for (const action of actions) {
      // BR-016-01: the reference must be a literal span of the original question.
      if (!body.prompt.includes(action.targetPrompt)) throw this.batchFailure('target');
      const resolution = resolveBlockTarget({
        prompt: action.targetPrompt,
        items: items.map(item => ({ key: item.key, title: item.title })),
        selectedKey: null,
        targetChoiceKey: null,
      });
      if (resolution.kind !== 'resolved') throw this.batchFailure('target');
      const index = items.findIndex(item => item.key === resolution.key);
      if (index < 0) throw this.batchFailure('target');
      // A duplicate block is a known block: report its 1-based current position.
      if (seen.has(resolution.key)) throw this.batchFailure('target', index + 1);
      seen.add(resolution.key);
      targets.push({
        key: resolution.key,
        index,
        position: index + 1,
        editMode: action.editMode,
        prompt: action.editPrompt,
      });
    }
    let current = compiled;
    const changes: { targetKey: string; editMode: 'content' | 'layout'; item: any }[] = [];
    for (const target of targets) {
      try {
        if (target.editMode === 'layout') {
          const rect = await this.dashboards.proposeBlockLayout(
            {
              selectedKey: target.key,
              mode: layoutMode,
              blocks: items.map(item => ({
                key: item.key,
                title: item.title,
                rect: current.layouts[layoutMode][item.key],
              })),
              prompt: target.prompt,
            },
            signal,
          );
          if (signal?.aborted) throw new Error('LLM_REQUEST_ABORTED');
          items[target.index] = {
            ...items[target.index],
            layouts: { ...items[target.index].layouts, [layoutMode]: rect },
          };
        } else {
          const result = await this.dashboards.generate(
            {
              dashboardId: current.dashboardId,
              databaseId: current.draft.databaseId,
              currentDraft: current.draft,
              selectedWidget: target.index,
              prompt: target.prompt,
            },
            actor,
            signal,
          );
          if (result.status !== 'SUCCESS' || !('data' in result))
            throw new Error('BATCH_GENERATION_UNAVAILABLE');
          const generated = validateDraft(result.data);
          const generatedWidget = generated.widgets[target.index];
          if (!generatedWidget) throw new Error('BATCH_GENERATION_UNAVAILABLE');
          // BR-016-02: formatting-only requests must not silently rename copied KPIs.
          // The action prompt excludes the target reference; names in a title are data.
          const rename = explicitRenameRequested(target.prompt);
          const widget = {
            ...generatedWidget,
            title: rename ? generatedWidget.title : items[target.index].title,
          };
          items[target.index] = {
            ...items[target.index],
            kind: 'draft',
            copyOf: undefined,
            title: widget.title,
            chart:
              widget.type === 'BOARD_NUMERIC'
                ? 'number'
                : widget.type === 'CHART_LINE'
                ? 'line'
                : 'bar',
            unit: (widget.suffix || '').trim(),
            decimalPlaces: widget.decimalPlaces ?? 0,
            numberNotation: widget.numberNotation === 'compact' ? 'compact' : 'plain',
            definition: widget,
          };
        }
        if (signal?.aborted) throw new Error('LLM_REQUEST_ABORTED');
        // Recheck ownership, revision, definitions and layout bounds on the staged draft.
        current = await this.compileEditor(id, { ...body, items }, actor);
        changes.push({
          targetKey: target.key,
          editMode: target.editMode,
          item: items[target.index],
        });
      } catch (error) {
        if (signal?.aborted) throw new Error('LLM_REQUEST_ABORTED');
        if (isBatchControlError(error)) throw error;
        throw this.batchFailure('change', target.position);
      }
    }
    let preview;
    try {
      preview = (
        await this.dashboards.preview({ draft: current.draft, includeTrends: true }, actor)
      ).data;
      if (signal?.aborted) throw new Error('LLM_REQUEST_ABORTED');
    } catch (error) {
      if (signal?.aborted) throw new Error('LLM_REQUEST_ABORTED');
      if (isBatchControlError(error)) throw error;
      throw this.batchFailure('preview');
    }
    return {
      editMode: 'batch' as const,
      saveRequested: plan.saveRequested,
      changes,
      preview: { ...preview, responsiveLayouts: current.layouts },
      ...(plan.publicationRequested === true ? { publicationRequested: true as const } : {}),
    };
  }
}
