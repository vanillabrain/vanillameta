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
import { AiDashboardService } from '../ai/ai-dashboard.service';
import { dashboardRevision } from '../dashboard/dashboard-revision';
import { AnalysisCreationReceipt } from './analysis-creation-receipt.entity';
import { DashboardReuseService } from './dashboard-reuse.service';
import { buildReuseRecipe } from './reuse-recipe';
import { SharedReuseOriginService } from './shared-reuse-origin.service';
import { sourceRevision } from './source-revision';
import type { BiService } from './bi.service';

const OWNER = 10;
const RECIPIENT = 20;
const ENTITIES = [
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
const SIZES = ['mobile', 'tablet', 'desktop'] as const;
const MISSING = '재사용이 허용되지 않았';
const COPY_TITLE = '공유 복사본';
const fileConfig = (version: string) =>
  JSON.stringify({ client: 'duckdb', connection: { filename: `/immutable/${version}.duckdb` } });
// remapDashboard rejects an incomplete map, so every reused column is named explicitly.
const COLUMN_MAP = { amount: 'amount', os: 'os' };

describe('UC021 shared dashboard reuse SQLite graph', () => {
  let db: DataSource;
  let dir: string;
  let dashboards: AiDashboardService;
  let bi: any;
  let access: SourceAccessService;
  let origins: SharedReuseOriginService;
  let service: DashboardReuseService;
  let originalId: number;
  let shareId: number;
  let shareUuid: string;
  let publicationUuid: string;
  let originalSourceId: number;
  let targetId: number;

  const counts = () => Promise.all(ENTITIES.map(entity => db.getRepository(entity).count()));
  // Order by primary columns from metadata: DashboardPublication keys on dashboardId, not id.
  const rows = (entity: any) => {
    const repository = db.getRepository(entity);
    const order = Object.fromEntries(
      repository.metadata.primaryColumns.map(column => [column.propertyName, 'ASC']),
    );
    return repository.find({ order } as any);
  };
  const dashboardRow = () => db.getRepository(Dashboard).findOneBy({ id: originalId });
  const shareRow = () => db.getRepository(DashboardShare).findOneBy({ id: shareId });

  const seed = async (source: DataSource) => {
    const originalSource = await source.getRepository(Database).save({
      id: 1,
      ownerId: OWNER,
      name: '원본 소스',
      type: 'file',
      engine: 'duckdb',
      connectionConfig: fileConfig('source1'),
    });
    const recipientSource = await source.getRepository(Database).save({
      id: 2,
      ownerId: RECIPIENT,
      name: '수신자 소스',
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
    const share = await source.getRepository(DashboardShare).save({
      uuid: randomUUID(),
      shareToken: 'share-token-1',
      shareYn: 'Y',
      endDate: new Date(Date.now() + 7 * 86_400_000),
      allowReuse: false,
      reuseVersion: 0,
    });
    const widgetIds: number[] = [];
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
      title: '공유 원본 분석',
      shareId: share.id,
      delYn: 'N',
      structuredDefinition: JSON.stringify({ items: [] }),
      analysisDefinition: JSON.stringify({
        databaseId: originalSource.id,
        title: '공유 원본 분석',
        explanation: '전체 기간 · 필터 없음',
        widgets: WIDGETS,
        responsiveLayouts: Object.fromEntries(
          SIZES.map(size => [
            size,
            Object.fromEntries(
              WIDGETS.map((widget, index) => [widget.blockId, RECTS[size][index]]),
            ),
          ]),
        ),
      }),
      layout: JSON.stringify(
        widgetIds.map((id, index) => ({ i: String(id), ...RECTS.desktop[index] })),
      ),
    });
    await source.getRepository(UserMapping).save({ dashboardId: dashboard.id, userInfoId: OWNER });
    await source
      .getRepository(DashboardWidget)
      .save(widgetIds.map(widgetId => ({ dashboardId: dashboard.id, widgetId })));
    // A stopped publication is the default; UC-018's owner opt-in captures the recipe.
    await source.getRepository(DashboardPublication).save({
      dashboardId: dashboard.id,
      uuid: randomUUID(),
      version: 3,
      dashboardRevision: dashboardRevision(dashboard),
      snapshot: JSON.stringify({ schemaVersion: 1 }),
      reuseDefinition: null,
      publishedAt: new Date(Date.now()).toISOString(),
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      active: false,
      requestId: randomUUID(),
      payloadDigest: 'b'.repeat(64),
    });
    return { originalSource, recipientSource, share, dashboard };
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

  // Preview is doubled like the UC020 fixture: real save still persists the remapped draft.
  const buildPreview = (dashboards: AiDashboardService) =>
    jest.spyOn(dashboards, 'preview').mockImplementation(
      async (body: any) =>
        ({
          status: 'SUCCESS',
          data: {
            draft: body.draft,
            widgets: body.draft.widgets.map((widget: any) => ({
              ...widget,
              fields: [],
              datas: [],
            })),
          },
        } as any),
    );

  const connection = { withDuckDBSnapshot: (_id: number, run: any) => run() };

  const flow = async (kind: 'share' | 'publication' = 'share', actor = RECIPIENT) => {
    const id = kind === 'share' ? shareUuid : publicationUuid;
    const draft = await service.draft(id, actor, kind);
    const preview = await service.preview(
      id,
      {
        expectedRevision: draft.expectedRevision,
        sourceId: targetId,
        sourceRevision: (await profileOf(targetId, actor)).dataVersion,
        title: COPY_TITLE,
        columnMap: COLUMN_MAP,
      },
      actor,
      kind,
    );
    return { draft, preview, ticket: preview.ticket };
  };

  beforeEach(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vm-shared-reuse-'));
    db = await new DataSource({
      type: 'sqlite',
      database: path.join(dir, 'metadata.db'),
      entities: ENTITIES,
      synchronize: true,
    }).initialize();
    const seeded = await seed(db);
    originalId = seeded.dashboard.id;
    shareId = seeded.share.id;
    shareUuid = seeded.share.uuid;
    publicationUuid = (
      await db.getRepository(DashboardPublication).findOneBy({ dashboardId: originalId })
    ).uuid;
    originalSourceId = seeded.originalSource.id;
    targetId = seeded.recipientSource.id;
    bi = {
      profile: jest.fn(async (id: number, actor: number) => profileOf(id, actor)),
      sources: jest.fn(async (actor: number) =>
        (await db.getRepository(Database).find({ where: { ownerId: actor } })).map(
          ({ id, name, engine }) => ({ id, name, engine }),
        ),
      ),
    };
    dashboards = new AiDashboardService({} as any, connection as any, db.getRepository(Dashboard));
    buildPreview(dashboards);
    access = new SourceAccessService(db);
    origins = new SharedReuseOriginService(db, dashboards, bi as BiService, access);
    service = new DashboardReuseService(
      db,
      bi as BiService,
      dashboards,
      connection as any,
      access,
      origins,
    );
  });

  afterEach(async () => {
    if (db?.isInitialized) await db.destroy();
    fs.rmSync(dir, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  it('keeps an existing share closed until the owner opts in and refuses a foreign grant', async () => {
    const before = await counts();
    expect(await origins.status('share', shareUuid)).toEqual({ reusable: false });
    expect(await origins.status('publication', publicationUuid)).toEqual({ reusable: false });
    expect(await origins.grant(originalId, OWNER)).toEqual({ allowReuse: false });
    await expect(service.draft(shareUuid, RECIPIENT, 'share')).rejects.toThrow(MISSING);
    await expect(
      service.preview(
        shareUuid,
        {
          expectedRevision: 'a'.repeat(64),
          sourceId: targetId,
          sourceRevision: 'b'.repeat(64),
          title: COPY_TITLE,
          columnMap: COLUMN_MAP,
        },
        RECIPIENT,
        'share',
      ),
    ).rejects.toThrow(MISSING);
    await expect(origins.grant(originalId, RECIPIENT, { allowReuse: true })).rejects.toThrow(
      'not dashboard owner',
    );
    await expect(origins.grant(originalId, OWNER, { allowReuse: 'yes' })).rejects.toThrow(
      '재사용 허용 설정을 확인해 주세요.',
    );
    expect((await shareRow()).allowReuse).toBe(false);
    expect(await counts()).toEqual(before);
  });

  it('opens the granted share to the recipient with columns and their own sources only', async () => {
    await origins.grant(originalId, OWNER, { allowReuse: true });
    const share = await shareRow();
    expect(share.allowReuse).toBe(true);
    expect(share.reuseVersion).toBe(1);
    expect(await origins.status('share', shareUuid)).toEqual({ reusable: true });

    const draft = await service.draft(shareUuid, RECIPIENT, 'share');
    // The opaque link id replaces the original dashboard id; no source identity travels.
    expect(draft.originalId).toBe(shareUuid);
    expect(draft.originalId).not.toBe(String(originalId));
    expect(Object.keys(draft).sort()).toEqual([
      'columns',
      'expectedRevision',
      'originalId',
      'originalTitle',
      'sources',
      'title',
    ]);
    expect(draft.originalTitle).toBe('공유 원본 분석');
    expect(draft.title).toBe('공유 원본 분석 복사본');
    expect(draft.expectedRevision).toMatch(/^[a-f0-9]{64}$/);
    expect(draft.columns).toEqual([
      { name: 'amount', type: 'DOUBLE', numeric: true, temporal: false },
      { name: 'os', type: 'VARCHAR', numeric: false, temporal: false },
    ]);
    expect(draft.sources).toEqual([{ id: targetId, name: '수신자 소스', engine: 'duckdb' }]);
    expect(JSON.stringify(draft)).not.toMatch(/SELECT|originalSourceId|databaseId|filter/i);
  });

  it('previews the recipe on the recipient source only, masks SQL and keeps the original layouts', async () => {
    await origins.grant(originalId, OWNER, { allowReuse: true });
    const draft = await service.draft(shareUuid, RECIPIENT, 'share');
    const before = await counts();
    // The owner's source is not the recipient's to pick, even with a valid link.
    await expect(
      service.preview(
        shareUuid,
        {
          expectedRevision: draft.expectedRevision,
          sourceId: originalSourceId,
          sourceRevision: (await profileOf(originalSourceId, OWNER)).dataVersion,
          title: COPY_TITLE,
          columnMap: COLUMN_MAP,
        },
        RECIPIENT,
        'share',
      ),
    ).rejects.toThrow('data access denied');

    const { preview } = await flow();
    expect(preview.originalId).toBe(shareUuid);
    expect(preview.sourceId).toBe(targetId);
    expect(preview.ticket).toMatch(/^[a-f0-9-]{36}$/);
    expect(preview.snapshot.widgets).toHaveLength(WIDGETS.length);
    expect(
      preview.snapshot.widgets.every(
        (widget: any) => widget.sql === undefined && widget.contribution === undefined,
      ),
    ).toBe(true);
    expect(JSON.stringify(preview.snapshot)).not.toMatch(/SELECT|contribution/i);
    const ids = preview.snapshot.widgets.map((widget: any) => widget.blockId);
    expect(ids.every((id: string) => /^copy-/.test(id))).toBe(true);
    for (const size of SIZES)
      expect(ids.map((id: string) => preview.snapshot.responsiveLayouts[size][id])).toEqual(
        RECTS[size],
      );
    expect(await counts()).toEqual(before);
  });

  it('saves one private copy through the share link and leaves the original graph untouched', async () => {
    await origins.grant(originalId, OWNER, { allowReuse: true });
    const before = {
      dashboards: await rows(Dashboard),
      shares: await rows(DashboardShare),
      widgets: await rows(Widget),
      datasets: await rows(Dataset),
      publications: await rows(DashboardPublication),
      databases: await rows(Database),
    };
    const { ticket } = await flow();
    const saved = await service.save(
      shareUuid,
      { ticket, requestId: randomUUID() },
      RECIPIENT,
      'share',
    );
    expect(saved.replayed).toBe(false);
    expect(saved.id).not.toBe(originalId);

    const copy = await db.getRepository(Dashboard).findOneBy({ id: saved.id });
    expect(copy.title).toBe(COPY_TITLE);
    expect(copy.delYn).toBe('N');
    const copyShare = await db.getRepository(DashboardShare).findOneBy({ id: copy.shareId });
    expect(copyShare.shareYn).toBe('N');
    expect(copyShare.allowReuse).toBe(false);
    expect(
      await db.getRepository(DashboardPublication).findOneBy({ dashboardId: copy.id }),
    ).toBeNull();
    expect(
      await db.getRepository(UserMapping).findOneBy({ dashboardId: copy.id, userInfoId: OWNER }),
    ).toBeNull();
    expect(
      await db
        .getRepository(UserMapping)
        .findOneBy({ dashboardId: copy.id, userInfoId: RECIPIENT }),
    ).not.toBeNull();

    const definition = JSON.parse(copy.analysisDefinition);
    expect(definition.databaseId).toBe(targetId);
    expect(definition.widgets.map((widget: any) => widget.title)).toEqual(
      WIDGETS.map(widget => widget.title),
    );
    const ids = definition.widgets.map((widget: any) => widget.blockId);
    expect(ids.every((id: string) => /^block-/.test(id))).toBe(true);
    expect(ids).not.toContain('orig-sales');
    for (const size of SIZES)
      expect(ids.map((id: string) => definition.responsiveLayouts[size][id])).toEqual(RECTS[size]);
    const links = await db.getRepository(DashboardWidget).find({ where: { dashboardId: copy.id } });
    expect(links).toHaveLength(WIDGETS.length);
    for (const link of links) {
      const widget = await db.getRepository(Widget).findOneBy({ id: link.widgetId });
      const dataset = await db.getRepository(Dataset).findOneBy({ id: widget.datasetId });
      expect(dataset.databaseId).toBe(targetId);
      expect(/FROM source\b/.test(dataset.query)).toBe(true);
    }
    expect(await db.getRepository(AnalysisCreationReceipt).countBy({ actorId: RECIPIENT })).toBe(1);

    expect(await rows(Dashboard)).toEqual(expect.arrayContaining(before.dashboards));
    expect(await rows(DashboardShare)).toEqual(expect.arrayContaining(before.shares));
    expect(await rows(Widget)).toEqual(expect.arrayContaining(before.widgets));
    expect(await rows(Dataset)).toEqual(expect.arrayContaining(before.datasets));
    expect(await rows(Database)).toEqual(before.databases);
    expect(await rows(DashboardPublication)).toEqual(before.publications);
  });

  it('rolls back a shared save when the owner revokes, expires or re-versions the link', async () => {
    await origins.grant(originalId, OWNER, { allowReuse: true });
    const revoked = await flow();
    await origins.grant(originalId, OWNER, { allowReuse: false });
    const before = await counts();
    await expect(
      service.save(
        shareUuid,
        { ticket: revoked.ticket, requestId: randomUUID() },
        RECIPIENT,
        'share',
      ),
    ).rejects.toThrow(MISSING);
    expect(await counts()).toEqual(before);

    await origins.grant(originalId, OWNER, { allowReuse: true });
    const versioned = await flow();
    await db.getRepository(DashboardShare).update({ id: shareId }, { reuseVersion: 99 });
    await expect(
      service.save(
        shareUuid,
        { ticket: versioned.ticket, requestId: randomUUID() },
        RECIPIENT,
        'share',
      ),
    ).rejects.toThrow(MISSING);
    expect(await counts()).toEqual(before);

    const expiring = await flow();
    await db
      .getRepository(DashboardShare)
      .update({ id: shareId }, { endDate: new Date(Date.now() - 60_000) });
    expect(await origins.status('share', shareUuid)).toEqual({ reusable: false });
    await expect(service.draft(shareUuid, RECIPIENT, 'share')).rejects.toThrow(MISSING);
    await expect(
      service.preview(
        shareUuid,
        {
          expectedRevision: expiring.draft.expectedRevision,
          sourceId: targetId,
          sourceRevision: (await profileOf(targetId, RECIPIENT)).dataVersion,
          title: COPY_TITLE,
          columnMap: COLUMN_MAP,
        },
        RECIPIENT,
        'share',
      ),
    ).rejects.toThrow(MISSING);
    await expect(
      service.save(
        shareUuid,
        { ticket: expiring.ticket, requestId: randomUUID() },
        RECIPIENT,
        'share',
      ),
    ).rejects.toThrow(MISSING);
    expect(await counts()).toEqual(before);
  });

  it('invalidates a shared ticket when the original analysis changes and saves on a fresh preview', async () => {
    await origins.grant(originalId, OWNER, { allowReuse: true });
    const stale = await flow();
    const before = await counts();
    const current = await dashboardRow();
    const definition = JSON.parse(current.analysisDefinition);
    definition.title = '수정된 원본';
    await db.getRepository(Dashboard).update(originalId, {
      title: '수정된 원본',
      analysisDefinition: JSON.stringify(definition),
    });
    await expect(
      service.save(
        shareUuid,
        { ticket: stale.ticket, requestId: randomUUID() },
        RECIPIENT,
        'share',
      ),
    ).rejects.toThrow(MISSING);
    expect(await counts()).toEqual(before);

    const fresh = await flow();
    expect(fresh.draft.originalTitle).toBe('수정된 원본');
    expect(fresh.draft.expectedRevision).not.toBe(stale.draft.expectedRevision);
    const saved = await service.save(
      shareUuid,
      { ticket: fresh.ticket, requestId: randomUUID() },
      RECIPIENT,
      'share',
    );
    expect(saved.replayed).toBe(false);
    expect((await db.getRepository(Dashboard).findOneBy({ id: saved.id })).title).toBe(COPY_TITLE);
    expect((await dashboardRow()).title).toBe('수정된 원본');
  });

  it('freezes the publication recipe across an original edit and rejects a re-published link', async () => {
    const ownerAnalysis = (await dashboards.analysis(originalId, OWNER, true)).data;
    const recipe = buildReuseRecipe(ownerAnalysis, await profileOf(originalSourceId, OWNER));
    await db
      .getRepository(DashboardPublication)
      .update({ dashboardId: originalId }, { active: true, reuseDefinition: recipe });
    expect(await origins.status('publication', publicationUuid)).toEqual({ reusable: true });

    const { draft, ticket } = await flow('publication');
    expect(draft.originalId).toBe(publicationUuid);
    expect(draft.originalTitle).toBe('공유 원본 분석');
    expect(JSON.parse(recipe).analysis.databaseId).toBe(1);
    expect(JSON.parse(recipe).analysis.widgets[0].sql).toContain('FROM source');

    const current = await dashboardRow();
    const definition = JSON.parse(current.analysisDefinition);
    definition.title = '바뀐 제목';
    definition.widgets[0] = {
      ...definition.widgets[0],
      title: '바뀐 매출',
      sql: 'SELECT COUNT(*) AS value FROM source',
    };
    await db.getRepository(Dashboard).update(originalId, {
      title: '바뀐 제목',
      analysisDefinition: JSON.stringify(definition),
    });

    // The published copy keeps the frozen definition even after the owner edits the original.
    const saved = await service.save(
      publicationUuid,
      { ticket, requestId: randomUUID() },
      RECIPIENT,
      'publication',
    );
    const copy = await db.getRepository(Dashboard).findOneBy({ id: saved.id });
    const copied = JSON.parse(copy.analysisDefinition);
    expect(copied.databaseId).toBe(targetId);
    expect(copied.widgets.map((widget: any) => widget.title)).toEqual(
      WIDGETS.map(widget => widget.title),
    );
    expect(copied.widgets[0].sql).toBe('SELECT SUM(amount) AS value FROM source');
    const frozen = await service.draft(publicationUuid, RECIPIENT, 'publication');
    expect(frozen.originalTitle).toBe('공유 원본 분석');
    expect(frozen.expectedRevision).toBe(draft.expectedRevision);

    const republished = await flow('publication');
    await db
      .getRepository(DashboardPublication)
      .update({ dashboardId: originalId }, { version: 4 });
    const after = await counts();
    await expect(
      service.save(
        publicationUuid,
        { ticket: republished.ticket, requestId: randomUUID() },
        RECIPIENT,
        'publication',
      ),
    ).rejects.toThrow(MISSING);
    expect(await counts()).toEqual(after);
    await db
      .getRepository(DashboardPublication)
      .update({ dashboardId: originalId }, { active: false });
    await expect(service.draft(publicationUuid, RECIPIENT, 'publication')).rejects.toThrow(MISSING);
  });

  it('replays a stored receipt after revocation and guards the actor and optional origins', async () => {
    await origins.grant(originalId, OWNER, { allowReuse: true });
    const { ticket } = await flow();
    const requestId = randomUUID();
    const created = await service.save(shareUuid, { ticket, requestId }, RECIPIENT, 'share');
    await origins.grant(originalId, OWNER, { allowReuse: false });
    const before = await counts();
    await expect(
      service.save(shareUuid, { ticket, requestId }, RECIPIENT, 'share'),
    ).resolves.toEqual({ id: created.id, replayed: true });
    await expect(
      service.save(shareUuid, { ticket, requestId: randomUUID() }, RECIPIENT, 'share'),
    ).rejects.toThrow('이미 저장을 요청한 미리보기입니다');
    expect(await counts()).toEqual(before);

    await expect(service.draft(shareUuid, 0, 'share')).rejects.toThrow('invalid owner');
    await expect(service.draft(shareUuid, undefined as any, 'share')).rejects.toThrow(
      'invalid owner',
    );
    await expect(service.save(shareUuid, { ticket, requestId }, 0, 'share')).rejects.toThrow(
      'invalid owner',
    );
    await expect(
      service.save(shareUuid, { ticket, requestId }, RECIPIENT, 'bogus'),
    ).rejects.toThrow('invalid reuse origin');
    await expect(origins.resolve('share', 'not-a-uuid')).rejects.toThrow(MISSING);
    await expect(origins.resolve('bogus', shareUuid)).rejects.toThrow(MISSING);
    expect(await counts()).toEqual(before);

    // The origin resolver stays an optional sixth dependency for the owned clone path.
    const owned = new DashboardReuseService(
      db,
      bi as BiService,
      dashboards,
      connection as any,
      access,
    );
    const ownedDraft = await owned.draft(originalId, OWNER);
    expect(ownedDraft.originalSourceId).toBe(originalSourceId);
    expect(ownedDraft.sources.map((source: any) => source.id)).toEqual([originalSourceId]);
  });
});
