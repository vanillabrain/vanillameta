import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
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
import { EnterpriseService } from './enterprise.service';
import { EnterpriseResourcePolicyService } from './resource-policy.service';

type Rights = Partial<Record<'read' | 'edit' | 'publish' | 'export', boolean>>;

/** No right implies another: read is the only prerequisite, so every call starts closed. */
const rights = (granted: Rights = {}) => ({
  read: false,
  edit: false,
  publish: false,
  export: false,
  ...granted,
});

/** Synthetic connection material that must never reach a policy response. */
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
 * UC-051 resource grants on a real SQLite DataSource with synchronize enabled, so the CAS
 * update, the audit write and every denial are proven against real storage instead of stubs.
 */
describe('EnterpriseResourcePolicyService resource grant contract', () => {
  let db: DataSource;
  let policy: EnterpriseResourcePolicyService;
  let enterprise: EnterpriseService;
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
        Database,
        Dashboard,
        Widget,
        DashboardWidget,
        Dataset,
      ],
    }).initialize();
    policy = new EnterpriseResourcePolicyService(db);
    enterprise = new EnterpriseService(db);
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
        userId: `account-${id}`,
        email: `account-${id}@example.invalid`,
        password: `password-hash-${id}`,
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

  it('grants read/edit/export at version 1 and audits the acting admin against the recipient', async () => {
    await expect(
      policy.set('source', 101, 1, {
        recipientId: 2,
        expectedVersion: 0,
        rights: rights({ read: true, edit: true, export: true }),
      }),
    ).resolves.toEqual({
      kind: 'source',
      resourceId: 101,
      recipientId: 2,
      version: 1,
      rights: { read: true, edit: true, publish: false, export: true },
    });

    expect(await grants.find()).toEqual([
      expect.objectContaining({
        resourceKind: 'source',
        resourceId: 101,
        recipientId: 2,
        organizationId: 1,
        ownerId: 1,
        version: 1,
        read: true,
        edit: true,
        publish: false,
        export: true,
      }),
    ]);
    expect(await audits.find()).toEqual([
      expect.objectContaining({
        organizationId: 1,
        actorId: 1,
        subjectId: 2,
        action: 'source.permissions',
        resourceId: 101,
        version: 1,
      }),
    ]);
  });

  const readless: Array<[string, Rights]> = [
    ['edit', { edit: true }],
    ['publish', { publish: true }],
    ['export', { export: true }],
  ];

  it.each(readless)('refuses a %s grant without read and writes nothing', async (_action, only) => {
    await expect(
      policy.set('source', 101, 1, { recipientId: 2, expectedVersion: 0, rights: rights(only) }),
    ).rejects.toThrow(BadRequestException);
    expect(await grants.count()).toBe(0);
    expect(await audits.count()).toBe(0);
  });

  it('requires the exact policy body shape and refuses unknown kinds', async () => {
    const valid = { recipientId: 2, expectedVersion: 0, rights: rights({ read: true }) };
    const bodies = [
      { ...valid, extra: true },
      { recipientId: 2, expectedVersion: 0 },
      { ...valid, expectedVersion: -1 },
      { ...valid, expectedVersion: 1.5 },
      { ...valid, expectedVersion: 2147483647 },
      { ...valid, rights: { read: true } },
      { ...valid, rights: { ...rights({ read: true }), read: 'yes' } },
      { ...valid, rights: [rights({ read: true })] },
      [],
    ];
    for (const body of bodies)
      await expect(policy.set('source', 101, 1, body)).rejects.toThrow(BadRequestException);
    await expect(policy.set('table' as unknown as 'source', 101, 1, valid)).rejects.toThrow(
      BadRequestException,
    );
    expect(await grants.count()).toBe(0);
  });

  it('allows a dashboard publish grant while source publish and self grants stay refused', async () => {
    await dashboards.save({ id: 51, title: 'Synthetic dashboard', delYn: 'N' });
    await own(51, 1);

    await expect(
      policy.set('dashboard', 51, 1, {
        recipientId: 2,
        expectedVersion: 0,
        rights: rights({ read: true, publish: true }),
      }),
    ).resolves.toMatchObject({
      kind: 'dashboard',
      version: 1,
      rights: { read: true, edit: false, publish: true, export: false },
    });
    await expect(
      policy.set('source', 101, 1, {
        recipientId: 2,
        expectedVersion: 0,
        rights: rights({ read: true, publish: true }),
      }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      policy.set('source', 101, 1, {
        recipientId: 1,
        expectedVersion: 0,
        rights: rights({ read: true }),
      }),
    ).rejects.toThrow(BadRequestException);
    expect(await grants.count()).toBe(1);
    expect(await audits.count()).toBe(1);
  });

  it('only lets the active same-organization owner admin change a grant', async () => {
    // The recipient is never the actor here, so each denial proves an authorization rule.
    const body = { recipientId: 2, expectedVersion: 0, rights: rights({ read: true }) };
    await expect(policy.set('source', 101, 3, body)).rejects.toThrow(ForbiddenException);
    await expect(policy.set('source', 101, 4, body)).rejects.toThrow(ForbiddenException);
    await expect(policy.set('source', 101, 6, body)).rejects.toThrow(ForbiddenException);
    await expect(policy.set('source', 101, 99, body)).rejects.toThrow(ForbiddenException);
    await users.update(1, { active: false });
    await expect(policy.set('source', 101, 1, body)).rejects.toThrow(ForbiddenException);
    expect(await grants.count()).toBe(0);

    await users.update(1, { active: true });
    await expect(
      policy.set('source', 201, 4, {
        recipientId: 5,
        expectedVersion: 0,
        rights: rights({ read: true }),
      }),
    ).resolves.toMatchObject({ resourceId: 201, recipientId: 5, version: 1 });
    expect(await grants.find()).toEqual([
      expect.objectContaining({ resourceId: 201, recipientId: 5, organizationId: 2, ownerId: 4 }),
    ]);
  });

  it('requires a single owning mapping and a live dashboard before a dashboard grant', async () => {
    await dashboards.save([
      { id: 51, title: 'Shared dashboard', delYn: 'N' },
      { id: 52, title: 'Deleted dashboard', delYn: 'Y' },
    ]);
    await mappings.save([
      { dashboardId: 51, userInfoId: 1 },
      { dashboardId: 51, userInfoId: 2 },
    ]);
    await own(52, 1);
    const body = { recipientId: 3, expectedVersion: 0, rights: rights({ read: true }) };
    await expect(policy.set('dashboard', 51, 1, body)).rejects.toThrow(ForbiddenException);
    await expect(policy.set('dashboard', 52, 1, body)).rejects.toThrow(ForbiddenException);
    expect(await grants.count()).toBe(0);
  });

  it('requires the recipient to be an active member of the owner organization', async () => {
    const grant = (recipientId: number) =>
      policy.set('source', 101, 1, {
        recipientId,
        expectedVersion: 0,
        rights: rights({ read: true }),
      });
    await expect(grant(4)).rejects.toThrow(ForbiddenException);
    await expect(grant(6)).rejects.toThrow(ForbiddenException);
    await expect(grant(99)).rejects.toThrow(ForbiddenException);
    await users.update(3, { active: false });
    await expect(grant(3)).rejects.toThrow(ForbiddenException);
    expect(await grants.count()).toBe(0);
    expect(await audits.count()).toBe(0);
  });

  it('rejects a stale expectedVersion with a conflict and keeps the stored grant', async () => {
    await policy.set('source', 101, 1, {
      recipientId: 2,
      expectedVersion: 0,
      rights: rights({ read: true }),
    });
    await expect(
      policy.set('source', 101, 1, {
        recipientId: 2,
        expectedVersion: 3,
        rights: rights({ read: true, edit: true }),
      }),
    ).rejects.toThrow(ConflictException);
    expect(
      await grants.findOneByOrFail({ resourceKind: 'source', resourceId: 101, recipientId: 2 }),
    ).toMatchObject({ version: 1, read: true, edit: false });
    expect(await audits.count()).toBe(1);
  });

  it('resolves overlapping version-0 changes with one winner and one conflict', async () => {
    const first = policy.set('source', 101, 1, {
      recipientId: 2,
      expectedVersion: 0,
      rights: rights({ read: true }),
    });
    const second = policy.set('source', 101, 1, {
      recipientId: 2,
      expectedVersion: 0,
      rights: rights({ read: true, edit: true }),
    });
    const settled = await Promise.allSettled([first, second]);
    expect(settled[0]).toMatchObject({ status: 'fulfilled', value: { version: 1 } });
    expect(settled[1].status).toBe('rejected');
    expect((settled[1] as PromiseRejectedResult).reason).toBeInstanceOf(ConflictException);
    expect(await grants.find()).toHaveLength(1);
    expect(await audits.find()).toHaveLength(1);
  });

  it('revokes to a version-2 tombstone that still denies access but keeps listing the recipient', async () => {
    await policy.set('source', 101, 1, {
      recipientId: 2,
      expectedVersion: 0,
      rights: rights({ read: true, edit: true }),
    });
    await expect(policy.assert('source', 101, 2, 'edit')).resolves.toBeUndefined();
    await expect(
      policy.set('source', 101, 1, { recipientId: 2, expectedVersion: 1, rights: rights() }),
    ).resolves.toMatchObject({
      version: 2,
      rights: { read: false, edit: false, publish: false, export: false },
    });

    expect(
      await grants.findOneByOrFail({ resourceKind: 'source', resourceId: 101, recipientId: 2 }),
    ).toMatchObject({ version: 2, read: false, edit: false, publish: false, export: false });
    await expect(policy.assert('source', 101, 2, 'read')).rejects.toThrow(ForbiddenException);
    await expect(policy.capabilities('source', 101, 2)).rejects.toThrow(ForbiddenException);
    await expect(policy.policies('source', 101, 1)).resolves.toEqual({
      kind: 'source',
      resourceId: 101,
      entries: [
        {
          recipientId: 2,
          userId: 'account-2',
          version: 2,
          rights: { read: false, edit: false, publish: false, export: false },
        },
      ],
    });
    expect(await audits.count()).toBe(2);
  });

  it('keeps the owner allowed without a grant and never advertises source publish', async () => {
    for (const action of ['read', 'edit', 'export'] as const)
      await expect(policy.assert('source', 101, 1, action)).resolves.toBeUndefined();
    await expect(policy.assert('source', 101, 2, 'read')).rejects.toThrow(ForbiddenException);
    await expect(policy.capabilities('source', 101, 1)).resolves.toEqual({
      rights: { read: true, edit: true, publish: false, export: true },
    });
    expect(await grants.count()).toBe(0);
  });

  it('keeps read, edit and export independent for each recipient', async () => {
    await policy.set('source', 101, 1, {
      recipientId: 2,
      expectedVersion: 0,
      rights: rights({ read: true, export: true }),
    });
    await policy.set('source', 101, 1, {
      recipientId: 3,
      expectedVersion: 0,
      rights: rights({ read: true, edit: true }),
    });

    await expect(policy.assert('source', 101, 2, 'read')).resolves.toBeUndefined();
    await expect(policy.assert('source', 101, 2, 'export')).resolves.toBeUndefined();
    await expect(policy.assert('source', 101, 2, 'edit')).rejects.toThrow(ForbiddenException);
    await expect(policy.assert('source', 101, 2, 'publish')).rejects.toThrow(ForbiddenException);
    await expect(policy.assert('source', 101, 3, 'read')).resolves.toBeUndefined();
    await expect(policy.assert('source', 101, 3, 'edit')).resolves.toBeUndefined();
    await expect(policy.assert('source', 101, 3, 'export')).rejects.toThrow(ForbiddenException);
  });

  it('denies the granted action when a stored grant lacks read', async () => {
    await grants.insert({
      resourceKind: 'source',
      resourceId: 101,
      recipientId: 2,
      organizationId: 1,
      ownerId: 1,
      version: 4,
      read: false,
      edit: true,
      publish: false,
      export: true,
    });
    await expect(policy.assert('source', 101, 2, 'edit')).rejects.toThrow(ForbiddenException);
    await expect(policy.assert('source', 101, 2, 'export')).rejects.toThrow(ForbiddenException);
    await expect(policy.capabilities('source', 101, 2)).rejects.toThrow(ForbiddenException);
  });

  it('reports capabilities for the acting user and refuses actors without read', async () => {
    await expect(policy.capabilities('source', 101, 2)).rejects.toThrow(ForbiddenException);
    await policy.set('source', 101, 1, {
      recipientId: 2,
      expectedVersion: 0,
      rights: rights({ read: true, export: true }),
    });
    await expect(policy.capabilities('source', 101, 2)).resolves.toEqual({
      rights: { read: true, edit: false, publish: false, export: true },
    });
    await grants.insert({
      resourceKind: 'source',
      resourceId: 101,
      recipientId: 3,
      organizationId: 1,
      ownerId: 1,
      version: 1,
      read: true,
      edit: true,
      publish: true,
      export: true,
    });
    await expect(policy.capabilities('source', 101, 3)).resolves.toEqual({
      rights: { read: true, edit: true, publish: false, export: true },
    });
  });

  it('invalidates a past grant when the owner changes or the recipient leaves the organization', async () => {
    await policy.set('source', 101, 1, {
      recipientId: 2,
      expectedVersion: 0,
      rights: rights({ read: true }),
    });
    await sources.update(101, { ownerId: 3 });
    await expect(policy.assert('source', 101, 2, 'read')).rejects.toThrow(ForbiddenException);

    await sources.update(101, { ownerId: 1 });
    await expect(policy.assert('source', 101, 2, 'read')).resolves.toBeUndefined();
    await memberships.update({ userId: 2 }, { organizationId: 2 });
    await expect(policy.assert('source', 101, 2, 'read')).rejects.toThrow(ForbiddenException);
  });

  it('serializes a concurrent organization write and grant without nesting transactions', async () => {
    const membership = enterprise.update(1, 2, {
      team: 'Operations',
      role: 'member',
      active: true,
      expectedVersion: 1,
    });
    const grant = policy.set('source', 201, 4, {
      recipientId: 5,
      expectedVersion: 0,
      rights: rights({ read: true }),
    });
    const settled = await Promise.allSettled([membership, grant]);

    expect(settled[0]).toMatchObject({ status: 'fulfilled', value: { organizationVersion: 2 } });
    expect(settled[1]).toMatchObject({
      status: 'fulfilled',
      value: { resourceId: 201, version: 1 },
    });
    expect((await memberships.findOneByOrFail({ userId: 2 })).team).toBe('Operations');
    expect((await organizations.findOneByOrFail({ id: 1 })).version).toBe(2);
    // The grant write must not bump any organization version.
    expect((await organizations.findOneByOrFail({ id: 2 })).version).toBe(1);
    expect(await grants.find()).toEqual([
      expect.objectContaining({
        resourceId: 201,
        recipientId: 5,
        organizationId: 2,
        ownerId: 4,
        version: 1,
      }),
    ]);
    expect(await audits.count()).toBe(2);
    expect(await audits.find()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          organizationId: 1,
          actorId: 1,
          action: 'member.updated',
          resourceId: 2,
          version: 2,
        }),
        expect.objectContaining({
          organizationId: 2,
          actorId: 4,
          action: 'source.permissions',
          resourceId: 201,
          subjectId: 5,
          version: 1,
        }),
      ]),
    );
  });

  it('lets a new owner replace the previous owner grant from logical version 0', async () => {
    await memberships.update({ userId: 3 }, { role: 'admin' });
    await policy.set('source', 101, 1, {
      recipientId: 2,
      expectedVersion: 0,
      rights: rights({ read: true }),
    });
    await expect(policy.assert('source', 101, 2, 'read')).resolves.toBeUndefined();

    await sources.update(101, { ownerId: 3 });
    await expect(policy.assert('source', 101, 2, 'read')).rejects.toThrow(ForbiddenException);

    await expect(
      policy.set('source', 101, 3, {
        recipientId: 2,
        expectedVersion: 0,
        rights: rights({ read: true, edit: true }),
      }),
    ).resolves.toMatchObject({
      version: 1,
      rights: { read: true, edit: true, publish: false, export: false },
    });

    expect(await grants.find()).toEqual([
      expect.objectContaining({
        resourceId: 101,
        recipientId: 2,
        organizationId: 1,
        ownerId: 3,
        version: 1,
        read: true,
        edit: true,
      }),
    ]);
    await expect(policy.assert('source', 101, 2, 'read')).resolves.toBeUndefined();
    await expect(policy.assert('source', 101, 2, 'edit')).resolves.toBeUndefined();
    await expect(
      policy.set('source', 101, 3, {
        recipientId: 2,
        expectedVersion: 0,
        rights: rights({ read: true }),
      }),
    ).rejects.toThrow(ConflictException);
    expect(await audits.find()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ actorId: 1, subjectId: 2, version: 1 }),
        expect.objectContaining({ actorId: 3, subjectId: 2, version: 1 }),
      ]),
    );
  });

  it('allows revoking a disabled target while a positive grant to it stays refused', async () => {
    await policy.set('source', 101, 1, {
      recipientId: 3,
      expectedVersion: 0,
      rights: rights({ read: true, edit: true }),
    });
    await users.update(3, { active: false });

    await expect(
      policy.set('source', 101, 1, {
        recipientId: 3,
        expectedVersion: 1,
        rights: rights({ read: true }),
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(
      await grants.findOneByOrFail({ resourceKind: 'source', resourceId: 101, recipientId: 3 }),
    ).toMatchObject({ version: 1, read: true, edit: true });

    await expect(
      policy.set('source', 101, 1, { recipientId: 3, expectedVersion: 1, rights: rights() }),
    ).resolves.toMatchObject({
      version: 2,
      rights: { read: false, edit: false, publish: false, export: false },
    });
    expect(
      await grants.findOneByOrFail({ resourceKind: 'source', resourceId: 101, recipientId: 3 }),
    ).toMatchObject({ version: 2, read: false, edit: false });
    await expect(policy.assert('source', 101, 3, 'edit')).rejects.toThrow(ForbiddenException);

    // Without a prior grant owned by this authority, a revocation still needs a same-organization membership row: foreign and unknown targets stay closed.
    await users.update(5, { active: false });
    await expect(
      policy.set('source', 101, 1, { recipientId: 5, expectedVersion: 0, rights: rights() }),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      policy.set('source', 101, 1, { recipientId: 6, expectedVersion: 0, rights: rights() }),
    ).rejects.toThrow(ForbiddenException);
    expect(await audits.count()).toBe(2);
  });

  it('pages manageable resources in a fixed kind and id order without connection data', async () => {
    const owned = Array.from({ length: 21 }, (_, index) => ({
      id: 100 + index,
      title: `Dashboard ${100 + index}`,
      delYn: 'N',
    }));
    await dashboards.save(owned);
    await mappings.save(owned.map(row => ({ dashboardId: row.id, userInfoId: 1 })));

    const first = await policy.resources(1);
    expect(first.entries).toHaveLength(20);
    expect(first.entries.map(entry => `${entry.kind}:${entry.id}`)).toEqual(
      owned.slice(0, 20).map(row => `dashboard:${row.id}`),
    );
    expect(first.nextAfter).toBe('dashboard:119');

    const second = await policy.resources(1, first.nextAfter);
    expect(second.entries.map(entry => `${entry.kind}:${entry.id}`)).toEqual([
      'dashboard:120',
      'source:101',
      'source:102',
    ]);
    expect(second.entries.map(entry => entry.label)).toEqual([
      'Dashboard 120',
      'Synthetic source 101',
      'Synthetic source 102',
    ]);
    expect(second.nextAfter).toBeNull();
    expect(JSON.stringify([first, second])).not.toMatch(
      /connectionConfig|synthetic\.invalid|synthetic-secret/,
    );
  });

  it('refuses non-admin listings and malformed cursors and hides unmanageable resources', async () => {
    await expect(policy.resources(2)).rejects.toThrow(ForbiddenException);
    await expect(policy.resources(6)).rejects.toThrow(ForbiddenException);
    await expect(policy.resources(1, 'dashboard:0')).rejects.toThrow(BadRequestException);
    await expect(policy.resources(1, 'table:1')).rejects.toThrow(BadRequestException);
    await expect(policy.resources(1, 'source:1x')).rejects.toThrow(BadRequestException);

    await dashboards.save([
      { id: 51, title: 'Solo dashboard', delYn: 'N' },
      { id: 52, title: 'Shared dashboard', delYn: 'N' },
      { id: 53, title: 'Deleted dashboard', delYn: 'Y' },
    ]);
    await mappings.save([
      { dashboardId: 51, userInfoId: 1 },
      { dashboardId: 52, userInfoId: 1 },
      { dashboardId: 52, userInfoId: 2 },
      { dashboardId: 53, userInfoId: 1 },
    ]);

    const page = await policy.resources(1);
    expect(page.entries.map(entry => `${entry.kind}:${entry.id}`)).toEqual([
      'dashboard:51',
      'source:101',
      'source:102',
    ]);
    expect(page.nextAfter).toBeNull();
  });

  it('lists the current grants for the owner admin only', async () => {
    await policy.set('source', 101, 1, {
      recipientId: 2,
      expectedVersion: 0,
      rights: rights({ read: true, edit: true }),
    });
    await policy.set('source', 101, 1, {
      recipientId: 3,
      expectedVersion: 0,
      rights: rights({ read: true }),
    });

    await expect(policy.policies('source', 101, 1)).resolves.toEqual({
      kind: 'source',
      resourceId: 101,
      entries: [
        {
          recipientId: 2,
          userId: 'account-2',
          version: 1,
          rights: { read: true, edit: true, publish: false, export: false },
        },
        {
          recipientId: 3,
          userId: 'account-3',
          version: 1,
          rights: { read: true, edit: false, publish: false, export: false },
        },
      ],
    });
    await expect(policy.policies('source', 101, 2)).rejects.toThrow(ForbiddenException);
    await expect(policy.policies('source', 101, 4)).rejects.toThrow(ForbiddenException);
    await expect(policy.policies('source', 101, 99)).rejects.toThrow(ForbiddenException);
  });

  it('keeps SourceAccess owner-only by default and gates dashboards on their own source grants', async () => {
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

    await expect(access.assert('database', 101, 2)).rejects.toThrow(ForbiddenException);
    await expect(new SourceAccessService(db).assert('database', 101, 2, 'read')).rejects.toThrow(
      ForbiddenException,
    );

    await policy.set('source', 101, 1, {
      recipientId: 2,
      expectedVersion: 0,
      rights: rights({ read: true }),
    });
    await expect(access.assert('database', 101, 2, 'read')).resolves.toBeUndefined();
    await expect(access.assert('database', 101, 2, 'edit')).rejects.toThrow(ForbiddenException);

    await policy.set('dashboard', 51, 1, {
      recipientId: 3,
      expectedVersion: 0,
      rights: rights({ read: true }),
    });
    await expect(access.assert('dashboard', 51, 3, 'read')).rejects.toThrow(ForbiddenException);
    await policy.set('source', 101, 1, {
      recipientId: 3,
      expectedVersion: 0,
      rights: rights({ read: true }),
    });
    await expect(access.assert('dashboard', 51, 3, 'read')).resolves.toBeUndefined();
    await expect(access.readableSourceIds(3)).resolves.toEqual([101]);
    await expect(access.readableDashboardIds(3)).resolves.toEqual([51]);
  });
  it('keeps an orphaned grant visible and revocable so recreated membership cannot re-arm it', async () => {
    await policy.set('source', 101, 1, {
      recipientId: 2,
      expectedVersion: 0,
      rights: rights({ read: true }),
    });
    const membership = await memberships.findOneByOrFail({ userId: 2 });
    await memberships.delete({ userId: 2 });
    const listed = await policy.policies('source', 101, 1);
    expect(listed.entries).toHaveLength(1);
    expect(listed.entries[0]).toMatchObject({ recipientId: 2, version: 1 });
    expect(listed.entries[0].userId).toContain('#2');
    await expect(
      policy.set('source', 101, 1, { recipientId: 2, expectedVersion: 1, rights: rights() }),
    ).resolves.toMatchObject({ version: 2 });
    await expect(
      policy.set('source', 101, 1, {
        recipientId: 2,
        expectedVersion: 2,
        rights: rights({ read: true }),
      }),
    ).rejects.toThrow(ForbiddenException);
    await memberships.save(membership);
    await expect(policy.assert('source', 101, 2, 'read')).rejects.toThrow(ForbiddenException);
    expect(await audits.count()).toBe(2);
  });
  it('keeps the readable source list consistent with detail authorization across identity changes', async () => {
    for (const sourceId of [101, 102])
      await policy.set('source', sourceId, 1, {
        recipientId: 2,
        expectedVersion: 0,
        rights: rights({ read: true }),
      });
    const assertEquivalent = async () => {
      const allowed: number[] = [];
      for (const sourceId of [101, 102]) {
        try {
          await policy.assert('source', sourceId, 2, 'read');
          allowed.push(sourceId);
        } catch (error) {
          expect(error).toBeInstanceOf(ForbiddenException);
        }
      }
      expect(await policy.sourceIds(2)).toEqual(allowed);
    };
    await assertEquivalent();
    await users.update(1, { active: false });
    await assertEquivalent();
    await users.update(1, { active: true });
    await memberships.update(2, { organizationId: 2 });
    await assertEquivalent();
    await memberships.update(2, { organizationId: 1 });
    await sources.update(101, { ownerId: 4 });
    await assertEquivalent();
    await users.update(2, { active: false });
    await assertEquivalent();
  });
  it('rechecks owner activity for explicit actions used by anonymous publication reads', async () => {
    await dashboards.save({
      id: 51,
      title: 'Synthetic dashboard',
      layout: '[]',
      analysisDefinition: JSON.stringify({ databaseId: 101 }),
    });
    await own(51, 1);
    await expect(access.assert('database', 101, 1, 'read')).resolves.toBeUndefined();
    await expect(access.dashboard(51, 1, 'publish')).resolves.toBeUndefined();
    await users.update(1, { active: false });
    await expect(access.assert('database', 101, 1, 'read')).rejects.toThrow(ForbiddenException);
    await expect(access.dashboard(51, 1, 'publish')).rejects.toThrow(ForbiddenException);
  });
});
