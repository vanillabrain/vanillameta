import { SourceCatalogEntry } from './entities/source-catalog-entry.entity';
import { Dashboard } from '../dashboard/entities/dashboard.entity';
jest.mock('../ai/ai.service', () => ({ AiService: class {} }));
import { createHash, randomUUID } from 'crypto';
import { Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import request = require('supertest');
import { DataSource, EntityManager } from 'typeorm';
import { DuckDBService } from '../analysis/duckdb.service';
import { ConnectionService } from '../connection/connection.service';
import { AiDashboardService } from '../ai/ai-dashboard.service';
import { SourceAccessService } from '../ownership/source-access.service';
import { Database } from '../database/entities/database.entity';
import { Metric, MetricAggregation } from '../metric/entities/metric.entity';
import { User } from '../user/entities/user.entity';
import { EnterpriseMembership } from '../enterprise/entities/enterprise-membership.entity';
import { EnterpriseAuditEvent } from '../enterprise/entities/enterprise-audit-event.entity';
import { EnterpriseResourceGrant } from '../enterprise/entities/enterprise-resource-grant.entity';
import {
  EnterpriseGroup,
  EnterpriseGroupMember,
  EnterpriseGroupGrant,
} from '../enterprise/entities/enterprise-group.entity';
import { EnterpriseResourcePolicyService } from '../enterprise/resource-policy.service';
import { metadataTransaction } from '../common/metadata-work';
import { BiService } from './bi.service';
import { BiExploreService } from './bi-explore.service';
import { ExportJobsService, exportParts } from './export-jobs.service';
import { ExportJobsController } from './export-jobs.controller';
import { ExportJob, ExportPart } from './entities/export-job.entity';
import { EnterpriseNotificationService } from '../enterprise/notification.service';
import { EnterpriseNotificationAudience } from '../enterprise/entities/enterprise-notification-audience.entity';
import { EnterpriseNotificationState } from '../enterprise/entities/enterprise-notification-state.entity';
import { AddExportJobs1792510000000 } from '../migrations/1792510000000-add-export-jobs';
const deferred = () => {
  let resolve!: (v?: any) => void;
  const promise = new Promise<any>(r => (resolve = r));
  return { promise, resolve };
};
describe('UC054 durable aggregate export with actual SQLite DuckDB JWT', () => {
  let db: DataSource,
    worker: DuckDBService,
    connection: ConnectionService,
    bi: BiService,
    explore: BiExploreService,
    jobs: ExportJobsService,
    policy: EnterpriseResourcePolicyService,
    root: string,
    filename: string,
    revision: string;
  const previous = process.env.FILE_UPLOAD_DIR;
  const definition = (version = 1) => ({
    schemaVersion: 1,
    definitionVersion: version,
    sourceId: 1,
    tableName: 'uploaded_data',
    label: 'Revenue',
    unit: 'USD',
    decimalPlaces: 2,
    numberNotation: 'plain',
    aggregation: 'SUM',
    column: 'amount',
  });
  const input = (mode = 'explore'): any => ({
    requestId: randomUUID(),
    payload: {
      mode,
      query: {
        sourceId: 1,
        sourceRevision: revision,
        measureIds: [1],
        filters: [{ column: 'amount', range: { min: 15 } }],
        conditions: {
          sourceRevision: revision,
          definition: {
            include: {
              kind: 'group',
              operator: 'or',
              children: [
                { kind: 'predicate', column: 'region', operator: 'eq', values: ['A'] },
                { kind: 'predicate', column: 'channel', operator: 'eq', values: ['web'] },
              ],
            },
            exclude: { kind: 'predicate', column: 'amount', operator: 'gte', values: [90] },
          },
        },
        dateRange: { column: 'day', start: '2026-01-03', end: '2026-01-04' },
        comparePrevious: true,
        ...(mode === 'explore'
          ? { dimensionColumns: ['region'], rankingMeasureId: 1, includeRows: false }
          : { rowColumns: ['region'], columnColumns: ['channel'], rowHierarchy: true }),
      },
    },
    measureVersions: { '1': 1 },
  });
  const fresh = () => new ExportJobsService(db, bi, explore, connection);
  beforeAll(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'vm-export-jobs-'));
    process.env.FILE_UPLOAD_DIR = root;
    worker = new DuckDBService();
    const file = await worker.importFile({
      originalname: 'synthetic.csv',
      buffer: Buffer.from(
        'region,channel,amount,day\nA,web,10,2026-01-01\nA,app,20,2026-01-02\nB,web,30,2026-01-02\nA,web,40,2026-01-03\nB,app,50,2026-01-03\nA,app,60,2026-01-04\nB,web,100,2026-01-04\n',
      ),
    });
    filename = file.filename;
    db = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      synchronize: true,
      entities: [
        Dashboard,
        SourceCatalogEntry,
        User,
        EnterpriseMembership,
        EnterpriseAuditEvent,
        Database,
        Metric,
        EnterpriseResourceGrant,
        EnterpriseGroup,
        EnterpriseGroupMember,
        EnterpriseGroupGrant,
        ExportJob,
        ExportPart,
        EnterpriseNotificationAudience,
        EnterpriseNotificationState,
      ],
    }).initialize();
    await db.manager.save(
      User,
      [7, 8, 9].map(id => ({
        id,
        userId: 'export-' + id,
        email: 'export-' + id + '@example.invalid',
        password: 'synthetic-unused',
        active: true,
        authVersion: 0,
      })),
    );
    await db.manager.save(
      EnterpriseMembership,
      [7, 8, 9].map(userId => ({
        userId,
        organizationId: userId === 9 ? 2 : 1,
        role: userId === 7 ? ('admin' as const) : ('member' as const),
        team: '',
      })),
    );
    await db.manager.save(Database, {
      id: 1,
      ownerId: 7,
      name: 'Synthetic file',
      engine: 'duckdb',
      type: 'FILE',
      connectionConfig: JSON.stringify({ client: 'duckdb', connection: { filename } }),
    });
    await db.manager.save(Metric, {
      id: 1,
      databaseId: 1,
      name: 'synthetic_revenue',
      tableName: 'uploaded_data',
      aggregation: MetricAggregation.SUM,
      expression: 'amount',
      useYn: 'Y',
      definition: JSON.stringify(definition()),
    });
    connection = new ConnectionService(db.getRepository(Database), {} as any, worker);
    revision = await connection.duckDBVersion(1);
    policy = new EnterpriseResourcePolicyService(db);
    const access = new SourceAccessService(db, policy),
      ai = new AiDashboardService({} as any, connection, db.getRepository(Dashboard), access);
    bi = new BiService(db, access, connection, ai);
    explore = new BiExploreService(bi, ai, connection);
    jobs = fresh();
  });
  beforeEach(async () => {
    jest.restoreAllMocks();
    for (const entity of [
      EnterpriseNotificationState,
      EnterpriseNotificationAudience,
      ExportPart,
      ExportJob,
      EnterpriseAuditEvent,
      EnterpriseResourceGrant,
    ])
      await db.getRepository(entity).clear();
    await db.manager.update(User, 7, { active: true, authVersion: 0 });
    await db.manager.update(Database, 1, {
      ownerId: 7,
      catalogActive: true,
      connectionConfig: JSON.stringify({ client: 'duckdb', connection: { filename } }),
    });
    await db.manager.update(Metric, 1, { definition: JSON.stringify(definition()) });
  });
  afterAll(async () => {
    await worker?.onModuleDestroy();
    await db?.destroy();
    if (root) fs.rmSync(root, { recursive: true, force: true });
    if (previous === undefined) delete process.env.FILE_UPLOAD_DIR;
    else process.env.FILE_UPLOAD_DIR = previous;
  });
  it.each(['explore', 'pivot'])(
    'freezes %s conditions and comparison aggregate, persists bytes and reads after a new service instance',
    async mode => {
      const body = input(mode),
        spy = jest.spyOn(explore, 'exportCsv');
      const [job, replay] = await Promise.all([jobs.create(body, 7), jobs.create(body, 7)]);
      expect(job.id).toBe(replay.id);
      expect(await db.manager.count(ExportJob)).toBe(1);
      const audit = await db.manager.findOneBy(EnterpriseAuditEvent, { action: 'export.queued' });
      expect(audit).toMatchObject({ resourceId: job.id, actorId: 7, version: 1 });
      expect(spy).not.toHaveBeenCalled();
      const ready = await jobs.run(job.id, { expectedVersion: 1 }, 7);
      expect(ready.status).toBe('ready');
      const file = await fresh().file(job.id, 7);
      expect(file.csv).toContain('"Revenue","100",number,"50","50","100"');
      expect(file.csv).toContain('conditions');
      expect(file.bytes).toBe(Buffer.byteLength(file.csv));
      expect(spy).toHaveBeenCalledTimes(1);
      expect(await jobs.run(job.id, { expectedVersion: 1 }, 7)).toMatchObject({
        status: 'ready',
        id: job.id,
      });
      expect(spy).toHaveBeenCalledTimes(1);
      await db.manager.update(Metric, 1, { definition: JSON.stringify(definition(2)) });
      expect((await jobs.file(job.id, 7)).csv).toBe(file.csv);
      expect((await jobs.get(job.id, 7)).measureVersions).toEqual({ '1': 1 });
      await expect(
        jobs.create(
          {
            ...body,
            payload: { ...body.payload, query: { ...body.payload.query, comparePrevious: false } },
          },
          7,
        ),
      ).rejects.toMatchObject({ status: 409 });
    },
  );
  it('checks current export/org/actor before creating any row or aggregate SQL', async () => {
    const spy = jest.spyOn(explore, 'exportCsv');
    await expect(jobs.create(input(), 8)).rejects.toMatchObject({ status: 403 });
    expect(await db.manager.count(ExportJob)).toBe(0);
    await expect(jobs.create({ ...input(), measureVersions: { '1': 2 } }, 7)).rejects.toMatchObject(
      { status: 409 },
    );
    expect(await db.manager.count(ExportJob)).toBe(0);
    expect(spy).not.toHaveBeenCalled();
    const body = input();
    body.payload.query.includeRows = true;
    await expect(jobs.create(body, 7)).rejects.toMatchObject({ status: 400 });
    await policy.set('source', 1, 7, {
      recipientId: 8,
      expectedVersion: 0,
      rights: { read: true, edit: false, publish: false, export: true },
    });
    const job = await jobs.create(input(), 8);
    await expect(jobs.get(job.id, 9)).rejects.toMatchObject({ status: 403 });
    await policy.set('source', 1, 7, {
      recipientId: 8,
      expectedVersion: 1,
      rights: { read: true, edit: false, publish: false, export: false },
    });
    await expect(jobs.run(job.id, { expectedVersion: 1 }, 8)).rejects.toMatchObject({
      status: 403,
    });
    expect(spy).not.toHaveBeenCalled();
  });
  it.each(['explore', 'pivot'] as const)(
    'validates nested/top-level %s metric pins before creating a job',
    async mode => {
      const bad = input(mode);
      Object.assign(bad.payload.query, { expectedMeasureVersions: { '1': 2 } });
      await expect(jobs.create(bad, 7)).rejects.toMatchObject({ status: 400 });
      expect(await db.manager.count(ExportJob)).toBe(0);
      const good = input(mode);
      Object.assign(good.payload.query, { expectedMeasureVersions: { '1': 1 } });
      const job = await jobs.create(good, 7);
      expect(job.measureVersions).toEqual({ '1': 1 });
      expect(
        JSON.parse((await db.manager.findOneByOrFail(ExportJob, { id: job.id })).requestJson)
          .payload.query.expectedMeasureVersions,
      ).toEqual({ '1': 1 });
    },
  );

  it('rejects malformed fixed requests before job quota, audit or aggregate execution', async () => {
    const spy = jest.spyOn(explore, 'exportCsv');
    const cases = [
      { unknownOption: true },
      { filters: [{ column: 'amount', range: { min: 'wrong' } }] },
      { dateRange: { column: 'day', start: '2026-02-30', end: '2026-03-01' } },
      { rankingSort: 'INVALID' },
      { dimensionColumns: ['region', 'region'] },
    ];
    for (const invalid of cases) {
      const body = input();
      Object.assign(body.payload.query, invalid);
      await expect(jobs.create(body, 7)).rejects.toMatchObject({ status: 400 });
    }
    const pivot = input('pivot');
    Object.assign(pivot.payload.query, { rowDimensions: ['region'] });
    await expect(jobs.create(pivot, 7)).rejects.toMatchObject({ status: 400 });
    expect(await db.manager.count(ExportJob)).toBe(0);
    expect(await db.manager.count(EnterpriseAuditEvent)).toBe(0);
    expect(spy).not.toHaveBeenCalled();
  });
  it('fences metric/source basis changes before SQL and hides sensitive query errors', async () => {
    const job = await jobs.create(input(), 7),
      spy = jest.spyOn(explore, 'exportCsv');
    await db.manager.update(Metric, 1, { definition: JSON.stringify(definition(2)) });
    const before = await db.manager.findOneBy(ExportJob, { id: job.id });
    const audits = await db.manager.count(EnterpriseAuditEvent);
    await expect(jobs.run(job.id, { expectedVersion: 1 }, 7)).rejects.toMatchObject({
      status: 409,
    });
    expect(await db.manager.findOneBy(ExportJob, { id: job.id })).toEqual(before);
    expect(await db.manager.count(EnterpriseAuditEvent)).toBe(audits);
    expect(spy).not.toHaveBeenCalled();
    await db.manager.update(Metric, 1, { definition: JSON.stringify(definition()) });
    spy.mockRejectedValueOnce(new Error('sensitive SELECT customer_secret'));
    const again = await jobs.run(job.id, { expectedVersion: job.version }, 7);
    expect(again.errorCode).toBe('QUERY_FAILED');
    expect(JSON.stringify(again)).not.toContain('customer_secret');
    const count = spy.mock.calls.length;
    await jobs.run(job.id, { expectedVersion: 1 }, 7);
    expect(spy).toHaveBeenCalledTimes(count);
    expect((await jobs.run(job.id, { expectedVersion: again.version }, 7)).status).toBe('ready');
  });
  it('releases metadata queue during SQL and cancellation discards the delayed result', async () => {
    const job = await jobs.create(input(), 7),
      started = deferred(),
      release = deferred(),
      real = explore.exportCsv.bind(explore);
    jest.spyOn(explore, 'exportCsv').mockImplementationOnce(async (...args) => {
      started.resolve();
      await release.promise;
      return real(...args);
    });
    const running = jobs.run(job.id, { expectedVersion: 1 }, 7);
    await started.promise;
    const state = await jobs.get(job.id, 7);
    expect(state.status).toBe('running');
    await metadataTransaction(db, m => m.update(Database, 1, { name: 'Metadata continued' }));
    expect((await jobs.run(job.id, { expectedVersion: 1 }, 7)).status).toBe('running');
    await jobs.cancel(job.id, { expectedVersion: state.version }, 7);
    release.resolve();
    expect((await running).status).toBe('cancelled');
    expect(await db.manager.count(ExportPart)).toBe(0);
    await expect(jobs.file(job.id, 7)).rejects.toMatchObject({ status: 409 });
  });
  it('recovers an expired persisted lease and fences the older worker result', async () => {
    const job = await jobs.create(input(), 7),
      started = deferred(),
      release = deferred(),
      real = explore.exportCsv.bind(explore);
    const spy = jest.spyOn(explore, 'exportCsv').mockImplementationOnce(async (...args) => {
      started.resolve();
      await release.promise;
      return real(...args);
    });
    const old = jobs.run(job.id, { expectedVersion: 1 }, 7);
    await started.promise;
    await db.manager.update(ExportJob, job.id, { leaseUntil: new Date(Date.now() - 1000) });
    const interrupted = await fresh().get(job.id, 7);
    expect(interrupted.status).toBe('interrupted');
    const ready = await fresh().run(job.id, { expectedVersion: interrupted.version }, 7);
    expect(ready.status).toBe('ready');
    const file = await jobs.file(job.id, 7);
    release.resolve();
    expect((await old).version).toBe(ready.version);
    expect((await jobs.file(job.id, 7)).sha256).toBe(file.sha256);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(
      await db.manager.count(EnterpriseAuditEvent, { where: { action: 'export.ready' } }),
    ).toBe(1);
  });
  it('never commits after its lease expires even before a replacement worker starts', async () => {
    const job = await jobs.create(input(), 7),
      started = deferred(),
      release = deferred(),
      real = explore.exportCsv.bind(explore);
    jest.spyOn(explore, 'exportCsv').mockImplementationOnce(async (...args) => {
      started.resolve();
      await release.promise;
      return real(...args);
    });
    const pending = jobs.run(job.id, { expectedVersion: 1 }, 7);
    await started.promise;
    await db.manager.update(ExportJob, job.id, { leaseUntil: new Date(Date.now() - 1) });
    release.resolve();
    expect((await pending).status).toBe('interrupted');
    expect(await db.manager.count(ExportPart)).toBe(0);
    const current = await jobs.get(job.id, 7);
    expect((await jobs.run(job.id, { expectedVersion: current.version }, 7)).status).toBe('ready');
  });
  it('rolls back file chunks when the lease expires during final persistence', async () => {
    const job = await jobs.create(input(), 7);
    const original = EntityManager.prototype.insert;
    let clock: jest.SpyInstance | undefined;
    const insert = jest
      .spyOn(EntityManager.prototype, 'insert')
      .mockImplementation(async function (entity, data) {
        const result = await original.call(this, entity, data);
        if (entity === ExportPart && !clock) {
          const deadline = (await this.findOneBy(ExportJob, { id: job.id })).leaseUntil.getTime();
          clock = jest.spyOn(Date, 'now').mockReturnValue(deadline + 1);
        }
        return result;
      });
    try {
      expect((await jobs.run(job.id, { expectedVersion: 1 }, 7)).status).toBe('interrupted');
      expect(await db.manager.count(ExportPart)).toBe(0);
      expect(
        await db.manager.count(EnterpriseAuditEvent, { where: { action: 'export.ready' } }),
      ).toBe(0);
      const current = await jobs.get(job.id, 7);
      expect(current.status).toBe('interrupted');
      // Explicit retry acquires a fresh lease at the new time.
      insert.mockRestore();
      expect((await jobs.run(job.id, { expectedVersion: current.version }, 7)).status).toBe(
        'ready',
      );
    } finally {
      clock?.mockRestore();
      insert.mockRestore();
    }
  });
  it('rolls back chunks and ready audit when job TTL expires during persistence with a live lease', async () => {
    const job = await jobs.create(input(), 7);
    await db.manager.update(ExportJob, job.id, { expiresAt: new Date(Date.now() + 60000) });
    const original = EntityManager.prototype.insert;
    let clock: jest.SpyInstance | undefined;
    const insert = jest
      .spyOn(EntityManager.prototype, 'insert')
      .mockImplementation(async function (entity, data) {
        const result = await original.call(this, entity, data);
        if (entity === ExportPart && !clock) {
          const current = await this.findOneBy(ExportJob, { id: job.id });
          expect(current.leaseUntil.getTime()).toBeGreaterThan(current.expiresAt.getTime());
          clock = jest.spyOn(Date, 'now').mockReturnValue(current.expiresAt.getTime() + 1);
        }
        return result;
      });
    try {
      expect((await jobs.run(job.id, { expectedVersion: 1 }, 7)).status).toBe('expired');
      expect(await db.manager.count(ExportPart)).toBe(0);
      expect(
        await db.manager.count(EnterpriseAuditEvent, { where: { action: 'export.ready' } }),
      ).toBe(0);
      expect((await db.manager.findOneBy(ExportJob, { id: job.id })).status).not.toBe('ready');
    } finally {
      clock?.mockRestore();
      insert.mockRestore();
    }
  });
  it('rolls back partial file failure then retries the same job without duplicate completed files', async () => {
    const job = await jobs.create(input(), 7);
    await db.query(
      "CREATE TRIGGER reject_export_part BEFORE INSERT ON export_part BEGIN SELECT RAISE(ABORT,'part failure'); END",
    );
    let failed: any;
    try {
      failed = await jobs.run(job.id, { expectedVersion: 1 }, 7);
    } finally {
      await db.query('DROP TRIGGER reject_export_part');
    }
    expect(failed.status).toBe('failed');
    expect(await db.manager.count(ExportPart)).toBe(0);
    expect(
      await db.manager.count(EnterpriseAuditEvent, { where: { action: 'export.ready' } }),
    ).toBe(0);
    const ready = await jobs.run(job.id, { expectedVersion: failed.version }, 7);
    expect(ready.status).toBe('ready');
    expect(await db.manager.count(ExportJob)).toBe(1);
  });
  it('does not delete a newer completed file when stale failure cleanup loses CAS', async () => {
    const job = await jobs.create(input(), 7);
    jest.spyOn(explore, 'exportCsv').mockRejectedValueOnce(new Error('synthetic query failure'));
    const csv = 'newer,file\n1,2\n';
    const original = EntityManager.prototype.findOneBy;
    let interleaved = false;
    jest
      .spyOn(EntityManager.prototype, 'findOneBy')
      .mockImplementation(async function (entity, where: any) {
        const snapshot = await original.call(this, entity, where);
        if (
          entity === ExportJob &&
          where.status === 'running' &&
          where.attemptToken &&
          snapshot &&
          !interleaved
        ) {
          interleaved = true;
          await this.update(ExportJob, job.id, {
            status: 'ready',
            version: snapshot.version + 2,
            attemptToken: null,
            leaseUntil: null,
            filename: 'newer.csv',
            hash: createHash('sha256').update(csv).digest('hex'),
            rowCount: 1,
            bytes: Buffer.byteLength(csv),
            partCount: 1,
          });
          await this.insert(ExportPart, { jobId: job.id, part: 0, data: csv });
        }
        return snapshot;
      });
    expect((await jobs.run(job.id, { expectedVersion: 1 }, 7)).status).toBe('ready');
    expect(interleaved).toBe(true);
    expect((await jobs.file(job.id, 7)).csv).toBe(csv);
    expect(
      await db.manager.count(EnterpriseAuditEvent, { where: { action: 'export.failed' } }),
    ).toBe(0);
  });
  it('records only safe diagnostics if background failure persistence is unavailable', async () => {
    const job = await jobs.create(input(), 7);
    jest
      .spyOn(explore, 'exportCsv')
      .mockRejectedValueOnce(new Error('sensitive SQL and credentials'));
    const logged = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    await db.query(
      "CREATE TRIGGER reject_export_failure BEFORE UPDATE ON export_job WHEN NEW.status='failed' BEGIN SELECT RAISE(ABORT,'sensitive storage detail'); END",
    );
    try {
      expect((await jobs.run(job.id, { expectedVersion: 1 }, 7, true)).status).toBe('running');
      await jobs.onModuleDestroy();
    } finally {
      await db.query('DROP TRIGGER reject_export_failure');
    }
    expect(logged).toHaveBeenCalledWith({
      event: 'export_background_failed',
      jobId: job.id,
      attempt: expect.any(String),
      classification: 'STORAGE_FAILURE',
    });
    expect(JSON.stringify(logged.mock.calls)).not.toMatch(/sensitive|credentials|storage detail/);
    expect((await jobs.get(job.id, 7)).status).toBe('running');
    expect(await db.manager.count(ExportPart)).toBe(0);
    await db.manager.update(ExportJob, job.id, { leaseUntil: new Date(Date.now() - 1) });
    expect((await jobs.get(job.id, 7)).status).toBe('interrupted');
  });
  it('rechecks the guarded authentication epoch after entering the metadata queue', async () => {
    const job = await jobs.create(input(), 7, 0);
    await db.manager.update(User, 7, { authVersion: 1 });
    await expect(jobs.create(input(), 7, 0)).rejects.toMatchObject({ status: 401 });
    await expect(jobs.get(job.id, 7, 0)).rejects.toMatchObject({ status: 401 });
    await expect(jobs.list(7, undefined, 0)).rejects.toMatchObject({ status: 401 });
    await expect(jobs.run(job.id, { expectedVersion: 1 }, 7, false, 0)).rejects.toMatchObject({
      status: 401,
    });
    await expect(jobs.cancel(job.id, { expectedVersion: 1 }, 7, 0)).rejects.toMatchObject({
      status: 401,
    });
    await expect(jobs.file(job.id, 7, 0)).rejects.toMatchObject({ status: 401 });
    expect(await db.manager.count(ExportJob)).toBe(1);
    expect((await jobs.get(job.id, 7, 1)).status).toBe('queued');
  });
  it('checks integrity, expiry and current rights/owner on every completed file read', async () => {
    const job = await jobs.create(input(), 7);
    await jobs.run(job.id, { expectedVersion: 1 }, 7);
    const file = await jobs.file(job.id, 7);
    await db.manager.update(ExportPart, { jobId: job.id, part: 0 }, { data: 'corrupt' });
    await expect(jobs.file(job.id, 7)).rejects.toMatchObject({ status: 409 });
    await db.manager.update(ExportPart, { jobId: job.id, part: 0 }, { data: file.csv });
    await db.manager.update(Database, 1, { catalogActive: false });
    await expect(jobs.file(job.id, 7)).rejects.toMatchObject({ status: 403 });
    expect((await jobs.list(7)).entries).toEqual([]);
    await db.manager.update(Database, 1, { catalogActive: true, ownerId: 8 });
    await expect(jobs.file(job.id, 7)).rejects.toMatchObject({ status: 403 });
    await db.manager.update(Database, 1, { ownerId: 7 });
    await db.manager.update(ExportJob, job.id, { expiresAt: new Date(Date.now() - 1) });
    expect((await jobs.get(job.id, 7)).status).toBe('expired');
    await expect(jobs.file(job.id, 7)).rejects.toMatchObject({ status: 410 });
    await expect(jobs.run(job.id, { expectedVersion: 3 }, 7)).rejects.toMatchObject({
      status: 410,
    });
  });
  it('does not complete if authentication epoch changes during aggregation', async () => {
    const job = await jobs.create(input(), 7),
      real = explore.exportCsv.bind(explore);
    jest.spyOn(explore, 'exportCsv').mockImplementationOnce(async (...args) => {
      const output = await real(...args);
      await metadataTransaction(db, m => m.update(User, 7, { authVersion: 1 }));
      return output;
    });
    expect(await jobs.run(job.id, { expectedVersion: 1 }, 7)).toMatchObject({
      status: 'failed',
      errorCode: 'ACCESS_REVOKED',
    });
    expect(await db.manager.count(ExportPart)).toBe(0);
  });
  it('projects only committed export results and keeps files independent of inbox failures or removal', async () => {
    await policy.set('source', 1, 7, {
      recipientId: 8,
      expectedVersion: 0,
      rights: { read: true, edit: false, publish: false, export: true },
    });
    const inbox = new EnterpriseNotificationService(db);
    const ready = await jobs.create(input(), 8);
    await jobs.run(ready.id, { expectedVersion: 1 }, 8);
    const original = await jobs.file(ready.id, 8);
    const failed = await jobs.create(input(), 8);
    jest.spyOn(explore, 'exportCsv').mockRejectedValueOnce(new Error('private SQL detail'));
    await jobs.run(failed.id, { expectedVersion: 1 }, 8);
    const cancelled = await jobs.create(input(), 8);
    await jobs.cancel(cancelled.id, { expectedVersion: 1 }, 8);
    const results = (await inbox.list(8)).entries.filter(row => row.resourceKind === 'export');
    expect(results.map(row => [row.resourceId, row.eventType])).toEqual([
      [cancelled.id, 'cancelled'],
      [failed.id, 'failed'],
      [ready.id, 'ready'],
    ]);
    expect((await inbox.list(7)).entries.filter(row => row.resourceKind === 'export')).toEqual([]);
    await jobs.run(ready.id, { expectedVersion: 1 }, 8);
    await jobs.cancel(cancelled.id, { expectedVersion: 2 }, 8);
    expect((await inbox.list(8)).entries.filter(row => row.resourceKind === 'export')).toHaveLength(
      3,
    );
    const notification = results.find(row => row.resourceId === ready.id);
    await inbox.mark(8, notification.id, 'read');
    await inbox.mark(8, notification.id, 'remove');
    expect((await jobs.file(ready.id, 8)).csv).toBe(original.csv);
    await db.query('ALTER TABLE enterprise_notification_state RENAME TO unavailable_inbox_state');
    try {
      await expect(inbox.list(8)).rejects.toThrow();
      expect((await jobs.file(ready.id, 8)).csv).toBe(original.csv);
    } finally {
      await db.query('ALTER TABLE unavailable_inbox_state RENAME TO enterprise_notification_state');
    }
    await policy.set('source', 1, 7, {
      recipientId: 8,
      expectedVersion: 1,
      rights: { read: true, edit: false, publish: false, export: false },
    });
    await expect(jobs.file(ready.id, 8)).rejects.toMatchObject({ status: 403 });
    expect(
      (await inbox.list(8)).entries.some(
        row => row.resourceId === failed.id && row.resourceKind === 'export',
      ),
    ).toBe(true);
    expect(await db.manager.count(ExportPart, { where: { jobId: ready.id } })).toBeGreaterThan(0);
  });
  it('chunks Unicode without splitting surrogate pairs and enforces additive schema keys', async () => {
    const text = 'x'.repeat(11999) + '😀한'.repeat(25000),
      parts = exportParts(text);
    expect(parts.join('')).toBe(text);
    expect(parts.every(part => Buffer.byteLength(part) <= 36000)).toBe(true);
    const runner = db.createQueryRunner(),
      migration = new AddExportJobs1792510000000();
    await runner.dropTable('export_part');
    await runner.dropTable('export_job');
    await migration.up(runner);
    await migration.up(runner);
    const job = await jobs.create(input(), 7);
    await expect(
      db.manager.insert(ExportJob, {
        ...(await db.manager.findOneBy(ExportJob, { id: job.id })),
        id: undefined,
      }),
    ).rejects.toThrow();
    await expect(migration.down()).rejects.toThrow('backup');
    await runner.release();
  });
  it('guards actual JWT routes and confirms a saved request/status/file without re-execution', async () => {
    const secret = process.env.ACCESS_SECRET;
    process.env.ACCESS_SECRET = 'synthetic-export-job-http';
    const jwt = new JwtService(),
      module = await Test.createTestingModule({
        controllers: [ExportJobsController],
        providers: [
          { provide: ExportJobsService, useValue: jobs },
          { provide: JwtService, useValue: jwt },
          { provide: DataSource, useValue: db },
        ],
      }).compile(),
      app = module.createNestApplication();
    await app.init();
    await app.listen(0, '127.0.0.1');
    const auth =
      'Bearer ' +
      jwt.sign(
        { accessKeyData: { id: 7, userId: 'export-7', authVersion: 0 } },
        { secret: process.env.ACCESS_SECRET },
      );
    try {
      const server = app.getHttpServer(),
        body = input();
      await request(server).post('/bi/export-jobs').send(body).expect(401);
      const created = await request(server)
        .post('/bi/export-jobs')
        .set('Authorization', auth)
        .send(body)
        .expect(201);
      const id = created.body.id;
      const running = await request(server)
        .post(`/bi/export-jobs/${id}/run`)
        .set('Authorization', auth)
        .send({ expectedVersion: 1 })
        .expect(201);
      expect(running.body.status).toBe('running');
      await jobs.onModuleDestroy(); // drain tracked execution before the explicit status/file read
      expect((await jobs.get(id, 7)).status).toBe('ready');
      const file = await request(server)
        .get(`/bi/export-jobs/${id}/file`)
        .set('Authorization', auth)
        .expect(200);
      expect(file.headers['cache-control']).toBe('no-store');
      expect(file.body.csv).toContain('"100",number,"50"');
      const replay = await request(server)
        .post('/bi/export-jobs')
        .set('Authorization', auth)
        .send(body)
        .expect(201);
      expect(replay.body.id).toBe(id);
      expect(replay.body.status).toBe('ready');
      await request(server)
        .get('/bi/export-jobs?beforeId=1&beforeId=2')
        .set('Authorization', auth)
        .expect(400);
      await request(server).get('/bi/export-jobs/1.5').set('Authorization', auth).expect(400);
    } finally {
      await app.close();
      if (secret === undefined) delete process.env.ACCESS_SECRET;
      else process.env.ACCESS_SECRET = secret;
    }
  });
});
