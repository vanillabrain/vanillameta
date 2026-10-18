import { EnterpriseDashboardDelivery } from '../enterprise/entities/enterprise-dashboard-delivery.entity';
jest.mock('../ai/ai.service', () => ({ AiService: class {} }));
import { DuckDBConnection, DuckDBInstance } from '@duckdb/node-api';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request = require('supertest');
import { DataSource } from 'typeorm';
import { Database } from '../database/entities/database.entity';
import { User } from '../user/entities/user.entity';
import { EnterpriseMembership } from '../enterprise/entities/enterprise-membership.entity';
import { EnterpriseResourceGrant } from '../enterprise/entities/enterprise-resource-grant.entity';
import { EnterpriseResourcePolicyService } from '../enterprise/resource-policy.service';
import { SourceAccessService } from '../ownership/source-access.service';
import { SourceConditionEntry } from './entities/source-condition-entry.entity';
import { SourceConditionsService } from './source-conditions.service';
import { SourceConditionsController } from './source-conditions.controller';

import { ConnectionService } from '../connection/connection.service';

/** Real JWT + SQLite policy/CAS + DuckDB execution; no external data or LLM. */
describe('UC052 protected conditions HTTP and independent population oracle', () => {
  let app: INestApplication,
    db: DataSource,
    duck: DuckDBConnection,
    instance: DuckDBInstance,
    query: jest.Mock;
  const jwt = new JwtService();
  const previous = process.env.ACCESS_SECRET;
  const rows = [
    { amount: 5, channel: 'Site', flag: false },
    { amount: 10, channel: 'Site', flag: false },
    { amount: 20, channel: 'Ads', flag: false },
    { amount: 30, channel: null, flag: false },
    { amount: 40, channel: 'Site', flag: true },
    { amount: null, channel: 'Site', flag: false },
    { amount: 50, channel: 'Site', flag: null },
    { amount: 60, channel: 'Other', flag: true },
  ];
  const predicate = (column: string, operator: string, values?: any[]) => ({
    kind: 'predicate',
    column,
    operator,
    ...(values ? { values } : {}),
  });
  const definition = {
    include: {
      kind: 'group',
      operator: 'and',
      children: [
        predicate('amount', 'gte', [10]),
        {
          kind: 'group',
          operator: 'or',
          children: [predicate('channel', 'eq', ['Site']), predicate('channel', 'isNull')],
        },
      ],
    },
    exclude: predicate('flag', 'eq', [true]),
  };
  const call = (route: string, actor: number, body: object) =>
    request(app.getHttpServer())
      .post('/bi/source-conditions/' + route)
      .set(
        'Authorization',
        'Bearer ' +
          jwt.sign(
            { accessKeyData: { id: actor, userId: 'qa-' + actor, authVersion: 0 } },
            { secret: process.env.ACCESS_SECRET },
          ),
      )
      .send(body);
  beforeAll(async () => {
    process.env.ACCESS_SECRET = 'synthetic-condition-http-secret';
    db = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      synchronize: true,
      entities: [
        Database,
        User,
        EnterpriseMembership,
        EnterpriseResourceGrant,
        EnterpriseDashboardDelivery,
        SourceConditionEntry,
      ],
    }).initialize();
    const users = db.getRepository(User);
    await users.save(
      [7, 8, 9].map(id => ({
        id,
        userId: 'qa-' + id,
        email: 'qa-' + id + '@example.invalid',
        password: 'not-used',
        active: true,
      })),
    );
    const memberships = db.getRepository(EnterpriseMembership);
    await memberships.save(
      [7, 8, 9].map(userId => ({
        userId,
        organizationId: userId === 9 ? 2 : 1,
        role: userId === 7 ? ('admin' as const) : ('member' as const),
        team: '',
      })),
    );
    await db.getRepository(Database).save({
      id: 3,
      name: 'Synthetic',
      ownerId: 7,
      engine: 'duckdb',
      type: 'FILE',
      connectionConfig: '{}',
    });
    await db.getRepository(EnterpriseResourceGrant).save({
      resourceKind: 'source',
      resourceId: 3,
      recipientId: 8,
      organizationId: 1,
      ownerId: 7,
      read: true,
      edit: false,
      publish: false,
      export: false,
      version: 1,
    });
    instance = await DuckDBInstance.create(':memory:');
    duck = await instance.connect();
    await duck.run('CREATE TABLE uploaded_data (amount DOUBLE, channel VARCHAR, flag BOOLEAN)');
    for (const row of rows)
      await duck.run('INSERT INTO uploaded_data VALUES (?, ?, ?)', [
        row.amount,
        row.channel,
        row.flag,
      ]);
    query = jest.fn(async (_id, sql, bindings = []) => ({
      datas: (await duck.runAndReadAll(sql, bindings)).getRowObjectsJson(),
    }));
    const connection: any = {
      queryDuckDB: query,
      captureDuckDBSnapshot: async () => ({ run: async run => run() }),
      duckDBVersion: async () => 'synthetic-file-v1',
    };
    const access = new SourceAccessService(db, new EnterpriseResourcePolicyService(db));
    const module = await Test.createTestingModule({
      controllers: [SourceConditionsController],
      providers: [
        SourceConditionsService,
        { provide: DataSource, useValue: db },
        { provide: SourceAccessService, useValue: access },
        { provide: ConnectionService, useValue: connection },
        { provide: JwtService, useValue: jwt },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
    await app.listen(0, '127.0.0.1');
  });
  afterAll(async () => {
    await app?.close();
    duck?.closeSync();
    instance?.closeSync();
    await db?.destroy();
    if (previous === undefined) delete process.env.ACCESS_SECRET;
    else process.env.ACCESS_SECRET = previous;
  });
  const draft = async (actor = 7) => {
    const read = (await call('read', actor, { sourceId: 3 }).expect(201)).body.data;
    return { sourceId: 3, sourceRevision: read.sourceRevision, version: read.version, definition };
  };
  it('matches nested include/exclude independent JS counts, then save/reload with unchanged rows', async () => {
    const input = await draft();
    const included = rows.filter(
      r => r.amount !== null && r.amount >= 10 && (r.channel === 'Site' || r.channel === null),
    );
    const remaining = included.filter(r => r.flag !== true);
    const preview = (await call('preview', 7, input).expect(201)).body.data;
    expect(preview.population).toEqual({
      total: String(rows.length),
      matched: String(included.length),
      excluded: String(included.length - remaining.length),
      remaining: String(remaining.length),
      matchedRatio: included.length / rows.length,
      remainingRatio: remaining.length / rows.length,
    });
    expect(await db.getRepository(SourceConditionEntry).count()).toBe(0);
    await call('save', 7, preview.draft).expect(201);
    const saved = (await call('read', 7, { sourceId: 3 }).expect(201)).body.data;
    expect(saved).toMatchObject({ version: 1, definition });
    await call('save', 7, input).expect(409);
    expect(await db.getRepository(SourceConditionEntry).count()).toBe(1);
    expect(
      (await duck.runAndReadAll('SELECT COUNT(*) n FROM uploaded_data')).getRowObjectsJson()[0].n,
    ).toBe('8');
  });
  it('rejects anonymous, cross-organization and inactive source before any analysis query', async () => {
    const input = await draft();
    query.mockClear();
    await request(app.getHttpServer())
      .post('/bi/source-conditions/preview')
      .send(input)
      .expect(401);
    await call('preview', 9, input).expect(403);
    await call('profile', 9, { ...input, columns: ['amount'] }).expect(403);
    await request(app.getHttpServer())
      .post('/bi/source-conditions/profile')
      .send({ ...input, columns: ['amount'] })
      .expect(401);
    expect(query).not.toHaveBeenCalled();
    await db.getRepository(Database).update(3, { catalogActive: false });
    await call('read', 7, { sourceId: 3 }).expect(403);
    await db.getRepository(Database).update(3, { catalogActive: true });
  });
  it('allows current read grant preview but not saving, and honors grant revocation', async () => {
    const input = await draft(8);
    await call('preview', 8, input).expect(201);
    const profile = (await call('profile', 8, { ...input, columns: ['amount'] }).expect(201)).body
      .data;
    expect(profile.population).toMatchObject({
      total: '8',
      matched: '4',
      excluded: '1',
      remaining: '3',
    });
    expect(profile.sample.columns.map(c => c.name)).toEqual(['amount']);
    expect(profile.sample.rows.map(r => Number(r.values[0]))).toEqual([10, 30, 50]);
    await call('save', 8, input).expect(403);
    await db
      .getRepository(EnterpriseResourceGrant)
      .update({ resourceId: 3, recipientId: 8 }, { read: false });
    query.mockClear();
    await call('preview', 8, input).expect(403);
    await call('profile', 8, { ...input, columns: ['amount'] }).expect(403);
    expect(query).not.toHaveBeenCalled();
    expect(await db.getRepository(SourceConditionEntry).count()).toBe(1);
  });
  it('rejects invalid whole condition without partial storage or source mutation', async () => {
    const input = await draft();
    const invalid = {
      ...input,
      definition: {
        include: {
          kind: 'group',
          operator: 'or',
          children: [predicate('amount', 'gte', [10]), predicate('missing', 'eq', [1])],
        },
        exclude: null,
      },
    };
    await call('preview', 7, invalid).expect(400);
    await call('save', 7, invalid).expect(400);
    expect(await db.getRepository(SourceConditionEntry).count()).toBe(1);
  });
  it('rejects a profile if permission or metadata changes during full aggregation, without writes', async () => {
    const input = await draft();
    const repo = db.getRepository(Database);
    const row = await repo.findOneByOrFail({ id: 3 });
    const original = query.getMockImplementation();
    let changed = false;
    query.mockImplementation(async (id, sql, bindings = []) => {
      const result = await original(id, sql, bindings);
      if (!changed && sql.includes('grouped AS')) {
        changed = true;
        await repo.update(3, { catalogActive: false });
      }
      return result;
    });
    try {
      await call('profile', 7, { ...input, columns: ['amount'] }).expect(403);
      expect(changed).toBe(true);
    } finally {
      query.mockImplementation(original);
      await repo.update(3, { catalogActive: true, updatedAt: row.updatedAt });
    }
    const input2 = await draft();
    changed = false;
    query.mockImplementation(async (id, sql, bindings = []) => {
      const result = await original(id, sql, bindings);
      if (!changed && sql.includes('grouped AS')) {
        changed = true;
        await repo.update(3, { updatedAt: new Date(row.updatedAt.getTime() + 10000) });
      }
      return result;
    });
    try {
      await call('profile', 7, { ...input2, columns: ['amount'] }).expect(409);
      expect(changed).toBe(true);
    } finally {
      query.mockImplementation(original);
      await repo.update(3, { updatedAt: row.updatedAt });
    }
    expect(await db.getRepository(SourceConditionEntry).count()).toBe(1);
  });
});
