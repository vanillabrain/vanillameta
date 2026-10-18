jest.mock('../ai/ai.service', () => ({ AiService: class {} }));
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import request = require('supertest');
import { DataSource } from 'typeorm';
import { metadataTransaction } from '../common/metadata-work';
import { Database } from '../database/entities/database.entity';
import { User } from '../user/entities/user.entity';
import { UserMapping } from '../user/entities/user-mapping.entity';
import { UserService } from '../user/user.service';
import { EnterpriseMembership } from '../enterprise/entities/enterprise-membership.entity';
import { EnterpriseAuditEvent } from '../enterprise/entities/enterprise-audit-event.entity';
import { EnterpriseResourceGrant } from '../enterprise/entities/enterprise-resource-grant.entity';
import {
  EnterpriseGroup,
  EnterpriseGroupMember,
  EnterpriseGroupGrant,
} from '../enterprise/entities/enterprise-group.entity';
import { EnterpriseDashboardDelivery } from '../enterprise/entities/enterprise-dashboard-delivery.entity';
import { EnterpriseGroupDelivery } from '../enterprise/entities/enterprise-group-delivery.entity';
import { EnterpriseResourcePolicyService } from '../enterprise/resource-policy.service';
import { SourceAccessService } from '../ownership/source-access.service';
import { Dashboard } from './entities/dashboard.entity';
import { DashboardWidget } from './dashboard-widget/entities/dashboard-widget.entity';
import { DashboardShare } from './entities/dashboard_share.entity';
import { DashboardPublication } from './entities/dashboard-publication.entity';
import { DashboardService } from './dashboard.service';
import { PersonalLibraryState } from './entities/personal-library-state.entity';
import { PersonalLibraryService } from './personal-library.service';
import { PersonalLibraryController } from './personal-library.controller';
import { AddPersonalLibraryState1792520000000 } from '../migrations/1792520000000-add-personal-library-state';

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>(r => (resolve = r));
  return { promise, resolve };
};
describe('UC055 personal library actual SQLite policy and JWT', () => {
  let db: DataSource,
    access: SourceAccessService,
    dashboards: DashboardService,
    library: PersonalLibraryService;
  const body = (
    archived = true,
    expectedVersion = 0,
    expectedOrganizationId = 1,
    expectedActorId = 1,
  ) => ({
    archived,
    expectedVersion,
    expectedOrganizationId,
    expectedActorId,
  });
  const entities = [
    User,
    UserMapping,
    Database,
    Dashboard,
    DashboardWidget,
    DashboardShare,
    DashboardPublication,
    EnterpriseMembership,
    EnterpriseAuditEvent,
    EnterpriseResourceGrant,
    EnterpriseGroup,
    EnterpriseGroupMember,
    EnterpriseGroupGrant,
    EnterpriseDashboardDelivery,
    EnterpriseGroupDelivery,
    PersonalLibraryState,
  ];
  beforeAll(async () => {
    db = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      synchronize: true,
      entities,
    }).initialize();
    access = new SourceAccessService(db, new EnterpriseResourcePolicyService(db));
    const users = new UserService(db.getRepository(User), db.getRepository(UserMapping), undefined);
    dashboards = new DashboardService(
      db.getRepository(Dashboard),
      db.getRepository(User),
      db.getRepository(DashboardShare),
      db.getRepository(UserMapping),
      undefined,
      users,
      undefined,
      undefined,
      access,
    );
    library = new PersonalLibraryService(db, dashboards, access);
  });
  beforeEach(async () => {
    jest.restoreAllMocks();
    for (const entity of [...entities].reverse()) await db.getRepository(entity).clear();
    await db.manager.insert(
      User,
      [1, 2, 3, 4].map(id => ({
        id,
        userId: `library-${id}`,
        email: `library-${id}@example.invalid`,
        password: 'unused',
        active: true,
        authVersion: 0,
      })),
    );
    await db.manager.insert(
      EnterpriseMembership,
      [1, 2, 3].map(userId => ({
        userId,
        organizationId: userId === 3 ? 2 : 1,
        role: userId === 1 ? 'admin' : 'member',
        team: '',
      })),
    );
    await db.manager.insert(
      Database,
      [1, 2].map(id => ({
        id,
        ownerId: id === 1 ? 1 : 4,
        name: 'Synthetic source',
        connectionConfig: '{}',
        engine: 'duckdb',
        type: 'FILE',
      })),
    );
    await db.manager.insert(DashboardShare, {
      id: 10,
      uuid: 'synthetic-share',
      shareYn: 'Y',
      allowReuse: true,
      reuseVersion: 3,
    });
    await db.manager.insert(DashboardPublication, {
      dashboardId: 1,
      uuid: 'synthetic-publication',
      publisherId: 1,
      sourceId: 1,
      version: 2,
      dashboardRevision: 'a'.repeat(64),
      snapshot: '{"synthetic":true}',
      reuseDefinition: '{"preserve":true}',
      publishedAt: '2026-01-01T00:00:00Z',
      expiresAt: '2027-01-01T00:00:00Z',
      active: true,
      requestId: 'synthetic-request',
      payloadDigest: 'b'.repeat(64),
    });
    await db.manager.insert(
      Dashboard,
      [1, 2, 3].map(id => ({
        id,
        title: `Synthetic ${id}`,
        layout: '[]',
        analysisDefinition: JSON.stringify({ databaseId: id === 3 ? 2 : 1 }),
        structuredDefinition: '{"preserve":true}',
        shareId: 10,
      })),
    );
    await db.manager.insert(
      UserMapping,
      [1, 2, 3].map(dashboardId => ({ dashboardId, userInfoId: dashboardId === 3 ? 4 : 1 })),
    );
    await db.manager.insert(
      EnterpriseResourceGrant,
      (['source', 'dashboard'] as const).map(resourceKind => ({
        organizationId: 1,
        ownerId: 1,
        resourceKind,
        resourceId: 1,
        recipientId: 2,
        read: true,
        edit: false,
        publish: false,
        export: false,
        version: 1,
      })),
    );
  });
  afterAll(async () => {
    await db?.destroy();
  });
  const counts = async () => [
    await db.manager.count(PersonalLibraryState),
    await db.manager.count(EnterpriseAuditEvent),
  ];

  it('uses actual owner/read-list pipeline; archived is a read-only empty view initially', async () => {
    expect((await library.list(1)).data).toMatchObject({
      canArchive: true,
      organizationId: 1,
      view: 'active',
      entries: [
        { id: 1, library: { archived: false, version: 0 } },
        { id: 2, library: { archived: false, version: 0 } },
      ],
    });
    const recipient = (await library.list(2)).data.entries;
    expect(recipient).toHaveLength(1);
    expect(recipient[0]).not.toHaveProperty('shareId');
    expect((await library.list(1, 'archived')).data.entries).toEqual([]);
    expect(await counts()).toEqual([0, 0]);
  });

  describe.each(['upstream', 'filtered'] as const)('%s list envelope boundary', stage => {
    it.each([
      null,
      'not exist user',
      { status: 'ERROR', data: [] },
      { data: [] },
      { status: 'SUCCESS', data: {} },
      { status: 'SUCCESS', data: null },
      { status: 'SUCCESS' },
    ])(
      'rejects malformed response %j with sanitized 500 rather than empty success',
      async result => {
        const filtered = jest.spyOn(access, 'filterResults');
        if (stage === 'upstream')
          jest.spyOn(dashboards, 'findAll').mockResolvedValueOnce(result as any);
        else filtered.mockResolvedValueOnce(result);
        const pending = library.list(1);
        await expect(pending).rejects.toBeInstanceOf(InternalServerErrorException);
        await expect(pending).rejects.toMatchObject({
          response: { statusCode: 500, message: '대시보드 목록을 불러오지 못했습니다.' },
        });
        if (stage === 'upstream') expect(filtered).not.toHaveBeenCalled();
        expect(await counts()).toEqual([0, 0]);
      },
    );
  });

  it.each([3, 4])(
    'keeps legitimate empty current/legacy account %s lists successful',
    async actor => {
      if (actor === 4) await db.manager.delete(UserMapping, { userInfoId: actor });
      for (const view of ['active', 'archived']) {
        expect(await library.list(actor, view)).toEqual({
          status: 'SUCCESS',
          data: {
            entries: [],
            canArchive: actor === 3,
            organizationId: actor === 3 ? 2 : null,
            actorId: actor,
            view,
          },
        });
      }
      expect(await counts()).toEqual([0, 0]);
    },
  );

  it('fences stale actor clicks when both active members can read the same asset in the same organization', async () => {
    await access.dashboard(1, 1, 'read');
    await access.dashboard(1, 2, 'read');
    const oldList = (await library.list(1)).data;
    const newList = (await library.list(2)).data;
    expect(oldList).toMatchObject({ actorId: 1, organizationId: 1 });
    expect(newList).toMatchObject({ actorId: 2, organizationId: 1 });
    const stale = {
      ...body(),
      expectedActorId: oldList.actorId,
      expectedOrganizationId: oldList.organizationId,
    };
    await expect(library.update(1, 2, stale)).rejects.toBeInstanceOf(ConflictException);
    await expect(library.update(1, 2, { ...stale, archived: false })).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(await counts()).toEqual([0, 0]);
    await library.update(1, 2, { ...stale, expectedActorId: newList.actorId });
    expect((await db.manager.find(PersonalLibraryState)).map(row => row.userId)).toEqual([2]);
  });

  it('separates owner and recipient states and preserves originals, shares and grants', async () => {
    const publication = await db.manager.find(DashboardPublication),
      share = await db.manager.find(DashboardShare);
    const before = await db.manager.find(Dashboard),
      grants = await db.manager.find(EnterpriseResourceGrant),
      mappings = await db.manager.find(UserMapping);
    expect((await library.update(1, 2, body(true, 0, 1, 2))).data).toEqual({
      dashboardId: 1,
      organizationId: 1,
      archived: true,
      version: 1,
    });
    expect((await library.list(2)).data.entries).toEqual([]);
    expect((await library.list(2, 'archived')).data.entries[0]).toMatchObject({
      id: 1,
      library: { archived: true, version: 1 },
    });
    expect((await library.list(1)).data.entries).toHaveLength(2);
    await library.update(1, 1, body());
    await library.update(1, 2, body(false, 1, 1, 2));
    expect((await library.list(2)).data.entries).toHaveLength(1);
    expect((await library.list(1, 'archived')).data.entries).toHaveLength(1);
    expect(await db.manager.find(Dashboard)).toEqual(before);
    expect(await db.manager.find(DashboardShare)).toEqual(share);
    expect(await db.manager.find(DashboardPublication)).toEqual(publication);
    expect(await db.manager.find(EnterpriseResourceGrant)).toEqual(grants);
    expect(await db.manager.find(UserMapping)).toEqual(mappings);
    expect(await db.manager.find(EnterpriseAuditEvent)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actorId: 2,
          subjectId: 2,
          organizationId: 1,
          resourceId: 1,
          action: 'dashboard.library-archived',
          version: 1,
        }),
        expect.objectContaining({
          actorId: 2,
          subjectId: 2,
          action: 'dashboard.library-restored',
          version: 2,
        }),
      ]),
    );
  });

  it('applies CAS, stale same-state idempotency and future-version rejection before no-op', async () => {
    await library.update(1, 1, body(false));
    expect(await counts()).toEqual([0, 0]);
    await library.update(1, 1, body());
    const initial = await db.manager.find(PersonalLibraryState);
    await library.update(1, 1, body());
    expect(await db.manager.find(PersonalLibraryState)).toEqual(initial);
    await expect(library.update(1, 1, body(true, 2))).rejects.toBeInstanceOf(ConflictException);
    await expect(library.update(1, 1, body(false, 0))).rejects.toBeInstanceOf(ConflictException);
    await library.update(1, 1, body(false, 1));
    expect((await library.update(1, 1, body(false, 0))).data.version).toBe(2);
    expect(await counts()).toEqual([1, 2]);
  });

  it('caps increments at the MySQL signed INTEGER maximum while preserving same-state replay', async () => {
    await db.manager.insert(PersonalLibraryState, {
      userId: 1,
      organizationId: 1,
      dashboardId: 1,
      archived: true,
      version: 2147483647,
      updatedAt: new Date(),
    });
    expect((await library.update(1, 1, body(true, 2147483647))).data.version).toBe(2147483647);
    await expect(library.update(1, 1, body(false, 2147483647))).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(await counts()).toEqual([1, 0]);
  });

  it.each([0, -1, 1.5, 2147483648])('fails closed on corrupt stored version %s', async version => {
    await db.manager.insert(PersonalLibraryState, {
      userId: 1,
      organizationId: 1,
      dashboardId: 1,
      archived: true,
      version,
      updatedAt: new Date(),
    });
    await expect(library.list(1, 'archived')).rejects.toBeInstanceOf(ConflictException);
    await expect(library.update(1, 1, body())).rejects.toBeInstanceOf(ConflictException);
    expect(await counts()).toEqual([1, 0]);
  });

  it('serializes duplicate and conflicting updates without duplicate audit', async () => {
    const same = await Promise.all([library.update(1, 1, body()), library.update(1, 1, body())]);
    expect(same[0]).toEqual(same[1]);
    const competing = await Promise.allSettled([
      library.update(1, 1, body(false, 1)),
      library.update(1, 1, body(true, 1)),
    ]);
    expect(competing.map(x => x.status)).toEqual(['fulfilled', 'rejected']);
    expect(await counts()).toEqual([1, 2]);
  });

  it.each(['source', 'dashboard'])(
    'hides archived state and denies restore after %s read revocation',
    async resourceKind => {
      await library.update(1, 2, body(true, 0, 1, 2));
      await db.manager.delete(EnterpriseResourceGrant, {
        resourceKind,
        resourceId: 1,
        recipientId: 2,
      });
      expect((await library.list(2, 'archived')).data.entries).toEqual([]);
      await expect(library.update(1, 2, body(false, 1, 1, 2))).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(await counts()).toEqual([1, 1]);
    },
  );

  it('requires all sources read, not just a dashboard grant', async () => {
    await db.manager.update(Dashboard, 1, {
      analysisDefinition: JSON.stringify({ databaseId: 2 }),
    });
    expect((await library.list(2)).data.entries).toEqual([]);
    await expect(library.update(1, 2, body(true, 0, 1, 2))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(await counts()).toEqual([0, 0]);
  });

  it('supports active legacy accounts without organization and denies writes', async () => {
    expect((await library.list(4)).data).toMatchObject({
      canArchive: false,
      organizationId: null,
      entries: [{ id: 3, library: { archived: false, version: 0 } }],
    });
    expect((await library.list(4, 'archived')).data.entries).toEqual([]);
    await expect(library.update(3, 4, body())).rejects.toBeInstanceOf(ForbiddenException);
    expect(await counts()).toEqual([0, 0]);
  });

  it('does not apply states from the previous organization', async () => {
    await library.update(1, 1, body());
    await db.manager.update(EnterpriseMembership, 1, { organizationId: 2 });
    expect((await library.list(1)).data.entries[0].library).toEqual({
      archived: false,
      version: 0,
    });
    expect((await library.list(1, 'archived')).data.entries).toEqual([]);
    await library.update(1, 1, body(true, 0, 2));
    expect(await counts()).toEqual([2, 2]);
  });

  it('rejects stale organization UI before writing a default-version state in the new organization', async () => {
    await db.manager.update(EnterpriseMembership, 1, { organizationId: 2 });
    // Owner still has read access in the new organization; only the scope pin prevents the write.
    await access.dashboard(1, 1, 'read');
    await expect(library.update(1, 1, body())).rejects.toBeInstanceOf(ConflictException);
    await expect(library.update(1, 1, body(false))).rejects.toBeInstanceOf(ConflictException);
    expect(await counts()).toEqual([0, 0]);
    await library.update(1, 1, body(true, 0, 2));
    expect(await counts()).toEqual([1, 1]);
  });

  it.each(['inactive', 'epoch', 'removed'])(
    'rejects %s actor on both reads and writes',
    async scenario => {
      if (scenario === 'removed') {
        await db.manager.delete(EnterpriseMembership, 1);
        await db.manager.delete(User, 1);
      } else
        await db.manager.update(
          User,
          1,
          scenario === 'inactive' ? { active: false } : { authVersion: 1 },
        );
      const error = scenario === 'epoch' ? UnauthorizedException : ForbiddenException;
      await expect(library.list(1)).rejects.toBeInstanceOf(error);
      await expect(library.update(1, 1, body())).rejects.toBeInstanceOf(error);
      expect(await counts()).toEqual([0, 0]);
    },
  );

  it('rechecks JWT epoch after waiting for the SQLite metadata queue', async () => {
    const entered = deferred(),
      release = deferred();
    const blocker = metadataTransaction(db, async manager => {
      entered.resolve();
      await release.promise;
      await manager.update(User, 1, { authVersion: 1 });
    });
    await entered.promise;
    const pending = library.update(1, 1, body());
    release.resolve();
    await blocker;
    await expect(pending).rejects.toBeInstanceOf(UnauthorizedException);
    expect(await counts()).toEqual([0, 0]);
  });

  it('rolls back personal state if the atomic audit insert fails', async () => {
    await db.query(
      "CREATE TRIGGER library_fail_audit BEFORE INSERT ON enterprise_audit_event BEGIN SELECT RAISE(ABORT, 'synthetic audit failure'); END",
    );
    try {
      await expect(library.update(1, 1, body())).rejects.toThrow('synthetic audit failure');
    } finally {
      await db.query('DROP TRIGGER library_fail_audit');
    }
    expect(await counts()).toEqual([0, 0]);
  });

  it('rolls back an existing state and version when a restore audit fails', async () => {
    await library.update(1, 1, body());
    const before = await db.manager.find(PersonalLibraryState);
    await db.query(
      "CREATE TRIGGER library_fail_restore BEFORE INSERT ON enterprise_audit_event BEGIN SELECT RAISE(ABORT, 'synthetic restore failure'); END",
    );
    try {
      await expect(library.update(1, 1, body(false, 1))).rejects.toThrow(
        'synthetic restore failure',
      );
    } finally {
      await db.query('DROP TRIGGER library_fail_restore');
    }
    expect(await db.manager.find(PersonalLibraryState)).toEqual(before);
    expect(await counts()).toEqual([1, 1]);
  });

  it('rolls back state and audit when source read disappears during the transaction', async () => {
    await db.query(
      'CREATE TRIGGER library_revoke_source AFTER INSERT ON personal_library_state BEGIN UPDATE database SET catalogActive = 0 WHERE id = 1; END',
    );
    try {
      await expect(library.update(1, 2, body(true, 0, 1, 2))).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    } finally {
      await db.query('DROP TRIGGER library_revoke_source');
    }
    expect(await counts()).toEqual([0, 0]);
    expect((await db.manager.findOneBy(Database, { id: 1 })).catalogActive).toBe(true);
  });

  it('limits only new states at 1000 for the actor and organization', async () => {
    const states = Array.from({ length: 1000 }, (_, n) => ({
      userId: 1,
      organizationId: 1,
      dashboardId: n === 0 ? 1 : n + 100,
      archived: true,
      version: 1,
      updatedAt: new Date(),
    }));
    // TypeORM reloads composite IDs after insert; keep each SQLite expression tree bounded.
    for (let offset = 0; offset < states.length; offset += 100)
      await db.manager.insert(PersonalLibraryState, states.slice(offset, offset + 100));
    await library.update(1, 1, body(false, 1));
    await library.update(2, 1, body(false));
    await expect(library.update(2, 1, body())).rejects.toBeInstanceOf(BadRequestException);
    await library.update(1, 2, body(true, 0, 1, 2));
    expect(await counts()).toEqual([1001, 2]);
  });

  it.each([
    {},
    [],
    null,
    { archived: true },
    { archived: 'true', expectedVersion: 0 },
    { archived: true, expectedVersion: -1 },
    { archived: true, expectedVersion: 0.5 },
    { archived: true, expectedVersion: Number.MAX_SAFE_INTEGER + 1 },
    { archived: true, expectedVersion: 0 },
    { archived: true, expectedVersion: 0, expectedOrganizationId: 1 },
    { ...body(), expectedActorId: 0 },
    { ...body(), expectedActorId: -1 },
    { ...body(), expectedActorId: '1' },
    { ...body(), expectedActorId: 1.5 },
    { ...body(), expectedActorId: Number.MAX_SAFE_INTEGER + 1 },
    { ...body(), expectedOrganizationId: 0 },
    { ...body(), expectedOrganizationId: -1 },
    { ...body(), expectedOrganizationId: '1' },
    { ...body(), expectedOrganizationId: 1.5 },
    { ...body(), expectedOrganizationId: Number.MAX_SAFE_INTEGER + 1 },
    { ...body(), userId: 2 },
    { ...body(), organizationId: 2 },
  ])('rejects malformed/identity-injected body %j without writes', async input => {
    await expect(library.update(1, 1, input)).rejects.toBeInstanceOf(BadRequestException);
    expect(await counts()).toEqual([0, 0]);
  });

  it('rejects invalid views, deleted/missing dashboards and disabled sources', async () => {
    await expect(library.list(1, 'all')).rejects.toBeInstanceOf(BadRequestException);
    await expect(library.update('1x', 1, body())).rejects.toBeInstanceOf(BadRequestException);
    await expect(library.update(999, 1, body())).rejects.toBeInstanceOf(ForbiddenException);
    await db.manager.update(Dashboard, 1, { delYn: 'Y' });
    await expect(library.update(1, 1, body())).rejects.toBeInstanceOf(ForbiddenException);
    await db.manager.update(Database, 1, { catalogActive: false });
    expect((await library.list(1)).data.entries).toEqual([]);
    expect(await counts()).toEqual([0, 0]);
  });

  it('repeats the migration safely and enforces the composite primary key', async () => {
    const runner = db.createQueryRunner(),
      migration = new AddPersonalLibraryState1792520000000();
    try {
      await runner.dropTable('personal_library_state');
      await migration.up(runner);
      await migration.up(runner);
      await library.update(1, 1, body());
      const row = await db.manager.findOneBy(PersonalLibraryState, {
        userId: 1,
        organizationId: 1,
        dashboardId: 1,
      });
      await expect(db.manager.insert(PersonalLibraryState, row)).rejects.toThrow();
      await expect(migration.down()).rejects.toThrow('backup');
    } finally {
      await runner.release();
    }
  });

  it('protects real JWT routes with no-store headers and revokes stale tokens', async () => {
    const previous = process.env.ACCESS_SECRET;
    process.env.ACCESS_SECRET = 'synthetic-library-test';
    const jwt = new JwtService();
    const module = await Test.createTestingModule({
      controllers: [PersonalLibraryController],
      providers: [
        { provide: PersonalLibraryService, useValue: library },
        { provide: JwtService, useValue: jwt },
        { provide: DataSource, useValue: db },
      ],
    }).compile();
    const app = module.createNestApplication();
    try {
      await app.init();
      await app.listen(0, '127.0.0.1');
      const server = app.getHttpServer();
      const auth =
        'Bearer ' +
        jwt.sign(
          { accessKeyData: { id: 1, userId: 'library-1', authVersion: 0 } },
          { secret: process.env.ACCESS_SECRET },
        );
      await request(server).get('/dashboard/library').expect(401);
      const result = await request(server)
        .get('/dashboard/library')
        .set('Authorization', auth)
        .expect(200)
        .expect('Cache-Control', 'no-store');
      expect(result.body.data.entries).toHaveLength(2);
      expect(result.body.data.actorId).toBe(1);
      const secondAuth =
        'Bearer ' +
        jwt.sign(
          {
            accessKeyData: { id: 2, userId: 'library-2', authVersion: 0 },
          },
          { secret: process.env.ACCESS_SECRET },
        );
      const secondList = await request(server)
        .get('/dashboard/library')
        .set('Authorization', secondAuth)
        .expect(200);
      expect(secondList.body.data).toMatchObject({ actorId: 2, organizationId: 1 });
      expect(secondList.body.data.entries.map(row => row.id)).toContain(1);
      await request(server)
        .put('/dashboard/1/library')
        .set('Authorization', secondAuth)
        .send({
          ...body(),
          expectedActorId: result.body.data.actorId,
          expectedOrganizationId: result.body.data.organizationId,
        })
        .expect(409);
      expect(await counts()).toEqual([0, 0]);

      await request(server)
        .put('/dashboard/1/library')
        .set('Authorization', auth)
        .send(body())
        .expect(200)
        .expect('Cache-Control', 'no-store');
      await request(server)
        .get('/dashboard/library?view=archived')
        .set('Authorization', auth)
        .expect(200);
      await request(server)
        .get('/dashboard/library?view=bad')
        .set('Authorization', auth)
        .expect(400);
      await db.manager.update(User, 1, { authVersion: 1 });
      await request(server).get('/dashboard/library').set('Authorization', auth).expect(401);
      await request(server)
        .put('/dashboard/1/library')
        .set('Authorization', auth)
        .send(body(false, 1))
        .expect(401);
      expect(await counts()).toEqual([1, 1]);
    } finally {
      await app.close();
      if (previous === undefined) delete process.env.ACCESS_SECRET;
      else process.env.ACCESS_SECRET = previous;
    }
  });
});
