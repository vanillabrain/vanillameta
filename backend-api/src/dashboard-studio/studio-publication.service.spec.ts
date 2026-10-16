jest.mock('../ai/ai.service', () => ({ AiService: class {} }));
import { DataSource } from 'typeorm';
import { AiDashboardService } from '../ai/ai-dashboard.service';
import { DuckDBService } from '../analysis/duckdb.service';
import { Dashboard } from '../dashboard/entities/dashboard.entity';
import { DashboardShare } from '../dashboard/entities/dashboard_share.entity';
import { DashboardWidget } from '../dashboard/dashboard-widget/entities/dashboard-widget.entity';
import { UserMapping } from '../user/entities/user-mapping.entity';
import { Database } from '../database/entities/database.entity';
import { Dataset } from '../dataset/entities/dataset.entity';
import { Widget } from '../widget/entities/widget.entity';
import { Component } from '../component/entities/component.entity';
import { Metric } from '../metric/entities/metric.entity';
import { StudioState } from './entities/studio-state.entity';
import { StudioPublication, StudioPublicationRequest } from './entities/studio-publication.entity';
import { StudioPublicationService } from './studio-publication.service';
import { StudioRun } from './entities/studio-run.entity';
import { studioDigest } from './studio-legacy';
import { applyStudioOperation } from './studio-operations';
import { StudioService } from './studio.service';
import { SourceAccessService } from '../ownership/source-access.service';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
const draft = () => ({
  databaseId: 1,
  title: 'Studio actual',
  explanation: 'All time',
  widgets: [
    {
      title: 'Revenue',
      description: '',
      type: 'BOARD_NUMERIC',
      sql: 'SELECT sum(amount) AS value FROM source',
      valueField: 'value',
      decimalPlaces: 0,
    },
    {
      title: 'Channels',
      description: '',
      type: 'CHART_COLUMN',
      sql: 'SELECT category,sum(amount) AS value FROM source GROUP BY category',
      categoryField: 'category',
      valueField: 'value',
      decimalPlaces: 0,
    },
  ],
});
describe('T8 publication with real DuckDB aggregates and transactional metadata', () => {
  let db: DataSource,
    worker: DuckDBService,
    ai: AiDashboardService,
    studio: StudioService,
    publications: StudioPublicationService,
    root: string,
    id: number,
    connection: any;
  const previous = process.env.FILE_UPLOAD_DIR;
  beforeAll(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-t4-'));
    process.env.FILE_UPLOAD_DIR = root;
    worker = new DuckDBService();
    const file = await worker.importFile({
      originalname: 'studio.csv',
      buffer: Buffer.from(
        'category,amount,event_time\nSite,300,2026-01-01T00:00:00Z\nMobile,200,2026-01-02T00:00:00Z\n',
      ),
    });
    db = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      synchronize: true,
      entities: [
        Dashboard,
        DashboardShare,
        DashboardWidget,
        UserMapping,
        Database,
        Dataset,
        Widget,
        Component,
        Metric,
        StudioState,
        StudioRun,
        StudioPublication,
        StudioPublicationRequest,
      ],
    }).initialize();
    await db.manager.save(Database, {
      id: 1,
      ownerId: 7,
      name: 'Source',
      connectionConfig: '{}',
      engine: 'duckdb',
      type: 'FILE',
    });
    for (const type of ['BOARD_NUMERIC', 'CHART_COLUMN', 'CHART_LINE'])
      await db.manager.save(Component, { type, title: type, option: '{}', useYn: 'Y' });
    connection = {
      withDuckDBSnapshot: jest.fn((_id, cb) => cb()),
      duckDBVersion: jest.fn().mockResolvedValue(studioDigest('test-source')),
      isDuckDB: jest.fn().mockResolvedValue(true),
      queryDuckDB: jest.fn((_id, sql, bindings) => worker.query(file.filename, sql, bindings)),
    };
    ai = new AiDashboardService({} as any, connection, db.getRepository(Dashboard));
    studio = new StudioService(db, ai, connection, new SourceAccessService(db));
    publications = new StudioPublicationService(db, studio);
  });
  beforeEach(async () => {
    id = (await ai.save({ draft: draft() }, 7)).data.id;
  });
  afterAll(async () => {
    await worker?.onModuleDestroy();
    await db?.destroy();
    fs.rmSync(root, { recursive: true, force: true });
    if (previous === undefined) delete process.env.FILE_UPLOAD_DIR;
    else process.env.FILE_UPLOAD_DIR = previous;
  });
  const save = async (doc: any, requestId = 'request1-' + id, expectedRevision = doc.revision) =>
    studio.save(
      id,
      {
        requestId,
        expectedRevision,
        expectedSourceRevision: studioDigest('test-source'),
        document: doc,
      },
      7,
    );
  const publish = async (requestId = 'publish-' + id, settings: any = {}) => {
    const doc = (await studio.get(id, 7)).document;
    return publications.publish(
      id,
      {
        requestId,
        expectedRevision: doc.revision,
        visibility: 'link',
        allowRemix: false,
        ...settings,
      },
      7,
    );
  };
  it.each([false, true])(
    'guards an execution against intervening publication changes (existing=%s)',
    async existing => {
      const first = existing ? await publish('race-first-' + id) : null;
      const basis = first ? { token: first.token, version: first.version } : null;
      const latest = await publish('race-private-' + id, { visibility: 'private' });
      const doc = (await studio.get(id, 7)).document;
      await expect(
        (publications.publish as any)(
          id,
          {
            requestId: 'race-stale-' + id,
            expectedRevision: doc.revision,
            visibility: 'link',
            allowRemix: false,
          },
          7,
          undefined,
          basis,
        ),
      ).rejects.toMatchObject({ status: 409 });
      expect(await publications.ownerMetadata(id, 7)).toEqual(latest);
      expect(await publications.committed('race-stale-' + id, 7)).toBeUndefined();
    },
  );

  it('replays a guarded committed receipt without overwriting a later private publication', async () => {
    const doc = (await studio.get(id, 7)).document;
    const request = {
      requestId: 'guarded-replay-' + id,
      expectedRevision: doc.revision,
      visibility: 'link',
      allowRemix: false,
    };
    const first = await publications.publish(id, request, 7, undefined, null);
    const latest = await publish('guarded-newer-' + id, { visibility: 'private' });
    expect(await publications.publish(id, request, 7, undefined, null)).toEqual(first);
    expect(await publications.ownerMetadata(id, 7)).toEqual(latest);
  });

  it('publishes recomputed numbers/trends/layouts, with an explicit public whitelist and no source IDs/SQL', async () => {
    const result = await publish();
    expect(result.version).toBe(1);
    const shared = await publications.read(result.token);
    expect(shared.snapshot.blocks[0].datas).toEqual([{ value: 500 }]);
    expect(shared.snapshot.blocks[1].datas).toEqual(
      expect.arrayContaining([
        { category: 'Site', value: 300 },
        { category: 'Mobile', value: 200 },
      ]),
    );
    expect(shared.snapshot.blocks[0].trend.points).toHaveLength(2);
    expect(shared.snapshot.layouts.lg.map(g => g.id)).toEqual(['block-1', 'block-2']);
    expect(Object.keys(shared).sort()).toEqual([
      'allowRemix',
      'asOf',
      'dataVersion',
      'expiresAt',
      'snapshot',
      'token',
      'version',
      'visibility',
    ]);
    const encoded = JSON.stringify(shared);
    for (const key of [
      'sql',
      'sourceId',
      'databaseId',
      'dashboardId',
      'definitionKey',
      'measureRefs',
      'dimensionRefs',
      'connectionConfig',
      'contribution',
      'dimensionColumn',
      'column_name',
    ])
      expect(encoded).not.toContain('"' + key + '"');
    expect(await publications.ownerMetadata(id, 7)).toEqual(result);
    await expect(publications.ownerMetadata(id, 8)).rejects.toMatchObject({ status: 403 });
    await expect(publications.revoke(result.token, 8)).rejects.toMatchObject({ status: 403 });
  });
  it('keeps old snapshot after draft edit and changes same token only on explicit republish', async () => {
    const first = await publish();
    const doc = (await studio.get(id, 7)).document;
    doc.title = 'Changed draft';
    doc.blocks[0].title = 'Changed KPI';
    await save(doc);
    expect((await publications.read(first.token)).snapshot.title).toBe('Studio actual');
    const second = await publish('second-' + id);
    expect(second.token).toBe(first.token);
    expect(second.version).toBe(2);
    expect((await publications.read(first.token)).snapshot.title).toBe('Changed draft');
    const before = await db.manager.count(StudioPublicationRequest);
    expect((await publish('second-' + id)).version).toBe(2);
    expect(await db.manager.count(StudioPublicationRequest)).toBe(before);
    await expect(publish('second-' + id, { visibility: 'private' })).rejects.toMatchObject({
      status: 409,
    });
  });
  it('deduplicates concurrent response-loss retries across service restart and never reactivates a revoked token', async () => {
    const results = await Promise.all([publish('concurrent-' + id), publish('concurrent-' + id)]);
    expect(results[0]).toEqual(results[1]);
    expect(await db.manager.count(StudioPublication, { where: { dashboardId: id } })).toBe(1);
    const restarted = new StudioPublicationService(db, studio);
    const row = await publications.revoke(results[0].token, 7);
    expect(row.revokedAt).toBeTruthy();
    const doc = (await studio.get(id, 7)).document;
    expect(
      (
        await restarted.publish(
          id,
          {
            requestId: 'concurrent-' + id,
            expectedRevision: doc.revision,
            visibility: 'link',
            allowRemix: false,
          },
          7,
        )
      ).revokedAt,
    ).toBeTruthy();
    await expect(restarted.read(row.token)).rejects.toMatchObject({ status: 410 });
    const next = await publish('after-revoke-' + id);
    expect(next.token).not.toBe(row.token);
    expect(next.version).toBe(1);
    await expect(restarted.read(row.token)).rejects.toMatchObject({ status: 410 });
  });
  it('requires owner authentication for private snapshots and returns no data on expiry, revoke or unknown token', async () => {
    const first = await publish(undefined, {
      visibility: 'private',
      expiresAt: new Date(Date.now() + 60000).toISOString(),
    });
    expect((await publications.read(first.token, 7)).snapshot.title).toBe('Studio actual');
    for (const actor of [undefined, 8])
      await expect(publications.read(first.token, actor)).rejects.toMatchObject({ status: 403 });
    await db.manager.update(
      StudioPublication,
      { token: first.token },
      { expiresAt: '2020-01-01T00:00:00.000Z' },
    );
    try {
      await publications.read(first.token, 7);
      throw new Error('expected expiry');
    } catch (e) {
      expect(e.getStatus()).toBe(410);
      expect(JSON.stringify(e.getResponse())).not.toContain('snapshot');
    }
    await expect(publications.read('a'.repeat(64))).rejects.toMatchObject({ status: 404 });
  });
  it('rejects stale revisions, invalid expiry/visibility/extra properties and cancellation without writing', async () => {
    const document = (await studio.get(id, 7)).document;
    const body = {
      requestId: 'invalid-' + id,
      expectedRevision: document.revision,
      visibility: 'link',
      allowRemix: false,
    };
    for (const patch of [
      { expectedRevision: 'f'.repeat(64) },
      { visibility: 'public' },
      { expiresAt: 'bad' },
      { expiresAt: '2020-01-01T00:00:00Z' },
      { sql: 'SECRET' },
      { allowRemix: 'yes' },
    ])
      await expect(publications.publish(id, { ...body, ...patch }, 7)).rejects.toBeDefined();
    const controller = new AbortController();
    controller.abort();
    await expect(publications.publish(id, body, 7, controller.signal)).rejects.toMatchObject({
      status: 400,
    });
    expect(await db.manager.count(StudioPublication, { where: { dashboardId: id } })).toBe(0);
  });
  it('fails over 2MiB without truncating or changing the active version', async () => {
    const first = await publish();
    const realPreview = ai.preview.bind(ai);
    const preview = jest.spyOn(ai, 'preview').mockImplementation(async (...args: any[]) => {
      const result = await (realPreview as any)(...args);
      result.data.widgets[1].datas = [{ category: 'x'.repeat(2 * 1024 * 1024), value: 500 }];
      return result;
    });
    await expect(
      publications.publish(
        id,
        {
          requestId: 'large-' + id,
          expectedRevision: (await studio.get(id, 7)).document.revision,
          visibility: 'link',
          allowRemix: false,
        },
        7,
      ),
    ).rejects.toMatchObject({ status: 413 });
    preview.mockRestore();
    expect((await publications.read(first.token)).version).toBe(1);
    expect(
      (await publications.read(first.token)).snapshot.blocks[1].datas[0].category,
    ).not.toHaveLength(2 * 1024 * 1024);
    expect(
      await db.manager.count(StudioPublicationRequest, {
        where: { actorId: 7, requestId: 'large-' + id },
      }),
    ).toBe(0);
  });
  it('rejects nonaggregate projections and rechecks owner/source access on publish and public reads', async () => {
    const first = await publish();
    await db.manager.update(Database, { id: 1 }, { ownerId: 8 });
    await expect(publish('lost-owner-' + id)).rejects.toMatchObject({ status: 403 });
    await expect(publications.read(first.token)).rejects.toMatchObject({ status: 403 });
    await db.manager.update(Database, { id: 1 }, { ownerId: 7 });
    const bad = draft();
    bad.widgets[1].sql = 'SELECT category,amount AS value FROM source';
    const rawId = (await ai.save({ draft: bad }, 7)).data.id;
    const doc = (await studio.get(rawId, 7)).document;
    await expect(
      publications.publish(
        rawId,
        { requestId: 'raw', expectedRevision: doc.revision, visibility: 'link', allowRemix: false },
        7,
      ),
    ).rejects.toMatchObject({ status: 400 });
  });
  it('rolls back snapshot/version when journal insert fails, keeping the previous active snapshot', async () => {
    const first = await publish();
    const realTransaction = db.transaction.bind(db);
    const transaction = jest.spyOn(db, 'transaction').mockImplementationOnce((async (run: any) =>
      realTransaction(async manager => {
        jest.spyOn(manager, 'insert').mockRejectedValueOnce(new Error('injected journal failure'));
        return run(manager);
      })) as any);
    await expect(publish('rollback-' + id)).rejects.toThrow('injected journal failure');
    transaction.mockRestore();
    expect((await publications.read(first.token)).version).toBe(1);
    expect(
      await db.manager.count(StudioPublicationRequest, {
        where: { actorId: 7, requestId: 'rollback-' + id },
      }),
    ).toBe(0);
  });
  it('rejects legacy draft/source replacement during aggregation before committing any publication', async () => {
    const realPreview = ai.preview.bind(ai);
    const doc = (await studio.get(id, 7)).document;
    for (const target of ['dashboard', 'source']) {
      const revision =
        target === 'dashboard' ? doc.revision : (await studio.get(id, 7)).document.revision;
      const preview = jest.spyOn(ai, 'preview').mockImplementationOnce(async (...args: any[]) => {
        const result = await (realPreview as any)(...args);
        if (target === 'dashboard')
          await db.manager.update(Dashboard, { id }, { title: 'Concurrent change' });
        else
          await db.manager.update(Database, { id: 1 }, { connectionConfig: '{"replaced":true}' });
        return result;
      });
      await expect(
        publications.publish(
          id,
          {
            requestId: target + '-race-' + id,
            expectedRevision: revision,
            visibility: 'link',
            allowRemix: false,
          },
          7,
        ),
      ).rejects.toMatchObject({ status: 409 });
      preview.mockRestore();
    }
    await db.manager.update(Database, { id: 1 }, { connectionConfig: '{}' });
    expect(await db.manager.count(StudioPublication, { where: { dashboardId: id } })).toBe(0);
  });
  it('publishes the Rill-style weighted CAST/NULLIF formula and exact timestamp GROUP BY while rejecting raw time rows', async () => {
    const example = draft();
    example.widgets.push(
      {
        ...example.widgets[0],
        title: 'Weighted',
        sql: 'SELECT SUM(CAST(amount AS DOUBLE))/NULLIF(SUM(CAST(amount AS DOUBLE)),0)*1 AS value FROM source',
      },
      {
        ...example.widgets[1],
        type: 'CHART_LINE',
        title: 'Timeline',
        categoryField: 'dimension',
        sql: 'SELECT event_time AS dimension,SUM(amount) AS value FROM source GROUP BY event_time ORDER BY dimension LIMIT 500',
      },
    );
    const exampleId = (await ai.save({ draft: example }, 7)).data.id;
    const doc = (await studio.get(exampleId, 7)).document;
    const published = await publications.publish(
      exampleId,
      {
        requestId: 'rill-exact-' + id,
        expectedRevision: doc.revision,
        visibility: 'link',
        allowRemix: false,
      },
      7,
    );
    const shared = await publications.read(published.token);
    expect(shared.snapshot.blocks[2].datas).toEqual([{ value: 1 }]);
    expect(shared.snapshot.blocks[3].datas.map(row => row.value)).toEqual([300, 200]);
    const bad = {
      ...example,
      widgets: [
        {
          ...example.widgets[3],
          sql: 'SELECT event_time AS dimension,amount AS value FROM source ORDER BY dimension LIMIT 500',
        },
      ],
    };
    const rawId = (await ai.save({ draft: bad }, 7)).data.id;
    const raw = (await studio.get(rawId, 7)).document;
    await expect(
      publications.publish(
        rawId,
        {
          requestId: 'rill-raw-' + id,
          expectedRevision: raw.revision,
          visibility: 'link',
          allowRemix: false,
        },
        7,
      ),
    ).rejects.toMatchObject({ status: 400 });
  });
  it('publishes the typed categorical scope with its filtered rows and keeps no-filter snapshots compatible', async () => {
    const legacy = await publish('legacy-scope-' + id);
    const unscoped = (await publications.read(legacy.token)).snapshot;
    expect(unscoped.filters).toEqual([]);
    expect(unscoped.blocks[0].datas).toEqual([{ value: 500 }]);

    const document = applyStudioOperation((await studio.get(id, 7)).document, {
      type: 'setFilters',
      filters: [{ column: 'category', values: ['Site'] }],
    });
    await save(document, 'scope-save-' + id);
    const scoped = await publish('scope-publish-' + id);
    const snapshot = (await publications.read(scoped.token)).snapshot;
    // Displayed scope metadata is the exact validated primitive filter list.
    expect(snapshot.filters).toEqual([{ column: 'category', values: ['Site'] }]);
    expect(snapshot.blocks[0].datas).toEqual([{ value: 300 }]);
    expect(snapshot.blocks[1].datas).toEqual([{ category: 'Site', value: 300 }]);
    for (const key of ['sql', 'sourceId', 'databaseId', 'dashboardId', 'connectionConfig'])
      expect(JSON.stringify(snapshot)).not.toContain('"' + key + '"');
  });

  it('publishes the exact date scope and keeps an absent scope all-time', async () => {
    const state = await studio.get(id, 7);
    const document = {
      ...state.document,
      dateRange: {
        column: 'event_time',
        start: '2026-01-01',
        end: '2026-01-01',
        timeZone: 'Asia/Seoul',
      },
    };
    const sanitize = (value: any) => (publications as any).sanitize(value, state.preview);
    const scoped = sanitize(document);
    expect(scoped.dateRange).toEqual(document.dateRange);
    expect(scoped.periodLabel).toBe('2026-01-01 ~ 2026-01-01 (Asia/Seoul)');
    const stamped = sanitize({
      ...document,
      dateRange: {
        column: 'event_time',
        start: '2026-01-01T00:00:00Z',
        end: '2026-01-02T00:00:00Z',
        precision: 'timestamp',
      },
    });
    expect(stamped.dateRange).toEqual({
      column: 'event_time',
      start: '2026-01-01T00:00:00Z',
      end: '2026-01-02T00:00:00Z',
      precision: 'timestamp',
    });
    expect(stamped.periodLabel).toBe(
      '2026-01-01T00:00:00Z ~ 2026-01-02T00:00:00Z (UTC, 종료 미포함)',
    );
    expect(() =>
      sanitize({ ...document, dateRange: { ...document.dateRange, start: '2026-01-02' } }),
    ).toThrow();
    const plain = sanitize(state.document);
    expect(plain.periodLabel).toBe('전체 기간');
    expect(Object.prototype.hasOwnProperty.call(plain, 'dateRange')).toBe(false);
  });
});
