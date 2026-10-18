import { EnterpriseGroupDelivery } from './entities/enterprise-group-delivery.entity';
import {
  EnterpriseGroup,
  EnterpriseGroupMember,
  EnterpriseGroupGrant,
} from './entities/enterprise-group.entity';
import { EnterpriseDashboardDelivery } from './entities/enterprise-dashboard-delivery.entity';
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { DataSource, Repository, QueryFailedError } from 'typeorm';
import { DatasetType } from '../common/enum/dataset-type.enum';
import { DashboardWidget } from '../dashboard/dashboard-widget/entities/dashboard-widget.entity';
import { Dashboard } from '../dashboard/entities/dashboard.entity';
import { Database } from '../database/entities/database.entity';
import { Dataset } from '../dataset/entities/dataset.entity';
import { SourceAccessService } from '../ownership/source-access.service';
import { UserMapping } from '../user/entities/user-mapping.entity';
import { User } from '../user/entities/user.entity';
import { Widget } from '../widget/entities/widget.entity';
import { EnterpriseAuditEvent } from './entities/enterprise-audit-event.entity';
import { EnterpriseMembership } from './entities/enterprise-membership.entity';
import { EnterpriseOrganization } from './entities/enterprise-organization.entity';
import { EnterpriseResourceGrant } from './entities/enterprise-resource-grant.entity';
import { EnterpriseResourcePolicyService } from './resource-policy.service';
import { SourceLifecycleService } from './source-lifecycle.service';

type Rights = Partial<Record<'read' | 'edit' | 'publish' | 'export', boolean>>;

/** No right implies another: read is the only prerequisite, so every call starts closed. */
const rights = (granted: Rights = {}) => ({
  read: false,
  edit: false,
  publish: false,
  export: false,
  ...granted,
});

/** Synthetic connection material that must never surface through a lifecycle response. */
const SYNTHETIC_CONNECTION = '{"host":"synthetic.invalid","password":"synthetic-secret"}';

const source = (id: number, ownerId: number | null, name: string) => ({
  id,
  ownerId,
  name,
  description: '',
  connectionConfig: SYNTHETIC_CONNECTION,
  engine: 'mysql',
  type: 'mysql',
  timezone: 'UTC',
});

/**
 * UC050 source availability against a real SQLite DataSource: the management surface stays open
 * while a source is inactive, the CAS version bump and the audit record are atomic, and every
 * normal access path is denied until the source is reactivated.
 */
describe('SourceLifecycleService source availability contract', () => {
  let db: DataSource;
  let lifecycle: SourceLifecycleService;
  let policy: EnterpriseResourcePolicyService;
  let access: SourceAccessService;
  let users: Repository<User>;
  let organizations: Repository<EnterpriseOrganization>;
  let memberships: Repository<EnterpriseMembership>;
  let audits: Repository<EnterpriseAuditEvent>;
  let grants: Repository<EnterpriseResourceGrant>;
  let sources: Repository<Database>;
  let dashboards: Repository<Dashboard>;
  let mappings: Repository<UserMapping>;
  let widgets: Repository<Widget>;
  let datasets: Repository<Dataset>;
  let links: Repository<DashboardWidget>;

  beforeAll(async () => {
    db = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      synchronize: true,
      entities: [
        User,
        UserMapping,
        EnterpriseOrganization,
        EnterpriseMembership,
        EnterpriseAuditEvent,
        EnterpriseResourceGrant,
        EnterpriseGroup,
        EnterpriseGroupMember,
        EnterpriseGroupGrant,
        EnterpriseDashboardDelivery,
        EnterpriseGroupDelivery,
        Database,
        Dashboard,
        Widget,
        DashboardWidget,
        Dataset,
      ],
    }).initialize();
    policy = new EnterpriseResourcePolicyService(db);
    lifecycle = new SourceLifecycleService(db, policy);
    access = new SourceAccessService(db, policy);
    users = db.getRepository(User);
    organizations = db.getRepository(EnterpriseOrganization);
    memberships = db.getRepository(EnterpriseMembership);
    audits = db.getRepository(EnterpriseAuditEvent);
    grants = db.getRepository(EnterpriseResourceGrant);
    sources = db.getRepository(Database);
    dashboards = db.getRepository(Dashboard);
    mappings = db.getRepository(UserMapping);
    widgets = db.getRepository(Widget);
    datasets = db.getRepository(Dataset);
    links = db.getRepository(DashboardWidget);
  });

  afterAll(async () => {
    await db?.destroy();
  });

  beforeEach(async () => {
    await links.clear();
    await widgets.clear();
    await datasets.clear();
    await grants.clear();
    await audits.clear();
    await mappings.clear();
    await dashboards.clear();
    await sources.clear();
    await memberships.clear();
    await organizations.clear();
    await users.clear();

    await users.save(
      [1, 2, 3, 4, 5, 6].map(id => ({
        id,
        userId: 'account-' + id,
        email: 'account-' + id + '@example.invalid',
        password: 'password-hash-' + id,
        active: true,
        authVersion: 0,
      })),
    );
    await organizations.save([
      { id: 1, name: 'Synthetic org A', version: 1 },
      { id: 2, name: 'Synthetic org B', version: 1 },
    ]);
    // Account 6 is a real login without any organization membership.
    const roster: Array<Partial<EnterpriseMembership>> = [
      { userId: 1, organizationId: 1, role: 'admin', team: '' },
      { userId: 2, organizationId: 1, role: 'member', team: '' },
      { userId: 3, organizationId: 1, role: 'member', team: '' },
      { userId: 4, organizationId: 2, role: 'admin', team: '' },
      { userId: 5, organizationId: 2, role: 'member', team: '' },
    ];
    await memberships.save(roster);
    await sources.save([
      source(101, 1, 'Synthetic source 101'),
      source(102, 1, 'Synthetic source 102'),
      source(201, 4, 'Synthetic source 201'),
    ]);
  });

  const own = (dashboardId: number, userId: number) =>
    mappings.save({ dashboardId, userInfoId: userId });
  const deactivate = (id: number, version = 1) =>
    sources.update(id, { catalogActive: false, catalogVersion: version });
  const history = () => audits.find({ order: { id: 'ASC' } });

  it('returns the stored lifecycle for the owner admin and keeps reading while inactive', async () => {
    const active = await lifecycle.read(101, 1);
    expect(active).toEqual({ sourceId: 101, active: true, version: 0 });
    expect(JSON.stringify(active)).not.toMatch(/connectionConfig|synthetic\.invalid/);

    await deactivate(101);

    await expect(lifecycle.read(101, 1)).resolves.toEqual({
      sourceId: 101,
      active: false,
      version: 1,
    });
  });

  it('deactivates and reactivates with a new version and one audit record per change', async () => {
    await expect(lifecycle.set(101, 1, { expectedVersion: 0, active: false })).resolves.toEqual({
      sourceId: 101,
      active: false,
      version: 1,
    });
    expect(await sources.findOneByOrFail({ id: 101 })).toMatchObject({
      ownerId: 1,
      catalogActive: false,
      catalogVersion: 1,
      connectionConfig: SYNTHETIC_CONNECTION,
    });
    expect(await history()).toEqual([
      expect.objectContaining({
        organizationId: 1,
        actorId: 1,
        action: 'source.deactivate',
        resourceId: 101,
        subjectId: null,
        version: 1,
      }),
    ]);

    await expect(lifecycle.set(101, 1, { expectedVersion: 1, active: true })).resolves.toEqual({
      sourceId: 101,
      active: true,
      version: 2,
    });
    expect(await sources.findOneByOrFail({ id: 101 })).toMatchObject({
      catalogActive: true,
      catalogVersion: 2,
    });
    expect((await history()).map(row => [row.action, row.version])).toEqual([
      ['source.deactivate', 1],
      ['source.activate', 2],
    ]);
  });

  it('treats an explicit same-value request as a new version and audit', async () => {
    await expect(lifecycle.set(101, 1, { expectedVersion: 0, active: true })).resolves.toEqual({
      sourceId: 101,
      active: true,
      version: 1,
    });
    await expect(lifecycle.set(101, 1, { expectedVersion: 1, active: true })).resolves.toEqual({
      sourceId: 101,
      active: true,
      version: 2,
    });
    expect(await sources.findOneByOrFail({ id: 101 })).toMatchObject({
      catalogActive: true,
      catalogVersion: 2,
    });
    expect((await history()).map(row => [row.action, row.version])).toEqual([
      ['source.activate', 1],
      ['source.activate', 2],
    ]);
  });

  it('refuses lifecycle management to non-owner admins, members and edit grantees', async () => {
    await policy.set('source', 101, 1, {
      recipientId: 2,
      expectedVersion: 0,
      rights: rights({ read: true, edit: true, export: true }),
    });
    await memberships.update({ userId: 3 }, { role: 'admin' });

    for (const actor of [2, 3, 4, 5, 6, 99]) {
      await expect(lifecycle.read(101, actor)).rejects.toThrow(ForbiddenException);
      await expect(
        lifecycle.set(101, actor, { expectedVersion: 0, active: false }),
      ).rejects.toThrow(ForbiddenException);
    }
    expect(await sources.findOneByOrFail({ id: 101 })).toMatchObject({
      catalogActive: true,
      catalogVersion: 0,
    });
    expect(await audits.count()).toBe(1);

    // A cross-organization owner admin keeps managing the source it owns.
    await expect(
      lifecycle.set(201, 4, { expectedVersion: 0, active: false }),
    ).resolves.toMatchObject({ sourceId: 201, version: 1 });

    await users.update(1, { active: false });
    await expect(lifecycle.read(101, 1)).rejects.toThrow(ForbiddenException);
    await expect(lifecycle.set(101, 1, { expectedVersion: 0, active: false })).rejects.toThrow(
      ForbiddenException,
    );
    expect(await sources.findOneByOrFail({ id: 101 })).toMatchObject({
      catalogActive: true,
      catalogVersion: 0,
    });
    expect(await audits.count()).toBe(2);
  });

  it('requires the exact lifecycle body shape and refuses unsafe versions', async () => {
    const invalid: any[] = [
      {},
      { active: false },
      { expectedVersion: 0 },
      { expectedVersion: 0, active: false, extra: true },
      { expectedVersion: 0, active: 'no' },
      { expectedVersion: 0, active: 0 },
      { expectedVersion: 0, active: null },
      { expectedVersion: '0', active: false },
      { expectedVersion: 1.5, active: false },
      { expectedVersion: -1, active: false },
      { expectedVersion: 2147483647, active: false },
      { expectedVersion: 2147483648, active: false },
      { expectedVersion: Number.MAX_SAFE_INTEGER, active: false },
      [],
      null,
      undefined,
      'inactive',
    ];
    for (const body of invalid)
      await expect(lifecycle.set(101, 1, body)).rejects.toThrow(BadRequestException);

    expect(await sources.findOneByOrFail({ id: 101 })).toMatchObject({
      catalogActive: true,
      catalogVersion: 0,
    });
    expect(await audits.count()).toBe(0);

    await expect(lifecycle.set(101, 1, { expectedVersion: 0, active: false })).resolves.toEqual({
      sourceId: 101,
      active: false,
      version: 1,
    });
  });

  it('rejects a stale expectedVersion and keeps the stored state', async () => {
    await lifecycle.set(101, 1, { expectedVersion: 0, active: false });

    await expect(lifecycle.set(101, 1, { expectedVersion: 0, active: true })).rejects.toThrow(
      ConflictException,
    );
    await expect(lifecycle.set(101, 1, { expectedVersion: 2, active: true })).rejects.toThrow(
      ConflictException,
    );
    expect(await sources.findOneByOrFail({ id: 101 })).toMatchObject({
      catalogActive: false,
      catalogVersion: 1,
    });
    expect(await history()).toHaveLength(1);
  });

  it('resolves two writers on the same version with one winner and one conflict', async () => {
    const settled = await Promise.allSettled([
      lifecycle.set(101, 1, { expectedVersion: 0, active: false }),
      lifecycle.set(101, 1, { expectedVersion: 0, active: true }),
    ]);

    expect(settled[0]).toMatchObject({
      status: 'fulfilled',
      value: { sourceId: 101, active: false, version: 1 },
    });
    expect(settled[1].status).toBe('rejected');
    expect((settled[1] as PromiseRejectedResult).reason).toBeInstanceOf(ConflictException);
    expect(await sources.findOneByOrFail({ id: 101 })).toMatchObject({
      catalogActive: false,
      catalogVersion: 1,
    });
    expect(await history()).toHaveLength(1);
  });

  it('rolls the version bump back when the audit write fails', async () => {
    await db.query(
      "CREATE TRIGGER lifecycle_audit_block BEFORE INSERT ON enterprise_audit_event BEGIN SELECT RAISE(ABORT, 'audit unavailable'); END",
    );
    try {
      await expect(lifecycle.set(101, 1, { expectedVersion: 0, active: false })).rejects.toThrow(
        /audit unavailable/,
      );
    } finally {
      await db.query('DROP TRIGGER lifecycle_audit_block');
    }

    expect(await sources.findOneByOrFail({ id: 101 })).toMatchObject({
      catalogActive: true,
      catalogVersion: 0,
    });
    expect(await audits.count()).toBe(0);

    await expect(lifecycle.set(101, 1, { expectedVersion: 0, active: false })).resolves.toEqual({
      sourceId: 101,
      active: false,
      version: 1,
    });
  });

  it('denies every normal source and dashboard path while the source is inactive', async () => {
    await datasets.save({ id: 11, title: 'Orders', databaseId: 101, query: 'SELECT 1' });
    await widgets.save({
      id: 41,
      title: 'Revenue',
      description: '',
      componentId: 1,
      datasetType: DatasetType.DATASET,
      datasetId: 11,
      option: '{}',
      delYn: 'N',
    });
    await links.save({ dashboardId: 51, widgetId: 41 });
    await dashboards.save({ id: 51, title: 'Synthetic dashboard', delYn: 'N' });
    await own(51, 1);
    await policy.set('source', 101, 1, {
      recipientId: 2,
      expectedVersion: 0,
      rights: rights({ read: true, edit: true, export: true }),
    });

    await expect(access.assert('database', 101, 1)).resolves.toBeUndefined();
    await expect(access.assert('database', 101, 2, 'read')).resolves.toBeUndefined();
    await expect(access.assert('dashboard', 51, 1, 'read')).resolves.toBeUndefined();
    await expect(access.sharedDashboard(51)).resolves.toBe(1);

    await deactivate(101);

    // The default owner action and the explicit owner/grant actions are all closed.
    await expect(access.assert('database', 101, 1)).rejects.toThrow(ForbiddenException);
    await expect(new SourceAccessService(db).assert('database', 101, 1)).rejects.toThrow(
      ForbiddenException,
    );
    for (const action of ['read', 'edit', 'export'] as const) {
      await expect(access.assert('database', 101, 1, action)).rejects.toThrow(ForbiddenException);
      await expect(access.assert('database', 101, 2, action)).rejects.toThrow(ForbiddenException);
      await expect(policy.assert('source', 101, 1, action)).rejects.toThrow(ForbiddenException);
    }
    await expect(policy.capabilities('source', 101, 1)).rejects.toThrow(ForbiddenException);
    await expect(access.assert('dashboard', 51, 1, 'read')).rejects.toThrow(ForbiddenException);
    await expect(access.dashboard(51, 1)).rejects.toThrow(ForbiddenException);
    await expect(access.sharedDashboard(51)).rejects.toThrow(ForbiddenException);
    await expect(access.readableSourceIds(2)).resolves.toEqual([]);

    // The management surface stays open, so the owner admin can reactivate the source.
    await expect(lifecycle.read(101, 1)).resolves.toEqual({
      sourceId: 101,
      active: false,
      version: 1,
    });
    await expect(lifecycle.set(101, 1, { expectedVersion: 1, active: true })).resolves.toEqual({
      sourceId: 101,
      active: true,
      version: 2,
    });

    await expect(access.assert('database', 101, 1, 'read')).resolves.toBeUndefined();
    await expect(access.assert('database', 101, 2, 'read')).resolves.toBeUndefined();
    await expect(access.assert('dashboard', 51, 1, 'read')).resolves.toBeUndefined();
    await expect(access.sharedDashboard(51)).resolves.toBe(1);
    await expect(access.readableSourceIds(2)).resolves.toEqual([101]);
  });

  it('keeps admin discovery and grant management while listing only active sources to recipients', async () => {
    for (const id of [101, 102])
      await policy.set('source', id, 1, {
        recipientId: 2,
        expectedVersion: 0,
        rights: rights({ read: true }),
      });
    await expect(policy.sourceIds(2)).resolves.toEqual([101, 102]);

    await deactivate(101);
    await expect(policy.sourceIds(2)).resolves.toEqual([102]);
    await expect(policy.sourceIds(1)).resolves.toEqual([]);

    const page = await policy.resources(1);
    expect(page.entries).toEqual([
      { kind: 'source', id: 101, label: 'Synthetic source 101' },
      { kind: 'source', id: 102, label: 'Synthetic source 102' },
    ]);
    expect(page.nextAfter).toBeNull();
    expect(JSON.stringify(page)).not.toMatch(/connectionConfig|synthetic\.invalid/);

    await expect(
      policy.set('source', 101, 1, {
        recipientId: 3,
        expectedVersion: 0,
        rights: rights({ read: true }),
      }),
    ).resolves.toMatchObject({ resourceId: 101, recipientId: 3, version: 1 });
    await expect(policy.policies('source', 101, 1)).resolves.toMatchObject({
      kind: 'source',
      resourceId: 101,
      entries: expect.arrayContaining([
        expect.objectContaining({ recipientId: 2, version: 1 }),
        expect.objectContaining({ recipientId: 3, version: 1 }),
      ]),
    });
    await expect(access.sourceCapabilities(101, 1)).rejects.toThrow(ForbiddenException);

    await deactivate(102);
    await expect(policy.sourceIds(2)).resolves.toEqual([]);
    await expect(lifecycle.read(102, 1)).resolves.toEqual({
      sourceId: 102,
      active: false,
      version: 1,
    });
  });
  it('maps driver contention to a recoverable conflict without state or audit changes', async () => {
    for (const code of [
      'SQLITE_BUSY',
      'SQLITE_LOCKED',
      'ER_LOCK_DEADLOCK',
      'ER_LOCK_WAIT_TIMEOUT',
    ]) {
      const failure = new QueryFailedError(
        'synthetic',
        [],
        Object.assign(new Error('synthetic contention'), { code }),
      );
      const tx = jest.spyOn(db, 'transaction').mockRejectedValueOnce(failure);
      await expect(
        lifecycle.set(101, 1, { expectedVersion: 0, active: false }),
      ).rejects.toMatchObject({ status: 409 });
      tx.mockRestore();
    }
    expect(await lifecycle.read(101, 1)).toEqual({ sourceId: 101, active: true, version: 0 });
    expect(await db.getRepository(EnterpriseAuditEvent).count()).toBe(0);
  });
  it('denies a source that disappears after the management check', async () => {
    const check = policy.assertManagement.bind(policy);
    jest.spyOn(policy, 'assertManagement').mockImplementationOnce(async (...args) => {
      await check(...args);
      await db.getRepository(Database).delete(101);
    });
    await expect(lifecycle.read(101, 1)).rejects.toMatchObject({ status: 403 });
  });
  it('keeps a legacy overlong name discoverable for reactivation without changing the stored name', async () => {
    const name = '가'.repeat(310);
    await db.getRepository(Database).update(101, { name });
    await lifecycle.set(101, 1, { expectedVersion: 0, active: false });
    const found = (await policy.resources(1)).entries.find(
      e => e.kind === 'source' && e.id === 101,
    );
    expect(found.label.length).toBe(300);
    expect(found.label.endsWith('…')).toBe(true);
    expect((await db.getRepository(Database).findOneByOrFail({ id: 101 })).name).toBe(name);
    await expect(lifecycle.set(101, 1, { expectedVersion: 1, active: true })).resolves.toEqual({
      sourceId: 101,
      active: true,
      version: 2,
    });
  });
});
