import { EnterpriseNotificationAudience } from './entities/enterprise-notification-audience.entity';
import { EnterpriseGroupDelivery } from './entities/enterprise-group-delivery.entity';
import {
  EnterpriseGroup,
  EnterpriseGroupMember,
  EnterpriseGroupGrant,
} from './entities/enterprise-group.entity';
import { EnterpriseDashboardDelivery } from './entities/enterprise-dashboard-delivery.entity';
import { EnterpriseNotificationState } from './entities/enterprise-notification-state.entity';
import { EnterpriseNotificationService } from './notification.service';
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
import { EnterpriseGroupService } from './group.service';
import * as staffLock from './staff-write-lock';
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
  let groupService: EnterpriseGroupService;
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
        EnterpriseNotificationState,
        User,
        UserMapping,
        EnterpriseOrganization,
        EnterpriseMembership,
        EnterpriseAuditEvent,
        EnterpriseNotificationAudience,
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
    enterprise = new EnterpriseService(db);
    groupService = new EnterpriseGroupService(db);
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
    await db.getRepository(EnterpriseNotificationState).clear();
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

  it('UC055 refuses direct/group Source grants after parent deletion without grant or audit inserts', async () => {
    await sources.delete(101);
    await expect(
      policy.set('source', 101, 1, {
        recipientId: 2,
        expectedVersion: 0,
        rights: rights({ read: true }),
      }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      policy.setGroupPolicy('source', 101, 1, {
        groupId: 1,
        expectedVersion: 0,
        expectedGroupVersion: 1,
        rights: rights({ read: true }),
      }),
    ).rejects.toMatchObject({ status: 403 });
    expect(await grants.count()).toBe(0);
    expect(await db.manager.count(EnterpriseGroupGrant)).toBe(0);
    expect(await audits.count()).toBe(0);
  });
  it('denies inactive dashboard owner/granted rights and read discovery while preserving admin management', async () => {
    await dashboards.save({ id: 51, title: 'Lifecycle parent' });
    await own(51, 1);
    await policy.set('dashboard', 51, 1, {
      recipientId: 2,
      expectedVersion: 0,
      rights: rights({ read: true, edit: true, publish: true, export: true }),
    });
    await dashboards.update(51, { assetActive: false });
    for (const action of ['read', 'edit', 'publish', 'export'] as const) {
      await expect(policy.assert('dashboard', 51, 1, action)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      await expect(policy.assert('dashboard', 51, 2, action)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    }
    await expect(access.dashboard(51, 1)).rejects.toBeInstanceOf(ForbiddenException);
    expect(await policy.dashboardIds(2)).not.toContain(51);
    expect((await policy.resources(1)).entries).toContainEqual({
      kind: 'dashboard',
      id: 51,
      label: 'Lifecycle parent',
    });
    await expect(policy.assertManagement('dashboard', 51, 1)).resolves.toBeUndefined();
    await policy.set('dashboard', 51, 1, {
      recipientId: 2,
      expectedVersion: 1,
      rights: rights({}),
    });
    expect((await dashboards.findOneBy({ id: 51 })).assetActive).toBe(false);
  });
  it('permits only owner-admin inactive revocation without Source read and restores normal active checks', async () => {
    await dashboards.save({
      id: 51,
      title: 'Lifecycle recovery',
      assetActive: false,
      analysisDefinition: JSON.stringify({ databaseId: 999 }),
    });
    await own(51, 1);
    const sourceRead = jest.spyOn(access, 'assert');
    await expect(access.dashboardRevocation(51, 1, 'publish')).resolves.toBeUndefined();
    expect(sourceRead).not.toHaveBeenCalled();
    await expect(access.dashboardRevocation(51, 2, 'publish')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await dashboards.update(51, { assetActive: true });
    await expect(access.dashboardRevocation(51, 1, 'publish')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    sourceRead.mockRestore();
  });
  it('projects committed grant changes and preserves grants while personal notifications are removed', async () => {
    const notifications = new EnterpriseNotificationService(db);
    await policy.set('source', 101, 1, {
      recipientId: 2,
      expectedVersion: 0,
      rights: rights({ read: true, edit: true }),
    });
    const first = await notifications.list(2);
    expect(first.entries).toHaveLength(1);
    const priorGrant = await grants.find();
    await notifications.mark(2, first.entries[0].id, 'read');
    await notifications.mark(2, first.entries[0].id, 'remove');
    expect(await grants.find()).toEqual(priorGrant);
    await policy.assert('source', 101, 2, 'edit');
    await expect(
      policy.set('source', 101, 1, {
        recipientId: 2,
        expectedVersion: 0,
        rights: rights({ read: true }),
      }),
    ).rejects.toThrow(ConflictException);
    expect((await notifications.list(2)).entries).toEqual([]);
    await policy.set('source', 101, 1, { recipientId: 2, expectedVersion: 1, rights: rights({}) });
    const after = await notifications.list(2);
    expect(after.entries).toHaveLength(1);
    expect(after.entries[0]).toMatchObject({ resourceId: 101, version: 2, read: false });
    await expect(policy.assert('source', 101, 2, 'read')).rejects.toThrow(ForbiddenException);
    expect(await audits.count()).toBe(2);
  });

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

  /** Who may give or take away rights: an administrator of the owner's organization, whoever owns it. */
  describe('granting on a resource someone else owns', () => {
    const read = rights({ read: true });
    const readEdit = rights({ read: true, edit: true });
    beforeEach(async () => {
      // The file's own setup does not clear the group tables.
      await db.manager.clear(EnterpriseGroupGrant);
      await db.manager.clear(EnterpriseGroupMember);
      await db.manager.clear(EnterpriseGroup);
      await dashboards.save({ id: 61, title: 'Owned by account 2' });
      await own(61, 2);
    });

    it('lets an administrator grant on a member owned dashboard and the recipient actually gets it', async () => {
      await expect(
        policy.set('dashboard', 61, 1, { recipientId: 3, expectedVersion: 0, rights: readEdit }),
      ).resolves.toMatchObject({ resourceId: 61, recipientId: 3, version: 1 });
      // Stored under the owner, which is where the readers look for it.
      expect(await grants.find()).toEqual([
        expect.objectContaining({ resourceId: 61, recipientId: 3, organizationId: 1, ownerId: 2 }),
      ]);
      await expect(policy.assert('dashboard', 61, 3, 'edit')).resolves.toBeUndefined();
      await expect(policy.assert('dashboard', 61, 3, 'publish')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(await policy.dashboardIds(3)).toContain(61);
    });

    it('lists the grants the administrator made on it', async () => {
      await policy.set('dashboard', 61, 1, { recipientId: 3, expectedVersion: 0, rights: read });
      await expect(policy.policies('dashboard', 61, 1)).resolves.toMatchObject({
        entries: [{ recipientId: 3, version: 1, rights: read }],
      });
    });

    it('lets a different administrator take the grant away', async () => {
      // Account 3 becomes a second administrator; account 5 joins organization A as a member.
      await memberships.update({ userId: 3 }, { role: 'admin' });
      await memberships.save({ userId: 5, organizationId: 1, role: 'member', team: '' });
      await policy.set('dashboard', 61, 1, { recipientId: 5, expectedVersion: 0, rights: read });
      await expect(policy.assert('dashboard', 61, 5, 'read')).resolves.toBeUndefined();
      // Account 3 revokes what account 1 granted: the grant belongs to the resource, not the granter.
      await expect(
        policy.set('dashboard', 61, 3, { recipientId: 5, expectedVersion: 1, rights: rights() }),
      ).resolves.toMatchObject({ recipientId: 5, version: 2 });
      await expect(policy.assert('dashboard', 61, 5, 'read')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('does not let the owner, who is not an administrator, give rights on their own dashboard', async () => {
      await expect(
        policy.set('dashboard', 61, 2, { recipientId: 3, expectedVersion: 0, rights: read }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(await grants.count()).toBe(0);
    });

    it('does not let an administrator of another organization give rights', async () => {
      await expect(
        policy.set('dashboard', 61, 4, { recipientId: 5, expectedVersion: 0, rights: read }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(await grants.count()).toBe(0);
    });

    it('does not let an administrator give rights on a dashboard whose owner belongs to no organization', async () => {
      await dashboards.save({ id: 62, title: 'Owned by an outsider' });
      await own(62, 6);
      await expect(
        policy.set('dashboard', 62, 1, { recipientId: 3, expectedVersion: 0, rights: read }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(await grants.count()).toBe(0);
    });

    it('does not let an administrator give rights on a dashboard whose owner is in another organization', async () => {
      await dashboards.save({ id: 63, title: 'Owned in organization B' });
      await own(63, 5);
      await expect(
        policy.set('dashboard', 63, 1, { recipientId: 3, expectedVersion: 0, rights: read }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(await grants.count()).toBe(0);
    });

    it('refuses a grant to the owner, who already holds every right, and writes nothing', async () => {
      await expect(
        policy.set('dashboard', 61, 1, { recipientId: 2, expectedVersion: 0, rights: read }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(await grants.count()).toBe(0);
      expect(await audits.count()).toBe(0);
    });

    it('still refuses the administrator a grant to themselves', async () => {
      await expect(
        policy.set('dashboard', 61, 1, { recipientId: 1, expectedVersion: 0, rights: read }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('records who granted and to whom, and traces the owner when someone else granted', async () => {
      await policy.set('dashboard', 61, 1, { recipientId: 3, expectedVersion: 0, rights: read });
      expect(await audits.find({ order: { id: 'ASC' } })).toEqual([
        expect.objectContaining({
          action: 'dashboard.permissions',
          actorId: 1,
          subjectId: 3,
          resourceId: 61,
        }),
        expect.objectContaining({
          action: 'dashboard.permissions.owner',
          actorId: 1,
          subjectId: 2,
          resourceId: 61,
        }),
      ]);
    });

    it('writes no owner event when the owner administrator grants on their own resource', async () => {
      await dashboards.save({ id: 64, title: 'Owned by the administrator' });
      await own(64, 1);
      await policy.set('dashboard', 64, 1, { recipientId: 3, expectedVersion: 0, rights: read });
      expect((await audits.find()).map(a => a.action)).toEqual(['dashboard.permissions']);
    });

    it('lets an administrator take away a grant that was made out to the owner, though a new one is refused', async () => {
      await grants.save({
        resourceKind: 'dashboard',
        resourceId: 61,
        recipientId: 2,
        organizationId: 1,
        ownerId: 2,
        version: 1,
        read: true,
        edit: false,
        publish: false,
        export: false,
      });
      await expect(
        policy.set('dashboard', 61, 1, { recipientId: 2, expectedVersion: 0, rights: read }),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        policy.set('dashboard', 61, 1, { recipientId: 2, expectedVersion: 1, rights: rights() }),
      ).resolves.toMatchObject({ recipientId: 2, version: 2 });
    });

    it('refuses when the owner changed while the grant was being prepared', async () => {
      const original = (policy as any).resource.bind(policy);
      let calls = 0;
      const spy = jest
        .spyOn(policy as any, 'resource')
        .mockImplementation(async (...args: any[]) => {
          const row = await original(...args);
          calls += 1;
          // The first read (to know whom to lock) sees account 2; the confirmation sees someone else.
          return calls === 1 ? row : { ...row, ownerId: 3 };
        });
      try {
        await expect(
          policy.set('dashboard', 61, 1, { recipientId: 5, expectedVersion: 0, rights: read }),
        ).rejects.toBeInstanceOf(ConflictException);
      } finally {
        spy.mockRestore();
      }
      expect(await grants.count()).toBe(0);
    });

    it('starts over cleanly when the owner changed since an older grant', async () => {
      // Source 101 is owned by account 1. A grant made then is stored under account 1.
      await policy.set('source', 101, 1, { recipientId: 3, expectedVersion: 0, rights: read });
      await sources.update(101, { ownerId: 2 });
      // Under the new owner the old row is not listed, does not grant anything, and a new grant starts at 0.
      await expect(policy.policies('source', 101, 1)).resolves.toMatchObject({ entries: [] });
      await expect(policy.assert('source', 101, 3, 'read')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      await expect(
        policy.set('source', 101, 1, { recipientId: 3, expectedVersion: 0, rights: read }),
      ).resolves.toMatchObject({ recipientId: 3, version: 1 });
      expect(await grants.find()).toEqual([
        expect.objectContaining({ recipientId: 3, ownerId: 2 }),
      ]);
      await expect(policy.assert('source', 101, 3, 'read')).resolves.toBeUndefined();
    });

    it('keeps delivery and lifecycle management with the owner administrator', async () => {
      await expect(policy.assertManagement('dashboard', 61, 1)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('grants a group right under the owner too, and lists it', async () => {
      await db.manager.save(EnterpriseGroup, {
        id: 1,
        organizationId: 1,
        name: 'analysts',
        nameKey: 'analysts',
        active: true,
        version: 1,
      });
      await expect(
        policy.setGroupPolicy('dashboard', 61, 1, {
          groupId: 1,
          expectedVersion: 0,
          expectedGroupVersion: 1,
          rights: read,
        }),
      ).resolves.toMatchObject({ resourceId: 61, groupId: 1, version: 1 });
      expect(await db.manager.find(EnterpriseGroupGrant)).toEqual([
        expect.objectContaining({ resourceId: 61, groupId: 1, ownerId: 2, organizationId: 1 }),
      ]);
      await expect(policy.groupPolicies('dashboard', 61, 1)).resolves.toMatchObject({
        entries: [{ groupId: 1, version: 1, rights: read }],
      });
    });

    describe('what the group path and the locks leave behind', () => {
      const makeGroup = () =>
        db.manager.save(EnterpriseGroup, {
          id: 1,
          organizationId: 1,
          name: 'g1',
          nameKey: 'g1',
          active: true,
          version: 1,
        });
      const groupBody = (expectedVersion: number, granted = read) => ({
        groupId: 1,
        expectedVersion,
        expectedGroupVersion: 1,
        rights: granted,
      });

      it('refuses a group grant when the owner changed while it was being prepared', async () => {
        await makeGroup();
        const original = (policy as any).resource.bind(policy);
        let calls = 0;
        const spy = jest
          .spyOn(policy as any, 'resource')
          .mockImplementation(async (...args: any[]) => {
            const row = await original(...args);
            calls += 1;
            return calls === 1 ? row : { ...row, ownerId: 3 };
          });
        try {
          await expect(
            policy.setGroupPolicy('dashboard', 61, 1, groupBody(0)),
          ).rejects.toBeInstanceOf(ConflictException);
        } finally {
          spy.mockRestore();
        }
        expect(await db.manager.count(EnterpriseGroupGrant)).toBe(0);
      });

      it('traces the owner of a group grant made by someone else', async () => {
        await makeGroup();
        await policy.setGroupPolicy('dashboard', 61, 1, groupBody(0));
        expect(
          (await audits.find({ order: { id: 'ASC' } })).map(a => [a.action, a.subjectId]),
        ).toEqual([
          ['dashboard.group-permissions', 1],
          ['dashboard.group-permissions.owner', 2],
        ]);
      });

      it('lets an administrator who belongs to a group take rights away from it', async () => {
        await makeGroup();
        await db.manager.save(EnterpriseGroupMember, { groupId: 1, userId: 1 });
        // A leftover row from before the rule; turning rights off must stay possible.
        await db.manager.save(EnterpriseGroupGrant, {
          resourceKind: 'dashboard',
          resourceId: 61,
          groupId: 1,
          ownerId: 2,
          organizationId: 1,
          version: 1,
          read: true,
          edit: false,
          publish: false,
          export: false,
        });
        await expect(
          policy.setGroupPolicy('dashboard', 61, 1, groupBody(1, rights())),
        ).resolves.toMatchObject({ groupId: 1, version: 2 });
      });

      it('locks the actor, the recipient and the owner together before reading the authority', async () => {
        const spy = jest.spyOn(staffLock, 'lockStaffWrite');
        try {
          await policy.set('dashboard', 61, 1, {
            recipientId: 3,
            expectedVersion: 0,
            rights: read,
          });
          await makeGroup();
          await policy.setGroupPolicy('dashboard', 61, 1, groupBody(0));
          expect(spy.mock.calls.map(call => call[1])).toEqual([
            [1, 3, 2],
            [1, 2],
          ]);
        } finally {
          spy.mockRestore();
        }
      });
    });

    describe('an administrator and a group they belong to', () => {
      const group = (id = 1) =>
        db.manager.save(EnterpriseGroup, {
          id,
          organizationId: 1,
          name: `g${id}`,
          nameKey: `g${id}`,
          active: true,
          version: 1,
        });
      const grantGroup = (resourceId: number, groupId = 1, granted = read) =>
        policy.setGroupPolicy('dashboard', resourceId, 1, {
          groupId,
          expectedVersion: 0,
          expectedGroupVersion: 1,
          rights: granted,
        });
      const setMembers = (memberIds: number[], extra: Record<string, unknown> = {}) =>
        groupService.set(1, 1, {
          expectedVersion: 1,
          name: 'g1',
          active: true,
          memberIds,
          ...extra,
        });

      it('refuses to give a group the administrator belongs to a right on someone else resource', async () => {
        await group();
        await db.manager.save(EnterpriseGroupMember, { groupId: 1, userId: 1 });
        await expect(grantGroup(61)).rejects.toBeInstanceOf(ForbiddenException);
        expect(await db.manager.count(EnterpriseGroupGrant)).toBe(0);
        expect(await audits.count()).toBe(0);
      });

      it('allows it for a group the administrator does not belong to, and for their own resource', async () => {
        await group();
        await db.manager.save(EnterpriseGroupMember, { groupId: 1, userId: 3 });
        await expect(grantGroup(61)).resolves.toMatchObject({ groupId: 1, version: 1 });
        await db.manager.save(EnterpriseGroupMember, { groupId: 1, userId: 1 });
        await dashboards.save({ id: 65, title: 'Mine' });
        await own(65, 1);
        await expect(grantGroup(65)).resolves.toMatchObject({ resourceId: 65, version: 1 });
      });

      it('refuses to put the administrator into a group that holds someone else resource right', async () => {
        await group();
        await grantGroup(61);
        await expect(setMembers([1, 3])).rejects.toBeInstanceOf(ForbiddenException);
        expect(await db.manager.count(EnterpriseGroupMember)).toBe(0);
        // Others can still be added.
        await expect(setMembers([3])).resolves.toBeDefined();
      });

      it('refuses to switch on a group that already holds the administrator and such a right', async () => {
        await group();
        await grantGroup(61);
        await db.manager.save(EnterpriseGroupMember, { groupId: 1, userId: 1 });
        await db.manager.update(EnterpriseGroup, { id: 1 }, { active: false });
        await expect(
          setMembers([1, 3], { expectedVersion: 1, active: true }),
        ).rejects.toBeInstanceOf(ForbiddenException);
      });

      it('lets the administrator join a group that holds only rights on their own resources', async () => {
        await group();
        await dashboards.save({ id: 65, title: 'Mine' });
        await own(65, 1);
        await grantGroup(65);
        await expect(setMembers([1, 3])).resolves.toBeDefined();
      });
    });
  });
});
