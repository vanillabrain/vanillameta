import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { randomUUID } from 'crypto';
import { dimensionDefinition } from './semantic-proposal';
import { Database } from '../database/entities/database.entity';
import { Metric } from '../metric/entities/metric.entity';
import { Dashboard } from '../dashboard/entities/dashboard.entity';
import { SourceAccessService } from '../ownership/source-access.service';
import { ConnectionService } from '../connection/connection.service';
import { AiDashboardService } from '../ai/ai-dashboard.service';
import { sourceRevision } from './source-revision';
import { compileMetricWidget } from './structured-widget';
import { metricFields } from './metric-expression';
import { quoteColumn, sourceQuery, validateDraft } from '../ai/dashboard-draft';
import {
  validateBlockLayouts,
  responsiveLayouts,
  layoutColumns,
  LayoutSize,
} from '../ai/responsive-layout';

@Injectable()
export class BiService {
  private profiles = new Map<number, { version: string; data: any }>();
  constructor(
    private readonly db: DataSource,
    private readonly access: SourceAccessService,
    private readonly connection: ConnectionService,
    private readonly dashboards: AiDashboardService,
  ) {}
  async sources(actor: number) {
    const rows = await this.db
      .getRepository(Database)
      .find({ where: { ownerId: this.access.actor(actor) } });
    return rows.map(({ id, name, engine }) => ({ id, name, engine }));
  }
  async profile(id: unknown, actor: number) {
    await this.access.assert('database', id, actor);
    const sourceId = this.access.id(id);
    const source = await this.db.getRepository(Database).findOne({ where: { id: sourceId } });
    if (source.engine !== 'duckdb') return this.profileSnapshot(id, actor);
    return this.connection.withDuckDBSnapshot(sourceId, () => this.profileSnapshot(id, actor));
  }
  private async profileSnapshot(id: unknown, actor: number) {
    await this.access.assert('database', id, actor);
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
    if (!schema.length || schema.length > 128)
      throw new BadRequestException('지원 컬럼 수는 1~128개입니다.');
    const columns = schema.map(row => ({
      name: row.column_name,
      type: row.column_type,
      numeric: /^(U?BIGINT|U?INTEGER|U?SMALLINT|U?TINYINT|HUGEINT|FLOAT|DOUBLE|DECIMAL)/i.test(
        row.column_type,
      ),
      temporal: /^(DATE|TIMESTAMP)/i.test(row.column_type),
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
    const repo = this.db.getRepository(Metric);
    const row = await repo.save(
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
    return { id: row.id, label, definitionVersion: 1, definition };
  }
  async metrics(sourceId: unknown, actor: number) {
    await this.access.assert('database', sourceId, actor);
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
    await this.access.assert('metric', body?.metricId, actor);
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
    await this.access.assert('database', body?.sourceId, actor);
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
  async editorAi(id: unknown, body: any, actor: number, signal?: AbortSignal) {
    const compiled = await this.compileEditor(id, body, actor);
    const index = body.items.findIndex(item => item.key === body.selectedKey);
    if (index < 0) throw new BadRequestException('수정할 블록을 선택해 주세요.');
    if (typeof body.prompt !== 'string' || !body.prompt.trim() || body.prompt.length > 2000)
      throw new BadRequestException('변경 요청을 확인해 주세요.');
    if (body.editMode !== undefined && !['auto', 'content', 'layout'].includes(body.editMode))
      throw new BadRequestException('AI 변경 목적을 확인해 주세요.');
    let editMode = body.editMode ?? 'content';
    if (editMode === 'auto') {
      if (!Object.prototype.hasOwnProperty.call(layoutColumns, body.layoutMode))
        throw new BadRequestException('편집할 화면 폭을 확인해 주세요.');
      editMode = await this.dashboards.classifyBlockIntent(body.prompt, signal);
      if (signal?.aborted) throw new Error('LLM_REQUEST_ABORTED');
      if (editMode === 'clarify') return { editMode: 'clarify' as const };
    }
    if (editMode === 'layout') {
      if (!Object.prototype.hasOwnProperty.call(layoutColumns, body.layoutMode))
        throw new BadRequestException('편집할 화면 폭을 확인해 주세요.');
      const mode = body.layoutMode as LayoutSize;
      const rect = await this.dashboards.proposeBlockLayout(
        {
          selectedKey: body.selectedKey,
          mode,
          blocks: body.items.map(item => ({
            key: item.key,
            title: item.title,
            rect: compiled.layouts[mode][item.key],
          })),
          prompt: body.prompt,
        },
        signal,
      );
      if (signal?.aborted) throw new Error('LLM_REQUEST_ABORTED');
      const item = {
        ...body.items[index],
        layouts: { ...body.items[index].layouts, [mode]: rect },
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
      return { item, editMode: 'layout', preview: { ...preview, responsiveLayouts: next.layouts } };
    }
    const result = await this.dashboards.generate(
      {
        dashboardId: compiled.dashboardId,
        databaseId: compiled.draft.databaseId,
        currentDraft: compiled.draft,
        selectedWidget: index,
        prompt: body.prompt,
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
    return {
      item,
      editMode: 'content' as const,
      preview: { ...preview, responsiveLayouts: next.layouts },
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
}
