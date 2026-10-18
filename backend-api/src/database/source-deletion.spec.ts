import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import request = require('supertest');
import { SourceDeletionController } from './source-deletion.controller';
import { DataSource, EntityManager } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { EnterpriseMembership } from '../enterprise/entities/enterprise-membership.entity';
import { EnterpriseAuditEvent } from '../enterprise/entities/enterprise-audit-event.entity';
import { EnterpriseResourceGrant } from '../enterprise/entities/enterprise-resource-grant.entity';
import { EnterpriseGroupGrant } from '../enterprise/entities/enterprise-group.entity';
import { Metric } from '../metric/entities/metric.entity';
import { MetricAggregation } from '../metric/entities/metric.entity';
import { Database } from './entities/database.entity';
import { Dataset } from '../dataset/entities/dataset.entity';
import { TableQuery } from '../widget/tabel-query/entity/table-query.entity';
import { Widget } from '../widget/entities/widget.entity';
import { Dashboard } from '../dashboard/entities/dashboard.entity';
import { DashboardWidget } from '../dashboard/dashboard-widget/entities/dashboard-widget.entity';
import { StudioState } from '../dashboard-studio/entities/studio-state.entity';
import { StudioExecution } from '../dashboard-studio/entities/studio-execution.entity';
import { PersonalView } from '../dashboard/entities/personal-view.entity';
import { ExploreView } from '../bi/entities/explore-view.entity';
import { DashboardPublication } from '../dashboard/entities/dashboard-publication.entity';
import { StudioPublication } from '../dashboard-studio/entities/studio-publication.entity';
import { ExportJob } from '../bi/entities/export-job.entity';
import { CommerceSource } from '../commerce/entities/commerce-source.entity';
import { SourceCatalogEntry } from '../bi/entities/source-catalog-entry.entity';
import { SourceConditionEntry } from '../bi/entities/source-condition-entry.entity';
import { SourceDeleteReceipt } from './entities/source-delete-receipt.entity';
import { SourceDeletionService, SOURCE_DELETE_DEPENDENCY_KINDS } from './source-deletion.service';
import { AddSourceDeleteReceipts1792550000000 } from '../migrations/1792550000000-add-source-delete-receipts';
import { encryptConnectionConfig, decryptConnectionConfig } from '../utils/crypto.util';

describe('UC055 actual SQLite core and JWT source deletion', () => {
  jest.setTimeout(15000);
  const entities = [
    User,
    EnterpriseMembership,
    EnterpriseAuditEvent,
    EnterpriseResourceGrant,
    EnterpriseGroupGrant,
    Metric,
    Database,
    Dataset,
    TableQuery,
    Widget,
    Dashboard,
    DashboardWidget,
    StudioState,
    StudioExecution,
    PersonalView,
    ExploreView,
    DashboardPublication,
    StudioPublication,
    ExportJob,
    CommerceSource,
    SourceCatalogEntry,
    SourceConditionEntry,
    SourceDeleteReceipt,
  ];
  let db: DataSource, peer: DataSource, config: any, service: SourceDeletionService, root: string;
  const previous = {
    files: process.env.FILE_UPLOAD_DIR,
    secret: process.env.CONFIG_SECRET_KEY,
    access: process.env.ACCESS_SECRET,
  };
  const duck = {
    removeOwnedImport: jest.fn(),
    removeOwnedSqlite: jest.fn(),
    validateDeletionImport: jest.fn(),
    validateDeletionSqlite: jest.fn(),
  };
  const connection = { removeKnex: jest.fn() };
  const fresh = () => new SourceDeletionService(db, duck as any, connection as any);
  const open = () =>
    new DataSource({
      type: 'sqlite',
      database: path.join(root, 'metadata.db'),
      entities,
      logging: false,
    }).initialize();
  const source = () => ({
    id: 1,
    ownerId: 1,
    catalogActive: true,
    name: 'Synthetic source',
    engine: 'postgres',
    type: 'database',
    connectionConfig: JSON.stringify({
      client: 'pg',
      connection: { host: 'synthetic.invalid', password: 'private-synthetic-config' },
    }),
  });
  const body = async () => {
    const impact = (await service.impact(1, 1)).data;
    return {
      requestId: randomUUID(),
      expectedRevision: impact.revision,
      expectedActorId: impact.actorId,
      expectedOrganizationId: impact.organizationId,
    };
  };
  const state = async () => ({
    sources: await peer.manager.count(Database),
    receipts: await peer.manager.count(SourceDeleteReceipt),
    audits: await peer.manager.count(EnterpriseAuditEvent, {
      where: { action: 'source-deletion.completed' },
    }),
    datasets: await peer.manager.count(Dataset),
    tables: await peer.manager.count(TableQuery),
  });
  const gate = () => {
    let resolve!: () => void;
    const promise = new Promise<void>(done => {
      resolve = done;
    });
    return { promise, resolve: () => resolve() };
  };
  const reference = (m: EntityManager, kind: 'Dataset' | 'TableQuery') =>
    kind === 'Dataset'
      ? m.insert(Dataset, { databaseId: 1, title: 'Synthetic reference', query: 'SELECT 1' })
      : m.insert(TableQuery, { databaseId: 1, query: 'SELECT 1' });
  const assertSafe = (value: any) => {
    expect(JSON.stringify(value)).not.toMatch(
      /private-synthetic|filename|filePlan|SELECT|password|connectionConfig/,
    );
  };
  beforeAll(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'vm-source-delete-core-'));
    config = { privateFileRoot: path.join(root, 'uploads') };
    process.env.FILE_UPLOAD_DIR = config.privateFileRoot;
    process.env.CONFIG_SECRET_KEY = randomUUID();
    process.env.ACCESS_SECRET = randomUUID();
    db = await open();
    peer = await open();
    service = fresh();
  });
  beforeEach(async () => {
    jest.restoreAllMocks();
    for (const mock of Object.values(duck)) mock.mockReset().mockResolvedValue(undefined);
    connection.removeKnex.mockReset().mockResolvedValue(undefined);
    fs.rmSync(config.privateFileRoot, { recursive: true, force: true });
    fs.mkdirSync(config.privateFileRoot, { recursive: true });
    await db.synchronize(true);
    await db.manager.insert(
      User,
      [1, 2].map(id => ({
        id,
        userId: 'synthetic-' + id,
        email: `synthetic-${id}@example.invalid`,
        password: 'unused',
        active: true,
        authVersion: 0,
      })),
    );
    await db.manager.insert(EnterpriseMembership, {
      userId: 1,
      organizationId: 1,
      role: 'admin',
      team: '',
    });
    await db.manager.insert(Database, source());
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    if (peer?.isInitialized) await peer.destroy();
    if (db?.isInitialized) await db.destroy();
    fs.rmSync(root, { recursive: true, force: true });
    for (const [key, value] of [
      ['FILE_UPLOAD_DIR', previous.files],
      ['CONFIG_SECRET_KEY', previous.secret],
      ['ACCESS_SECRET', previous.access],
    ]) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('projects exactly ten safe dependency counts and completes zero-file remote deletion', async () => {
    const impact = (await service.impact(1, 1)).data;
    expect(impact.dependencies).toEqual(
      SOURCE_DELETE_DEPENDENCY_KINDS.map(kind => ({ kind, count: 0 })),
    );
    expect(impact.dependencies).toHaveLength(10);
    expect(impact).toMatchObject({ canDelete: true, managedFileCount: 0 });
    const result = await service.remove(1, 1, await body());
    expect(result.data).toMatchObject({
      sourceId: 1,
      deleted: true,
      cleanup: { status: 'complete', managedFiles: 0 },
    });
    expect(Object.keys(result.data).sort()).toEqual(
      ['sourceId', 'requestId', 'receiptId', 'deleted', 'replayed', 'cleanup'].sort(),
    );
    assertSafe(impact);
    assertSafe(result);
    expect(await state()).toEqual({ sources: 0, receipts: 1, audits: 1, datasets: 0, tables: 0 });
    expect(connection.removeKnex).toHaveBeenCalledWith(1);
    expect(duck.removeOwnedImport).not.toHaveBeenCalled();
  });

  it('migrates twice, enforces unique request and replays after reconnect without deleting a restored ID', async () => {
    const runner = db.createQueryRunner();
    try {
      await runner.dropTable('source_delete_receipt');
      const migration = new AddSourceDeleteReceipts1792550000000();
      await migration.up(runner);
      await migration.up(runner);
      const request = await body(),
        first = await service.remove(1, 1, request);
      const duplicate = {
        ...(await db.manager.findOneByOrFail(SourceDeleteReceipt, { id: first.data.receiptId })),
      };
      delete duplicate.id;
      await expect(db.manager.insert(SourceDeleteReceipt, duplicate)).rejects.toMatchObject({
        driverError: { code: 'SQLITE_CONSTRAINT' },
      });
      await runner.release();
      await db.destroy();
      db = await open();
      service = fresh();
      await peer.manager.insert(Database, source());
      expect((await service.remove(1, 1, request)).data).toMatchObject({
        receiptId: first.data.receiptId,
        replayed: true,
      });
      expect(await state()).toEqual({ sources: 1, receipts: 1, audits: 1, datasets: 0, tables: 0 });
      await expect(
        service.remove(1, 1, { ...request, expectedRevision: 'b'.repeat(64) }),
      ).rejects.toMatchObject({ status: 409 });
    } finally {
      if (!runner.isReleased) await runner.release();
    }
  });

  it.each(['database', 'source_delete_receipt', 'enterprise_audit_event'])(
    'rolls back Source/receipt/audit on actual SQLite %s failure before commit',
    async table => {
      const request = await body();
      await db.query(`CREATE TRIGGER uc055_failure BEFORE ${
        table === 'database' ? 'DELETE' : 'INSERT'
      }
        ON "${table}" BEGIN SELECT RAISE(ABORT, 'synthetic failure'); END`);
      try {
        await expect(service.remove(1, 1, request)).rejects.toMatchObject({ status: 500 });
        expect(await state()).toEqual({
          sources: 1,
          receipts: 0,
          audits: 0,
          datasets: 0,
          tables: 0,
        });
        expect(connection.removeKnex).not.toHaveBeenCalled();
      } finally {
        await db.query('DROP TRIGGER uc055_failure');
      }
      await service.remove(1, 1, request);
      expect(await state()).toEqual({ sources: 0, receipts: 1, audits: 1, datasets: 0, tables: 0 });
    },
  );

  it.each(['owner', 'revision', 'actor', 'organization', 'epoch', 'inactive'])(
    'rejects changed current %s with no deletion writes',
    async boundary => {
      const request = await body();
      if (boundary === 'owner') await peer.manager.update(Database, 1, { ownerId: 2 });
      if (boundary === 'revision') await peer.manager.update(Database, 1, { name: 'Changed' });
      if (boundary === 'actor') request.expectedActorId = 2;
      if (boundary === 'organization')
        await peer.manager.update(EnterpriseMembership, 1, { organizationId: 2 });
      if (boundary === 'epoch') await peer.manager.update(User, 1, { authVersion: 1 });
      if (boundary === 'inactive') await peer.manager.update(User, 1, { active: false });
      await expect(service.remove(1, 1, request)).rejects.toMatchObject({
        status:
          boundary === 'owner' || boundary === 'inactive' ? 403 : boundary === 'epoch' ? 401 : 409,
      });
      expect(await state()).toEqual({ sources: 1, receipts: 0, audits: 0, datasets: 0, tables: 0 });
    },
  );

  it.each(['catalog', 'conditions'])(
    'rejects a newer %s history version after impact',
    async kind => {
      const request = await body();
      if (kind === 'catalog')
        await peer.manager.insert(SourceCatalogEntry, {
          sourceId: 1,
          version: 1,
          actorId: 1,
          schemaRevision: 'fixed',
          sourceRevision: 'fixed',
          metadata: '{}',
        });
      else
        await peer.manager.insert(SourceConditionEntry, {
          sourceId: 1,
          version: 1,
          actorId: 1,
          sourceRevision: 'fixed',
          definition: '{}',
        });
      await expect(service.remove(1, 1, request)).rejects.toMatchObject({ status: 409 });
      expect(await state()).toEqual({ sources: 1, receipts: 0, audits: 0, datasets: 0, tables: 0 });
    },
  );

  it('preserves historical catalog/conditions, inactive Metric and deleted Studio records', async () => {
    await db.manager.insert(SourceCatalogEntry, {
      sourceId: 1,
      version: 1,
      actorId: 1,
      schemaRevision: 'fixed',
      sourceRevision: 'fixed',
      metadata: '{}',
    });
    await db.manager.insert(SourceConditionEntry, {
      sourceId: 1,
      version: 1,
      actorId: 1,
      sourceRevision: 'fixed',
      definition: '{}',
    });
    await db.manager.insert(Metric, {
      id: 1,
      databaseId: 1,
      name: 'Inactive history',
      tableName: 'data',
      aggregation: MetricAggregation.SUM,
      expression: 'amount',
      useYn: 'N',
    });
    await db.manager.insert(Dashboard, {
      id: 1,
      title: 'Historical',
      delYn: 'Y',
      analysisDefinition: JSON.stringify({ databaseId: 1 }),
    });
    await db.manager.insert(StudioState, {
      dashboardId: 1,
      legacyRevision: 'fixed',
      document: JSON.stringify({ document: { schemaVersion: 1, sourceId: 1, blocks: [] } }),
    });
    await db.manager.insert(StudioExecution, {
      runId: randomUUID(),
      actorId: 1,
      dashboardId: 1,
      requestId: randomUUID(),
      payloadHash: 'a'.repeat(64),
      status: 'failed',
      state: JSON.stringify({ request: { document: { sourceId: 1 } } }),
    });
    await db.manager.insert(CommerceSource, {
      ownerId: 1,
      name: 'Synthetic unrelated commerce',
      status: 'empty',
    });
    const history = [
      SourceCatalogEntry,
      SourceConditionEntry,
      Metric,
      Dashboard,
      StudioState,
      StudioExecution,
      CommerceSource,
    ];
    const before = await Promise.all(history.map(entity => db.manager.find(entity as any)));
    expect((await service.impact(1, 1)).data.canDelete).toBe(true);
    await service.remove(1, 1, await body());
    expect(await Promise.all(history.map(entity => peer.manager.find(entity as any)))).toEqual(
      before,
    );
  });

  it.each(['Dataset', 'TableQuery'] as const)(
    'blocks persisted %s without cascading',
    async kind => {
      const request = await body();
      await reference(peer.manager, kind);
      await expect(service.remove(1, 1, request)).rejects.toMatchObject({ status: 409 });
      expect(await state()).toEqual({
        sources: 1,
        receipts: 0,
        audits: 0,
        datasets: kind === 'Dataset' ? 1 : 0,
        tables: kind === 'TableQuery' ? 1 : 0,
      });
    },
  );

  const cleanupFixture = async () => {
    const request = await body(),
      result = await service.remove(1, 1, request);
    const plan = {
      version: 1,
      connectionClosed: true,
      files: [0, 1].map(() => ({
        kind: 'duckdb',
        filename: path.join(config.privateFileRoot, randomUUID(), 'data.duckdb'),
        proof: { syntheticOwnedGuard: true },
        done: false,
      })),
    };
    await peer.manager.update(SourceDeleteReceipt, result.data.receiptId, {
      managedFiles: 2,
      cleanupStatus: 'pending',
      cleanupAttempt: null,
      cleanupLeaseUntil: null,
      filePlan: encryptConnectionConfig(JSON.stringify(plan)),
    });
    return { id: result.data.receiptId, requestId: request.requestId, plan };
  };
  it('persists partial mocked-file progress and retries after reconnect without repeating completed entries', async () => {
    const fixture = await cleanupFixture();
    duck.removeOwnedImport
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('synthetic guard failure'));
    const partial = await service.cleanup(fixture.id, 1, { requestId: fixture.requestId });
    expect(partial.data.cleanup).toEqual({ status: 'retry_required', managedFiles: 2 });
    const receipt = await peer.manager.findOneByOrFail(SourceDeleteReceipt, { id: fixture.id });
    expect(JSON.parse(decryptConnectionConfig(receipt.filePlan)).files.map(f => f.done)).toEqual([
      true,
      false,
    ]);
    assertSafe(partial);
    await db.destroy();
    db = await open();
    service = fresh();
    expect(
      (await service.cleanup(fixture.id, 1, { requestId: fixture.requestId })).data.cleanup.status,
    ).toBe('complete');
    expect(duck.removeOwnedImport.mock.calls.map(args => args[0])).toEqual([
      fixture.plan.files[0].filename,
      fixture.plan.files[1].filename,
      fixture.plan.files[1].filename,
    ]);
    expect(await peer.manager.count(Database)).toBe(0);
  });

  it('allows only one live cleanup lease and reclaims an expired lease', async () => {
    const fixture = await cleanupFixture(),
      entered = gate(),
      resume = gate();
    duck.removeOwnedImport.mockImplementationOnce(async () => {
      entered.resolve();
      await resume.promise;
    });
    const cleaning = service.cleanup(fixture.id, 1, { requestId: fixture.requestId });
    try {
      await entered.promise;
      const competing = new SourceDeletionService(peer, duck as any, connection as any);
      const result = await competing.cleanup(fixture.id, 1, { requestId: fixture.requestId });
      expect(result.data.cleanup.status).toBe('pending');
      expect(duck.removeOwnedImport).toHaveBeenCalledTimes(1);
    } finally {
      resume.resolve();
      await cleaning;
    }
    expect((await service.getReceipt(fixture.id, 1)).data.cleanup.status).toBe('complete');
    await peer.manager.update(SourceDeleteReceipt, fixture.id, {
      cleanupStatus: 'pending',
      cleanupAttempt: randomUUID(),
      cleanupLeaseUntil: new Date('2000-01-01T00:00:00Z'),
      filePlan: encryptConnectionConfig(JSON.stringify(fixture.plan)),
    });
    expect(
      (await service.cleanup(fixture.id, 1, { requestId: fixture.requestId })).data.cleanup.status,
    ).toBe('complete');
  });

  it('keeps nullable legacy organization and permits inactive-source owner cleanup', async () => {
    await db.manager.delete(EnterpriseMembership, { userId: 1 });
    await db.manager.update(Database, 1, { catalogActive: false });
    const request = await body();
    expect(request.expectedOrganizationId).toBeNull();
    await service.remove(1, 1, request);
    expect(await peer.manager.findOneByOrFail(SourceDeleteReceipt, { sourceId: 1 })).toMatchObject({
      organizationId: null,
    });
    expect(await peer.manager.count(EnterpriseAuditEvent)).toBe(0);
  });
  it('rejects bare deletion intent before any writes', async () => {
    await expect(service.remove(1, 1, {})).rejects.toMatchObject({ status: 400 });
    expect(await state()).toEqual({ sources: 1, receipts: 0, audits: 0, datasets: 0, tables: 0 });
  });

  const board = (id = 1) =>
    db.manager.insert(Dashboard, { id, title: 'Private board', delYn: 'N', layout: '[]' });
  const exportJob = (status: any, expired = false) =>
    db.manager.insert(ExportJob, {
      ownerId: 1,
      organizationId: 1,
      sourceId: 1,
      sourceOwnerId: 1,
      requestId: randomUUID(),
      digest: 'a'.repeat(64),
      requestJson: '{}',
      basisJson: '{}',
      status,
      version: 1,
      expiresAt: new Date(expired ? '2000-01-01T00:00:00Z' : '2099-01-01T00:00:00Z'),
    });
  const fileSource = async () => {
    const filename = path.join(config.privateFileRoot, randomUUID(), 'data.duckdb');
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    fs.writeFileSync(filename, 'synthetic sentinel - never remove');
    duck.validateDeletionImport.mockResolvedValue({ syntheticOwnedGuard: true });
    await db.manager.update(Database, 1, {
      engine: 'duckdb',
      type: 'file',
      connectionConfig: JSON.stringify({ connection: { filename } }),
    });
    return filename;
  };
  const assertPreserved = async (filename: string, sources: number) => {
    expect(fs.readFileSync(filename, 'utf8')).toBe('synthetic sentinel - never remove');
    expect(await db.manager.count(Database)).toBe(sources);
    expect(duck.removeOwnedImport).not.toHaveBeenCalled();
  };

  it.each([
    'metrics',
    'exploreViews',
    'directPermissions',
    'groupPermissions',
    'publications',
    'exportJobs',
  ])('projects and blocks current %s without cascading', async kind => {
    const request = await body();
    if (kind === 'metrics')
      await db.manager.insert(Metric, {
        databaseId: 1,
        name: 'Current metric',
        tableName: 'data',
        aggregation: MetricAggregation.SUM,
        expression: 'amount',
        useYn: 'Y',
      });
    if (kind === 'exploreViews')
      await db.manager.insert(PersonalView, {
        sourceId: 1,
        dashboardId: null,
        userId: 2,
        name: 'Private view',
        revision: 'fixed',
        state: '{}',
      });
    if (kind === 'directPermissions')
      await db.manager.insert(EnterpriseResourceGrant, {
        resourceKind: 'source',
        resourceId: 1,
        recipientId: 2,
        organizationId: 1,
        ownerId: 1,
        version: 1,
        read: true,
      });
    if (kind === 'groupPermissions')
      await db.manager.insert(EnterpriseGroupGrant, {
        resourceKind: 'source',
        resourceId: 1,
        groupId: 2,
        organizationId: 1,
        ownerId: 1,
        version: 1,
        export: true,
      });
    if (kind === 'publications')
      await db.manager.insert(StudioPublication, {
        token: 'a'.repeat(64),
        actorId: 1,
        dashboardId: 99,
        sourceId: 1,
        version: 1,
        visibility: 'private',
        allowRemix: false,
        asOf: 'fixed',
        dataVersion: 'fixed',
        snapshot: '{}',
        revokedAt: null,
        expiresAt: '2000-01-01',
      });
    if (kind === 'exportJobs') await exportJob('queued');
    const before = await Promise.all(entities.map(e => db.manager.find(e as any)));
    expect((await service.impact(1, 1)).data.dependencies).toContainEqual({ kind, count: 1 });
    await expect(service.remove(1, 1, request)).rejects.toMatchObject({ status: 409 });
    expect(await Promise.all(entities.map(e => db.manager.find(e as any)))).toEqual(before);
  });

  it('counts both ExploreView and source PersonalView as current stored views', async () => {
    await db.manager.insert(ExploreView, {
      sourceId: 1,
      userId: 1,
      name: 'Synthetic explore',
      sourceRevision: 'fixed',
      state: JSON.stringify({ measureIds: [1] }),
      measureVersions: '{"1":1}',
    });
    await db.manager.insert(PersonalView, {
      sourceId: 1,
      dashboardId: null,
      userId: 1,
      name: 'Synthetic personal',
      revision: 'fixed',
      state: '{}',
    });
    expect((await service.impact(1, 1)).data.dependencies).toContainEqual({
      kind: 'exploreViews',
      count: 2,
    });
    await expect(service.remove(1, 1, await body())).rejects.toMatchObject({ status: 409 });
    expect(await db.manager.count(ExploreView)).toBe(1);
    expect(await db.manager.count(PersonalView)).toBe(1);
  });

  it.each(['analysis', 'structured', 'studio', 'pivot', 'execution'])(
    'counts the current Dashboard once for explicit %s Source reference',
    async kind => {
      await board();
      if (kind === 'analysis')
        await db.manager.update(Dashboard, 1, {
          analysisDefinition: JSON.stringify({ databaseId: 1 }),
        });
      if (kind === 'structured')
        await db.manager.update(Dashboard, 1, {
          structuredDefinition: JSON.stringify({ sourceId: 1 }),
        });
      if (kind === 'studio')
        await db.manager.insert(StudioState, {
          dashboardId: 1,
          legacyRevision: 'fixed',
          document: JSON.stringify({ document: { schemaVersion: 1, sourceId: 1, blocks: [] } }),
        });
      if (kind === 'pivot')
        await db.manager.update(Dashboard, 1, {
          pivotDefinitions: JSON.stringify([{ sourceId: 1 }, { sourceId: 1 }]),
        });
      if (kind === 'execution') {
        // Saved board rebound elsewhere while a durable execution still captures this Source.
        await db.manager.update(Dashboard, 1, {
          analysisDefinition: JSON.stringify({ databaseId: 2 }),
        });
        await db.manager.insert(StudioExecution, {
          runId: randomUUID(),
          actorId: 1,
          dashboardId: 1,
          requestId: randomUUID(),
          payloadHash: 'a'.repeat(64),
          status: 'interrupted',
          state: JSON.stringify({ request: { document: { sourceId: 1 } } }),
        });
      }
      expect((await service.impact(1, 1)).data.dependencies).toContainEqual({
        kind: 'dashboards',
        count: 1,
      });
      await expect(service.remove(1, 1, await body())).rejects.toMatchObject({ status: 409 });
    },
  );

  it.each(['studio', 'pivot', 'execution'])(
    'fails closed for malformed current %s with unprovable Source',
    async kind => {
      const request = await body();
      await board();
      if (kind === 'studio')
        await db.manager.insert(StudioState, {
          dashboardId: 1,
          legacyRevision: 'fixed',
          document: '{}',
        });
      if (kind === 'pivot') await db.manager.update(Dashboard, 1, { pivotDefinitions: '{}' });
      if (kind === 'execution')
        await db.manager.insert(StudioExecution, {
          runId: randomUUID(),
          actorId: 1,
          dashboardId: 1,
          requestId: randomUUID(),
          payloadHash: 'a'.repeat(64),
          status: 'failed',
          state: '{}',
        });
      await expect(service.impact(1, 1)).rejects.toMatchObject({ status: 409 });
      await expect(service.remove(1, 1, request)).rejects.toMatchObject({ status: 409 });
      expect(await db.manager.count(SourceDeleteReceipt)).toBe(0);
    },
  );

  it.each([
    ['queued', false, true],
    ['running', true, true],
    ['ready', false, true],
    ['ready', true, false],
    ['failed', false, false],
    ['cancelled', false, false],
  ])('applies current export access boundary %s expired=%s', async (status, expired, blocking) => {
    await exportJob(status, Boolean(expired));
    const impact = (await service.impact(1, 1)).data;
    expect(impact.dependencies).toContainEqual({ kind: 'exportJobs', count: blocking ? 1 : 0 });
    if (blocking)
      await expect(service.remove(1, 1, await body())).rejects.toMatchObject({ status: 409 });
    else {
      await service.remove(1, 1, await body());
      expect(await db.manager.count(ExportJob)).toBe(1);
    }
  });

  it.each([true, false])(
    'treats legacy publication active=%s independently of expiration',
    async active => {
      await db.manager.insert(DashboardPublication, {
        dashboardId: 99,
        uuid: randomUUID(),
        publisherId: 1,
        sourceId: 1,
        version: 1,
        dashboardRevision: 'fixed',
        snapshot: '{}',
        publishedAt: '2000-01-01',
        expiresAt: '2000-01-02',
        active,
        requestId: randomUUID(),
        payloadDigest: 'a'.repeat(64),
      });
      expect((await service.impact(1, 1)).data.dependencies).toContainEqual({
        kind: 'publications',
        count: active ? 1 : 0,
      });
      if (active)
        await expect(service.remove(1, 1, await body())).rejects.toMatchObject({ status: 409 });
      else {
        await service.remove(1, 1, await body());
        expect(await db.manager.count(DashboardPublication)).toBe(1);
      }
    },
  );

  it('preserves revoked Studio publication and disabled grant history', async () => {
    await db.manager.insert(StudioPublication, {
      token: 'b'.repeat(64),
      actorId: 1,
      dashboardId: 99,
      sourceId: 1,
      version: 1,
      visibility: 'private',
      allowRemix: false,
      asOf: 'fixed',
      dataVersion: 'fixed',
      snapshot: '{}',
      revokedAt: '2026-01-01',
    });
    await db.manager.insert(EnterpriseResourceGrant, {
      resourceKind: 'source',
      resourceId: 1,
      recipientId: 2,
      organizationId: 1,
      ownerId: 1,
      version: 1,
      read: false,
      edit: false,
      publish: false,
      export: false,
    });
    expect((await service.impact(1, 1)).data.canDelete).toBe(true);
    await service.remove(1, 1, await body());
    expect(await db.manager.count(StudioPublication)).toBe(1);
    expect(await db.manager.count(EnterpriseResourceGrant)).toBe(1);
  });

  it('scans beyond the first 200 Dashboard rows', async () => {
    await db.manager.insert(
      Dashboard,
      Array.from({ length: 201 }, (_, i) => ({ id: i + 1, title: 'Synthetic', delYn: 'N' })),
    );
    await db.manager.update(Dashboard, 201, {
      analysisDefinition: JSON.stringify({ databaseId: 1 }),
    });
    expect((await service.impact(1, 1)).data.dependencies).toContainEqual({
      kind: 'dashboards',
      count: 1,
    });
  });

  it('paginates only current actor/org incomplete receipts without exposing plans', async () => {
    const seed = (id: number, changes: any = {}) => ({
      id,
      actorId: 1,
      organizationId: 1,
      sourceId: id + 100,
      requestId: randomUUID(),
      expectedRevision: 'a'.repeat(64),
      digest: 'b'.repeat(64),
      filePlan: encryptConnectionConfig(
        JSON.stringify({ version: 1, connectionClosed: false, files: [] }),
      ),
      managedFiles: 0,
      cleanupStatus: 'pending' as const,
      cleanupVersion: 0,
      ...changes,
    });
    await db.manager.insert(SourceDeleteReceipt, [
      ...Array.from({ length: 23 }, (_, i) => seed(i + 1)),
      seed(24, { actorId: 2 }),
      seed(25, { organizationId: 2 }),
      seed(26, { cleanupStatus: 'complete' }),
    ]);
    const first = (await service.listReceipts(1)).data;
    expect(first.entries.map(r => r.receiptId)).toEqual(
      Array.from({ length: 20 }, (_, i) => 23 - i),
    );
    expect(first.nextBeforeId).toBe(4);
    assertSafe(first);
    expect(
      (await service.listReceipts(1, { beforeId: '4' })).data.entries.map(r => r.receiptId),
    ).toEqual([3, 2, 1]);
    await expect(service.getReceipt(24, 1)).rejects.toMatchObject({ status: 403 });
    await expect(service.getReceipt(25, 1)).rejects.toMatchObject({ status: 403 });
    await db.manager.delete(EnterpriseMembership, { userId: 1 });
    expect((await service.listReceipts(1)).data.entries).toEqual([]);
  });

  it.each(['source', 'commerce'])(
    'blocks nested sharedFiles %s references during impact and DELETE preserving sentinel/rows',
    async kind => {
      const filename = await fileSource(),
        request = await body();
      const nested = path.join(path.dirname(filename), 'nested', 'other.duckdb');
      fs.mkdirSync(path.dirname(nested), { recursive: true });
      fs.writeFileSync(nested, 'nested synthetic sentinel');
      if (kind === 'source')
        await db.manager.insert(Database, {
          ...source(),
          id: 2,
          connectionConfig: JSON.stringify({ connection: { filename: nested } }),
          engine: 'duckdb',
        });
      else
        await db.manager.insert(CommerceSource, {
          ownerId: 1,
          name: 'Synthetic',
          publishedFilename: nested,
        });
      const impact = (await service.impact(1, 1)).data;
      expect(impact.dependencies).toContainEqual({ kind: 'sharedFiles', count: 1 });
      await expect(service.remove(1, 1, request)).rejects.toMatchObject({ status: 409 });
      await assertPreserved(filename, kind === 'source' ? 2 : 1);
      expect(fs.readFileSync(nested, 'utf8')).toBe('nested synthetic sentinel');
      expect(await db.manager.count(SourceDeleteReceipt)).toBe(0);
    },
  );

  it('rejects cleanup when another Source references a nested file after metadata deletion', async () => {
    const filename = await fileSource(),
      request = await body();
    const result = await service.remove(1, 1, request);
    const nested = path.join(path.dirname(filename), 'nested', 'other.duckdb');
    fs.mkdirSync(path.dirname(nested), { recursive: true });
    fs.writeFileSync(nested, 'nested synthetic sentinel');
    await db.manager.insert(Database, {
      ...source(),
      id: 2,
      engine: 'duckdb',
      connectionConfig: JSON.stringify({ connection: { filename: nested } }),
    });
    await expect(
      service.cleanup(result.data.receiptId, 1, { requestId: request.requestId }),
    ).rejects.toMatchObject({ status: 409 });
    await assertPreserved(filename, 1);
    expect((await service.getReceipt(result.data.receiptId, 1)).data.cleanup.status).toBe(
      'pending',
    );
  });

  it('blocks registered missing nested paths through a symlinked upload-root alias', async () => {
    const actualRoot = path.join(root, 'actual-alias-root');
    const aliasRoot = path.join(root, 'linked-alias-root');
    fs.mkdirSync(actualRoot);
    fs.symlinkSync(actualRoot, aliasRoot, 'dir');
    const filename = path.join(actualRoot, randomUUID(), 'data.duckdb');
    fs.mkdirSync(path.dirname(filename));
    fs.writeFileSync(filename, 'synthetic sentinel - never remove');
    const aliasFilename = path.join(
      aliasRoot,
      path.basename(path.dirname(filename)),
      'data.duckdb',
    );
    const oldRoot = process.env.FILE_UPLOAD_DIR;
    process.env.FILE_UPLOAD_DIR = aliasRoot;
    try {
      await db.manager.update(Database, 1, {
        engine: 'duckdb',
        connectionConfig: JSON.stringify({ connection: { filename: aliasFilename } }),
      });
      await db.manager.insert(Database, {
        ...source(),
        id: 2,
        engine: 'duckdb',
        connectionConfig: JSON.stringify({
          connection: {
            filename: path.join(path.dirname(aliasFilename), 'missing', 'future.duckdb'),
          },
        }),
      });
      expect((await service.impact(1, 1)).data.dependencies).toContainEqual({
        kind: 'sharedFiles',
        count: 1,
      });
      await assertPreserved(filename, 2);
    } finally {
      process.env.FILE_UPLOAD_DIR = oldRoot;
    }
  });

  it.each([
    null,
    {},
    [],
    [{ filename: '' }],
    Array.from({ length: 6 }, () => ({ filename: 'synthetic-over-limit.duckdb' })),
  ])(
    'fails closed on another Source malformed fileVersions %j across impact/delete/cleanup',
    async versions => {
      const filename = await fileSource(),
        request = await body();
      const foreign = {
        ...source(),
        id: 2,
        engine: 'duckdb',
        connectionConfig: JSON.stringify({
          connection: { filename: path.join(config.privateFileRoot, randomUUID(), 'data.duckdb') },
          fileVersions: versions,
        }),
      };
      await db.manager.insert(Database, foreign);
      await expect(service.impact(1, 1)).rejects.toMatchObject({ status: 409 });
      await expect(service.remove(1, 1, request)).rejects.toMatchObject({ status: 409 });
      await assertPreserved(filename, 2);
      expect(await db.manager.count(SourceDeleteReceipt)).toBe(0);
      await db.manager.delete(Database, 2);
      const deleted = await service.remove(1, 1, request);
      await db.manager.insert(Database, foreign);
      await expect(
        service.cleanup(deleted.data.receiptId, 1, { requestId: request.requestId }),
      ).rejects.toMatchObject({ status: 409 });
      await assertPreserved(filename, 1);
    },
  );

  it('protects actual JWT impact/delete/receipt/list/cleanup routes and no-store responses', async () => {
    const jwt = new JwtService();
    const module = await Test.createTestingModule({
      controllers: [SourceDeletionController],
      providers: [
        { provide: SourceDeletionService, useValue: service },
        { provide: DataSource, useValue: db },
        { provide: JwtService, useValue: jwt },
      ],
    }).compile();
    const app = module.createNestApplication();
    await app.init();
    await app.listen(0, '127.0.0.1');
    const token = (id: number, authVersion = 0) =>
      'Bearer ' +
      jwt.sign(
        {
          accessKeyData: {
            id,
            userId: 'synthetic-' + id,
            authVersion,
          },
        },
        { secret: process.env.ACCESS_SECRET },
      );
    try {
      const server = app.getHttpServer();
      await request(server).get('/database/1/delete-impact').expect(401);
      await request(server)
        .get('/database/1/delete-impact')
        .set('Authorization', token(2))
        .expect(403);
      const impact = await request(server)
        .get('/database/1/delete-impact')
        .set('Authorization', token(1))
        .expect('Cache-Control', 'no-store')
        .expect(200);
      await request(server).delete('/database/1').set('Authorization', token(1)).expect(400);
      const reviewed = {
        requestId: randomUUID(),
        expectedRevision: impact.body.data.revision,
        expectedActorId: 1,
        expectedOrganizationId: 1,
      };
      const deleted = await request(server)
        .delete('/database/1')
        .set('Authorization', token(1))
        .send(reviewed)
        .expect('Cache-Control', 'no-store')
        .expect(200);
      const receiptId = deleted.body.data.receiptId;
      const replay = await request(server)
        .delete('/database/1')
        .set('Authorization', token(1))
        .send(reviewed)
        .expect(200);
      expect(replay.body.data).toMatchObject({ receiptId, replayed: true });
      await request(server)
        .get('/database/deletions/' + receiptId)
        .set('Authorization', token(2))
        .expect(403);
      const receipt = await request(server)
        .get('/database/deletions/' + receiptId)
        .set('Authorization', token(1))
        .expect('Cache-Control', 'no-store')
        .expect(200);
      assertSafe(receipt.body);
      await request(server)
        .get('/database/deletions')
        .set('Authorization', token(1))
        .expect('Cache-Control', 'no-store')
        .expect(200);
      await request(server)
        .post(`/database/deletions/${receiptId}/cleanup`)
        .set('Authorization', token(1))
        .send({ requestId: reviewed.requestId })
        .expect('Cache-Control', 'no-store')
        .expect(201);
      await db.manager.update(User, 1, { authVersion: 1 });
      await request(server)
        .get('/database/deletions/' + receiptId)
        .set('Authorization', token(1))
        .expect(401);
      await request(server)
        .delete('/database/1')
        .set('Authorization', token(1))
        .send(reviewed)
        .expect(401);
    } finally {
      await app.close();
    }
  });
});
