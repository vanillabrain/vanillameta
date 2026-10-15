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
import {
  PUBLICATION_TICKET_BYTES,
  PUBLICATION_TICKET_LIMIT,
  PUBLICATION_TICKET_TTL_MS,
  PublicationService,
  PublicationTicketStore,
} from './publication.service';
import { PublicationController, PublishedPublicationController } from './publication.controller';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACTOR = 2;
const OTHER = 3;
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
  let revision: string;
  const publications = () => db.getRepository(DashboardPublication);
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
      entities: [Dashboard, DashboardPublication, DashboardWidget, UserMapping, Database],
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
    service = new PublicationService(
      publications(),
      db.getRepository(Dashboard),
      new SourceAccessService(db),
      ai as any,
    );
  });
  afterEach(async () => {
    if (db?.isInitialized) await db.destroy();
    jest.clearAllMocks();
  });

  it('captures a read-only sanitized snapshot with a ticket and hides source detail', async () => {
    const before = await dashboard();
    const result = await ownerPreview();
    expect(ai.analysis).toHaveBeenCalledWith(DASHBOARD, ACTOR, true);
    expect(ai.preview).toHaveBeenCalledWith(
      expect.objectContaining({ includeTrends: true }),
      ACTOR,
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
      snapshot: preview.snapshot,
    });
    expect([ai.analysis.mock.calls.length, ai.preview.mock.calls.length]).toEqual(calls);
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
});

describe('publication preview tickets', () => {
  it('expires a ticket after five minutes and consumes it once', () => {
    let now = 1_000_000;
    const store = new PublicationTicketStore(() => now);
    const ticket = store.put({
      actorId: 1,
      dashboardId: 2,
      revision: 'r',
      snapshot: '{}',
      bytes: 2,
    });
    expect(store.take(ticket)).toBeDefined();
    expect(store.take(ticket)).toBeUndefined();
    const expiring = store.put({
      actorId: 1,
      dashboardId: 2,
      revision: 'r',
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
      store.put({ actorId: 1, dashboardId: i, revision: 'r', snapshot: '{}', bytes: 10 });
    expect(store.size).toBe(PUBLICATION_TICKET_LIMIT);
    const big = new PublicationTicketStore();
    for (let i = 0; i < 19; i++)
      big.put({ actorId: 1, dashboardId: i, revision: 'r', snapshot: 'x', bytes: 1024 * 1024 });
    expect(big.size).toBe(19);
    big.put({ actorId: 1, dashboardId: 99, revision: 'r', snapshot: 'x', bytes: 1024 * 1024 });
    expect(big.size).toBe(20);
    expect(() =>
      big.put({
        actorId: 1,
        dashboardId: 100,
        revision: 'r',
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
