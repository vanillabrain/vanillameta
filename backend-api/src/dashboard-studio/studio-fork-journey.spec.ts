import { SourceCatalogEntry } from '../bi/entities/source-catalog-entry.entity';
import { User } from '../user/entities/user.entity';
import { UserMapping } from '../user/entities/user-mapping.entity';
import { EnterpriseMembership } from '../enterprise/entities/enterprise-membership.entity';
import { EnterpriseAuditEvent } from '../enterprise/entities/enterprise-audit-event.entity';
import { EnterpriseNotificationAudience } from '../enterprise/entities/enterprise-notification-audience.entity';
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
jest.mock('../ai/ai.service', () => ({ AiService: class {} }));
import { randomUUID, createHash } from 'crypto';
import { DataSource } from 'typeorm';
import { AiDashboardService } from '../ai/ai-dashboard.service';
import { DuckDBService } from '../analysis/duckdb.service';
import { Dashboard } from '../dashboard/entities/dashboard.entity';
import { DashboardShare } from '../dashboard/entities/dashboard_share.entity';
import { DashboardWidget } from '../dashboard/dashboard-widget/entities/dashboard-widget.entity';
import { DashboardPublication } from '../dashboard/entities/dashboard-publication.entity';
import { DashboardDeleteReceipt } from '../dashboard/entities/dashboard-delete-receipt.entity';
import { PersonalLibraryState } from '../dashboard/entities/personal-library-state.entity';
import { PersonalView } from '../dashboard/entities/personal-view.entity';
import { DashboardDeletionService } from '../dashboard/dashboard-deletion.service';
import { Database } from '../database/entities/database.entity';
import { Dataset } from '../dataset/entities/dataset.entity';
import { Widget } from '../widget/entities/widget.entity';
import { Component } from '../component/entities/component.entity';
import { Metric } from '../metric/entities/metric.entity';
import { StudioState } from './entities/studio-state.entity';
import { StudioRemixRequest } from './entities/studio-remix.entity';
import { StudioRun } from './entities/studio-run.entity';
import { StudioPublication, StudioPublicationRequest } from './entities/studio-publication.entity';
import { StudioRemixService } from './studio-remix.service';
import { StudioService } from './studio.service';
import { StudioPublicationService } from './studio-publication.service';
import { StudioCreationService } from './studio-creation.service';
import { BiService } from '../bi/bi.service';
import { SourceAccessService } from '../ownership/source-access.service';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/*
 * Journey spec for the share-to-fork use case (docs/testing/shared-fork-verification.md, rows
 * R1, R8, R9, R10, R14, F1-F4, F6). Real services over SQLite and real DuckDB files; nothing
 * in the remix, publication or deletion logic is mocked.
 *
 * Numbers are hand-summed from the fixtures below:
 *   owner source 1  : weight 2/1/3 with amount 300/200/100  -> all 600, weight>=2 -> 400
 *   recipient src 2 : weight 2/5/1 with total 50/70/1000    -> weight>=2 -> 120, weight>=5 -> 70
 *   third user src 3: weight 2/1 with total 40/9            -> weight>=2 -> 40, all 49
 */
describe('UC-006 share-to-fork journey: owner, recipient copy, revoke, re-share and chain', () => {
  let db: DataSource,
    worker: DuckDBService,
    dashboards: AiDashboardService,
    studio: StudioService,
    publications: StudioPublicationService,
    creation: StudioCreationService,
    remix: StudioRemixService,
    deletion: DashboardDeletionService,
    root: string,
    connection: any,
    id: number;
  const previous = process.env.FILE_UPLOAD_DIR;
  const files = new Map<number, string>();
  const filename = (sourceId: number) => 'journey-source-' + sourceId + '.duckdb';
  const ownerOf: Record<number, number> = { 1: 7, 2: 8, 3: 9 };
  const toRecipient = { amount: 'total', channel: 'segment', event_time: 'occurred_at' };
  // Recipient-to-third-user copy: the chained copy already uses the recipient's column names.
  const sameNames: Record<string, string> = {};

  beforeAll(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-fork-journey-'));
    process.env.FILE_UPLOAD_DIR = root;
    worker = new DuckDBService();
    for (const [sourceId, csv] of [
      [
        1,
        'channel,amount,weight,event_time\nSite,300,2,2026-01-01T00:00:00Z\nMobile,200,1,2026-01-02T00:00:00Z\nSite,100,3,2026-01-03T00:00:00Z\n',
      ],
      [
        2,
        'segment,total,weight,occurred_at\nSite,50,2,2026-01-01T00:00:00Z\nMobile,70,5,2026-01-02T00:00:00Z\nSite,1000,1,2026-01-03T00:00:00Z\n',
      ],
      [
        3,
        'segment,total,weight,occurred_at\nPartner,40,2,2026-01-01T00:00:00Z\nPartner,9,1,2026-01-02T00:00:00Z\n',
      ],
    ] as Array<[number, string]>) {
      files.set(
        sourceId,
        (await worker.importFile({ originalname: 'input.csv', buffer: Buffer.from(csv) })).filename,
      );
    }
    db = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      synchronize: true,
      entities: [
        SourceCatalogEntry,
        User,
        UserMapping,
        EnterpriseMembership,
        EnterpriseAuditEvent,
        EnterpriseNotificationAudience,
        EnterpriseResourceGrant,
        EnterpriseGroup,
        EnterpriseGroupMember,
        EnterpriseGroupGrant,
        EnterpriseDashboardDelivery,
        EnterpriseGroupDelivery,
        EnterpriseDeliveryReceipt,
        Dashboard,
        DashboardShare,
        DashboardWidget,
        DashboardPublication,
        DashboardDeleteReceipt,
        PersonalLibraryState,
        PersonalView,
        Database,
        Dataset,
        Widget,
        Component,
        Metric,
        StudioState,
        StudioRun,
        StudioPublication,
        StudioPublicationRequest,
        StudioRemixRequest,
      ],
    }).initialize();
    await db.manager.insert(
      User,
      [7, 8, 9].map(userId => ({
        id: userId,
        userId: `fork-journey-${userId}`,
        email: `fork-journey-${userId}@example.invalid`,
        password: 'synthetic-unused',
        active: true,
        authVersion: 0,
      })),
    );
    for (const sourceId of files.keys())
      await db.manager.save(Database, {
        id: sourceId,
        ownerId: ownerOf[sourceId],
        name: 'Source ' + sourceId,
        engine: 'duckdb',
        type: 'FILE',
        connectionConfig: JSON.stringify({
          client: 'duckdb',
          connection: { filename: filename(sourceId) },
        }),
      });
    for (const type of ['BOARD_NUMERIC', 'CHART_COLUMN', 'CHART_BAR', 'CHART_LINE'])
      await db.manager.save(Component, { type, title: type, option: '{}', useYn: 'Y' });
    connection = {
      manager: db.manager,
      withDuckDBSnapshot: jest.fn((_id, cb) => cb()),
      captureDuckDBSnapshot: jest.fn(async () => ({ run: async cb => cb() })),
      duckDBVersion: jest.fn(async sourceId =>
        createHash('sha256').update(filename(sourceId)).digest('hex'),
      ),
      isDuckDB: jest.fn().mockResolvedValue(true),
      queryDuckDB: jest.fn((sourceId, sql, bindings) =>
        worker.query(files.get(sourceId), sql, bindings),
      ),
    };
    const access = new SourceAccessService(db);
    dashboards = new AiDashboardService({} as any, connection, db.getRepository(Dashboard));
    studio = new StudioService(db, dashboards, connection, access);
    publications = new StudioPublicationService(db, studio, access, connection);
    creation = new StudioCreationService(
      db,
      new BiService(db, access, connection, dashboards),
      {} as any,
      dashboards,
      connection,
      access,
      studio,
    );
    remix = new StudioRemixService(
      db,
      studio,
      publications,
      creation,
      dashboards,
      connection,
      access,
    );
    deletion = new DashboardDeletionService(db);
  });

  beforeEach(async () => {
    await db.manager.clear(SourceCatalogEntry);
    const definition = {
      schemaVersion: 1,
      definitionVersion: 1,
      sourceId: 1,
      tableName: 'uploaded_data',
      label: 'Revenue',
      aggregation: 'SUM',
      column: 'amount',
      unit: 'USD',
      decimalPlaces: 2,
      numberNotation: 'plain',
    };
    const metric = await db.manager.save(Metric, {
      name: 'journey-original-' + Date.now() + '-' + Math.random(),
      databaseId: 1,
      tableName: 'uploaded_data',
      aggregation: 'SUM' as any,
      expression: 'amount',
      definition: JSON.stringify(definition),
    });
    const blocks = [
      { title: 'Revenue', kind: 'BOARD_NUMERIC', metric: definition },
      {
        title: 'Channels',
        kind: 'CHART_COLUMN',
        metric: definition,
        dimension: { column: 'channel' },
      },
      {
        title: 'Trend',
        kind: 'CHART_LINE',
        metric: definition,
        dimension: { column: 'event_time' },
      },
    ];
    const profile = await (creation as any).profile(1, 7);
    const snapshot = {
      schemaVersion: 2,
      kind: 'structured-bi-dashboard',
      sourceId: 1,
      items: blocks.map(b => ({
        sourceId: 1,
        metricId: metric.id,
        definitionVersion: 1,
        definition,
        ...(b.dimension ? { dimension: b.dimension.column } : {}),
        chart: b.kind === 'BOARD_NUMERIC' ? 'number' : b.kind === 'CHART_LINE' ? 'line' : 'bar',
      })),
    };
    id = (
      await dashboards.save(
        { draft: (creation as any).compile(1, 'Original', blocks, profile) },
        7,
        snapshot,
      )
    ).data.id;
  });

  afterAll(async () => {
    await worker?.onModuleDestroy();
    await db?.destroy();
    fs.rmSync(root, { recursive: true, force: true });
    if (previous === undefined) delete process.env.FILE_UPLOAD_DIR;
    else process.env.FILE_UPLOAD_DIR = previous;
  });

  // Studio save path: the same conditions document a user produces in the Studio editor.
  const setWeightAtLeast = async (
    dashboardId: number,
    actor: number,
    sourceId: number,
    min: number,
    requestId: string,
  ) => {
    const state = await studio.get(dashboardId, actor);
    return studio.save(
      dashboardId,
      {
        requestId,
        expectedRevision: state.document.revision,
        expectedSourceRevision: state.sourceRevision,
        document: {
          ...state.document,
          conditions: {
            sourceRevision: await connection.duckDBVersion(sourceId),
            definition: {
              include: { kind: 'predicate', column: 'weight', operator: 'gte', values: [min] },
              exclude: null,
            },
          },
        },
      },
      actor,
    );
  };
  const publish = async (dashboardId: number, actor: number, patch: any = {}) => {
    const state = await studio.get(dashboardId, actor);
    return publications.publish(
      dashboardId,
      {
        requestId: 'publish-' + dashboardId,
        expectedRevision: state.document.revision,
        visibility: 'link',
        allowRemix: true,
        ...patch,
      },
      actor,
    );
  };
  const previewCopy = async (
    p: { token: string; version: number },
    actor: number,
    targetSourceId: number,
    mapping: Record<string, string>,
  ) => {
    const template = await remix.template(p.token, actor);
    return remix.preview(
      p.token,
      {
        targetSourceId,
        mapping,
        expectedVersion: p.version,
        expectedLifecycleRevision: template.lifecycleRevision,
      },
      actor,
    );
  };
  const commitCopy = (
    p: { token: string; version: number },
    actor: number,
    targetSourceId: number,
    mapping: Record<string, string>,
    v: any,
    requestId: string,
  ) =>
    remix.remix(
      p.token,
      {
        requestId,
        targetSourceId,
        mapping,
        expectedVersion: p.version,
        expectedSourceRevision: v.sourceRevision,
        expectedLifecycleRevision: v.lifecycleRevision,
      },
      actor,
    );
  const fork = async (
    p: { token: string; version: number },
    actor: number,
    targetSourceId: number,
    mapping: Record<string, string>,
    requestId: string,
  ) =>
    commitCopy(
      p,
      actor,
      targetSourceId,
      mapping,
      await previewCopy(p, actor, targetSourceId, mapping),
      requestId,
    );
  const revenue = async (dashboardId: number, actor: number) =>
    (await studio.get(dashboardId, actor)).preview.widgets[0].datas;
  const oracle = (sourceId: number, sql: string) => worker.query(files.get(sourceId), sql, []);
  const rawDashboard = async (dashboardId: number) =>
    JSON.stringify(await db.manager.findOneBy(Dashboard, { id: dashboardId }));
  const rawPublication = async (token: string) =>
    JSON.stringify(await db.manager.findOneBy(StudioPublication, { token }));
  // studio-evidence.ts stamps queriedAt with the clock of each studio.get read. It is the only
  // per-read clock on that path (checked in studio.service and studio-evidence.ts), so strip that
  // one field and keep every other byte of the state under comparison.
  const readBytes = (state: any) =>
    JSON.stringify({
      ...state,
      preview: state.preview && {
        ...state.preview,
        evidence: state.preview.evidence && { ...state.preview.evidence, queriedAt: undefined },
      },
    });
  const deleteBody = (impact: any) => ({
    requestId: randomUUID(),
    expectedRevision: impact.revision,
    expectedActorId: impact.actorId,
    expectedOrganizationId: impact.organizationId,
  });

  describe('owner, recipient copy and independence', () => {
    it('copies an owner link onto the recipient source: the copy sums recipient rows (120), not owner rows (400)', async () => {
      await setWeightAtLeast(id, 7, 1, 2, 'owner-cond-' + id);
      expect(await revenue(id, 7)).toEqual([{ value: 400 }]);
      const p = await publish(id, 7);
      expect(p.version).toBe(1);
      const copy = await fork(p, 8, 2, toRecipient, 'fork-' + id);
      expect(copy.dashboardId).not.toBe(id);
      expect(copy.document.sourceId).toBe(2);
      expect(await revenue(copy.dashboardId, 8)).toEqual([{ value: 120 }]);
      expect(await revenue(copy.dashboardId, 8)).toEqual(
        (await oracle(2, 'SELECT SUM(total) AS value FROM uploaded_data WHERE weight >= 2')).datas,
      );
      expect(await revenue(id, 7)).toEqual([{ value: 400 }]);
    });

    it('editing the recipient copy through Studio save leaves the owner document, revision and publication snapshot byte-identical', async () => {
      await setWeightAtLeast(id, 7, 1, 2, 'owner-cond-' + id);
      const p = await publish(id, 7);
      const copy = await fork(p, 8, 2, toRecipient, 'fork-' + id);
      const revisionBefore = (await studio.get(id, 7)).document.revision;
      const before = {
        owner: await rawDashboard(id),
        document: JSON.stringify((await studio.get(id, 7)).document),
        publication: await rawPublication(p.token),
        publicView: JSON.stringify(await publications.read(p.token)),
      };
      await setWeightAtLeast(copy.dashboardId, 8, 2, 5, 'copy-edit-' + id);
      expect(await revenue(copy.dashboardId, 8)).toEqual([{ value: 70 }]);
      expect((await studio.get(id, 7)).document.revision).toBe(revisionBefore);
      expect({
        owner: await rawDashboard(id),
        document: JSON.stringify((await studio.get(id, 7)).document),
        publication: await rawPublication(p.token),
        publicView: JSON.stringify(await publications.read(p.token)),
      }).toEqual(before);
      expect(await revenue(id, 7)).toEqual([{ value: 400 }]);
    });

    it('owner edit and republish keep the same token at version 2 and leave an existing recipient copy re-read unchanged', async () => {
      await setWeightAtLeast(id, 7, 1, 2, 'owner-cond-' + id);
      const p = await publish(id, 7);
      const copy = await fork(p, 8, 2, toRecipient, 'fork-' + id);
      const copyBefore = readBytes(await studio.get(copy.dashboardId, 8));
      await setWeightAtLeast(id, 7, 1, 1, 'owner-edit-' + id);
      expect(await revenue(id, 7)).toEqual([{ value: 600 }]);
      const republished = await publish(id, 7, { requestId: 'republish-' + id });
      expect(republished.token).toBe(p.token);
      expect(republished.version).toBe(2);
      expect((await publications.read(p.token)).snapshot.blocks[0].datas).toEqual([{ value: 600 }]);
      expect(readBytes(await studio.get(copy.dashboardId, 8))).toBe(copyBefore);
      expect(await revenue(copy.dashboardId, 8)).toEqual([{ value: 120 }]);
    });
  });

  describe('revoke, deletion and recipient copy survival', () => {
    it('revoking the link returns 410 for read, template, preview and remix while the recipient copy still loads and saves', async () => {
      await setWeightAtLeast(id, 7, 1, 2, 'owner-cond-' + id);
      const p = await publish(id, 7);
      const copy = await fork(p, 8, 2, toRecipient, 'fork-' + id);
      const v = await previewCopy(p, 8, 2, toRecipient);
      const revoked = await publications.revoke(p.token, 7);
      expect(revoked.token).toBe(p.token);
      await expect(publications.read(p.token)).rejects.toMatchObject({ status: 410 });
      await expect(remix.template(p.token, 8)).rejects.toMatchObject({ status: 410 });
      await expect(previewCopy(p, 8, 2, toRecipient)).rejects.toMatchObject({ status: 410 });
      await expect(commitCopy(p, 8, 2, toRecipient, v, 'after-revoke-' + id)).rejects.toMatchObject(
        { status: 410 },
      );
      expect(await revenue(copy.dashboardId, 8)).toEqual([{ value: 120 }]);
      await setWeightAtLeast(copy.dashboardId, 8, 2, 5, 'copy-after-revoke-' + id);
      expect(await revenue(copy.dashboardId, 8)).toEqual([{ value: 70 }]);
      expect(await revenue(id, 7)).toEqual([{ value: 400 }]);
    });

    it('the owner original is protected while a live link exists and can be deleted after revoke while the recipient copy keeps working', async () => {
      await setWeightAtLeast(id, 7, 1, 2, 'owner-cond-' + id);
      const p = await publish(id, 7);
      const copy = await fork(p, 8, 2, toRecipient, 'fork-' + id);
      const live = (await deletion.impact(id, 7)).data;
      expect(live.canDelete).toBe(false);
      expect(live.dependencies.find(item => item.kind === 'studioPublications')).toEqual({
        kind: 'studioPublications',
        count: 1,
      });
      await expect(deletion.remove(id, 7, deleteBody(live))).rejects.toMatchObject({ status: 409 });
      expect(await db.manager.findOneBy(Dashboard, { id })).not.toBeNull();

      await publications.revoke(p.token, 7);
      const impact = (await deletion.impact(id, 7)).data;
      expect(impact.canDelete).toBe(true);
      const removed = await deletion.remove(id, 7, deleteBody(impact));
      expect(removed.data).toMatchObject({ dashboardId: id, deleted: true, replayed: false });
      expect(await db.manager.findOneBy(Dashboard, { id })).toBeNull();

      expect(await revenue(copy.dashboardId, 8)).toEqual([{ value: 120 }]);
      await setWeightAtLeast(copy.dashboardId, 8, 2, 5, 'copy-after-delete-' + id);
      expect(await revenue(copy.dashboardId, 8)).toEqual([{ value: 70 }]);
      await expect(remix.template(p.token, 8)).rejects.toMatchObject({ status: 410 });
    });
  });

  describe('re-share and chain', () => {
    it('re-sharing after revoke issues a new token at version 1, the old token stays 410, and another user copies the new link', async () => {
      await setWeightAtLeast(id, 7, 1, 2, 'owner-cond-' + id);
      const p = await publish(id, 7);
      await publications.revoke(p.token, 7);
      const next = await publish(id, 7, { requestId: 'reshare-' + id });
      expect(next.token).not.toBe(p.token);
      expect(next.version).toBe(1);
      await expect(remix.template(p.token, 8)).rejects.toMatchObject({ status: 410 });
      await expect(publications.read(p.token)).rejects.toMatchObject({ status: 410 });
      await expect(remix.template(next.token, 8)).resolves.toBeDefined();
      const copy = await fork(next, 8, 2, toRecipient, 'fork-next-' + id);
      expect(await revenue(copy.dashboardId, 8)).toEqual([{ value: 120 }]);
      expect(await revenue(id, 7)).toEqual([{ value: 400 }]);
    });

    it('a recipient republishes their copy and a third user copies it, and the owner, recipient and third copies stay independent', async () => {
      await setWeightAtLeast(id, 7, 1, 2, 'owner-cond-' + id);
      const p = await publish(id, 7);
      const b = await fork(p, 8, 2, toRecipient, 'fork-b-' + id);
      const bId = b.dashboardId;
      const bPublication = await publish(bId, 8, { requestId: 'publish-copy-' + bId });
      expect(bPublication.version).toBe(1);
      const c = await fork(bPublication, 9, 3, sameNames, 'fork-c-' + id);
      const cId = c.dashboardId;
      expect(cId).not.toBe(bId);
      expect(await revenue(cId, 9)).toEqual([{ value: 40 }]);
      expect(await revenue(bId, 8)).toEqual([{ value: 120 }]);
      expect(await revenue(id, 7)).toEqual([{ value: 400 }]);

      await setWeightAtLeast(bId, 8, 2, 5, 'b-edit-' + id);
      expect(await revenue(bId, 8)).toEqual([{ value: 70 }]);
      expect(await revenue(cId, 9)).toEqual([{ value: 40 }]);
      expect(await revenue(id, 7)).toEqual([{ value: 400 }]);

      await setWeightAtLeast(cId, 9, 3, 1, 'c-edit-' + id);
      expect(await revenue(cId, 9)).toEqual([{ value: 49 }]);
      expect(await revenue(bId, 8)).toEqual([{ value: 70 }]);
      expect(await revenue(id, 7)).toEqual([{ value: 400 }]);
    });
  });

  describe('idempotency of the copy request', () => {
    it('the same requestId with the same body returns the same copy and adds exactly one Dashboard row', async () => {
      await setWeightAtLeast(id, 7, 1, 2, 'owner-cond-' + id);
      const p = await publish(id, 7);
      const before = await db.manager.count(Dashboard);
      const first = await fork(p, 8, 2, toRecipient, 'idem-' + id);
      const second = await fork(p, 8, 2, toRecipient, 'idem-' + id);
      expect(second).toEqual(first);
      expect(second.dashboardId).toBe(first.dashboardId);
      expect(await db.manager.count(Dashboard)).toBe(before + 1);
    });

    it('PENDING POLICY, pins current behaviour: a new requestId for the same recipient creates a second independent copy', async () => {
      await setWeightAtLeast(id, 7, 1, 2, 'owner-cond-' + id);
      const p = await publish(id, 7);
      const before = await db.manager.count(Dashboard);
      const first = await fork(p, 8, 2, toRecipient, 'policy-a-' + id);
      const second = await fork(p, 8, 2, toRecipient, 'policy-b-' + id);
      expect(second.dashboardId).not.toBe(first.dashboardId);
      expect(await db.manager.count(Dashboard)).toBe(before + 2);
      expect(await revenue(second.dashboardId, 8)).toEqual(await revenue(first.dashboardId, 8));
    });

    it('the same requestId with a different body is rejected with 409 and creates no copy', async () => {
      await setWeightAtLeast(id, 7, 1, 2, 'owner-cond-' + id);
      const p = await publish(id, 7);
      const v = await previewCopy(p, 8, 2, toRecipient);
      const first = await commitCopy(p, 8, 2, toRecipient, v, 'conflict-' + id);
      const before = await db.manager.count(Dashboard);
      await expect(
        commitCopy(p, 8, 2, { ...toRecipient, amount: 'weight' }, v, 'conflict-' + id),
      ).rejects.toMatchObject({ status: 409 });
      expect(await db.manager.count(Dashboard)).toBe(before);
      expect(await revenue(first.dashboardId, 8)).toEqual([{ value: 120 }]);
    });
  });

  describe('permission and status codes at the service level', () => {
    it('an anonymous caller can read a link but gets 403 for the template and preview', async () => {
      await setWeightAtLeast(id, 7, 1, 2, 'owner-cond-' + id);
      const p = await publish(id, 7);
      await expect(publications.read(p.token)).resolves.toBeDefined();
      await expect(remix.template(p.token, undefined as any)).rejects.toMatchObject({
        status: 403,
      });
      await expect(
        remix.preview(
          p.token,
          {
            targetSourceId: 2,
            mapping: toRecipient,
            expectedVersion: p.version,
            expectedLifecycleRevision: (await remix.template(p.token, 8)).lifecycleRevision,
          },
          undefined as any,
        ),
      ).rejects.toMatchObject({ status: 403 });
    });

    it('a recipient cannot copy a link onto a source owned by someone else (403)', async () => {
      await setWeightAtLeast(id, 7, 1, 2, 'owner-cond-' + id);
      const p = await publish(id, 7);
      await expect(previewCopy(p, 8, 1, {})).rejects.toMatchObject({ status: 403 });
    });

    it('a private publication is refused to other users with 403', async () => {
      await setWeightAtLeast(id, 7, 1, 2, 'owner-cond-' + id);
      const p = await publish(id, 7, { requestId: 'private-' + id, visibility: 'private' });
      await expect(remix.template(p.token, 8)).rejects.toMatchObject({ status: 403 });
    });

    it('a link published with copying disabled refuses copies with 403 and its template is not served', async () => {
      await setWeightAtLeast(id, 7, 1, 2, 'owner-cond-' + id);
      const p = await publish(id, 7, { requestId: 'no-copy-' + id, allowRemix: false });
      await expect(remix.template(p.token, 8)).rejects.toMatchObject({ status: 403 });
      expect(
        (await db.manager.findOneBy(StudioPublication, { token: p.token })).remixTemplate,
      ).toBeNull();
    });

    it('an expired link is refused with 410 and an unknown or malformed token with 404', async () => {
      await setWeightAtLeast(id, 7, 1, 2, 'owner-cond-' + id);
      const p = await publish(id, 7);
      await db.manager.update(StudioPublication, p.token, {
        expiresAt: new Date(Date.now() - 1000).toISOString(),
      });
      await expect(publications.read(p.token)).rejects.toMatchObject({ status: 410 });
      await expect(remix.template(p.token, 8)).rejects.toMatchObject({ status: 410 });
      await expect(remix.template('e'.repeat(64), 8)).rejects.toMatchObject({ status: 404 });
      await expect(remix.template('not-a-token', 8)).rejects.toMatchObject({ status: 404 });
    });

    it('only the publisher can revoke: another user revoke attempt is refused with 403', async () => {
      await setWeightAtLeast(id, 7, 1, 2, 'owner-cond-' + id);
      const p = await publish(id, 7);
      await expect(publications.revoke(p.token, 8)).rejects.toMatchObject({ status: 403 });
      expect(await revenue(id, 7)).toEqual([{ value: 400 }]);
      await expect(remix.template(p.token, 8)).resolves.toBeDefined();
    });
  });
});
