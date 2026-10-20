// Persistence paths are real; no model request is part of this fixture.
jest.mock('../ai/ai.service', () => ({ AiService: class {} }));
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { randomUUID } from 'crypto';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { DataSource, EntityManager } from 'typeorm';
import { semanticMetadata } from '../../test/util/semantic-mysql';
import { HttpExceptionFilter } from '../nest-utils/http-exception.filter';
import { BundleHandoverService } from './bundle-handover.service';
import { BundleHandoverController } from './bundle-handover.controller';
import { HandoverProposalService } from './handover-proposal.service';
import { EnterpriseBundleHandover } from './entities/enterprise-bundle-handover.entity';
import { EnterpriseHandoverProposal } from './entities/enterprise-handover-proposal.entity';
import { EnterpriseOrganization } from './entities/enterprise-organization.entity';
import { EnterpriseMembership } from './entities/enterprise-membership.entity';
import { EnterpriseAuditEvent } from './entities/enterprise-audit-event.entity';
import { EnterpriseResourceGrant } from './entities/enterprise-resource-grant.entity';
import { EnterpriseGroupGrant } from './entities/enterprise-group.entity';
import { User } from '../user/entities/user.entity';
import { Database } from '../database/entities/database.entity';
import { Metric, MetricAggregation } from '../metric/entities/metric.entity';
import { SourceCatalogEntry } from '../bi/entities/source-catalog-entry.entity';
import { SourceConditionEntry } from '../bi/entities/source-condition-entry.entity';
import { Dashboard } from '../dashboard/entities/dashboard.entity';
import { UserMapping } from '../user/entities/user-mapping.entity';
import { StudioState } from '../dashboard-studio/entities/studio-state.entity';
import { StudioExecution } from '../dashboard-studio/entities/studio-execution.entity';
import { DashboardPublication } from '../dashboard/entities/dashboard-publication.entity';
import { StudioPublication } from '../dashboard-studio/entities/studio-publication.entity';
import { PersonalView } from '../dashboard/entities/personal-view.entity';
import { ExploreView } from '../bi/entities/explore-view.entity';
import { Dataset } from '../dataset/entities/dataset.entity';
import { TableQuery } from '../widget/tabel-query/entity/table-query.entity';
import { CommerceSource } from '../commerce/entities/commerce-source.entity';
import { ExportJob } from '../bi/entities/export-job.entity';
import { FileRefresh } from '../database/entities/file-refresh.entity';
import { SourceDeleteReceipt } from '../database/entities/source-delete-receipt.entity';
import { SourceAccessService } from '../ownership/source-access.service';
import { DatabaseController } from '../database/database.controller';
import { DatabaseService } from '../database/database.service';
import { ConnectionService } from '../connection/connection.service';
import { DuckDBService } from '../analysis/duckdb.service';
import { parseConnectionConfig } from '../utils/crypto.util';
import { AddBundleHandover1792620100000 } from '../migrations/1792620100000-add-bundle-handover';

import { Widget } from '../widget/entities/widget.entity';
import { Component } from '../component/entities/component.entity';
import { DashboardWidget } from '../dashboard/dashboard-widget/entities/dashboard-widget.entity';
import { DatasetType } from '../common/enum/dataset-type.enum';
import { DashboardShare } from '../dashboard/entities/dashboard_share.entity';
import { BiDashboardPolicy } from '../bi/governance.entity';
import { EnterpriseDashboardDelivery } from './entities/enterprise-dashboard-delivery.entity';
import { EnterpriseGroupDelivery } from './entities/enterprise-group-delivery.entity';
import { sourceQuery, widgetOptions } from '../ai/dashboard-draft';
import { renderValidatedQueryBindings } from '../common/validated-query-bindings';
import { importStudio } from '../dashboard-studio/studio-legacy';
import { dashboardRevision } from '../dashboard/dashboard-revision';
import { inspectTransfer } from './handover-transfer-basis';
import { inspectSourceHandover } from './source-handover-basis';
import { AiDashboardService } from '../ai/ai-dashboard.service';
import { StudioService } from '../dashboard-studio/studio.service';
import { StudioRun } from '../dashboard-studio/entities/studio-run.entity';
const entities = [
  User,
  EnterpriseOrganization,
  EnterpriseMembership,
  Database,
  Metric,
  SourceCatalogEntry,
  SourceConditionEntry,
  Dashboard,
  UserMapping,
  StudioState,
  StudioRun,
  StudioExecution,
  DashboardPublication,
  StudioPublication,
  PersonalView,
  ExploreView,
  Dataset,
  TableQuery,
  CommerceSource,
  ExportJob,
  FileRefresh,
  SourceDeleteReceipt,
  EnterpriseResourceGrant,
  EnterpriseGroupGrant,
  EnterpriseDashboardDelivery,
  EnterpriseGroupDelivery,
  DashboardShare,
  BiDashboardPolicy,
  Widget,
  Component,
  DashboardWidget,
  EnterpriseAuditEvent,
  EnterpriseHandoverProposal,
  EnterpriseBundleHandover,
];
describe('UC051 atomic source and connected Studio dashboard bundle', () => {
  jest.setTimeout(30000);
  let db: DataSource,
    app: INestApplication,
    intent: HandoverProposalService,
    service: BundleHandoverService,
    files: DatabaseService,
    worker: DuckDBService,
    root: string,
    sourceId: number;
  const filenames: string[] = [];
  const jwt = new JwtService(),
    oldSecret = process.env.ACCESS_SECRET,
    oldRoot = process.env.FILE_UPLOAD_DIR;
  const token = (id = 1, epoch = 0) =>
    jwt.sign(
      { accessKeyData: { id, userId: `bundle-${id}`, authVersion: epoch } },
      { secret: process.env.ACCESS_SECRET },
    );
  const http = (method: 'get' | 'post', route: string, actor = 1, body?: any, epoch = 0) => {
    const r = request(app.getHttpServer())
      [method]('/enterprise/handover/' + route)
      .set('Authorization', 'Bearer ' + token(actor, epoch));
    return body === undefined ? r : r.send(body);
  };
  const terms = (row: any) => ({
    expectedVersion: row.version,
    reviewBasis: row.reviewBasis,
    acknowledgedTransfer: true,
  });
  const snapshot = () =>
    Promise.all(
      entities.map(e =>
        db.getRepository(e).find({
          order: Object.fromEntries(
            db.getMetadata(e).primaryColumns.map(c => [c.propertyName, 'ASC']),
          ),
        }),
      ),
    );
  const fileState = () =>
    Promise.all(
      filenames
        .flatMap(f => [f, path.join(path.dirname(f), 'import.json')])
        .map(async f => {
          const stat = await fs.stat(f, { bigint: true });
          return {
            bytes: (await fs.readFile(f)).toString('base64'),
            mtime: String(stat.mtimeNs),
            ino: String(stat.ino),
          };
        }),
    );
  const upload = async (name = 'bundle-source') => {
    const result = (
      await request(app.getHttpServer())
        .post('/database/upload')
        .set('Authorization', 'Bearer ' + token())
        .attach('file', Buffer.from('amount,channel\n10,a\n20,b\n'), name + '.csv')
        .expect(201)
    ).body;
    const source = await db.manager.findOneBy(Database, { id: result.data.id });
    expect(source.type).toBe('duckdb');
    filenames.push(parseConnectionConfig(source.connectionConfig).connection.filename);
    return source.id;
  };
  const board = async (id = 101, source = sourceId) => {
    const definition = {
      blockId: 'block-' + randomUUID(),
      title: 'Total',
      description: 'Synthetic',
      type: 'BOARD_NUMERIC' as const,
      sql: 'SELECT sum(amount) AS value FROM source',
      valueField: 'value',
      decimalPlaces: 0,
    };
    const draft = {
      databaseId: source,
      title: 'Board ' + id,
      explanation: '',
      widgets: [definition],
    };
    const query = sourceQuery(definition.sql, []);
    const dataset = await db.manager.save(Dataset, {
      databaseId: source,
      title: definition.title,
      query: renderValidatedQueryBindings(query.sql, query.bindings),
    });
    const widget = await db.manager.save(Widget, {
      title: definition.title,
      description: definition.description,
      componentId: 51,
      datasetType: DatasetType.DATASET,
      datasetId: dataset.id,
      option: JSON.stringify(widgetOptions(definition)),
    });
    const geometry = { x: 0, y: 0, w: 6, h: 2 };
    const dashboard = await db.manager.save(Dashboard, {
      id,
      title: draft.title,
      analysisDefinition: JSON.stringify(draft),
      layout: JSON.stringify([{ i: String(widget.id), ...geometry }]),
    });
    await db.manager.save(UserMapping, { dashboardId: id, userInfoId: 1 });
    await db.manager.save(DashboardWidget, { dashboardId: id, widgetId: widget.id });
    const document = importStudio(
      id,
      {
        ...draft,
        revision: dashboardRevision(dashboard),
        blockLayouts: { [definition.blockId]: geometry },
      },
      null,
      'a'.repeat(64),
    );
    await db.manager.save(StudioState, {
      dashboardId: id,
      document: JSON.stringify({ document, sourceRevision: 'a'.repeat(64) }),
      legacyRevision: dashboardRevision(dashboard),
    });
    return { dashboard, widget, dataset };
  };
  const proposal = async (assets?: any[]) => {
    assets ??= [
      { kind: 'source', id: sourceId, title: 'bundle-source' },
      { kind: 'dashboard', id: 101, title: 'Board 101' },
    ];
    const p = await intent.create(1, 0, { requestId: randomUUID(), recipientId: 2, assets });
    return intent.accept(p.requestId, 2, 0, {
      expectedVersion: p.version,
      reviewBasis: p.reviewBasis,
    });
  };
  const prepare = async (p?: any) => {
    p ??= await proposal();
    const review = (await http('get', p.requestId + '/bundle-transfer-review').expect(200)).body;
    expect(review).toMatchObject({ eligible: true, blockers: [] });
    const body = {
      requestId: randomUUID(),
      expectedProposalVersion: p.version,
      basis: review.basis,
      acknowledgedTransfer: true,
    };
    return {
      p,
      body,
      row: (await http('post', p.requestId + '/bundle-transfer', 1, body).expect(201)).body,
    };
  };
  const retained = async () => {
    const link = await db.manager.findOneBy(DashboardWidget, { dashboardId: 101 });
    const w = await db.manager.findOneBy(Widget, { id: link.widgetId });
    const d = await db.manager.findOneBy(Dataset, { id: w.datasetId });
    const older = await db.manager.save(Dataset, {
      databaseId: d.databaseId,
      title: d.title,
      query: d.query,
    });
    const widget = await db.manager.save(Widget, {
      title: w.title,
      description: w.description,
      componentId: w.componentId,
      datasetType: w.datasetType,
      datasetId: older.id,
      option: w.option,
      delYn: w.delYn,
    });
    return { widget, dataset: older };
  };
  beforeAll(async () => {
    process.env.ACCESS_SECRET = 'synthetic-bundle-secret';
    db = await semanticMetadata('handover', {
      type: 'sqlite',
      database: ':memory:',
      entities,
      synchronize: true,
    });
    intent = new HandoverProposalService(db);
    service = new BundleHandoverService(db, intent);
    files = new DatabaseService(
      db.getRepository(Database),
      undefined,
      db.getRepository(Dataset),
      db.getRepository(TableQuery),
      {} as any,
    );
    const module = await Test.createTestingModule({
      controllers: [BundleHandoverController, DatabaseController],
      providers: [
        { provide: BundleHandoverService, useValue: service },
        { provide: JwtService, useValue: jwt },
        { provide: DataSource, useValue: db },
        { provide: SourceAccessService, useValue: new SourceAccessService(db) },
        { provide: DatabaseService, useValue: files },
        { provide: ConnectionService, useValue: {} },
      ],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    await app.listen(0, '127.0.0.1');
  });
  afterAll(async () => {
    await app?.close();
    await db?.destroy();
    if (oldSecret === undefined) delete process.env.ACCESS_SECRET;
    else process.env.ACCESS_SECRET = oldSecret;
    if (oldRoot === undefined) delete process.env.FILE_UPLOAD_DIR;
    else process.env.FILE_UPLOAD_DIR = oldRoot;
  });
  beforeEach(async () => {
    root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'vm-bundle-')));
    process.env.FILE_UPLOAD_DIR = root;
    filenames.length = 0;
    worker = new DuckDBService();
    (files as any).duckdbService = worker;
    for (const e of [...entities].reverse())
      await db.getRepository(e).createQueryBuilder().delete().execute();
    await db.manager.insert(
      User,
      [1, 2, 3, 4].map(id => ({
        id,
        userId: `bundle-${id}`,
        email: `bundle-${id}@example.invalid`,
        password: 'synthetic',
        active: true,
        authVersion: 0,
      })),
    );
    await db.manager.insert(EnterpriseOrganization, [
      { id: 10, name: 'Synthetic', version: 1 },
      { id: 20, name: 'Other', version: 1 },
    ]);
    await db.manager.insert(
      EnterpriseMembership,
      [1, 2, 3, 4].map(userId => ({
        userId,
        organizationId: userId === 4 ? 20 : 10,
        role: 'admin' as const,
        team: '',
      })),
    );
    await db.manager.insert(Component, {
      id: 51,
      type: 'BOARD_NUMERIC',
      title: 'Number',
      option: '{}',
    });
    sourceId = await upload();
    await board();
    await db.manager.insert(Metric, {
      databaseId: sourceId,
      name: 'bundle_sum',
      tableName: 'uploaded_data',
      aggregation: MetricAggregation.SUM,
      expression: 'amount',
      definition: JSON.stringify({
        schemaVersion: 1,
        sourceId,
        definitionVersion: 1,
        aggregation: 'SUM',
        column: 'amount',
      }),
    });
    await db.manager.insert(SourceCatalogEntry, {
      sourceId,
      version: 1,
      actorId: 1,
      schemaRevision: 'a'.repeat(64),
      sourceRevision: 'a'.repeat(64),
      metadata: '{"title":"Synthetic"}',
    });
    await db.manager.insert(SourceConditionEntry, {
      sourceId,
      version: 1,
      actorId: 1,
      sourceRevision: 'a'.repeat(64),
      definition: '{"version":1,"groups":[]}',
    });
  });
  afterEach(async () => {
    jest.restoreAllMocks();
    await worker?.onModuleDestroy();
    await fs.rm(root, { recursive: true, force: true });
  });
  it('protects exact HTTP contract and never writes on review/detail', async () => {
    await request(app.getHttpServer())
      .get('/enterprise/handover/' + randomUUID() + '/bundle-transfer')
      .expect(401);
    await http('get', 'bad/bundle-transfer').expect(400);
    await http('get', randomUUID() + '/bundle-transfer').expect(404);
    const p = await proposal();
    await http('get', p.requestId + '/bundle-transfer').expect(404);
    await http('get', p.requestId + '/bundle-transfer-review', 2).expect(403);
    await http('get', p.requestId + '/bundle-transfer', 3).expect(403);
    const before = await snapshot(),
      f = await fileState();
    const review = (await http('get', p.requestId + '/bundle-transfer-review').expect(200)).body;
    expect(Object.keys(review).sort()).toEqual(
      [
        'proposalId',
        'organizationId',
        'ownerId',
        'recipientId',
        'proposalVersion',
        'checkedAt',
        'basis',
        'eligible',
        'blockers',
        'sources',
        'dashboards',
      ].sort(),
    );
    expect(review).toMatchObject({
      eligible: true,
      sources: [{ id: sourceId, title: 'bundle-source', filesChecked: 1, metricCount: 1 }],
      dashboards: [{ id: 101, title: 'Board 101' }],
    });
    expect(await snapshot()).toEqual(before);
    expect(await fileState()).toEqual(f);
    const { row } = await prepare(p);
    expect(Object.keys(row).sort()).toEqual(
      [
        'proposalId',
        'requestId',
        'organizationId',
        'ownerId',
        'recipientId',
        'version',
        'status',
        'reviewBasis',
        'expiresAt',
        'acceptedAt',
        'completedAt',
        'detailsAvailable',
        'sources',
        'dashboards',
        'replayed',
      ].sort(),
    );
    const stable = await snapshot();
    await http('get', p.requestId + '/bundle-transfer', 2).expect(200);
    expect(await snapshot()).toEqual(stable);
  });
  it('atomically transfers uploaded source and canonical Studio graph preserving bytes/config/IDs and historical equivalent children', async () => {
    await retained();
    const { p, row, body } = await prepare();
    await http('post', p.requestId + '/bundle-transfer/execute', 1, terms(row)).expect(409);
    const accepted = (
      await http('post', p.requestId + '/bundle-transfer/accept', 2, terms(row)).expect(201)
    ).body;
    const before = await snapshot(),
      f = await fileState();
    const done = (
      await http('post', p.requestId + '/bundle-transfer/execute', 1, terms(accepted)).expect(201)
    ).body;
    expect(done).toMatchObject({ status: 'completed', version: 3 });
    expect(await db.manager.findOneBy(Database, { id: sourceId })).toMatchObject({
      ownerId: 2,
      catalogVersion: 1,
    });
    expect(await db.manager.findOneBy(UserMapping, { dashboardId: 101 })).toMatchObject({
      userInfoId: 2,
    });
    const b = await db.manager.findOneBy(Dashboard, { id: 101 });
    expect(b.assetVersion).toBe(1);
    const studio = await db.manager.findOneBy(StudioState, { dashboardId: 101 });
    expect(studio.legacyRevision).toBe(dashboardRevision(b));
    expect(studio.document).toBe((before[entities.indexOf(StudioState)] as any[])[0].document);
    for (const e of [
      Metric,
      SourceCatalogEntry,
      SourceConditionEntry,
      Dataset,
      Widget,
      DashboardWidget,
    ])
      expect((await snapshot())[entities.indexOf(e)]).toEqual(before[entities.indexOf(e)]);
    expect((await db.manager.findOneBy(Database, { id: sourceId })).connectionConfig).toBe(
      (before[entities.indexOf(Database)] as any[])[0].connectionConfig,
    );
    expect(await fileState()).toEqual(f);
    const access = new SourceAccessService(db);
    await expect(access.dashboard(101, 1, 'owner')).rejects.toMatchObject({ status: 403 });
    await access.dashboard(101, 2, 'owner');
    await request(app.getHttpServer())
      .get('/database/info/' + sourceId)
      .set('Authorization', 'Bearer ' + token())
      .expect(403);
    await request(app.getHttpServer())
      .get('/database/info/' + sourceId)
      .set('Authorization', 'Bearer ' + token(2))
      .expect(200);
    const stable = await snapshot();
    expect(await service.prepare(p.requestId, 1, 0, body)).toEqual({ ...done, replayed: true });
    expect(await service.change(p.requestId, 1, 0, terms(accepted), 'execute')).toEqual({
      ...done,
      replayed: true,
    });
    expect(await snapshot()).toEqual(stable);
  });
  it('accepts real AI-save then Studio-save retained generated children and keeps Studio readable for the recipient', async () => {
    await db.manager.delete(SourceCatalogEntry, { sourceId });
    await db.manager.delete(SourceConditionEntry, { sourceId });
    const filename = filenames[0],
      revision = 'a'.repeat(64);
    const connection = {
      withDuckDBSnapshot: (_id: number, run: any) => run(),
      captureDuckDBSnapshot: async () => ({ run: async (callback: any) => callback() }),
      duckDBVersion: async () => revision,
      isDuckDB: async () => true,
      queryDuckDB: (_id: number, sql: string, bindings?: any[]) =>
        worker.query(filename, sql, bindings),
    };
    const ai = new AiDashboardService({} as any, connection as any, db.getRepository(Dashboard));
    const studio = new StudioService(db, ai, connection as any, new SourceAccessService(db));
    const saved = await ai.save(
      {
        draft: {
          databaseId: sourceId,
          title: 'Real AI board',
          explanation: '',
          widgets: [
            {
              title: 'Total',
              description: 'Synthetic',
              type: 'BOARD_NUMERIC',
              sql: 'SELECT sum(amount) AS value FROM source',
              valueField: 'value',
              decimalPlaces: 0,
            },
          ],
        },
      },
      1,
    );
    const id = saved.data.id;
    const initial = await studio.get(id, 1);
    await studio.save(
      id,
      {
        requestId: randomUUID(),
        expectedRevision: initial.document.revision,
        expectedSourceRevision: revision,
        document: initial.document,
      },
      1,
    );
    const currentLinks = new Set(
      (await db.manager.find(DashboardWidget)).map(link => link.widgetId),
    );
    expect(
      (await db.manager.find(Widget)).filter(widget => !currentLinks.has(widget.id)).length,
    ).toBeGreaterThan(0);
    const p = await proposal([
      { kind: 'source', id: sourceId, title: 'bundle-source' },
      { kind: 'dashboard', id: 101, title: 'Board 101' },
      { kind: 'dashboard', id, title: 'Real AI board' },
    ]);
    const { row } = await prepare(p);
    const accepted = await service.change(p.requestId, 2, 0, terms(row), 'accept');
    const before = await snapshot(),
      filesBefore = await fileState();
    await service.change(p.requestId, 1, 0, terms(accepted), 'execute');
    await expect(studio.get(id, 1)).rejects.toMatchObject({ status: 403 });
    const received = await studio.get(id, 2);
    expect(received.document.blocks).toEqual(initial.document.blocks);
    expect(received.document.layouts).toEqual(initial.document.layouts);
    for (const entity of [Widget, Dataset, StudioRun])
      expect((await snapshot())[entities.indexOf(entity)]).toEqual(
        before[entities.indexOf(entity)],
      );
    expect(await fileState()).toEqual(filesBefore);
  });
  it('standalone helpers remain strict and reject unverified exception objects', async () => {
    const manifest = [{ kind: 'dashboard', id: 101, title: 'Board 101' }];
    expect((await inspectTransfer(db.manager, manifest, 2)).blockers).toContain(
      'recipient_source_ownership_required',
    );
    expect(
      (
        await inspectSourceHandover(
          db.manager,
          [{ kind: 'source', id: sourceId, title: 'bundle-source' }],
          false,
        )
      ).blockers,
    ).toContain('source_in_use');
    await expect(inspectSourceHandover(db.manager, [], false, {} as any)).rejects.toThrow(
      'Unverified',
    );
  });
  it.each([
    'source-only',
    'dashboard-only',
    'unselected-source',
    'unused-source',
    'external-dashboard',
    'orphan-dataset',
    'orphan-table',
    'shared-widget',
    'shared-dataset',
    'changed-retained',
    'retained-other-board',
    'personal-view',
    'source-grant',
    'dashboard-grant',
    'publication',
    'external-file',
  ])('blocks %s without broad ignore or leaking unselected identities', async kind => {
    let assets: any[] = [
      { kind: 'source', id: sourceId, title: 'bundle-source' },
      { kind: 'dashboard', id: 101, title: 'Board 101' },
    ];
    if (kind === 'source-only') assets = assets.slice(0, 1);
    if (kind === 'dashboard-only') assets = assets.slice(1);
    if (kind === 'unselected-source') {
      const second = await upload('outside');
      await board(102, second);
      assets.push({ kind: 'dashboard', id: 102, title: 'Board 102' });
    }
    if (kind === 'unused-source') {
      const second = await upload('unused');
      assets.push({ kind: 'source', id: second, title: 'unused' });
    }
    if (kind === 'external-dashboard') await board(102);
    if (kind === 'orphan-dataset')
      await db.manager.insert(Dataset, {
        databaseId: sourceId,
        title: 'Orphan',
        query: 'SELECT 1',
      });
    if (kind === 'orphan-table')
      await db.manager.insert(TableQuery, { databaseId: sourceId, query: 'SELECT 1' });
    if (kind === 'shared-widget') {
      await db.manager.insert(Dashboard, { id: 102, title: 'Other' });
      const link = await db.manager.findOneBy(DashboardWidget, { dashboardId: 101 });
      await db.manager.insert(DashboardWidget, { dashboardId: 102, widgetId: link.widgetId });
    }
    if (kind === 'shared-dataset') {
      const { widget, dataset } = await retained();
      await db.manager.insert(Widget, {
        title: 'Other',
        componentId: 51,
        datasetType: DatasetType.DATASET,
        datasetId: dataset.id,
        option: widget.option,
      });
    }
    if (kind === 'changed-retained') {
      const { widget } = await retained();
      await db.manager.update(Widget, widget.id, { title: 'Changed' });
    }
    if (kind === 'retained-other-board') {
      const { widget } = await retained();
      await db.manager.insert(Dashboard, { id: 102, title: 'Other' });
      await db.manager.insert(DashboardWidget, { dashboardId: 102, widgetId: widget.id });
    }
    if (kind === 'personal-view')
      await db.manager.insert(PersonalView, {
        dashboardId: 101,
        userId: 1,
        name: 'View',
        revision: 'a'.repeat(64),
        state: '{}',
      });
    if (['source-grant', 'dashboard-grant'].includes(kind))
      await db.manager.insert(EnterpriseResourceGrant, {
        resourceKind: kind === 'source-grant' ? 'source' : 'dashboard',
        resourceId: kind === 'source-grant' ? sourceId : 101,
        recipientId: 3,
        organizationId: 10,
        ownerId: 1,
        version: 1,
        read: true,
      });
    if (kind === 'publication')
      await db.manager.insert(DashboardPublication, {
        dashboardId: 101,
        sourceId,
        uuid: randomUUID(),
        version: 1,
        dashboardRevision: 'a'.repeat(64),
        snapshot: '{}',
        publishedAt: new Date().toISOString(),
        expiresAt: new Date().toISOString(),
        active: true,
        requestId: randomUUID(),
        payloadDigest: 'a'.repeat(64),
      });
    if (kind === 'external-file')
      await db.manager.update(Database, sourceId, {
        engine: 'mysql2',
        type: 'mysql',
        connectionConfig: '{}',
      });
    const p = await proposal(assets),
      before = await snapshot();
    const r = (await http('get', p.requestId + '/bundle-transfer-review').expect(200)).body;
    expect(r.eligible).toBe(false);
    expect(r.blockers.length).toBeGreaterThan(0);
    expect(await snapshot()).toEqual(before);
  });
  it('rolls back both source and dashboard changes when mapping update fails', async () => {
    const { p, row } = await prepare();
    const accepted = await service.change(p.requestId, 2, 0, terms(row), 'accept');
    const before = await snapshot(),
      f = await fileState();
    const original = EntityManager.prototype.update;
    jest
      .spyOn(EntityManager.prototype, 'update')
      .mockImplementation(function (e: any, c: any, v: any) {
        if (e === UserMapping) throw new Error('Synthetic mapping failure');
        return original.call(this, e, c, v);
      });
    await expect(service.change(p.requestId, 1, 0, terms(accepted), 'execute')).rejects.toThrow(
      'Synthetic mapping failure',
    );
    expect(await snapshot()).toEqual(before);
    expect(await fileState()).toEqual(f);
  });
  it('rolls back every selected source/dashboard on a late completion audit failure', async () => {
    const second = await upload('second');
    await board(102, second);
    const { p, row } = await prepare(
      await proposal([
        { kind: 'source', id: sourceId, title: 'bundle-source' },
        { kind: 'source', id: second, title: 'second' },
        { kind: 'dashboard', id: 101, title: 'Board 101' },
        { kind: 'dashboard', id: 102, title: 'Board 102' },
      ]),
    );
    const accepted = await service.change(p.requestId, 2, 0, terms(row), 'accept');
    const before = await snapshot();
    const original = EntityManager.prototype.insert;
    jest.spyOn(EntityManager.prototype, 'insert').mockImplementation(function (e: any, b: any) {
      if (e === EnterpriseAuditEvent && b.action === 'handover.bundle.completed')
        throw new Error('Synthetic audit failure');
      return original.call(this, e, b);
    });
    await expect(service.change(p.requestId, 1, 0, terms(accepted), 'execute')).rejects.toThrow(
      'Synthetic audit failure',
    );
    expect(await snapshot()).toEqual(before);
  });
  it.each(['accept', 'execute'] as const)(
    '%s rejects final expiry after a Dashboard parent await',
    async action => {
      const { p, row } = await prepare();
      const current =
        action === 'execute' ? await service.change(p.requestId, 2, 0, terms(row), 'accept') : row;
      const before = await snapshot();
      const original = EntityManager.prototype.findOne;
      let entered: () => void, release: () => void;
      const held = new Promise<void>(r => (entered = r)),
        gate = new Promise<void>(r => (release = r));
      let paused = false;
      jest
        .spyOn(EntityManager.prototype, 'findOne')
        .mockImplementation(async function (e: any, o: any) {
          const r = await original.call(this, e, o);
          if (
            !paused &&
            e === Dashboard &&
            o.where?.id === 101 &&
            this.queryRunner?.isTransactionActive
          ) {
            paused = true;
            entered();
            await gate;
          }
          return r;
        });
      const changing = service
        .change(p.requestId, action === 'accept' ? 2 : 1, 0, terms(current), action)
        .then(
          v => ({ v }),
          e => ({ e }),
        );
      try {
        await held;
        jest.spyOn(Date, 'now').mockReturnValue(Date.parse(current.expiresAt) + 1);
        release();
        expect(((await changing) as any).e).toMatchObject({ status: 409 });
        expect(await snapshot()).toEqual(before);
      } finally {
        release();
        await changing;
      }
    },
  );
  it('redacts both arrays on expired/cancelled/epoch history and preserves accepted replay', async () => {
    const { p, row } = await prepare();
    const accepted = await service.change(p.requestId, 2, 0, terms(row), 'accept');
    await db.manager.update(User, 2, { authVersion: 1 });
    const cancelled = await service.change(p.requestId, 1, 0, terms(accepted), 'cancel');
    expect(cancelled).toMatchObject({
      status: 'cancelled',
      detailsAvailable: false,
      sources: [],
      dashboards: [],
    });
    const before = await snapshot();
    expect(await service.change(p.requestId, 2, 1, terms(row), 'accept')).toMatchObject({
      status: 'cancelled',
      replayed: true,
      sources: [],
      dashboards: [],
    });
    expect(await snapshot()).toEqual(before);
  });
  it('read fresh check rejects a final row cancellation after snapshot', async () => {
    const { p } = await prepare();
    const original = db.transaction.bind(db);
    let injected = false;
    jest.spyOn(db, 'transaction').mockImplementation(async (...args: any[]) => {
      const r = await original(...(args as [any]));
      if (!injected) {
        injected = true;
        await db.manager.update(EnterpriseBundleHandover, p.requestId, {
          status: 'cancelled',
          version: 2,
        });
      }
      return r;
    });
    await http('get', p.requestId + '/bundle-transfer', 2).expect(409);
  });
  it('additive migration preserves distinct receipt schema and refuses incompatible shape', async () => {
    const r = db.createQueryRunner();
    await r.connect();
    try {
      await r.dropTable('enterprise_bundle_handover');
      const m = new AddBundleHandover1792620100000();
      await m.up(r);
      await m.up(r);
      const original = r.getTable.bind(r);
      jest.spyOn(r, 'getTable').mockImplementation(async n => {
        const t = await original(n);
        t.findColumnByName('custodyHash').length = '12';
        return t;
      });
      await expect(m.up(r)).rejects.toThrow('preflight');
      await expect(m.down()).rejects.toThrow('retention');
    } finally {
      await r.release();
    }
  });
  it.each(['actorEpoch', 'recipientEpoch', 'file', 'retained'])(
    'rejects current %s before execution without partial writes',
    async kind => {
      if (kind === 'retained') await retained();
      const { p, row } = await prepare();
      const accepted = await service.change(p.requestId, 2, 0, terms(row), 'accept');
      if (kind === 'actorEpoch') await db.manager.update(User, 1, { authVersion: 1 });
      if (kind === 'recipientEpoch') await db.manager.update(User, 2, { authVersion: 1 });
      if (kind === 'file') await fs.appendFile(filenames[0], Buffer.from('changed'));
      if (kind === 'retained') {
        const rows = await db.manager.find(Widget, { order: { id: 'ASC' } });
        await db.manager.update(Widget, rows[rows.length - 1].id, { title: 'Changed retained' });
      }
      const before = await snapshot();
      await http('post', p.requestId + '/bundle-transfer/execute', 1, terms(accepted)).expect(
        kind === 'actorEpoch' ? 401 : 409,
      );
      expect(await snapshot()).toEqual(before);
    },
  );
  const mysql = process.env.VM_SEMANTIC_MYSQL_CONFIG ? it : it.skip;
  mysql.each(['dashboard', 'source'])(
    'MySQL %s writer first invalidates bundle acceptance after a real parent wait',
    async kind => {
      const { p, row } = await prepare();
      const runner = db.createQueryRunner();
      await runner.connect();
      await runner.startTransaction('READ COMMITTED');
      try {
        await runner.manager.findOne(kind === 'dashboard' ? Dashboard : Database, {
          where: { id: kind === 'dashboard' ? 101 : sourceId },
          lock: { mode: 'pessimistic_write' },
        });
        let settled = false;
        const accepting = service
          .change(p.requestId, 2, 0, terms(row), 'accept')
          .then(
            v => ({ v }),
            e => ({ e }),
          )
          .finally(() => (settled = true));
        await new Promise(r => setTimeout(r, 100));
        expect(settled).toBe(false);
        if (kind === 'dashboard') await runner.manager.update(Dashboard, 101, { title: 'Changed' });
        else await runner.manager.update(Database, sourceId, { name: 'Changed' });
        await runner.commitTransaction();
        expect(((await accepting) as any).e).toMatchObject({ status: 409 });
        expect(
          await db.manager.findOneBy(EnterpriseBundleHandover, { proposalId: p.requestId }),
        ).toMatchObject({ status: 'prepared', version: 1 });
      } finally {
        if (runner.isTransactionActive) await runner.rollbackTransaction();
        await runner.release();
      }
    },
  );
  mysql.each(['widget', 'dataset'])(
    'MySQL retained %s mutation waits bundle child fence until completion',
    async kind => {
      const older = await retained();
      const { p, row } = await prepare();
      const accepted = await service.change(p.requestId, 2, 0, terms(row), 'accept');
      let entered: () => void, release: () => void;
      const held = new Promise<void>(r => (entered = r)),
        gate = new Promise<void>(r => (release = r));
      const original = EntityManager.prototype.update;
      let paused = false;
      jest
        .spyOn(EntityManager.prototype, 'update')
        .mockImplementation(async function (e: any, c: any, v: any) {
          const r = await original.call(this, e, c, v);
          if (!paused && e === Database && v.ownerId === 2) {
            paused = true;
            entered();
            await gate;
          }
          return r;
        });
      const executing = service.change(p.requestId, 1, 0, terms(accepted), 'execute');
      await held;
      const runner = db.createQueryRunner();
      await runner.connect();
      await runner.startTransaction('READ COMMITTED');
      try {
        let settled = false;
        const changing = runner.manager
          .update(
            kind === 'widget' ? Widget : Dataset,
            kind === 'widget' ? older.widget.id : older.dataset.id,
            { title: 'After completion' },
          )
          .finally(() => (settled = true));
        await new Promise(r => setTimeout(r, 100));
        expect(settled).toBe(false);
        release();
        await executing;
        await changing;
        await runner.commitTransaction();
        expect(
          await db.manager.findOneBy(EnterpriseBundleHandover, { proposalId: p.requestId }),
        ).toMatchObject({ status: 'completed', version: 3 });
      } finally {
        release();
        if (runner.isTransactionActive) await runner.rollbackTransaction();
        await runner.release();
      }
    },
  );
  mysql('MySQL source metadata writer waits whole bundle then rejects old ownership', async () => {
    const { p, row } = await prepare();
    const accepted = await service.change(p.requestId, 2, 0, terms(row), 'accept');
    let entered: () => void, release: () => void;
    const held = new Promise<void>(r => (entered = r)),
      gate = new Promise<void>(r => (release = r));
    const original = EntityManager.prototype.update;
    let paused = false;
    jest
      .spyOn(EntityManager.prototype, 'update')
      .mockImplementation(async function (e: any, c: any, v: any) {
        const r = await original.call(this, e, c, v);
        if (!paused && e === Database && v.ownerId === 2) {
          paused = true;
          entered();
          await gate;
        }
        return r;
      });
    const executing = service.change(p.requestId, 1, 0, terms(accepted), 'execute');
    await held;
    let settled = false;
    const writing = files
      .update(sourceId, { name: 'Old owner' } as any, 1, 0)
      .then(
        v => ({ v }),
        e => ({ e }),
      )
      .finally(() => (settled = true));
    try {
      await new Promise(r => setTimeout(r, 100));
      expect(settled).toBe(false);
      release();
      await executing;
      expect(((await writing) as any).e).toMatchObject({ status: 403 });
    } finally {
      release();
      await writing;
    }
  });
});
