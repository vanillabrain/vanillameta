import { SourceLifecycleService } from './source-lifecycle.service';
import { SourceAccessService } from '../ownership/source-access.service';
import { Database } from '../database/entities/database.entity';
import { Dashboard } from '../dashboard/entities/dashboard.entity';
import { UserMapping } from '../user/entities/user-mapping.entity';
import { EnterpriseResourceGrant } from './entities/enterprise-resource-grant.entity';
import { EnterpriseResourcePolicyService } from './resource-policy.service';
import { EnterpriseResourceController } from './resource-policy.controller';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import request = require('supertest');
import { User } from '../user/entities/user.entity';
import { EnterpriseController } from './enterprise.controller';
import { EnterpriseService } from './enterprise.service';
import { EnterpriseOrganization } from './entities/enterprise-organization.entity';
import { EnterpriseMembership } from './entities/enterprise-membership.entity';
import { EnterpriseAuditEvent } from './entities/enterprise-audit-event.entity';
import { EnterpriseEnrollment } from './entities/enterprise-enrollment.entity';

describe('Enterprise protected HTTP lifecycle', () => {
  let db: DataSource;
  let app: INestApplication;
  const jwt = new JwtService();
  const previous = process.env.ACCESS_SECRET;
  const token = (id: number, authVersion = 0) =>
    jwt.sign(
      { accessKeyData: { id, userId: `synthetic-${id}`, authVersion } },
      { secret: process.env.ACCESS_SECRET },
    );
  const call = (
    method: 'get' | 'post' | 'patch',
    url: string,
    id: number,
    body?: object,
    epoch = 0,
  ) => {
    const result = request(app.getHttpServer())
      [method](url)
      .set('Authorization', `Bearer ${token(id, epoch)}`);
    return body === undefined ? result : result.send(body);
  };
  beforeAll(async () => {
    process.env.ACCESS_SECRET = 'enterprise-http-synthetic-test-secret';
    db = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      synchronize: true,
      entities: [
        User,
        EnterpriseOrganization,
        EnterpriseMembership,
        EnterpriseAuditEvent,
        EnterpriseEnrollment,
        EnterpriseResourceGrant,
        Database,
        Dashboard,
        UserMapping,
      ],
    }).initialize();
    await db.getRepository(User).save(
      [1, 2, 3].map(id => ({
        id,
        userId: `synthetic-${id}`,
        email: `synthetic-${id}@example.invalid`,
        password: 'synthetic-unused-hash',
      })),
    );
    const module = await Test.createTestingModule({
      controllers: [EnterpriseController, EnterpriseResourceController],
      providers: [
        EnterpriseService,
        SourceLifecycleService,
        EnterpriseResourcePolicyService,
        SourceAccessService,
        { provide: DataSource, useValue: db },
        { provide: JwtService, useValue: jwt },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
    await app.listen(0, '127.0.0.1');
  });
  afterAll(async () => {
    await app?.close();
    await db?.destroy();
    if (previous === undefined) delete process.env.ACCESS_SECRET;
    else process.env.ACCESS_SECRET = previous;
  });
  it('enforces consent, org isolation, CAS and token revocation over real HTTP', async () => {
    await request(app.getHttpServer()).get('/enterprise/context').expect(401);
    await call('post', '/enterprise/organizations', 1, { name: 'Synthetic organization A' }).expect(
      201,
    );
    await call('post', '/enterprise/organizations', 3, { name: 'Synthetic organization B' }).expect(
      201,
    );
    await call('get', '/enterprise/members', 2).expect(403);
    const body = { userId: 'synthetic-2', team: 'Operations', role: 'member', expectedVersion: 1 };
    await call('post', '/enterprise/members', 1, body).expect(400);
    const enrollment = (
      await call('post', '/enterprise/enrollment', 2, {
        organizationId: (
          await db.getRepository(EnterpriseMembership).findOneByOrFail({ userId: 1 })
        ).organizationId,
      }).expect(201)
    ).body;
    const added = (
      await call('post', '/enterprise/members', 1, {
        ...body,
        enrollmentCode: enrollment.enrollmentCode,
      }).expect(201)
    ).body;
    expect(added.member).toEqual({
      id: 2,
      userId: 'synthetic-2',
      team: 'Operations',
      role: 'member',
      active: true,
    });
    expect(await db.getRepository(EnterpriseEnrollment).count()).toBe(0);
    await call('get', '/enterprise/members', 2).expect(403);
    const a = (await call('get', '/enterprise/members', 1).expect(200)).body;
    const b = (await call('get', '/enterprise/members', 3).expect(200)).body;
    expect(a.entries.map((x: any) => x.id)).toEqual([1, 2]);
    expect(b.entries.map((x: any) => x.id)).toEqual([3]);
    expect(JSON.stringify(a)).not.toMatch(/password|email|codeHash|jwtId/);
    const change = { team: 'Operations', role: 'member', active: false, expectedVersion: 2 };
    await call('patch', '/enterprise/members/2', 3, { ...change, expectedVersion: 1 }).expect(403);
    await call('patch', '/enterprise/members/2x', 1, change).expect(400);
    await call('patch', '/enterprise/members/2', 1, { ...change, expectedVersion: 1 }).expect(409);
    await call('patch', '/enterprise/members/2', 1, change).expect(200);
    await call('get', '/enterprise/context', 2).expect(401);
    await call('patch', '/enterprise/members/2', 1, {
      ...change,
      active: true,
      expectedVersion: 3,
    }).expect(200);
    await call('get', '/enterprise/context', 2).expect(401);
    const recovered = (await call('get', '/enterprise/context', 2, undefined, 2).expect(200)).body;
    expect(recovered.membership.role).toBe('member');
    expect(await db.getRepository(EnterpriseAuditEvent).count()).toBe(5);
  });
  it('manages independent source permissions over protected HTTP and immediately denies a revoked reader', async () => {
    await db.getRepository(Database).save({
      id: 7,
      ownerId: 1,
      name: 'Synthetic source',
      engine: 'duckdb',
      type: 'file',
      connectionConfig: 'synthetic-unused-config',
    });
    const uri = '/enterprise/resources/source/7';
    const read = { read: true, edit: false, publish: false, export: false };
    const clear = { read: false, edit: false, publish: false, export: false };
    const listed = (await call('get', '/enterprise/resources', 1).expect(200)).body;
    expect(listed.entries).toContainEqual({ kind: 'source', id: 7, label: 'Synthetic source' });
    expect(JSON.stringify(listed)).not.toMatch(/connectionConfig|password/);
    await call('post', `${uri}/policies`, 1, {
      recipientId: 2,
      expectedVersion: 0,
      rights: read,
    }).expect(201);
    const permission = (await call('get', `${uri}/access`, 2, undefined, 2).expect(200)).body;
    expect(permission.rights).toEqual(read);
    await call('get', `${uri}/access`, 3).expect(403);
    await call(
      'post',
      `${uri}/policies`,
      2,
      { recipientId: 3, expectedVersion: 0, rights: read },
      2,
    ).expect(403);
    await call('post', `${uri}/policies`, 1, {
      recipientId: 2,
      expectedVersion: 0,
      rights: clear,
    }).expect(409);
    await call('post', `${uri}/policies`, 1, {
      recipientId: 2,
      expectedVersion: 1,
      rights: clear,
    }).expect(201);
    await call('get', `${uri}/access`, 2, undefined, 2).expect(403);
    const audit = await db
      .getRepository(EnterpriseAuditEvent)
      .find({ where: { action: 'source.permissions' }, order: { id: 'ASC' } });
    expect(
      audit.map(row => ({
        actorId: row.actorId,
        subjectId: row.subjectId,
        resourceId: row.resourceId,
        version: row.version,
      })),
    ).toEqual([
      { actorId: 1, subjectId: 2, resourceId: 7, version: 1 },
      { actorId: 1, subjectId: 2, resourceId: 7, version: 2 },
    ]);
  });
  it('deactivates and reactivates through explicit admin HTTP with CAS and no secret payload', async () => {
    const uri = '/enterprise/resources/source/7';
    const read = (await call('get', uri + '/lifecycle', 1).expect(200)).body;
    expect(read).toEqual({ sourceId: 7, active: true, version: 0 });
    await call('post', uri + '/lifecycle', 2, { expectedVersion: 0, active: false }, 2).expect(403);
    await call('post', uri + '/lifecycle', 1, { expectedVersion: 0, active: false }).expect(201);
    await call('get', uri + '/access', 1).expect(403);
    expect((await call('get', uri + '/lifecycle', 1).expect(200)).body).toEqual({
      sourceId: 7,
      active: false,
      version: 1,
    });
    await call('post', uri + '/lifecycle', 1, { expectedVersion: 0, active: true }).expect(409);
    const current = (
      await call('post', uri + '/lifecycle', 1, { expectedVersion: 1, active: true }).expect(201)
    ).body;
    expect(current).toEqual({ sourceId: 7, active: true, version: 2 });
    expect(JSON.stringify(current)).not.toMatch(/connectionConfig|password|filename/);
    await call('get', uri + '/access', 1).expect(200);
  });
});
