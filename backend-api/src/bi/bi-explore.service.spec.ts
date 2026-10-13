jest.mock('../ai/ai.service', () => ({ AiService: class {} }));

import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { DuckDBInstance } from '@duckdb/node-api';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DuckDBService } from '../analysis/duckdb.service';
import { AiDashboardService } from '../ai/ai-dashboard.service';
import { ConnectionService } from '../connection/connection.service';
import { Database } from '../database/entities/database.entity';
import { Metric } from '../metric/entities/metric.entity';
import { SourceAccessService } from '../ownership/source-access.service';
import { BiExploreService } from './bi-explore.service';
import { BiService } from './bi.service';

describe('BiExploreService dynamic exploration over real DuckDB', () => {
  const actor = 10;
  const revision64 = /^[a-f0-9]{64}$/;
  const row = (values: Array<string | number | null>) =>
    '(' +
    values
      .map(value =>
        value === null ? 'NULL' : typeof value === 'number' ? String(value) : "'" + value + "'",
      )
      .join(', ') +
    ')';
  const mainRows: Array<Array<string | number | null>> = [
    ['A', 'web', 12, 2, '2026-01-01', '2026-01-01 00:30:00'],
    ['A', 'web', 18, 4, '2026-01-01', '2026-01-01 01:30:00'],
    [null, 'web', 36, 6, '2026-01-01', '2026-01-01 02:30:00'],
    ['A', 'app', 20, 0, '2026-01-02', '2026-01-02 00:30:00'],
    ['B', 'app', 40, 5, '2026-01-02', '2026-01-02 01:30:00'],
    ['B', 'app', 50, 3, '2026-01-03', '2026-01-03 00:30:00'],
    ['C', 'app', 60, 1, '2026-01-03', '2026-01-03 01:30:00'],
    ['A', 'app', 70, 2, '2026-01-04', '2026-01-04 00:30:00'],
    ['D', 'bulk', 5, 0, '2026-01-04', '2026-01-04 01:30:00'],
  ];
  const mainSql =
    'CREATE TABLE uploaded_data AS SELECT ' +
    'CAST("column0" AS VARCHAR) AS region, CAST("column1" AS VARCHAR) AS channel, ' +
    'CAST("column2" AS DOUBLE) AS amount, CAST("column3" AS DOUBLE) AS weight, ' +
    'CAST("column4" AS DATE) AS day, CAST("column5" AS TIMESTAMP) AS event_time ' +
    'FROM (VALUES ' +
    mainRows.map(row).join(', ') +
    ') t(column0, column1, column2, column3, column4, column5)';
  const bulkRows = Array.from(
    { length: 60 },
    (_unused, index) =>
      ['S' + String(index + 1).padStart(3, '0'), ['A', 'B', 'C'][index % 3], index + 1] as Array<
        string | number
      >,
  );
  const bulkSql =
    'CREATE TABLE uploaded_data AS SELECT CAST("column0" AS VARCHAR) AS sku, ' +
    'CAST("column1" AS VARCHAR) AS region, CAST("column2" AS DOUBLE) AS amount ' +
    'FROM (VALUES ' +
    bulkRows.map(row).join(', ') +
    ') t(column0, column1, column2)';

  const metric = (id: number, label: string, fields: any, databaseId = 1) => ({
    id,
    name: 'bi_metric_' + id,
    databaseId,
    tableName: 'uploaded_data',
    aggregation: fields.aggregation,
    expression: fields.column,
    description: label,
    definition: JSON.stringify({
      schemaVersion: 1,
      definitionVersion: 1,
      sourceId: databaseId,
      tableName: 'uploaded_data',
      label,
      unit: fields.unit || '',
      decimalPlaces: fields.decimalPlaces || 0,
      numberNotation: 'plain',
      aggregation: fields.aggregation,
      column: fields.column,
      ...(fields.denominatorColumn ? { denominatorColumn: fields.denominatorColumn } : {}),
      ...(fields.weightColumn ? { weightColumn: fields.weightColumn } : {}),
      ...(fields.scale !== undefined ? { scale: fields.scale } : {}),
    }),
    useYn: 'Y',
  });

  const previousRoot = process.env.FILE_UPLOAD_DIR;
  let root: string;
  let worker: DuckDBService;
  let mainFile: string;
  let bulkFile: string;
  const state = { filename: '' };
  let service: BiExploreService;
  let metrics: any[];
  let sources: any[];
  let databaseRepo: any;

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

  const revision = async (sourceId = 1, who = actor) =>
    (await service.catalog({ sourceId }, who)).sourceRevision;

  beforeAll(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'vm-bi-explore-'));
    process.env.FILE_UPLOAD_DIR = root;
    worker = new DuckDBService();
    mainFile = await writeSource(mainSql);
    bulkFile = await writeSource(bulkSql);
  });

  afterAll(async () => {
    await worker?.onModuleDestroy();
    if (root) fs.rmSync(root, { recursive: true, force: true });
    if (previousRoot === undefined) delete process.env.FILE_UPLOAD_DIR;
    else process.env.FILE_UPLOAD_DIR = previousRoot;
  });

  beforeEach(() => {
    state.filename = mainFile;
    metrics = [
      metric(1, 'Revenue', { aggregation: 'SUM', column: 'amount', unit: 'USD', decimalPlaces: 2 }),
      metric(2, 'Orders', { aggregation: 'COUNT', column: '*' }),
      metric(3, 'Weighted', {
        aggregation: 'WEIGHTED_AVG',
        column: 'amount',
        weightColumn: 'weight',
        decimalPlaces: 2,
      }),
      metric(4, 'Per weight', {
        aggregation: 'RATIO_SUM',
        column: 'amount',
        denominatorColumn: 'weight',
        scale: 1,
        decimalPlaces: 4,
      }),
      metric(5, 'Other source', { aggregation: 'SUM', column: 'amount' }, 2),
    ];
    sources = [
      { id: 1, name: 'Explorer', engine: 'duckdb', ownerId: 10 },
      { id: 2, name: 'Other', engine: 'duckdb', ownerId: 10 },
      { id: 3, name: 'Legacy', engine: 'sqlite', ownerId: 10 },
    ];
    databaseRepo = {
      findOne: jest.fn(async ({ where }: any) => {
        const source = sources.find(candidate => candidate.id === where.id);
        if (!source) return null;
        return {
          ...source,
          createdAt: '2026-01-01',
          updatedAt: '2026-01-02',
          connectionConfig: JSON.stringify({
            client: source.engine,
            connection: { filename: source.id === 1 ? state.filename : mainFile },
          }),
        };
      }),
    };
    const metricRepo = {
      find: jest.fn(async ({ where }: any) =>
        metrics.filter(
          candidate => candidate.databaseId === where.databaseId && candidate.useYn === where.useYn,
        ),
      ),
      findOne: jest.fn(async ({ where }: any) =>
        metrics.find(candidate => candidate.id === where.id),
      ),
    };
    const db = {
      getRepository: jest.fn((entity: any) => {
        if (entity === Database) return databaseRepo;
        if (entity === Metric) return metricRepo;
        throw new Error('unexpected repository');
      }),
    };
    const connection = new ConnectionService(databaseRepo, {} as any, worker);
    const bi = new BiService(db as any, new SourceAccessService(db as any), connection, {
      save: jest.fn(),
    } as any);
    service = new BiExploreService(
      bi,
      new AiDashboardService({} as any, connection, {} as any),
      connection,
    );
  });

  it('returns a catalog with revision, row count, measures, dimensions and temporal bounds', async () => {
    const catalog = await service.catalog({ sourceId: 1 }, actor);
    expect(catalog).toMatchObject({ sourceId: 1, name: 'Explorer', rowCount: '9' });
    expect(catalog.sourceRevision).toMatch(revision64);
    expect(catalog.measures.map((measure: any) => measure.id)).toEqual([1, 2, 3, 4]);
    expect(catalog.measures[0].definition).toMatchObject({ label: 'Revenue', aggregation: 'SUM' });
    expect(catalog.dimensions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          column: 'amount',
          type: 'DOUBLE',
          numeric: true,
          temporal: false,
        }),
        expect.objectContaining({ column: 'region', numeric: false, temporal: false }),
        expect.objectContaining({ column: 'day', temporal: true }),
      ]),
    );
    expect(catalog.temporalColumns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ column: 'day', min: '2026-01-01', max: '2026-01-04' }),
      ]),
    );
  });

  it('rejects a source that is not a managed DuckDB file', async () => {
    await expect(service.catalog({ sourceId: 3 }, actor)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('reports KPIs, an ordered leaderboard and raw details for one scoped query', async () => {
    const result = await service.query(
      {
        sourceId: 1,
        sourceRevision: await revision(),
        measureIds: [1, 2, 3, 4],
        rankingMeasureId: 1,
        dimensionColumns: ['region'],
        filters: [{ column: 'channel', values: ['web'] }],
        trendGrain: 'auto',
        comparePrevious: false,
        page: 0,
        pageSize: 25,
        includeRows: true,
      },
      actor,
    );
    expect(result.kpis.map(kpi => kpi.id)).toEqual([1, 2, 3, 4]);
    expect(result.kpis[0]).toMatchObject({
      title: 'Revenue',
      value: 66,
      suffix: ' USD',
      decimalPlaces: 2,
    });
    expect(result.kpis[1]).toMatchObject({ title: 'Orders', value: 3 });
    expect(result.kpis[2].value).toBeCloseTo(26, 10);
    expect(result.kpis[3].value).toBeCloseTo(5.5, 10);
    expect(result.leaderboards).toHaveLength(1);
    expect(result.leaderboards[0]).toMatchObject({ column: 'region', truncated: false });
    expect(result.leaderboards[0].rows).toEqual([
      { category: null, value: 36 },
      { category: 'A', value: 30 },
    ]);
    expect(result.details).toMatchObject({ totalRows: '3', page: 0, pageSize: 25 });
    expect(result.details.rows).toHaveLength(3);
    expect(result.applied).toEqual({
      filters: [{ column: 'channel', values: ['web'] }],
      trendGrain: 'auto',
      comparePrevious: false,
    });
  });

  it('returns a null ratio for a zero-valued denominator and keeps null groups last', async () => {
    const sourceRevision = await revision();
    const zero = await service.query(
      {
        sourceId: 1,
        sourceRevision,
        measureIds: [4, 3],
        rankingMeasureId: 4,
        dimensionColumns: [],
        filters: [{ column: 'weight', values: [0] }],
        trendGrain: 'auto',
        comparePrevious: false,
        page: 0,
        pageSize: 25,
        includeRows: false,
      },
      actor,
    );
    expect(zero.kpis[0].value).toBeNull();
    expect(zero.kpis[1].value).toBeNull();
    expect(zero.details).toBeUndefined();
    const mixed = await service.query(
      {
        sourceId: 1,
        sourceRevision,
        measureIds: [3],
        rankingMeasureId: 3,
        dimensionColumns: ['region'],
        filters: [],
        trendGrain: 'auto',
        comparePrevious: false,
        page: 0,
        pageSize: 25,
        includeRows: false,
      },
      actor,
    );
    expect(mixed.kpis[0].value).toBeCloseTo(862 / 23, 10);
    // Region D has a zero denominator, so its null value is ordered after every numeric group.
    const values = mixed.leaderboards[0].rows.map((entry: any) => entry.value);
    expect(values.slice(0, 4)).toEqual([60, 43.75, 36, 29.5]);
    expect(values[4]).toBeNull();
  });

  it('compares the previous period and supports previous-only leaderboard groups', async () => {
    const result = await service.query(
      {
        sourceId: 1,
        sourceRevision: await revision(),
        measureIds: [1],
        rankingMeasureId: 1,
        dimensionColumns: ['region'],
        filters: [],
        dateRange: { column: 'day', start: '2026-01-03', end: '2026-01-03' },
        trendGrain: 'auto',
        comparePrevious: true,
        page: 0,
        pageSize: 25,
        includeRows: false,
      },
      actor,
    );
    expect(result.kpis[0].value).toBe(110);
    expect(result.kpis[0].comparison).toMatchObject({ previousValue: 60, delta: 50 });
    expect(result.kpis[0].comparison.percentChange).toBeCloseTo((50 / 60) * 100, 10);
    const points = (trend: any) => trend.points.reduce((sum: number, p: any) => sum + p.value, 0);
    expect(points(result.kpis[0].trend)).toBe(110);
    expect(points(result.kpis[0].previousTrend)).toBe(60);
    expect(result.applied).toMatchObject({
      trendGrain: 'auto',
      comparePrevious: true,
      dateRange: { column: 'day', start: '2026-01-03', end: '2026-01-03' },
    });
    expect(result.leaderboards[0].rows).toEqual([
      { category: 'C', value: 60, previousValue: null, delta: null, percentChange: null },
      { category: 'B', value: 50, previousValue: 40, delta: 10, percentChange: 25 },
      { category: 'A', value: null, previousValue: 20, delta: null, percentChange: null },
    ]);
  });

  it('preserves exact large integer aggregates as strings', async () => {
    state.filename = await writeSource(
      `CREATE TABLE uploaded_data AS SELECT 'X' AS region, 9007199254740993::BIGINT AS amount`,
    );
    metrics = [metric(1, 'Revenue', { aggregation: 'SUM', column: 'amount' })];
    const result = await service.query(
      {
        sourceId: 1,
        sourceRevision: await revision(),
        measureIds: [1],
        rankingMeasureId: 1,
        dimensionColumns: ['region'],
      },
      actor,
    );
    expect(result.kpis[0].value).toBe('9007199254740993');
    expect(result.leaderboards[0].rows[0].value).toBe('9007199254740993');
  });

  it('joins previous aggregates outside the previous top twenty before limiting', async () => {
    state.filename = await writeSource(`CREATE TABLE uploaded_data AS
      SELECT 'X' AS region, 1000::DOUBLE AS amount, DATE '2026-01-02' AS day
      UNION ALL SELECT 'X', 1, DATE '2026-01-01'
      UNION ALL SELECT 'P' || CAST(i AS VARCHAR), 100 + i, DATE '2026-01-01' FROM range(30) t(i)`);
    metrics = [metric(1, 'Revenue', { aggregation: 'SUM', column: 'amount' })];
    const result = await service.query(
      {
        sourceId: 1,
        sourceRevision: await revision(),
        measureIds: [1],
        rankingMeasureId: 1,
        dimensionColumns: ['region'],
        dateRange: { column: 'day', start: '2026-01-02', end: '2026-01-02' },
        comparePrevious: true,
      },
      actor,
    );
    expect(result.leaderboards[0].rows[0]).toMatchObject({
      category: 'X',
      value: 1000,
      previousValue: 1,
      delta: 999,
    });
    expect(result.leaderboards[0].truncated).toBe(true);
  });

  it('truncates the leaderboard at twenty rows and the value list at fifty', async () => {
    state.filename = bulkFile;
    const sourceRevision = await revision();
    const result = await service.query(
      {
        sourceId: 1,
        sourceRevision,
        measureIds: [1],
        rankingMeasureId: 1,
        dimensionColumns: ['sku'],
        filters: [],
        trendGrain: 'auto',
        comparePrevious: false,
        page: 0,
        pageSize: 25,
        includeRows: false,
      },
      actor,
    );
    expect(result.leaderboards[0].truncated).toBe(true);
    expect(result.leaderboards[0].rows).toHaveLength(20);
    expect(result.leaderboards[0].rows[0]).toEqual({ category: 'S060', value: 60 });
    expect(result.leaderboards[0].rows[19]).toEqual({ category: 'S041', value: 41 });
    const values = await service.values(
      { sourceId: 1, sourceRevision, column: 'amount', search: '', filters: [] },
      actor,
    );
    expect(values.truncated).toBe(true);
    expect(values.values).toHaveLength(50);
  });

  it('searches distinct values with escaped LIKE wildcards and a distinct null member', async () => {
    const sourceRevision = await revision();
    const all = await service.values(
      { sourceId: 1, sourceRevision, column: 'region', search: '', filters: [] },
      actor,
    );
    expect(all.values).toEqual(['A', 'B', 'C', 'D', null]);
    expect(all.truncated).toBe(false);
    expect(all.sourceRevision).toMatch(revision64);
    const matched = await service.values(
      { sourceId: 1, sourceRevision, column: 'region', search: 'b', filters: [] },
      actor,
    );
    expect(matched.values).toEqual(['B']);
    const percent = await service.values(
      { sourceId: 1, sourceRevision, column: 'region', search: '%', filters: [] },
      actor,
    );
    expect(percent.values).toEqual([]);
    const underscore = await service.values(
      { sourceId: 1, sourceRevision, column: 'region', search: '_', filters: [] },
      actor,
    );
    expect(underscore.values).toEqual([]);
    const scoped = await service.values(
      {
        sourceId: 1,
        sourceRevision,
        column: 'region',
        search: '',
        filters: [{ column: 'channel', values: ['app'] }],
      },
      actor,
    );
    expect(scoped.values).toEqual(['A', 'B', 'C']);
    await expect(
      service.values(
        { sourceId: 1, sourceRevision, column: 'region', search: 'x'.repeat(201), filters: [] },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.values(
        { sourceId: 1, sourceRevision, column: 'missing', search: '', filters: [] },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects unknown, duplicated and oversized inputs without touching the source', async () => {
    const sourceRevision = await revision();
    const body = (overrides: any = {}) => ({
      sourceId: 1,
      sourceRevision,
      measureIds: [1],
      rankingMeasureId: 1,
      dimensionColumns: [],
      filters: [],
      trendGrain: 'auto',
      comparePrevious: false,
      page: 0,
      pageSize: 25,
      includeRows: false,
      ...overrides,
    });
    const cases = [
      body({ measureIds: [1, 1] }),
      body({ measureIds: [1, 2, 3, 4, 1, 2, 3] }),
      body({ measureIds: [99] }),
      body({ measureIds: [5] }),
      body({ rankingMeasureId: 2 }),
      body({ dimensionColumns: ['region; DROP TABLE uploaded_data'] }),
      body({ dimensionColumns: ['region', 'region'] }),
      body({ dimensionColumns: ['region', 'channel', 'day', 'amount', 'weight'] }),
      body({ filters: [{ column: 'missing', values: ['x'] }] }),
      body({ filters: [{ column: 'region', value: 'A' }] }),
      body({ pageSize: 51 }),
      body({ page: 10001 }),
      body({ trendGrain: 'hour' }),
      body({ comparePrevious: true }),
      body({ sql: 'SELECT 1' }),
    ];
    for (const candidate of cases)
      await expect(service.query(candidate, actor)).rejects.toBeInstanceOf(BadRequestException);
    expect((await service.catalog({ sourceId: 1 }, actor)).rowCount).toBe('9');
  });

  it('rejects a stale source revision with a conflict', async () => {
    const stale = 'f'.repeat(64);
    await expect(
      service.query(
        {
          sourceId: 1,
          sourceRevision: stale,
          measureIds: [1],
          rankingMeasureId: 1,
          dimensionColumns: [],
          filters: [],
          trendGrain: 'auto',
          comparePrevious: false,
          page: 0,
          pageSize: 25,
          includeRows: false,
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    const current = await revision();
    state.filename = bulkFile;
    await expect(
      service.values({ sourceId: 1, sourceRevision: current, column: 'sku', filters: [] }, actor),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('enforces source ownership for every exploration entry point', async () => {
    const sourceRevision = await revision();
    await expect(service.catalog({ sourceId: 1 }, 20)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.query(
        {
          sourceId: 1,
          sourceRevision,
          measureIds: [1],
          rankingMeasureId: 1,
          dimensionColumns: [],
          filters: [],
          trendGrain: 'auto',
          comparePrevious: false,
          page: 0,
          pageSize: 25,
          includeRows: false,
        },
        20,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.values({ sourceId: 1, sourceRevision, column: 'region', filters: [] }, 20),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
