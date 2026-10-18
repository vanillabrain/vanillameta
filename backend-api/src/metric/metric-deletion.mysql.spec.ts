import { randomUUID } from 'crypto';
import * as fs from 'fs';
import { DataSource, EntityManager } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { EnterpriseMembership } from '../enterprise/entities/enterprise-membership.entity';
import { EnterpriseAuditEvent } from '../enterprise/entities/enterprise-audit-event.entity';
import { Database } from '../database/entities/database.entity';
import { Dataset } from '../dataset/entities/dataset.entity';
import { TableQuery } from '../widget/tabel-query/entity/table-query.entity';
import { Widget } from '../widget/entities/widget.entity';
import { Dashboard } from '../dashboard/entities/dashboard.entity';
import { DashboardWidget } from '../dashboard/dashboard-widget/entities/dashboard-widget.entity';
import { StudioState } from '../dashboard-studio/entities/studio-state.entity';
import { ExploreView } from '../bi/entities/explore-view.entity';
import { ExportJob, ExportJobStatus } from '../bi/entities/export-job.entity';
import { PersonalView } from '../dashboard/entities/personal-view.entity';
import { Metric, MetricAggregation } from './entities/metric.entity';
import { MetricDeleteReceipt } from './entities/metric-delete-receipt.entity';
import { MetricDeletionService } from './metric-deletion.service';
import { AddMetricDeleteReceipts1792540000000 } from '../migrations/1792540000000-add-metric-delete-receipts';

import { lockMetricReferences } from './metric-write-lock';

// Opt in only with a private runner-owned configuration. No application DB env is read.
const suite = process.env.VM_UC055_MYSQL_CONFIG ? describe : describe.skip;
suite('UC055 owned MySQL 8.4 metric deletion', () => {
  jest.setTimeout(15000);
  const entities = [
    User,
    EnterpriseMembership,
    EnterpriseAuditEvent,
    Database,
    Dataset,
    TableQuery,
    Widget,
    Dashboard,
    DashboardWidget,
    StudioState,
    ExploreView,
    ExportJob,
    PersonalView,
    Metric,
    MetricDeleteReceipt,
  ];
  let db: DataSource, peer: DataSource, service: MetricDeletionService;
  let config: any;
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
    active: (await peer.manager.findOneByOrFail(Metric, { id: 1 })).useYn,
    receipts: await peer.manager.count(MetricDeleteReceipt),
    audits: await peer.manager.count(EnterpriseAuditEvent),
    references: await peer.manager.count(ExploreView),
  });
  const reference = (manager: EntityManager) =>
    manager.insert(ExploreView, {
      sourceId: 1,
      userId: 2,
      name: 'Synthetic reference',
      sourceRevision: 'fixed',
      state: JSON.stringify({ measureIds: [1] }),
      measureVersions: JSON.stringify({ 1: 1 }),
    });
  // Observe an actual InnoDB wait in this unique schema; no timing-only race assertions.
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
  const gate = () => {
    let resolve!: () => void;
    const promise = new Promise<void>(done => {
      resolve = done;
    });
    return { promise, resolve: () => resolve() };
  };
  beforeAll(async () => {
    const file = process.env.VM_UC055_MYSQL_CONFIG;
    const stat = fs.statSync(file);
    config = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (
      (stat.mode & 0o077) !== 0 ||
      config.gate !== 'owned-uc055-metric-delete-v1' ||
      process.env.VM_UC055_MYSQL_OWNER !== config.owner ||
      !/^[a-f0-9]{24}$/.test(config.owner) ||
      config.host !== '127.0.0.1' ||
      !Number.isInteger(config.port) ||
      config.port < 1024 ||
      config.port > 65535 ||
      config.database !== 'vm_uc055_' + config.owner ||
      !config.serverUuid ||
      !config.password ||
      config.username !== 'root'
    ) {
      throw new Error('Refusing non-owned MySQL fixture configuration.');
    }
    db = await open();
    peer = await open();
    for (const connection of [db, peer]) {
      const [identity] = await connection.query(
        'SELECT VERSION() AS version, @@server_uuid AS uuid, DATABASE() AS db',
      );
      if (
        !/^8\.4\./.test(identity.version) ||
        identity.uuid !== config.serverUuid ||
        identity.db !== config.database
      )
        throw new Error('Unexpected fixture server identity.');
      const [marker] = await connection.query('SELECT token FROM uc055_fixture_owner');
      if (marker?.token !== config.owner) throw new Error('Unexpected fixture ownership marker.');
    }
    service = new MetricDeletionService(db);
  });
  beforeEach(async () => {
    // First destructive operation is after server/DB/ownership checks above.
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
    await db.manager.insert(Database, {
      id: 1,
      ownerId: 1,
      catalogActive: true,
      name: 'Synthetic source',
      engine: 'duckdb',
      type: 'file',
      connectionConfig: '{}',
    });
    await db.manager.insert(Metric, {
      id: 1,
      databaseId: 1,
      name: 'Synthetic metric',
      tableName: 'data',
      aggregation: MetricAggregation.SUM,
      expression: 'amount',
      definition: JSON.stringify({ schemaVersion: 1, sourceId: 1, definitionVersion: 1 }),
      useYn: 'Y',
    });
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    if (peer?.isInitialized) await peer.destroy();
    if (db?.isInitialized) await db.destroy();
  });

  it('migrates receipts twice, enforces request uniqueness and persists replay across reconnect', async () => {
    const runner = db.createQueryRunner();
    try {
      await runner.dropTable('metric_delete_receipt');
      const migration = new AddMetricDeleteReceipts1792540000000();
      await migration.up(runner);
      await migration.up(runner);
      const request = await body();
      const first = await service.remove(1, 1, request);
      expect(await state()).toEqual({ active: 'N', receipts: 1, audits: 1, references: 0 });
      const receipt = {
        ...(await db.manager.findOneByOrFail(MetricDeleteReceipt, { id: first.data.receiptId })),
      };
      delete receipt.id;
      await expect(db.manager.insert(MetricDeleteReceipt, receipt)).rejects.toMatchObject({
        driverError: { code: 'ER_DUP_ENTRY' },
      });
      await db.destroy();
      db = await open();
      service = new MetricDeletionService(db);
      // Historical confirmation must not delete a reactivated metric again.
      await peer.manager.update(Metric, 1, { useYn: 'Y' });
      expect((await service.remove(1, 1, request)).data).toMatchObject({
        receiptId: first.data.receiptId,
        replayed: true,
      });
      expect(await state()).toEqual({ active: 'Y', receipts: 1, audits: 1, references: 0 });
      await expect(
        service.remove(1, 1, { ...request, expectedRevision: 'b'.repeat(64) }),
      ).rejects.toMatchObject({ status: 409 });
    } finally {
      await runner.release();
    }
  });

  it.each(['metric', 'metric_delete_receipt', 'enterprise_audit_event'])(
    'rolls back the metric, receipt and audit when %s fails in real MySQL',
    async table => {
      const request = await body();
      await db.query(`CREATE TRIGGER uc055_failure BEFORE ${
        table === 'metric' ? 'UPDATE' : 'INSERT'
      }
        ON \`${table}\` FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'synthetic failure'`);
      try {
        await expect(service.remove(1, 1, request)).rejects.toThrow('synthetic failure');
        expect(await state()).toEqual({ active: 'Y', receipts: 0, audits: 0, references: 0 });
      } finally {
        await db.query('DROP TRIGGER uc055_failure');
      }
      await service.remove(1, 1, request);
      expect(await state()).toEqual({ active: 'N', receipts: 1, audits: 1, references: 0 });
    },
  );

  it.each(['owner', 'revision', 'actor', 'organization', 'epoch', 'inactive'])(
    'rejects changed current %s without deletion writes',
    async boundary => {
      const request = await body();
      if (boundary === 'owner') await peer.manager.update(Database, 1, { ownerId: 2 });
      if (boundary === 'revision') await peer.manager.update(Metric, 1, { expression: 'changed' });
      if (boundary === 'actor') request.expectedActorId = 2;
      if (boundary === 'organization')
        await peer.manager.update(EnterpriseMembership, 1, { organizationId: 2 });
      if (boundary === 'epoch') await peer.manager.update(User, 1, { authVersion: 1 });
      if (boundary === 'inactive') await peer.manager.update(User, 1, { active: false });
      await expect(service.remove(1, 1, request)).rejects.toMatchObject({
        status:
          boundary === 'owner' || boundary === 'inactive' ? 403 : boundary === 'epoch' ? 401 : 409,
      });
      expect(await state()).toEqual({ active: 'Y', receipts: 0, audits: 0, references: 0 });
    },
  );

  it.each(['studio', 'personal', 'pivot'])(
    'blocks actual persisted %s reference metadata',
    async kind => {
      const request = await body();
      if (kind !== 'personal')
        await db.manager.insert(Dashboard, {
          id: 1,
          title: 'Synthetic',
          delYn: 'N',
          layout: '[]',
          analysisDefinition: JSON.stringify({ databaseId: 1 }),
        });
      if (kind === 'studio')
        await db.manager.insert(StudioState, {
          dashboardId: 1,
          legacyRevision: 'a'.repeat(64),
          document: JSON.stringify({
            document: {
              schemaVersion: 1,
              sourceId: 1,
              blocks: [{ measureRefs: [{ id: 1, definitionVersion: '1' }] }],
            },
          }),
        });
      if (kind === 'personal')
        await db.manager.insert(PersonalView, {
          sourceId: 1,
          dashboardId: null,
          userId: 2,
          name: 'Synthetic view',
          revision: 'fixed',
          state: JSON.stringify({ measureIds: [1] }),
        });
      if (kind === 'pivot')
        await db.manager.update(Dashboard, 1, {
          pivotDefinitions: JSON.stringify([{ sourceId: 1, state: { measureIds: [1] } }]),
        });
      const impact = (await service.impact(1, 1)).data;
      expect(impact.canDelete).toBe(false);
      expect(impact.dependencies).toContainEqual({
        kind:
          kind === 'studio'
            ? 'studioDocuments'
            : kind === 'personal'
            ? 'exploreViews'
            : 'dashboardDefinitions',
        count: 1,
      });
      await expect(service.remove(1, 1, request)).rejects.toMatchObject({ status: 409 });
      expect(await state()).toEqual({ active: 'Y', receipts: 0, audits: 0, references: 0 });
    },
  );

  it.each<ExportJobStatus>(['queued', 'running', 'ready', 'failed', 'cancelled'])(
    'treats persisted %s export as a live dependency only while queued or running',
    async status => {
      const request = await body();
      const inserted = await peer.manager.insert(ExportJob, {
        ownerId: 1,
        organizationId: 1,
        sourceId: 1,
        sourceOwnerId: 1,
        requestId: randomUUID(),
        digest: 'a'.repeat(64),
        requestJson: JSON.stringify({
          payload: { mode: 'explore', query: { sourceId: 1, measureIds: [1] } },
          measureVersions: { '1': 1 },
        }),
        basisJson: JSON.stringify({ metrics: [{ id: 1, definitionVersion: 1 }] }),
        status,
        version: 1,
        expiresAt: new Date('2099-01-01T00:00:00Z'),
        ...(status === 'running'
          ? { attemptToken: randomUUID(), leaseUntil: new Date('2099-01-01T00:00:00Z') }
          : {}),
      });
      const jobId = inserted.identifiers[0].id;
      const before = await peer.manager.findOneByOrFail(ExportJob, { id: jobId });
      const active = status === 'queued' || status === 'running';
      const impact = (await service.impact(1, 1)).data;
      expect(impact.dependencies).toContainEqual({ kind: 'exportJobs', count: active ? 1 : 0 });
      expect(impact.canDelete).toBe(!active);
      if (active) {
        await expect(service.remove(1, 1, request)).rejects.toMatchObject({ status: 409 });
        expect(await state()).toEqual({ active: 'Y', receipts: 0, audits: 0, references: 0 });
      } else {
        expect((await service.remove(1, 1, request)).data.deleted).toBe(true);
        expect(await state()).toEqual({ active: 'N', receipts: 1, audits: 1, references: 0 });
      }
      expect(await peer.manager.findOneByOrFail(ExportJob, { id: jobId })).toEqual(before);
    },
  );

  it('writer-first Source/Metric lock blocks deletion then committed ExploreView causes409', async () => {
    const request = await body();
    const writer = peer.createQueryRunner();
    await writer.connect();
    await writer.startTransaction('READ COMMITTED');
    let deleting: Promise<any> | undefined;
    try {
      await lockMetricReferences(writer.manager, 1, [1]);
      await reference(writer.manager);
      deleting = service.remove(1, 1, request).then(
        value => ({ value }),
        error => ({ error }),
      );
      await waitForSourceLock();
      await writer.commitTransaction();
      expect((await deleting).error).toMatchObject({ status: 409 });
      expect(await state()).toEqual({ active: 'Y', receipts: 0, audits: 0, references: 1 });
    } finally {
      if (writer.isTransactionActive) await writer.rollbackTransaction();
      if (deleting) await deleting;
      await writer.release();
    }
  });

  it('delete-first locks Source/Metric; waiting new ExploreView sees inactive metric and writes nothing', async () => {
    const request = await body(),
      entered = gate(),
      resume = gate();
    const original = db.createQueryRunner.bind(db);
    jest.spyOn(db, 'createQueryRunner').mockImplementation(mode => {
      const runner = original(mode),
        update = runner.manager.update.bind(runner.manager);
      runner.manager.update = (async (entity: any, criteria: any, changes: any) => {
        const result = await update(entity, criteria, changes);
        if (entity === Metric && changes.useYn === 'N') {
          entered.resolve();
          await resume.promise;
        }
        return result;
      }) as typeof runner.manager.update;
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
          throw new Error('Deletion finished before lock barrier.');
        }),
      ]);
      writing = (async () => {
        await lockMetricReferences(writer.manager, 1, [1]);
        await reference(writer.manager);
      })().then(
        () => ({ accepted: true }),
        error => ({ error }),
      );
      await waitForSourceLock();
      resume.resolve();
      const deletion = await deleting;
      expect(deletion).toHaveProperty('value');
      if (!('value' in deletion)) throw deletion.error;
      expect(deletion.value.data.deleted).toBe(true);
      expect((await writing).error).toMatchObject({ status: 403 });
      await writer.rollbackTransaction();
      expect(await state()).toEqual({ active: 'N', receipts: 1, audits: 1, references: 0 });
    } finally {
      resume.resolve();
      await deleting;
      if (writing) await writing;
      if (writer.isTransactionActive) await writer.rollbackTransaction();
      await writer.release();
    }
  });
});
