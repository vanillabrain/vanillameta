import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import request = require('supertest');
import { User } from '../user/entities/user.entity';
import { EnterpriseMembership } from '../enterprise/entities/enterprise-membership.entity';
import { EnterpriseAuditEvent } from '../enterprise/entities/enterprise-audit-event.entity';
import { EnterpriseResourceGrant } from '../enterprise/entities/enterprise-resource-grant.entity';
import {
  EnterpriseDashboardDelivery,
  EnterpriseDeliveryReceipt,
} from '../enterprise/entities/enterprise-dashboard-delivery.entity';
import { EnterpriseResourcePolicyService } from '../enterprise/resource-policy.service';
import { EnterpriseDeliveryService } from '../enterprise/delivery.service';
import { StudioReceivedRemixService } from './studio-received-remix.service';
import { StudioReceivedRemixController } from './studio-received-remix.controller';
import { StudioPublicationGuard } from './studio-publication.controller';
jest.mock('../ai/ai.service', () => ({ AiService: class {} }));
import { createHash, randomUUID } from 'crypto';
import { DuckDBInstance } from '@duckdb/node-api';
import { DataSource } from 'typeorm';
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
import { StudioRemixRequest } from './entities/studio-remix.entity';
import { StudioRun } from './entities/studio-run.entity';
import { StudioPublication, StudioPublicationRequest } from './entities/studio-publication.entity';
import { StudioRemixService } from './studio-remix.service';
import { captureRemixTemplate } from './studio-remix-template';
import { metricLinkItems } from '../ai/metric-analysis-links';
import { StudioService } from './studio.service';
import { StudioPublicationService } from './studio-publication.service';
import { StudioCreationService } from './studio-creation.service';
import { BiService } from '../bi/bi.service';
import { SourceAccessService } from '../ownership/source-access.service';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

describe('T9 immutable semantic remix with real DuckDB and atomic metadata', () => {
  let db: DataSource,
    worker: DuckDBService,
    dashboards: AiDashboardService,
    studio: StudioService,
    publications: StudioPublicationService,
    creation: StudioCreationService,
    root: string,
    connection: any,
    id: number;
  const previous = process.env.FILE_UPLOAD_DIR;
  const files = new Map<number, string>();
  const filename = (id: number) => 'source-' + id + '.duckdb';
  const mapping = { amount: 'total', channel: 'segment', event_time: 'occurred_at' };
  beforeAll(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-t9-'));
    process.env.FILE_UPLOAD_DIR = root;
    worker = new DuckDBService();
    for (const [sourceId, csv] of [
      [
        1,
        'channel,amount,weight,event_time\nSite,300,2,2026-01-01T00:00:00Z\nMobile,200,1,2026-01-02T00:00:00Z\n',
      ],
      [
        2,
        'segment,total,weight,occurred_at\nSite,300,2,2026-01-01T00:00:00Z\nMobile,200,1,2026-01-02T00:00:00Z\n',
      ],
      [
        6,
        'created_at,segment,total,occurred_at\n2025-11-01T00:00:00Z,Site,300,2026-01-01T00:00:00Z\n2025-12-01T00:00:00Z,Mobile,200,2026-01-02T00:00:00Z\n',
      ],
      [7, '*\n300\n200\n'],
      [8, '*,total\n900,300\n800,200\n'],
      [3, 'segment,total\nSite,wrong\n'],
      [4, 'total\n300\n200\n'],
      [
        5,
        'channel,amount,weight,event_time\nSite,300,2,2026-01-01T00:00:00Z\nMobile,200,1,2026-01-02T00:00:00Z\n',
      ],
    ] as Array<[number, string]>) {
      files.set(
        sourceId,
        (await worker.importFile({ originalname: 'input.csv', buffer: Buffer.from(csv) })).filename,
      );
    }
    // Managed uploads normalize names. Model a valid existing DuckDB literal-star column directly.
    for (const sourceId of [7, 8]) {
      const instance = await DuckDBInstance.create(files.get(sourceId));
      const conn = await instance.connect();
      try {
        await conn.run('ALTER TABLE uploaded_data RENAME COLUMN "_" TO "*"');
      } finally {
        conn.closeSync();
        instance.closeSync();
      }
    }
    db = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      synchronize: true,
      entities: [
        User,
        EnterpriseMembership,
        EnterpriseAuditEvent,
        EnterpriseResourceGrant,
        EnterpriseDashboardDelivery,
        EnterpriseDeliveryReceipt,
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
        StudioPublication,
        StudioPublicationRequest,
        StudioRemixRequest,
      ],
    }).initialize();
    for (const sourceId of files.keys())
      await db.manager.save(Database, {
        id: sourceId,
        ownerId: sourceId === 1 || sourceId === 7 ? 7 : 8,
        name: 'Source ' + sourceId,
        engine: 'duckdb',
        type: 'FILE',
        connectionConfig: JSON.stringify({
          client: 'duckdb',
          connection: { filename: filename(sourceId) },
        }),
      });
    for (const type of ['BOARD_NUMERIC', 'CHART_COLUMN', 'CHART_BAR', 'CHART_LINE'])
      await db.manager.save(Component, { type, title: type, option: '{}', useYn: 'Y' });
    connection = {
      withDuckDBSnapshot: jest.fn((_id, cb) => cb()),
      duckDBVersion: jest.fn(async id => createHash('sha256').update(filename(id)).digest('hex')),
      isDuckDB: jest.fn().mockResolvedValue(true),
      queryDuckDB: jest.fn((id, sql, bindings) => worker.query(files.get(id), sql, bindings)),
    };
    const access = new SourceAccessService(db);
    dashboards = new AiDashboardService({} as any, connection, db.getRepository(Dashboard));
    studio = new StudioService(db, dashboards, connection, access);
    publications = new StudioPublicationService(db, studio, connection);
    creation = new StudioCreationService(
      db,
      new BiService(db, access, connection, dashboards),
      {} as any,
      dashboards,
      connection,
      access,
      studio,
    );
  });
  beforeEach(async () => {
    const definition = {
      schemaVersion: 1,
      definitionVersion: 1,
      sourceId: 1,
      tableName: 'uploaded_data',
      label: 'Revenue',
      aggregation: 'SUM',
      column: 'amount',
      unit: 'USD',
      decimalPlaces: 2,
      numberNotation: 'plain',
    };
    const metric = await db.manager.save(Metric, {
      name: 'original-' + Date.now() + '-' + Math.random(),
      databaseId: 1,
      tableName: 'uploaded_data',
      aggregation: 'SUM' as any,
      expression: 'amount',
      definition: JSON.stringify(definition),
    });
    const blocks = [
      { title: 'Revenue', kind: 'BOARD_NUMERIC', metric: definition },
      {
        title: 'Channels',
        kind: 'CHART_COLUMN',
        metric: definition,
        dimension: { column: 'channel' },
      },
      {
        title: 'Trend',
        kind: 'CHART_LINE',
        metric: definition,
        dimension: { column: 'event_time' },
      },
    ];
    const profile = await (creation as any).profile(1, 7);
    const snapshot = {
      schemaVersion: 2,
      kind: 'structured-bi-dashboard',
      sourceId: 1,
      items: blocks.map(b => ({
        sourceId: 1,
        metricId: metric.id,
        definitionVersion: 1,
        definition,
        ...(b.dimension ? { dimension: b.dimension.column } : {}),
        chart: b.kind === 'BOARD_NUMERIC' ? 'number' : b.kind === 'CHART_LINE' ? 'line' : 'bar',
      })),
    };
    id = (
      await dashboards.save(
        { draft: (creation as any).compile(1, 'Original', blocks, profile) },
        7,
        snapshot,
      )
    ).data.id;
  });
  afterAll(async () => {
    await worker?.onModuleDestroy();
    await db?.destroy();
    fs.rmSync(root, { recursive: true, force: true });
    if (previous === undefined) delete process.env.FILE_UPLOAD_DIR;
    else process.env.FILE_UPLOAD_DIR = previous;
  });
  const publish = async (patch: any = {}) =>
    publications.publish(
      id,
      {
        requestId: 'publish-' + id,
        expectedRevision: (await studio.get(id, 7)).document.revision,
        visibility: 'link',
        allowRemix: true,
        ...patch,
      },
      7,
    );
  it('copies an explicitly allowed received analysis using only recipient data, then survives revocation independently', async () => {
    await db.manager.save(
      User,
      [7, 8].map(userId => ({
        id: userId,
        userId: `copy-${userId}`,
        email: `copy-${userId}@example.invalid`,
        password: 'synthetic-unused',
        active: true,
      })),
    );
    await db.manager.save(EnterpriseMembership, [
      { userId: 7, organizationId: 1, role: 'admin', team: '' },
      { userId: 8, organizationId: 1, role: 'member', team: '' },
    ]);
    const policy = new EnterpriseResourcePolicyService(db),
      access = new SourceAccessService(db, policy);
    const ai = new AiDashboardService({} as any, connection, db.getRepository(Dashboard), access);
    const copyStudio = new StudioService(db, ai, connection, access);
    const copyCreation = new StudioCreationService(
      db,
      new BiService(db, access, connection, ai),
      {} as any,
      ai,
      connection,
      access,
      copyStudio,
    );
    const remix = new StudioRemixService(
      db,
      copyStudio,
      new StudioPublicationService(db, copyStudio, connection),
      copyCreation,
      ai,
      connection,
      access,
    );
    const received = new StudioReceivedRemixService(db, copyStudio, access),
      delivery = new EnterpriseDeliveryService(db, policy, access);
    await policy.set('source', 1, 7, {
      recipientId: 8,
      expectedVersion: 0,
      rights: { read: true, edit: false, publish: false, export: false },
    });
    const share = (version: number, allowCopy?: boolean, active = true) =>
      delivery.set(id, 7, {
        requestId: randomUUID(),
        recipients: [{ recipientId: 8, expectedVersion: version }],
        active,
        ...(allowCopy === undefined ? {} : { allowCopy }),
      });
    await share(0);
    await expect(received.reference(id, 8)).rejects.toMatchObject({ status: 403 });
    await share(1, true);
    const original = await db.manager.findOneBy(Dashboard, { id });
    const originalDocument = (await copyStudio.get(id, 7)).document;
    const publicationsBefore = await db.manager.count(StudioPublication);
    const { reference } = await received.reference(id, 8);
    await expect(remix.template(reference, 8)).rejects.toMatchObject({ status: 404 });
    await expect(remix.template('a'.repeat(64), 8, received.resolve)).rejects.toMatchObject({
      status: 400,
    });
    const requirements = await remix.template(reference, 8, received.resolve);
    expect(requirements.version).toBe(2);
    expect(requirements.blocks.every(block => block.supported)).toBe(true);
    expect(JSON.stringify(requirements)).not.toMatch(
      /SELECT|connectionConfig|analysisDefinition|source-1/,
    );
    await expect(received.reference(id, 7)).rejects.toMatchObject({ status: 403 });
    await db.manager.update(Dashboard, { id }, { title: 'Changed while choosing source' });
    await expect(remix.template(reference, 8, received.resolve)).rejects.toMatchObject({
      status: 409,
    });
    await db.manager.update(
      Dashboard,
      { id },
      { title: original.title, updatedAt: original.updatedAt },
    );
    files.set(
      9,
      (
        await worker.importFile({
          originalname: 'private-target.csv',
          buffer: Buffer.from(
            'segment,total,occurred_at\nSite,900,2026-01-01T00:00:00Z\nMobile,100,2026-01-02T00:00:00Z\n',
          ),
        })
      ).filename,
    );
    await db.manager.save(Database, {
      id: 9,
      ownerId: 8,
      name: 'Recipient data',
      engine: 'duckdb',
      type: 'FILE',
      connectionConfig: JSON.stringify({ client: 'duckdb', connection: { filename: filename(9) } }),
    });
    const previousSecret = process.env.ACCESS_SECRET;
    process.env.ACCESS_SECRET = 'synthetic-received-copy-http';
    const jwt = new JwtService();
    const module = await Test.createTestingModule({
      controllers: [StudioReceivedRemixController],
      providers: [
        StudioPublicationGuard,
        { provide: StudioReceivedRemixService, useValue: received },
        { provide: StudioRemixService, useValue: remix },
        { provide: DataSource, useValue: db },
        { provide: JwtService, useValue: jwt },
      ],
    }).compile();
    const app = module.createNestApplication();
    await app.init();
    await app.listen(0, '127.0.0.1');
    const auth =
      'Bearer ' +
      jwt.sign(
        { accessKeyData: { id: 8, userId: 'copy-8', authVersion: 0 } },
        { secret: process.env.ACCESS_SECRET },
      );
    try {
      const unauth = await request(app.getHttpServer())
        .get(`/studio/received/${id}/remix-reference`)
        .expect(401);
      expect(unauth.headers['cache-control']).toContain('no-store');
      const fresh = await request(app.getHttpServer())
        .get(`/studio/received/${id}/remix-reference`)
        .set('Authorization', auth)
        .expect(200);
      expect(fresh.body.reference).toBe(reference);
      const before = await db.manager.count(Dashboard);
      const preview = await request(app.getHttpServer())
        .post(`/studio/received/${reference}/remix-preview`)
        .set('Authorization', auth)
        .send({ targetSourceId: 9, mapping, expectedVersion: 2 })
        .expect(201);
      expect(await db.manager.count(Dashboard)).toBe(before);
      expect(Number(preview.body.preview.widgets[0].datas[0].value)).toBe(1000);
      const save = {
        targetSourceId: 9,
        mapping,
        expectedVersion: 2,
        expectedSourceRevision: preview.body.sourceRevision,
        requestId: 'received-copy-' + id,
      };
      await request(app.getHttpServer())
        .post(`/studio/received/${reference}/remix-preview`)
        .set('Authorization', auth)
        .send({ targetSourceId: 1, mapping: {}, expectedVersion: 2 })
        .expect(403);
      const metricCount = await db.manager.count(Metric);
      const persist = copyCreation.persistRemix.bind(copyCreation);
      const revokeDuringSave = jest
        .spyOn(copyCreation, 'persistRemix')
        .mockImplementationOnce(async (...args) => {
          const result = await persist(...args);
          await args[5].update(
            EnterpriseDashboardDelivery,
            { ownerId: 7, organizationId: 1, dashboardId: id, recipientId: 8 },
            { allowCopy: false },
          );
          return result;
        });
      try {
        await request(app.getHttpServer())
          .post(`/studio/received/${reference}/remix`)
          .set('Authorization', auth)
          .send(save)
          .expect(403);
        expect(await db.manager.count(Dashboard)).toBe(before);
        expect(await db.manager.count(Metric)).toBe(metricCount);
        expect(
          await db.manager.count(StudioRemixRequest, {
            where: { actorId: 8, requestId: save.requestId },
          }),
        ).toBe(0);
      } finally {
        revokeDuringSave.mockRestore();
      }
      const created = await request(app.getHttpServer())
        .post(`/studio/received/${reference}/remix`)
        .set('Authorization', auth)
        .send(save)
        .expect(201);
      const result = created.body;
      expect(result.dashboardId).not.toBe(id);
      expect(result.document.sourceId).toBe(9);
      expect(await db.manager.count(Dashboard)).toBe(before + 1);
      const replay = await remix.remix(reference, save, 8, received.resolve);
      expect(replay.dashboardId).toBe(result.dashboardId);
      expect(await db.manager.count(Dashboard)).toBe(before + 1);
      expect(await db.manager.findOneBy(Dashboard, { id })).toEqual(original);
      const saved = await copyStudio.get(result.dashboardId, 8);
      expect(
        saved.document.blocks.every(
          block => !originalDocument.blocks.some(prior => prior.id === block.id),
        ),
      ).toBe(true);
      expect(Number(saved.preview.widgets[0].datas[0].value)).toBe(1000);
      for (const breakpoint of Object.keys(originalDocument.layouts)) {
        expect(
          saved.document.layouts[breakpoint].map(({ x, y, w, h }) => ({ x, y, w, h })),
        ).toEqual(originalDocument.layouts[breakpoint].map(({ x, y, w, h }) => ({ x, y, w, h })));
      }
      await share(2, false);
      await expect(remix.template(reference, 8, received.resolve)).rejects.toMatchObject({
        status: 403,
      });
      await share(3, undefined, false);
      await policy.set('source', 1, 7, {
        recipientId: 8,
        expectedVersion: 1,
        rights: { read: false, edit: false, publish: false, export: false },
      });
      expect(
        Number((await copyStudio.get(result.dashboardId, 8)).preview.widgets[0].datas[0].value),
      ).toBe(1000);
      expect(await db.manager.count(StudioPublication)).toBe(publicationsBefore);
    } finally {
      await app.close();
      if (previousSecret === undefined) delete process.env.ACCESS_SECRET;
      else process.env.ACCESS_SECRET = previousSecret;
    }
  }, 15000);
  it('captures source-independent whitelisted semantics only with explicit publication consent', async () => {
    const p = await publish();
    const row: any = await db.manager.findOne(StudioPublication, { where: { token: p.token } });
    expect(row.remixTemplate).toEqual(expect.any(String));
    const template = JSON.parse(row.remixTemplate);
    expect(template.requiredFields).toEqual(
      expect.arrayContaining([
        { name: 'amount', type: 'BIGINT', blockIds: ['block-1', 'block-2', 'block-3'] },
        { name: 'event_time', type: expect.stringMatching(/^TIMESTAMP/), blockIds: ['block-3'] },
      ]),
    );
    for (const key of [
      'sql',
      'sourceId',
      'databaseId',
      'metricId',
      'definitionKey',
      'datas',
      'connectionConfig',
      'history',
    ])
      expect(row.remixTemplate).not.toContain('"' + key + '"');
    const off = await publish({ requestId: 'disabled-' + id, allowRemix: false });
    expect(
      ((await db.manager.findOne(StudioPublication, { where: { token: off.token } })) as any)
        .remixTemplate,
    ).toBeNull();
  });
  const remixService = () => {
    return new StudioRemixService(
      db,
      studio,
      publications,
      creation,
      dashboards,
      connection,
      new SourceAccessService(db),
    );
  };
  const preview = (p: any, extra: any = {}) =>
    remixService().preview(
      p.token,
      { targetSourceId: 2, mapping, expectedVersion: p.version, ...extra },
      8,
    );
  const saveRemix = (p: any, v: any, extra: any = {}) =>
    remixService().remix(
      p.token,
      {
        requestId: 'remix-' + id,
        targetSourceId: 2,
        mapping,
        expectedVersion: p.version,
        expectedSourceRevision: v.sourceRevision,
        ...extra,
      },
      8,
    );
  it('discovers requirements without target selection or recipient access to the private original source', async () => {
    const p = await publish();
    await expect(new SourceAccessService(db).assert('database', 1, 8)).rejects.toThrow();
    const r = await remixService().template(p.token, 8);
    expect(r.blocks.map(b => b.id)).toEqual(['block-1', 'block-2', 'block-3']);
    expect(r.blocks.every(b => b.supported)).toBe(true);
    expect(r.requiredFields.map(f => f.name)).toEqual(['amount', 'channel', 'event_time']);
    for (const key of [
      'sql',
      'sourceId',
      'databaseId',
      'metricId',
      'datas',
      'connectionConfig',
      'history',
    ])
      expect(JSON.stringify(r)).not.toContain('"' + key + '"');
  });
  it('previews renamed columns against real values and never leaks source SQL/config/raw rows', async () => {
    const p = await publish(),
      r = await preview(p);
    expect(r.unmappedBlocks).toEqual([]);
    expect(r.mapping).toEqual(mapping);
    expect(r.preview.widgets[0].datas).toEqual([{ value: 500 }]);
    expect(r.preview.widgets[1].datas).toEqual(
      expect.arrayContaining([
        { dimension: 'Site', value: 300 },
        { dimension: 'Mobile', value: 200 },
      ]),
    );
    for (const key of [
      'sql',
      'draft',
      'queries',
      'connectionConfig',
      'previewRows',
      'contribution',
    ])
      expect(JSON.stringify(r)).not.toContain('"' + key + '"');
    expect(r.profile.columns[0]).toEqual({
      name: 'segment',
      type: 'VARCHAR',
      numeric: false,
      temporal: false,
    });
  });
  it('auto maps only exact names and types, declines incompatible and ambiguous guesses', async () => {
    const p = await publish();
    const exact = await preview(p, { targetSourceId: 5, mapping: {} });
    expect(exact.mapping).toEqual({
      amount: 'amount',
      channel: 'channel',
      event_time: 'event_time',
    });
    const missing = await preview(p, { mapping: {} });
    expect(missing.mapping).toEqual({});
    expect(missing.fields.find(f => f.sourceColumn === 'amount').status).toBe('ambiguous');
    expect(missing.unmappedBlocks).toHaveLength(3);
    const incompatible = await preview(p, {
      targetSourceId: 3,
      mapping: { amount: 'total', channel: 'segment' },
    });
    expect(incompatible.fields.find(f => f.sourceColumn === 'amount').status).toBe('incompatible');
    await expect(
      saveRemix(p, incompatible, {
        targetSourceId: 3,
        mapping: { amount: 'total', channel: 'segment' },
      }),
    ).rejects.toMatchObject({ status: 400 });
  });
  it('requires explicit exclusion and removes every corresponding breakpoint layout reference', async () => {
    const p = await publish();
    const v = await preview(p, { targetSourceId: 4, mapping: { amount: 'total' } });
    expect(v.unmappedBlocks.map(b => b.blockId)).toEqual(['block-2', 'block-3']);
    await expect(
      saveRemix(p, v, { targetSourceId: 4, mapping: { amount: 'total' } }),
    ).rejects.toMatchObject({ status: 400 });
    const r = await saveRemix(p, v, {
      targetSourceId: 4,
      mapping: { amount: 'total' },
      excludedBlockIds: ['block-2', 'block-3'],
    });
    expect(r.document.blocks).toHaveLength(1);
    for (const bp of ['lg', 'md', 'xs'])
      expect(r.document.layouts[bp].map(g => g.id)).toEqual(r.document.blocks.map(b => b.id));
    await expect(
      saveRemix(p, v, {
        requestId: 'empty-' + id,
        targetSourceId: 4,
        mapping: { amount: 'total' },
        excludedBlockIds: ['block-1', 'block-2', 'block-3'],
      }),
    ).rejects.toMatchObject({ status: 400 });
  });
  it('creates new private IDs, target-only references and durable idempotency while preserving all original records', async () => {
    const p = await publish(),
      v = await preview(p);
    const original = await db.manager.findOne(Dashboard, { where: { id } });
    const source = await db.manager.findOne(Database, { where: { id: 1 } });
    const pub = await db.manager.findOne(StudioPublication, { where: { token: p.token } });
    const before = await db.manager.count(Dashboard);
    const [a, b] = await Promise.all([saveRemix(p, v), saveRemix(p, v)]);
    expect(a).toEqual(b);
    expect(await db.manager.count(Dashboard)).toBe(before + 1);
    expect(await saveRemix(p, v)).toEqual(a); // service restart: durable journal
    expect(a.dashboardId).not.toBe(id);
    expect(a.document.sourceId).toBe(2);
    const orig = (await studio.get(id, 7)).document;
    expect(a.document.blocks.every(block => !orig.blocks.some(o => o.id === block.id))).toBe(true);
    for (const block of a.document.blocks) {
      for (const ref of block.measureRefs)
        expect((await db.manager.findOne(Metric, { where: { id: ref.id } })).databaseId).toBe(2);
      expect(block.dimensionRefs.every(ref => ref.sourceId === 2)).toBe(true);
    }
    expect((await studio.get(a.dashboardId, 8)).preview.widgets[0].datas).toEqual([{ value: 500 }]);
    const clone = await db.manager.findOne(Dashboard, { where: { id: a.dashboardId } });
    expect(
      (await db.manager.findOne(DashboardShare, { where: { id: clone.shareId } })).shareYn,
    ).toBe('N');
    expect(
      await db.manager.count(StudioPublication, { where: { dashboardId: a.dashboardId } }),
    ).toBe(0);
    expect(await db.manager.findOne(Dashboard, { where: { id } })).toEqual(original);
    expect(await db.manager.findOne(Database, { where: { id: 1 } })).toEqual(source);
    expect(await db.manager.findOne(StudioPublication, { where: { token: p.token } })).toEqual(pub);
    await expect(
      saveRemix(p, v, { mapping: { ...mapping, amount: 'weight' } }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(new SourceAccessService(db).dashboard(a.dashboardId, 7)).rejects.toThrow();
  });
  it('allocates independent metric IDs even when owner remixes onto the same source', async () => {
    const p = await publish(),
      service = remixService();
    const v = await service.preview(p.token, { targetSourceId: 1, mapping: {} }, 7);
    const a = await service.remix(
      p.token,
      {
        requestId: 'same-source-' + id,
        targetSourceId: 1,
        mapping: {},
        expectedVersion: p.version,
        expectedSourceRevision: v.sourceRevision,
      },
      7,
    );
    const orig = (await studio.get(id, 7)).document;
    expect(
      a.document.blocks.every(b =>
        b.measureRefs.every(
          ref => !orig.blocks.some(o => o.measureRefs.some(r => r.id === ref.id)),
        ),
      ),
    ).toBe(true);
    const metricId = a.document.blocks[0].measureRefs[0].id;
    await db.manager.update(Metric, metricId, { description: 'Clone only' });
    expect((await studio.get(id, 7)).document).toEqual(orig);
  });
  it('uses immutable published semantics despite later draft or canonical edits', async () => {
    const p = await publish();
    const original = (await studio.get(id, 7)).document;
    const m = await db.manager.findOne(Metric, {
      where: { id: original.blocks[0].measureRefs[0].id },
    });
    await db.manager.update(Metric, m.id, {
      definition: JSON.stringify({
        ...JSON.parse(m.definition),
        column: 'weight',
        definitionVersion: 2,
      }),
    });
    const row = await db.manager.findOne(Dashboard, { where: { id } });
    const definition = JSON.parse(row.structuredDefinition);
    definition.items.forEach(item => {
      item.definition.column = 'weight';
      item.definition.definitionVersion = 2;
      item.definitionVersion = 2;
    });
    await db.manager.update(Dashboard, id, {
      title: 'Edited draft',
      structuredDefinition: JSON.stringify(definition),
    });
    const v = await preview(p);
    expect(v.title).toBe('Original');
    expect(v.preview.widgets[0].datas).toEqual([{ value: 500 }]);
    const saved = await saveRemix(p, v);
    expect((await studio.get(saved.dashboardId, 8)).preview.widgets[0].datas).toEqual([
      { value: 500 },
    ]);
  });
  it('rejects unauthenticated/private/disabled/revoked/expired/old snapshots and foreign target sources', async () => {
    const p = await publish();
    await expect(remixService().template(p.token, undefined)).rejects.toMatchObject({
      status: 403,
    });
    await expect(preview(p, { targetSourceId: 1 })).rejects.toMatchObject({ status: 403 });
    for (const [patch, status] of [
      [{ visibility: 'private' }, 403],
      [{ allowRemix: false }, 403],
      [{ revokedAt: new Date().toISOString() }, 410],
      [{ expiresAt: new Date(Date.now() - 1000).toISOString() }, 410],
      [{ remixTemplate: null }, 409],
    ] as Array<[any, number]>) {
      const old = await db.manager.findOne(StudioPublication, { where: { token: p.token } });
      await db.manager.update(StudioPublication, p.token, patch);
      await expect(remixService().template(p.token, 8)).rejects.toMatchObject({ status });
      await db.manager.save(StudioPublication, old);
    }
  });
  it('requires pinned versions and rejects publication republish or source metadata/schema changes', async () => {
    const p = await publish(),
      v = await preview(p);
    await expect(saveRemix(p, v, { expectedVersion: undefined })).rejects.toMatchObject({
      status: 400,
    });
    await expect(saveRemix(p, v, { expectedSourceRevision: undefined })).rejects.toMatchObject({
      status: 400,
    });
    await publish({ requestId: 'republish-' + id });
    await expect(saveRemix(p, v)).rejects.toMatchObject({ status: 409 });
    const current = await publications.ownerMetadata(id, 7),
      next = await preview(current);
    await db.manager.update(Database, 2, {
      name: 'Source changed ' + id,
      updatedAt: new Date(Date.now() + 2000),
    });
    await expect(saveRemix(current, next)).rejects.toMatchObject({ status: 409 });
  });
  it('serializes revoke versus commit and prevents replay after revoke', async () => {
    const p = await publish(),
      v = await preview(p),
      before = await db.manager.count(Dashboard);
    const revoked = publications.revoke(p.token, 7);
    const denied = saveRemix(p, v);
    await revoked;
    await expect(denied).rejects.toMatchObject({ status: 410 });
    expect(await db.manager.count(Dashboard)).toBe(before);
    const fresh = await publish({ requestId: 'fresh-' + id }),
      w = await preview(fresh);
    const saved = saveRemix(fresh, w);
    const later = publications.revoke(fresh.token, 7);
    const result = await saved;
    await later;
    expect(result.dashboardId).not.toBe(id);
    await expect(saveRemix(fresh, w)).rejects.toMatchObject({ status: 410 });
  });

  it.each([
    ['SUM', {}, 500],
    ['COUNT', {}, 2],
    ['COUNT_DISTINCT', { column: 'channel' }, 2],
    ['AVG', {}, 250],
    ['MIN', {}, 200],
    ['MAX', {}, 300],
    ['RATIO_SUM', { denominatorColumn: 'weight', scale: 100 }, (500 / 3) * 100],
    ['WEIGHTED_AVG', { weightColumn: 'weight' }, 800 / 3],
  ])(
    'captures and compiles canonical %s without copying SQL',
    async (aggregation, extra, expected) => {
      const definition = {
        schemaVersion: 1,
        definitionVersion: 1,
        sourceId: 1,
        tableName: 'uploaded_data',
        label: 'Canonical',
        aggregation,
        column: aggregation === 'COUNT' ? '*' : 'amount',
        unit: '',
        decimalPlaces: 2,
        numberNotation: 'plain',
        ...extra,
      };
      const metric = await db.manager.save(Metric, {
        name: 'canonical-' + id,
        databaseId: 1,
        tableName: 'uploaded_data',
        aggregation: aggregation as any,
        expression: definition.column,
        definition: JSON.stringify(definition),
      });
      const snapshot = {
        schemaVersion: 2,
        kind: 'structured-bi-dashboard',
        sourceId: 1,
        items: [
          { sourceId: 1, metricId: metric.id, definitionVersion: 1, definition, chart: 'number' },
        ],
      };
      id = (
        await dashboards.save(
          {
            draft: creation.compile(
              1,
              'Canonical',
              [{ title: 'Canonical', kind: 'BOARD_NUMERIC', metric: definition }],
              await creation.profile(1, 7),
            ),
          },
          7,
          snapshot,
        )
      ).data.id;
      const p = await publish();
      const required = (await remixService().template(p.token, 8)).requiredFields;
      const mapped = Object.fromEntries(
        required.map(f => [
          f.name,
          ({ amount: 'total', channel: 'segment', weight: 'weight' } as any)[f.name],
        ]),
      );
      const v = await preview(p, { mapping: mapped });
      expect(v.blocks[0].supported).toBe(true);
      expect(v.unmappedBlocks).toEqual([]);
      expect(Number(v.preview.widgets[0].datas[0].value)).toBeCloseTo(Number(expected), 10);
      const clone = await saveRemix(p, v, { mapping: mapped });
      expect(
        Number((await studio.get(clone.dashboardId, 8)).preview.widgets[0].datas[0].value),
      ).toBeCloseTo(Number(expected), 10);
    },
  );
  it('preserves raw timestamp dimension, explicit month grain and all saved breakpoint layouts', async () => {
    const doc = (await studio.get(id, 7)).document;
    doc.blocks[2].display.timeGrain = 'month';
    doc.layouts.lg[0] = { ...doc.layouts.lg[0], x: 0, y: 20 };
    await studio.save(
      id,
      {
        requestId: 'grain-' + id,
        expectedRevision: doc.revision,
        expectedSourceRevision: await connection.duckDBVersion(1),
        document: doc,
      },
      7,
    );
    const p = await publish(),
      v = await preview(p);
    expect(v.preview.widgets[2].datas).toHaveLength(1);
    expect(v.preview.widgets[2].datas[0].value).toBe(500);
    const r = await saveRemix(p, v);
    expect(r.document.blocks[2].display.timeGrain).toBe('month');
    const original = (await studio.get(id, 7)).document;
    for (const bp of ['lg', 'md', 'xs'])
      expect(r.document.layouts[bp].map(g => ({ x: g.x, y: g.y, w: g.w, h: g.h }))).toEqual(
        original.layouts[bp].map(g => ({ x: g.x, y: g.y, w: g.w, h: g.h })),
      );
  });
  it('marks arbitrary unlinked legacy SQL unsupported and requires explicit exclusion', async () => {
    const old = (await dashboards.analysis(id, 7, true)).data;
    const row = await db.manager.findOne(Dashboard, { where: { id } });
    const snapshot = JSON.parse(row.structuredDefinition);
    snapshot.items[0] = { kind: 'studio-unlinked-legacy', sourceId: 1 };
    await db.manager.update(Dashboard, id, { structuredDefinition: JSON.stringify(snapshot) });
    const p = await publish(),
      v = await preview(p);
    expect(v.blocks[0].supported).toBe(false);
    expect(v.unmappedBlocks[0].blockId).toBe('block-1');
    await expect(saveRemix(p, v)).rejects.toMatchObject({ status: 400 });
    const saved = await saveRemix(p, v, { excludedBlockIds: ['block-1'] });
    expect(saved.document.blocks).toHaveLength(old.widgets.length - 1);
  });
  it('rejects client semantic/SQL/preview injection, unknown mapping fields and unknown exclusions', async () => {
    const p = await publish();
    for (const extra of [
      { sql: 'SELECT * FROM source' },
      { semanticProposal: [] },
      { preview: {} },
      { mapping: { unknown: 'total' } },
      { excludedBlockIds: ['invented'] },
      { mapping: JSON.parse('{"__proto__":"total"}') },
    ])
      await expect(preview(p, extra)).rejects.toMatchObject({ status: 400 });
  });
  it('rolls back dashboard, metrics, datasets, share and journal on failure and supports retry', async () => {
    const p = await publish(),
      v = await preview(p);
    const entities = [Dashboard, Metric, Dataset, Widget, DashboardShare, StudioRemixRequest];
    const counts = await Promise.all(entities.map(e => db.manager.count(e)));
    await db.query(
      "CREATE TRIGGER fail_remix BEFORE INSERT ON studio_remix_request BEGIN SELECT RAISE(ABORT,'remix journal unavailable'); END",
    );
    try {
      await expect(saveRemix(p, v)).rejects.toThrow('remix journal unavailable');
      expect(await Promise.all(entities.map(e => db.manager.count(e)))).toEqual(counts);
    } finally {
      await db.query('DROP TRIGGER fail_remix');
    }
    expect((await saveRemix(p, v)).dashboardId).not.toBe(id);
  });
  it('rechecks source ownership, reference and publication inside the transaction after asynchronous save', async () => {
    for (const change of ['source', 'publication', 'reference']) {
      const p = await publish({ requestId: 'race-' + change + '-' + id }),
        v = await preview(p);
      const n = await db.manager.count(Dashboard),
        m = await db.manager.count(Metric);
      const original = dashboards.save.bind(dashboards);
      const spy = jest.spyOn(dashboards, 'save').mockImplementation(async (...args) => {
        const result = await original(...args);
        if (change === 'source') await db.manager.update(Database, 2, { ownerId: 9 });
        else if (change === 'publication')
          await db.manager.update(StudioPublication, p.token, {
            revokedAt: new Date().toISOString(),
          });
        else await db.manager.update(Dashboard, id, { delYn: 'Y' as any });
        return result;
      });
      try {
        await expect(
          saveRemix(p, v, { requestId: 'race-save-' + change + '-' + id }),
        ).rejects.toThrow();
        expect(await db.manager.count(Dashboard)).toBe(n);
        expect(await db.manager.count(Metric)).toBe(m);
      } finally {
        spy.mockRestore();
      }
    }
  });

  it('declines a canonical link whose executed SQL has diverged instead of changing its meaning', async () => {
    const row = await db.manager.findOne(Dashboard, { where: { id } });
    const analysis = JSON.parse(row.analysisDefinition);
    analysis.widgets[0].sql = 'SELECT SUM("weight") AS value FROM source';
    await db.manager.update(Dashboard, id, { analysisDefinition: JSON.stringify(analysis) });
    const p = await publish(),
      v = await preview(p);
    expect(v.blocks[0].supported).toBe(false);
    await expect(saveRemix(p, v)).rejects.toMatchObject({ status: 400 });
  });
  it('detects a schema change during save and rolls back every new asset', async () => {
    const p = await publish(),
      v = await preview(p),
      before = await db.manager.count(Dashboard);
    const original = dashboards.save.bind(dashboards),
      query = connection.queryDuckDB.getMockImplementation();
    const spy = jest.spyOn(dashboards, 'save').mockImplementation(async (...args) => {
      const result = await original(...args);
      connection.queryDuckDB.mockImplementation(async (sourceId, sql, bindings) => {
        const data = await query(sourceId, sql, bindings);
        return sourceId === 2 && sql === 'DESCRIBE uploaded_data'
          ? {
              ...data,
              datas: data.datas.map(c =>
                c.column_name === 'total' ? { ...c, column_type: 'VARCHAR' } : c,
              ),
            }
          : data;
      });
      return result;
    });
    try {
      await expect(saveRemix(p, v)).rejects.toMatchObject({ status: 409 });
      expect(await db.manager.count(Dashboard)).toBe(before);
    } finally {
      spy.mockRestore();
      connection.queryDuckDB.mockImplementation(query);
    }
  });
  it('honors explicit blank mapping as unmapped without validation failure or automatic remapping', async () => {
    const p = await publish();
    const v = await preview(p, { targetSourceId: 5, mapping: { amount: '' } });
    expect(v.mapping).toEqual({ amount: '', channel: 'channel', event_time: 'event_time' });
    expect(v.fields.find(f => f.sourceColumn === 'amount').status).toBe('missing');
    expect(v.unmappedBlocks.map(b => b.blockId)).toEqual(['block-1', 'block-2', 'block-3']);
    await expect(
      saveRemix(p, v, { targetSourceId: 5, mapping: { amount: '' } }),
    ).rejects.toMatchObject({ status: 400 });
  });
  it('returns safe presentation parity for prefixes, suffixes, decimal places and numeric mode', async () => {
    const doc = (await studio.get(id, 7)).document;
    doc.blocks[0].display = {
      prefix: '$',
      suffix: ' USD',
      decimalPlaces: 3,
      numberNotation: 'compact',
    };
    await studio.save(
      id,
      {
        requestId: 'display-' + id,
        expectedRevision: doc.revision,
        expectedSourceRevision: await connection.duckDBVersion(1),
        document: doc,
      },
      7,
    );
    const p = await publish(),
      v = await preview(p);
    expect(v.preview.widgets[0]).toMatchObject(doc.blocks[0].display);
    const saved = await saveRemix(p, v);
    expect((await studio.get(saved.dashboardId, 8)).document.blocks[0].display).toEqual(
      doc.blocks[0].display,
    );
  });
  it('aggregates a mapped temporal chart by its own dimension when another timestamp comes first', async () => {
    const doc = (await studio.get(id, 7)).document;
    doc.blocks[2].display.timeGrain = 'month';
    await studio.save(
      id,
      {
        requestId: 'mapped-time-' + id,
        expectedRevision: doc.revision,
        expectedSourceRevision: await connection.duckDBVersion(1),
        document: doc,
      },
      7,
    );
    const p = await publish(),
      v = await preview(p, { targetSourceId: 6 });
    expect(v.unmappedBlocks).toEqual([]);
    expect(v.preview.widgets[2].grainUnavailable).toBeUndefined();
    expect(v.preview.widgets[2].datas).toEqual([{ dimension: '2026-01-01T00:00:00Z', value: 500 }]);
    expect(v.preview.widgets[2].timeGrain).toBe('month');
    const clone = await saveRemix(p, v, { targetSourceId: 6 });
    const result = (await studio.get(clone.dashboardId, 8)).preview.widgets[2];
    expect(result.grainUnavailable).toBeUndefined();
    expect(result.datas).toEqual(v.preview.widgets[2].datas);
    expect(result.timeSelection.column).toBe('occurred_at');
  });
  it('maps a literal star metric column while reserving the star sentinel only for COUNT', async () => {
    const definition = {
      schemaVersion: 1,
      definitionVersion: 1,
      sourceId: 7,
      tableName: 'uploaded_data',
      label: 'Star sum',
      aggregation: 'SUM',
      column: '*',
      unit: '',
      decimalPlaces: 0,
      numberNotation: 'plain',
    };
    const metric = await db.manager.save(Metric, {
      name: 'star-' + id,
      databaseId: 7,
      tableName: 'uploaded_data',
      aggregation: 'SUM' as any,
      expression: '*',
      definition: JSON.stringify(definition),
    });
    const snapshot = {
      schemaVersion: 2,
      kind: 'structured-bi-dashboard',
      sourceId: 7,
      items: [
        { sourceId: 7, metricId: metric.id, definitionVersion: 1, definition, chart: 'number' },
      ],
    };
    id = (
      await dashboards.save(
        {
          draft: creation.compile(
            7,
            'Star sum',
            [{ title: 'Star sum', kind: 'BOARD_NUMERIC', metric: definition }],
            await creation.profile(7, 7),
          ),
        },
        7,
        snapshot,
      )
    ).data.id;
    const p = await publish(),
      v = await preview(p, { targetSourceId: 8, mapping: { '*': 'total' } });
    expect(v.unmappedBlocks).toEqual([]);
    expect(v.mapping).toEqual({ '*': 'total' });
    expect(v.preview.widgets[0].datas).toEqual([{ value: 500 }]);
    const saved = await saveRemix(p, v, { targetSourceId: 8, mapping: { '*': 'total' } });
    expect((await studio.get(saved.dashboardId, 8)).preview.widgets[0].datas).toEqual([
      { value: 500 },
    ]);
    const cloneMetric = await db.manager.findOne(Metric, {
      where: { id: saved.document.blocks[0].measureRefs[0].id },
    });
    expect(JSON.parse(cloneMetric.definition).column).toBe('total');
  });
  const withScope = async (filters: any[]) => {
    const state = await studio.get(id, 7);
    await studio.save(
      id,
      {
        requestId: 'scope-' + id + '-' + filters.map(f => f.column + f.values.join('')).join('_'),
        expectedRevision: state.document.revision,
        expectedSourceRevision: state.sourceRevision,
        document: { ...state.document, filters },
      },
      7,
    );
  };
  it('maps the published categorical scope onto renamed target columns before aggregation', async () => {
    await withScope([{ column: 'channel', values: ['Site'] }]);
    const p = await publish({ requestId: 'scope-' + id });
    const row: any = await db.manager.findOne(StudioPublication, { where: { token: p.token } });
    const template = JSON.parse(row.remixTemplate);
    expect(template.filters).toEqual([{ column: 'channel', values: ['Site'] }]);
    // The scope column is required for every retained supported block, not only its own measure/dimension.
    expect(template.requiredFields).toEqual(
      expect.arrayContaining([
        { name: 'channel', type: 'VARCHAR', blockIds: ['block-1', 'block-2', 'block-3'] },
      ]),
    );
    const v = await preview(p);
    expect(v.mappedFilters).toEqual([{ column: 'segment', values: ['Site'] }]);
    expect(v.unmappedFilters).toEqual([]);
    expect(v.preview.widgets[0].datas).toEqual([{ value: 300 }]);
    expect(v.preview.widgets[1].datas).toEqual([{ dimension: 'Site', value: 300 }]);
    const saved = await saveRemix(p, v);
    const clone = await studio.get(saved.dashboardId, 8);
    expect(clone.document.filters).toEqual([{ column: 'segment', values: ['Site'] }]);
    expect(clone.preview.widgets[0].datas).toEqual([{ value: 300 }]);
    const cloneRow = await db.manager.findOne(Dashboard, { where: { id: saved.dashboardId } });
    const stored = JSON.parse(cloneRow?.structuredDefinition ?? '{}');
    expect(stored.studioFilters).toEqual([{ column: 'segment', values: ['Site'] }]);
    const analysis = (await dashboards.analysis(saved.dashboardId, 8)).data;
    expect(analysis.defaultFilters).toEqual([{ column: 'segment', values: ['Site'] }]);
    for (const widget of analysis.widgets) expect(widget.sql).not.toContain('WHERE');
  });
  it('fails closed when the published scope column cannot be mapped to the target', async () => {
    await withScope([{ column: 'weight', values: [2] }]);
    const p = await publish({ requestId: 'scope-missing-' + id });
    const row: any = await db.manager.findOne(StudioPublication, { where: { token: p.token } });
    expect(JSON.parse(row.remixTemplate).requiredFields).toEqual(
      expect.arrayContaining([
        { name: 'weight', type: 'BIGINT', blockIds: ['block-1', 'block-2', 'block-3'] },
      ]),
    );
    const target = {
      targetSourceId: 6,
      mapping: { amount: 'total', channel: 'segment', event_time: 'occurred_at' },
    };
    const v = await preview(p, target);
    expect(v.unmappedFilters).toEqual(['weight']);
    expect(v.unmappedBlocks.map(b => b.blockId)).toEqual(['block-1', 'block-2', 'block-3']);
    expect(v.preview).toBeUndefined();
    const before = {
      dashboards: await db.manager.count(Dashboard),
      metrics: await db.manager.count(Metric),
    };
    await expect(saveRemix(p, v, target)).rejects.toMatchObject({ status: 400 });
    expect(await db.manager.count(Dashboard)).toBe(before.dashboards);
    expect(await db.manager.count(Metric)).toBe(before.metrics);
  });
  it('never returns aggregates for an unmappable scope even when the template omits its column', async () => {
    const p = await publish({ requestId: 'scope-orphan-' + id });
    const row: any = await db.manager.findOne(StudioPublication, { where: { token: p.token } });
    const template = JSON.parse(row.remixTemplate);
    template.filters = [{ column: 'weight', values: [2] }];
    await db.manager.update(StudioPublication, p.token, {
      remixTemplate: JSON.stringify(template),
    });
    const v = await preview(p);
    expect(v.unmappedFilters).toEqual(['weight']);
    expect(v.unmappedBlocks).toEqual([]);
    expect(v.mappedFilters).toEqual([]);
    expect(v.preview).toBeUndefined();
    const before = await db.manager.count(Dashboard);
    await expect(saveRemix(p, v)).rejects.toMatchObject({ status: 400 });
    expect(await db.manager.count(Dashboard)).toBe(before);
  });
  it('rejects a direct remix whose scope values cannot be applied without writing artifacts', async () => {
    const p = await publish({ requestId: 'scope-invalid-' + id });
    const row: any = await db.manager.findOne(StudioPublication, { where: { token: p.token } });
    const template = JSON.parse(row.remixTemplate);
    template.filters = [{ column: 'amount', values: ['not-a-number'] }];
    await db.manager.update(StudioPublication, p.token, {
      remixTemplate: JSON.stringify(template),
    });
    const before = {
      dashboards: await db.manager.count(Dashboard),
      metrics: await db.manager.count(Metric),
      requests: await db.manager.count(StudioRemixRequest),
    };
    await expect(
      saveRemix(p, { sourceRevision: (await creation.profile(2, 8)).dataVersion }),
    ).rejects.toBeDefined();
    expect(await db.manager.count(Dashboard)).toBe(before.dashboards);
    expect(await db.manager.count(Metric)).toBe(before.metrics);
    expect(await db.manager.count(StudioRemixRequest)).toBe(before.requests);
  });
  it('rejects a duplicated scope target on the direct remix commit without artifacts', async () => {
    await withScope([
      { column: 'amount', values: [300] },
      { column: 'weight', values: [2] },
    ]);
    const p = await publish({ requestId: 'scope-duplicate-' + id });
    const duplicate = {
      targetSourceId: 6,
      mapping: {
        amount: 'total',
        weight: 'total',
        channel: 'segment',
        event_time: 'occurred_at',
      },
    };
    const previewError: any = await preview(p, duplicate).catch(error => error);
    expect(previewError.status).toBe(400);
    expect(previewError.message).toContain('amount');
    expect(previewError.message).toContain('weight');
    const before = {
      dashboards: await db.manager.count(Dashboard),
      metrics: await db.manager.count(Metric),
      requests: await db.manager.count(StudioRemixRequest),
    };
    const commitError: any = await saveRemix(
      p,
      { sourceRevision: (await creation.profile(6, 8)).dataVersion },
      duplicate,
    ).catch(error => error);
    expect(commitError.status).toBe(400);
    expect(commitError.message).toContain('amount');
    expect(commitError.message).toContain('weight');
    expect(await db.manager.count(Dashboard)).toBe(before.dashboards);
    expect(await db.manager.count(Metric)).toBe(before.metrics);
    expect(await db.manager.count(StudioRemixRequest)).toBe(before.requests);
  });
  it('rejects duplicated scope passed straight to the persist boundary without artifacts', async () => {
    const profile = await creation.profile(6, 8);
    const before = {
      dashboards: await db.manager.count(Dashboard),
      metrics: await db.manager.count(Metric),
    };
    await expect(
      db.transaction(manager =>
        creation.persistRemix(
          6,
          {
            schemaVersion: 1,
            title: 'duplicate scope',
            requiredFields: [],
            blocks: [],
            layouts: { lg: [], md: [], xs: [] },
          } as any,
          [],
          profile,
          8,
          manager,
          [
            { column: 'total', values: [300] },
            { column: 'total', values: [200] },
          ],
        ),
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(await db.manager.count(Dashboard)).toBe(before.dashboards);
    expect(await db.manager.count(Metric)).toBe(before.metrics);
  });

  const scopedTemplate = async (requestId: string, dateRange: any, stripDateField = false) => {
    const p = await publish({ requestId });
    const state = await studio.get(id, 7);
    const row: any = await db.manager.findOne(Dashboard, { where: { id } });
    const template = captureRemixTemplate(
      { ...state.document, dateRange },
      metricLinkItems(row.structuredDefinition ? JSON.parse(row.structuredDefinition) : null, {
        databaseId: state.document.sourceId,
      } as any),
      (await connection.queryDuckDB(state.document.sourceId, 'DESCRIBE uploaded_data')).datas,
      JSON.parse(row.analysisDefinition).widgets,
    );
    if (stripDateField)
      template.requiredFields = template.requiredFields.filter(
        (field: any) => field.name !== dateRange.column,
      );
    await db.manager.update(StudioPublication, p.token, {
      remixTemplate: JSON.stringify(template),
    });
    return { p, template };
  };
  it('maps the published date scope onto the target temporal column and aggregates only that period', async () => {
    const { p, template } = await scopedTemplate('date-scope-' + id, {
      column: 'event_time',
      start: '2026-01-01',
      end: '2026-01-01',
    });
    expect(template.dateRange).toEqual({
      column: 'event_time',
      start: '2026-01-01',
      end: '2026-01-01',
    });
    // The published date column is required for every retained supported block.
    expect(template.requiredFields).toEqual(
      expect.arrayContaining([
        {
          name: 'event_time',
          type: expect.stringMatching(/^TIMESTAMP/),
          blockIds: ['block-1', 'block-2', 'block-3'],
        },
      ]),
    );
    const v = await preview(p);
    expect(v.mappedDateRange).toEqual({
      column: 'occurred_at',
      start: '2026-01-01',
      end: '2026-01-01',
    });
    expect(v.unmappedDateRange).toBeUndefined();
    expect(v.preview.widgets[0].datas).toEqual([{ value: 300 }]);
    const saved = await saveRemix(p, v);
    const stored = await db.manager.findOne(StudioState, {
      where: { dashboardId: saved.dashboardId },
    });
    if (!stored) throw new Error('Expected clone Studio state');
    expect(JSON.parse(stored.document).document.dateRange).toEqual({
      column: 'occurred_at',
      start: '2026-01-01',
      end: '2026-01-01',
    });
    const cloneRow: any = await db.manager.findOne(Dashboard, { where: { id: saved.dashboardId } });
    expect(JSON.parse(cloneRow.structuredDefinition).studioDateRange).toEqual({
      column: 'occurred_at',
      start: '2026-01-01',
      end: '2026-01-01',
    });
    for (const widget of (await dashboards.analysis(saved.dashboardId, 8)).data.widgets)
      expect(widget.sql).not.toContain('WHERE');
  });
  it('fails closed when the date scope column cannot be mapped on the target', async () => {
    const { p } = await scopedTemplate('date-scope-wrong-' + id, {
      column: 'event_time',
      start: '2026-01-01',
      end: '2026-01-01',
    });
    const wrongType = await preview(p, {
      mapping: { amount: 'total', channel: 'segment', event_time: 'segment' },
    });
    expect(wrongType.mappedDateRange).toBeUndefined();
    expect(wrongType.unmappedDateRange).toBe('event_time');
    expect(wrongType.unmappedFilters).toEqual([]);
    expect(wrongType.preview).toBeUndefined();
    const before = {
      dashboards: await db.manager.count(Dashboard),
      metrics: await db.manager.count(Metric),
      requests: await db.manager.count(StudioRemixRequest),
    };
    const error: any = await saveRemix(p, wrongType, {
      mapping: { amount: 'total', channel: 'segment', event_time: 'segment' },
    }).catch(caught => caught);
    expect(error.status).toBe(400);
    expect(await db.manager.count(Dashboard)).toBe(before.dashboards);
    expect(await db.manager.count(Metric)).toBe(before.metrics);
    expect(await db.manager.count(StudioRemixRequest)).toBe(before.requests);
    // A template that omits the scope column entirely still must not drop the date scope.
    const { p: orphan } = await scopedTemplate(
      'date-scope-orphan-' + id,
      { column: 'event_time', start: '2026-01-01', end: '2026-01-01' },
      true,
    );
    const orphanView = await preview(orphan, {
      mapping: { amount: 'total', channel: 'segment' },
      excludedBlockIds: ['block-3'],
    });
    expect(orphanView.mappedDateRange).toBeUndefined();
    expect(orphanView.unmappedDateRange).toBe('event_time');
    expect(orphanView.unmappedFilters).toEqual([]);
    expect(orphanView.preview).toBeUndefined();
    const orphanError: any = await saveRemix(orphan, orphanView, {
      mapping: { amount: 'total', channel: 'segment' },
      excludedBlockIds: ['block-3'],
    }).catch(caught => caught);
    expect(orphanError.status).toBe(400);
    expect(await db.manager.count(Dashboard)).toBe(before.dashboards);
    expect(await db.manager.count(Metric)).toBe(before.metrics);
  });
  it('keeps an all-time publication without a date scope unchanged', async () => {
    const p = await publish({ requestId: 'date-scope-none-' + id });
    const row: any = await db.manager.findOne(StudioPublication, { where: { token: p.token } });
    expect(JSON.parse(row.remixTemplate).dateRange).toBeUndefined();
    const v = await preview(p);
    expect(v.mappedDateRange).toBeUndefined();
    expect(v.unmappedDateRange).toBeUndefined();
    expect(v.preview.widgets[0].datas).toEqual([{ value: 500 }]);
    expect((await remixService().template(p.token, 8)).dateRange).toBeUndefined();
  });
  it('rejects a date scope the target source cannot apply without artifacts', async () => {
    const profile = await creation.profile(2, 8);
    const before = {
      dashboards: await db.manager.count(Dashboard),
      metrics: await db.manager.count(Metric),
    };
    await expect(
      db.transaction(manager =>
        creation.persistRemix(
          2,
          {
            schemaVersion: 1,
            title: 'date scope',
            requiredFields: [],
            blocks: [],
            layouts: { lg: [], md: [], xs: [] },
          } as any,
          [],
          profile,
          8,
          manager,
          [],
          { column: 'segment', start: '2026-01-01', end: '2026-01-01' },
        ),
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(await db.manager.count(Dashboard)).toBe(before.dashboards);
    expect(await db.manager.count(Metric)).toBe(before.metrics);
  });
  it('T14 receipt reads an authorized committed private clone, bound to its actual target source', async () => {
    const publication = await publish();
    const checked = await preview(publication);
    const created = await saveRemix(publication, checked, { requestId: 't14-receipt' });
    const service = remixService();
    expect(await service.receipt(8, 't14-receipt', 2)).toMatchObject({
      dashboardId: created.dashboardId,
      sourceId: 2,
      revision: created.document.revision,
    });
    expect(await service.receipt(7, 't14-receipt', 2)).toBeUndefined();
    await expect(service.receipt(8, 't14-receipt', 5)).rejects.toMatchObject({ status: 409 });
    await db.manager.update(Database, 2, { ownerId: 7 });
    await expect(service.receipt(8, 't14-receipt', 2)).rejects.toMatchObject({ status: 403 });
  });
});
