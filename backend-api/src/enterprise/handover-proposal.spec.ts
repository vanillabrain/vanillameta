import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import request = require('supertest');
import { DataSource } from 'typeorm';
import { lockDashboardWrite } from '../dashboard/dashboard-write-lock';
import { lockMetricSources } from '../metric/metric-write-lock';
import { semanticMetadata } from '../../test/util/semantic-mysql';
import { HttpExceptionFilter } from '../nest-utils/http-exception.filter';
import { User } from '../user/entities/user.entity';
import { UserMapping } from '../user/entities/user-mapping.entity';
import { Database } from '../database/entities/database.entity';
import { Metric, MetricAggregation } from '../metric/entities/metric.entity';
import { DashboardWidget } from '../dashboard/dashboard-widget/entities/dashboard-widget.entity';
import { Widget } from '../widget/entities/widget.entity';
import { Dataset } from '../dataset/entities/dataset.entity';
import { TableQuery } from '../widget/tabel-query/entity/table-query.entity';
import { DatasetType } from '../common/enum/dataset-type.enum';
import { Dashboard } from '../dashboard/entities/dashboard.entity';
import { StudioState } from '../dashboard-studio/entities/studio-state.entity';
import { EnterpriseOrganization } from './entities/enterprise-organization.entity';
import { EnterpriseMembership } from './entities/enterprise-membership.entity';
import { EnterpriseAuditEvent } from './entities/enterprise-audit-event.entity';
import { EnterpriseHandoverProposal } from './entities/enterprise-handover-proposal.entity';
import { HandoverProposalService } from './handover-proposal.service';
import { HandoverProposalController } from './handover-proposal.controller';
import { AddHandoverProposal1792600000000 } from '../migrations/1792600000000-add-handover-proposal';

const entities = [
  User,
  EnterpriseOrganization,
  EnterpriseMembership,
  Database,
  Metric,
  Dashboard,
  UserMapping,
  StudioState,
  DashboardWidget,
  Widget,
  Dataset,
  TableQuery,
  EnterpriseAuditEvent,
  EnterpriseHandoverProposal,
];
const selected = [
  { kind: 'source', id: 11, title: 'Source title' },
  { kind: 'dashboard', id: 21, title: 'Dashboard title' },
];
describe('UC051 metadata-only handover proposals', () => {
  jest.setTimeout(30000);
  let db: DataSource, app: INestApplication, service: HandoverProposalService;
  const oldSecret = process.env.ACCESS_SECRET,
    jwt = new JwtService();
  const token = (id = 1, epoch = 0) =>
    jwt.sign(
      { accessKeyData: { id, userId: `handover-${id}`, authVersion: epoch } },
      { secret: process.env.ACCESS_SECRET },
    );
  const http = (method: 'get' | 'post', path: string, actor = 1, body?: any, epoch = 0) => {
    const req = request(app.getHttpServer())
      [method]('/enterprise/handover' + path)
      .set('Authorization', `Bearer ${token(actor, epoch)}`);
    return body === undefined ? req : req.send(body);
  };
  const input = () => ({ requestId: randomUUID(), recipientId: 2, assets: selected });
  const snapshot = async (included = entities) =>
    Promise.all(
      included.map(entity => {
        const repo = db.getRepository(entity);
        return repo.find({
          order: Object.fromEntries(repo.metadata.primaryColumns.map(c => [c.propertyName, 'ASC'])),
        });
      }),
    );
  const terms = (row: any) => ({ expectedVersion: row.version, reviewBasis: row.reviewBasis });
  beforeAll(async () => {
    process.env.ACCESS_SECRET = 'synthetic-handover-access';
    db = await semanticMetadata('handover', {
      type: 'sqlite',
      database: ':memory:',
      entities,
      synchronize: true,
    });
    service = new HandoverProposalService(db);
    const module = await Test.createTestingModule({
      controllers: [HandoverProposalController],
      providers: [
        HandoverProposalService,
        { provide: DataSource, useValue: db },
        { provide: JwtService, useValue: jwt },
      ],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    await app.listen(0, '127.0.0.1');
  });
  afterAll(async () => {
    jest.restoreAllMocks();
    await app?.close();
    await db?.destroy();
    if (oldSecret === undefined) delete process.env.ACCESS_SECRET;
    else process.env.ACCESS_SECRET = oldSecret;
  });
  beforeEach(async () => {
    jest.restoreAllMocks();
    for (const entity of [...entities].reverse())
      await db.getRepository(entity).createQueryBuilder().delete().execute();
    await db.getRepository(User).save(
      [1, 2, 3, 4, 5].map(id => ({
        id,
        userId: `handover-${id}`,
        email: `handover-${id}@example.invalid`,
        password: 'synthetic-private-password',
        active: true,
        authVersion: 0,
      })),
    );
    await db.getRepository(EnterpriseOrganization).save([
      { id: 10, name: 'Synthetic A', version: 1 },
      { id: 20, name: 'Synthetic B', version: 1 },
    ]);
    await db.getRepository(EnterpriseMembership).save(
      [1, 2, 3, 4].map(userId => ({
        userId,
        organizationId: userId === 3 ? 20 : 10,
        role: userId === 4 ? 'admin' : 'member',
        team: '',
      })),
    );
    await db.getRepository(Database).save([
      {
        id: 11,
        ownerId: 1,
        catalogActive: true,
        name: 'Source title',
        engine: 'duckdb',
        type: 'file',
        connectionConfig: 'synthetic-private-path',
      },
      {
        id: 12,
        ownerId: 2,
        catalogActive: true,
        name: 'Other title',
        engine: 'duckdb',
        type: 'file',
        connectionConfig: 'synthetic-private-connection',
      },
    ]);
    await db.getRepository(Metric).save({
      id: 31,
      databaseId: 11,
      name: 'synthetic-private-metric',
      tableName: 'private-table',
      expression: 'private-expression',
      aggregation: MetricAggregation.SUM,
      definition: 'private-definition',
    });
    await db
      .getRepository(Dashboard)
      .save({ id: 21, title: 'Dashboard title', structuredDefinition: 'private-dashboard-json' });
    await db.getRepository(UserMapping).save({ id: 41, dashboardId: 21, userInfoId: 1 });
    await db.getRepository(StudioState).save({
      dashboardId: 21,
      document: 'private-studio-json',
      legacyRevision: 'private-revision',
    });
  });
  it('creates, reads, accepts and cancels with exact safe projection, historical replay and unchanged resources', async () => {
    const protectedEntities = entities.filter(
      e => e !== EnterpriseAuditEvent && e !== EnterpriseHandoverProposal,
    );
    const before = await snapshot(protectedEntities),
      body = input();
    const created = (await http('post', '', 1, body).expect(201)).body;
    expect(created).toEqual({
      requestId: body.requestId,
      organizationId: 10,
      ownerId: 1,
      recipientId: 2,
      version: 1,
      status: 'pending',
      expiresAt: expect.any(String),
      acceptedAt: null,
      reviewBasis: expect.stringMatching(/^[a-f0-9]{64}$/),
      expired: false,
      detailsAvailable: true,
      assets: [
        { kind: 'dashboard', id: 21, title: 'Dashboard title' },
        { kind: 'source', id: 11, title: 'Source title' },
      ],
    });
    expect(Date.parse(created.expiresAt) - Date.now()).toBeGreaterThan(86300000);
    expect((await http('post', '', 1, body).expect(201)).body).toEqual(created);
    const readBefore = await snapshot();
    expect((await http('get', '/' + body.requestId, 2).expect(200)).body).toEqual(created);
    expect(await snapshot()).toEqual(readBefore);
    const accepted = (
      await http('post', '/' + body.requestId + '/accept', 2, terms(created)).expect(201)
    ).body;
    expect(accepted).toMatchObject({
      status: 'accepted',
      version: 2,
      acceptedAt: expect.any(String),
    });
    expect(
      (await http('post', '/' + body.requestId + '/accept', 2, terms(created)).expect(201)).body,
    ).toEqual(accepted);
    const cancelled = (
      await http('post', '/' + body.requestId + '/cancel', 1, terms(accepted)).expect(201)
    ).body;
    expect(cancelled).toMatchObject({
      status: 'cancelled',
      version: 3,
      acceptedAt: accepted.acceptedAt,
      detailsAvailable: false,
      assets: [],
    });
    expect(
      (await http('post', '/' + body.requestId + '/cancel', 1, terms(accepted)).expect(201)).body,
    ).toEqual(cancelled);
    expect((await http('post', '', 1, body).expect(201)).body).toEqual(cancelled);
    expect(await db.getRepository(EnterpriseAuditEvent).count()).toBe(3);
    expect(await snapshot(protectedEntities)).toEqual(before);
    const stored = await db
      .getRepository(EnterpriseHandoverProposal)
      .findOneByOrFail({ requestId: body.requestId });
    expect(stored.manifestJson).not.toMatch(
      /private-|connectionConfig|expression|structuredDefinition|document/,
    );
    expect(JSON.stringify([created, accepted, cancelled])).not.toMatch(
      /fingerprint|payloadHash|authVersion|private-/,
    );
  });
  it('pages only current active owned candidates with no writes and excludes duplicate mappings and orphans', async () => {
    await db.getRepository(Database).save(
      Array.from({ length: 23 }, (_, i) => ({
        id: 100 + i,
        ownerId: 1,
        catalogActive: i !== 22,
        name: 'x'.repeat(300),
        engine: 'duckdb',
        type: 'file',
        connectionConfig: 'private',
      })),
    );
    await db.getRepository(UserMapping).save([
      { dashboardId: 21, userInfoId: 1 },
      { dashboardId: 999, userInfoId: 1 },
    ]);
    const before = await snapshot();
    const page = (await http('get', '/candidates?kind=source').expect(200)).body;
    expect(page.entries).toHaveLength(20);
    expect(page.nextAfterId).toBe(118);
    expect(page.entries[0]).toEqual({ kind: 'source', id: 11, title: 'Source title' });
    const next = (await http('get', '/candidates?kind=source&afterId=118').expect(200)).body;
    expect(next.entries.map(a => a.id)).toEqual([119, 120, 121]);
    expect(next.nextAfterId).toBeNull();
    expect((await http('get', '/candidates?kind=dashboard').expect(200)).body).toEqual({
      entries: [],
      nextAfterId: null,
    });
    expect(await snapshot()).toEqual(before);
  });
  it('uses the actual JWT guard and exception filter for stale auth and participant isolation', async () => {
    const row = await service.create(1, 0, input()),
      before = await snapshot();
    await request(app.getHttpServer())
      .get('/enterprise/handover/' + row.requestId)
      .expect(401)
      .expect(r => expect(r.body).toMatchObject({ success: false, code: 401 }));
    await http('get', '/candidates?kind=source', 1, undefined, 1).expect(401);
    for (const actor of [3, 4, 5]) await http('get', '/' + row.requestId, actor).expect(403);
    await http('post', '/' + row.requestId + '/accept', 1, terms(row)).expect(403);
    await http('post', '/' + row.requestId + '/cancel', 2, terms(row)).expect(403);
    expect(await snapshot()).toEqual(before);
  });
  it.each([
    { recipientId: 1 },
    { recipientId: 3 },
    { recipientId: 999 },
    { recipientId: '2' },
    { assets: [] },
    { assets: [...selected, selected[0]] },
    { assets: Array(21).fill(selected[0]) },
    { assets: [{ kind: 'metric', id: 31 }] },
    { assets: [{ kind: 'source', id: 12, title: 'Other title' }] },
    { assets: [{ kind: 'source', id: 0 }] },
    { assets: [{ kind: 'source', id: 11, title: 'injected' }] },
    { requestId: 'invalid' },
    { extra: true },
  ])('refuses malformed or unauthorized creation %j without writes', async change => {
    const before = await snapshot();
    const response = await http('post', '', 1, { ...input(), ...change });
    expect([400, 403, 409]).toContain(response.status);
    expect(await snapshot()).toEqual(before);
  });
  it('rejects UUID conflicts, stale review terms and status changes without additional writes', async () => {
    const body = input(),
      row = await service.create(1, 0, body),
      before = await snapshot();
    await http('post', '', 1, { ...body, recipientId: 4 }).expect(409);
    await http('post', '', 2, body).expect(409);
    await http('post', '/' + row.requestId + '/accept', 2, {
      ...terms(row),
      reviewBasis: '0'.repeat(64),
    }).expect(409);
    await http('post', '/' + row.requestId + '/accept', 2, {
      ...terms(row),
      expectedVersion: 2,
    }).expect(409);
    expect(await snapshot()).toEqual(before);
    await service.cancel(row.requestId, 1, 0, terms(row));
    await http('post', '/' + row.requestId + '/accept', 2, terms(row)).expect(409);
  });
  it.each([
    'source',
    'metric',
    'new-metric',
    'dashboard',
    'mapping',
    'studio',
    'source-active',
    'dashboard-active',
    'dashboard-delete',
    'owner',
    'owner-epoch',
    'recipient-epoch',
    'recipient-inactive',
    'owner-moved',
    'org-version',
  ])('rejects changed %s at acceptance and creates no audit', async kind => {
    const body = input(),
      row = await service.create(1, 0, body);
    if (kind === 'source')
      await db.getRepository(Database).update(11, { connectionConfig: 'changed' });
    if (kind === 'metric') await db.getRepository(Metric).update(31, { expression: 'changed' });
    if (kind === 'new-metric')
      await db.getRepository(Metric).save({
        databaseId: 11,
        name: 'new-metric',
        tableName: 'source',
        expression: 'amount',
        aggregation: MetricAggregation.SUM,
      });
    if (kind === 'dashboard') await db.getRepository(Dashboard).update(21, { layout: 'changed' });
    if (kind === 'mapping')
      await db.getRepository(UserMapping).save({ dashboardId: 21, userInfoId: 1 });
    if (kind === 'studio') await db.getRepository(StudioState).update(21, { document: 'changed' });
    if (kind === 'source-active')
      await db.getRepository(Database).update(11, { catalogActive: false });
    if (kind === 'dashboard-active')
      await db.getRepository(Dashboard).update(21, { assetActive: false });
    if (kind === 'dashboard-delete') await db.getRepository(Dashboard).update(21, { delYn: 'Y' });
    if (kind === 'owner') await db.getRepository(Database).update(11, { ownerId: 2 });
    if (kind === 'owner-epoch') await db.getRepository(User).update(1, { authVersion: 1 });
    if (kind === 'recipient-epoch') await db.getRepository(User).update(2, { authVersion: 1 });
    if (kind === 'recipient-inactive') await db.getRepository(User).update(2, { active: false });
    if (kind === 'owner-moved')
      await db.getRepository(EnterpriseMembership).update(1, { organizationId: 20 });
    if (kind === 'org-version')
      await db.getRepository(EnterpriseOrganization).update(10, { version: 2 });
    const before = await snapshot();
    const response = await http('post', '/' + row.requestId + '/accept', 2, terms(row));
    expect([401, 403, 409]).toContain(response.status);
    expect(await snapshot()).toEqual(before);
  });
  it('permits owner cancellation after expiry and metadata change, while expired acceptance cannot write', async () => {
    const row = await service.create(1, 0, input());
    await db
      .getRepository(EnterpriseHandoverProposal)
      .update(row.requestId, { expiresAt: new Date('2020-01-01') });
    const before = await snapshot();
    await http('post', '/' + row.requestId + '/accept', 2, terms(row)).expect(409);
    expect(await snapshot()).toEqual(before);
    expect((await http('get', '/' + row.requestId, 2).expect(200)).body.expired).toBe(true);
    await db.getRepository(Database).update(11, { catalogActive: false });
    expect(
      (await http('post', '/' + row.requestId + '/cancel', 1, terms(row)).expect(201)).body.status,
    ).toBe('cancelled');
  });
  it.each(['create', 'accept', 'cancel'])('rolls back %s when its audit fails', async action => {
    const row = action === 'create' ? null : await service.create(1, 0, input());
    const before = await snapshot(),
      transaction = db.transaction.bind(db);
    (jest.spyOn(db, 'transaction') as any).mockImplementation((first, second) => {
      const run = typeof first === 'function' ? first : second;
      const wrapped = async manager => {
        const insert = manager.insert.bind(manager);
        manager.insert = async (entity, values) => {
          if (entity === EnterpriseAuditEvent) throw new Error('synthetic audit failure');
          return insert(entity, values);
        };
        return run(manager);
      };
      return typeof first === 'function' ? transaction(wrapped) : transaction(first, wrapped);
    });
    const operation =
      action === 'create'
        ? service.create(1, 0, input())
        : action === 'accept'
        ? service.accept(row.requestId, 2, 0, terms(row))
        : service.cancel(row.requestId, 1, 0, terms(row));
    await expect(operation).rejects.toThrow('synthetic audit failure');
    expect(await snapshot()).toEqual(before);
  });
  it('applies an additive migration twice preserving proposals and refuses incompatible existing schema', async () => {
    const runner = db.createQueryRunner(),
      migration = new AddHandoverProposal1792600000000();
    try {
      await runner.dropTable('enterprise_handover_proposal');
      await migration.up(runner);
      await service.create(1, 0, input());
      const before = await snapshot();
      await migration.up(runner);
      expect(await snapshot()).toEqual(before);
      const table = await runner.getTable('enterprise_handover_proposal'),
        column = table.findColumnByName('reviewBasis'),
        changed = column.clone();
      changed.length = '65';
      if (db.options.type === 'mysql')
        await runner.query(
          'ALTER TABLE enterprise_handover_proposal MODIFY COLUMN reviewBasis varchar(65) NOT NULL',
        );
      else await runner.changeColumn(table, column, changed);
      await expect(migration.up(runner)).rejects.toThrow('schema preflight stopped');
      expect(await snapshot()).toEqual(before);
      if (db.options.type === 'mysql')
        await runner.query(
          'ALTER TABLE enterprise_handover_proposal MODIFY COLUMN reviewBasis varchar(64) NOT NULL',
        );
      else await runner.changeColumn('enterprise_handover_proposal', changed, column);
    } finally {
      await runner.release();
    }
  });
  it('binds the exact disclosed title before create and reports unknown UUID as404', async () => {
    const body = input();
    await http('get', '/' + body.requestId).expect(404);
    await db.getRepository(Database).update(11, { name: 'Changed title' });
    const before = await snapshot();
    await http('post', '', 1, body).expect(409);
    expect(await snapshot()).toEqual(before);
    const corrected = { ...body, assets: [{ kind: 'source', id: 11, title: 'Changed title' }] };
    expect((await http('post', '', 1, corrected).expect(201)).body.assets).toEqual(
      corrected.assets,
    );
    await http('post', '', 1, body).expect(409);
  });
  it.each([
    'expired',
    'cancelled',
    'owner-epoch',
    'recipient-epoch',
    'recipient-moved',
    'recipient-inactive',
  ])(
    'redacts titles in historical status after %s while preserving state recovery and current-owner cancellation',
    async kind => {
      const body = input(),
        row = await service.create(1, 0, body);
      if (kind === 'expired')
        await db
          .getRepository(EnterpriseHandoverProposal)
          .update(row.requestId, { expiresAt: new Date('2020-01-01') });
      if (kind === 'cancelled') await service.cancel(row.requestId, 1, 0, terms(row));
      if (kind === 'owner-epoch') await db.getRepository(User).update(1, { authVersion: 1 });
      if (kind === 'recipient-epoch') await db.getRepository(User).update(2, { authVersion: 1 });
      if (kind === 'recipient-moved')
        await db.getRepository(EnterpriseMembership).update(2, { organizationId: 20 });
      if (kind === 'recipient-inactive') await db.getRepository(User).update(2, { active: false });
      const epoch = kind === 'owner-epoch' ? 1 : 0,
        before = await snapshot();
      const detail = (await http('get', '/' + row.requestId, 1, undefined, epoch).expect(200)).body;
      expect(detail).toMatchObject({
        requestId: row.requestId,
        detailsAvailable: false,
        assets: [],
      });
      expect((await http('post', '', 1, body, epoch).expect(201)).body).toEqual(detail);
      expect(await snapshot()).toEqual(before);
      if (kind !== 'cancelled')
        await http('post', '/' + row.requestId + '/cancel', 1, terms(row), epoch).expect(201);
    },
  );
  it('acknowledges lost acceptance responses after metadata edits, expiry and later cancellation without reapproval', async () => {
    const body = input(),
      row = await service.create(1, 0, body);
    const accepted = await service.accept(row.requestId, 2, 0, terms(row));
    await db.getRepository(Metric).update(31, { expression: 'later-definition' });
    await db
      .getRepository(EnterpriseHandoverProposal)
      .update(row.requestId, { expiresAt: new Date('2020-01-01') });
    let before = await snapshot();
    const retry = (await http('post', '/' + row.requestId + '/accept', 2, terms(row)).expect(201))
      .body;
    expect(retry).toMatchObject({
      status: 'accepted',
      version: 2,
      acceptedAt: accepted.acceptedAt,
      expired: true,
      detailsAvailable: false,
      assets: [],
    });
    expect((await http('post', '', 1, body).expect(201)).body).toEqual(retry);
    expect(await snapshot()).toEqual(before);
    const cancelled = await service.cancel(row.requestId, 1, 0, terms(accepted));
    before = await snapshot();
    expect(
      (await http('post', '/' + row.requestId + '/accept', 2, terms(row)).expect(201)).body,
    ).toEqual(cancelled);
    expect(await snapshot()).toEqual(before);
    expect(cancelled.acceptedAt).toBe(accepted.acceptedAt);
    await http('post', '/' + row.requestId + '/accept', 2, {
      ...terms(row),
      expectedVersion: 2,
    }).expect(409);
  });
  it('recovers create after metadata edits as the original historical manifest without additional consent', async () => {
    const body = input(),
      row = await service.create(1, 0, body);
    await db
      .getRepository(Database)
      .update(11, { name: 'Later title', connectionConfig: 'later-private' });
    const before = await snapshot();
    expect((await http('post', '', 1, body).expect(201)).body).toEqual(row);
    expect(await snapshot()).toEqual(before);
  });
  // Real mutation injected after the read's work, before MySQL COMMIT (or just after
  // SQLite COMMIT). Fresh reads must use a completed snapshot's live authority/state.
  function afterSnapshot(change: (writer: DataSource) => Promise<unknown>) {
    const transaction = db.transaction.bind(db);
    let injected = false;
    (jest.spyOn(db, 'transaction') as any).mockImplementation((first, second) => {
      const run = typeof first === 'function' ? first : second;
      const wrapped = async manager => {
        const result = await run(manager);
        if (!injected && db.options.type === 'mysql') {
          injected = true;
          const peer = await new DataSource({ ...db.options }).initialize();
          try {
            await change(peer);
          } finally {
            await peer.destroy();
          }
        }
        return result;
      };
      const pending =
        typeof first === 'function' ? transaction(wrapped) : transaction(first, wrapped);
      return pending.then(async result => {
        if (!injected && db.options.type !== 'mysql') {
          injected = true;
          await change(db);
        }
        return result;
      });
    });
  }
  it.each(['cancel', 'epoch', 'recipient-epoch', 'actor-org', 'org-version'])(
    'never returns titles from a stale GET snapshot after committed %s',
    async kind => {
      const row = await service.create(1, 0, input());
      afterSnapshot(async writer => {
        if (kind === 'cancel')
          await new HandoverProposalService(writer).cancel(row.requestId, 1, 0, terms(row));
        if (kind === 'epoch') await writer.getRepository(User).update(2, { authVersion: 1 });
        if (kind === 'recipient-epoch')
          await writer.getRepository(User).update(1, { authVersion: 1 });
        if (kind === 'actor-org')
          await writer.getRepository(EnterpriseMembership).update(2, { organizationId: 20 });
        if (kind === 'org-version')
          await writer.getRepository(EnterpriseOrganization).update(10, { version: 2 });
      });
      const result = await http('get', '/' + row.requestId, 2).expect(
        kind === 'epoch' ? 401 : kind === 'actor-org' ? 403 : 409,
      );
      expect(JSON.stringify(result.body)).not.toMatch(/Source title|Dashboard title/);
    },
  );
  it('protects candidate GET from a revoked epoch after snapshot', async () => {
    afterSnapshot(writer => writer.getRepository(User).update(1, { authVersion: 1 }));
    const result = await http('get', '/candidates?kind=source').expect(401);
    expect(result.body).not.toHaveProperty('entries');
  });
  const mysqlIt = process.env.VM_SEMANTIC_MYSQL_CONFIG ? it : it.skip;
  const waitForBlockedTable = async (blocker: number, table: string) => {
    const end = Date.now() + 6000;
    while (Date.now() < end) {
      const waits = await db.query(
        `SELECT l.OBJECT_NAME AS tableName FROM performance_schema.data_lock_waits w
        JOIN performance_schema.threads t ON t.THREAD_ID = w.BLOCKING_THREAD_ID
        JOIN performance_schema.data_locks l ON l.ENGINE_LOCK_ID = w.REQUESTING_ENGINE_LOCK_ID
        WHERE t.PROCESSLIST_ID = ?`,
        [blocker],
      );
      if (waits.some(row => row.tableName === table)) return;
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    throw new Error('Expected independent writer parent lock wait on ' + table);
  };
  mysqlIt.each(['source', 'dashboard'])(
    'waits for an earlier %s parent writer then rejects its committed metadata instead of accepting a stale manifest',
    async kind => {
      const row = await service.create(1, 0, input());
      const peer = await new DataSource({ ...db.options }).initialize(),
        runner = peer.createQueryRunner();
      let settling: Promise<any>;
      try {
        await runner.startTransaction('READ COMMITTED');
        const [connection] = await runner.query('SELECT CONNECTION_ID() AS id');
        if (kind === 'source') {
          await lockMetricSources(runner.manager, [11]);
          await runner.manager.update(Metric, 31, { expression: 'concurrent-expression' });
        } else {
          await lockDashboardWrite(runner.manager, 21);
          await runner.manager.update(StudioState, 21, { document: 'concurrent-document' });
        }
        settling = service.accept(row.requestId, 2, 0, terms(row)).then(
          () => 201,
          error => error.status,
        );
        await waitForBlockedTable(
          Number(connection.id),
          kind === 'source' ? 'database' : 'dashboard',
        );
        await runner.commitTransaction();
        expect(await settling).toBe(409);
        expect(
          (
            await db
              .getRepository(EnterpriseHandoverProposal)
              .findOneByOrFail({ requestId: row.requestId })
          ).status,
        ).toBe('pending');
        expect(await db.getRepository(EnterpriseAuditEvent).count()).toBe(1);
      } finally {
        if (runner.isTransactionActive) await runner.rollbackTransaction();
        await settling;
        await runner.release();
        await peer.destroy();
      }
    },
  );
  mysqlIt(
    'serializes simultaneous accept and cancel with one CAS winner and one conflict',
    async () => {
      const row = await service.create(1, 0, input()),
        peer = await new DataSource({ ...db.options }).initialize();
      try {
        const results = await Promise.allSettled([
          service.accept(row.requestId, 2, 0, terms(row)),
          new HandoverProposalService(peer).cancel(row.requestId, 1, 0, terms(row)),
        ]);
        expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
        expect(
          (results.find(r => r.status === 'rejected') as PromiseRejectedResult).reason.status,
        ).toBe(409);
        expect(await db.getRepository(EnterpriseAuditEvent).count()).toBe(2);
      } finally {
        await peer.destroy();
      }
    },
  );
  mysqlIt('serializes identical UUID creation into one proposal and one audit', async () => {
    const body = input(),
      peer = await new DataSource({ ...db.options }).initialize();
    try {
      const results = await Promise.all([
        service.create(1, 0, body),
        new HandoverProposalService(peer).create(1, 0, body),
      ]);
      expect(results[0]).toEqual(results[1]);
      expect(await db.getRepository(EnterpriseHandoverProposal).count()).toBe(1);
      expect(await db.getRepository(EnterpriseAuditEvent).count()).toBe(1);
    } finally {
      await peer.destroy();
    }
  });
  mysqlIt(
    'holds selected Dashboard and Source parents through consent commit before a coordinated writer can change children',
    async () => {
      const row = await service.create(1, 0, input()),
        transaction = db.transaction.bind(db);
      let enter: () => void, release: () => void, blocker: number;
      const entered = new Promise<void>(resolve => {
        enter = resolve;
      });
      const released = new Promise<void>(resolve => {
        release = resolve;
      });
      (jest.spyOn(db, 'transaction') as any).mockImplementation((isolation, run) =>
        transaction(isolation, async manager => {
          const insert = manager.insert.bind(manager);
          manager.insert = async (entity, values) => {
            if (entity === EnterpriseAuditEvent && values.action === 'handover.accepted') {
              const [connection] = await manager.query('SELECT CONNECTION_ID() AS id');
              blocker = Number(connection.id);
              enter();
              await released;
            }
            return insert(entity, values);
          };
          return run(manager);
        }),
      );
      const accepting = service.accept(row.requestId, 2, 0, terms(row));
      const settled = accepting.catch(error => error);
      await entered;
      const peer = await new DataSource({ ...db.options }).initialize();
      let writing: Promise<unknown>;
      try {
        writing = peer.transaction('READ COMMITTED', async manager => {
          await lockDashboardWrite(manager, 21);
          await lockMetricSources(manager, [11]);
          await manager.update(Metric, 31, { expression: 'after-consent' });
          await manager.update(StudioState, 21, { document: 'after-consent' });
        });
        await waitForBlockedTable(blocker, 'dashboard');
      } finally {
        release();
        await settled;
      }
      try {
        expect((await accepting).status).toBe('accepted');
        await writing;
        expect((await peer.getRepository(Metric).findOneByOrFail({ id: 31 })).expression).toBe(
          'after-consent',
        );
        expect(await db.getRepository(EnterpriseAuditEvent).count()).toBe(2);
      } finally {
        await peer.destroy();
      }
    },
  );
  it('correlates two same-party UUIDs with six distinct exact audit events without exposing links or writing on replay', async () => {
    const first = input(),
      second = input();
    const initial = [await service.create(1, 0, first), await service.create(1, 0, second)];
    const accepted = [];
    for (const row of initial) accepted.push(await service.accept(row.requestId, 2, 0, terms(row)));
    for (const row of accepted) await service.cancel(row.requestId, 1, 0, terms(row));
    const rows = await db
      .getRepository(EnterpriseHandoverProposal)
      .find({ order: { requestId: 'ASC' } });
    const eventIds = [];
    for (const row of rows) {
      for (const [action, id, version, actor] of [
        ['created', row.createdAuditId, 1, 1],
        ['accepted', row.acceptedAuditId, 2, 2],
        ['cancelled', row.cancelledAuditId, 3, 1],
      ] as const) {
        expect(Number.isSafeInteger(id)).toBe(true);
        eventIds.push(id);
        expect(await db.getRepository(EnterpriseAuditEvent).findOneByOrFail({ id })).toMatchObject({
          action: 'handover.' + action,
          organizationId: row.organizationId,
          resourceId: row.ownerId,
          subjectId: row.recipientId,
          version,
          actorId: actor,
        });
      }
    }
    expect(new Set(eventIds).size).toBe(6);
    const before = await snapshot();
    for (const body of [first, second]) {
      const result = (await http('post', '', 1, body).expect(201)).body;
      expect(JSON.stringify(result)).not.toMatch(/AuditId|fingerprint|payloadHash/);
      expect((await http('get', '/' + body.requestId, 2).expect(200)).body).toEqual(result);
      expect(
        (
          await http(
            'post',
            '/' + body.requestId + '/accept',
            2,
            terms(initial.find(r => r.requestId === body.requestId)),
          ).expect(201)
        ).body,
      ).toEqual(result);
      expect(
        (
          await http(
            'post',
            '/' + body.requestId + '/cancel',
            1,
            terms(accepted.find(r => r.requestId === body.requestId)),
          ).expect(201)
        ).body,
      ).toEqual(result);
    }
    expect(await snapshot()).toEqual(before);
  });
  it.each(['create', 'accept', 'cancel'])(
    'rolls back the exact inserted audit and proposal link after a late %s persistence failure',
    async action => {
      const initial = action === 'create' ? null : await service.create(1, 0, input());
      const before = await snapshot(),
        transaction = db.transaction.bind(db);
      let provedLink = false;
      (jest.spyOn(db, 'transaction') as any).mockImplementation((first, second) => {
        const run = typeof first === 'function' ? first : second;
        const wrapped = async manager => {
          const prove = async (requestId: string) => {
            const row = await manager.findOneByOrFail(EnterpriseHandoverProposal, { requestId });
            const link =
              action === 'create'
                ? row.createdAuditId
                : action === 'accept'
                ? row.acceptedAuditId
                : row.cancelledAuditId;
            expect(link).toBeGreaterThan(0);
            expect((await manager.findOneByOrFail(EnterpriseAuditEvent, { id: link })).action).toBe(
              'handover.' +
                (action === 'create' ? 'created' : action === 'accept' ? 'accepted' : 'cancelled'),
            );
            provedLink = true;
            throw new Error('synthetic late proposal failure');
          };
          const insert = manager.insert.bind(manager),
            update = manager.update.bind(manager);
          manager.insert = async (entity, values) => {
            const result = await insert(entity, values);
            if (entity === EnterpriseHandoverProposal && action === 'create')
              await prove(values.requestId);
            return result;
          };
          manager.update = async (entity, criteria, values) => {
            const result = await update(entity, criteria, values);
            if (entity === EnterpriseHandoverProposal && action !== 'create')
              await prove(criteria.requestId);
            return result;
          };
          return run(manager);
        };
        return typeof first === 'function' ? transaction(wrapped) : transaction(first, wrapped);
      });
      const operation =
        action === 'create'
          ? service.create(1, 0, input())
          : action === 'accept'
          ? service.accept(initial.requestId, 2, 0, terms(initial))
          : service.cancel(initial.requestId, 1, 0, terms(initial));
      await expect(operation).rejects.toThrow('synthetic late proposal failure');
      expect(provedLink).toBe(true);
      expect(await snapshot()).toEqual(before);
    },
  );
  it('rejects incorrect audit-link nullability without changing preserved proposals or audits', async () => {
    await service.create(1, 0, input());
    const runner = db.createQueryRunner(),
      migration = new AddHandoverProposal1792600000000();
    const table = await runner.getTable('enterprise_handover_proposal');
    const column = table.findColumnByName('createdAuditId'),
      changed = column.clone();
    changed.isNullable = true;
    try {
      if (db.options.type === 'mysql')
        await runner.query(
          'ALTER TABLE enterprise_handover_proposal MODIFY COLUMN createdAuditId integer NULL',
        );
      else await runner.changeColumn(table, column, changed);
      const before = await snapshot();
      await expect(migration.up(runner)).rejects.toThrow('schema preflight stopped');
      expect(await snapshot()).toEqual(before);
    } finally {
      if (db.options.type === 'mysql')
        await runner.query(
          'ALTER TABLE enterprise_handover_proposal MODIFY COLUMN createdAuditId integer NOT NULL',
        );
      else await runner.changeColumn('enterprise_handover_proposal', changed, column);
      await runner.release();
    }
  });
  async function acceptedReview(prepare?: () => Promise<unknown>, assets = selected) {
    await db
      .getRepository(Dashboard)
      .update(21, { analysisDefinition: null, structuredDefinition: null, pivotDefinitions: null });
    await db.getRepository(StudioState).delete(21);
    if (prepare) await prepare();
    const row = await service.create(1, 0, { ...input(), assets });
    return service.accept(row.requestId, 2, 0, terms(row));
  }
  it('reviews accepted selected assets with an exact counts-only contract and no DB/audit writes', async () => {
    const row = await acceptedReview(async () => {
      await db
        .getRepository(Dashboard)
        .update(21, { analysisDefinition: JSON.stringify({ databaseId: 11 }) });
      await db.getRepository(Metric).update(31, { useYn: 'N' });
    });
    const before = await snapshot();
    const result = (await http('get', '/' + row.requestId + '/dependencies').expect(200)).body;
    expect(result).toEqual({
      requestId: row.requestId,
      organizationId: 10,
      ownerId: 1,
      recipientId: 2,
      proposalVersion: 2,
      checkedAt: expect.any(String),
      scope: 'selected_dependencies_v1',
      executionAvailable: false,
      assets: [
        {
          kind: 'dashboard',
          id: 21,
          title: 'Dashboard title',
          dependencyStatus: 'covered',
          requiredSources: 1,
          selectedSources: 1,
          missingOwnedSources: 0,
          otherSources: 0,
          metricCount: 0,
          storage: 'not_applicable',
        },
        {
          kind: 'source',
          id: 11,
          title: 'Source title',
          dependencyStatus: 'covered',
          requiredSources: 0,
          selectedSources: 0,
          missingOwnedSources: 0,
          otherSources: 0,
          metricCount: 1,
          storage: 'file_review_required',
        },
      ],
    });
    expect(Number.isFinite(Date.parse(result.checkedAt))).toBe(true);
    expect(await snapshot()).toEqual(before);
    expect(JSON.stringify(result)).not.toMatch(
      /private|fingerprint|reviewBasis|connectionConfig|authVersion|AuditId/,
    );
  });
  it.each(['analysis', 'structured', 'pivot', 'studio', 'dataset-widget', 'table-widget'])(
    'collects declared %s connections and deduplicates repeated source IDs',
    async form => {
      const row = await acceptedReview(async () => {
        if (form === 'analysis')
          await db
            .getRepository(Dashboard)
            .update(21, { analysisDefinition: JSON.stringify({ databaseId: 11 }) });
        if (form === 'structured')
          await db
            .getRepository(Dashboard)
            .update(21, { structuredDefinition: JSON.stringify({ sourceId: 11 }) });
        if (form === 'pivot')
          await db
            .getRepository(Dashboard)
            .update(21, { pivotDefinitions: JSON.stringify([{ sourceId: 11 }, { sourceId: 11 }]) });
        if (form === 'studio')
          await db.getRepository(StudioState).save({
            dashboardId: 21,
            document: JSON.stringify({ document: { sourceId: 11 } }),
            legacyRevision: 'synthetic',
          });
        if (form.endsWith('widget')) {
          const entity = form === 'dataset-widget' ? Dataset : TableQuery;
          await db
            .getRepository(entity as any)
            .save({ id: 51, databaseId: 11, query: 'private-sql' });
          await db.getRepository(Widget).save({
            id: 61,
            componentId: 1,
            datasetType: form === 'dataset-widget' ? DatasetType.DATASET : DatasetType.TABLE,
            datasetId: 51,
            option: 'private-widget-settings',
          });
          await db.getRepository(DashboardWidget).save([
            { dashboardId: 21, widgetId: 61 },
            { dashboardId: 21, widgetId: 61 },
          ]);
        }
      });
      const before = await snapshot();
      const result = (await http('get', '/' + row.requestId + '/dependencies').expect(200)).body;
      expect(result.assets[0]).toMatchObject({
        dependencyStatus: 'covered',
        requiredSources: 1,
        selectedSources: 1,
      });
      expect(await snapshot()).toEqual(before);
    },
  );
  it('counts distinct selected, missing owned, other and legacy sources without disclosing unselected IDs or content', async () => {
    const row = await acceptedReview(async () => {
      await db.getRepository(Database).save(
        [81, 82, 83].map(id => ({
          id,
          ownerId: id === 81 ? 1 : id === 82 ? 2 : null,
          name: 'private-hidden-source',
          engine: 'duckdb',
          type: 'file',
          connectionConfig: 'private-hidden-path',
        })),
      );
      await db.getRepository(Dashboard).update(21, {
        analysisDefinition: JSON.stringify({ databaseId: 11 }),
        structuredDefinition: JSON.stringify({ sourceId: 81 }),
        pivotDefinitions: JSON.stringify([{ sourceId: 81 }, { sourceId: 82 }, { sourceId: 83 }]),
      });
    });
    const before = await snapshot();
    const result = (await http('get', '/' + row.requestId + '/dependencies').expect(200)).body;
    expect(result.assets[0]).toMatchObject({
      dependencyStatus: 'missing',
      requiredSources: 4,
      selectedSources: 1,
      missingOwnedSources: 1,
      otherSources: 2,
    });
    expect(JSON.stringify(result.assets)).not.toMatch(/81|82|83|private-hidden/);
    expect(await snapshot()).toEqual(before);
  });
  it.each([
    'bad-json',
    'bad-shape',
    'missing-ref',
    'bad-pivot',
    'bad-studio',
    'missing-widget',
    'unknown-widget',
    'missing-dataset',
    'bad-source-id',
    'missing-source',
    'inactive-source',
  ])(
    'reports %s as unresolved without hiding the invalid linkage or exposing its data',
    async kind => {
      const row = await acceptedReview(async () => {
        if (kind === 'bad-json')
          await db
            .getRepository(Dashboard)
            .update(21, { analysisDefinition: 'private-invalid-json' });
        if (kind === 'bad-shape')
          await db.getRepository(Dashboard).update(21, { structuredDefinition: '[]' });
        if (kind === 'missing-ref')
          await db.getRepository(Dashboard).update(21, { structuredDefinition: '{}' });
        if (kind === 'bad-pivot')
          await db.getRepository(Dashboard).update(21, { pivotDefinitions: '{}' });
        if (kind === 'bad-studio')
          await db
            .getRepository(StudioState)
            .save({ dashboardId: 21, document: '{}', legacyRevision: 'synthetic' });
        if (kind === 'bad-source-id')
          await db
            .getRepository(Dashboard)
            .update(21, { analysisDefinition: '{"databaseId":"11"}' });
        if (kind === 'missing-source')
          await db
            .getRepository(Dashboard)
            .update(21, { analysisDefinition: '{"databaseId":9876}' });
        if (kind === 'inactive-source') {
          await db.getRepository(Database).update(12, { catalogActive: false });
          await db.getRepository(Dashboard).update(21, { analysisDefinition: '{"databaseId":12}' });
        }
        if (['missing-widget', 'unknown-widget', 'missing-dataset'].includes(kind)) {
          await db.getRepository(DashboardWidget).save({ dashboardId: 21, widgetId: 61 });
          if (kind !== 'missing-widget')
            await db.getRepository(Widget).save({
              id: 61,
              componentId: 1,
              datasetType:
                kind === 'unknown-widget' ? ('UNSUPPORTED' as DatasetType) : DatasetType.DATASET,
              datasetId: 9876,
              option: 'private-option',
            });
        }
      });
      const before = await snapshot();
      const result = (await http('get', '/' + row.requestId + '/dependencies').expect(200)).body;
      expect(result.assets[0].dependencyStatus).toBe('unresolved');
      expect(JSON.stringify(result.assets)).not.toMatch(/9876|private-invalid|private-option/);
      expect(await snapshot()).toEqual(before);
    },
  );
  it('reports an empty dashboard as zero connections', async () => {
    const row = await acceptedReview();
    const result = (await http('get', '/' + row.requestId + '/dependencies').expect(200)).body;
    expect(result.assets[0]).toMatchObject({
      dependencyStatus: 'covered',
      requiredSources: 0,
      selectedSources: 0,
      storage: 'not_applicable',
    });
  });
  it.each([
    ['duckdb', 'file_review_required'],
    ['sqlite3', 'file_review_required'],
    ['mysql2', 'connection_review_required'],
    [' MYSQL ', 'connection_review_required'],
    ['postgres', 'connection_review_required'],
    ['postgresql', 'connection_review_required'],
    ['athena', 'unresolved'],
    ['pg', 'connection_review_required'],
    ['unknown', 'unresolved'],
  ])(
    'classifies %s storage without reading file paths or external connections',
    async (engine, storage) => {
      const row = await acceptedReview(() => db.getRepository(Database).update(11, { engine }));
      const result = (await http('get', '/' + row.requestId + '/dependencies').expect(200)).body;
      expect(result.assets[1].storage).toBe(storage);
      expect(result.executionAvailable).toBe(false);
      expect(JSON.stringify(result)).not.toMatch(/private-path|connectionConfig/);
    },
  );
  it('protects dependency HTTP with the actual JWT/filter and restricts it to the active current owner', async () => {
    const row = await acceptedReview(),
      path = '/' + row.requestId + '/dependencies',
      before = await snapshot();
    await request(app.getHttpServer())
      .get('/enterprise/handover' + path)
      .expect(401);
    for (const actor of [2, 3, 4, 5]) await http('get', path, actor).expect(403);
    await http('get', path, 1, undefined, 1).expect(401);
    await http('get', '/' + randomUUID() + '/dependencies').expect(404);
    expect(await snapshot()).toEqual(before);
  });
  it.each([
    'pending',
    'expired',
    'cancelled',
    'owner-epoch',
    'recipient-epoch',
    'recipient-inactive',
    'recipient-moved',
    'org-version',
    'source',
    'metric',
    'dashboard',
    'mapping',
    'studio',
  ])('rejects %s review basis with409 and no read-side writes', async kind => {
    const row = await acceptedReview();
    if (kind === 'pending')
      await db
        .getRepository(EnterpriseHandoverProposal)
        .update(row.requestId, { status: 'pending' });
    if (kind === 'expired')
      await db
        .getRepository(EnterpriseHandoverProposal)
        .update(row.requestId, { expiresAt: new Date('2020-01-01') });
    if (kind === 'cancelled') await service.cancel(row.requestId, 1, 0, terms(row));
    if (kind === 'owner-epoch') await db.getRepository(User).update(1, { authVersion: 1 });
    if (kind === 'recipient-epoch') await db.getRepository(User).update(2, { authVersion: 1 });
    if (kind === 'recipient-inactive') await db.getRepository(User).update(2, { active: false });
    if (kind === 'recipient-moved')
      await db.getRepository(EnterpriseMembership).update(2, { organizationId: 20 });
    if (kind === 'org-version')
      await db.getRepository(EnterpriseOrganization).update(10, { version: 2 });
    if (kind === 'source') await db.getRepository(Database).update(11, { name: 'changed' });
    if (kind === 'metric') await db.getRepository(Metric).update(31, { expression: 'changed' });
    if (kind === 'dashboard') await db.getRepository(Dashboard).update(21, { title: 'changed' });
    if (kind === 'mapping')
      await db.getRepository(UserMapping).save({ dashboardId: 21, userInfoId: 1 });
    if (kind === 'studio')
      await db
        .getRepository(StudioState)
        .save({ dashboardId: 21, document: '{}', legacyRevision: 'changed' });
    const before = await snapshot();
    const result = await http(
      'get',
      '/' + row.requestId + '/dependencies',
      1,
      undefined,
      kind === 'owner-epoch' ? 1 : 0,
    ).expect(409);
    expect(result.body).toMatchObject({ success: false, code: 409 });
    expect(result.body).not.toHaveProperty('assets');
    expect(await snapshot()).toEqual(before);
  });
  it.each(['cancel', 'recipient-epoch', 'org-version'])(
    'does not return a review from a snapshot invalidated by committed %s',
    async kind => {
      const row = await acceptedReview();
      afterSnapshot(async writer => {
        if (kind === 'cancel')
          await new HandoverProposalService(writer).cancel(row.requestId, 1, 0, terms(row));
        if (kind === 'recipient-epoch')
          await writer.getRepository(User).update(2, { authVersion: 1 });
        if (kind === 'org-version')
          await writer.getRepository(EnterpriseOrganization).update(10, { version: 2 });
      });
      const result = await http('get', '/' + row.requestId + '/dependencies').expect(409);
      expect(JSON.stringify(result.body)).not.toMatch(/Source title|Dashboard title/);
    },
  );
  it('uses only non-locking SELECTs for dependency review and preserves every fixture row', async () => {
    const row = await acceptedReview(),
      before = await snapshot();
    const create = db.createQueryRunner.bind(db),
      seen = new WeakSet(),
      statements: string[] = [];
    jest.spyOn(db, 'createQueryRunner').mockImplementation(mode => {
      const runner = create(mode);
      if (!seen.has(runner)) {
        seen.add(runner);
        const query = runner.query.bind(runner);
        (jest.spyOn(runner, 'query') as any).mockImplementation((...args) => {
          statements.push(String(args[0]));
          return query(...args);
        });
      }
      return runner;
    });
    await http('get', '/' + row.requestId + '/dependencies').expect(200);
    expect(statements.some(sql => /^SELECT/i.test(sql.trim()))).toBe(true);
    expect(
      statements.filter(sql =>
        /\b(INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\b|LOCK IN SHARE MODE/i.test(sql),
      ),
    ).toEqual([]);
    expect(await snapshot()).toEqual(before);
  });
  it('rechecks expiry after the dependency snapshot without returning a partial or extra response shape', async () => {
    const row = await acceptedReview();
    const expiry = Date.parse(row.expiresAt);
    afterSnapshot(async () => {
      jest.spyOn(Date, 'now').mockReturnValue(expiry + 1);
    });
    const response = await http('get', '/' + row.requestId + '/dependencies').expect(409);
    expect(response.body).not.toHaveProperty('assets');
    expect(response.body).not.toHaveProperty('expired');
  });
});
