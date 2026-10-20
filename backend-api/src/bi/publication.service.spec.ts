import { EnterpriseGroupDelivery } from '../enterprise/entities/enterprise-group-delivery.entity';
import {
  EnterpriseGroup,
  EnterpriseGroupMember,
  EnterpriseGroupGrant,
} from '../enterprise/entities/enterprise-group.entity';
import { EnterpriseDashboardDelivery } from '../enterprise/entities/enterprise-dashboard-delivery.entity';
jest.mock('../connection/connection.service', () => ({ ConnectionService: class {} }));
jest.mock('../ai/ai.service', () => ({ AiService: class {} }));
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Database } from '../database/entities/database.entity';
import { randomUUID } from 'crypto';
import { Dashboard } from '../dashboard/entities/dashboard.entity';
import { DashboardPublication } from '../dashboard/entities/dashboard-publication.entity';
import { DashboardWidget } from '../dashboard/dashboard-widget/entities/dashboard-widget.entity';
import { dashboardRevision } from '../dashboard/dashboard-revision';
import { SourceAccessService } from '../ownership/source-access.service';
import { UserMapping } from '../user/entities/user-mapping.entity';
import { User } from '../user/entities/user.entity';
import { EnterpriseMembership } from '../enterprise/entities/enterprise-membership.entity';
import { EnterpriseResourceGrant } from '../enterprise/entities/enterprise-resource-grant.entity';
import { EnterpriseResourcePolicyService } from '../enterprise/resource-policy.service';
import { SharedReuseOriginService } from './shared-reuse-origin.service';
import {
  PUBLICATION_TICKET_BYTES,
  PUBLICATION_TICKET_LIMIT,
  PUBLICATION_TICKET_TTL_MS,
  PublicationService,
  PublicationTicketStore,
} from './publication.service';
import { PublicationController, PublishedPublicationController } from './publication.controller';
import { readReuseRecipe } from './reuse-recipe';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACTOR = 2;
const OTHER = 3;
/** UC-051: a delegated publisher who is neither the dashboard owner nor the source owner. */
const DELEGATE = 5;
const DASHBOARD = 12;
const blocks = ['block-1', 'block-2'];
const layouts = () => ({
  mobile: Object.fromEntries(blocks.map((id, i) => [id, { x: 0, y: i * 3, w: 4, h: 2 }])),
  tablet: Object.fromEntries(blocks.map((id, i) => [id, { x: 0, y: i * 3, w: 8, h: 2 }])),
  desktop: Object.fromEntries(blocks.map((id, i) => [id, { x: 0, y: i * 3, w: 12, h: 2 }])),
});
const definitions = () => [
  {
    blockId: 'block-1',
    title: '매출',
    description: '합계',
    type: 'BOARD_NUMERIC',
    sql: 'SELECT SUM(amount) AS total FROM source',
    valueField: 'total',
    decimalPlaces: 0,
    numberNotation: 'compact',
  },
  {
    blockId: 'block-2',
    title: '채널',
    description: '',
    type: 'CHART_COLUMN',
    sql: 'SELECT channel, SUM(amount) AS total FROM source GROUP BY channel',
    valueField: 'total',
    categoryField: 'channel',
  },
];
const draft = () => ({
  databaseId: 7,
  title: 'Fixture',
  explanation: '전체 기간 · 데스크톱 · 공통 필터',
  layoutSizes: [
    { width: 12, height: 3 },
    { width: 6, height: 5 },
  ],
  widgets: definitions(),
});
const captured = () => [
  {
    ...definitions()[0],
    datas: [{ total: 120, internal_note: 'secret' }],
    contribution: { supported: true, components: [] },
    trend: {
      column: 'day',
      grain: 'day',
      points: [{ time: '2023-09-09', value: 10, extra: 'x' }],
      contribution: { supported: true },
      timeSelection: { column: 'day' },
    },
  },
  {
    ...definitions()[1],
    datas: [{ channel: 'A', total: 5, hidden: 'x' }],
    contribution: { supported: true, components: [] },
  },
];
const expiry = (days = 7) => new Date(Date.now() + days * 86400000).toISOString();

describe('UC-018 publication backend', () => {
  let db: DataSource;
  let service: PublicationService;
  let ai: { analysis: jest.Mock; preview: jest.Mock };
  let bi: { profile: jest.Mock };
  let revision: string;
  let access: SourceAccessService;
  const publications = () => db.getRepository(DashboardPublication);
  /** UC-051 grants are inserted directly; the administration API has its own policy tests. */
  const grant = (
    kind: 'source' | 'dashboard',
    resourceId: number,
    rights: { read?: boolean; publish?: boolean },
    version = 1,
  ) =>
    db.getRepository(EnterpriseResourceGrant).save({
      resourceKind: kind,
      resourceId,
      recipientId: DELEGATE,
      organizationId: 1,
      ownerId: ACTOR,
      version,
      read: rights.read === true,
      edit: false,
      publish: rights.publish === true,
      export: false,
    });
  const dashboard = () => db.getRepository(Dashboard).findOneOrFail({ where: { id: DASHBOARD } });
  const currentRevision = async () => dashboardRevision(await dashboard());

  const ownerPreview = async (expected = revision) =>
    service.preview(DASHBOARD, ACTOR, { expectedRevision: expected });
  const publishBody = async (preview: any, version: number, over: any = {}) => ({
    expectedRevision: preview.revision,
    expectedVersion: version,
    ticket: preview.ticket,
    requestId: randomUUID(),
    expiresAt: expiry(),
    visibility: 'link',
    ...over,
  });

  beforeEach(async () => {
    db = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      entities: [
        Dashboard,
        DashboardPublication,
        DashboardWidget,
        UserMapping,
        Database,
        User,
        EnterpriseMembership,
        EnterpriseResourceGrant,
        EnterpriseGroup,
        EnterpriseGroupMember,
        EnterpriseGroupGrant,
        EnterpriseDashboardDelivery,
        EnterpriseGroupDelivery,
      ],
      synchronize: true,
    }).initialize();
    await db.getRepository(Dashboard).save({
      id: DASHBOARD,
      updatedAt: new Date('2020-01-01T00:00:00.000Z'),
      title: 'Fixture',
      analysisDefinition: JSON.stringify(draft()),
      layout: JSON.stringify([
        { i: '1', x: 0, y: 0, w: 12, h: 3 },
        { i: '2', x: 0, y: 3, w: 6, h: 5 },
      ]),
      delYn: 'N',
    });
    await db.getRepository(Database).save({
      id: 7,
      ownerId: ACTOR,
      name: 'Fixture source',
      engine: 'duckdb',
      type: 'FILE',
      connectionConfig: '{}',
    });
    await db.getRepository(UserMapping).save({ dashboardId: DASHBOARD, userInfoId: ACTOR });
    revision = await currentRevision();
    ai = {
      analysis: jest.fn(async () => ({
        status: 'SUCCESS',
        data: { ...draft(), revision, responsiveLayouts: layouts() },
      })),
      preview: jest.fn(async () => ({
        status: 'SUCCESS',
        data: {
          draft: draft(),
          sourceRevision: 'v1',
          widgets: captured(),
          queries: [{ sql: 'SELECT SUM(amount) FROM source' }],
        },
      })),
    };
    // The recipe capture reads the owner's source profile; nothing else here may call it.
    bi = {
      profile: jest.fn(async () => ({
        sourceId: 7,
        supported: true,
        name: 'Fixture source',
        dataVersion: 'v1',
        connectionConfig: '{"password":"secret"}',
        preview: [{ amount: 1, channel: 'A' }],
        columns: [
          { name: 'amount', type: 'DOUBLE', numeric: true, temporal: false, nullCount: '0' },
          { name: 'channel', type: 'VARCHAR', numeric: false, temporal: false, nullCount: '0' },
          // Not read by the SQL, so it must not travel with the recipe.
          { name: 'day', type: 'DATE', numeric: false, temporal: true, nullCount: '0' },
          { name: 'note', type: 'VARCHAR', numeric: false, temporal: false, nullCount: '0' },
        ],
      })),
    };
    // The shared fixture keeps the legacy owner-only service; the delegation test injects the policy.
    access = new SourceAccessService(db);
    service = new PublicationService(
      publications(),
      db.getRepository(Dashboard),
      access,
      ai as any,
      bi as any,
    );
  });
  afterEach(async () => {
    if (db?.isInitialized) await db.destroy();
    jest.clearAllMocks();
  });

  it('closes old public snapshots and pending publication tickets after organization policy', async () => {
    const preview = await ownerPreview();
    const first = await service.publish(DASHBOARD, ACTOR, await publishBody(preview, 0));
    const pending = await ownerPreview();
    await db.getRepository(Dashboard).update(DASHBOARD, { governed: true });
    await expect(service.publicResult(first.publication.uuid)).rejects.toMatchObject({
      status: 404,
    });
    await expect(
      service.publish(DASHBOARD, ACTOR, await publishBody(pending, first.version)),
    ).rejects.toMatchObject({ status: 403 });
    expect((await publications().findOneBy({ dashboardId: DASHBOARD })).version).toBe(
      first.version,
    );
  });

  it('captures a read-only sanitized snapshot with a ticket and hides source detail', async () => {
    const before = await dashboard();
    const result = await ownerPreview();
    expect(ai.analysis).toHaveBeenCalledWith(DASHBOARD, ACTOR, true, 'publish');
    expect(ai.preview).toHaveBeenCalledWith(
      expect.objectContaining({ includeTrends: true }),
      ACTOR,
      'publish',
    );
    expect(result.dashboardId).toBe(DASHBOARD);
    expect(result.revision).toBe(revision);
    expect(result.ticket).toMatch(UUID);
    expect(result.snapshot.schemaVersion).toBe(1);
    expect(result.snapshot.scope).toContain('UTC');
    expect(Number.isFinite(Date.parse(result.snapshot.capturedAt))).toBe(true);
    expect(result.snapshot.widgets.map((w: any) => Object.keys(w).sort())).toEqual([
      [
        'blockId',
        'datas',
        'decimalPlaces',
        'description',
        'numberNotation',
        'title',
        'trend',
        'type',
        'valueField',
      ].sort(),
      ['blockId', 'categoryField', 'datas', 'description', 'title', 'type', 'valueField'].sort(),
    ]);
    expect(result.snapshot.widgets[0].datas).toEqual([{ total: 120 }]);
    expect(result.snapshot.widgets[1].datas).toEqual([{ total: 5, channel: 'A' }]);
    expect(result.snapshot.widgets[0].trend.points).toEqual([{ time: '2023-09-09', value: 10 }]);
    expect(result.snapshot.responsiveLayouts.desktop['block-1']).toEqual({
      x: 0,
      y: 0,
      w: 12,
      h: 2,
    });
    const serialized = JSON.stringify(result.snapshot);
    for (const leak of ['SELECT', 'SUM(', 'databaseId', 'queries', 'internal_note', 'hidden'])
      expect(serialized).not.toContain(leak);
    expect(await publications().count()).toBe(0);
    const after = await dashboard();
    expect([after.title, after.analysisDefinition, after.layout]).toEqual([
      before.title,
      before.analysisDefinition,
      before.layout,
    ]);
  });

  it('rejects a malformed or stale expected revision before any provider call', async () => {
    await expect(
      service.preview(DASHBOARD, ACTOR, { expectedRevision: 'nope' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.preview(DASHBOARD, ACTOR, { expectedRevision: revision, extra: 1 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(ownerPreview('a'.repeat(64))).rejects.toBeInstanceOf(ConflictException);
    expect(ai.analysis).not.toHaveBeenCalled();
    expect(await publications().count()).toBe(0);
  });

  it('publishes once and republishes the same link with the next version', async () => {
    const first = await ownerPreview();
    const published = await service.publish(DASHBOARD, ACTOR, await publishBody(first, 0));
    expect(published.version).toBe(1);
    expect(published.publication).toEqual({
      uuid: published.publication.uuid,
      version: 1,
      publishedAt: published.publication.publishedAt,
      expiresAt: published.publication.expiresAt,
      dashboardRevision: revision,
      active: true,
      reusable: false,
    });
    expect(published.publication.uuid).toMatch(UUID);
    expect((await dashboard()).updatedAt.toISOString()).toBe('2020-01-01T00:00:00.000Z');
    const second = await ownerPreview();
    const again = await service.publish(DASHBOARD, ACTOR, await publishBody(second, 1));
    expect(again.version).toBe(2);
    expect(again.publication.uuid).toBe(published.publication.uuid);
    expect(await publications().count()).toBe(1);
  });

  it('rotates the public uuid after revoke and keeps the old link dead', async () => {
    const first = await ownerPreview();
    const published = await service.publish(DASHBOARD, ACTOR, await publishBody(first, 0));
    const oldUuid = published.publication.uuid;
    const revoked = await service.revoke(DASHBOARD, ACTOR, { expectedVersion: 1 });
    expect(revoked.version).toBe(2);
    expect(revoked.publication.active).toBe(false);
    await expect(service.publicResult(oldUuid)).rejects.toBeInstanceOf(NotFoundException);
    const second = await ownerPreview();
    const republished = await service.publish(DASHBOARD, ACTOR, await publishBody(second, 2));
    expect(republished.version).toBe(3);
    expect(republished.publication.uuid).not.toBe(oldUuid);
    await expect(service.publicResult(oldUuid)).rejects.toBeInstanceOf(NotFoundException);
    const served = await service.publicResult(republished.publication.uuid);
    expect((served.snapshot as any).schemaVersion).toBe(1);
    expect(await publications().count()).toBe(1);
  });

  it('checks the pinned revoke version before the inactive shortcut', async () => {
    const preview = await ownerPreview();
    await service.publish(DASHBOARD, ACTOR, await publishBody(preview, 0));
    await service.revoke(DASHBOARD, ACTOR, { expectedVersion: 1 });
    await expect(service.revoke(DASHBOARD, ACTOR, { expectedVersion: 1 })).rejects.toBeInstanceOf(
      ConflictException,
    );
    const stable = await service.revoke(DASHBOARD, ACTOR, { expectedVersion: 2 });
    expect(stable.version).toBe(2);
    expect(stable.publication.active).toBe(false);
  });

  it('replays the last publish request instead of creating another version', async () => {
    const preview = await ownerPreview();
    const body = await publishBody(preview, 0);
    const first = await service.publish(DASHBOARD, ACTOR, body);
    const replay = await service.publish(DASHBOARD, ACTOR, body);
    expect(first.version).toBe(1);
    expect(replay.version).toBe(1);
    expect(replay.publication.uuid).toBe(first.publication.uuid);
    expect(await publications().count()).toBe(1);
    expect((await publications().findOne({ where: { dashboardId: DASHBOARD } }))?.version).toBe(1);
  });

  it('reports the current revision on a replay and rejects a reused id with other content', async () => {
    const preview = await ownerPreview();
    const body = await publishBody(preview, 0);
    await service.publish(DASHBOARD, ACTOR, body);
    await db.getRepository(Dashboard).update({ id: DASHBOARD }, { title: 'Fixture v2' });
    const changed = await currentRevision();
    const replay = await service.publish(DASHBOARD, ACTOR, body);
    expect(replay.version).toBe(1);
    expect(replay.revision).toBe(changed);
    await expect(
      service.publish(DASHBOARD, ACTOR, { ...body, expiresAt: expiry(8) }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('never resurrects a revoked link from a replayed publish request', async () => {
    const preview = await ownerPreview();
    const body = await publishBody(preview, 0);
    await service.publish(DASHBOARD, ACTOR, body);
    await service.revoke(DASHBOARD, ACTOR, { expectedVersion: 1 });
    await expect(service.publish(DASHBOARD, ACTOR, body)).rejects.toBeInstanceOf(ConflictException);
    const row = await publications().findOneOrFail({ where: { dashboardId: DASHBOARD } });
    expect([row.version, row.active]).toEqual([2, false]);
    await expect(service.publicResult(row.uuid)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects a stale version, a stale revision, an unknown ticket and an overlong expiry', async () => {
    const first = await ownerPreview();
    await service.publish(DASHBOARD, ACTOR, await publishBody(first, 0));
    const second = await ownerPreview();
    await expect(
      service.publish(DASHBOARD, ACTOR, await publishBody(second, 0)),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      service.publish(DASHBOARD, ACTOR, await publishBody(second, 1, { ticket: randomUUID() })),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.publish(DASHBOARD, ACTOR, await publishBody(second, 1, { expiresAt: expiry(31) })),
    ).rejects.toBeInstanceOf(BadRequestException);
    await db.getRepository(Dashboard).update({ id: DASHBOARD }, { title: 'Fixture v3' });
    await expect(
      service.publish(DASHBOARD, ACTOR, await publishBody(second, 1)),
    ).rejects.toBeInstanceOf(ConflictException);
    const row = await publications().findOneOrFail({ where: { dashboardId: DASHBOARD } });
    expect([row.version, row.active]).toEqual([1, true]);
    expect(await publications().count()).toBe(1);
  });

  it('serializes concurrent publishes into a single version', async () => {
    const first = await ownerPreview();
    const second = await ownerPreview();
    const results = await Promise.allSettled([
      service.publish(DASHBOARD, ACTOR, await publishBody(first, 0)),
      service.publish(DASHBOARD, ACTOR, await publishBody(second, 0)),
    ]);
    const fulfilled = results.filter(item => item.status === 'fulfilled');
    const rejected = results.filter(item => item.status === 'rejected') as PromiseRejectedResult[];
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBeInstanceOf(ConflictException);
    expect(await publications().count()).toBe(1);
    expect(
      (await publications().findOneOrFail({ where: { dashboardId: DASHBOARD } })).version,
    ).toBe(1);
  });

  it('fails closed when the aggregate result or the publication row is unusable', async () => {
    ai.preview.mockImplementationOnce(async () => {
      throw new Error('DUCKDB_QUERY_FAILED');
    });
    await expect(ownerPreview()).rejects.toThrow('DUCKDB_QUERY_FAILED');
    expect(await publications().count()).toBe(0);
    ai.preview.mockImplementationOnce(async () => ({
      status: 'SUCCESS',
      data: {
        draft: draft(),
        widgets: [{ ...captured()[0], datas: [{ total: 1 }, { total: 2 }] }, captured()[1]],
      },
    }));
    await expect(ownerPreview()).rejects.toBeInstanceOf(BadRequestException);
    const preview = await ownerPreview();
    const published = await service.publish(DASHBOARD, ACTOR, await publishBody(preview, 0));
    expect(published.version).toBe(1);
    await expect(
      service.revoke(DASHBOARD + 1, ACTOR, { expectedVersion: 1 }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(await publications().count()).toBe(1);
  });

  it('serves the stored snapshot anonymously without AI or query calls', async () => {
    const preview = await ownerPreview();
    const published = await service.publish(DASHBOARD, ACTOR, await publishBody(preview, 0));
    const calls = [ai.analysis.mock.calls.length, ai.preview.mock.calls.length];
    const result = await service.publicResult(published.publication.uuid);
    expect(result).toEqual({
      version: 1,
      publishedAt: published.publication.publishedAt,
      expiresAt: published.publication.expiresAt,
      visibility: 'link',
      dataMode: 'snapshot',
      reusable: false,
      snapshot: preview.snapshot,
    });
    expect([ai.analysis.mock.calls.length, ai.preview.mock.calls.length]).toEqual(calls);
  });

  it('defaults to no reuse and never captures a recipe', async () => {
    const preview = await ownerPreview();
    expect(preview.reusable).toBe(false);
    expect(bi.profile).not.toHaveBeenCalled();
    const published = await service.publish(DASHBOARD, ACTOR, await publishBody(preview, 0));
    expect(published.publication.reusable).toBe(false);
    const row = await publications().findOneOrFail({ where: { dashboardId: DASHBOARD } });
    expect(row.reuseDefinition).toBeNull();
    const served = await service.publicResult(published.publication.uuid);
    expect(served.reusable).toBe(false);
    expect(bi.profile).not.toHaveBeenCalled();
  });

  it('captures a redacted recipe only for an explicit owner opt-in', async () => {
    const preview = await service.preview(DASHBOARD, ACTOR, {
      expectedRevision: revision,
      allowReuse: true,
    });
    expect(preview.reusable).toBe(true);
    expect(bi.profile).toHaveBeenCalledWith(7, ACTOR);
    const published = await service.publish(DASHBOARD, ACTOR, await publishBody(preview, 0));
    expect(published.publication.reusable).toBe(true);
    const stored = (await publications().findOneOrFail({ where: { dashboardId: DASHBOARD } }))
      .reuseDefinition as string;
    const recipe = JSON.parse(stored);
    expect(Object.keys(recipe).sort()).toEqual(['analysis', 'profile', 'schemaVersion']);
    expect(recipe.schemaVersion).toBe(1);
    // The owner's live source identity is replaced by the redacted placeholder.
    expect(recipe.analysis.databaseId).toBe(1);
    expect(recipe.profile.sourceId).toBe(1);
    expect(recipe.profile.columns).toEqual([
      { name: 'amount', type: 'DOUBLE', numeric: true, temporal: false },
      { name: 'channel', type: 'VARCHAR', numeric: false, temporal: false },
    ]);
    expect(recipe.analysis.widgets.map((widget: any) => widget.blockId)).toEqual(blocks);
    expect(recipe.analysis.responsiveLayouts.desktop['block-1']).toEqual({
      x: 0,
      y: 0,
      w: 12,
      h: 2,
    });
    for (const leak of ['Fixture source', 'password', 'nullCount', 'preview', 'datas'])
      expect(stored).not.toContain(leak);
    // The same bytes round-trip through the reader the reuse API uses.
    const read = readReuseRecipe(stored);
    expect(read.profile.columns.map(column => column.name)).toEqual(['amount', 'channel']);
    expect(read.analysis.widgets).toHaveLength(2);
    const state = await service.state(DASHBOARD, ACTOR);
    expect(state.publication).toMatchObject({ active: true, reusable: true });
  });

  it('rejects an opt-in that cannot be captured or a malformed flag', async () => {
    bi.profile.mockResolvedValueOnce({ sourceId: 7, supported: false, columns: [] });
    await expect(
      service.preview(DASHBOARD, ACTOR, { expectedRevision: revision, allowReuse: true }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(await publications().count()).toBe(0);
    await expect(
      service.preview(DASHBOARD, ACTOR, { expectedRevision: revision, allowReuse: 'yes' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.preview(DASHBOARD, ACTOR, { expectedRevision: revision, reuseDefinition: 'x' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(bi.profile).toHaveBeenCalledTimes(1);
  });

  it('freezes the recipe with the published version and clears it on a later opt-out', async () => {
    const preview = await service.preview(DASHBOARD, ACTOR, {
      expectedRevision: revision,
      allowReuse: true,
    });
    const published = await service.publish(DASHBOARD, ACTOR, await publishBody(preview, 0));
    const frozen = (await publications().findOneOrFail({ where: { dashboardId: DASHBOARD } }))
      .reuseDefinition;
    // A later save must not rewrite the published recipe: the public read is served from the row.
    await db.getRepository(Dashboard).update({ id: DASHBOARD }, { title: 'Fixture v2' });
    const served = await service.publicResult(published.publication.uuid);
    expect(served.reusable).toBe(true);
    expect(served.snapshot).toEqual(preview.snapshot);
    expect(
      (await publications().findOneOrFail({ where: { dashboardId: DASHBOARD } })).reuseDefinition,
    ).toBe(frozen);
    const next = await ownerPreview(await currentRevision());
    const again = await service.publish(DASHBOARD, ACTOR, await publishBody(next, 1));
    expect(again.publication.reusable).toBe(false);
    expect(
      (await publications().findOneOrFail({ where: { dashboardId: DASHBOARD } })).reuseDefinition,
    ).toBeNull();
  });

  it('blocks inactive public snapshots and old prepared publish tickets across restoration without changing snapshot/version', async () => {
    const prepared = await ownerPreview();
    const body = await publishBody(prepared, 0);
    const published = await service.publish(DASHBOARD, ACTOR, body);
    const row = await publications().findOneOrFail({ where: { dashboardId: DASHBOARD } });
    const another = await ownerPreview();
    const pending = await publishBody(another, 1);
    await db.manager.update(Dashboard, DASHBOARD, { assetActive: false, assetVersion: 1 });
    await expect(service.publicResult(row.uuid)).rejects.toMatchObject({ status: 404 });
    await db.manager.update(Dashboard, DASHBOARD, { assetActive: true, assetVersion: 2 });
    await expect(service.publish(DASHBOARD, ACTOR, pending)).rejects.toMatchObject({ status: 409 });
    expect(await publications().findOneBy({ dashboardId: DASHBOARD })).toEqual(row);
    expect((await service.publicResult(published.publication.uuid)).version).toBe(1);
  });
  it('lets the current inactive owner admin revoke and restoration never revives that snapshot', async () => {
    const preview = await ownerPreview();
    const result = await service.publish(DASHBOARD, ACTOR, await publishBody(preview, 0));
    await db.manager.save(User, {
      id: ACTOR,
      userId: 'lifecycle-owner',
      email: 'lifecycle-owner@example.invalid',
      password: 'unused',
      active: true,
    });
    await db.manager.save(EnterpriseMembership, {
      userId: ACTOR,
      organizationId: 1,
      role: 'admin',
      team: '',
    });
    const managed = new PublicationService(
      publications(),
      db.getRepository(Dashboard),
      new SourceAccessService(db, new EnterpriseResourcePolicyService(db)),
      ai as any,
      bi as any,
    );
    await db.manager.update(Dashboard, DASHBOARD, { assetActive: false, assetVersion: 1 });
    await managed.revoke(DASHBOARD, ACTOR, { expectedVersion: 1 });
    await db.manager.update(Dashboard, DASHBOARD, { assetActive: true, assetVersion: 2 });
    await expect(service.publicResult(result.publication.uuid)).rejects.toMatchObject({
      status: 404,
    });
    expect((await publications().findOneBy({ dashboardId: DASHBOARD })).active).toBe(false);
  });
  it('hides unknown, revoked, expired and deleted publications behind 404', async () => {
    await expect(service.publicResult(randomUUID())).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.publicResult('not-a-uuid')).rejects.toBeInstanceOf(NotFoundException);
    const preview = await ownerPreview();
    const published = await service.publish(DASHBOARD, ACTOR, await publishBody(preview, 0));
    await publications().update(
      { dashboardId: DASHBOARD },
      { expiresAt: new Date(Date.now() - 1000).toISOString() },
    );
    await expect(service.publicResult(published.publication.uuid)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await publications().update({ dashboardId: DASHBOARD }, { expiresAt: expiry() });
    await db.getRepository(Dashboard).update({ id: DASHBOARD }, { delYn: 'Y' });
    await expect(service.publicResult(published.publication.uuid)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await db.getRepository(Dashboard).update({ id: DASHBOARD }, { delYn: 'N' });
    await service.revoke(DASHBOARD, ACTOR, { expectedVersion: 1 });
    await expect(service.publicResult(published.publication.uuid)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('UC055 rejects a captured publication after Source deletion before any publication/CAS write', async () => {
    const preview = await service.preview(DASHBOARD, ACTOR, { expectedRevision: revision });
    const before = await db.manager.findOneBy(Dashboard, { id: DASHBOARD });
    await db.manager.delete(Database, 7);
    await expect(
      service.publish(DASHBOARD, ACTOR, await publishBody(preview, 0)),
    ).rejects.toMatchObject({ status: 403 });
    expect(await db.manager.count(DashboardPublication)).toBe(0);
    expect(await db.manager.findOneBy(Dashboard, { id: DASHBOARD })).toEqual(before);
  });
  it('UC055 rejects source metadata replacement after the publication preview with zero publication writes', async () => {
    const preview = await service.preview(DASHBOARD, ACTOR, { expectedRevision: revision });
    await db.manager.update(Database, 7, { connectionConfig: '{"changed":true}' });
    await expect(
      service.publish(DASHBOARD, ACTOR, await publishBody(preview, 0)),
    ).rejects.toMatchObject({ status: 409 });
    expect(await db.manager.count(DashboardPublication)).toBe(0);
  });
  it('refuses owner endpoints for a dashboard the actor does not own', async () => {
    for (const call of [
      () => service.state(DASHBOARD, OTHER),
      () => service.preview(DASHBOARD, OTHER, { expectedRevision: revision }),
      () => service.publish(DASHBOARD, OTHER, {}),
      () => service.revoke(DASHBOARD, OTHER, { expectedVersion: 0 }),
    ])
      await expect(call()).rejects.toBeInstanceOf(ForbiddenException);
    expect(await publications().count()).toBe(0);
  });

  it('returns absent publication state and an empty revoke boundary', async () => {
    const state = await service.state(DASHBOARD, ACTOR);
    expect(state).toEqual({ dashboardId: DASHBOARD, revision, version: 0, publication: null });
    await expect(service.revoke(DASHBOARD, ACTOR, { expectedVersion: 0 })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
  it('rechecks the delegated publisher for state, public read and private reuse', async () => {
    await db.getRepository(User).save([
      { id: ACTOR, userId: 'owner', email: 'owner@example.com', password: 'x', active: true },
      {
        id: DELEGATE,
        userId: 'delegate',
        email: 'delegate@example.com',
        password: 'x',
        active: true,
      },
    ]);
    await db.getRepository(EnterpriseMembership).save([
      { userId: ACTOR, organizationId: 1, role: 'admin', team: '' },
      { userId: DELEGATE, organizationId: 1, role: 'member', team: '' },
    ]);
    await grant('dashboard', DASHBOARD, { read: true });
    await grant('source', 7, { read: true });
    const delegatedAccess = new SourceAccessService(db, new EnterpriseResourcePolicyService(db));
    const delegated = new PublicationService(
      publications(),
      db.getRepository(Dashboard),
      delegatedAccess,
      ai as any,
      bi as any,
    );
    // A read-only grantee must not receive the anonymous publication uuid, and cannot publish.
    await expect(delegated.state(DASHBOARD, DELEGATE)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      delegated.preview(DASHBOARD, DELEGATE, { expectedRevision: revision }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    await grant('dashboard', DASHBOARD, { read: true, publish: true }, 2);
    const preview = await delegated.preview(DASHBOARD, DELEGATE, {
      expectedRevision: revision,
      allowReuse: true,
    });
    await delegated.publish(DASHBOARD, DELEGATE, await publishBody(preview, 0));
    const row = await publications().findOneOrFail({ where: { dashboardId: DASHBOARD } });
    // The real publishing actor and the captured source are stored, never the dashboard owner.
    expect(row.publisherId).toBe(DELEGATE);
    expect(row.sourceId).toBe(7);
    await expect(delegated.state(DASHBOARD, DELEGATE)).resolves.toMatchObject({ version: 1 });

    const published: any = await delegated.publicResult(row.uuid);
    expect(published).not.toHaveProperty('publisherId');
    expect(published.snapshot).toBeDefined();

    const reuse = new SharedReuseOriginService(db, ai as any, bi as any, delegatedAccess);
    await expect(reuse.resolve('publication', row.uuid)).resolves.toMatchObject({
      originalId: DASHBOARD,
    });

    // Publish revoked while read is kept: the public link and the private recipe both close.
    await grant('dashboard', DASHBOARD, { read: true, publish: false }, 3);
    await expect(delegated.publicResult(row.uuid)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(reuse.resolve('publication', row.uuid)).rejects.toBeInstanceOf(ForbiddenException);
    expect(await db.getRepository(UserMapping).count()).toBe(1);

    // A row published before the delegation columns existed keeps the single-owner fallback.
    await publications().update({ dashboardId: DASHBOARD }, { publisherId: null, sourceId: null });
    await expect(delegated.publicResult(row.uuid)).resolves.toBeDefined();
  });
});

describe('publication preview tickets', () => {
  it('expires a ticket after five minutes and consumes it once', () => {
    let now = 1_000_000;
    const store = new PublicationTicketStore(() => now);
    const ticket = store.put({
      actorId: 1,
      dashboardId: 2,
      revision: 'r',
      sourceId: 7,
      snapshot: '{}',
      bytes: 2,
    });
    expect(store.take(ticket)).toBeDefined();
    expect(store.take(ticket)).toBeUndefined();
    const expiring = store.put({
      actorId: 1,
      dashboardId: 2,
      revision: 'r',
      sourceId: 7,
      snapshot: '{}',
      bytes: 2,
    });
    now += PUBLICATION_TICKET_TTL_MS + 1;
    expect(store.take(expiring)).toBeUndefined();
    expect(store.size).toBe(0);
  });

  it('caps stored tickets at 100 entries and 20MiB', () => {
    const store = new PublicationTicketStore();
    for (let i = 0; i <= PUBLICATION_TICKET_LIMIT; i++)
      store.put({
        actorId: 1,
        dashboardId: i,
        revision: 'r',
        sourceId: 7,
        snapshot: '{}',
        bytes: 10,
      });
    expect(store.size).toBe(PUBLICATION_TICKET_LIMIT);
    const big = new PublicationTicketStore();
    for (let i = 0; i < 19; i++)
      big.put({
        actorId: 1,
        dashboardId: i,
        revision: 'r',
        sourceId: 7,
        snapshot: 'x',
        bytes: 1024 * 1024,
      });
    expect(big.size).toBe(19);
    big.put({
      actorId: 1,
      dashboardId: 99,
      revision: 'r',
      sourceId: 7,
      snapshot: 'x',
      bytes: 1024 * 1024,
    });
    expect(big.size).toBe(20);
    expect(() =>
      big.put({
        actorId: 1,
        dashboardId: 100,
        revision: 'r',
        sourceId: 7,
        snapshot: 'x',
        bytes: PUBLICATION_TICKET_BYTES + 1,
      }),
    ).toThrow(ServiceUnavailableException);
  });
});

describe('publication controller contract', () => {
  const headers = (method: any) => Reflect.getMetadata('__headers__', method) ?? [];
  it('marks owner and public reads as non cacheable', () => {
    expect(headers(PublicationController.prototype.state)).toContainEqual({
      name: 'Cache-Control',
      value: 'no-store',
    });
    expect(headers(PublishedPublicationController.prototype.read)).toContainEqual({
      name: 'Cache-Control',
      value: 'no-store',
    });
  });

  it('returns the standard success envelope for the anonymous read without a guard', async () => {
    const controller = new PublishedPublicationController({
      publicResult: async (uuid: string) => ({ version: 3, uuid }),
    } as any);
    await expect(controller.read('u-1')).resolves.toEqual({
      status: 'SUCCESS',
      data: { version: 3, uuid: 'u-1' },
    });
    expect(Reflect.getMetadata('__guards__', PublishedPublicationController)).toBeUndefined();
  });

  it('wraps owner preview and publish responses in the success envelope', async () => {
    const calls: string[] = [];
    const controller = new PublicationController({
      state: async () => {
        calls.push('state');
        return { version: 0 };
      },
      preview: async () => {
        calls.push('preview');
        return { ticket: 't' };
      },
      publish: async () => {
        calls.push('publish');
        return { version: 1 };
      },
      revoke: async () => {
        calls.push('revoke');
        return { version: 2 };
      },
    } as any);
    const req = { user: { accessKeyData: { id: ACTOR } } };
    expect(await controller.preview('12', {}, req)).toEqual({
      status: 'SUCCESS',
      data: { ticket: 't' },
    });
    expect(await controller.publish('12', {}, req)).toEqual({
      status: 'SUCCESS',
      data: { version: 1 },
    });
    expect(await controller.state('12', req)).toEqual({ status: 'SUCCESS', data: { version: 0 } });
    expect(await controller.revoke('12', {}, req)).toEqual({
      status: 'SUCCESS',
      data: { version: 2 },
    });
    expect(calls).toEqual(['preview', 'publish', 'state', 'revoke']);
  });
});
