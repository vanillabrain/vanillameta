jest.mock('../ai/ai.service', () => ({ AiService: class {} }));

import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { DuckDBInstance } from '@duckdb/node-api';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DataSource } from 'typeorm';
import { DuckDBService } from '../analysis/duckdb.service';
import { ConnectionService } from '../connection/connection.service';
import { Database } from '../database/entities/database.entity';
import { Metric } from '../metric/entities/metric.entity';
import { SourceAccessService } from '../ownership/source-access.service';
import { BiService } from './bi.service';
import { ExploreView } from './entities/explore-view.entity';
import { ExploreViewService } from './explore-view.service';

describe('ExploreViewService saved exploration views', () => {
  const actor = 10;
  const state = (over: any = {}) => ({
    version: 1,
    timeZone: 'UTC',
    measureIds: [1],
    dimensionColumns: ['region'],
    rankingMeasureId: 1,
    rankingSort: { by: 'value', direction: 'desc' },
    filters: [{ column: 'channel', values: ['web'] }],
    dateRange: { column: 'day', start: '2026-01-01', end: '2026-01-03', timeZone: 'UTC' },
    trendGrain: 'day',
    comparePrevious: false,
    includeRows: true,
    ...over,
  });
  const mainSql =
    'CREATE TABLE uploaded_data AS SELECT ' +
    'CAST("column0" AS VARCHAR) AS region, CAST("column1" AS VARCHAR) AS channel, ' +
    'CAST("column2" AS DOUBLE) AS amount, CAST("column3" AS DOUBLE) AS weight, ' +
    'CAST("column4" AS DATE) AS day, CAST("column5" AS TIMESTAMP) AS event_time ' +
    "FROM (VALUES ('A', 'web', 12, 2, '2026-01-01', '2026-01-01 00:30:00'), " +
    "('B', 'app', 40, 5, '2026-01-02', '2026-01-02 01:30:00'), " +
    "('C', 'app', 60, 1, '2026-01-03', '2026-01-03 01:30:00')) " +
    't(column0, column1, column2, column3, column4, column5)';

  const previousRoot = process.env.FILE_UPLOAD_DIR;
  let root: string;
  let worker: DuckDBService;
  let mainFile: string;
  let altFile: string;
  let db: DataSource;
  let connection: ConnectionService;
  let access: SourceAccessService;
  let bi: BiService;
  let service: ExploreViewService;

  const writeSource = async (sql: string) => {
    const directory = path.join(root, randomUUID());
    fs.mkdirSync(directory, { recursive: true });
    const filename = path.join(directory, 'data.duckdb');
    const instance = await DuckDBInstance.create(filename, { access_mode: 'READ_WRITE' });
    const connection = await instance.connect();
    await connection.run(sql);
    await connection.run('CHECKPOINT');
    connection.closeSync();
    instance.closeSync();
    return filename;
  };

  const source = (id: number, ownerId: number, filename: string) =>
    ({
      id,
      ownerId,
      name: 'Source ' + id,
      description: null,
      connectionConfig: JSON.stringify({ client: 'duckdb', connection: { filename } }),
      engine: 'duckdb',
      type: 'file',
      timezone: 'UTC',
    } as Database);

  const metric = (id: number, label: string, databaseId = 1, definitionVersion = 1) =>
    ({
      id,
      name: 'bi_metric_' + id,
      databaseId,
      tableName: 'uploaded_data',
      aggregation: 'SUM',
      expression: 'amount',
      description: label,
      useYn: 'Y',
      definition: JSON.stringify({
        schemaVersion: 1,
        definitionVersion,
        sourceId: databaseId,
        tableName: 'uploaded_data',
        label,
        unit: '',
        decimalPlaces: 0,
        numberNotation: 'plain',
        aggregation: 'SUM',
        column: 'amount',
      }),
    } as Metric);

  const revision = (id = 1) => connection.duckDBVersion(id);
  const views = () => db.getRepository(ExploreView);

  beforeAll(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'vm-explore-views-'));
    process.env.FILE_UPLOAD_DIR = root;
    worker = new DuckDBService();
    mainFile = await writeSource(mainSql);
    altFile = await writeSource(mainSql);
  });

  afterAll(async () => {
    await worker?.onModuleDestroy();
    if (root) fs.rmSync(root, { recursive: true, force: true });
    if (previousRoot === undefined) delete process.env.FILE_UPLOAD_DIR;
    else process.env.FILE_UPLOAD_DIR = previousRoot;
  });

  beforeEach(async () => {
    db = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      entities: [ExploreView, Database, Metric],
      synchronize: true,
    }).initialize();
    await db.getRepository(Database).save([source(1, actor, mainFile), source(2, 20, mainFile)]);
    await db.getRepository(Metric).save([metric(1, 'Revenue'), metric(2, 'Orders')]);
    connection = new ConnectionService(db.getRepository(Database), {} as any, worker);
    access = new SourceAccessService(db);
    bi = new BiService(db, access, connection, { save: jest.fn() } as any);
    service = new ExploreViewService(db, access, bi, connection);
  });

  afterEach(async () => {
    await db.destroy();
  });

  it('creates a full view and lists, loads and re-loads it through a fresh service instance', async () => {
    const sourceRevision = await revision();
    const created = await service.create(
      {
        sourceId: 1,
        name: '  내 보기  ',
        sourceRevision,
        state: state(),
        measureVersions: { 1: 1 },
      },
      actor,
    );
    expect(created.status).toBe('SUCCESS');
    expect(created.data).toMatchObject({
      id: expect.any(Number),
      name: '내 보기',
      sourceId: 1,
      sourceRevision,
    });
    expect(created.data.state).toEqual(state());
    expect(created.data.createdAt).toBeDefined();
    expect(created.data.measureVersions).toBeUndefined();

    const listed = await service.list({ sourceId: 1 }, actor);
    expect(listed.data).toHaveLength(1);
    expect(listed.data[0]).toMatchObject({ id: created.data.id, stale: false });
    expect(listed.data[0].state).toEqual(state());

    const reloaded = new ExploreViewService(db, access, bi, connection);
    const loaded = await reloaded.load({ sourceId: 1, viewId: created.data.id }, actor);
    expect(loaded.data).toEqual({ ...created.data });
  });

  it('persists rows in real SQLite independent of the service instance cache', async () => {
    const created = await service.create(
      {
        sourceId: 1,
        name: 'persisted',
        sourceRevision: await revision(),
        state: state(),
        measureVersions: { 1: 1 },
      },
      actor,
    );
    const rows = await views().find();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: created.data.id, sourceId: 1, userId: actor });
    expect(JSON.parse(rows[0].measureVersions)).toEqual({ 1: 1 });
  });

  it('keeps views private to the owning actor of the source', async () => {
    const created = await service.create(
      {
        sourceId: 1,
        name: 'mine',
        sourceRevision: await revision(),
        state: state(),
        measureVersions: { 1: 1 },
      },
      actor,
    );
    await expect(service.list({ sourceId: 1 }, 20)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.load({ sourceId: 1, viewId: created.data.id }, 20)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(
      service.remove({ sourceId: 1, viewId: created.data.id }, 20),
    ).rejects.toBeInstanceOf(ForbiddenException);
    // A foreign row for the same source never leaks into the owner's list or load.
    const foreign = await views().save(
      views().create({
        sourceId: 1,
        userId: 99,
        name: 'foreign',
        sourceRevision: await revision(),
        measureVersions: '{"1":1}',
        state: JSON.stringify(state()),
      }),
    );
    const listed = await service.list({ sourceId: 1 }, actor);
    expect(listed.data.map((row: any) => row.id)).toEqual([created.data.id]);
    await expect(service.load({ sourceId: 1, viewId: foreign.id }, actor)).rejects.toBeInstanceOf(
      Error,
    );
    await expect(service.remove({ sourceId: 1, viewId: foreign.id }, actor)).rejects.toThrow(
      '저장 보기를 찾을 수 없습니다.',
    );
  });

  it('rejects malformed or unknown state and unknown request fields', async () => {
    const base = {
      sourceId: 1,
      name: 'view',
      sourceRevision: await revision(),
      measureVersions: { 1: 1 },
    };
    const cases: any[] = [
      { ...base, state: { ...state(), extra: 1 } },
      { ...base, state: { ...state(), timeZone: undefined } },
      { ...base, state: { ...state(), trendGrain: 'auto' } },
      {
        ...base,
        state: {
          ...state(),
          dateRange: {
            column: 'day',
            start: '2026-01-01',
            end: '2026-01-03',
            precision: 'timestamp',
          },
        },
      },
      { ...base, state: { ...state(), rankingSort: { by: 'delta', direction: 'desc' } } },
      { ...base, state: { ...state(), dateRange: undefined, comparePrevious: true } },
      { ...base, state: state({ filters: [{ column: 'region', range: { min: 1 } }] }) },
      { ...base, state: state({ dimensionColumns: ['missing'] }) },
      {
        ...base,
        state: state({ measureIds: [99], rankingMeasureId: 99 }),
        measureVersions: { 99: 1 },
      },
      {
        ...base,
        state: state({
          dateRange: { column: 'region', start: '2026-01-01', end: '2026-01-03', timeZone: 'UTC' },
        }),
      },
      { ...base, state: state({ timeZone: 'Asia/Seoul' }) },
      { ...base, state: state(), unexpected: true },
      { ...base, name: '', state: state() },
      { ...base, measureVersions: undefined, state: state() },
      { ...base, measureVersions: { 1: 1, 2: 1 }, state: state() },
      { ...base, measureVersions: { 1: 0 }, state: state() },
    ];
    for (const body of cases)
      await expect(service.create(body, actor)).rejects.toBeInstanceOf(BadRequestException);
    expect(await views().count()).toBe(0);
  });

  it('normalizes the state timezone onto a period that omitted it', async () => {
    const created = await service.create(
      {
        sourceId: 1,
        name: 'seoul',
        sourceRevision: await revision(),
        measureVersions: { 1: 1 },
        state: state({
          timeZone: 'Asia/Seoul',
          dateRange: { column: 'day', start: '2026-01-01', end: '2026-01-03' },
        }),
      },
      actor,
    );
    expect(created.data.state.timeZone).toBe('Asia/Seoul');
    expect(created.data.state.dateRange).toEqual({
      column: 'day',
      start: '2026-01-01',
      end: '2026-01-03',
      timeZone: 'Asia/Seoul',
    });
    const loaded = await service.load({ sourceId: 1, viewId: created.data.id }, actor);
    expect(loaded.data.state.dateRange.timeZone).toBe('Asia/Seoul');
  });

  it('rejects a stale source revision on create and on load after the file changed', async () => {
    await expect(
      service.create(
        {
          sourceId: 1,
          name: 'stale',
          sourceRevision: 'a'.repeat(64),
          state: state(),
          measureVersions: { 1: 1 },
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    const created = await service.create(
      {
        sourceId: 1,
        name: 'fresh',
        sourceRevision: await revision(),
        state: state(),
        measureVersions: { 1: 1 },
      },
      actor,
    );
    await db.getRepository(Database).update(
      { id: 1 },
      {
        connectionConfig: JSON.stringify({ client: 'duckdb', connection: { filename: altFile } }),
      },
    );
    await expect(
      service.load({ sourceId: 1, viewId: created.data.id }, actor),
    ).rejects.toBeInstanceOf(ConflictException);
    const listed = await service.list({ sourceId: 1 }, actor);
    expect(listed.data[0].stale).toBe(true);
  });

  it('rejects a stale metric definition on create and load but allows a re-sync save', async () => {
    const sourceRevision = await revision();
    const created = await service.create(
      {
        sourceId: 1,
        name: 'metric',
        sourceRevision,
        state: state(),
        measureVersions: { 1: 1 },
      },
      actor,
    );
    const row = await db.getRepository(Metric).findOne({ where: { id: 1 } });
    const definition = JSON.parse(row.definition);
    definition.definitionVersion = 2;
    await db.getRepository(Metric).update({ id: 1 }, { definition: JSON.stringify(definition) });
    await expect(
      service.create(
        {
          sourceId: 1,
          name: 'stale-metric',
          sourceRevision,
          state: state(),
          measureVersions: { 1: 1 },
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      service.load({ sourceId: 1, viewId: created.data.id }, actor),
    ).rejects.toBeInstanceOf(ConflictException);
    expect((await service.list({ sourceId: 1 }, actor)).data[0].stale).toBe(true);
    const fresh = await service.create(
      {
        sourceId: 1,
        name: 'metric2',
        sourceRevision,
        state: state(),
        measureVersions: { 1: 2 },
      },
      actor,
    );
    await expect(
      service.load({ sourceId: 1, viewId: fresh.data.id }, actor),
    ).resolves.toMatchObject({ status: 'SUCCESS' });
  });

  it('caps a source at 20 views and admits concurrent creates safely', async () => {
    const sourceRevision = await revision();
    for (let index = 0; index < 18; index += 1)
      await views().save(
        views().create({
          sourceId: 1,
          userId: actor,
          name: 'seed-' + index,
          sourceRevision,
          measureVersions: '{"1":1}',
          state: JSON.stringify(state()),
        }),
      );
    const attempts = Array.from({ length: 6 }, (_unused, index) =>
      service
        .create(
          {
            sourceId: 1,
            name: 'race-' + index,
            sourceRevision,
            state: state(),
            measureVersions: { 1: 1 },
          },
          actor,
        )
        .then(() => 'ok')
        .catch(() => 'rejected'),
    );
    const results = await Promise.all(attempts);
    expect(results.filter(result => result === 'ok')).toHaveLength(2);
    expect(await views().count({ where: { sourceId: 1, userId: actor } })).toBe(20);
    await expect(
      service.create(
        {
          sourceId: 1,
          name: 'over',
          sourceRevision,
          state: state(),
          measureVersions: { 1: 1 },
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('removes only the acting actor view', async () => {
    const created = await service.create(
      {
        sourceId: 1,
        name: 'bye',
        sourceRevision: await revision(),
        state: state(),
        measureVersions: { 1: 1 },
      },
      actor,
    );
    const removed = await service.remove({ sourceId: 1, viewId: created.data.id }, actor);
    expect(removed).toEqual({ status: 'SUCCESS', data: { id: created.data.id } });
    await expect(service.load({ sourceId: 1, viewId: created.data.id }, actor)).rejects.toThrow(
      '저장 보기를 찾을 수 없습니다.',
    );
    await expect(service.remove({ sourceId: 1, viewId: created.data.id }, actor)).rejects.toThrow(
      '저장 보기를 찾을 수 없습니다.',
    );
  });

  it('keeps the list available for a corrupt row and still allows deleting it', async () => {
    const sourceRevision = await revision();
    const good = await service.create(
      {
        sourceId: 1,
        name: 'good',
        sourceRevision,
        state: state(),
        measureVersions: { 1: 1 },
      },
      actor,
    );
    const corrupt = await views().save(
      views().create({
        sourceId: 1,
        userId: actor,
        name: 'corrupt',
        sourceRevision,
        measureVersions: '{"1":1}',
        state: JSON.stringify({ version: 2, timeZone: 'UTC' }),
      }),
    );
    const listed = await service.list({ sourceId: 1 }, actor);
    expect(listed.data.map((row: any) => row.id).sort()).toEqual([good.data.id, corrupt.id].sort());
    const badEntry = listed.data.find((row: any) => row.id === corrupt.id);
    expect(badEntry).toMatchObject({
      id: corrupt.id,
      name: 'corrupt',
      sourceId: 1,
      stale: true,
      unreadable: true,
    });
    expect(badEntry.state).toBeUndefined();
    const goodEntry = listed.data.find((row: any) => row.id === good.data.id);
    expect(goodEntry).toMatchObject({ stale: false });
    expect(goodEntry.state).toEqual(state());
    await expect(service.load({ sourceId: 1, viewId: corrupt.id }, actor)).rejects.toBeInstanceOf(
      ConflictException,
    );
    await expect(service.remove({ sourceId: 1, viewId: corrupt.id }, actor)).resolves.toEqual({
      status: 'SUCCESS',
      data: { id: corrupt.id },
    });
  });

  it('rejects create when the current metric definition version is missing', async () => {
    const row = await db.getRepository(Metric).findOne({ where: { id: 1 } });
    const definition = JSON.parse(row.definition);
    delete definition.definitionVersion;
    await db.getRepository(Metric).update({ id: 1 }, { definition: JSON.stringify(definition) });
    await expect(
      service.create(
        {
          sourceId: 1,
          name: 'no-version',
          sourceRevision: await revision(),
          state: state(),
          measureVersions: { 1: 1 },
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(await views().count()).toBe(0);
  });

  it('treats a malformed stored snapshot as stale on list and a conflict on load', async () => {
    const created = await service.create(
      {
        sourceId: 1,
        name: 'snapshot',
        sourceRevision: await revision(),
        state: state(),
        measureVersions: { 1: 1 },
      },
      actor,
    );
    const badSnapshots = ['{"2":1}', '{"1":0}', 'not-json', 'null'];
    for (const snapshot of badSnapshots) {
      await views().update({ id: created.data.id }, { measureVersions: snapshot });
      const listed = await service.list({ sourceId: 1 }, actor);
      expect(listed.data[0]).toMatchObject({ id: created.data.id, stale: true });
      expect(listed.data[0].state).toEqual(state());
      await expect(
        service.load({ sourceId: 1, viewId: created.data.id }, actor),
      ).rejects.toBeInstanceOf(ConflictException);
    }
  });

  it('rejects alias measure ids in the client and stored version maps', async () => {
    const sourceRevision = await revision();
    const selection = state({ measureIds: [1, 2], rankingMeasureId: 1 });
    // Client path: '01' aliases id 1, so id 2 would never be compared and must not be accepted.
    await expect(
      service.create(
        {
          sourceId: 1,
          name: 'alias',
          sourceRevision,
          state: selection,
          measureVersions: { 1: 1, '01': 1 },
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(await views().count()).toBe(0);

    const valid = await service.create(
      {
        sourceId: 1,
        name: 'two',
        sourceRevision,
        state: selection,
        measureVersions: { 1: 1, 2: 1 },
      },
      actor,
    );
    await expect(
      service.load({ sourceId: 1, viewId: valid.data.id }, actor),
    ).resolves.toMatchObject({ status: 'SUCCESS' });
    // Stored path: the same alias would leave measure 2 unchecked, so it reads stale and blocks load.
    await views().update({ id: valid.data.id }, { measureVersions: '{"1":1,"01":1}' });
    const listed = await service.list({ sourceId: 1 }, actor);
    expect(listed.data[0]).toMatchObject({ id: valid.data.id, stale: true });
    await expect(
      service.load({ sourceId: 1, viewId: valid.data.id }, actor),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
