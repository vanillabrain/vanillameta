import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import request = require('supertest');
import { DataSource } from 'typeorm';
import { semanticMetadata } from '../../test/util/semantic-mysql';
import { serializeMetadataWork } from '../common/metadata-work';
import { HttpExceptionFilter } from '../nest-utils/http-exception.filter';
import { User } from '../user/entities/user.entity';
import { UserMapping } from '../user/entities/user-mapping.entity';
import { Database } from '../database/entities/database.entity';
import { Metric, MetricAggregation } from '../metric/entities/metric.entity';
import { Dashboard } from '../dashboard/entities/dashboard.entity';
import { StudioPublication } from '../dashboard-studio/entities/studio-publication.entity';
import { ExportJob } from '../bi/entities/export-job.entity';
import { EnterpriseOrganization } from './entities/enterprise-organization.entity';
import { EnterpriseMembership } from './entities/enterprise-membership.entity';
import { EnterpriseAuditEvent } from './entities/enterprise-audit-event.entity';
import { EnterpriseResourceGrant } from './entities/enterprise-resource-grant.entity';
import { EnterpriseDashboardDelivery } from './entities/enterprise-dashboard-delivery.entity';
import {
  EnterpriseGroup,
  EnterpriseGroupMember,
  EnterpriseGroupGrant,
} from './entities/enterprise-group.entity';
import { EnterpriseGroupDelivery } from './entities/enterprise-group-delivery.entity';
import { StaffDepartureImpactService } from './staff-departure-impact.service';
import { StaffDepartureImpactController } from './staff-departure-impact.controller';

const entities = [
  User,
  EnterpriseOrganization,
  EnterpriseMembership,
  EnterpriseAuditEvent,
  Database,
  Metric,
  Dashboard,
  UserMapping,
  StudioPublication,
  ExportJob,
  EnterpriseResourceGrant,
  EnterpriseDashboardDelivery,
  EnterpriseGroup,
  EnterpriseGroupMember,
  EnterpriseGroupGrant,
  EnterpriseGroupDelivery,
];
const expectedCounts = {
  sources: 2,
  metrics: 2,
  soleDashboards: 1,
  ambiguousDashboards: 2,
  directGrants: 3,
  personalDeliveries: 3,
  groupMemberships: 2,
  ownedGroupGrants: 2,
  ownedGroupDeliveries: 2,
  publications: 2,
  exportJobs: 3,
};

describe('counts-only departure impact', () => {
  let db: DataSource, app: INestApplication, service: StaffDepartureImpactService;
  const jwt = new JwtService(),
    oldSecret = process.env.ACCESS_SECRET;
  const uri = (id: unknown = 2) => `/enterprise/members/${id}/departure-impact`;
  const token = (id = 1, epoch = 0) =>
    jwt.sign(
      {
        accessKeyData: {
          id,
          userId: `departure-${id}`,
          authVersion: epoch,
        },
      },
      { secret: process.env.ACCESS_SECRET },
    );
  const get = (id: unknown = 2, actor = 1, epoch = 0) =>
    request(app.getHttpServer())
      .get(uri(id))
      .set('Authorization', `Bearer ${token(actor, epoch)}`);
  const snapshot = async () =>
    Promise.all(
      entities.map(async entity => {
        const repo = db.getRepository(entity);
        return repo.find({
          order: Object.fromEntries(repo.metadata.primaryColumns.map(c => [c.propertyName, 'ASC'])),
        });
      }),
    );
  beforeAll(async () => {
    process.env.ACCESS_SECRET = 'synthetic-departure-access';
    db = await semanticMetadata('departure', {
      type: 'sqlite',
      database: ':memory:',
      entities,
      synchronize: true,
    });
    service = new StaffDepartureImpactService(db);
    const module = await Test.createTestingModule({
      controllers: [StaffDepartureImpactController],
      providers: [
        StaffDepartureImpactService,
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
      [1, 2, 3, 4].map(id => ({
        id,
        userId: `departure-${id}`,
        email: `departure-${id}@example.invalid`,
        password: 'synthetic-secret',
        active: id !== 2,
        authVersion: 0,
      })),
    );
    await db.getRepository(EnterpriseOrganization).save([
      { id: 10, name: 'Synthetic A', version: 3 },
      { id: 20, name: 'Synthetic B', version: 1 },
    ]);
    await db.getRepository(EnterpriseMembership).save([
      { userId: 1, organizationId: 10, role: 'admin', team: 'A' },
      { userId: 2, organizationId: 10, role: 'member', team: 'B' },
      { userId: 3, organizationId: 20, role: 'admin', team: '' },
      { userId: 4, organizationId: 10, role: 'member', team: '' },
    ]);
  });
  async function assets() {
    await db.getRepository(Database).save(
      [11, 12, 13].map(id => ({
        id,
        ownerId: id === 13 ? 3 : 2,
        name: 'secret-source',
        connectionConfig: 'secret-path',
        engine: 'duckdb',
        type: 'file',
        catalogActive: id !== 12,
      })),
    );
    await db.getRepository(Metric).save(
      [11, 12, 13, 999].map((databaseId, i) => ({
        id: i + 1,
        databaseId,
        name: `secret-metric-${i}`,
        tableName: 'secret-column',
        expression: 'secret-sql',
        aggregation: MetricAggregation.SUM,
        useYn: 'N',
      })),
    );
    await db
      .getRepository(Dashboard)
      .save(
        [21, 22, 23, 24].map(id => ({ id, title: 'secret-title', assetActive: false, delYn: 'Y' })),
      );
    await db.getRepository(UserMapping).save([
      { dashboardId: 21, userInfoId: 2 },
      { dashboardId: 22, userInfoId: 2 },
      { dashboardId: 22, userInfoId: 2 },
      { dashboardId: 23, userInfoId: 2 },
      { dashboardId: 23, userInfoId: 3 },
      { dashboardId: 24, userInfoId: 3 },
      { dashboardId: 999, userInfoId: 2 },
    ]);
    const relationships = [
      { ownerId: 2, recipientId: 1, organizationId: 10 },
      { ownerId: 1, recipientId: 2, organizationId: 10 },
      { ownerId: 2, recipientId: 2, organizationId: 10 },
      { ownerId: 2, recipientId: 3, organizationId: 20 },
      { ownerId: 1, recipientId: 4, organizationId: 10 },
    ];
    for (const [i, row] of relationships.entries()) {
      await db
        .getRepository(EnterpriseResourceGrant)
        .save({ ...row, resourceKind: 'source', resourceId: i + 1, version: 1, read: false });
      await db
        .getRepository(EnterpriseDashboardDelivery)
        .save({ ...row, dashboardId: i + 1, version: 1, active: false });
      await db.getRepository(ExportJob).save({
        ...row,
        sourceOwnerId: row.recipientId,
        sourceId: 11,
        requestId: `synthetic-${i}`,
        digest: 'secret-digest',
        requestJson: 'secret-question',
        basisJson: 'secret-basis',
        status: 'cancelled',
        version: 1,
        expiresAt: new Date('2020-01-01'),
      });
    }
    await db.getRepository(EnterpriseGroup).save(
      [31, 32, 33].map(id => ({
        id,
        organizationId: id === 33 ? 20 : 10,
        name: 'secret-group',
        nameKey: String(id),
        active: false,
        version: 1,
      })),
    );
    await db
      .getRepository(EnterpriseGroupMember)
      .save([31, 32, 33, 999].map(groupId => ({ groupId, userId: 2 })));
    for (const [i, organizationId] of [10, 10, 20, 10].entries()) {
      const ownerId = i === 3 ? 1 : 2;
      await db.getRepository(EnterpriseGroupGrant).save({
        organizationId,
        ownerId,
        resourceKind: 'source',
        resourceId: i + 1,
        groupId: 31,
        version: 1,
        read: false,
      });
      await db.getRepository(EnterpriseGroupDelivery).save({
        organizationId,
        ownerId,
        dashboardId: i + 1,
        groupId: 31,
        version: 1,
        active: false,
      });
    }
    await db.getRepository(StudioPublication).save(
      [2, 2, 3].map((actorId, i) => ({
        actorId,
        token: `secret-token-${i}`,
        dashboardId: 21,
        sourceId: 11,
        version: 1,
        visibility: 'link',
        allowRemix: false,
        expiresAt: '2020-01-01',
        revokedAt: '2020-01-01',
        asOf: '2020-01-01',
        dataVersion: 'secret-version',
        snapshot: 'secret-snapshot',
      })),
    );
  }
  it('counts all eleven contracts via service and guarded HTTP without changing any fixture row or leaking content', async () => {
    await assets();
    const before = await snapshot();
    const result = await service.inspect(1, 0, 2);
    expect(result).toEqual({
      organizationId: 10,
      organizationVersion: 3,
      targetId: 2,
      targetActive: false,
      observedAt: expect.any(String),
      counts: expectedCounts,
    });
    expect(Number.isFinite(Date.parse(result.observedAt))).toBe(true);
    const response = await get().expect(200);
    expect(response.body).toEqual({ ...result, observedAt: expect.any(String) });
    expect(JSON.stringify(response.body)).not.toMatch(
      /secret|password|email|team|token|sql|title|path/i,
    );
    expect(await snapshot()).toEqual(before);
  });
  it('allows self inspection and an empty account without manufacturing assets', async () => {
    const result = await get(1).expect(200);
    expect(Object.values(result.body.counts)).toEqual(Array(11).fill(0));
    expect(result.body.targetActive).toBe(true);
  });
  it('protects HTTP with actual guard/filter, current epoch and same-organization admin authority', async () => {
    const before = await snapshot();
    await request(app.getHttpServer())
      .get(uri())
      .expect(401)
      .expect(r => expect(r.body).toMatchObject({ success: false, code: 401 }));
    await get(2, 4).expect(403);
    await get(2, 3).expect(403);
    await get(3).expect(403);
    await get(999).expect(403);
    await get(2, 1, 1).expect(401);
    expect(await snapshot()).toEqual(before);
    await db.getRepository(User).update(1, { active: false });
    await get().expect(401);
  });
  it.each(['0', '-1', '1.5', '1e0', '2147483647', '9007199254740992', 'abc', '2x'])(
    'rejects malformed target id %s through HTTP without writes',
    async id => {
      const before = await snapshot();
      await get(id).expect(400);
      expect(await snapshot()).toEqual(before);
    },
  );
  (process.env.VM_SEMANTIC_MYSQL_CONFIG ? it : it.skip)(
    'keeps counts in one RR snapshot while a separate connection commits a new source and metric',
    async () => {
      await assets();
      const peer = await new DataSource({ ...db.options }).initialize();
      const transaction = db.transaction.bind(db);
      (jest.spyOn(db, 'transaction') as any).mockImplementation((isolation, run) =>
        transaction(isolation, async manager => {
          const count = manager.count.bind(manager);
          manager.count = async (entity, options) => {
            const result = await count(entity, options);
            if (entity === Database) {
              await peer.transaction(async writer => {
                await writer.save(Database, {
                  id: 14,
                  ownerId: 2,
                  name: 'Synthetic concurrent source',
                  connectionConfig: 'synthetic',
                  engine: 'duckdb',
                  type: 'file',
                });
                await writer.save(Metric, {
                  id: 14,
                  databaseId: 14,
                  name: 'synthetic-concurrent-metric',
                  tableName: 'source',
                  expression: 'amount',
                  aggregation: MetricAggregation.SUM,
                });
              });
            }
            return result;
          };
          return run(manager);
        }),
      );
      try {
        expect((await service.inspect(1, 0, 2)).counts).toEqual(expectedCounts);
        expect(await peer.manager.count(Database, { where: { ownerId: 2 } })).toBe(3);
        expect(await peer.manager.count(Metric)).toBe(5);
      } finally {
        await peer.destroy();
      }
    },
  );
  (process.env.VM_SEMANTIC_MYSQL_CONFIG ? it.skip : it)(
    'queues an independent SQLite metadata writer until the entire departure read finishes',
    async () => {
      let enter: () => void, resume: () => void;
      const entered = new Promise<void>(resolve => {
        enter = resolve;
      });
      const resumed = new Promise<void>(resolve => {
        resume = resolve;
      });
      const transaction = db.transaction.bind(db);
      (jest.spyOn(db, 'transaction') as any).mockImplementation(run =>
        transaction(async manager => {
          const count = manager.count.bind(manager);
          manager.count = async (entity, options) => {
            if (entity === Database) {
              enter();
              await resumed;
            }
            return count(entity, options);
          };
          return run(manager);
        }),
      );
      const reading = service.inspect(1, 0, 2);
      await entered;
      let wrote = false;
      const writing = serializeMetadataWork(db, async () => {
        await db.getRepository(EnterpriseOrganization).update(10, { version: 4 });
        wrote = true;
      });
      try {
        await new Promise(resolve => setImmediate(resolve));
        expect(wrote).toBe(false);
      } finally {
        resume();
      }
      expect((await reading).organizationVersion).toBe(3);
      await writing;
      expect(wrote).toBe(true);
      expect((await service.inspect(1, 0, 2)).organizationVersion).toBe(4);
    },
  );
  // Inject a real committed mutation at the transaction boundary, not a canned authority response.
  // On MySQL the peer uses a separate pool while the RR snapshot is still open.
  function duringSnapshot(change: (writer: DataSource) => Promise<unknown>) {
    const transaction = db.transaction.bind(db);
    (jest.spyOn(db, 'transaction') as any).mockImplementation((first, second) => {
      const run = typeof first === 'function' ? first : second;
      const wrapped = async manager => {
        const result = await run(manager);
        if (db.options.type === 'mysql') {
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
        if (db.options.type !== 'mysql') await change(db);
        return result;
      });
    });
  }
  it.each([
    'epoch',
    'inactive',
    'role',
    'actor-org',
    'target-moved',
    'target-active',
    'target-role',
    'target-team',
    'organization',
  ])('discards a completed snapshot after committed %s change', async kind => {
    duringSnapshot(async writer => {
      if (kind === 'epoch') await writer.getRepository(User).update(1, { authVersion: 1 });
      if (kind === 'inactive') await writer.getRepository(User).update(1, { active: false });
      if (kind === 'role')
        await writer.getRepository(EnterpriseMembership).update(1, { role: 'member' });
      if (kind === 'actor-org')
        await writer.getRepository(EnterpriseMembership).update(1, { organizationId: 20 });
      if (kind === 'target-moved')
        await writer.getRepository(EnterpriseMembership).update(2, { organizationId: 20 });
      if (kind === 'target-active') await writer.getRepository(User).update(2, { active: true });
      if (kind === 'target-role')
        await writer.getRepository(EnterpriseMembership).update(2, { role: 'admin' });
      if (kind === 'target-team')
        await writer.getRepository(EnterpriseMembership).update(2, { team: 'Changed' });
      if (kind === 'organization')
        await writer.getRepository(EnterpriseOrganization).update(10, { version: 4 });
    });
    const expected = ['epoch', 'inactive'].includes(kind)
      ? 401
      : ['role', 'actor-org'].includes(kind)
      ? 403
      : 409;
    const response = await get().expect(expected);
    expect(response.body).toMatchObject({ success: false, code: expected });
    expect(response.body).not.toHaveProperty('counts');
    expect(await db.getRepository(EnterpriseAuditEvent).count()).toBe(0);
  });
});
