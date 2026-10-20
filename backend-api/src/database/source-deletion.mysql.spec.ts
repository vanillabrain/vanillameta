jest.mock('../ai/ai.service', () => ({ AiService: class {} }));
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { DataSource, EntityManager } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { UserMapping } from '../user/entities/user-mapping.entity';
import {
  EnterpriseGroup,
  EnterpriseGroupMember,
} from '../enterprise/entities/enterprise-group.entity';
import { SourceAccessService } from '../ownership/source-access.service';
import { EnterpriseResourcePolicyService } from '../enterprise/resource-policy.service';
import { PublicationService } from '../bi/publication.service';
import { dashboardRevision } from '../dashboard/dashboard-revision';
import { EnterpriseMembership } from '../enterprise/entities/enterprise-membership.entity';
import { EnterpriseAuditEvent } from '../enterprise/entities/enterprise-audit-event.entity';
import { EnterpriseResourceGrant } from '../enterprise/entities/enterprise-resource-grant.entity';
import { EnterpriseGroupGrant } from '../enterprise/entities/enterprise-group.entity';
import { Metric } from '../metric/entities/metric.entity';
import { lockMetricSources } from '../metric/metric-write-lock';
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

// No application database env is used. Destructive fixtures require private owned config.
const suite = process.env.VM_UC055_SOURCE_MYSQL_CONFIG ? describe : describe.skip;
suite('UC055 owned MySQL 8.4 permanent source metadata deletion', () => {
  jest.setTimeout(15000);
  const entities = [
    User,
    UserMapping,
    EnterpriseGroup,
    EnterpriseGroupMember,
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
  let db: DataSource, peer: DataSource, config: any, service: SourceDeletionService;
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
      type: 'mysql',
      host: config.host,
      port: config.port,
      username: config.username,
      password: config.password,
      database: config.database,
      timezone: 'Z',
      entities,
      logging: false,
      extra: { connectionLimit: 5, connectTimeout: 5000 },
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
  const waitForSourceLock = async () => {
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      const waits = await peer.query(
        `SELECT l.OBJECT_NAME AS name
        FROM performance_schema.data_lock_waits w
        JOIN performance_schema.data_locks l ON l.ENGINE_LOCK_ID = w.REQUESTING_ENGINE_LOCK_ID
        WHERE l.OBJECT_SCHEMA = ? AND l.OBJECT_NAME = 'database'`,
        [config.database],
      );
      if (waits.length) return;
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    throw new Error('No actual InnoDB Source row lock wait observed.');
  };
  const assertSafe = (value: any) => {
    expect(JSON.stringify(value)).not.toMatch(
      /private-synthetic|filename|filePlan|SELECT|password|connectionConfig/,
    );
  };
  beforeAll(async () => {
    const file = process.env.VM_UC055_SOURCE_MYSQL_CONFIG;
    config = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (
      (fs.statSync(file).mode & 0o077) !== 0 ||
      config.gate !== 'owned-uc055-source-delete-v1' ||
      process.env.VM_UC055_SOURCE_MYSQL_OWNER !== config.owner ||
      !/^[a-f0-9]{24}$/.test(config.owner) ||
      config.host !== '127.0.0.1' ||
      !Number.isInteger(config.port) ||
      config.port < 1024 ||
      config.port > 65535 ||
      config.database !== 'vm_uc055_source_' + config.owner ||
      !config.serverUuid ||
      !config.password ||
      config.username !== 'root' ||
      !process.env.CONFIG_SECRET_KEY ||
      process.env.FILE_UPLOAD_DIR !== config.privateFileRoot
    )
      throw new Error('Refusing non-owned MySQL fixture.');
    db = await open();
    peer = await open();
    for (const ds of [db, peer]) {
      const [id] = await ds.query(
        'SELECT VERSION() AS version, @@server_uuid AS uuid, DATABASE() AS db',
      );
      if (!/^8\.4\./.test(id.version) || id.uuid !== config.serverUuid || id.db !== config.database)
        throw new Error('Unexpected fixture MySQL identity.');
      const [marker] = await ds.query('SELECT token FROM uc055_fixture_owner');
      if (marker?.token !== config.owner) throw new Error('Unexpected fixture ownership marker.');
    }
    service = fresh();
  });
  beforeEach(async () => {
    jest.restoreAllMocks();
    for (const mock of Object.values(duck)) mock.mockReset().mockResolvedValue(undefined);
    connection.removeKnex.mockReset().mockResolvedValue(undefined);
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
        driverError: { code: 'ER_DUP_ENTRY' },
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
    'rolls back Source/receipt/audit on real MySQL %s failure before commit',
    async table => {
      const request = await body();
      await db.query(`CREATE TRIGGER uc055_failure BEFORE ${
        table === 'database' ? 'DELETE' : 'INSERT'
      }
        ON \`${table}\` FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'synthetic failure'`);
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

  it.each(['Dataset', 'TableQuery'] as const)(
    'writer-first %s Source lock makes deletion wait then409',
    async kind => {
      const request = await body(),
        writer = peer.createQueryRunner();
      await writer.connect();
      await writer.startTransaction('READ COMMITTED');
      let deleting: Promise<any> | undefined;
      try {
        await lockMetricSources(writer.manager, [1]);
        await reference(writer.manager, kind);
        deleting = service.remove(1, 1, request).then(
          value => ({ value }),
          error => ({ error }),
        );
        await waitForSourceLock();
        await writer.commitTransaction();
        expect((await deleting).error).toMatchObject({ status: 409 });
        expect(await state()).toEqual({
          sources: 1,
          receipts: 0,
          audits: 0,
          datasets: kind === 'Dataset' ? 1 : 0,
          tables: kind === 'TableQuery' ? 1 : 0,
        });
      } finally {
        if (writer.isTransactionActive) await writer.rollbackTransaction();
        if (deleting) await deleting;
        await writer.release();
      }
    },
  );

  it.each(['Dataset', 'TableQuery'] as const)(
    'delete-first blocks waiting %s before any reference write',
    async kind => {
      const request = await body(),
        entered = gate(),
        resume = gate();
      const original = db.createQueryRunner.bind(db);
      jest.spyOn(db, 'createQueryRunner').mockImplementation(mode => {
        const runner = original(mode),
          remove = runner.manager.delete.bind(runner.manager);
        runner.manager.delete = (async (entity: any, criteria: any) => {
          const result = await remove(entity, criteria);
          if (entity === Database) {
            entered.resolve();
            await resume.promise;
          }
          return result;
        }) as typeof runner.manager.delete;
        return runner;
      });
      const deleting = service.remove(1, 1, request).then(
        value => ({ value }),
        error => ({ error }),
      );
      const writer = peer.createQueryRunner();
      await writer.connect();
      await writer.startTransaction('READ COMMITTED');
      let writing: Promise<any> | undefined;
      try {
        await Promise.race([
          entered.promise,
          deleting.then(() => {
            throw new Error('Deletion ended before barrier.');
          }),
        ]);
        writing = (async () => {
          await lockMetricSources(writer.manager, [1]);
          await reference(writer.manager, kind);
        })().then(
          () => ({ accepted: true }),
          error => ({ error }),
        );
        await waitForSourceLock();
        resume.resolve();
        const deletion = await deleting;
        if (!('value' in deletion)) throw deletion.error;
        expect(deletion.value.data.deleted).toBe(true);
        expect((await writing).error).toMatchObject({ status: 403 });
        await writer.rollbackTransaction();
        expect(await state()).toEqual({
          sources: 0,
          receipts: 1,
          audits: 1,
          datasets: 0,
          tables: 0,
        });
      } finally {
        resume.resolve();
        await deleting;
        if (writing) await writing;
        if (writer.isTransactionActive) await writer.rollbackTransaction();
        await writer.release();
      }
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

  it('actual PublicationService rechecks revoked source read after observed Source lock wait and publishes nothing', async () => {
    await db.manager.insert(EnterpriseMembership, {
      userId: 2,
      organizationId: 1,
      role: 'member',
      team: '',
    });
    const widget = {
      blockId: 'synthetic-total',
      title: 'Synthetic total',
      description: '',
      type: 'BOARD_NUMERIC',
      sql: 'SELECT SUM(amount) AS total FROM synthetic',
      valueField: 'total',
      decimalPlaces: 0,
      numberNotation: 'full',
    };
    const layouts = Object.fromEntries(
      ['mobile', 'tablet', 'desktop'].map((width, i) => [
        width,
        { 'synthetic-total': { x: 0, y: 0, w: [4, 8, 12][i], h: 3 } },
      ]),
    );
    const analysis = {
      databaseId: 1,
      title: 'Synthetic aggregate',
      explanation: '',
      layoutSizes: [{ width: 12, height: 3 }],
      widgets: [widget],
      responsiveLayouts: layouts,
    };
    await db.manager.insert(Dashboard, {
      id: 1,
      title: analysis.title,
      delYn: 'N',
      analysisDefinition: JSON.stringify(analysis),
      layout: JSON.stringify([{ i: '1', x: 0, y: 0, w: 12, h: 3 }]),
    });
    await db.manager.insert(UserMapping, { dashboardId: 1, userInfoId: 1 });
    await db.manager.insert(EnterpriseResourceGrant, [
      {
        resourceKind: 'dashboard',
        resourceId: 1,
        recipientId: 2,
        organizationId: 1,
        ownerId: 1,
        version: 1,
        read: true,
        publish: true,
      },
      {
        resourceKind: 'source',
        resourceId: 1,
        recipientId: 2,
        organizationId: 1,
        ownerId: 1,
        version: 1,
        read: true,
      },
    ]);
    const policy = new EnterpriseResourcePolicyService(db);
    const access = new SourceAccessService(db, policy);
    // Only aggregate preparation is stubbed: preview tickets, grants, policy, locks and publish are real.
    const ai = {
      analysis: jest.fn(async () => ({ data: analysis })),
      preview: jest.fn(async () => ({
        data: {
          widgets: [
            {
              ...widget,
              datas: [{ total: 42 }],
              contribution: { supported: true, components: [] },
            },
          ],
        },
      })),
    };
    const publication = new PublicationService(
      db.getRepository(DashboardPublication),
      db.getRepository(Dashboard),
      access,
      ai as any,
      {} as any,
    );
    const before = await peer.manager.findOneByOrFail(Dashboard, { id: 1 });
    const revision = dashboardRevision(before);
    const preview = await publication.preview(1, 2, { expectedRevision: revision });
    const blocker = peer.createQueryRunner();
    await blocker.connect();
    await blocker.startTransaction('READ COMMITTED');
    let publishing: Promise<any> | undefined;
    try {
      await lockMetricSources(blocker.manager, [1]);
      publishing = publication
        .publish(1, 2, {
          expectedRevision: revision,
          expectedVersion: 0,
          ticket: preview.ticket,
          requestId: randomUUID(),
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
          visibility: 'link',
        })
        .then(
          value => ({ value }),
          error => ({ error }),
        );
      await waitForSourceLock();
      // The first publication authorization has already read the grant in its final transaction.
      await blocker.manager.update(
        EnterpriseResourceGrant,
        {
          resourceKind: 'source',
          resourceId: 1,
          recipientId: 2,
        },
        { read: false, version: 2 },
      );
      await blocker.commitTransaction();
      expect((await publishing).error).toMatchObject({ status: 403 });
      expect(await peer.manager.count(DashboardPublication)).toBe(0);
      expect(await peer.manager.findOneByOrFail(Dashboard, { id: 1 })).toEqual(before);
      expect(
        await peer.manager.findOneByOrFail(EnterpriseResourceGrant, {
          resourceKind: 'source',
          resourceId: 1,
          recipientId: 2,
        }),
      ).toMatchObject({ read: false, version: 2 });
      expect(await peer.manager.count(SourceDeleteReceipt)).toBe(0);
    } finally {
      if (blocker.isTransactionActive) await blocker.rollbackTransaction();
      if (publishing) await publishing;
      await blocker.release();
    }
  });
});
