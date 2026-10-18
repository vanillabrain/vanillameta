jest.mock('../ai/ai.service', () => ({ AiService: class {} }));
import { ForbiddenException } from '@nestjs/common';
import { DatasetType } from '../common/enum/dataset-type.enum';
import { DataSource, EntityManager } from 'typeorm';
import { metadataTransaction } from '../common/metadata-work';
import { Dashboard } from './entities/dashboard.entity';
import { DashboardShare } from './entities/dashboard_share.entity';
import { DashboardWidget } from './dashboard-widget/entities/dashboard-widget.entity';
import { DashboardWidgetService } from './dashboard-widget/dashboard-widget.service';
import { DashboardService } from './dashboard.service';
import { User } from '../user/entities/user.entity';
import { UserMapping } from '../user/entities/user-mapping.entity';
import { Widget } from '../widget/entities/widget.entity';
import { Dataset } from '../dataset/entities/dataset.entity';
import { Database } from '../database/entities/database.entity';
import { Component } from '../component/entities/component.entity';
import { SourceAccessService } from '../ownership/source-access.service';
import { AiDashboardService } from '../ai/ai-dashboard.service';
import { Metric } from '../metric/entities/metric.entity';
import { ShareUrlService } from '../share-url/share-url.service';
import { SharedReuseOriginService } from '../bi/shared-reuse-origin.service';
import { lockDashboardWrite } from './dashboard-write-lock';

import { randomUUID } from 'crypto';
import { EnterpriseResourcePolicyService } from '../enterprise/resource-policy.service';
import { EnterpriseDeliveryService } from '../enterprise/delivery.service';
import { EnterpriseGroupDeliveryService } from '../enterprise/group-delivery.service';
import { EnterpriseMembership } from '../enterprise/entities/enterprise-membership.entity';
import { EnterpriseAuditEvent } from '../enterprise/entities/enterprise-audit-event.entity';
import { EnterpriseResourceGrant } from '../enterprise/entities/enterprise-resource-grant.entity';
import {
  EnterpriseGroup,
  EnterpriseGroupMember,
  EnterpriseGroupGrant,
} from '../enterprise/entities/enterprise-group.entity';
import {
  EnterpriseDashboardDelivery,
  EnterpriseDeliveryReceipt,
} from '../enterprise/entities/enterprise-dashboard-delivery.entity';
import { EnterpriseGroupDelivery } from '../enterprise/entities/enterprise-group-delivery.entity';
import { EnterpriseNotificationAudience } from '../enterprise/entities/enterprise-notification-audience.entity';

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>(r => (resolve = r));
  return { promise, resolve };
};
describe('shared Dashboard write parent fence', () => {
  it.each(['mysql', 'mariadb', 'sqlite'])(
    'uses %s locking contract inside an explicit transaction',
    async type => {
      const row = { id: 1, delYn: 'N' };
      const findOne = jest.fn().mockResolvedValue(row);
      const manager = {
        queryRunner: { isTransactionActive: true },
        connection: { options: { type } },
        findOne,
      } as unknown as EntityManager;
      expect(await lockDashboardWrite(manager, 1)).toBe(row);
      expect(findOne).toHaveBeenCalledWith(Dashboard, {
        where: { id: 1 },
        ...(type === 'sqlite' ? {} : { lock: { mode: 'pessimistic_write' } }),
      });
    },
  );
  it.each([undefined, { isTransactionActive: false }])(
    'rejects a manager without an active transaction: %j',
    async queryRunner => {
      const findOne = jest.fn();
      await expect(lockDashboardWrite({ queryRunner, findOne } as any, 1)).rejects.toThrow(
        'active transaction',
      );
      expect(findOne).not.toHaveBeenCalled();
    },
  );

  describe('actual SQLite writes and queued physical delete', () => {
    let db: DataSource,
      widgets: DashboardWidgetService,
      dashboards: DashboardService,
      access: SourceAccessService;
    const entities = [
      Dashboard,
      DashboardShare,
      DashboardWidget,
      User,
      UserMapping,
      Widget,
      Dataset,
      Database,
      Component,
      Metric,
      EnterpriseMembership,
      EnterpriseAuditEvent,
      EnterpriseResourceGrant,
      EnterpriseGroup,
      EnterpriseGroupMember,
      EnterpriseGroupGrant,
      EnterpriseDashboardDelivery,
      EnterpriseDeliveryReceipt,
      EnterpriseGroupDelivery,
      EnterpriseNotificationAudience,
    ];
    const draft = () => ({
      databaseId: 1,
      title: 'Edited',
      explanation: '',
      widgets: [
        {
          title: 'Value',
          description: '',
          type: 'BOARD_NUMERIC',
          sql: 'SELECT sum(amount) AS value FROM source',
          valueField: 'value',
        },
      ],
    });
    beforeEach(async () => {
      db = await new DataSource({
        type: 'sqlite',
        database: ':memory:',
        entities,
        synchronize: true,
      }).initialize();
      await db.manager.insert(User, {
        id: 7,
        userId: 'lock-test',
        email: 'lock-test@example.invalid',
        password: 'unused',
      });
      await db.manager.insert(Database, {
        id: 1,
        ownerId: 7,
        name: 'Synthetic',
        connectionConfig: '{}',
        engine: 'duckdb',
        type: 'FILE',
      });
      await db.manager.insert(Dataset, {
        id: 1,
        databaseId: 1,
        title: 'Synthetic',
        query: 'SELECT 1',
      });
      await db.manager.insert(Component, {
        id: 1,
        type: 'BOARD_NUMERIC',
        title: 'Value',
        option: '{}',
        useYn: 'Y',
      });
      await db.manager.insert(Widget, {
        id: 1,
        title: 'Value',
        componentId: 1,
        datasetType: DatasetType.DATASET,
        datasetId: 1,
        option: '{}',
        delYn: 'N',
      });
      await db.manager.insert(DashboardShare, { id: 1, uuid: 'synthetic-share', shareYn: 'N' });
      await db.manager.insert(Dashboard, { id: 1, title: 'Original', layout: '[]', shareId: 1 });
      await db.manager.insert(UserMapping, { dashboardId: 1, userInfoId: 7 });
      access = new SourceAccessService(db);
      widgets = new DashboardWidgetService(
        db.getRepository(DashboardWidget),
        db.getRepository(Widget),
        db.getRepository(Component),
      );
      dashboards = new DashboardService(
        db.getRepository(Dashboard),
        db.getRepository(User),
        db.getRepository(DashboardShare),
        db.getRepository(UserMapping),
        widgets,
        undefined,
        undefined,
        db.getRepository(Widget),
        access,
      );
    });
    afterEach(async () => {
      jest.restoreAllMocks();
      await db?.destroy();
    });
    it('requires a real transaction and rejects invalid/missing/legacy-deleted parents', async () => {
      await expect(lockDashboardWrite(db.manager, 1)).rejects.toThrow('active transaction');
      for (const id of [0, -1, 1.5, 999])
        await expect(
          metadataTransaction(db, manager => lockDashboardWrite(manager, id)),
        ).rejects.toBeInstanceOf(ForbiddenException);
      await db.manager.update(Dashboard, 1, { delYn: 'Y' });
      await expect(
        metadataTransaction(db, manager => lockDashboardWrite(manager, 1)),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
    it.each([undefined, 7])(
      'updates an existing parent atomically for legacy/explicit actor %s',
      async actor => {
        const result = await dashboards.update(
          1,
          { title: 'Changed', layout: [{ i: '1', x: 0, y: 0, w: 12, h: 2 }] } as any,
          actor,
        );
        expect(result.data.title).toBe('Changed');
        expect(await db.manager.count(Dashboard)).toBe(1);
        expect(await db.manager.find(DashboardWidget)).toEqual([
          expect.objectContaining({ dashboardId: 1, widgetId: 1 }),
        ]);
      },
    );
    it('preserves analysis widget order when presentation order changes', async () => {
      await db.manager.insert(Widget, {
        id: 2,
        title: 'Other',
        componentId: 1,
        datasetType: DatasetType.DATASET,
        datasetId: 1,
        option: '{}',
        delYn: 'N',
      });
      await db.manager.update(Dashboard, 1, {
        analysisDefinition: JSON.stringify({ databaseId: 1 }),
      });
      await widgets.create({ dashboardId: 1, widgetIds: [1, 2] });
      await dashboards.update(1, {
        layout: [2, 1].map(i => ({ i: String(i), x: 0, y: i, w: 6, h: 2 })),
      } as any);
      expect(
        (await db.manager.find(DashboardWidget, { order: { id: 'ASC' } })).map(row => row.widgetId),
      ).toEqual([1, 2]);
    });
    it.each(['legacy-update', 'explicit-update', 'link-create', 'link-update'])(
      'rejects %s admitted behind physical delete without resurrection or orphan links',
      async path => {
        const entered = deferred(),
          release = deferred();
        const deletion = metadataTransaction(db, async manager => {
          await lockDashboardWrite(manager, 1);
          entered.resolve();
          await release.promise;
          await manager.delete(Dashboard, 1);
        });
        await entered.promise;
        const pending =
          path === 'link-create'
            ? widgets.create({ dashboardId: 1, widgetIds: [1] })
            : path === 'link-update'
            ? widgets.update(1, { widgetIds: [1] } as any)
            : dashboards.update(
                1,
                { title: 'Must not return' } as any,
                path === 'explicit-update' ? 7 : undefined,
              );
        const checked = expect(pending).rejects.toBeInstanceOf(ForbiddenException);
        release.resolve();
        await deletion;
        await checked;
        expect(await db.manager.count(Dashboard)).toBe(0);
        expect(await db.manager.count(DashboardWidget)).toBe(0);
      },
    );
    it('rolls back replacement links and parent title when a child insert fails', async () => {
      await widgets.create({ dashboardId: 1, widgetIds: [1] });
      const before = await db.manager.find(DashboardWidget);
      await db.query(
        "CREATE TRIGGER fail_widget_link BEFORE INSERT ON dashboard_widget BEGIN SELECT RAISE(ABORT, 'synthetic link failure'); END",
      );
      await expect(
        dashboards.update(1, {
          title: 'Must roll back',
          layout: [{ i: '1', x: 0, y: 0, w: 6, h: 2 }],
        } as any),
      ).rejects.toThrow('synthetic link failure');
      expect((await db.manager.findOneBy(Dashboard, { id: 1 })).title).toBe('Original');
      expect(await db.manager.find(DashboardWidget)).toEqual(before);
    });
    it.each([false, true])(
      'blocks AI existing-ID persist after deletion between preview and commit, revision=%s',
      async revision => {
        await db.manager.update(Dashboard, 1, { analysisDefinition: JSON.stringify(draft()) });
        const ai = new AiDashboardService(
          {} as any,
          {} as any,
          db.getRepository(Dashboard),
          access,
        );
        const entered = deferred(),
          release = deferred();
        jest.spyOn(ai, 'preview').mockImplementation(async () => {
          entered.resolve();
          await release.promise;
          return { status: 'SUCCESS', data: { draft: draft(), widgets: [], queries: [] } } as any;
        });
        const pending = ai.save(
          {
            dashboardId: 1,
            draft: draft(),
            ...(revision ? { expectedRevision: 'a'.repeat(64) } : {}),
          },
          7,
        );
        await entered.promise;
        await metadataTransaction(db, async manager => {
          await lockDashboardWrite(manager, 1);
          await manager.delete(Dashboard, 1);
        });
        const checked = expect(pending).rejects.toBeInstanceOf(ForbiddenException);
        release.resolve();
        await checked;
        expect(await db.manager.count(Dashboard)).toBe(0);
        expect(await db.manager.count(Widget)).toBe(1);
        expect(await db.manager.count(Dataset)).toBe(1);
        expect(await db.manager.count(DashboardWidget)).toBe(0);
      },
    );
    it('updates legacy live-share and reuse settings through the fenced transaction manager', async () => {
      const share = new ShareUrlService(
        db.getRepository(User),
        db.getRepository(Dashboard),
        db.getRepository(DashboardShare),
        { generateUrlAccessToken: jest.fn().mockResolvedValue('synthetic-token') } as any,
        dashboards,
      );
      const reuse = new SharedReuseOriginService(db, undefined, undefined, access);
      await share.checkShareUrlOn('lock-test', 1, { endDate: '12/31/2099' } as any);
      await reuse.grant(1, 7, { allowReuse: true });
      expect(await db.manager.findOneBy(DashboardShare, { id: 1 })).toMatchObject({
        shareYn: 'Y',
        allowReuse: true,
        reuseVersion: 2,
      });
      await share.checkShareUrlOff('lock-test', 1);
      expect(await db.manager.findOneBy(DashboardShare, { id: 1 })).toMatchObject({
        shareYn: 'N',
        reuseVersion: 3,
      });
    });

    it.each([
      '02/30/2026',
      '02/29/2026',
      '13/01/2026',
      '00/01/2026',
      '03/00/2026',
      '3/1/2026',
      '2026-03-01',
      '',
      undefined,
    ])('rejects malformed legacy share date %s without token or state writes', async endDate => {
      const token = jest.fn();
      const share = new ShareUrlService(
        db.getRepository(User),
        db.getRepository(Dashboard),
        db.getRepository(DashboardShare),
        { generateUrlAccessToken: token } as any,
        dashboards,
      );
      await expect(share.checkShareUrlOn('lock-test', 1, { endDate } as any)).rejects.toThrow(
        'invalid endDate',
      );
      expect(token).not.toHaveBeenCalled();
      expect(await db.manager.findOneBy(DashboardShare, { id: 1 })).toMatchObject({
        shareYn: 'N',
        reuseVersion: 0,
      });
    });

    it('rechecks real share ownership before either on/off state change', async () => {
      await db.manager.insert(User, {
        id: 8,
        userId: 'other',
        email: 'other@example.invalid',
        password: 'unused',
      });
      const token = jest.fn();
      const share = new ShareUrlService(
        db.getRepository(User),
        db.getRepository(Dashboard),
        db.getRepository(DashboardShare),
        { generateUrlAccessToken: token } as any,
        dashboards,
      );
      await expect(
        share.checkShareUrlOn('other', 1, { endDate: '12/31/2099' } as any),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(share.checkShareUrlOff('other', 1)).rejects.toBeInstanceOf(ForbiddenException);
      expect(token).not.toHaveBeenCalled();
      expect((await db.manager.findOneBy(DashboardShare, { id: 1 })).reuseVersion).toBe(0);
    });

    it.each(['direct-grant', 'group-grant', 'direct-delivery', 'group-delivery'])(
      'coordinates actual policy %s creation with a queued parent deletion',
      async kind => {
        await db.manager.insert(User, {
          id: 8,
          userId: 'recipient',
          email: 'recipient@example.invalid',
          password: 'unused',
        });
        await db.manager.insert(
          EnterpriseMembership,
          [7, 8].map(userId => ({
            userId,
            organizationId: 1,
            role: userId === 7 ? 'admin' : 'member',
            team: '',
          })),
        );
        await db.manager.insert(EnterpriseGroup, {
          id: 1,
          organizationId: 1,
          name: 'Synthetic',
          nameKey: 'synthetic',
          active: true,
          version: 1,
        });
        await db.manager.insert(EnterpriseGroupMember, { groupId: 1, userId: 8 });
        const policy = new EnterpriseResourcePolicyService(db);
        const guarded = new SourceAccessService(db, policy);
        const direct = new EnterpriseDeliveryService(db, policy, guarded);
        const grouped = new EnterpriseGroupDeliveryService(db, policy, guarded);
        const rights = { read: true, edit: false, publish: false, export: false };
        const create = () =>
          kind === 'direct-grant'
            ? policy.set('dashboard', 1, 7, { recipientId: 8, expectedVersion: 0, rights })
            : kind === 'group-grant'
            ? policy.setGroupPolicy('dashboard', 1, 7, {
                groupId: 1,
                expectedGroupVersion: 1,
                expectedVersion: 0,
                rights,
              })
            : kind === 'direct-delivery'
            ? direct.set(1, 7, {
                requestId: randomUUID(),
                active: true,
                recipients: [{ recipientId: 8, expectedVersion: 0 }],
              })
            : grouped.set(1, 7, {
                requestId: randomUUID(),
                groupId: 1,
                expectedGroupVersion: 1,
                expectedVersion: 0,
                active: true,
                allowCopy: false,
              });
        // Exercise real successful creation, not only an early permission failure.
        await create();
        expect(await db.manager.count(EnterpriseAuditEvent)).toBe(1);
        for (const entity of [
          EnterpriseResourceGrant,
          EnterpriseGroupGrant,
          EnterpriseDashboardDelivery,
          EnterpriseGroupDelivery,
          EnterpriseDeliveryReceipt,
          EnterpriseNotificationAudience,
          EnterpriseAuditEvent,
        ])
          await db.getRepository(entity).clear();
        const entered = deferred(),
          release = deferred();
        const deletion = metadataTransaction(db, async manager => {
          await lockDashboardWrite(manager, 1);
          entered.resolve();
          await release.promise;
          await manager.delete(Dashboard, 1);
        });
        await entered.promise;
        const pending = create();
        const checked = expect(pending).rejects.toBeInstanceOf(ForbiddenException);
        release.resolve();
        await deletion;
        await checked;
        expect(await db.manager.count(EnterpriseAuditEvent)).toBe(0);
        for (const entity of [
          EnterpriseResourceGrant,
          EnterpriseGroupGrant,
          EnterpriseDashboardDelivery,
          EnterpriseGroupDelivery,
        ])
          expect(await db.getRepository(entity).count()).toBe(0);
      },
    );

    it.each(['on', 'off', 'reuse'])(
      'rejects legacy share %s after physical delete before any token/share mutation',
      async action => {
        const token = jest.fn();
        const share = new ShareUrlService(
          db.getRepository(User),
          db.getRepository(Dashboard),
          db.getRepository(DashboardShare),
          { generateUrlAccessToken: token } as any,
          dashboards,
        );
        const reuse = new SharedReuseOriginService(db, undefined, undefined, access);
        await metadataTransaction(db, manager => manager.delete(Dashboard, 1));
        const pending =
          action === 'on'
            ? share.checkShareUrlOn('lock-test', 1, { endDate: '12/31/2099' } as any)
            : action === 'off'
            ? share.checkShareUrlOff('lock-test', 1)
            : reuse.grant(1, 7, { allowReuse: true });
        await expect(pending).rejects.toBeInstanceOf(ForbiddenException);
        expect(token).not.toHaveBeenCalled();
        expect((await db.manager.findOneBy(DashboardShare, { id: 1 })).reuseVersion).toBe(0);
      },
    );
  });
});
