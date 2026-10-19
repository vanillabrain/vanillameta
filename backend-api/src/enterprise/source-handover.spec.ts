import * as fs from 'fs/promises';
import { promises as mutableFs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createHash, randomUUID } from 'crypto';
import { DuckDBInstance } from '@duckdb/node-api';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { DataSource, EntityManager } from 'typeorm';
import { semanticMetadata } from '../../test/util/semantic-mysql';
import { HttpExceptionFilter } from '../nest-utils/http-exception.filter';
import { SourceHandoverService } from './source-handover.service';
import { SourceHandoverController } from './source-handover.controller';
import { HandoverProposalService } from './handover-proposal.service';
import { EnterpriseSourceHandover } from './entities/enterprise-source-handover.entity';
import { EnterpriseHandoverProposal } from './entities/enterprise-handover-proposal.entity';
import { EnterpriseOrganization } from './entities/enterprise-organization.entity';
import { EnterpriseMembership } from './entities/enterprise-membership.entity';
import { EnterpriseAuditEvent } from './entities/enterprise-audit-event.entity';
import { EnterpriseResourceGrant } from './entities/enterprise-resource-grant.entity';
import { EnterpriseGroupGrant } from './entities/enterprise-group.entity';
import { EnterpriseResourcePolicyService } from './resource-policy.service';
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
import { FileRefreshService } from '../database/file-refresh.service';
import { DuckDBService } from '../analysis/duckdb.service';
import { encryptConnectionConfig, parseConnectionConfig } from '../utils/crypto.util';
import { AddSourceHandover1792620000000 } from '../migrations/1792620000000-add-source-handover';

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
  EnterpriseAuditEvent,
  EnterpriseHandoverProposal,
  EnterpriseSourceHandover,
];
describe('UC051 source file in-place handover actual HTTP and metadata', () => {
  jest.setTimeout(30000);
  let db: DataSource,
    app: INestApplication,
    intent: HandoverProposalService,
    service: SourceHandoverService,
    files: DatabaseService,
    root: string,
    base: Buffer;
  let filenames: string[];
  const priorSecret = process.env.ACCESS_SECRET,
    priorRoot = process.env.FILE_UPLOAD_DIR;
  const jwt = new JwtService();
  const token = (actor = 1, epoch = 0) =>
    jwt.sign(
      { accessKeyData: { id: actor, userId: `source-handover-${actor}`, authVersion: epoch } },
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
  const fileSnapshot = () =>
    Promise.all(
      filenames
        .flatMap(filename => [filename, path.join(path.dirname(filename), 'import.json')])
        .map(async filename => {
          const stat = await fs.stat(filename, { bigint: true });
          return {
            bytes: (await fs.readFile(filename)).toString('base64'),
            mtime: String(stat.mtimeNs),
            ino: String(stat.ino),
          };
        }),
    );
  const proposal = async (two = false) => {
    const created = await intent.create(1, 0, {
      requestId: randomUUID(),
      recipientId: 2,
      assets: (two ? [11, 12] : [11]).map(id => ({ kind: 'source', id, title: 'Source ' + id })),
    });
    return intent.accept(created.requestId, 2, 0, {
      expectedVersion: created.version,
      reviewBasis: created.reviewBasis,
    });
  };
  const prepare = async (p?: any) => {
    p ??= await proposal();
    const review = (await http('get', p.requestId + '/source-transfer-review').expect(200)).body;
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
      row: (await http('post', p.requestId + '/source-transfer', 1, body).expect(201)).body,
    };
  };
  const managed = async (id: number) => {
    const filename = path.join(root, randomUUID(), 'data.duckdb');
    await fs.mkdir(path.dirname(filename));
    await fs.writeFile(filename, base);
    await fs.writeFile(
      path.join(path.dirname(filename), 'import.json'),
      JSON.stringify({ status: 'ready', databaseId: id }),
    );
    filenames.push(filename);
    return filename;
  };
  beforeAll(async () => {
    process.env.ACCESS_SECRET = 'synthetic-source-handover';
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'vm-source-base-'));
    const filename = path.join(dir, 'base.duckdb');
    const instance = await DuckDBInstance.create(filename),
      connection = await instance.connect();
    try {
      await connection.run(
        'CREATE TABLE uploaded_data(amount INTEGER); INSERT INTO uploaded_data VALUES (10),(20)',
      );
    } finally {
      connection.closeSync();
      instance.closeSync();
    }
    base = await fs.readFile(filename);
    await fs.rm(dir, { recursive: true, force: true });
    db = await semanticMetadata('handover', {
      type: 'sqlite',
      database: ':memory:',
      entities,
      synchronize: true,
    });
    intent = new HandoverProposalService(db);
    service = new SourceHandoverService(db, intent);
    files = new DatabaseService(
      db.getRepository(Database),
      undefined,
      db.getRepository(Dataset),
      db.getRepository(TableQuery),
      {} as any,
    );
    const module = await Test.createTestingModule({
      controllers: [SourceHandoverController, DatabaseController],
      providers: [
        { provide: SourceHandoverService, useValue: service },
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
    if (priorSecret === undefined) delete process.env.ACCESS_SECRET;
    else process.env.ACCESS_SECRET = priorSecret;
    if (priorRoot === undefined) delete process.env.FILE_UPLOAD_DIR;
    else process.env.FILE_UPLOAD_DIR = priorRoot;
  });
  afterEach(async () => {
    jest.restoreAllMocks();
    await fs.rm(root, { recursive: true, force: true });
  });
  beforeEach(async () => {
    root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'vm-source-handover-')));
    process.env.FILE_UPLOAD_DIR = root;
    filenames = [];
    for (const e of [...entities].reverse())
      await db.getRepository(e).createQueryBuilder().delete().execute();
    await db.manager.insert(
      User,
      [1, 2, 3, 4].map(id => ({
        id,
        userId: `source-handover-${id}`,
        email: `source-handover-${id}@example.invalid`,
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
    for (const id of [11, 12]) {
      const filename = await managed(id);
      await db.manager.insert(Database, {
        id,
        ownerId: 1,
        name: 'Source ' + id,
        engine: 'duckdb',
        type: 'duckdb',
        connectionConfig: encryptConnectionConfig(
          JSON.stringify({
            client: 'duckdb',
            connection: { filename },
            fileVersions: [{ filename }],
          }),
        ),
      });
    }
    await db.manager.insert(Metric, {
      id: 21,
      databaseId: 11,
      name: 'synthetic_amount',
      tableName: 'uploaded_data',
      aggregation: MetricAggregation.SUM,
      expression: 'amount',
      definition: JSON.stringify({
        schemaVersion: 1,
        sourceId: 11,
        definitionVersion: 1,
        aggregation: 'SUM',
        column: 'amount',
      }),
    });
    await db.manager.insert(SourceCatalogEntry, {
      sourceId: 11,
      version: 1,
      actorId: 1,
      schemaRevision: 'a'.repeat(64),
      sourceRevision: 'a'.repeat(64),
      metadata: '{"title":"Synthetic metadata"}',
    });
    await db.manager.insert(SourceConditionEntry, {
      sourceId: 11,
      version: 1,
      actorId: 1,
      sourceRevision: 'a'.repeat(64),
      definition: '{"version":1,"groups":[]}',
    });
  });
  it('accepts a source created by actual multipart HTTP upload and transfers it in place', async () => {
    const worker = new DuckDBService();
    (files as any).duckdbService = worker;
    try {
      const upload = (
        await request(app.getHttpServer())
          .post('/database/upload')
          .set('Authorization', 'Bearer ' + token(1))
          .attach('file', Buffer.from('amount,channel\n10,a\n20,b\n'), 'normal-source.csv')
          .expect(201)
      ).body;
      const source = await db.manager.findOneBy(Database, { id: upload.data.id });
      expect(source).toMatchObject({ engine: 'duckdb', type: 'duckdb', ownerId: 1 });
      const config = parseConnectionConfig(source.connectionConfig);
      filenames.push(config.connection.filename);
      const created = await intent.create(1, 0, {
        requestId: randomUUID(),
        recipientId: 2,
        assets: [{ kind: 'source', id: source.id, title: source.name }],
      });
      const p = await intent.accept(created.requestId, 2, 0, {
        expectedVersion: created.version,
        reviewBasis: created.reviewBasis,
      });
      const beforeFiles = await fileSnapshot();
      const { row } = await prepare(p);
      const accepted = (
        await http('post', p.requestId + '/source-transfer/accept', 2, terms(row)).expect(201)
      ).body;
      await http('post', p.requestId + '/source-transfer/execute', 1, terms(accepted)).expect(201);
      expect(await db.manager.findOneBy(Database, { id: source.id })).toMatchObject({
        ownerId: 2,
        catalogVersion: 1,
        type: 'duckdb',
        connectionConfig: source.connectionConfig,
      });
      expect(await fileSnapshot()).toEqual(beforeFiles);
    } finally {
      (files as any).duckdbService = undefined;
      await worker.onModuleDestroy();
    }
  });
  it.each(['FILE', 'file', 'mysql'])(
    'rejects unsupported source type %s despite a ready DuckDB file',
    async type => {
      await db.manager.update(Database, 11, { type });
      const p = await proposal();
      const before = await snapshot();
      const review = (await http('get', p.requestId + '/source-transfer-review').expect(200)).body;
      expect(review).toMatchObject({ eligible: false });
      expect(review.blockers).toContain('unsupported_source');
      expect(await snapshot()).toEqual(before);
    },
  );
  it('requires JWT/current party and exact request shapes with404 for missing records', async () => {
    await request(app.getHttpServer())
      .get('/enterprise/handover/' + randomUUID() + '/source-transfer')
      .expect(401);
    await http('get', 'bad/source-transfer').expect(400);
    await http('get', randomUUID() + '/source-transfer').expect(404);
    const p = await proposal();
    await http('get', p.requestId + '/source-transfer').expect(404);
    await http('get', p.requestId + '/source-transfer-review', 2).expect(403);
    await http('get', p.requestId + '/source-transfer', 3).expect(403);
    await http('post', p.requestId + '/source-transfer', 1, {}).expect(400);
  });
  it('transfers two real DuckDB sources atomically, preserves every file/child definition and denies same old JWT', async () => {
    const p = await proposal(true);
    const beforeRead = await snapshot(),
      beforeFiles = await fileSnapshot();
    const review = (await http('get', p.requestId + '/source-transfer-review').expect(200)).body;
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
      ].sort(),
    );
    expect(review.sources).toEqual([
      { id: 11, title: 'Source 11', filesChecked: 1, metricCount: 1 },
      { id: 12, title: 'Source 12', filesChecked: 1, metricCount: 0 },
    ]);
    expect(await snapshot()).toEqual(beforeRead);
    const { row, body } = await prepare(p);
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
        'replayed',
      ].sort(),
    );
    await http('post', p.requestId + '/source-transfer/execute', 1, terms(row)).expect(409);
    await http('post', p.requestId + '/source-transfer/accept', 1, terms(row)).expect(403);
    const accepted = (
      await http('post', p.requestId + '/source-transfer/accept', 2, terms(row)).expect(201)
    ).body;
    const before = await snapshot();
    const completed = (
      await http('post', p.requestId + '/source-transfer/execute', 1, terms(accepted)).expect(201)
    ).body;
    expect(completed).toMatchObject({ status: 'completed', version: 3 });
    for (const id of [11, 12])
      expect(await db.manager.findOneBy(Database, { id })).toMatchObject({
        ownerId: 2,
        catalogVersion: 1,
      });
    for (const e of [Metric, SourceCatalogEntry, SourceConditionEntry])
      expect((await snapshot())[entities.indexOf(e)]).toEqual(before[entities.indexOf(e)]);
    for (const source of await db.manager.find(Database, { order: { id: 'ASC' } }))
      expect(source.connectionConfig).toBe(
        (before[entities.indexOf(Database)] as any[]).find(r => r.id === source.id)
          .connectionConfig,
      );
    expect(await fileSnapshot()).toEqual(beforeFiles);
    await request(app.getHttpServer())
      .get('/database/info/11')
      .set('Authorization', 'Bearer ' + token(1))
      .expect(403);
    await request(app.getHttpServer())
      .get('/database/info/11')
      .set('Authorization', 'Bearer ' + token(2))
      .expect(200);
    const stable = await snapshot();
    expect(await service.change(p.requestId, 1, 0, terms(accepted), 'execute')).toEqual({
      ...completed,
      replayed: true,
    });
    expect(await service.prepare(p.requestId, 1, 0, body)).toEqual({
      ...completed,
      replayed: true,
    });
    expect(await snapshot()).toEqual(stable);
    const saved = await db.manager.findOneBy(EnterpriseSourceHandover, { proposalId: p.requestId });
    expect(
      new Set([saved.preparedAuditId, saved.acceptedAuditId, saved.completedAuditId]).size,
    ).toBe(3);
    expect(saved.custodyHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(completed)).not.toMatch(/custodyHash|filename|connectionConfig|AuditId/);
  });
  it.each([
    'grant',
    'dataset',
    'table',
    'view',
    'dashboard',
    'studio',
    'execution',
    'export',
    'refresh',
    'retained',
    'cleanup',
    'fileModel',
    'unregistered',
    'symlink',
    'hardlink',
    'shared',
    'malformedConsumer',
    'versionLimit',
    'crossMetric',
  ])('fails closed for %s without read writes', async kind => {
    if (kind === 'grant')
      await db.manager.insert(EnterpriseResourceGrant, {
        resourceKind: 'source',
        resourceId: 11,
        recipientId: 3,
        organizationId: 10,
        ownerId: 1,
        version: 1,
        read: true,
      });
    if (kind === 'dataset')
      await db.manager.insert(Dataset, { databaseId: 11, title: 'Synthetic', query: 'SELECT 1' });
    if (kind === 'table')
      await db.manager.insert(TableQuery, { databaseId: 11, query: 'SELECT 1' });
    if (kind === 'view')
      await db.manager.insert(PersonalView, {
        sourceId: 11,
        userId: 1,
        name: 'View',
        revision: 'a'.repeat(64),
        state: '{}',
      });
    if (kind === 'dashboard')
      await db.manager.insert(Dashboard, {
        title: 'Private',
        analysisDefinition: '{"databaseId":11}',
      });
    if (kind === 'studio')
      await db.manager.insert(StudioState, {
        dashboardId: 999,
        document: '{"document":{"sourceId":11}}',
        legacyRevision: 'a'.repeat(64),
      });
    if (kind === 'execution')
      await db.manager.insert(StudioExecution, {
        runId: randomUUID(),
        actorId: 1,
        dashboardId: 999,
        requestId: randomUUID(),
        payloadHash: 'a'.repeat(64),
        status: 'failed',
        state: '{"request":{"document":{"sourceId":11}}}',
      });
    if (kind === 'export')
      await db.manager.insert(ExportJob, {
        ownerId: 1,
        organizationId: 10,
        sourceId: 11,
        sourceOwnerId: 1,
        requestId: randomUUID(),
        digest: 'a'.repeat(64),
        requestJson: '{}',
        basisJson: '{}',
        status: 'ready',
        version: 1,
        expiresAt: new Date(Date.now() + 60000),
      });
    if (['refresh', 'retained'].includes(kind))
      await db.manager.insert(
        FileRefresh,
        refreshRow(kind === 'refresh' ? 'queued' : 'succeeded', kind === 'retained'),
      );
    if (kind === 'cleanup')
      await db.manager.insert(SourceDeleteReceipt, {
        actorId: 1,
        organizationId: 10,
        sourceId: 11,
        requestId: randomUUID(),
        expectedRevision: 'a'.repeat(64),
        digest: 'a'.repeat(64),
        filePlan: '{}',
        managedFiles: 1,
        cleanupStatus: 'pending',
      });
    if (kind === 'fileModel')
      await db.manager.update(Database, 11, {
        connectionConfig: JSON.stringify({
          client: 'duckdb',
          fileModel: {},
          connection: { filename: filenames[0] },
        }),
      });
    if (kind === 'unregistered')
      await fs.writeFile(
        path.join(path.dirname(filenames[0]), 'import.json'),
        '{"status":"ready"}',
      );
    if (kind === 'symlink') {
      await fs.unlink(filenames[0]);
      await fs.symlink(filenames[1], filenames[0]);
    }
    if (kind === 'hardlink') await fs.link(filenames[0], path.join(root, 'hardlink'));
    if (kind === 'shared')
      await db.manager.insert(CommerceSource, {
        name: 'Synthetic shared',
        ownerId: 1,
        status: 'ready',
        publishedFilename: filenames[0],
      } as any);
    if (kind === 'malformedConsumer')
      await db.manager.insert(Database, {
        ownerId: 3,
        name: 'Other',
        engine: 'duckdb',
        type: 'duckdb',
        connectionConfig: 'broken',
      });
    if (kind === 'versionLimit')
      await db.manager.update(Database, 11, { catalogVersion: 2147483647 });
    if (kind === 'crossMetric')
      await db.manager.update(Metric, 21, {
        definition: '{"schemaVersion":1,"sourceId":12,"definitionVersion":1}',
      });
    const p = await proposal(),
      before = await snapshot();
    const review = (await http('get', p.requestId + '/source-transfer-review').expect(200)).body;
    expect(review.eligible).toBe(false);
    expect(review.blockers.length).toBeGreaterThan(0);
    expect(await snapshot()).toEqual(before);
  });
  it('supports safe null legacy Metric definitions without changing bytes or IDs', async () => {
    await db.manager.update(Metric, 21, { definition: null });
    await prepare();
  });
  it.each(['accept', 'execute'] as const)(
    '%s checks file replacement and source metadata after final preparation',
    async action => {
      const { p, row } = await prepare();
      const current =
        action === 'execute' ? await service.change(p.requestId, 2, 0, terms(row), 'accept') : row;
      await fs.appendFile(filenames[0], Buffer.from('changed'));
      const before = await snapshot();
      await http(
        'post',
        p.requestId + '/source-transfer/' + action,
        action === 'accept' ? 2 : 1,
        terms(current),
      ).expect(409);
      expect(await snapshot()).toEqual(before);
    },
  );
  it('rolls back all owners, versions and audit links when the second source update fails', async () => {
    const { p, row } = await prepare(await proposal(true));
    const accepted = await service.change(p.requestId, 2, 0, terms(row), 'accept');
    const before = await snapshot(),
      fileBefore = await fileSnapshot();
    const original = EntityManager.prototype.update;
    jest
      .spyOn(EntityManager.prototype, 'update')
      .mockImplementation(function (e: any, c: any, v: any) {
        if (e === Database && c.id === 12 && v.ownerId === 2)
          throw new Error('Synthetic source rollback');
        return original.call(this, e, c, v);
      });
    await expect(service.change(p.requestId, 1, 0, terms(accepted), 'execute')).rejects.toThrow(
      'Synthetic source rollback',
    );
    expect(await snapshot()).toEqual(before);
    expect(await fileSnapshot()).toEqual(fileBefore);
  });
  it('historical retries remain read-only after intent cancellation/expiry and redact titles', async () => {
    const { p, row, body } = await prepare();
    const accepted = await service.change(p.requestId, 2, 0, terms(row), 'accept');
    await service.change(p.requestId, 1, 0, terms(accepted), 'execute');
    await db.manager.update(EnterpriseHandoverProposal, p.requestId, {
      status: 'cancelled',
      expiresAt: new Date(0),
    });
    const before = await snapshot();
    for (const result of [
      await service.prepare(p.requestId, 1, 0, body),
      await service.change(p.requestId, 2, 0, terms(row), 'accept'),
      await service.change(p.requestId, 1, 0, terms(accepted), 'execute'),
      await service.detail(p.requestId, 1, 0),
    ])
      expect(result).toMatchObject({ status: 'completed', detailsAvailable: false, sources: [] });
    expect(await snapshot()).toEqual(before);
  });
  it.each(['accept', 'execute'] as const)(
    '%s rejects final expiry after a Source wait without writes',
    async action => {
      const { p, row } = await prepare();
      const current =
        action === 'execute' ? await service.change(p.requestId, 2, 0, terms(row), 'accept') : row;
      const before = await snapshot();
      let entered: () => void, release: () => void;
      const held = new Promise<void>(r => (entered = r)),
        gate = new Promise<void>(r => (release = r));
      let paused = false;
      const original = EntityManager.prototype.findOne;
      jest
        .spyOn(EntityManager.prototype, 'findOne')
        .mockImplementation(async function (e: any, o: any) {
          const r = await original.call(this, e, o);
          if (
            !paused &&
            e === Database &&
            o.where?.id === 11 &&
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
  it('fresh authority after snapshot rejects revoked actor and hides no stale titles', async () => {
    const { p } = await prepare();
    const original = db.transaction.bind(db);
    let injected = false;
    jest.spyOn(db, 'transaction').mockImplementation(async (...args: any[]) => {
      const result = await original(...(args as [any]));
      if (!injected) {
        injected = true;
        await db.manager.update(User, 2, { authVersion: 1 });
      }
      return result;
    });
    await http('get', p.requestId + '/source-transfer', 2).expect(401);
  });
  it('migration creates additive schema and exact audit/proof fields, and rejects incompatible preflight', async () => {
    const r = db.createQueryRunner();
    await r.connect();
    try {
      await r.dropTable('enterprise_source_handover');
      const m = new AddSourceHandover1792620000000();
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
  const refreshRow = (status: string, inputRetained = false) => ({
    id: randomUUID(),
    actorId: 1,
    actorEpoch: 0,
    sourceId: 11,
    requestId: randomUUID(),
    payloadDigest: 'a'.repeat(64),
    inputDigest: 'a'.repeat(64),
    expectedRevision: 'a'.repeat(64),
    originalname: 'synthetic.csv',
    extension: '.csv',
    status: status as any,
    storageDigest: 'a'.repeat(64),
    inputRetained,
    attempts: 0,
    leaseToken: null,
    leaseUntil: null,
  });
  it.each(['directory-symlink', 'child-symlink', 'marker-symlink', 'open', 'oversize'])(
    'fails closed admission boundary %s before any outside marker open',
    async mode => {
      const outside = await fs.realpath(
        await fs.mkdtemp(path.join(os.tmpdir(), 'vm-admission-outside-')),
      );
      const directory = path.join(root, 'refresh-input');
      const id = randomUUID();
      try {
        await fs.writeFile(
          path.join(outside, 'admission.json'),
          JSON.stringify({ actorId: 1, sourceId: 11, createdAt: Date.now() }),
        );
        if (mode === 'directory-symlink') {
          const child = path.join(outside, id);
          await fs.mkdir(child);
          await fs.copyFile(
            path.join(outside, 'admission.json'),
            path.join(child, 'admission.json'),
          );
          await fs.symlink(outside, directory);
        } else {
          await fs.mkdir(directory);
          if (mode === 'child-symlink') await fs.symlink(outside, path.join(directory, id));
          else {
            const child = path.join(directory, id);
            await fs.mkdir(child);
            if (mode === 'marker-symlink')
              await fs.symlink(
                path.join(outside, 'admission.json'),
                path.join(child, 'admission.json'),
              );
            else
              await fs.writeFile(
                path.join(child, 'admission.json'),
                mode === 'oversize'
                  ? 'x'.repeat(513)
                  : JSON.stringify({ actorId: 1, sourceId: 11, createdAt: Date.now() }),
              );
          }
        }
        const p = await proposal();
        const before = await snapshot();
        const opened = jest.spyOn(mutableFs, 'open');
        const review = (await http('get', p.requestId + '/source-transfer-review').expect(200))
          .body;
        expect(review.blockers).toContain('running_work');
        expect(review.eligible).toBe(false);
        if (mode.includes('symlink'))
          expect(
            opened.mock.calls.some(([filename]) => String(filename).endsWith('admission.json')),
          ).toBe(false);
        expect(await snapshot()).toEqual(before);
      } finally {
        await fs.rm(outside, { recursive: true, force: true });
      }
    },
  );
  it('checks every deduplicated registered version and rejects an unregistered historical version', async () => {
    const old = await managed(11);
    await db.manager.update(Database, 11, {
      connectionConfig: encryptConnectionConfig(
        JSON.stringify({
          client: 'duckdb',
          connection: { filename: filenames[0] },
          fileVersions: [{ filename: filenames[0] }, { filename: old }, { filename: old }],
        }),
      ),
    });
    const p = await proposal();
    const review = (await http('get', p.requestId + '/source-transfer-review').expect(200)).body;
    expect(review).toMatchObject({
      eligible: true,
      sources: [{ id: 11, title: 'Source 11', filesChecked: 2, metricCount: 1 }],
    });
    await fs.writeFile(
      path.join(path.dirname(old), 'import.json'),
      JSON.stringify({ status: 'ready', databaseId: 12 }),
    );
    expect(
      (await http('get', p.requestId + '/source-transfer-review').expect(200)).body.blockers,
    ).toContain('file_unresolved');
  });
  it('rejects changed final UUID/payload and preserves cancellation after recipient epoch changes', async () => {
    const { p, row, body } = await prepare();
    const before = await snapshot();
    await http('post', p.requestId + '/source-transfer', 1, {
      ...body,
      requestId: randomUUID(),
    }).expect(409);
    await http('post', p.requestId + '/source-transfer', 1, {
      ...body,
      basis: 'b'.repeat(64),
    }).expect(409);
    expect(await snapshot()).toEqual(before);
    const accepted = await service.change(p.requestId, 2, 0, terms(row), 'accept');
    await db.manager.update(User, 2, { authVersion: 1 });
    await db.manager.update(EnterpriseSourceHandover, p.requestId, { expiresAt: new Date(0) });
    const cancelled = await service.change(p.requestId, 1, 0, terms(accepted), 'cancel');
    expect(cancelled).toMatchObject({ status: 'cancelled', detailsAvailable: false, sources: [] });
    const stable = await snapshot();
    expect(await service.change(p.requestId, 2, 1, terms(row), 'accept')).toMatchObject({
      status: 'cancelled',
      replayed: true,
    });
    expect(await snapshot()).toEqual(stable);
  });
  it('rejects current recipient epoch and file metadata changes before accepting', async () => {
    const { p, row } = await prepare();
    await db.manager.update(User, 2, { authVersion: 1 });
    const before = await snapshot();
    await http('post', p.requestId + '/source-transfer/accept', 2, terms(row), 1).expect(409);
    expect(await snapshot()).toEqual(before);
  });
  const sqlite = process.env.VM_SEMANTIC_MYSQL_CONFIG ? it.skip : it;
  sqlite.each(['metadata', 'metadata-symlink', 'unknown-outside', 'metadata-hardlink'])(
    'uses exact trusted server metadata consumer path: %s',
    async kind => {
      const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'vm-trusted-metadata-'));
      const metadataFile = path.join(outside, 'metadata.db');
      const original = (db.options as any).database;
      try {
        if (kind === 'metadata-symlink') await fs.symlink(filenames[0], metadataFile);
        else if (kind === 'metadata-hardlink') await fs.link(filenames[0], metadataFile);
        else await fs.writeFile(metadataFile, 'Synthetic metadata bytes never opened by custody');
        (db.options as any).database =
          kind === 'unknown-outside' ? path.join(outside, 'configured-other.db') : metadataFile;
        await db.manager.insert(Database, {
          ownerId: null,
          name: 'Seed metadata',
          engine: 'sqlite3',
          type: 'sqlite',
          connectionConfig: encryptConnectionConfig(
            JSON.stringify({ client: 'sqlite3', connection: { filename: metadataFile } }),
          ),
        });
        const p = await proposal();
        const review = (await http('get', p.requestId + '/source-transfer-review').expect(200))
          .body;
        if (kind === 'metadata') expect(review).toMatchObject({ eligible: true, blockers: [] });
        else
          expect(review.blockers).toContain(
            kind === 'metadata-hardlink' ? 'file_shared' : 'file_unresolved',
          );
      } finally {
        (db.options as any).database = original;
        await fs.rm(outside, { recursive: true, force: true });
      }
    },
  );
  const mysql = process.env.VM_SEMANTIC_MYSQL_CONFIG ? it : it.skip;
  mysql(
    'MySQL refresh admission started by the old owner waits transfer identity fence then rejects fresh ownership',
    async () => {
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
      const source = await db.manager.findOneBy(Database, { id: 11 });
      const refresh = new FileRefreshService(
        db,
        files,
        { uploadDigest: async () => 'b'.repeat(64) } as unknown as DuckDBService,
        new SourceAccessService(db),
      );
      jest.spyOn(refresh as any, 'schedule').mockImplementation(() => undefined);
      let done = false;
      const admission = refresh
        .start(
          11,
          { originalname: 'synthetic.csv', buffer: Buffer.from('amount\n5\n') },
          createHash('sha256').update(source.connectionConfig).digest('hex'),
          randomUUID(),
          1,
          undefined,
          0,
        )
        .then(
          v => ({ v }),
          e => ({ e }),
        )
        .finally(() => (done = true));
      try {
        await new Promise(r => setTimeout(r, 100));
        expect(done).toBe(false);
        release();
        await executing;
        expect(((await admission) as any).e).toMatchObject({ status: 403 });
        expect(await db.manager.count(FileRefresh)).toBe(0);
      } finally {
        release();
        await admission;
        await refresh.onModuleDestroy();
      }
    },
  );
  mysql(
    'MySQL existing source grant writer waits transfer then rejects the old owner',
    async () => {
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
      let done = false;
      const granting = new EnterpriseResourcePolicyService(db)
        .set('source', 11, 1, {
          recipientId: 3,
          expectedVersion: 0,
          rights: { read: true, edit: false, publish: false, export: false },
        })
        .then(
          v => ({ v }),
          e => ({ e }),
        )
        .finally(() => (done = true));
      try {
        await new Promise(r => setTimeout(r, 100));
        expect(done).toBe(false);
        release();
        await executing;
        expect(((await granting) as any).e).toMatchObject({ status: 403 });
        expect(await db.manager.count(EnterpriseResourceGrant)).toBe(0);
      } finally {
        release();
        await granting;
      }
    },
  );
  mysql(
    'MySQL actual source metadata writer waits transfer and rechecks owner before writing',
    async () => {
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
      let done = false;
      const writing = files
        .update(11, { name: 'Late old owner' } as any, 1, 0)
        .then(
          v => ({ v }),
          e => ({ e }),
        )
        .finally(() => (done = true));
      try {
        await new Promise(r => setTimeout(r, 100));
        expect(done).toBe(false);
        release();
        await executing;
        expect(((await writing) as any).e).toMatchObject({ status: 403 });
        expect(await db.manager.findOneBy(Database, { id: 11 })).toMatchObject({
          ownerId: 2,
          name: 'Source 11',
          catalogVersion: 1,
        });
      } finally {
        release();
        await writing;
      }
    },
  );
});
