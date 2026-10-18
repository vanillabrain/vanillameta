import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import request = require('supertest');
import { EnterpriseNotificationController } from './notification.controller';
import { DataSource } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { EnterpriseMembership } from './entities/enterprise-membership.entity';
import { EnterpriseAuditEvent } from './entities/enterprise-audit-event.entity';
import { EnterpriseNotificationState } from './entities/enterprise-notification-state.entity';
import { EnterpriseNotificationService } from './notification.service';
import { AddNotificationState1792450000000 } from '../migrations/1792450000000-add-notification-state';

const entities = [User, EnterpriseMembership, EnterpriseAuditEvent, EnterpriseNotificationState];
describe('Personal notification projection and monotonic state', () => {
  let db: DataSource;
  let service: EnterpriseNotificationService;
  beforeAll(async () => {
    db = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      entities,
      synchronize: true,
    }).initialize();
    service = new EnterpriseNotificationService(db);
  });
  afterAll(async () => db?.destroy());
  beforeEach(async () => {
    for (const entity of [
      EnterpriseNotificationState,
      EnterpriseAuditEvent,
      EnterpriseMembership,
      User,
    ])
      await db.getRepository(entity).clear();
    await db.getRepository(User).save(
      [1, 2, 3].map(id => ({
        id,
        userId: `synthetic-${id}`,
        email: `synthetic-${id}@example.invalid`,
        password: 'unused-test-hash',
        active: true,
      })),
    );
    await db.getRepository(EnterpriseMembership).save(
      [1, 2, 3].map(userId => ({
        userId,
        organizationId: userId === 3 ? 2 : 1,
        role: 'member' as const,
        team: '',
      })),
    );
    await db.getRepository(EnterpriseAuditEvent).save([
      {
        id: 1,
        organizationId: 1,
        actorId: 1,
        subjectId: 2,
        action: 'source.permissions',
        resourceId: 8,
        version: 1,
        createdAt: new Date('2026-10-18T12:34:56Z'),
      },
      {
        id: 2,
        organizationId: 1,
        actorId: 1,
        subjectId: 1,
        action: 'dashboard.permissions',
        resourceId: 9,
        version: 1,
      },
      {
        id: 3,
        organizationId: 2,
        actorId: 3,
        subjectId: 2,
        action: 'source.permissions',
        resourceId: 10,
        version: 1,
      },
      {
        id: 4,
        organizationId: 1,
        actorId: 1,
        subjectId: 2,
        action: 'organization.created',
        resourceId: 1,
        version: 1,
      },
    ]);
  });
  it('projects only own current-organization permission events without private data or read writes', async () => {
    expect(await service.list(2)).toEqual({
      entries: [
        {
          id: 1,
          resourceKind: 'source',
          resourceId: 8,
          version: 1,
          createdAt: '2026-10-18T12:34:56.000Z',
          read: false,
        },
      ],
      nextBeforeId: null,
    });
    expect(await db.getRepository(EnterpriseNotificationState).count()).toBe(0);
    expect(await db.getRepository(EnterpriseAuditEvent).count()).toBe(4);
    for (const id of [2, 3, 4, 999])
      await expect(service.mark(2, id, 'read')).rejects.toMatchObject({ status: 403 });
    expect(await db.getRepository(EnterpriseNotificationState).count()).toBe(0);
  });
  it('preserves monotonic state and audit records on concurrent operations and retries', async () => {
    const before = await db.getRepository(EnterpriseAuditEvent).find();
    await Promise.all([
      service.mark(2, 1, 'read'),
      service.mark(2, 1, 'remove'),
      service.mark(2, 1, 'read'),
    ]);
    expect(await service.mark(2, 1, 'remove')).toEqual({ id: 1, read: true, removed: true });
    expect(await service.list(2)).toEqual({ entries: [], nextBeforeId: null });
    expect(await db.getRepository(EnterpriseNotificationState).count()).toBe(1);
    expect(await db.getRepository(EnterpriseAuditEvent).find()).toEqual(before);
  });
  it('rolls back a failed state mutation and recovers with the same request', async () => {
    await db.query(
      `CREATE TRIGGER fail_notification_state BEFORE UPDATE ON enterprise_notification_state BEGIN SELECT RAISE(ABORT, 'synthetic write failure'); END`,
    );
    try {
      await expect(service.mark(2, 1, 'read')).rejects.toThrow(/synthetic write failure/);
      expect(await db.getRepository(EnterpriseNotificationState).count()).toBe(0);
      expect((await service.list(2)).entries[0].read).toBe(false);
      expect(await db.getRepository(EnterpriseAuditEvent).count()).toBe(4);
    } finally {
      await db.query('DROP TRIGGER fail_notification_state');
    }
    expect(await service.mark(2, 1, 'read')).toEqual({ id: 1, read: true, removed: false });
  });
  it('rechecks active membership and rejects old organization events', async () => {
    await db.getRepository(User).update(2, { active: false });
    await expect(service.list(2)).rejects.toMatchObject({ status: 403 });
    await expect(service.mark(2, 1, 'read')).rejects.toMatchObject({ status: 403 });
    await db.getRepository(User).update(2, { active: true });
    await db.getRepository(EnterpriseMembership).update(2, { organizationId: 2 });
    expect((await service.list(2)).entries.map(e => e.id)).toEqual([3]);
    await expect(service.mark(2, 1, 'read')).rejects.toMatchObject({ status: 403 });
    await db.getRepository(EnterpriseMembership).delete(2);
    await expect(service.list(2)).rejects.toMatchObject({ status: 403 });
  });
  it('paginates by stable event id while new events arrive and removed events disappear', async () => {
    for (let id = 5; id <= 29; id += 1)
      await db.getRepository(EnterpriseAuditEvent).insert({
        id,
        organizationId: 1,
        actorId: 1,
        subjectId: 2,
        action: 'dashboard.permissions',
        resourceId: 7,
        version: id,
      });
    const first = await service.list(2);
    expect(first.entries.map(e => e.id)).toEqual(Array.from({ length: 20 }, (_, i) => 29 - i));
    expect(first.nextBeforeId).toBe(10);
    await db.getRepository(EnterpriseAuditEvent).insert({
      id: 30,
      organizationId: 1,
      actorId: 1,
      subjectId: 2,
      action: 'source.permissions',
      resourceId: 7,
      version: 30,
    });
    await service.mark(2, 8, 'remove');
    expect((await service.list(2, 10)).entries.map(e => e.id)).toEqual([9, 7, 6, 5, 1]);
    for (const invalid of [0, -1, 1.5, '2', NaN])
      await expect(service.list(2, invalid)).rejects.toMatchObject({ status: 400 });
  });
  it('guards real HTTP using current account tokens and ignores forged recipient identity', async () => {
    const previous = process.env.ACCESS_SECRET;
    process.env.ACCESS_SECRET = 'synthetic-notification-http-secret';
    const jwt = new JwtService();
    const module = await Test.createTestingModule({
      controllers: [EnterpriseNotificationController],
      providers: [
        EnterpriseNotificationService,
        { provide: DataSource, useValue: db },
        { provide: JwtService, useValue: jwt },
      ],
    }).compile();
    const app = module.createNestApplication();
    await app.init();
    await app.listen(0, '127.0.0.1');
    const token = jwt.sign(
      { accessKeyData: { id: 2, userId: 'synthetic-2', authVersion: 0 } },
      { secret: process.env.ACCESS_SECRET },
    );
    try {
      const server = app.getHttpServer();
      await request(server).get('/enterprise/notifications').expect(401);
      const list = await request(server)
        .get('/enterprise/notifications')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(list.body.entries.map(entry => entry.id)).toEqual([1]);
      await request(server)
        .post('/enterprise/notifications/2/read')
        .set('Authorization', `Bearer ${token}`)
        .send({ recipientId: 1 })
        .expect(403);
      await request(server)
        .get('/enterprise/notifications?beforeId=1.2')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
      await request(server)
        .post('/enterprise/notifications/1/read')
        .set('Authorization', `Bearer ${token}`)
        .send({ recipientId: 1 })
        .expect(201);
      expect(await db.getRepository(EnterpriseNotificationState).find()).toEqual([
        { recipientId: 2, eventId: 1, read: true, removed: false },
      ]);
      await db.getRepository(User).update(2, { authVersion: 1 });
      await request(server)
        .get('/enterprise/notifications')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);
    } finally {
      await app.close();
      if (previous === undefined) delete process.env.ACCESS_SECRET;
      else process.env.ACCESS_SECRET = previous;
    }
  });
  it('additive migration is idempotent and preserves legacy audits and defaults', async () => {
    const runner = db.createQueryRunner();
    const migration = new AddNotificationState1792450000000();
    await runner.dropTable('enterprise_notification_state');
    await runner.dropIndex('enterprise_audit_event', 'IDX_enterprise_audit_inbox');
    await migration.up(runner);
    expect(
      (await runner.getTable('enterprise_audit_event')).indices.map(index => index.name),
    ).toContain('IDX_enterprise_audit_inbox');
    await runner.query(
      'INSERT INTO enterprise_notification_state (recipientId,eventId) VALUES (?,?)',
      [2, 1],
    );
    await migration.up(runner);
    expect(await db.getRepository(EnterpriseNotificationState).find()).toEqual([
      { recipientId: 2, eventId: 1, read: false, removed: false },
    ]);
    await expect(
      runner.query(
        'INSERT INTO enterprise_notification_state (recipientId,eventId) VALUES (?,?)',
        [2, 1],
      ),
    ).rejects.toThrow();
    expect(await db.getRepository(EnterpriseAuditEvent).count()).toBe(4);
    await expect(migration.down()).rejects.toThrow(/backup plan/);
    await runner.release();
  });
});
