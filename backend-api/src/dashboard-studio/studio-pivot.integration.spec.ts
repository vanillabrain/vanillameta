import { SourceCatalogEntry } from '../bi/entities/source-catalog-entry.entity';
import { EnterpriseGroupDelivery } from '../enterprise/entities/enterprise-group-delivery.entity';
import {
  EnterpriseGroup,
  EnterpriseGroupMember,
  EnterpriseGroupGrant,
} from '../enterprise/entities/enterprise-group.entity';
import { EnterpriseDashboardDelivery } from '../enterprise/entities/enterprise-dashboard-delivery.entity';
import { StudioPublication, StudioPublicationRequest } from './entities/studio-publication.entity';
import { StudioPublicationService } from './studio-publication.service';
import { User } from '../user/entities/user.entity';
import { EnterpriseOrganization } from '../enterprise/entities/enterprise-organization.entity';
import { EnterpriseMembership } from '../enterprise/entities/enterprise-membership.entity';
import { EnterpriseAuditEvent } from '../enterprise/entities/enterprise-audit-event.entity';
import { EnterpriseResourceGrant } from '../enterprise/entities/enterprise-resource-grant.entity';
jest.mock('../ai/ai.service', () => ({ AiService: class {} }));
import { DataSource } from 'typeorm';
import { createHash } from 'crypto';
import { AiDashboardService } from '../ai/ai-dashboard.service';
import { DuckDBService } from '../analysis/duckdb.service';
import { Dashboard } from '../dashboard/entities/dashboard.entity';
import { DashboardShare } from '../dashboard/entities/dashboard_share.entity';
import { DashboardWidget } from '../dashboard/dashboard-widget/entities/dashboard-widget.entity';
import { UserMapping } from '../user/entities/user-mapping.entity';
import { Database } from '../database/entities/database.entity';
import { Dataset } from '../dataset/entities/dataset.entity';
import { Widget } from '../widget/entities/widget.entity';
import { Component } from '../component/entities/component.entity';
import { Metric } from '../metric/entities/metric.entity';
import { StudioState } from './entities/studio-state.entity';
import { StudioRun } from './entities/studio-run.entity';
import { PersonalView } from '../dashboard/entities/personal-view.entity';
import { BiService } from '../bi/bi.service';
import { BiExploreService } from '../bi/bi-explore.service';
import { BiSegmentService } from '../bi/bi-segment.service';
import { StudioPivotService } from './studio-pivot.service';
import { StudioService } from './studio.service';
import { SourceAccessService } from '../ownership/source-access.service';
import { applyStudioOperation } from './studio-operations';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
const draft = () => ({
  databaseId: 1,
  title: 'Studio actual',
  explanation: 'All time',
  widgets: [
    {
      title: 'Revenue',
      description: '',
      type: 'BOARD_NUMERIC',
      sql: 'SELECT sum(amount) AS value FROM source',
      valueField: 'value',
      decimalPlaces: 0,
    },
    {
      title: 'Channels',
      description: '',
      type: 'CHART_COLUMN',
      sql: 'SELECT category,sum(amount) AS value FROM source GROUP BY category',
      categoryField: 'category',
      valueField: 'value',
      decimalPlaces: 0,
    },
  ],
});
describe('Studio real DuckDB and transactional metadata', () => {
  let db: DataSource,
    worker: DuckDBService,
    ai: AiDashboardService,
    studio: StudioService,
    root: string,
    id: number,
    connection: any,
    sourceRevision: string;
  const files = new Map<number, string>();
  const versions = new Map<number, string>();
  const previous = process.env.FILE_UPLOAD_DIR;
  beforeAll(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-t4-'));
    process.env.FILE_UPLOAD_DIR = root;
    worker = new DuckDBService();
    const file = await worker.importFile({
      originalname: 'studio.csv',
      buffer: Buffer.from(
        'category,amount,event_time,pivot_axis\nSite,300,2026-01-01T00:00:00Z,Compute\nMobile,200,2026-01-02T00:00:00Z,Compute\n',
      ),
    });
    db = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      synchronize: true,
      entities: [
        PersonalView,
        SourceCatalogEntry,
        Dashboard,
        DashboardShare,
        DashboardWidget,
        UserMapping,
        Database,
        Dataset,
        Widget,
        Component,
        Metric,
        StudioState,
        StudioRun,
        User,
        EnterpriseOrganization,
        EnterpriseMembership,
        EnterpriseAuditEvent,
        EnterpriseResourceGrant,
        EnterpriseGroup,
        EnterpriseGroupMember,
        EnterpriseGroupGrant,
        EnterpriseDashboardDelivery,
        EnterpriseGroupDelivery,
        StudioPublication,
        StudioPublicationRequest,
      ],
    }).initialize();
    await db.manager.save(User, {
      id: 7,
      userId: 'pivot-owner',
      email: 'pivot-owner@example.test',
      password: 'test-only',
      active: true,
      authVersion: 0,
    });
    sourceRevision = createHash('sha256').update(file.filename).digest('hex');
    files.set(1, file.filename);
    versions.set(1, sourceRevision);
    await db.manager.save(Database, {
      id: 1,
      ownerId: 7,
      name: 'Source',
      connectionConfig: JSON.stringify({
        client: 'duckdb',
        connection: { filename: file.filename },
      }),
      engine: 'duckdb',
      type: 'FILE',
    });
    for (const type of ['BOARD_NUMERIC', 'CHART_COLUMN'])
      await db.manager.save(Component, { type, title: type, option: '{}', useYn: 'Y' });
    connection = {
      withDuckDBSnapshot: jest.fn((_id, cb) => cb()),
      captureDuckDBSnapshot: jest.fn(async () => ({ run: async cb => cb() })),
      duckDBVersion: jest.fn(async sourceId => versions.get(sourceId)),
      isDuckDB: jest.fn().mockResolvedValue(true),
      queryDuckDB: jest.fn((sourceId, sql, bindings) =>
        worker.query(files.get(sourceId), sql, bindings),
      ),
    };
    ai = new AiDashboardService({} as any, connection, db.getRepository(Dashboard));
    const access = new SourceAccessService(db);
    const bi = new BiService(db, access, connection, ai);
    const pivots = new StudioPivotService(
      db,
      new BiExploreService(bi, ai, connection),
      new BiSegmentService(bi, connection),
      access,
      connection,
    );
    studio = new StudioService(db, ai, connection, access, pivots);
  });
  beforeEach(async () => {
    id = (await ai.save({ draft: draft() }, 7)).data.id;
  });
  afterAll(async () => {
    await worker?.onModuleDestroy();
    await db?.destroy();
    fs.rmSync(root, { recursive: true, force: true });
    if (previous === undefined) delete process.env.FILE_UPLOAD_DIR;
    else process.env.FILE_UPLOAD_DIR = previous;
  });
  const save = async (doc: any, requestId = 'request1-' + id, expectedRevision = doc.revision) =>
    studio.save(
      id,
      {
        requestId,
        expectedRevision,
        expectedSourceRevision: sourceRevision,
        document: doc,
      },
      7,
    );
  const savedPivot = async () => {
    const initial = await studio.get(id, 7);
    const bi = new BiService(db, new SourceAccessService(db), connection, ai);
    const metric = await bi.createMetric(
      {
        sourceId: 1,
        label: 'Pivot revenue',
        aggregation: 'SUM',
        column: 'amount',
        unit: 'USD',
        decimalPlaces: 2,
        numberNotation: 'plain',
      },
      7,
    );
    const catalog = await new BiExploreService(bi, ai, connection).catalog({ sourceId: 1 }, 7);
    const state = {
      version: 1,
      mode: 'segment',
      segment: {
        dimensionColumn: 'category',
        pivotColumn: 'pivot_axis',
        conditions: [{ measureId: metric.id, operator: 'gte', value: 250 }],
      },
      measureIds: [metric.id],
      dimensionColumns: ['category'],
      rankingMeasureId: metric.id,
      leaderboardSort: { by: 'value', direction: 'desc' },
      filters: [],
      dateRange: null,
      relativePeriod: null,
      trendGrain: 'day',
      comparePrevious: false,
      includeRows: false,
    };
    await db.manager.save(PersonalView, {
      sourceId: 1,
      userId: 7,
      dashboardId: null,
      name: 'Qualified pivot',
      revision: catalog.viewRevision,
      state: JSON.stringify(state),
    });
    return { initial, metric };
  };
  it('SP01/03 keeps an interleaved Pivot atomic across preview/save/import/copy without SQL widgets', async () => {
    const { initial, metric } = await savedPivot();
    const counts = await db.manager.count(Dashboard);
    const option = (await studio.pivotOptions(id, 7)).options[0];
    expect(option.name).toBe('Qualified pivot');
    expect(option.block.measureRefs).toEqual([{ id: metric.id, definitionVersion: '1' }]);
    expect(await db.manager.count(Dashboard)).toBe(counts);
    const document = applyStudioOperation(initial.document, {
      type: 'addBlock',
      block: option.block,
    });
    document.blocks.splice(1, 0, document.blocks.pop());
    const preview = await studio.prepare(
      id,
      {
        document,
        expectedRevision: initial.document.revision,
        expectedSourceRevision: sourceRevision,
      },
      7,
    );
    expect(preview.preview.widgets.map(w => w.type)).toEqual([
      'BOARD_NUMERIC',
      'SEGMENT_PIVOT',
      'CHART_COLUMN',
    ]);
    expect(preview.preview.draft.widgets).toHaveLength(2);
    expect(preview.preview.widgets[1].pivot.kpis[0].value).toBe(300);
    expect(JSON.stringify(preview.preview.widgets[1])).not.toMatch(/details|SELECT/);
    const saved = await save(document);
    expect(saved.document.blocks[1].id).not.toMatch(/^new:/);
    expect((await studio.get(id, 7)).document).toEqual(saved.document);
    await db.manager.delete(StudioState, { dashboardId: id });
    const imported = await studio.get(id, 7);
    expect(imported.document.blocks).toEqual(saved.document.blocks);
    expect(imported.document.layouts).toEqual(saved.document.layouts);
    const body = {
      requestId: 'copy-' + id,
      expectedRevision: saved.document.revision,
      expectedSourceRevision: sourceRevision,
    };
    const copy = await studio.copy(id, body, 7);
    expect(copy.dashboardId).not.toBe(id);
    expect(copy.document.blocks.map(b => b.kind)).toEqual([
      'BOARD_NUMERIC',
      'SEGMENT_PIVOT',
      'CHART_COLUMN',
    ]);
    expect(
      copy.document.blocks.every(b => !saved.document.blocks.some(old => old.id === b.id)),
    ).toBe(true);
    expect((await studio.get(copy.dashboardId, 7)).document).toEqual(copy.document);
    expect(await studio.copy(id, body, 7)).toEqual(copy);
    await expect(studio.copy(id, { ...body, title: 'different' }, 7)).rejects.toThrow();
    const publication = new StudioPublicationService(db, studio, new SourceAccessService(db));
    const sanitized = (publication as any).sanitize(
      saved.document,
      (await studio.get(id, 7)).preview,
    );
    expect(sanitized.blocks[1].pivot.kpis[0].id).toBe(1);
    expect(JSON.stringify(sanitized)).not.toMatch(
      /sourceId|measureId|definition|SELECT|filters.*gte/,
    );
  });
  it('SP05 rejects Pivot-only, forged references/SQL, row AST, stale source and legacy writes without losing the saved recipe', async () => {
    const { initial, metric } = await savedPivot();
    const option = (await studio.pivotOptions(id, 7)).options[0];
    const document = applyStudioOperation(initial.document, {
      type: 'addBlock',
      block: option.block,
    });
    const request = {
      document,
      expectedRevision: initial.document.revision,
      expectedSourceRevision: sourceRevision,
    };
    const only = {
      ...document,
      blocks: [option.block],
      layouts: Object.fromEntries(
        ['lg', 'md', 'xs'].map(bp => [
          bp,
          document.layouts[bp].filter(g => g.id === option.block.id),
        ]),
      ),
    };
    await expect(studio.prepare(id, { ...request, document: only }, 7)).rejects.toThrow(
      '마지막 차트',
    );
    await expect(save(only)).rejects.toThrow('마지막 차트');
    const forged = JSON.parse(JSON.stringify(document));
    forged.blocks[2].measureRefs[0].definitionVersion = '999';
    await expect(studio.prepare(id, { ...request, document: forged }, 7)).rejects.toThrow();
    forged.blocks[2] = JSON.parse(JSON.stringify(option.block));
    forged.blocks[2].pivot.sql = 'SELECT secret';
    await expect(save(forged)).rejects.toThrow();
    await expect(
      studio.prepare(
        id,
        {
          ...request,
          document: {
            ...document,
            conditions: { sourceRevision, definition: { include: null, exclude: null } },
          },
        },
        7,
      ),
    ).rejects.toThrow('AST');
    const badRecipe = JSON.parse(JSON.stringify(document));
    badRecipe.blocks[2].pivot.state.segment.conditions[0].value = 999;
    await expect(studio.prepare(id, { ...request, document: badRecipe }, 7)).rejects.toThrow(
      '저장',
    );
    const saved = await save(document);
    const count = await db.manager.count(Widget);
    const analysis = (await ai.analysis(id, 7, true)).data;
    await expect(
      ai.save({ dashboardId: id, expectedRevision: saved.document.revision, draft: analysis }, 7),
    ).rejects.toThrow('Studio');
    expect(await db.manager.count(Widget)).toBe(count);
    await expect(studio.captureRemix(id, 7)).rejects.toThrow('SEGMENT_PIVOT_UNSUPPORTED');
    await expect(
      studio.prepare(
        id,
        {
          ...request,
          document: saved.document,
          expectedRevision: saved.document.revision,
          expectedSourceRevision: 'f'.repeat(64),
        },
        7,
      ),
    ).rejects.toThrow();
    const original = await db.manager.findOne(Metric, { where: { id: metric.id } });
    await db.manager.update(
      Metric,
      { id: metric.id },
      { definition: original.definition.replace('"definitionVersion":1', '"definitionVersion":2') },
    );
    expect((await studio.pivotOptions(id, 7)).options).toHaveLength(0);
    await expect(
      studio.prepare(
        id,
        { ...request, document: saved.document, expectedRevision: saved.document.revision },
        7,
      ),
    ).rejects.toThrow();
  });
  it('SP03/05 copy rejects stale token, epoch revocation during calculation and deleted-copy receipt replay', async () => {
    const initial = await studio.get(id, 7);
    const body = {
      requestId: 'guard-copy-' + id,
      expectedRevision: initial.document.revision,
      expectedSourceRevision: sourceRevision,
    };
    await expect(studio.copy(id, body, 7, 9)).rejects.toThrow();
    const count = await db.manager.count(Dashboard);
    const preview = ai.prepareSave.bind(ai);
    const spy = jest.spyOn(ai, 'prepareSave').mockImplementation(async (...args) => {
      const prepared = await preview(...args);
      await db.manager.update(User, { id: 7 }, { authVersion: 1 });
      return prepared;
    });
    await expect(studio.copy(id, body, 7, 0)).rejects.toThrow();
    spy.mockRestore();
    expect(await db.manager.count(Dashboard)).toBe(count);
    await db.manager.update(User, { id: 7 }, { authVersion: 0 });
    const copy = await studio.copy(id, body, 7, 0);
    await db.manager.update(Dashboard, { id: copy.dashboardId }, { delYn: 'Y' });
    await expect(studio.copy(id, body, 7, 0)).rejects.toThrow();
  });

  it('SP01/02 margin oracle keeps five charts plus canonical non-additive Pivot, publishes a static anonymous snapshot', async () => {
    const file = await worker.importFile({
      originalname: 'margin.csv',
      buffer: fs.readFileSync(
        path.resolve(__dirname, '../../../samples/rill-scenarios/data/margin.csv'),
      ),
    });
    files.set(2, file.filename);
    versions.set(2, createHash('sha256').update(file.filename).digest('hex'));
    await db.manager.save(Database, {
      id: 2,
      ownerId: 7,
      name: 'Margin',
      connectionConfig: JSON.stringify({
        client: 'duckdb',
        connection: { filename: file.filename },
      }),
      engine: 'duckdb',
      type: 'FILE',
    });
    const bi = new BiService(db, new SourceAccessService(db), connection, ai);
    const revenue = await bi.createMetric(
      {
        sourceId: 2,
        label: 'Revenue',
        aggregation: 'SUM',
        column: 'revenue',
        unit: 'USD',
        decimalPlaces: 2,
        numberNotation: 'plain',
      },
      7,
    );
    const profit = await bi.createMetric(
      {
        sourceId: 2,
        label: 'Profit',
        aggregation: 'SUM',
        column: 'profit',
        unit: 'USD',
        decimalPlaces: 2,
        numberNotation: 'plain',
      },
      7,
    );
    const margin = await bi.createMetric(
      {
        sourceId: 2,
        label: 'Margin',
        aggregation: 'RATIO_SUM',
        column: 'profit',
        denominatorColumn: 'revenue',
        scale: 100,
        unit: '%',
        decimalPlaces: 2,
        numberNotation: 'plain',
      },
      7,
    );
    const chart = {
      title: 'Revenue',
      description: '',
      type: 'BOARD_NUMERIC',
      sql: 'SELECT sum(revenue) AS value FROM source',
      valueField: 'value',
    };
    const dashboardId = (
      await ai.save(
        {
          draft: {
            databaseId: 2,
            title: 'Margin five charts',
            explanation: '',
            widgets: Array.from({ length: 5 }, (_, i) => ({ ...chart, title: 'Chart ' + i })),
          },
        },
        7,
      )
    ).data.id;
    const catalog = await new BiExploreService(bi, ai, connection).catalog({ sourceId: 2 }, 7);
    const state = {
      version: 1,
      mode: 'segment',
      segment: {
        dimensionColumn: 'company',
        pivotColumn: 'component',
        conditions: [
          { measureId: revenue.id, operator: 'gte', value: 1000 },
          { measureId: margin.id, operator: 'lt', value: 20 },
        ],
      },
      measureIds: [revenue.id, profit.id, margin.id],
      dimensionColumns: ['company'],
      rankingMeasureId: revenue.id,
      leaderboardSort: { by: 'value', direction: 'desc' },
      filters: [],
      dateRange: null,
      relativePeriod: null,
      trendGrain: 'day',
      comparePrevious: false,
      includeRows: false,
    };
    await db.manager.save(PersonalView, {
      sourceId: 2,
      userId: 7,
      dashboardId: null,
      name: 'Margin Pivot',
      revision: catalog.viewRevision,
      state: JSON.stringify(state),
    });
    const initial = await studio.get(dashboardId, 7);
    const block = (await studio.pivotOptions(dashboardId, 7)).options[0].block;
    const document = applyStudioOperation(initial.document, { type: 'addBlock', block });
    const before = await studio.prepare(
      dashboardId,
      {
        document,
        expectedRevision: initial.document.revision,
        expectedSourceRevision: versions.get(2),
      },
      7,
    );
    const pivot = before.preview.widgets[5].pivot;
    expect(pivot.scope.rows).toBe('8');
    expect(pivot.groups.map(g => g.category).sort()).toEqual(['Baro Tech', 'Hanul Foods']);
    expect(Number(pivot.kpis[0].value)).toBeCloseTo(5431.25, 8);
    expect(Number(pivot.kpis[1].value)).toBeCloseTo(292.79, 8);
    expect(Number(pivot.kpis[2].value)).toBeCloseTo(5.390840046029919, 10);
    const baro = pivot.pivot.rows
      .find(r => r.category === 'Baro Tech')
      .cells.find(c => c.column === 'Compute');
    expect(Number(baro.values[0].value)).toBeCloseTo(640.5, 8);
    expect(Number(baro.values[1].value)).toBeCloseTo(-81.9, 8);
    expect(Number(baro.values[2].value)).toBeCloseTo(-12.78688524590164, 9);
    const saved = await studio.save(
      dashboardId,
      {
        requestId: 'margin-save',
        expectedRevision: initial.document.revision,
        expectedSourceRevision: versions.get(2),
        document,
      },
      7,
    );
    const publication = new StudioPublicationService(
      db,
      studio,
      new SourceAccessService(db),
      connection,
    );
    const published = await publication.publish(
      dashboardId,
      {
        requestId: 'margin-publish',
        expectedRevision: saved.document.revision,
        visibility: 'link',
        allowRemix: false,
      },
      7,
    );
    const publicBefore = await publication.read(published.token);
    const result = publicBefore.snapshot.blocks[5].pivot;
    expect(result.kpis.map(k => k.id)).toEqual([1, 2, 3]);
    expect(Number(result.kpis[2].value)).toBeCloseTo(5.390840046029919, 10);
    expect(Object.keys(result).sort()).toEqual(
      ['groups', 'groupsTruncated', 'kpis', 'pivot', 'scope', 'trends', 'trendsTruncated'].sort(),
    );
    expect(JSON.stringify(result)).not.toMatch(
      /sourceRevision|viewRevision|details|conditions|filters|definition|SELECT/,
    );
    await expect(
      publication.publish(
        dashboardId,
        {
          requestId: 'margin-remix',
          expectedRevision: saved.document.revision,
          visibility: 'link',
          allowRemix: true,
        },
        7,
      ),
    ).rejects.toThrow('SEGMENT_PIVOT_UNSUPPORTED');
    const renamed = applyStudioOperation(saved.document, {
      type: 'updateBlock',
      blockId: saved.document.blocks[5].id,
      patch: { title: 'Edited private Pivot' },
    });
    await studio.save(
      dashboardId,
      {
        requestId: 'margin-rename',
        expectedRevision: saved.document.revision,
        expectedSourceRevision: versions.get(2),
        document: renamed,
      },
      7,
    );
    expect((await publication.read(published.token)).snapshot).toEqual(publicBefore.snapshot);
  });
});
