jest.mock('../ai/ai.service', () => ({ AiService: class {} }));
import { createHash, randomUUID } from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DataSource, EntityManager } from 'typeorm';
import { semanticMetadata } from '../../test/util/semantic-mysql';
import { User } from '../user/entities/user.entity';
import { UserMapping } from '../user/entities/user-mapping.entity';
import { Database } from '../database/entities/database.entity';
import { Dataset } from '../dataset/entities/dataset.entity';
import { Widget } from '../widget/entities/widget.entity';
import { Component } from '../component/entities/component.entity';
import { Metric } from '../metric/entities/metric.entity';
import { Dashboard } from '../dashboard/entities/dashboard.entity';
import { DashboardShare } from '../dashboard/entities/dashboard_share.entity';
import { DashboardWidget } from '../dashboard/dashboard-widget/entities/dashboard-widget.entity';
import { SourceCatalogEntry } from '../bi/entities/source-catalog-entry.entity';
import { EnterpriseMembership } from '../enterprise/entities/enterprise-membership.entity';
import { EnterpriseAuditEvent } from '../enterprise/entities/enterprise-audit-event.entity';
import { EnterpriseNotificationAudience } from '../enterprise/entities/enterprise-notification-audience.entity';
import { EnterpriseResourceGrant } from '../enterprise/entities/enterprise-resource-grant.entity';
import {
  EnterpriseGroup,
  EnterpriseGroupMember,
  EnterpriseGroupGrant,
} from '../enterprise/entities/enterprise-group.entity';
import {
  EnterpriseDashboardDelivery,
  EnterpriseDeliveryReceipt,
} from '../enterprise/entities/enterprise-dashboard-delivery.entity';
import { EnterpriseGroupDelivery } from '../enterprise/entities/enterprise-group-delivery.entity';
import { EnterpriseResourcePolicyService } from '../enterprise/resource-policy.service';
import { EnterpriseDeliveryService } from '../enterprise/delivery.service';
import { EnterpriseGroupDeliveryService } from '../enterprise/group-delivery.service';
import { SourceAccessService } from '../ownership/source-access.service';
import { DuckDBService } from '../analysis/duckdb.service';
import { AiDashboardService } from '../ai/ai-dashboard.service';
import { BiService } from '../bi/bi.service';
import { StudioService } from './studio.service';
import { StudioCreationService } from './studio-creation.service';
import { StudioPublicationService } from './studio-publication.service';
import { StudioReceivedRemixService } from './studio-received-remix.service';
import { StudioRemixService } from './studio-remix.service';
import { StudioState } from './entities/studio-state.entity';
import { StudioRun } from './entities/studio-run.entity';
import { StudioRemixRequest } from './entities/studio-remix.entity';
import { StudioPublication, StudioPublicationRequest } from './entities/studio-publication.entity';
import { studioDigest } from './studio-legacy';

const suite = process.env.VM_SEMANTIC_MYSQL_CONFIG ? describe : describe.skip;
suite('UC053 received copy recovery actual MySQL metadata and native DuckDB slice', () => {
  jest.setTimeout(20000);
  const entities = [
    User,
    EnterpriseMembership,
    SourceCatalogEntry,
    EnterpriseAuditEvent,
    EnterpriseNotificationAudience,
    EnterpriseResourceGrant,
    EnterpriseGroup,
    EnterpriseGroupMember,
    EnterpriseGroupGrant,
    EnterpriseDashboardDelivery,
    EnterpriseGroupDelivery,
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
  ];
  let db: DataSource,
    worker: DuckDBService,
    root: string,
    connection: any,
    creation: StudioCreationService,
    studio: StudioService,
    remix: StudioRemixService,
    received: StudioReceivedRemixService,
    delivery: EnterpriseDeliveryService,
    grouped: EnterpriseGroupDeliveryService,
    reference: string,
    body: any,
    originalId: number;
  const files = new Map<number, string>();
  const previousRoot = process.env.FILE_UPLOAD_DIR;
  const snapshot = (omitted?: unknown) =>
    Promise.all(
      entities
        .filter(entity => entity !== User && entity !== omitted)
        .map(entity =>
          db.getRepository(entity).find({
            order: Object.fromEntries(
              db.getMetadata(entity).primaryColumns.map(column => [column.propertyName, 'ASC']),
            ),
          }),
        ),
    );
  const result = (input = body, actor = 8, epoch = 0, ref = reference) =>
    remix.receivedResult(ref, input, actor, epoch);
  const save = (epoch = 0) => remix.remix(reference, body, 8, received.resolve, epoch);
  beforeAll(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'received-copy-mysql-'));
    process.env.FILE_UPLOAD_DIR = root;
    worker = new DuckDBService();
    for (const [id, csv] of [
      [1, 'channel,amount\nSite,300\nMobile,200\n'],
      [2, 'segment,total\nSite,30\nMobile,20\n'],
    ] as const)
      files.set(
        id,
        (await worker.importFile({ originalname: 'synthetic.csv', buffer: Buffer.from(csv) }))
          .filename,
      );
    db = await semanticMetadata('studio', {
      type: 'sqlite',
      database: ':memory:',
      synchronize: true,
      entities,
    });
  });
  beforeEach(async () => {
    for (const entity of [...entities].reverse())
      await db.getRepository(entity).createQueryBuilder().delete().execute();
    for (const id of [7, 8, 9]) {
      await db.manager.insert(User, {
        id,
        userId: `recovery-${id}`,
        email: `recovery-${id}@example.invalid`,
        password: 'synthetic',
      });
      await db.manager.insert(EnterpriseMembership, {
        userId: id,
        organizationId: 1,
        role: id === 7 ? 'admin' : 'member',
      });
    }
    for (const sourceId of [1, 2])
      await db.manager.insert(Database, {
        id: sourceId,
        ownerId: sourceId === 1 ? 7 : 8,
        name: `Synthetic ${sourceId}`,
        engine: 'duckdb',
        type: 'FILE',
        connectionConfig: JSON.stringify({
          client: 'duckdb',
          connection: { filename: path.basename(files.get(sourceId)) },
        }),
      });
    await db.manager.insert(Component, {
      title: 'Value',
      type: 'BOARD_NUMERIC',
      option: '{}',
      useYn: 'Y',
    });
    // Same immutable-file adapter as studio-remix.service.spec: queries use the real native worker.
    // Snapshot scheduling is controlled; this slice does not verify ConnectionService file leases.
    connection = {
      withDuckDBSnapshot: jest.fn((_id, cb) => cb()),
      captureDuckDBSnapshot: jest.fn(async () => ({ run: async cb => cb() })),
      duckDBVersion: jest.fn(async id =>
        createHash('sha256')
          .update(path.basename(files.get(id)))
          .digest('hex'),
      ),
      isDuckDB: jest.fn().mockResolvedValue(true),
      queryDuckDB: jest.fn((id, sql, bindings) => worker.query(files.get(id), sql, bindings)),
    };
    const policy = new EnterpriseResourcePolicyService(db);
    const access = new SourceAccessService(db, policy);
    const dashboards = new AiDashboardService(
      {} as any,
      connection,
      db.getRepository(Dashboard),
      access,
    );
    studio = new StudioService(db, dashboards, connection, access);
    creation = new StudioCreationService(
      db,
      new BiService(db, access, connection, dashboards),
      {} as any,
      dashboards,
      connection,
      access,
      studio,
    );
    remix = new StudioRemixService(
      db,
      studio,
      new StudioPublicationService(db, studio, access, connection),
      creation,
      dashboards,
      connection,
      access,
    );
    received = new StudioReceivedRemixService(db, studio, access);
    delivery = new EnterpriseDeliveryService(db, policy, access);
    grouped = new EnterpriseGroupDeliveryService(db, policy, access);
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
      name: `origin-${randomUUID()}`,
      databaseId: 1,
      tableName: 'uploaded_data',
      aggregation: 'SUM' as any,
      expression: 'amount',
      definition: JSON.stringify(definition),
    });
    const blocks = [{ title: 'Revenue', kind: 'BOARD_NUMERIC', metric: definition }];
    const profile = await creation.profile(1, 7);
    originalId = (
      await dashboards.save(
        { draft: (creation as any).compile(1, 'Original', blocks, profile) },
        7,
        {
          schemaVersion: 2,
          kind: 'structured-bi-dashboard',
          sourceId: 1,
          items: [
            { sourceId: 1, metricId: metric.id, definitionVersion: 1, definition, chart: 'number' },
          ],
        } as any,
      )
    ).data.id;
    await policy.set('source', 1, 7, {
      recipientId: 8,
      expectedVersion: 0,
      rights: { read: true, edit: false, publish: false, export: false },
    });
    await delivery.set(originalId, 7, {
      requestId: randomUUID(),
      active: true,
      allowCopy: true,
      recipients: [{ recipientId: 8, expectedVersion: 0 }],
    });
    reference = (await received.reference(originalId, 8)).reference;
    const template = await remix.template(reference, 8, received.resolve);
    const preview = await remix.preview(
      reference,
      {
        targetSourceId: 2,
        mapping: { amount: 'total' },
        expectedVersion: template.version,
        expectedLifecycleRevision: template.lifecycleRevision,
      },
      8,
      received.resolve,
    );
    expect(Number(preview.preview.widgets[0].datas[0].value)).toBe(50);
    body = {
      requestId: randomUUID(),
      targetSourceId: 2,
      mapping: { amount: 'total' },
      excludedBlockIds: [],
      expectedVersion: template.version,
      expectedLifecycleRevision: template.lifecycleRevision,
      expectedSourceRevision: preview.sourceRevision,
    };
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    await worker?.onModuleDestroy();
    if (db?.isInitialized) await db.destroy();
    if (root) {
      fs.rmSync(root, { recursive: true, force: true });
      expect(fs.existsSync(root)).toBe(false);
    }
    if (previousRoot === undefined) delete process.env.FILE_UPLOAD_DIR;
    else process.env.FILE_UPLOAD_DIR = previousRoot;
  });
  const noComputation = () => [
    jest.spyOn(received, 'resolve'),
    jest.spyOn(creation, 'profile'),
    jest.spyOn(creation, 'prepareRemix'),
    jest.spyOn(creation, 'persistRemix'),
    connection.queryDuckDB,
    connection.withDuckDBSnapshot,
  ];
  const assertNoComputation = (spies: any[]) => {
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  };
  const clearConnectionCalls = () => {
    connection.queryDuckDB.mockClear();
    connection.withDuckDBSnapshot.mockClear();
  };
  it('looks up a missing exact request read-only, without origin resolution, SQL, preview or persistence', async () => {
    const before = await snapshot();
    clearConnectionCalls();
    const spies = noComputation();
    expect(await result()).toEqual({ found: false });
    expect(await snapshot()).toEqual(before);
    assertNoComputation(spies);
  });
  it.each(['direct', 'group'])(
    'finds an exact %s receipt after origin revocation and group changes, without any writes or computation',
    async mode => {
      if (mode === 'group') {
        await db.manager.insert(EnterpriseGroup, {
          id: 80,
          organizationId: 1,
          name: 'Synthetic group',
          nameKey: 'synthetic group',
          active: true,
          version: 1,
        });
        await db.manager.insert(EnterpriseGroupMember, { groupId: 80, userId: 8 });
        await grouped.set(originalId, 7, {
          requestId: randomUUID(),
          groupId: 80,
          expectedGroupVersion: 1,
          expectedVersion: 0,
          active: true,
          allowCopy: true,
        });
        await delivery.set(originalId, 7, {
          requestId: randomUUID(),
          active: false,
          recipients: [{ recipientId: 8, expectedVersion: 1 }],
        });
        reference = (await received.reference(originalId, 8)).reference;
        const template = await remix.template(reference, 8, received.resolve);
        body = {
          ...body,
          expectedVersion: template.version,
          expectedLifecycleRevision: template.lifecycleRevision,
        };
      }
      const created = await save();
      const receipt = await db.manager.findOneByOrFail(StudioRemixRequest, {
        actorId: 8,
        requestId: body.requestId,
      });
      expect(receipt.payloadHash).toBe(studioDigest({ token: reference, ...body }));
      if (mode === 'group') {
        await grouped.set(originalId, 7, {
          requestId: randomUUID(),
          groupId: 80,
          expectedGroupVersion: 1,
          expectedVersion: 1,
          active: false,
          allowCopy: false,
        });
        await db.manager.update(EnterpriseGroup, 80, { version: 2 });
      } else
        await delivery.set(originalId, 7, {
          requestId: randomUUID(),
          active: false,
          recipients: [{ recipientId: 8, expectedVersion: 1 }],
        });
      const before = await snapshot();
      clearConnectionCalls();
      const spies = noComputation();
      expect(await result()).toEqual({
        found: true,
        dashboardId: created.dashboardId,
        sourceId: 2,
        revision: created.document.revision,
      });
      await expect(result({ ...body, mapping: { amount: 'other' } })).rejects.toMatchObject({
        status: 409,
      });
      const changedReference = reference.slice(0, -1) + (reference.endsWith('a') ? 'b' : 'a');
      await expect(result(body, 8, 0, changedReference)).rejects.toMatchObject({ status: 409 });
      expect(await snapshot()).toEqual(before);
      assertNoComputation(spies);
    },
  );
  it.each([false, true])('locks result parents after User in order, found=%s', async found => {
    const created = found ? await save() : undefined;
    const locks: string[] = [];
    const original = EntityManager.prototype.findOne;
    jest
      .spyOn(EntityManager.prototype, 'findOne')
      .mockImplementation(function (entity: any, options: any) {
        if (options.lock && [User, Dashboard, Database].includes(entity))
          locks.push(`${entity.name}:${options.where.id}`);
        return original.call(this, entity, options);
      });
    expect((await result()).found).toBe(found);
    expect(locks).toEqual(
      found
        ? ['User:8', `Dashboard:${created.dashboardId}`, 'Database:2']
        : ['User:8', 'Database:2'],
    );
  });
  it.each(['clone', 'source'])(
    'waits on the %s lifecycle parent then rejects current inactivity without lookup writes',
    async kind => {
      const created = await save();
      const entity = kind === 'clone' ? Dashboard : Database;
      const id = kind === 'clone' ? created.dashboardId : 2;
      const before = await snapshot(entity);
      const dashboards = await db.manager.count(Dashboard);
      clearConnectionCalls();
      const spies = noComputation();
      const fence = db.createQueryRunner();
      await fence.connect();
      await fence.startTransaction('READ COMMITTED');
      await fence.manager.findOne(entity as typeof Dashboard, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (kind === 'clone') await fence.manager.update(Dashboard, id, { assetActive: false });
      else await fence.manager.update(Database, id, { catalogActive: false });
      const reading = result().then(
        value => ({ value }),
        error => ({ error }),
      );
      try {
        await waitForLock();
        await fence.commitTransaction();
        const outcome = await reading;
        expect('error' in outcome ? outcome.error : undefined).toMatchObject({ status: 403 });
        expect(await snapshot(entity)).toEqual(before);
        expect(await db.manager.count(Dashboard)).toBe(dashboards);
        assertNoComputation(spies);
      } finally {
        if (fence.isTransactionActive) await fence.rollbackTransaction();
        await reading;
        await fence.release();
      }
    },
  );
  it('binds lookup to actor and requires OWNER on the target source and persisted clone', async () => {
    const created = await save();
    await db.manager.update(Database, 2, { ownerId: 9 });
    expect(await result(body, 9)).toEqual({ found: false });
    await expect(result()).rejects.toMatchObject({ status: 403 });
    await db.manager.update(Database, 2, { ownerId: 8, catalogActive: false });
    await expect(result()).rejects.toMatchObject({ status: 403 });
    await db.manager.update(Database, 2, { catalogActive: true });
    await db.manager.update(UserMapping, { dashboardId: created.dashboardId }, { userInfoId: 7 });
    await expect(result()).rejects.toMatchObject({ status: 403 });
    await db.manager.update(UserMapping, { dashboardId: created.dashboardId }, { userInfoId: 8 });
    await db.manager.update(Dashboard, created.dashboardId, { assetActive: false });
    await expect(result()).rejects.toMatchObject({ status: 403 });
  });
  it('persists exactly one atomic private copy for concurrent same-UUID saves and replays without another copy', async () => {
    const before = await db.manager.count(Dashboard);
    const persist = jest.spyOn(creation, 'persistRemix');
    const results = await Promise.all([save(), save()]);
    expect(results[0]).toEqual(results[1]);
    expect(await db.manager.count(Dashboard)).toBe(before + 1);
    expect(await db.manager.count(StudioRemixRequest)).toBe(1);
    expect(persist).toHaveBeenCalledTimes(1);
    const saved = await snapshot();
    expect(await save()).toEqual(results[0]);
    expect(await snapshot()).toEqual(saved);
  });
  it('rolls back the clone and all linked metadata if receipt persistence fails', async () => {
    const before = await snapshot();
    await db.query(
      "CREATE TRIGGER reject_copy_receipt BEFORE INSERT ON studio_remix_request FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'copy receipt failure'",
    );
    try {
      await expect(save()).rejects.toThrow('copy receipt failure');
    } finally {
      await db.query('DROP TRIGGER reject_copy_receipt');
    }
    expect(await snapshot()).toEqual(before);
  });
  const waitForLock = async () => {
    for (let attempt = 0; attempt < 100; attempt++) {
      const [row] = await db.query('SELECT COUNT(*) AS n FROM performance_schema.data_lock_waits');
      if (Number(row.n) > 0) return;
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    throw new Error('Expected an actual InnoDB User lock wait');
  };
  it.each(['result missing', 'result found', 'save', 'final save'])(
    'rejects old epoch after a two-connection User wait during %s without metadata writes',
    async mode => {
      if (mode === 'result found') await save();
      const before = await snapshot();
      let held: () => void, release: () => void;
      const entered = new Promise<void>(resolve => {
        held = resolve;
      });
      const gate = new Promise<void>(resolve => {
        release = resolve;
      });
      let posting: Promise<any>;
      if (mode === 'final save') {
        const prepare = creation.prepareRemix.bind(creation);
        jest.spyOn(creation, 'prepareRemix').mockImplementation(async (...args) => {
          const prepared = await prepare(...args);
          held();
          await gate;
          return prepared;
        });
        posting = save(0).then(
          value => ({ value }),
          error => ({ error }),
        );
        await entered;
      }
      const fence = db.createQueryRunner();
      await fence.connect();
      await fence.startTransaction('READ COMMITTED');
      await fence.manager.findOne(User, { where: { id: 8 }, lock: { mode: 'pessimistic_write' } });
      await fence.manager.update(User, 8, { authVersion: 1 });
      try {
        if (mode === 'final save') release();
        else
          posting = (mode.startsWith('result') ? result() : save(0)).then(
            value => ({ value }),
            error => ({ error }),
          );
        await waitForLock();
        await fence.commitTransaction();
        expect((await posting).error).toMatchObject({ status: 403 });
        expect(await snapshot()).toEqual(before);
        expect(await db.manager.count(StudioRemixRequest)).toBe(mode === 'result found' ? 1 : 0);
        if (mode.startsWith('result'))
          expect((await result(body, 8, 1)).found).toBe(mode === 'result found');
      } finally {
        release();
        if (fence.isTransactionActive) await fence.rollbackTransaction();
        await posting;
        await fence.release();
      }
    },
  );
});
