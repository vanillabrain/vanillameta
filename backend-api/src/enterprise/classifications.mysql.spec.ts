jest.mock('../ai/ai.service', () => ({ AiService: class {} }));
import { DuckDBInstance } from '@duckdb/node-api';
import { createHash, randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { DataSource } from 'typeorm';
import { DuckDBService } from '../analysis/duckdb.service';
import { ConnectionService } from '../connection/connection.service';
import { AiDashboardService } from '../ai/ai-dashboard.service';
import { BiService } from '../bi/bi.service';
import { SourceCatalogService } from '../bi/source-catalog.service';
import { SourceCatalogEntry } from '../bi/entities/source-catalog-entry.entity';
import { Dashboard } from '../dashboard/entities/dashboard.entity';
import { Database } from '../database/entities/database.entity';
import { Metric } from '../metric/entities/metric.entity';
import { User } from '../user/entities/user.entity';
import { SourceAccessService } from '../ownership/source-access.service';
import { EnterpriseResourcePolicyService } from './resource-policy.service';
import { EnterpriseMembership } from './entities/enterprise-membership.entity';
import { EnterpriseAuditEvent } from './entities/enterprise-audit-event.entity';
import { EnterpriseResourceGrant } from './entities/enterprise-resource-grant.entity';
import {
  EnterpriseGroup,
  EnterpriseGroupMember,
  EnterpriseGroupGrant,
} from './entities/enterprise-group.entity';

import { AddEnterpriseClassifications1792580000000 } from '../migrations/1792580000000-add-enterprise-classifications';
import { EnterpriseClassificationService } from './classification.service';
import {
  EnterpriseClassification,
  EnterpriseClassificationRequest,
} from './entities/enterprise-classification.entity';
const suite = process.env.VM_UC050_CLASSIFICATIONS_MYSQL_CONFIG ? describe : describe.skip;
suite('UC050 owned MySQL8.4 classifications and native DuckDB catalog bindings', () => {
  jest.setTimeout(15000);
  const entities = [
    User,
    EnterpriseMembership,
    EnterpriseAuditEvent,
    EnterpriseResourceGrant,
    EnterpriseGroup,
    EnterpriseGroupMember,
    EnterpriseGroupGrant,
    Database,
    Metric,
    Dashboard,
    SourceCatalogEntry,
    EnterpriseClassification,
    EnterpriseClassificationRequest,
  ];
  let db: DataSource, peer: DataSource, config: any, filename: string, worker: DuckDBService;
  const open = () =>
    new DataSource({
      type: 'mysql',
      host: config.host,
      port: config.port,
      username: config.username,
      password: config.password,
      database: config.database,
      entities,
      timezone: 'Z',
      logging: false,
      extra: { connectionLimit: 5, connectTimeout: 5000 },
    }).initialize();
  const identity = async (source: DataSource) => {
    const [server] = await source.query(
      'SELECT VERSION() AS version, @@server_uuid AS uuid, DATABASE() AS db',
    );
    if (
      !/^8\.4\./.test(server.version) ||
      server.uuid !== config.serverUuid ||
      server.db !== config.database
    )
      throw new Error('Refusing unexpected MySQL identity');
    const [marker] = await source.query('SELECT token FROM uc050_classifications_fixture_owner');
    if (marker?.token !== config.owner) throw new Error('Refusing unowned database');
  };
  const catalog = () => {
    const access = new SourceAccessService(db, new EnterpriseResourcePolicyService(db));
    const connection = new ConnectionService(db.getRepository(Database), {} as any, worker);
    const ai = new AiDashboardService({} as any, connection, db.getRepository(Dashboard), access);
    return new SourceCatalogService(db, access, new BiService(db, access, connection, ai));
  };
  const counts = async () => ({
    history: await db.manager.count(SourceCatalogEntry),
    audit: await db.manager.count(EnterpriseAuditEvent),
    registry: await db.manager.count(EnterpriseClassification),
    receipts: await db.manager.count(EnterpriseClassificationRequest),
  });
  const observeWait = async (table: string) => {
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      const waits = await peer.query(
        `SELECT l.OBJECT_NAME FROM performance_schema.data_lock_waits w
        JOIN performance_schema.data_locks l ON l.ENGINE_LOCK_ID = w.REQUESTING_ENGINE_LOCK_ID
        WHERE l.OBJECT_SCHEMA = ? AND l.OBJECT_NAME = ?`,
        [config.database, table],
      );
      if (waits.length) return;
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    throw new Error('No actual InnoDB lock wait observed for ' + table);
  };
  const settle = (promise: Promise<any>) =>
    promise.then(
      value => ({ value, error: undefined }),
      error => ({ value: undefined, error }),
    );
  beforeAll(async () => {
    const file = process.env.VM_UC050_CLASSIFICATIONS_MYSQL_CONFIG;
    config = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (
      (fs.statSync(file).mode & 0o077) !== 0 ||
      config.gate !== 'owned-uc050-classifications-v1' ||
      process.env.VM_UC050_CLASSIFICATIONS_MYSQL_OWNER !== config.owner ||
      !/^[a-f0-9]{24}$/.test(config.owner) ||
      config.host !== '127.0.0.1' ||
      !Number.isInteger(config.port) ||
      config.port < 1024 ||
      config.port > 65535 ||
      config.database !== 'vm_uc050_classifications_' + config.owner ||
      !config.serverUuid ||
      !config.password ||
      config.username !== 'root' ||
      !path.isAbsolute(config.privateFileRoot) ||
      fs.realpathSync(config.privateFileRoot) !== config.privateFileRoot
    )
      throw new Error('Refusing non-owned classifications fixture');
    db = await open();
    peer = await open();
    await identity(db);
    await identity(peer);
    const directory = path.join(config.privateFileRoot, randomUUID());
    fs.mkdirSync(directory, { mode: 0o700 });
    filename = path.join(directory, 'data.duckdb');
    const instance = await DuckDBInstance.create(filename),
      native = await instance.connect();
    try {
      await native.run('CREATE TABLE uploaded_data(amount DECIMAL(18,2), business_day VARCHAR)');
      await native.run(
        "INSERT INTO uploaded_data VALUES (0, '2024/02/29'), (25.50, '2024/03/01'), (NULL, NULL)",
      );
      await native.run('CHECKPOINT');
    } finally {
      native.closeSync();
      instance.closeSync();
    }
    worker = new DuckDBService();
  });
  beforeEach(async () => {
    jest.restoreAllMocks();
    // Verify ownership again immediately before destructive schema reset.
    await identity(db);
    await db.synchronize(true);
    await db.query('CREATE TABLE uc050_classifications_fixture_owner (token varchar(24) NOT NULL)');
    await db.query('INSERT INTO uc050_classifications_fixture_owner VALUES (?)', [config.owner]);
    await db.manager.insert(
      User,
      [1, 2, 3, 4].map(id => ({
        id,
        userId: 'classification-fixture-' + id,
        email: `classifications-${id}@example.invalid`,
        password: 'unused',
        active: true,
        authVersion: 0,
      })),
    );
    await db.manager.insert(EnterpriseMembership, [
      { userId: 1, organizationId: 1, role: 'admin', team: '' },
      { userId: 2, organizationId: 1, role: 'admin', team: '' },
      { userId: 3, organizationId: 2, role: 'admin', team: '' },
      { userId: 4, organizationId: 1, role: 'member', team: '' },
    ]);
    await db.manager.insert(
      Database,
      [11, 12].map(id => ({
        id,
        ownerId: 1,
        name: 'Owned synthetic source ' + id,
        engine: 'duckdb',
        type: 'FILE',
        connectionConfig: JSON.stringify({ client: 'duckdb', connection: { filename } }),
      })),
    );
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    await worker?.onModuleDestroy();
    if (peer?.isInitialized) await peer.destroy();
    if (db?.isInitialized) await db.destroy();
    // The runner owns and removes this private root and credentials in its finally block.
  });
  const registry = (source = db) => new EnterpriseClassificationService(source);
  const body = (name: string, actor = 1, organizationId = actor === 3 ? 2 : 1) => ({
    expectedActorId: actor,
    expectedOrganizationId: organizationId,
    requestId: randomUUID(),
    name,
  });
  const create = (name: string, actor = 1) => registry().create(actor, 0, body(name, actor));
  const change = (
    row: { id: number; name: string; version: number; active: boolean },
    changes: any = {},
    actor = 1,
    source = db,
  ) =>
    registry(source).set(row.id, actor, 0, {
      expectedActorId: actor,
      expectedOrganizationId: actor === 3 ? 2 : 1,
      expectedVersion: row.version,
      name: row.name,
      active: row.active,
      ...changes,
    });
  it('enforces NFKC/case equality through SHA256 nameKey while preserving accents and organization boundaries', async () => {
    const first = await create('  ＡＢＣ  ');
    expect(first).toEqual({
      actorId: 1,
      organizationId: 1,
      entry: { id: expect.any(Number), name: 'ABC', active: true, version: 1 },
      replayed: false,
    });
    const row = await db.manager.findOneByOrFail(EnterpriseClassification, { id: first.entry.id });
    expect(row.nameKey).toBe(createHash('sha256').update('abc', 'utf8').digest('hex'));
    await expect(create('abc')).rejects.toMatchObject({ status: 409 });
    await create('cafe');
    const accented = await create('café');
    await expect(create('cafe\u0301')).rejects.toMatchObject({ status: 409 });
    expect((await create('ABC', 3)).organizationId).toBe(2);
    const [comparison] = await db.query(
      'SELECT a.nameKey = b.nameKey AS equalKey FROM enterprise_classification a JOIN enterprise_classification b ON a.id=? AND b.id=?',
      [row.id, accented.entry.id],
    );
    expect(Number(comparison.equalKey)).toBe(0);
    expect((await registry().list(1, 0)).entries.map(entry => entry.name)).toEqual([
      'ABC',
      'cafe',
      'café',
    ]);
  });
  it('reserves inactive names and reactivates the same row without another creation receipt', async () => {
    const created = await create('Reserved');
    const inactive = await change(created.entry, { active: false });
    const before = await counts();
    await expect(create('reserved')).rejects.toMatchObject({ status: 409 });
    expect(await counts()).toEqual(before);
    const active = await change(inactive.entry, { active: true });
    expect(active.entry).toEqual({ ...created.entry, version: 3 });
    expect((await counts()).receipts).toBe(1);
  });
  it('replays immutable creation receipt after reconnect without duplicate registry or audit rows', async () => {
    const request = body('Original');
    const created = await registry().create(1, 0, request);
    await change(created.entry, { name: 'Renamed' });
    const before = await counts();
    await db.destroy();
    db = await open();
    await identity(db);
    const replay = await registry().create(1, 0, request);
    expect(replay).toEqual({ ...created, replayed: true });
    expect(await counts()).toEqual(before);
    expect((await registry().list(1, 0)).entries[0].name).toBe('Renamed');
  });
  it('rejects reused UUID with changed body or changed organization without replaying into the new organization', async () => {
    const request = body('Same request');
    await registry().create(1, 0, request);
    const before = await counts();
    await expect(registry().create(1, 0, { ...request, name: 'Different' })).rejects.toMatchObject({
      status: 409,
    });
    await db.manager.update(EnterpriseMembership, 1, { organizationId: 2 });
    await expect(
      registry().create(1, 0, { ...request, expectedOrganizationId: 2 }),
    ).rejects.toMatchObject({ status: 409 });
    expect(await counts()).toEqual(before);
  });
  it('enforces member/admin, expected actor/org and trusted token epoch without leaking registry internals', async () => {
    await create('Own organization');
    await create('Other organization', 3);
    const before = await counts();
    const listed = await registry().list(4, 0);
    expect(listed).toEqual({
      actorId: 4,
      organizationId: 1,
      canManage: false,
      entries: [{ id: expect.any(Number), name: 'Own organization', active: true, version: 1 }],
      nextAfterId: null,
    });
    expect(JSON.stringify(listed)).not.toMatch(
      /nameKey|Other organization|connectionConfig|sourceId|column/,
    );
    await expect(registry().create(4, 0, body('No member write', 4))).rejects.toMatchObject({
      status: 403,
    });
    await expect(
      registry().create(1, 0, { ...body('Forged actor'), expectedActorId: 2 }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      registry().create(1, 0, { ...body('Forged organization'), expectedOrganizationId: 2 }),
    ).rejects.toMatchObject({ status: 409 });
    await db.manager.update(User, 1, { authVersion: 1 });
    await expect(registry().create(1, 0, body('Stale token'))).rejects.toMatchObject({
      status: 401,
    });
    expect(await counts()).toEqual(before);
  });
  it('keeps no-op writes and exhausted CAS versions from adding audit events', async () => {
    const created = await create('No-op');
    const before = await counts();
    expect(await change(created.entry)).toEqual({
      actorId: 1,
      organizationId: 1,
      entry: created.entry,
    });
    expect(await counts()).toEqual(before);
    await db.manager.update(EnterpriseClassification, created.entry.id, { version: 2147483647 });
    await expect(
      change({ ...created.entry, version: 2147483647 }, { name: 'Overflow' }),
    ).rejects.toMatchObject({ status: 409 });
    expect(await counts()).toEqual(before);
  });
  it('observes an actual classification row wait then rejects stale two-connection CAS without lost updates', async () => {
    const created = await create('CAS');
    const runner = peer.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    let pending: ReturnType<typeof settle>;
    try {
      await runner.manager.findOne(EnterpriseClassification, {
        where: { id: created.entry.id },
        lock: { mode: 'pessimistic_write' },
      });
      pending = settle(change(created.entry, { name: 'Waiting stale' }));
      await observeWait('enterprise_classification');
      await runner.manager.update(EnterpriseClassification, created.entry.id, {
        name: 'Peer winner',
        nameKey: createHash('sha256').update('peer winner').digest('hex'),
        version: 2,
      });
      await runner.manager.insert(EnterpriseAuditEvent, {
        organizationId: 1,
        actorId: 2,
        action: 'classification.changed',
        resourceId: created.entry.id,
        subjectId: null,
        version: 2,
      });
      await runner.commitTransaction();
      expect((await pending).error).toMatchObject({ status: 409 });
      expect(
        (await db.manager.findOneByOrFail(EnterpriseClassification, { id: created.entry.id })).name,
      ).toBe('Peer winner');
      expect((await counts()).audit).toBe(2);
    } finally {
      if (runner.isTransactionActive) await runner.rollbackTransaction();
      await runner.release();
      if (pending) await pending;
    }
  });
  it('rechecks the real token epoch after an observed User lock wait before creating any row', async () => {
    const runner = peer.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    const before = await counts();
    let pending: ReturnType<typeof settle>;
    try {
      await runner.manager.findOne(User, { where: { id: 1 }, lock: { mode: 'pessimistic_write' } });
      pending = settle(registry().create(1, 0, body('Blocked stale epoch')));
      await observeWait('user');
      await runner.manager.update(User, 1, { authVersion: 1 });
      await runner.commitTransaction();
      expect((await pending).error).toMatchObject({ status: 401 });
      expect(await counts()).toEqual(before);
    } finally {
      if (runner.isTransactionActive) await runner.rollbackTransaction();
      await runner.release();
      if (pending) await pending;
    }
  });
  it.each(['enterprise_audit_event', 'enterprise_classification_request'])(
    'rolls back actual MySQL creation and receipt when %s insert fails inside the transaction',
    async table => {
      const before = await counts();
      await db.query(
        `CREATE TRIGGER owned_classification_failure BEFORE INSERT ON ${table} FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='owned synthetic failure'`,
      );
      try {
        await expect(registry().create(1, 0, body('Atomic rollback'))).rejects.toThrow();
        expect(await counts()).toEqual(before);
      } finally {
        await db.query('DROP TRIGGER IF EXISTS owned_classification_failure');
      }
    },
  );
  it('runs the real migration twice on MySQL and preserves existing registry/receipt rows and unique hash index', async () => {
    const runner = db.createQueryRunner();
    await runner.connect();
    try {
      await runner.dropTable('enterprise_classification_request');
      await runner.dropTable('enterprise_classification');
      const migration = new AddEnterpriseClassifications1792580000000();
      await migration.up(runner);
      const created = await create('Migration preservation');
      const before = await counts();
      await migration.up(runner);
      expect(await counts()).toEqual(before);
      const table = await runner.getTable('enterprise_classification');
      expect(table.columns.find(column => column.name === 'nameKey').length).toBe('64');
      expect(
        table.indices.find(index => index.name === 'UQ_enterprise_classification_name'),
      ).toMatchObject({ isUnique: true, columnNames: ['organizationId', 'nameKey'] });
      const row = await db.manager.findOneByOrFail(EnterpriseClassification, {
        id: created.entry.id,
      });
      await expect(
        db.manager.insert(EnterpriseClassification, {
          organizationId: 1,
          name: 'Different display',
          nameKey: row.nameKey,
          active: true,
          version: 1,
        }),
      ).rejects.toMatchObject({ driverError: { code: 'ER_DUP_ENTRY' } });
    } finally {
      await runner.release();
    }
  });
  const catalogBody = async (sourceId = 11) => {
    const read = await catalog().read({ sourceId }, 1);
    return {
      sourceId,
      sourceRevision: read.sourceRevision,
      version: read.version,
      label: read.label,
      description: read.description,
      columns: read.columns.map(column => ({
        ...Object.fromEntries(Object.entries(column).filter(([key]) => key !== 'type')),
        ...(column.column === 'business_day'
          ? { businessType: 'date', dateFormat: 'YYYY/MM/DD' }
          : {}),
      })) as any[],
    };
  };
  const bindBody = async (
    entry: { id: number; version: number },
    sourceId = 11,
    organizationId = 1,
  ) => {
    const input = await catalogBody(sourceId);
    return {
      ...input,
      columns: input.columns.map(column =>
        column.column === 'amount'
          ? {
              ...column,
              classification: 'Ignored client spelling',
              classificationRef: { organizationId, id: entry.id, version: entry.version },
            }
          : column,
      ),
    };
  };
  it('binds two real DuckDB-backed source catalogs and preserves historical names until explicit latest-version adoption', async () => {
    const created = await create('Original registry name');
    for (const sourceId of [11, 12]) {
      const input = await bindBody(created.entry, sourceId);
      const preview = await catalog().preview(input, 1, 0);
      expect(preview.draft.columns.find(column => column.column === 'amount').classification).toBe(
        'Original registry name',
      );
      expect(preview.changes.some(change => change.field === 'classificationRef')).toBe(true);
      await catalog().save(preview.draft, 1, 0);
    }
    const old = await db.manager.find(SourceCatalogEntry, {
      order: { sourceId: 'ASC', version: 'ASC' },
    });
    const renamed = await change(created.entry, { name: 'Latest registry name' });
    for (const sourceId of [11, 12])
      expect(
        (await catalog().read({ sourceId }, 1)).columns.find(column => column.column === 'amount'),
      ).toMatchObject({
        classification: 'Original registry name',
        classificationRef: { organizationId: 1, id: created.entry.id, version: 1 },
      });
    const adopted = await catalog().preview(await bindBody(renamed.entry), 1, 0);
    expect(adopted.changes.some(change => change.field === 'classificationRef')).toBe(true);
    await catalog().save(adopted.draft, 1, 0);
    expect(
      (await catalog().read({ sourceId: 11 }, 1)).columns.find(
        column => column.column === 'amount',
      ),
    ).toMatchObject({ classification: 'Latest registry name', classificationRef: { version: 2 } });
    expect(
      (await catalog().read({ sourceId: 12 }, 1)).columns.find(column => column.column === 'amount')
        .classification,
    ).toBe('Original registry name');
    for (const entry of old)
      expect(
        (
          await db.manager.findOneByOrFail(SourceCatalogEntry, {
            sourceId: entry.sourceId,
            version: entry.version,
          })
        ).metadata,
      ).toBe(entry.metadata);
    const connection = new ConnectionService(db.getRepository(Database), {} as any, worker);
    expect(
      (await connection.queryDuckDB(11, 'SELECT SUM(amount) AS value FROM uploaded_data')).datas[0]
        .value,
    ).toBe('25.50');
  });
  it('blocks new inactive bindings while preserving omitted historical bindings and explicit unlink/free-text edits', async () => {
    const created = await create('Historical name');
    await catalog().save(await bindBody(created.entry), 1, 0);
    const inactive = await change(created.entry, { active: false });
    const before = await counts();
    await expect(catalog().save(await bindBody(inactive.entry, 12), 1, 0)).rejects.toMatchObject({
      status: 409,
    });
    expect(await counts()).toEqual(before);
    const preserving = await catalogBody();
    preserving.description = 'Other metadata only';
    preserving.columns = preserving.columns.map(column =>
      Object.fromEntries(
        Object.entries(column).filter(
          ([key]) => !['classificationRef', 'classification'].includes(key),
        ),
      ),
    ) as any;
    await catalog().save(preserving, 1, 0);
    const preserved = (await catalog().read({ sourceId: 11 }, 1)).columns.find(
      column => column.column === 'amount',
    );
    expect(preserved).toMatchObject({
      classification: 'Historical name',
      classificationRef: { version: 1 },
    });
    const unlink = await catalogBody();
    unlink.columns = unlink.columns.map(column =>
      column.column === 'amount' ? { ...column, classificationRef: null } : column,
    );
    const preview = await catalog().preview(unlink, 1, 0);
    expect(preview.changes.some(change => change.field === 'classificationRef')).toBe(true);
    await catalog().save(preview.draft, 1, 0);
    const free = await catalogBody();
    free.columns = free.columns.map(column =>
      column.column === 'amount'
        ? { ...column, classification: 'Independent legacy string' }
        : column,
    );
    await catalog().save(free, 1, 0);
    expect(
      (await catalog().read({ sourceId: 11 }, 1)).columns.find(
        column => column.column === 'amount',
      ),
    ).toMatchObject({ classification: 'Independent legacy string', classificationRef: null });
  });
  it('rejects a catalog binding after actual classification lock wait and peer version change without appending history', async () => {
    const created = await create('Catalog race');
    const input = await bindBody(created.entry);
    const before = await counts();
    const runner = peer.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    let pending: ReturnType<typeof settle>;
    try {
      await runner.manager.findOne(EnterpriseClassification, {
        where: { id: created.entry.id },
        lock: { mode: 'pessimistic_write' },
      });
      pending = settle(catalog().save(input, 1, 0));
      await observeWait('enterprise_classification');
      await runner.manager.update(EnterpriseClassification, created.entry.id, {
        name: 'Changed during binding',
        nameKey: createHash('sha256').update('changed during binding').digest('hex'),
        version: 2,
      });
      await runner.commitTransaction();
      expect((await pending).error).toMatchObject({ status: 409 });
      expect(await counts()).toEqual(before);
    } finally {
      if (runner.isTransactionActive) await runner.rollbackTransaction();
      await runner.release();
      if (pending) await pending;
    }
  });
  it('requires current source edit and same-organization active binding even for registry admins', async () => {
    const created = await create('Owned organization');
    const foreign = await create('Other organization private name', 3);
    const before = await counts();
    await expect(catalog().save(await bindBody(foreign.entry, 11, 2), 1, 0)).rejects.toMatchObject({
      status: 403,
    });
    await expect(catalog().save(await bindBody(created.entry), 2, 0)).rejects.toMatchObject({
      status: 403,
    });
    await db.manager.update(User, 1, { authVersion: 1 });
    await expect(catalog().save(await bindBody(created.entry), 1, 0)).rejects.toMatchObject({
      status: 401,
    });
    expect(await counts()).toEqual(before);
  });
});
