import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import request = require('supertest');
import { User } from '../user/entities/user.entity';
import { Database } from '../database/entities/database.entity';
import { SourceAccessService } from '../ownership/source-access.service';
import { EnterpriseMembership } from './entities/enterprise-membership.entity';
import { EnterpriseAuditEvent } from './entities/enterprise-audit-event.entity';
import {
  EnterpriseClassification,
  EnterpriseClassificationRequest,
} from './entities/enterprise-classification.entity';
import { EnterpriseClassificationService } from './classification.service';
import { EnterpriseClassificationController } from './classification.controller';
import { metadataTransaction } from '../common/metadata-work';

describe('Classification authenticated HTTP contract', () => {
  let db: DataSource, app: INestApplication, service: EnterpriseClassificationService;
  const jwt = new JwtService();
  const previous = process.env.ACCESS_SECRET;
  const endpoint = '/enterprise/classifications';
  const token = (id: number, authVersion?: number) =>
    jwt.sign(
      {
        accessKeyData: {
          id,
          userId: 'registry-http-' + id,
          ...(authVersion === undefined ? {} : { authVersion }),
        },
      },
      { secret: process.env.ACCESS_SECRET },
    );
  const call = (method: 'get' | 'post', path = endpoint, id = 1, body?: any, epoch?: number) => {
    const req = request(app.getHttpServer())
      [method](path)
      .set('Authorization', 'Bearer ' + token(id, epoch));
    return body === undefined ? req : req.send(body);
  };
  const create = (name = 'Finance', actor = 1, org = 10) => ({
    expectedActorId: actor,
    expectedOrganizationId: org,
    requestId: randomUUID(),
    name,
  });
  beforeAll(async () => {
    process.env.ACCESS_SECRET = 'synthetic-classification-http-secret';
    db = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      synchronize: true,
      entities: [
        User,
        Database,
        EnterpriseMembership,
        EnterpriseAuditEvent,
        EnterpriseClassification,
        EnterpriseClassificationRequest,
      ],
    }).initialize();
    const module = await Test.createTestingModule({
      controllers: [EnterpriseClassificationController],
      providers: [
        EnterpriseClassificationService,
        { provide: DataSource, useValue: db },
        { provide: JwtService, useValue: jwt },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
    await app.listen(0, '127.0.0.1');
    service = module.get(EnterpriseClassificationService);
  });
  beforeEach(async () => {
    await db.manager.clear(EnterpriseClassificationRequest);
    await db.manager.clear(EnterpriseClassification);
    await db.manager.clear(EnterpriseAuditEvent);
    await db.manager.clear(EnterpriseMembership);
    await db.manager.clear(Database);
    await db.manager.clear(User);
    await db.manager.save(
      User,
      [1, 2, 3, 4].map(id => ({
        id,
        userId: 'registry-http-' + id,
        email: `registry-http-${id}@example.invalid`,
        password: 'unused',
        active: true,
        authVersion: 0,
      })),
    );
    await db.manager.save(EnterpriseMembership, [
      { userId: 1, organizationId: 10, role: 'admin', team: '' },
      { userId: 2, organizationId: 10, role: 'member', team: '' },
      { userId: 3, organizationId: 20, role: 'admin', team: '' },
    ]);
  });
  afterAll(async () => {
    await app?.close();
    await db?.destroy();
    if (previous === undefined) delete process.env.ACCESS_SECRET;
    else process.env.ACCESS_SECRET = previous;
  });
  it('requires verified JWT/epoch and rejects inactive accounts', async () => {
    await request(app.getHttpServer()).get(endpoint).expect(401);
    await request(app.getHttpServer())
      .get(endpoint)
      .set('Authorization', 'Bearer wrong')
      .expect(401);
    await call('get', endpoint, 1, undefined, 1).expect(401);
    await db.manager.update(User, 1, { active: false });
    await call('get').expect(401);
    await call('get', endpoint, 4).expect(403);
  });
  it('exposes raw no-store metadata to current members and exact nested write receipts to admins', async () => {
    const input = create();
    const created = (
      await call('post', endpoint, 1, input).expect(201).expect('Cache-Control', 'no-store')
    ).body;
    expect(created).toEqual({
      actorId: 1,
      organizationId: 10,
      entry: { id: expect.any(Number), name: 'Finance', active: true, version: 1 },
      replayed: false,
    });
    expect((await call('post', endpoint, 1, input).expect(201)).body).toEqual({
      ...created,
      replayed: true,
    });
    const listed = (await call('get', endpoint, 2).expect(200).expect('Cache-Control', 'no-store'))
      .body;
    expect(listed).toEqual({
      actorId: 2,
      organizationId: 10,
      canManage: false,
      entries: [created.entry],
      nextAfterId: null,
    });
    expect(JSON.stringify(listed)).not.toMatch(
      /sourceId|column|nameKey|password|authVersion|email/,
    );
    await call('post', endpoint, 2, create('Forbidden', 2)).expect(403);
    const changed = (
      await call('post', endpoint + '/' + created.entry.id, 1, {
        expectedActorId: 1,
        expectedOrganizationId: 10,
        expectedVersion: 1,
        name: 'Finance updated',
        active: false,
      })
        .expect(200)
        .expect('Cache-Control', 'no-store')
    ).body;
    expect(changed).toEqual({
      actorId: 1,
      organizationId: 10,
      entry: { ...created.entry, name: 'Finance updated', active: false, version: 2 },
    });
    expect(await db.manager.count(EnterpriseClassificationRequest)).toBe(1);
    expect(await db.manager.count(EnterpriseAuditEvent)).toBe(2);
  });
  it('validates body/query/id strictly and never trusts body authVersion or actor identity', async () => {
    for (const body of [
      { ...create(), authVersion: 0 },
      { ...create(), expectedActorId: '1' },
      { ...create(), requestId: 'not-a-uuid' },
    ])
      await call('post', endpoint, 1, body).expect(400);
    await call('post', endpoint, 1, create('Actor mismatch', 2)).expect(409);
    await call('post', endpoint, 1, create('Org mismatch', 1, 20)).expect(409);
    for (const after of ['0', '-1', '1x', '1.5', '9007199254740992', '1&afterId=2'])
      await call('get', endpoint + '?afterId=' + after).expect(400);
    await call('post', endpoint + '/1x', 1, {}).expect(400);
    expect(await db.manager.count(EnterpriseClassification)).toBe(0);
  });
  it('isolates organization rows and returns generic errors for cross-organization writes', async () => {
    const a = (await call('post', endpoint, 1, create()).expect(201)).body;
    const b = (
      await call('post', endpoint, 3, create('Private other organization', 3, 20)).expect(201)
    ).body;
    expect((await call('get', endpoint, 3).expect(200)).body.entries).toEqual([b.entry]);
    const rejected = await call('post', endpoint + '/' + b.entry.id, 1, {
      expectedActorId: 1,
      expectedOrganizationId: 10,
      expectedVersion: 1,
      name: 'Hidden edit',
      active: false,
    }).expect(403);
    expect(JSON.stringify(rejected.body)).not.toContain('Private other organization');
    expect((await call('get').expect(200)).body.entries).toEqual([a.entry]);
  });
  it('does not turn registry administration into source edit permission', async () => {
    await db.manager.save(Database, {
      id: 9,
      ownerId: 2,
      name: 'Private source',
      engine: 'duckdb',
      type: 'FILE',
      connectionConfig: 'unused',
    });
    await call('post', endpoint, 1, create()).expect(201);
    await expect(
      new SourceAccessService(db).assert('database', 9, 1, 'edit'),
    ).rejects.toMatchObject({ status: 403 });
    expect((await db.manager.findOneByOrFail(Database, { id: 9 })).ownerId).toBe(2);
  });
  it.each(['create', 'list', 'set'] as const)(
    'rechecks JWT epoch after guard succeeded but before queued %s',
    async operation => {
      const made = await service.create(1, 0, create());
      const original = service[operation].bind(service);
      const spy = jest.spyOn(service, operation).mockImplementationOnce((async (...args: any[]) => {
        await metadataTransaction(db, manager => manager.update(User, 1, { authVersion: 1 }));
        return (original as any)(...args);
      }) as any);
      try {
        if (operation === 'list') await call('get').expect(401);
        else if (operation === 'create')
          await call('post', endpoint, 1, create('Queued')).expect(401);
        else
          await call('post', endpoint + '/' + made.entry.id, 1, {
            expectedActorId: 1,
            expectedOrganizationId: 10,
            expectedVersion: 1,
            name: 'Queued',
            active: false,
          }).expect(401);
        expect(spy).toHaveBeenCalledTimes(1);
        expect(await db.manager.count(EnterpriseAuditEvent)).toBe(1);
      } finally {
        spy.mockRestore();
      }
    },
  );
  it('rejects a confirmed old-org request after guard/queue org transition without replay into the new org', async () => {
    const input = create();
    await call('post', endpoint, 1, input).expect(201);
    const original = service.create.bind(service);
    const spy = jest.spyOn(service, 'create').mockImplementationOnce(async (...args) => {
      await metadataTransaction(db, manager =>
        manager.update(EnterpriseMembership, 1, { organizationId: 20 }),
      );
      return original(...args);
    });
    try {
      await call('post', endpoint, 1, input).expect(409);
    } finally {
      spy.mockRestore();
    }
    await call('post', endpoint, 1, { ...input, expectedOrganizationId: 20 }).expect(409);
    expect((await call('get').expect(200)).body).toMatchObject({ organizationId: 20, entries: [] });
    expect(await db.manager.count(EnterpriseAuditEvent)).toBe(1);
  });
});
