import { SourceCatalogEntry } from '../bi/entities/source-catalog-entry.entity';
import { EnterpriseGroupDelivery } from '../enterprise/entities/enterprise-group-delivery.entity';
import {
  EnterpriseGroup,
  EnterpriseGroupMember,
  EnterpriseGroupGrant,
} from '../enterprise/entities/enterprise-group.entity';
import { EnterpriseDashboardDelivery } from '../enterprise/entities/enterprise-dashboard-delivery.entity';
jest.mock('../ai/ai.service', () => ({ AiService: class {} }));
import { ForbiddenException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EnterpriseMembership } from '../enterprise/entities/enterprise-membership.entity';
import { EnterpriseResourceGrant } from '../enterprise/entities/enterprise-resource-grant.entity';
import { EnterpriseResourcePolicyService } from '../enterprise/resource-policy.service';
import { SourceAccessService } from '../ownership/source-access.service';
import { Dashboard } from '../dashboard/entities/dashboard.entity';
import { DashboardWidget } from '../dashboard/dashboard-widget/entities/dashboard-widget.entity';
import { Database } from '../database/entities/database.entity';
import { User } from '../user/entities/user.entity';
import { UserMapping } from '../user/entities/user-mapping.entity';
import { StudioService } from './studio.service';
import { StudioPublicationService } from './studio-publication.service';
import { StudioPublication, StudioPublicationRequest } from './entities/studio-publication.entity';

/**
 * UC-051: dashboard/Studio actions consume the explicit grant for that action only, keep every
 * linked source as a separate read dependency, and never move the original owner mapping.
 */
const OWNER = 7;
const READER = 8;
const EDITOR = 9;
const DASHBOARD = 51;
const SOURCE = 1;
const ORGANIZATION = 1;

const rights = (over: Partial<Record<'read' | 'edit' | 'publish' | 'export', boolean>>) => ({
  read: false,
  edit: false,
  publish: false,
  export: false,
  ...over,
});

describe('UC-051 dashboard resource access', () => {
  let db: DataSource;
  let studio: StudioService;
  let publications: StudioPublicationService;

  /** Grants are inserted directly; the administration API is covered by the policy service tests. */
  const grant = (
    kind: 'source' | 'dashboard',
    resourceId: number,
    recipientId: number,
    given: ReturnType<typeof rights>,
    version = 1,
  ) =>
    db.getRepository(EnterpriseResourceGrant).save({
      resourceKind: kind,
      resourceId,
      recipientId,
      organizationId: ORGANIZATION,
      ownerId: OWNER,
      version,
      ...given,
    });

  const readDashboard = async (actor: number) => {
    const pinned = jest
      .spyOn(studio as any, 'getPinned')
      .mockResolvedValue({ document: { blocks: [] }, sourceRevision: 'revision', definitions: {} });
    try {
      return (await studio.get(DASHBOARD, actor)) as any;
    } finally {
      pinned.mockRestore();
    }
  };

  beforeAll(async () => {
    db = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      synchronize: true,
      entities: [
        SourceCatalogEntry,
        User,
        Dashboard,
        DashboardWidget,
        Database,
        UserMapping,
        EnterpriseMembership,
        EnterpriseResourceGrant,
        EnterpriseGroup,
        EnterpriseGroupMember,
        EnterpriseGroupGrant,
        EnterpriseDashboardDelivery,
        EnterpriseGroupDelivery,
        StudioPublication,
        StudioPublicationRequest,
      ],
    }).initialize();
    await db.getRepository(User).save([
      { id: OWNER, userId: 'owner', email: 'owner@example.com', password: 'x', active: true },
      { id: READER, userId: 'reader', email: 'reader@example.com', password: 'x', active: true },
      { id: EDITOR, userId: 'editor', email: 'editor@example.com', password: 'x', active: true },
    ]);
    await db.getRepository(EnterpriseMembership).save([
      { userId: OWNER, organizationId: ORGANIZATION, role: 'admin', team: '' },
      { userId: READER, organizationId: ORGANIZATION, role: 'member', team: '' },
      { userId: EDITOR, organizationId: ORGANIZATION, role: 'member', team: '' },
    ]);
    await db.getRepository(Database).save({
      id: SOURCE,
      ownerId: OWNER,
      name: 'Source',
      connectionConfig: '{}',
      engine: 'duckdb',
      type: 'FILE',
    });
    await db.getRepository(Dashboard).save({
      id: DASHBOARD,
      title: 'Saved dashboard',
      delYn: 'N',
      analysisDefinition: JSON.stringify({ databaseId: SOURCE }),
    });
    await db.getRepository(UserMapping).save({ dashboardId: DASHBOARD, userInfoId: OWNER });
    const access = new SourceAccessService(db, new EnterpriseResourcePolicyService(db));
    studio = new StudioService(
      db,
      { analysis: jest.fn(async () => ({ data: { databaseId: SOURCE } })) } as any,
      {
        withDuckDBSnapshot: (_id: number, run: () => any) => run(),
        captureDuckDBSnapshot: async () => ({ run: async (run: () => any) => run() }),
      } as any,
      access,
    );
    publications = new StudioPublicationService(db, studio, access);
  });

  afterAll(async () => {
    if (db?.isInitialized) await db.destroy();
  });

  it('honors dashboard read while denying reader save and publish', async () => {
    await grant('dashboard', DASHBOARD, READER, rights({ read: true }));
    await grant('source', SOURCE, READER, rights({ read: true }));

    const read = await readDashboard(READER);
    expect(read.access).toEqual({ read: true, edit: false, publish: false, export: false });
    expect(read.owned).toBe(false);

    await expect(studio.prepare(DASHBOARD, {}, READER)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(studio.save(DASHBOARD, {}, READER)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(studio.assertPublicationOwner(DASHBOARD, READER)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(
      studio.assertExecutionAccess(DASHBOARD, SOURCE, READER, 'edit'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('accepts an edit grant for edit actions only, never for publication', async () => {
    await grant('dashboard', DASHBOARD, EDITOR, rights({ read: true, edit: true }));
    await grant('source', SOURCE, EDITOR, rights({ read: true }));

    await expect(
      studio.assertExecutionAccess(DASHBOARD, SOURCE, EDITOR, 'edit'),
    ).resolves.toBeUndefined();
    await expect(
      studio.assertExecutionAccess(DASHBOARD, SOURCE, EDITOR, 'read'),
    ).resolves.toBeUndefined();
    await expect(studio.assertPublicationOwner(DASHBOARD, EDITOR)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    const read = await readDashboard(EDITOR);
    expect(read.access).toEqual({ read: true, edit: true, publish: false, export: false });
  });

  it('blocks the dashboard once the separately granted linked source read is revoked', async () => {
    await grant('dashboard', DASHBOARD, READER, rights({ read: true }), 2);
    await grant('source', SOURCE, READER, rights({ read: true }), 2);
    await expect(
      studio.assertExecutionAccess(DASHBOARD, SOURCE, READER, 'read'),
    ).resolves.toBeUndefined();

    await grant('source', SOURCE, READER, rights({ read: false }), 3);
    await expect(studio.get(DASHBOARD, READER)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      studio.assertExecutionAccess(DASHBOARD, SOURCE, READER, 'read'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('keeps the original owner mapping and owner rights after granting another account', async () => {
    const before = await db.getRepository(UserMapping).find();
    await grant('dashboard', DASHBOARD, READER, rights({ read: true, edit: true, publish: true }));
    const after = await db.getRepository(UserMapping).find();
    expect(before.map(row => row.userInfoId)).toEqual(after.map(row => row.userInfoId));
    expect(after).toHaveLength(1);
    expect(after[0]).toMatchObject({ dashboardId: DASHBOARD, userInfoId: OWNER });

    const owner = await readDashboard(OWNER);
    expect(owner.access).toEqual({ read: true, edit: true, publish: true, export: true });
    expect(owner.owned).toBe(true);
    await expect(studio.assertPublicationOwner(DASHBOARD, OWNER)).resolves.toBeUndefined();
  });

  it('closes an existing public link once the publisher publish grant is revoked', async () => {
    const token = 'a'.repeat(64);
    await grant('dashboard', DASHBOARD, EDITOR, rights({ read: true, publish: true }), 2);
    await grant('source', SOURCE, EDITOR, rights({ read: true }), 2);
    await db.getRepository(StudioPublication).save({
      token,
      actorId: EDITOR,
      dashboardId: DASHBOARD,
      sourceId: SOURCE,
      version: 1,
      visibility: 'link',
      allowRemix: true,
      expiresAt: null,
      revokedAt: null,
      asOf: new Date().toISOString(),
      dataVersion: 'data',
      snapshot: '{}',
      remixTemplate: '{}',
    });
    await expect(publications.read(token)).resolves.toMatchObject({ token });

    // The publisher keeps read but loses publish: the anonymous read must stop serving.
    await grant('dashboard', DASHBOARD, EDITOR, rights({ read: true, publish: false }), 3);
    await expect(publications.read(token)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(publications.requireRemix(token, READER)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
  it('rechecks current group membership and activation for existing anonymous publication and remix reads', async () => {
    await grant('dashboard', DASHBOARD, EDITOR, rights({ read: true, publish: false }), 99);
    await grant('source', SOURCE, EDITOR, rights({ read: true }), 99);
    await db.manager.save(EnterpriseGroup, {
      id: 801,
      organizationId: ORGANIZATION,
      name: 'Publishers',
      nameKey: 'publishers',
      active: true,
      version: 1,
    });
    await db.manager.save(EnterpriseGroupMember, { groupId: 801, userId: EDITOR });
    await db.manager.save(EnterpriseGroupGrant, {
      resourceKind: 'dashboard',
      resourceId: DASHBOARD,
      groupId: 801,
      organizationId: ORGANIZATION,
      ownerId: OWNER,
      version: 1,
      ...rights({ read: true, publish: true }),
    });
    const token = 'b'.repeat(64);
    await db.manager.save(StudioPublication, {
      token,
      actorId: EDITOR,
      dashboardId: DASHBOARD,
      sourceId: SOURCE,
      version: 1,
      visibility: 'link',
      allowRemix: true,
      expiresAt: null,
      revokedAt: null,
      asOf: new Date().toISOString(),
      dataVersion: 'synthetic-data',
      snapshot: '{}',
      remixTemplate: '{}',
    });
    await expect(publications.read(token)).resolves.toMatchObject({ token });
    await expect(publications.requireRemix(token, READER)).resolves.toMatchObject({ token });
    await db.manager.delete(EnterpriseGroupMember, { groupId: 801, userId: EDITOR });
    await expect(publications.read(token)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(publications.requireRemix(token, READER)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await db.manager.save(EnterpriseGroupMember, { groupId: 801, userId: EDITOR });
    await db.manager.update(EnterpriseGroup, 801, { active: false });
    await expect(publications.read(token)).rejects.toBeInstanceOf(ForbiddenException);
    await db.manager.update(EnterpriseGroup, 801, { active: true });
    await expect(publications.read(token)).resolves.toMatchObject({ token });
  });
});
