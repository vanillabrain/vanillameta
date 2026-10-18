import {
  EnterpriseGroup,
  EnterpriseGroupMember,
  EnterpriseGroupGrant,
} from '../enterprise/entities/enterprise-group.entity';
import { EnterpriseDashboardDelivery } from '../enterprise/entities/enterprise-dashboard-delivery.entity';
import { ForbiddenException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Dashboard } from './entities/dashboard.entity';
import { DashboardShare } from './entities/dashboard_share.entity';
import { DashboardWidget } from './dashboard-widget/entities/dashboard-widget.entity';
import { Widget } from '../widget/entities/widget.entity';
import { Dataset } from '../dataset/entities/dataset.entity';
import { Database } from '../database/entities/database.entity';
import { User } from '../user/entities/user.entity';
import { UserMapping } from '../user/entities/user-mapping.entity';
import { EnterpriseMembership } from '../enterprise/entities/enterprise-membership.entity';
import { EnterpriseResourceGrant } from '../enterprise/entities/enterprise-resource-grant.entity';
import { EnterpriseResourcePolicyService } from '../enterprise/resource-policy.service';
import { SourceAccessService } from '../ownership/source-access.service';
import { DashboardService } from './dashboard.service';

/**
 * UC-051: the legacy title/layout patch stays owner-safe under a delegated edit grant, and a
 * granted viewer never receives the owner's live share capability.
 */
const OWNER = 7;
const READER = 8;
const EDITOR = 9;
const DASHBOARD = 51;
const SOURCE = 1;
const DATASET = 11;
const LINKED = 41;
const FOREIGN = 99;
const SHARE = 9;
const ORGANIZATION = 1;

const layout = (widgetId: number) => [{ i: String(widgetId), x: 0, y: 0, w: 6, h: 3 }];

describe('UC-051 delegated dashboard patch', () => {
  let db: DataSource;
  let service: DashboardService;
  let links: { update: jest.Mock; findWidgets: jest.Mock };

  const grant = (recipientId: number, rights: { read?: boolean; edit?: boolean }, version = 1) =>
    db.getRepository(EnterpriseResourceGrant).save({
      resourceKind: 'dashboard',
      resourceId: DASHBOARD,
      recipientId,
      organizationId: ORGANIZATION,
      ownerId: OWNER,
      version,
      read: rights.read === true,
      edit: rights.edit === true,
      publish: false,
      export: false,
    });
  const sourceGrant = (recipientId: number, version = 1) =>
    db.getRepository(EnterpriseResourceGrant).save({
      resourceKind: 'source',
      resourceId: SOURCE,
      recipientId,
      organizationId: ORGANIZATION,
      ownerId: OWNER,
      version,
      read: true,
      edit: false,
      publish: false,
      export: false,
    });

  beforeAll(async () => {
    db = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      synchronize: true,
      entities: [
        Dashboard,
        DashboardShare,
        DashboardWidget,
        Widget,
        Dataset,
        Database,
        User,
        UserMapping,
        EnterpriseMembership,
        EnterpriseResourceGrant,
        EnterpriseGroup,
        EnterpriseGroupMember,
        EnterpriseGroupGrant,
        EnterpriseDashboardDelivery,
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
    await db
      .getRepository(Dataset)
      .save({ id: DATASET, databaseId: SOURCE, title: 'd', query: 'select 1' });
    await db.getRepository(Widget).save([
      {
        id: LINKED,
        componentId: 1,
        datasetType: 'DATASET' as any,
        datasetId: DATASET,
        option: '{}',
        title: 'linked',
        description: '',
      },
      {
        id: FOREIGN,
        componentId: 1,
        datasetType: 'DATASET' as any,
        datasetId: DATASET,
        option: '{}',
        title: 'foreign',
        description: '',
      },
    ]);
    await db.getRepository(DashboardShare).save({
      id: SHARE,
      uuid: 'owner-share-uuid',
      shareToken: 'owner-share-token',
      shareYn: 'Y',
      endDate: new Date(Date.now() + 86400000),
      allowReuse: true,
      reuseVersion: 0,
    });
    await db.getRepository(Dashboard).save({
      id: DASHBOARD,
      title: 'Saved dashboard',
      delYn: 'N',
      shareId: SHARE,
      analysisDefinition: JSON.stringify({ databaseId: SOURCE }),
    });
    await db.getRepository(DashboardWidget).save({ dashboardId: DASHBOARD, widgetId: LINKED });
    await db.getRepository(UserMapping).save({ dashboardId: DASHBOARD, userInfoId: OWNER });
    links = { update: jest.fn(async () => undefined), findWidgets: jest.fn(async () => []) };
    service = new DashboardService(
      db.getRepository(Dashboard),
      db.getRepository(User) as any,
      db.getRepository(DashboardShare),
      db.getRepository(UserMapping),
      links as any,
      {
        findDashboardId: jest.fn(async id => (id === OWNER ? [{ dashboardId: DASHBOARD }] : [])),
      } as any,
      {} as any,
      db.getRepository(Widget),
      new SourceAccessService(db, new EnterpriseResourcePolicyService(db)),
    );
  });

  afterAll(async () => {
    if (db?.isInitialized) await db.destroy();
  });

  it('rejects a widget id that is not already linked to this dashboard', async () => {
    await grant(EDITOR, { read: true, edit: true });
    await sourceGrant(EDITOR);
    await expect(
      service.update(DASHBOARD, { layout: layout(FOREIGN) } as any, EDITOR, 'edit'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(links.update).not.toHaveBeenCalled();
  });

  it('applies a linked-layout grantee edit through the transaction manager', async () => {
    await grant(EDITOR, { read: true, edit: true }, 2);
    await sourceGrant(EDITOR, 2);
    const result: any = await service.update(
      DASHBOARD,
      { layout: layout(LINKED) } as any,
      EDITOR,
      'edit',
    );
    expect(result.status).toBe('SUCCESS');
    expect(links.update).toHaveBeenCalledWith(
      DASHBOARD,
      { dashboardId: DASHBOARD, widgetIds: [LINKED] },
      expect.anything(),
    );
  });

  it('rejects the write when the edit grant was revoked before the transaction', async () => {
    await grant(EDITOR, { read: true, edit: false }, 3);
    links.update.mockClear();
    await expect(
      service.update(DASHBOARD, { layout: layout(LINKED) } as any, EDITOR, 'edit'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(links.update).not.toHaveBeenCalled();
  });

  it('never returns the owner live share capability to a granted reader', async () => {
    await grant(READER, { read: true }, 2);
    await sourceGrant(READER, 2);
    const read: any = await service.findOne(DASHBOARD, READER, 'read');
    for (const field of ['shareId', 'uuid', 'shareToken', 'shareYn', 'endDate', 'allowReuse'])
      expect(read.data).not.toHaveProperty(field);
    expect(read.data).toMatchObject({ id: DASHBOARD, title: 'Saved dashboard' });

    const owner: any = await service.findOne(DASHBOARD, OWNER, 'read');
    expect(owner.data).toHaveProperty('uuid', 'owner-share-uuid');
    expect(owner.data).toHaveProperty('shareToken', 'owner-share-token');
    const listed: any = await service.findAll(READER, [DASHBOARD]);
    expect(listed.data[0]).not.toHaveProperty('shareId');
    const ownerList: any = await service.findAll(OWNER);
    expect(ownerList.data[0]).toHaveProperty('shareId', SHARE);
  });
});
