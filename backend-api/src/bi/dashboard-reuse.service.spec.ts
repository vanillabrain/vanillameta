jest.mock('../connection/connection.service', () => ({ ConnectionService: class {} }));
jest.mock('../ai/ai.service', () => ({ AiService: class {} }));
import { DataSource } from 'typeorm';
import { createHash, randomUUID } from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DatasetType } from '../common/enum/dataset-type.enum';
import { Component } from '../component/entities/component.entity';
import { Dashboard } from '../dashboard/entities/dashboard.entity';
import { DashboardPublication } from '../dashboard/entities/dashboard-publication.entity';
import { DashboardShare } from '../dashboard/entities/dashboard_share.entity';
import { DashboardWidget } from '../dashboard/dashboard-widget/entities/dashboard-widget.entity';
import { Database } from '../database/entities/database.entity';
import { Dataset } from '../dataset/entities/dataset.entity';
import { Metric } from '../metric/entities/metric.entity';
import { SourceAccessService } from '../ownership/source-access.service';
import { UserMapping } from '../user/entities/user-mapping.entity';
import { Widget } from '../widget/entities/widget.entity';
import { sourceQuery } from '../ai/dashboard-draft';
import { AiDashboardService } from '../ai/ai-dashboard.service';
import { dashboardRevision } from '../dashboard/dashboard-revision';
import { AnalysisCreationReceipt } from './analysis-creation-receipt.entity';
import { DashboardReuseService } from './dashboard-reuse.service';
import { sourceRevision } from './source-revision';
import { StudioState } from '../dashboard-studio/entities/studio-state.entity';
import { importStudio } from '../dashboard-studio/studio-legacy';
import { canonicalMetricSql } from '../dashboard-studio/studio-remix-template';
import type { BiService } from './bi.service';

const ACTOR = 10;
const ENTITIES = [
  StudioState,
  Database,
  Metric,
  Dashboard,
  DashboardShare,
  DashboardPublication,
  DashboardWidget,
  UserMapping,
  Dataset,
  Widget,
  Component,
  AnalysisCreationReceipt,
];
const COLUMNS = [
  { name: 'amount', type: 'DOUBLE', numeric: true, temporal: false, nullCount: '0' },
  { name: 'os', type: 'VARCHAR', numeric: false, temporal: false, nullCount: '0' },
];
const WIDGETS = [
  {
    blockId: 'orig-sales',
    title: '총 매출',
    description: '',
    type: 'BOARD_NUMERIC',
    sql: 'SELECT SUM(amount) AS value FROM source',
    valueField: 'value',
  },
  {
    blockId: 'orig-os',
    title: 'OS별 매출',
    description: '',
    type: 'CHART_COLUMN',
    sql: 'SELECT os AS category, SUM(amount) AS value FROM source GROUP BY os',
    valueField: 'value',
    categoryField: 'category',
  },
];
const RECTS = {
  mobile: [
    { x: 0, y: 0, w: 4, h: 2 },
    { x: 0, y: 2, w: 4, h: 5 },
  ],
  tablet: [
    { x: 0, y: 0, w: 6, h: 2 },
    { x: 0, y: 2, w: 8, h: 5 },
  ],
  desktop: [
    { x: 0, y: 0, w: 6, h: 2 },
    { x: 0, y: 2, w: 12, h: 5 },
  ],
};
const fileConfig = (version: string) =>
  JSON.stringify({ client: 'duckdb', connection: { filename: `/immutable/${version}.duckdb` } });
// remapDashboard rejects an incomplete map, so every reused column is named explicitly.
const COLUMN_MAP = { amount: 'amount', os: 'os' };

describe('UC020 dashboard reuse SQLite atomic save', () => {
  let db: DataSource;
  let second: DataSource;
  let dir: string;
  let service: DashboardReuseService;
  let bi: any;
  let originalId: number;
  let targetId: number;
  let widgetIds: number[];
  let duringSave: (() => Promise<void>) | null;

  const counts = () => Promise.all(ENTITIES.map(entity => db.getRepository(entity).count()));
  // Order by primary columns from metadata: DashboardPublication keys on dashboardId, not id.
  const rows = (entity: any) => {
    const repository = db.getRepository(entity);
    const order = Object.fromEntries(
      repository.metadata.primaryColumns.map(column => [column.propertyName, 'ASC']),
    );
    return repository.find({ order } as any);
  };

  const seed = async (source: DataSource) => {
    const originalSource = await source.getRepository(Database).save({
      id: 1,
      ownerId: ACTOR,
      name: '원본 소스',
      type: 'file',
      engine: 'duckdb',
      connectionConfig: fileConfig('source1'),
    });
    const nextSource = await source.getRepository(Database).save({
      id: 2,
      ownerId: ACTOR,
      name: '대상 소스',
      type: 'file',
      engine: 'duckdb',
      connectionConfig: fileConfig('source2'),
    });
    const components: Record<string, number> = {};
    for (const type of ['BOARD_NUMERIC', 'CHART_COLUMN']) {
      const component = await source
        .getRepository(Component)
        .save({ type, title: type, option: '{}', useYn: 'Y' });
      components[type] = component.id;
    }
    const share = await source
      .getRepository(DashboardShare)
      .save({ uuid: randomUUID(), shareYn: 'N' });
    widgetIds = [];
    for (const definition of WIDGETS) {
      const dataset = await source.getRepository(Dataset).save({
        title: definition.title,
        databaseId: originalSource.id,
        query: `WITH source AS (SELECT * FROM uploaded_data) ${definition.sql}`,
      });
      const widget = await source.getRepository(Widget).save({
        title: definition.title,
        description: '',
        componentId: components[definition.type],
        datasetType: DatasetType.DATASET,
        datasetId: dataset.id,
        option: JSON.stringify({ content: { field: definition.valueField } }),
        delYn: 'N',
      });
      widgetIds.push(widget.id);
    }
    const dashboard = await source.getRepository(Dashboard).save({
      title: '원본 분석',
      shareId: share.id,
      delYn: 'N',
      structuredDefinition: JSON.stringify({ items: [] }),
      analysisDefinition: JSON.stringify({
        databaseId: originalSource.id,
        title: '원본 분석',
        explanation: '전체 기간 · 필터 없음',
        widgets: WIDGETS,
        responsiveLayouts: Object.fromEntries(
          Object.entries(RECTS).map(([size, rects]) => [
            size,
            Object.fromEntries(WIDGETS.map((widget, index) => [widget.blockId, rects[index]])),
          ]),
        ),
      }),
      layout: JSON.stringify(
        widgetIds.map((id, index) => ({ i: String(id), ...RECTS.desktop[index] })),
      ),
    });
    await source.getRepository(UserMapping).save({ dashboardId: dashboard.id, userInfoId: ACTOR });
    await source
      .getRepository(DashboardWidget)
      .save(widgetIds.map(widgetId => ({ dashboardId: dashboard.id, widgetId })));
    await source.getRepository(DashboardPublication).save({
      dashboardId: dashboard.id,
      uuid: randomUUID(),
      version: 3,
      dashboardRevision: 'a'.repeat(64),
      snapshot: JSON.stringify({ schemaVersion: 1 }),
      publishedAt: new Date(Date.now()).toISOString(),
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      active: true,
      requestId: randomUUID(),
      payloadDigest: 'b'.repeat(64),
    });
    return { originalSource, nextSource };
  };

  const profileOf = async (id: number, actor: number) => {
    const row = await db.getRepository(Database).findOneBy({ id: Number(id) });
    if (!row || row.ownerId !== actor) throw new Error('data access denied');
    const filename = JSON.parse(row.connectionConfig).connection.filename;
    return {
      sourceId: row.id,
      name: row.name,
      engine: row.engine,
      supported: true,
      status: 'ready',
      rowCount: '2000',
      preview: [],
      columns: COLUMNS,
      dataVersion: sourceRevision(row, createHash('sha256').update(filename).digest('hex')),
    };
  };

  const build = (source: DataSource) => {
    const dashboards = new AiDashboardService(
      {} as any,
      {} as any,
      source.getRepository(Dashboard),
    );
    jest.spyOn(dashboards, 'preview').mockImplementation(async (body: any) => {
      if (duringSave) {
        const hook = duringSave;
        duringSave = null;
        await hook();
      }
      return {
        status: 'SUCCESS',
        data: {
          draft: body.draft,
          widgets: body.draft.widgets,
          queries: body.draft.widgets.map((widget, widgetIndex) => ({
            widgetIndex,
            kind: 'widget',
            ...sourceQuery(
              widget.sql,
              COLUMNS.map(c => c.name),
              body.filters,
              body.dateRange,
              [],
              COLUMNS.filter(c => c.numeric).map(c => c.name),
              body.conditions?.definition,
              COLUMNS,
              body.conditions?.semantics,
            ),
          })),
        },
      } as any;
    });
    return new DashboardReuseService(
      source,
      bi as BiService,
      dashboards,
      {
        withDuckDBSnapshot: (_id: number, run: any) => run(),
        queryDuckDB: async () => ({
          datas: COLUMNS.map(c => ({ column_name: c.name, column_type: c.type })),
        }),
        duckDBVersion: async () => 'target-file',
      } as any,
      new SourceAccessService(source),
    );
  };

  const flow = async (actor = ACTOR) => {
    const draft = await service.draft(originalId, actor);
    const preview = await service.preview(
      originalId,
      {
        expectedRevision: draft.expectedRevision,
        sourceId: targetId,
        sourceRevision: (await profileOf(targetId, actor)).dataVersion,
        title: '복사본 제목',
        unitConfirmation: 'same-unit',
        columnMap: COLUMN_MAP,
      },
      actor,
    );
    return { draft, preview, ticket: preview.ticket };
  };

  beforeEach(async () => {
    duringSave = null;
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vm-reuse-'));
    db = await new DataSource({
      type: 'sqlite',
      database: path.join(dir, 'metadata.db'),
      entities: ENTITIES,
      synchronize: true,
    }).initialize();
    await seed(db);
    originalId = 1;
    targetId = 2;
    bi = {
      profile: jest.fn(async (id: number, actor: number) => profileOf(id, actor)),
      sources: jest.fn(async (actor: number) =>
        (await db.getRepository(Database).find({ where: { ownerId: actor } })).map(
          ({ id, name, engine }) => ({ id, name, engine }),
        ),
      ),
    };
    service = build(db);
  });

  afterEach(async () => {
    if (second?.isInitialized) await second.destroy();
    if (db?.isInitialized) await db.destroy();
    fs.rmSync(dir, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  it('UC024 advertises per-block required columns without SQL', async () => {
    const draft = await service.draft(originalId, ACTOR);
    expect(draft).toHaveProperty('blocks', [
      { id: 'orig-sales', title: '총 매출', columns: ['amount'] },
      { id: 'orig-os', title: 'OS별 매출', columns: ['os', 'amount'] },
    ]);
  });

  it('UC024 excludes the block needing a missing field, saves only selected geometry, and preserves the original', async () => {
    const row = await db.getRepository(Dashboard).findOneBy({ id: originalId });
    const input = JSON.parse(row.analysisDefinition);
    input.layoutSizes = [
      { width: 6, height: 3 },
      { width: 12, height: 5 },
    ];
    await db
      .getRepository(Dashboard)
      .update(originalId, { analysisDefinition: JSON.stringify(input) });
    const original = await rows(Dashboard);
    bi.profile.mockImplementation(async (id, actor) => ({
      ...(await profileOf(id, actor)),
      columns: id === targetId ? COLUMNS.filter(c => c.name !== 'os') : COLUMNS,
    }));
    const draft = await service.draft(originalId, ACTOR);
    const preview = await service.preview(
      originalId,
      {
        expectedRevision: draft.expectedRevision,
        sourceId: targetId,
        sourceRevision: (await profileOf(targetId, ACTOR)).dataVersion,
        title: '숫자만 복제',
        columnMap: { amount: 'amount' },
        blockIds: ['orig-sales'],
      },
      ACTOR,
    );
    expect(preview.snapshot.widgets).toHaveLength(1);
    const key = preview.snapshot.widgets[0].blockId;
    for (const mode of ['mobile', 'tablet', 'desktop'])
      expect(preview.snapshot.responsiveLayouts[mode][key]).toEqual(RECTS[mode][0]);
    const request = { ticket: preview.ticket, requestId: randomUUID() };
    const saved = await service.save(originalId, request, ACTOR);
    expect((await service.save(originalId, request, ACTOR)).id).toBe(saved.id);
    const copy = await db.getRepository(Dashboard).findOneBy({ id: saved.id });
    const definition = JSON.parse(copy.analysisDefinition);
    expect(definition.widgets).toHaveLength(1);
    expect(definition.widgets[0].title).toBe('총 매출');
    expect(definition.widgets[0].blockId).not.toBe('orig-sales');
    expect((await rows(Dashboard))[0]).toEqual(original[0]);
  });

  it('UC024 projects positional legacy sizes by selected original index', async () => {
    const row = await db.getRepository(Dashboard).findOneBy({ id: originalId });
    const input = JSON.parse(row.analysisDefinition);
    input.layoutSizes = [
      { width: 6, height: 3 },
      { width: 12, height: 5 },
    ];
    await db
      .getRepository(Dashboard)
      .update(originalId, { analysisDefinition: JSON.stringify(input) });
    const draft = await service.draft(originalId, ACTOR);
    const preview = await service.preview(
      originalId,
      {
        expectedRevision: draft.expectedRevision,
        sourceId: targetId,
        sourceRevision: (await profileOf(targetId, ACTOR)).dataVersion,
        title: '두 번째만',
        columnMap: COLUMN_MAP,
        blockIds: ['orig-os'],
      },
      ACTOR,
    );
    const saved = await service.save(
      originalId,
      { ticket: preview.ticket, requestId: randomUUID() },
      ACTOR,
    );
    const copy = await db.getRepository(Dashboard).findOneBy({ id: saved.id });
    expect(JSON.parse(copy.analysisDefinition).layoutSizes).toEqual([{ width: 12, height: 5 }]);
  });

  it.each([[], ['orig-sales', 'orig-sales'], ['foreign'], 'orig-sales', null])(
    'UC024 rejects invalid selections before issuing a ticket %p',
    async blockIds => {
      const draft = await service.draft(originalId, ACTOR);
      const before = await counts();
      await expect(
        service.preview(
          originalId,
          {
            expectedRevision: draft.expectedRevision,
            sourceId: targetId,
            sourceRevision: (await profileOf(targetId, ACTOR)).dataVersion,
            title: '복사본',
            columnMap: COLUMN_MAP,
            blockIds,
          },
          ACTOR,
        ),
      ).rejects.toThrow();
      expect(await counts()).toEqual(before);
    },
  );

  it('UC024 keeps original order even when selected IDs are reversed and rejects unused mappings', async () => {
    const draft = await service.draft(originalId, ACTOR);
    const body = {
      expectedRevision: draft.expectedRevision,
      sourceId: targetId,
      sourceRevision: (await profileOf(targetId, ACTOR)).dataVersion,
      title: '순서 유지',
      columnMap: COLUMN_MAP,
      blockIds: ['orig-os', 'orig-sales'],
    };
    const preview = await service.preview(originalId, body, ACTOR);
    expect(preview.snapshot.widgets.map(w => w.title)).toEqual(['총 매출', 'OS별 매출']);
    await expect(
      service.preview(originalId, { ...body, blockIds: ['orig-sales'] }, ACTOR),
    ).rejects.toThrow('unsupported column mapping: os');
  });

  it('binds the draft and preview to the current revisions without writing', async () => {
    const before = await counts();
    const { draft } = await flow();
    const row = await db.getRepository(Dashboard).findOneBy({ id: originalId });
    expect(draft.expectedRevision).toBe(dashboardRevision(row));
    expect(draft.originalId).toBe(originalId);
    expect(draft.originalTitle).toBe('원본 분석');
    expect(draft.title).toBe('원본 분석 복사본');
    expect(draft.originalSourceId).toBe(1);
    expect(draft.columns.map((column: any) => column.name)).toEqual(['amount', 'os']);
    expect(draft.sources.map((source: any) => source.id)).toEqual([1, 2]);
    expect(await counts()).toEqual(before);
  });

  it('saves one independent copy with fresh block IDs, three layouts, new source defs and no metric links', async () => {
    const { ticket } = await flow();
    const saved = await service.save(originalId, { ticket, requestId: randomUUID() }, ACTOR);
    expect(saved.replayed).toBe(false);
    expect(saved.id).not.toBe(originalId);
    const copy = await db.getRepository(Dashboard).findOneBy({ id: saved.id });
    expect(copy.title).toBe('복사본 제목');
    expect(copy.delYn).toBe('N');
    expect(copy.structuredDefinition).toBeNull();
    const share = await db.getRepository(DashboardShare).findOneBy({ id: copy.shareId });
    expect(share.shareYn).toBe('N');
    expect(
      await db.getRepository(DashboardPublication).findOneBy({ dashboardId: copy.id }),
    ).toBeNull();
    const definition = JSON.parse(copy.analysisDefinition);
    expect(definition.databaseId).toBe(targetId);
    expect(definition.widgets.map((widget: any) => widget.title)).toEqual(
      WIDGETS.map(widget => widget.title),
    );
    const copiedIds = definition.widgets.map((widget: any) => widget.blockId);
    expect(copiedIds.every((id: string) => /^block-/.test(id))).toBe(true);
    expect(copiedIds).not.toContain('orig-sales');
    for (const size of ['mobile', 'tablet', 'desktop'] as const)
      expect(copiedIds.map((id: string) => definition.responsiveLayouts[size][id])).toEqual(
        RECTS[size],
      );
    const datasets = await db.getRepository(Dataset).find({ where: { databaseId: targetId } });
    expect(datasets).toHaveLength(2);
    expect(datasets.every(dataset => /FROM source\b/.test(dataset.query))).toBe(true);
    const mapping = await db
      .getRepository(UserMapping)
      .findOneBy({ dashboardId: copy.id, userInfoId: ACTOR });
    expect(mapping).not.toBeNull();
    const links = await db.getRepository(DashboardWidget).find({ where: { dashboardId: copy.id } });
    expect(links).toHaveLength(2);
    const copiedWidgetIds = links.map(link => link.widgetId).sort((left, right) => left - right);
    expect(copiedWidgetIds).not.toEqual([...widgetIds].sort((left, right) => left - right));
    for (const widgetId of copiedWidgetIds) {
      const widget = await db.getRepository(Widget).findOneBy({ id: widgetId });
      expect(widget.datasetType).toBe(DatasetType.DATASET);
      const dataset = await db.getRepository(Dataset).findOneBy({ id: widget.datasetId });
      expect(dataset.databaseId).toBe(targetId);
    }
  });

  it('leaves the original dashboard, share, widgets and publication untouched', async () => {
    const before = {
      dashboards: await rows(Dashboard),
      shares: await rows(DashboardShare),
      widgets: await rows(Widget),
      datasets: await rows(Dataset),
      publications: await rows(DashboardPublication),
    };
    const { ticket } = await flow();
    await service.save(originalId, { ticket, requestId: randomUUID() }, ACTOR);
    expect(await rows(Dashboard)).toEqual(expect.arrayContaining(before.dashboards));
    const originals = await db.getRepository(Dashboard).findOneBy({ id: originalId });
    expect(originals).toEqual(before.dashboards[0]);
    expect(await rows(DashboardShare)).toEqual(expect.arrayContaining(before.shares));
    expect(await rows(Widget)).toEqual(expect.arrayContaining(before.widgets));
    expect(await rows(Dataset)).toEqual(expect.arrayContaining(before.datasets));
    expect(await rows(DashboardPublication)).toEqual(before.publications);
  });

  it('replays the same copy for the same ticket and requestId', async () => {
    const { ticket } = await flow();
    const requestId = randomUUID();
    const created = await service.save(originalId, { ticket, requestId }, ACTOR);
    const before = await counts();
    const replayed = await service.save(originalId, { ticket, requestId }, ACTOR);
    expect(replayed).toEqual({ id: created.id, replayed: true });
    expect(await counts()).toEqual(before);
    expect(
      await db.getRepository(AnalysisCreationReceipt).countBy({ actorId: ACTOR, requestId }),
    ).toBe(1);
  });

  it('creates exactly one copy for simultaneous identical saves', async () => {
    const { ticket } = await flow();
    const requestId = randomUUID();
    const results = await Promise.all([
      service.save(originalId, { ticket, requestId }, ACTOR),
      service.save(originalId, { ticket, requestId }, ACTOR),
    ]);
    expect(results[0].id).toBe(results[1].id);
    expect(results.filter(result => !result.replayed)).toHaveLength(1);
    expect(await db.getRepository(Dashboard).count()).toBe(2);
    expect(await db.getRepository(AnalysisCreationReceipt).count()).toBe(1);
  });

  it('replays the stored copy after the ticket expired but rejects a new request id', async () => {
    const { ticket } = await flow();
    const requestId = randomUUID();
    const created = await service.save(originalId, { ticket, requestId }, ACTOR);
    const clock = jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 6 * 60 * 1000);
    const replayed = await service.save(originalId, { ticket, requestId }, ACTOR);
    expect(replayed).toEqual({ id: created.id, replayed: true });
    await expect(
      service.save(originalId, { ticket, requestId: randomUUID() }, ACTOR),
    ).rejects.toThrow('미리보기가 만료되었습니다');
    clock.mockRestore();
  });

  it('rejects a foreign actor, a changed original and a changed target source', async () => {
    const before = await counts();
    const first = await flow();
    await expect(
      service.save(originalId, { ticket: first.ticket, requestId: randomUUID() }, ACTOR + 1),
    ).rejects.toThrow('미리보기가 만료되었습니다');

    const secondFlow = await flow();
    await db.getRepository(Dashboard).update(originalId, { title: '다른 제목' });
    await expect(
      service.save(originalId, { ticket: secondFlow.ticket, requestId: randomUUID() }, ACTOR),
    ).rejects.toThrow('원본 또는 데이터 소스가 변경되었습니다');
    await db.getRepository(Dashboard).update(originalId, { title: '원본 분석' });

    const thirdFlow = await flow();
    await db.getRepository(Database).update(targetId, { connectionConfig: fileConfig('source3') });
    await expect(
      service.save(originalId, { ticket: thirdFlow.ticket, requestId: randomUUID() }, ACTOR),
    ).rejects.toThrow('원본 또는 데이터 소스가 변경되었습니다');
    expect(await counts()).toEqual(before);
  });

  it('rolls back every row including the receipt when the original changes during the save', async () => {
    const { ticket } = await flow();
    const before = await counts();
    const original = await db.getRepository(Dashboard).findOneBy({ id: originalId });
    duringSave = async () => {
      await db.getRepository(Dashboard).update(originalId, { title: '동시 편집' });
    };
    await expect(
      service.save(originalId, { ticket, requestId: randomUUID() }, ACTOR),
    ).rejects.toThrow('원본 또는 데이터 소스가 변경되었습니다');
    expect(await counts()).toEqual(before);
    expect(await db.getRepository(Dashboard).findOneBy({ id: originalId })).toEqual(original);
  });

  it('rolls back partial widget writes and the receipt when a chart component is missing', async () => {
    const { ticket } = await flow();
    const requestId = randomUUID();
    const before = await counts();
    await db.getRepository(Component).delete({ type: 'CHART_COLUMN' });
    await expect(service.save(originalId, { ticket, requestId }, ACTOR)).rejects.toThrow(
      'chart component unavailable',
    );
    await db
      .getRepository(Component)
      .save({ type: 'CHART_COLUMN', title: 'CHART_COLUMN', option: '{}', useYn: 'Y' });
    expect(await counts()).toEqual(before);
    const retried = await service.save(originalId, { ticket, requestId }, ACTOR);
    expect(retried.replayed).toBe(false);
    expect(await db.getRepository(Dashboard).count()).toBe(2);
  });

  it('rejects a different request id on the same ticket without creating a second copy', async () => {
    const { ticket } = await flow();
    const created = await service.save(originalId, { ticket, requestId: randomUUID() }, ACTOR);
    const before = await counts();
    await expect(
      service.save(originalId, { ticket, requestId: randomUUID() }, ACTOR),
    ).rejects.toThrow('이미 저장을 요청한 미리보기입니다');
    expect(await counts()).toEqual(before);
    expect(await db.getRepository(Dashboard).count()).toBe(2);
    expect(created.replayed).toBe(false);
  });
  const canonical = async () => {
    const row = await db.getRepository(Dashboard).findOneByOrFail({ id: originalId });
    const analysis = JSON.parse(row.analysisDefinition);
    const definition = {
      schemaVersion: 1,
      definitionVersion: 2,
      sourceId: 1,
      tableName: 'uploaded_data',
      label: '매출',
      aggregation: 'SUM',
      column: 'amount',
      unit: 'USD',
      decimalPlaces: 2,
      numberNotation: 'plain',
    };
    analysis.widgets = analysis.widgets.map((w, i) => ({
      ...w,
      sql: canonicalMetricSql(definition, w.type, i ? 'os' : undefined, { columns: COLUMNS }),
      ...(i ? { categoryField: 'dimension' } : {}),
    }));
    const snapshot = {
      schemaVersion: 2,
      kind: 'structured-bi-dashboard',
      sourceId: 1,
      studioFilters: [{ column: 'os', values: ['Mobile'] }],
      items: analysis.widgets.map((w, i) => ({
        key: w.blockId,
        sourceId: 1,
        metricId: 100,
        definitionVersion: 2,
        definition,
        ...(i ? { dimension: 'os' } : {}),
        chart: i ? 'bar' : 'number',
      })),
    };
    await db.getRepository(Dashboard).update(originalId, {
      analysisDefinition: JSON.stringify(analysis),
      structuredDefinition: JSON.stringify(snapshot),
    });
    return await db.getRepository(Dashboard).findOneByOrFail({ id: originalId });
  };
  it('copies one canonical metric once, keeps filters and clone-local links in the same receipt transaction', async () => {
    const original = await canonical();
    const { ticket } = await flow();
    expect(await db.getRepository(Metric).count()).toBe(0);
    const request = { ticket, requestId: randomUUID() };
    const saved = await service.save(originalId, request, ACTOR);
    const row = await db.getRepository(Dashboard).findOneByOrFail({ id: saved.id });
    const snapshot = JSON.parse(row.structuredDefinition);
    const metrics = await db.getRepository(Metric).find();
    expect(metrics).toHaveLength(1);
    expect(snapshot.items.map(i => i.metricId)).toEqual([metrics[0].id, metrics[0].id]);
    expect(
      snapshot.items.every(
        i =>
          i.sourceId === targetId &&
          i.definition.sourceId === targetId &&
          i.definitionVersion === 1,
      ),
    ).toBe(true);
    expect(snapshot.studioFilters).toEqual([{ column: 'os', values: ['Mobile'] }]);
    expect((await service.save(originalId, request, ACTOR)).id).toBe(saved.id);
    expect(await db.getRepository(Metric).count()).toBe(1);
    expect(await db.getRepository(Dashboard).findOneByOrFail({ id: originalId })).toEqual(original);
  });
  it('rolls back clone-local metrics together with a failed dashboard write', async () => {
    await canonical();
    const { ticket } = await flow();
    await db.getRepository(Component).update({ type: 'CHART_COLUMN' }, { useYn: 'N' });
    const before = await counts();
    await expect(
      service.save(originalId, { ticket, requestId: randomUUID() }, ACTOR),
    ).rejects.toThrow('component unavailable');
    expect(await counts()).toEqual(before);
  });
  it('preserves independently edited Studio mobile/tablet geometry through a saved copy', async () => {
    const row = await canonical();
    const analysis = JSON.parse(row.analysisDefinition);
    analysis.blockLayouts = Object.fromEntries(
      analysis.widgets.map((w, i) => [w.blockId, RECTS.desktop[i]]),
    );
    const doc = importStudio(
      originalId,
      { ...analysis, revision: dashboardRevision(row) },
      JSON.parse(row.structuredDefinition),
      'schema',
    );
    doc.layouts.xs[0].h = 4;
    doc.layouts.xs[1].y = 7;
    doc.layouts.xs[1].h = 6;
    doc.layouts.md[0].w = 3;
    doc.layouts.md[1].y = 5;
    // Layout array order may differ from block order and must not change identity assignment.
    doc.layouts.xs.reverse();
    await db.manager.save(StudioState, {
      dashboardId: originalId,
      legacyRevision: dashboardRevision(row),
      document: JSON.stringify({ document: doc, sourceRevision: 'old' }),
    });
    const { ticket, preview } = await flow();
    const first = preview.snapshot.widgets[0].blockId;
    expect(preview.snapshot.responsiveLayouts.mobile[first]).toEqual({ x: 0, y: 0, w: 4, h: 4 });
    const request = { ticket, requestId: randomUUID() };
    const saved = await service.save(originalId, request, ACTOR);
    const state = await db.manager.findOneByOrFail(StudioState, { dashboardId: saved.id });
    const copied = JSON.parse(state.document).document;
    const ids = new Map(doc.blocks.map((b, i) => [b.id, copied.blocks[i].id]));
    for (const bp of ['xs', 'md', 'lg'])
      expect(copied.layouts[bp]).toEqual(doc.layouts[bp].map(g => ({ ...g, id: ids.get(g.id) })));
    expect((await service.save(originalId, request, ACTOR)).id).toBe(saved.id);
    expect(await db.manager.count(StudioState)).toBe(2);
    const next = await flow();
    const rowBefore = await db.manager.findOneByOrFail(Dashboard, { id: originalId });
    const altered = JSON.parse(JSON.stringify(doc));
    altered.layouts.xs[0].h += 1;
    await db.manager.update(
      StudioState,
      { dashboardId: originalId },
      { document: JSON.stringify({ document: altered, sourceRevision: 'old' }) },
    );
    expect(dashboardRevision(await db.manager.findOneByOrFail(Dashboard, { id: originalId }))).toBe(
      dashboardRevision(rowBefore),
    );
    const before = await counts();
    await expect(
      service.save(originalId, { ticket: next.ticket, requestId: randomUUID() }, ACTOR),
    ).rejects.toThrow('변경되었습니다');
    expect(await counts()).toEqual(before);
  });
});
