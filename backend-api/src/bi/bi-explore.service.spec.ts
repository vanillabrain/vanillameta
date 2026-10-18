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
import { BiExploreController } from './bi-explore.controller';
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
      options: { type: 'sqlite' },
      getRepository: jest.fn((entity: any) => {
        if (entity === Database) return databaseRepo;
        if (entity === Metric) return metricRepo;
        throw new Error('unexpected repository');
      }),
    };
    Object.assign(databaseRepo, { manager: { connection: db } });
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
      leaderboardSort: { by: 'value', direction: 'desc' },
      trendGrain: 'auto',
      comparePrevious: false,
      rankingSort: { by: 'value', direction: 'desc' },
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
  const scopedQuery = async (overrides: any = {}) =>
    service.query(
      {
        sourceId: 1,
        sourceRevision: await revision(),
        measureIds: [1],
        rankingMeasureId: 1,
        dimensionColumns: ['region'],
        ...overrides,
      },
      actor,
    );

  const basisRequest = async (mode: string, extra: any = {}) => {
    const body = { sourceId: 1, sourceRevision: await revision(), measureIds: [1], ...extra };
    return mode === 'query'
      ? service.query({ ...body, rankingMeasureId: 1 }, actor)
      : service.pivot(
          {
            ...body,
            ...(mode === 'classic'
              ? { rowDimensions: ['region'], columnDimensions: [] }
              : { rowColumns: ['region'], columnColumns: [] }),
          },
          actor,
        );
  };
  it.each(['query', 'classic', 'advanced'])(
    'returns actual %s metric versions and rejects stale expected versions',
    async mode => {
      expect(
        (await basisRequest(mode, { expectedMeasureVersions: { '1': 1 } })).measureVersions,
      ).toEqual({ '1': 1 });
      const definition = JSON.parse(metrics[0].definition);
      metrics[0].definition = JSON.stringify({ ...definition, definitionVersion: 2, scale: 2 });
      await expect(
        basisRequest(mode, { expectedMeasureVersions: { '1': 1 } }),
      ).rejects.toMatchObject({ status: 409 });
      expect((await basisRequest(mode)).measureVersions).toEqual({ '1': 2 });
    },
  );
  it.each(['query', 'classic', 'advanced'])(
    'rejects %s in-flight metric changes even without expected versions',
    async mode => {
      const connection = (service as any).connection as ConnectionService;
      const original = connection.queryDuckDB.bind(connection);
      const sourceRevision = await revision();
      let changed = false;
      const spy = jest.spyOn(connection, 'queryDuckDB').mockImplementation(async (...args) => {
        const result = await original(...args);
        if (!changed && args[1].includes('SELECT') && !args[1].includes('null_')) {
          changed = true;
          metrics[0].definition = JSON.stringify({
            ...JSON.parse(metrics[0].definition),
            definitionVersion: 2,
          });
        }
        return result;
      });
      try {
        await expect(basisRequest(mode, { sourceRevision })).rejects.toMatchObject({ status: 409 });
        expect(changed).toBe(true);
      } finally {
        spy.mockRestore();
      }
    },
  );
  it('rejects a same-timestamp source pointer switch inside an outer pin and preserves that caller pin', async () => {
    const dashboards = (service as any).dashboards as AiDashboardService;
    const original = dashboards.preview.bind(dashboards);
    const spy = jest.spyOn(dashboards, 'preview').mockImplementationOnce(async (...args) => {
      const result = await original(...args);
      state.filename = bulkFile;
      return result;
    });
    const connection = (service as any).connection as ConnectionService;
    try {
      await connection.withDuckDBSnapshot(1, async () => {
        const pinned = await connection.duckDBVersion(1);
        await expect(basisRequest('query')).rejects.toMatchObject({ status: 409 });
        expect(state.filename).toBe(bulkFile);
        expect(await connection.duckDBVersion(1)).toBe(pinned);
        const fresh = await connection.captureDuckDBSnapshot(1);
        expect(await fresh.run(() => connection.duckDBVersion(1))).not.toBe(pinned);
      });
    } finally {
      spy.mockRestore();
    }
  });

  it('rejects a catalog/prepare race before aggregate SQL can run', async () => {
    const bi = (service as any).bi as BiService;
    const dashboards = (service as any).dashboards as AiDashboardService;
    const original = bi.prepare.bind(bi);
    const spy = jest.spyOn(bi, 'prepare').mockImplementationOnce(async (...args) => {
      metrics[0].definition = JSON.stringify({
        ...JSON.parse(metrics[0].definition),
        definitionVersion: 2,
      });
      return original(...args);
    });
    const aggregate = jest.spyOn(dashboards, 'preview');
    try {
      await expect(basisRequest('query')).rejects.toMatchObject({ status: 409 });
      expect(aggregate).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
      aggregate.mockRestore();
    }
  });
  it('rechecks source rights after aggregate calculation for legacy requests', async () => {
    const dashboards = (service as any).dashboards as AiDashboardService;
    const original = dashboards.preview.bind(dashboards);
    const spy = jest.spyOn(dashboards, 'preview').mockImplementationOnce(async (...args) => {
      const result = await original(...args);
      sources[0].ownerId = 20;
      return result;
    });
    try {
      await expect(basisRequest('query')).rejects.toMatchObject({ status: 403 });
    } finally {
      spy.mockRestore();
    }
  });

  it('applies the same range to KPIs, both trends, comparison, leaderboard, details and value search', async () => {
    const filters = [{ column: 'amount', range: { min: 20, max: 50 } }];
    const dateRange = { column: 'day', start: '2026-01-03', end: '2026-01-03' };
    const result = await scopedQuery({
      filters,
      dateRange,
      comparePrevious: true,
      includeRows: true,
    });
    expect(result.kpis[0].value).toBe(50);
    expect(result.kpis[0].comparison).toMatchObject({ previousValue: 60, delta: -10 });
    expect(result.kpis[0].trend.points.map(p => p.value)).toEqual([50]);
    expect(result.kpis[0].previousTrend.points.map(p => p.value)).toEqual([60]);
    expect(result.leaderboards[0].rows).toEqual([
      { category: 'B', value: 50, previousValue: 40, delta: 10, percentChange: 25 },
      { category: 'A', value: null, previousValue: 20, delta: null, percentChange: null },
    ]);
    expect(result.details.totalRows).toBe('1');
    expect(result.details.rows.map(row => row.amount)).toEqual([50]);
    expect(result.applied.filters).toEqual(filters);
    const values = await service.values(
      {
        sourceId: 1,
        sourceRevision: await revision(),
        column: 'region',
        search: 'b',
        filters,
        dateRange,
      },
      actor,
    );
    expect(values.values).toEqual(['B']);
  });

  it.each([
    [{ min: 0 }, ['B', 'C']],
    [{ max: 0 }, ['A', 'B']],
  ])('excludes NULL and includes zero in one-sided range %j', async (range, categories) => {
    state.filename = await writeSource(`CREATE TABLE uploaded_data AS
      SELECT * FROM (VALUES ('A', -1.5), ('B', 0), ('C', 1.5), ('D', NULL)) t(region, amount)`);
    const result = await scopedQuery({ filters: [{ column: 'amount', range }], includeRows: true });
    expect(result.details.rows.map(row => row.region)).toEqual(categories);
    expect(result.details.totalRows).toBe('2');
    const values = await service.values(
      {
        sourceId: 1,
        sourceRevision: await revision(),
        column: 'region',
        filters: [{ column: 'amount', range }],
      },
      actor,
    );
    expect(values.values).toEqual(categories);
  });

  it('binds safe-integer endpoints exactly and excludes the adjacent unsafe source values and NULL', async () => {
    state.filename = await writeSource(`CREATE TABLE uploaded_data AS SELECT * FROM (VALUES
      ('below', -9007199254740992::BIGINT), ('min', -9007199254740991::BIGINT),
      ('max', 9007199254740991::BIGINT), ('above', 9007199254740992::BIGINT), ('missing', NULL)) t(region, amount)`);
    const result = await scopedQuery({
      filters: [
        {
          column: 'amount',
          range: { min: -Number.MAX_SAFE_INTEGER, max: Number.MAX_SAFE_INTEGER },
        },
      ],
      includeRows: true,
    });
    expect(result.details.rows.map(row => [row.region, row.amount])).toEqual([
      ['max', Number.MAX_SAFE_INTEGER],
      ['min', -Number.MAX_SAFE_INTEGER],
    ]);
    expect(result.details.totalRows).toBe('2');
    expect(result.kpis[0].value).toBe(0);
    const atMax = await scopedQuery({
      filters: [
        { column: 'amount', range: { min: Number.MAX_SAFE_INTEGER, max: Number.MAX_SAFE_INTEGER } },
      ],
    });
    expect(atMax.leaderboards[0].rows).toEqual([
      { category: 'max', value: Number.MAX_SAFE_INTEGER },
    ]);
  });

  it('allows five distinct columns with mixed values and ranges before rejecting a sixth', async () => {
    const filters = [
      { column: 'region', values: ['A'] },
      { column: 'channel', values: ['web'] },
      { column: 'amount', range: { min: 12, max: 18 } },
      { column: 'weight', range: { min: 2 } },
      { column: 'day', values: ['2026-01-01'] },
    ];
    const result = await scopedQuery({ filters, includeRows: true });
    expect(result.kpis[0].value).toBe(30);
    expect(result.details.totalRows).toBe('2');
    expect(result.applied.filters).toEqual(filters);
    await expect(
      scopedQuery({
        filters: [...filters, { column: 'event_time', values: ['2026-01-01 00:30:00'] }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it.each(['delta', 'percentChange'])(
    'sorts all >20 joined groups by %s before limiting with active range',
    async by => {
      state.filename = await writeSource(`CREATE TABLE uploaded_data AS
      SELECT 'G' || lpad(CAST(i AS VARCHAR), 2, '0') AS region, (1000 + i)::BIGINT AS amount, DATE '2026-01-02' AS day, 1 AS scope FROM range(30) t(i)
      UNION ALL SELECT 'G' || lpad(CAST(i AS VARCHAR), 2, '0'), 2000 + i, DATE '2026-01-01', 1 FROM range(30) t(i)
      UNION ALL SELECT 'Winner', 10, DATE '2026-01-02', 1
      UNION ALL SELECT 'Winner', 1, DATE '2026-01-01', 1
      UNION ALL SELECT 'Excluded', 999999, DATE '2026-01-02', 2`);
      const result = await scopedQuery({
        dateRange: { column: 'day', start: '2026-01-02', end: '2026-01-02' },
        comparePrevious: true,
        filters: [{ column: 'scope', range: { min: 1, max: 1 } }],
        leaderboardSort: { by, direction: 'desc' },
      });
      expect(result.leaderboards[0].rows[0]).toMatchObject({
        category: 'Winner',
        value: 10,
        previousValue: 1,
        delta: 9,
        percentChange: 900,
      });
      expect(result.leaderboards[0].rows).toHaveLength(20);
      expect(result.leaderboards[0].truncated).toBe(true);
      expect(result.applied.leaderboardSort).toEqual({ by, direction: 'desc' });
      if (by === 'delta') expect(result.leaderboards[0].rows[1].category).toBe('G00');
    },
  );

  it('sorts exact huge integer values and deltas in SQL, even when comparison response is unavailable', async () => {
    state.filename = await writeSource(`CREATE TABLE uploaded_data AS
      SELECT * FROM (VALUES ('A', 9007199254740992::BIGINT, DATE '2026-01-02'), ('Z', 9007199254740993::BIGINT, DATE '2026-01-02'),
       ('A', 0, DATE '2026-01-01'), ('Z', 0, DATE '2026-01-01')) t(region, amount, day)`);
    for (const by of ['value', 'delta']) {
      const result = await scopedQuery({
        dateRange: { column: 'day', start: '2026-01-02', end: '2026-01-02' },
        comparePrevious: true,
        leaderboardSort: { by, direction: 'desc' },
      });
      expect(result.leaderboards[0].rows.map(row => row.category)).toEqual(['Z', 'A']);
      expect(result.leaderboards[0].rows[0].value).toBe('9007199254740993');
      expect(result.leaderboards[0].rows[0].delta).toBeNull();
    }
  });

  it.each(['asc', 'desc'])(
    'keeps missing percent changes last, distinguishes known zero, and preserves period-only groups (%s)',
    async direction => {
      state.filename = await writeSource(`CREATE TABLE uploaded_data AS SELECT * FROM (VALUES
      ('positive', 10, DATE '2026-01-02'), ('positive', 5, DATE '2026-01-01'),
      ('zero', 5, DATE '2026-01-02'), ('zero', 5, DATE '2026-01-01'),
      ('negative', 0, DATE '2026-01-02'), ('negative', 5, DATE '2026-01-01'),
      ('A-zero-prior', 10, DATE '2026-01-02'), ('A-zero-prior', 0, DATE '2026-01-01'),
      ('B-current-only', 10, DATE '2026-01-02'), ('C-prior-only', 5, DATE '2026-01-01'),
      ('D-null-current', NULL, DATE '2026-01-02'), ('D-null-current', 5, DATE '2026-01-01'),
      ('E-null-prior', 10, DATE '2026-01-02'), ('E-null-prior', NULL, DATE '2026-01-01')) t(region, amount, day)`);
      const result = await scopedQuery({
        dateRange: { column: 'day', start: '2026-01-02', end: '2026-01-02' },
        comparePrevious: true,
        leaderboardSort: { by: 'percentChange', direction },
      });
      const rows = result.leaderboards[0].rows;
      expect(rows.slice(0, 3).map(row => row.percentChange)).toEqual(
        direction === 'asc' ? [-100, 0, 100] : [100, 0, -100],
      );
      expect(rows.slice(3).map(row => row.category)).toEqual([
        'A-zero-prior',
        'B-current-only',
        'C-prior-only',
        'D-null-current',
        'E-null-prior',
      ]);
      expect(rows[3]).toMatchObject({ previousValue: 0, delta: 10, percentChange: null });
      expect(rows[4]).toMatchObject({ previousValue: null, delta: null, percentChange: null });
      expect(rows[5]).toMatchObject({
        value: null,
        previousValue: 5,
        delta: null,
        percentChange: null,
      });
    },
  );

  it('supports explicit default and ascending value sort with NULLS LAST', async () => {
    const implicit = await scopedQuery();
    const explicit = await scopedQuery({ leaderboardSort: { by: 'value', direction: 'desc' } });
    expect(explicit).toEqual(implicit);
    const asc = await scopedQuery({
      measureIds: [3],
      rankingMeasureId: 3,
      leaderboardSort: { by: 'value', direction: 'asc' },
    });
    expect(asc.leaderboards[0].rows.map(row => row.category)).toEqual(['A', null, 'B', 'C', 'D']);
    expect(asc.leaderboards[0].rows[4].value).toBeNull();
  });

  it.each([
    { filters: [{ column: 'amount', range: { min: 0 }, values: [1] }] },
    { filters: [{ column: 'region', range: { min: 0 } }] },
    { filters: [{ column: 'day', range: { min: 0 } }] },
    { filters: [{ column: 'amount', range: { min: null } }] },
    { filters: [{ column: 'amount', range: { min: 2, max: 1 } }] },
    { filters: [{ column: 'amount', range: { max: Number.MAX_SAFE_INTEGER + 1 } }] },
    { filters: [{ column: 'amount', range: { min: '0 OR true' } }] },
    {
      filters: [
        { column: 'amount', range: { min: 0 } },
        { column: 'amount', values: [1] },
      ],
    },
    { leaderboardSort: { by: 'value; DROP TABLE uploaded_data', direction: 'desc' } },
    { leaderboardSort: { by: 'value', direction: 'desc; DROP TABLE uploaded_data' } },
    { leaderboardSort: { by: 'delta', direction: 'desc' } },
    { leaderboardSort: { by: 'percentChange', direction: 'desc' }, comparePrevious: true },
    { leaderboardSort: { by: 'value', direction: 'desc', extra: true } },
    { leaderboardSort: null },
  ])('rejects invalid numeric range/sort %j', async options => {
    await expect(scopedQuery(options)).rejects.toBeInstanceOf(BadRequestException);
    if (options.filters)
      await expect(
        service.values(
          {
            sourceId: 1,
            sourceRevision: await revision(),
            column: 'region',
            filters: options.filters,
          },
          actor,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    expect((await service.catalog({ sourceId: 1 }, actor)).rowCount).toBe('9');
  });

  const pivot = async (overrides: any = {}, who = actor) =>
    service.pivot(
      {
        sourceId: 1,
        sourceRevision: await revision(),
        measureIds: [1, 2, 3, 4],
        rowDimensions: ['region'],
        columnDimensions: ['channel'],
        ...overrides,
      },
      who,
    );

  it('pivot reaggregates SUM, COUNT, ratio and weighted totals with sparse cells', async () => {
    const result = await pivot();
    expect(result.sourceRevision).toBe(await revision());
    expect(result.metrics).toEqual([
      { id: 1, label: 'Revenue', suffix: ' USD', decimalPlaces: 2, numberNotation: 'full' },
      { id: 2, label: 'Orders', decimalPlaces: 0, numberNotation: 'full' },
      { id: 3, label: 'Weighted', decimalPlaces: 2, numberNotation: 'full' },
      { id: 4, label: 'Per weight', decimalPlaces: 4, numberNotation: 'full' },
    ]);
    expect(result.rows.map(row => row.values)).toEqual([['A'], ['B'], ['C'], [null], ['D']]);
    expect(result.columns.map(column => column.values)).toEqual([['app'], ['web'], ['bulk']]);
    expect(result.grandTotals).toEqual([311, 9, 862 / 23, 311 / 23]);
    expect(result.columns[0].totals).toEqual([240, 5, 50, 240 / 11]);
    expect(result.rows[0]).toEqual({
      key: '["A"]',
      values: ['A'],
      totals: [120, 4, 29.5, 15],
      cells: [
        { columnKey: '["app"]', values: [90, 2, 70, 45] },
        { columnKey: '["web"]', values: [30, 2, 16, 5] },
      ],
    });
    expect(result.rows[3]).toEqual({
      key: '[null]',
      values: [null],
      totals: [36, 1, 36, 6],
      cells: [{ columnKey: '["web"]', values: [36, 1, 36, 6] }],
    });
    expect(result.rows[4].totals).toEqual([5, 1, null, null]);
    expect(result.rows[4].cells).toEqual([{ columnKey: '["bulk"]', values: [5, 1, null, null] }]);
    expect(result.limits).toEqual({
      rowLimit: 50,
      columnLimit: 12,
      totalRowGroups: 5,
      totalColumnGroups: 3,
      truncatedRows: false,
      truncatedColumns: false,
    });
  });

  it('pivot uses first measure ordering, dimension ties and NULLS LAST on both axes', async () => {
    state.filename = await writeSource(`CREATE TABLE uploaded_data AS
      SELECT * FROM (VALUES ('B', 'y', 2, 1), ('A', 'z', 2, 1),
        ('C', 'x', 9, 0), ('D', 'w', NULL, 1),
        (NULL, 'v', 2, 1), ('E', NULL, 2, 1)) t(region, channel, amount, weight)`);
    const result = await pivot({ measureIds: [4, 1] });
    expect(result.rows.map(row => row.values)).toEqual([['A'], ['B'], ['E'], [null], ['C'], ['D']]);
    expect(result.columns.map(column => column.values)).toEqual([
      ['v'],
      ['y'],
      ['z'],
      [null],
      ['w'],
      ['x'],
    ]);
    expect(result.rows.slice(-2).map(row => row.totals[0])).toEqual([null, null]);
    expect(result.rows[2].cells).toEqual([{ columnKey: '[null]', values: [2, 2] }]);
  });

  it('pivot keeps NULL distinct from strings, handles two row dimensions and no column axis', async () => {
    state.filename = await writeSource(`CREATE TABLE uploaded_data AS
      SELECT * FROM (VALUES (NULL, 'a', 1), ('null', 'a', 1),
        ('x', 'a', 1), ('x', 'b', 1), ('[null]', 'a', 1)) t(region, channel, amount)`);
    const result = await pivot({
      measureIds: [1, 2],
      rowDimensions: ['region', 'channel'],
      columnDimensions: [],
    });
    expect(result.rows.map(row => row.values)).toEqual([
      ['[null]', 'a'],
      ['null', 'a'],
      ['x', 'a'],
      ['x', 'b'],
      [null, 'a'],
    ]);
    expect(new Set(result.rows.map(row => row.key)).size).toBe(5);
    for (const row of result.rows) {
      expect(row.key).toBe(JSON.stringify(row.values));
      expect(row.cells).toEqual([{ columnKey: '[]', values: [1, 1] }]);
    }
    expect(result.columns).toEqual([{ key: '[]', values: [], totals: [5, 5] }]);
    expect(result.limits.totalColumnGroups).toBe(1);
  });

  it('pivot preserves large integer strings and quotes registered identifiers', async () => {
    state.filename = await writeSource(`CREATE TABLE uploaded_data AS SELECT
      9007199254740993::BIGINT AS "r""quoted", 'X' AS channel,
      9007199254740993::BIGINT AS amount`);
    const result = await pivot({ measureIds: [1, 2], rowDimensions: ['r"quoted'] });
    expect(result.grandTotals).toEqual(['9007199254740993', 1]);
    expect(result.rows[0]).toEqual({
      key: '["9007199254740993"]',
      values: ['9007199254740993'],
      totals: ['9007199254740993', 1],
      cells: [{ columnKey: '["X"]', values: ['9007199254740993', 1] }],
    });
    expect(result.columns[0].totals).toEqual(['9007199254740993', 1]);
  });

  it('pivot applies canonical numeric, NULL and date filters to every total and cell', async () => {
    const result = await pivot({
      filters: [{ column: 'amount', range: { min: 20, max: 50 } }],
      dateRange: { column: 'day', start: '2026-01-02', end: '2026-01-03' },
    });
    expect(result.grandTotals).toEqual([110, 3, 43.75, 13.75]);
    expect(result.rows.map(row => row.totals)).toEqual([
      [90, 2, 43.75, 11.25],
      [20, 1, null, null],
    ]);
    expect(result.columns).toEqual([
      { key: '["app"]', values: ['app'], totals: [110, 3, 43.75, 13.75] },
    ]);
    expect(result.rows[1].cells).toEqual([{ columnKey: '["app"]', values: [20, 1, null, null] }]);
    const nullOnly = await pivot({ filters: [{ column: 'region', values: [null] }] });
    expect(nullOnly.grandTotals).toEqual([36, 1, 36, 6]);
    expect(nullOnly.rows.map(row => row.key)).toEqual(['[null]']);
  });

  it('pivot returns empty axes and canonical empty SUM/COUNT/ratio/weighted totals', async () => {
    const options = { filters: [{ column: 'channel', values: ['missing'] }] };
    const result = await pivot(options);
    expect(result.rows).toEqual([]);
    expect(result.columns).toEqual([]);
    expect(result.grandTotals).toEqual([null, 0, null, null]);
    expect(result.limits).toEqual({
      rowLimit: 50,
      columnLimit: 12,
      totalRowGroups: 0,
      totalColumnGroups: 0,
      truncatedRows: false,
      truncatedColumns: false,
    });
    const withoutColumns = await pivot({ ...options, columnDimensions: [] });
    expect(withoutColumns.rows).toEqual([]);
    expect(withoutColumns.columns).toEqual([
      { key: '[]', values: [], totals: [null, 0, null, null] },
    ]);
    expect(withoutColumns.grandTotals).toEqual([null, 0, null, null]);
  });

  it('pivot bounds bulk60 row groups and column groups while retaining complete totals', async () => {
    state.filename = bulkFile;
    const result = await pivot({
      measureIds: [1, 2],
      rowDimensions: ['sku'],
      columnDimensions: ['region'],
    });
    expect(result.rows).toHaveLength(50);
    expect(result.rows[0].values).toEqual(['S060']);
    expect(result.rows[49].values).toEqual(['S011']);
    expect(result.grandTotals).toEqual([1830, 60]);
    expect(result.columns.map(column => column.totals)).toEqual([
      [630, 20],
      [610, 20],
      [590, 20],
    ]);
    expect(result.rows.every(row => row.cells.length === 1)).toBe(true);
    expect(result.limits).toMatchObject({
      totalRowGroups: 60,
      totalColumnGroups: 3,
      truncatedRows: true,
      truncatedColumns: false,
    });
    const transposed = await pivot({
      measureIds: [1, 2],
      rowDimensions: ['region'],
      columnDimensions: ['sku'],
    });
    expect(transposed.columns).toHaveLength(12);
    expect(transposed.columns[0].values).toEqual(['S060']);
    expect(transposed.columns[11].values).toEqual(['S049']);
    expect(transposed.rows.map(row => row.totals)).toEqual([
      [630, 20],
      [610, 20],
      [590, 20],
    ]);
    expect(transposed.rows.every(row => row.cells.length === 4)).toBe(true);
    expect(transposed.limits).toMatchObject({
      totalRowGroups: 3,
      totalColumnGroups: 60,
      truncatedRows: false,
      truncatedColumns: true,
    });
  });

  it('pivot limits both axes in SQL and reaggregates ratios/weighted totals across hidden axes', async () => {
    state.filename = await writeSource(`CREATE TABLE uploaded_data AS SELECT
      r AS region, c AS channel, (r + c)::DOUBLE AS amount, (c + 1)::DOUBLE AS weight
      FROM range(60) row_axis(r) CROSS JOIN range(15) cols(c)`);
    const connection = (service as any).connection as ConnectionService;
    const query = jest.spyOn(connection, 'queryDuckDB');
    const result = await pivot();
    expect(result.rows).toHaveLength(50);
    expect(result.columns).toHaveLength(12);
    expect(result.rows.every(row => row.cells.length === 12)).toBe(true);
    expect(result.rows[0].values).toEqual([59]);
    expect(result.rows[49].values).toEqual([10]);
    expect(result.columns[0].values).toEqual([14]);
    expect(result.columns[11].values).toEqual([3]);
    expect(result.grandTotals).toEqual([32850, 900, 233 / 6, 73 / 16]);
    expect(result.rows[0].totals).toEqual([990, 15, 205 / 3, 8.25]);
    expect(result.columns[0].totals).toEqual([2610, 60, 43.5, 2.9]);
    expect(result.limits).toEqual({
      rowLimit: 50,
      columnLimit: 12,
      totalRowGroups: 60,
      totalColumnGroups: 15,
      truncatedRows: true,
      truncatedColumns: true,
    });
    const axisCalls = query.mock.calls.filter(
      ([, sql]) => sql.includes('COUNT(*) OVER ()') && !sql.includes('EXISTS'),
    );
    expect(axisCalls).toHaveLength(2);
    expect(axisCalls[0][1]).toMatch(/LIMIT 51$/);
    expect(axisCalls[1][1]).toMatch(/LIMIT 13$/);
    const cellCall = query.mock.calls.find(([, sql]) => sql.includes('EXISTS'));
    expect(cellCall[1]).toContain('IS NOT DISTINCT FROM');
    expect(cellCall[1]).toContain('LIMIT 50');
    expect(cellCall[1]).toContain('LIMIT 12');
    expect(cellCall[1]).toMatch(/LIMIT 600$/);
    query.mockRestore();
  });

  it('pivot pins aggregate SQL but rejects a source switch before returning its result', async () => {
    const connection = (service as any).connection as ConnectionService;
    const original = connection.queryDuckDB.bind(connection);
    const query = jest.spyOn(connection, 'queryDuckDB').mockImplementation(async (...args) => {
      const result = await original(...args);
      if (args[1].includes('__vm_pivot_m0')) state.filename = bulkFile;
      return result;
    });
    try {
      await expect(pivot()).rejects.toMatchObject({ status: 409 });
      // All aggregate SQL still uses the original pin; the final current-source check refuses
      // to publish those results once the selected file changes.
      expect(
        query.mock.calls.filter(([, sql]) => sql.includes('__vm_pivot_m0')).length,
      ).toBeGreaterThan(1);
    } finally {
      query.mockRestore();
    }
  });

  it('pivot authorizes before decrypting broken foreign connection config', async () => {
    databaseRepo.findOne.mockImplementation(async () => ({
      id: 1,
      ownerId: 10,
      engine: 'duckdb',
      connectionConfig: 'enc:v1:broken',
    }));
    await expect(
      service.pivot(
        {
          sourceId: 1,
          sourceRevision: 'rev',
          measureIds: [1],
          rowDimensions: ['region'],
          columnDimensions: [],
        },
        20,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('pivot rejects unauthorized sources, unsupported engines and stale revisions', async () => {
    await expect(pivot({}, 20)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(pivot({ sourceId: 3 })).rejects.toBeInstanceOf(BadRequestException);
    const stale = await revision();
    state.filename = bulkFile;
    await expect(pivot({ sourceRevision: stale })).rejects.toBeInstanceOf(ConflictException);
  });

  it('pivot rejects unknown fields, SQL, dimensions, measure IDs and invalid filter/date input', async () => {
    const cases = [
      { sourceId: '1' },
      { sourceId: 0 },
      { sourceId: 1.5 },
      { sourceRevision: undefined },
      { sourceRevision: '' },
      { measureIds: [] },
      { measureIds: [1, 1] },
      { measureIds: ['1'] },
      { measureIds: [0] },
      { measureIds: [1.5] },
      { measureIds: [99] },
      { measureIds: [5] },
      { measureIds: [1, 2, 3, 4, 5, 6, 7] },
      { rowDimensions: undefined },
      { rowDimensions: [] },
      { rowDimensions: 'region' },
      { rowDimensions: ['region', 'channel', 'day'] },
      { rowDimensions: ['region', 'region'] },
      { rowDimensions: [null] },
      { rowDimensions: ['unknown'] },
      { rowDimensions: ['region; DROP TABLE uploaded_data'] },
      { columnDimensions: undefined },
      { columnDimensions: null },
      { columnDimensions: ['region', 'channel'] },
      { columnDimensions: ['region'] },
      { columnDimensions: ['unknown'] },
      { sql: 'SELECT 1' },
      { extra: true },
      { filters: null },
      { filters: [{ column: 'missing', values: [1] }] },
      { filters: [{ column: 'channel', values: ['app'], sql: 'SELECT 1' }] },
      { filters: [{ column: 'channel', range: { min: 1 } }] },
      { filters: [{ column: 'amount', range: { min: '1 OR true' } }] },
      { dateRange: null },
      { dateRange: { column: 'channel', start: '2026-01-01', end: '2026-01-02' } },
      { dateRange: { column: 'day', start: '2026-02-30', end: '2026-03-01' } },
      { dateRange: { column: 'day', start: '2026-01-03', end: '2026-01-01' } },
      { dateRange: { column: 'day', start: '2026-01-01', end: '2026-01-02', sql: 'SELECT 1' } },
    ];
    for (const candidate of cases)
      await expect(pivot(candidate)).rejects.toBeInstanceOf(BadRequestException);
    for (const candidate of [null, [], 'SELECT 1'])
      await expect(service.pivot(candidate, actor)).rejects.toBeInstanceOf(BadRequestException);
    expect((await service.catalog({ sourceId: 1 }, actor)).rowCount).toBe('9');
  });

  it('pivot controller exposes the authenticated POST route with the standard envelope', async () => {
    expect(Reflect.getMetadata('path', BiExploreController.prototype.pivot)).toBe('pivot');
    expect(Reflect.getMetadata('method', BiExploreController.prototype.pivot)).toBe(1);
    const body = {
      sourceId: 1,
      sourceRevision: await revision(),
      measureIds: [1],
      rowDimensions: ['region'],
      columnDimensions: [],
    };
    const result = await new BiExploreController(service).pivot(body, {
      user: { accessKeyData: { id: actor } },
    });
    expect(result.status).toBe('SUCCESS');
    expect(result.data.grandTotals).toEqual([311]);
    await expect(
      new BiExploreController(service).pivot(body, { user: { accessKeyData: { id: 20 } } }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('applies one inclusive numeric range to kpis, leaderboards, details and values', async () => {
    const sourceRevision = await revision();
    const scoped = [{ column: 'amount', range: { min: 20, max: 60 } }];
    const result = await service.query(
      {
        sourceId: 1,
        sourceRevision,
        measureIds: [1],
        rankingMeasureId: 1,
        dimensionColumns: ['region'],
        filters: scoped,
        trendGrain: 'auto',
        comparePrevious: false,
        page: 0,
        pageSize: 25,
        includeRows: true,
      },
      actor,
    );
    // Both endpoints are included: 20 + 36 + 40 + 50 + 60.
    expect(result.kpis[0].value).toBe(206);
    expect(result.leaderboards[0].rows).toEqual([
      { category: 'B', value: 90 },
      { category: 'C', value: 60 },
      { category: null, value: 36 },
      { category: 'A', value: 20 },
    ]);
    expect(result.details).toMatchObject({ totalRows: '5', page: 0, pageSize: 25 });
    expect(
      result.details.rows.map((detail: any) => detail.amount).sort((a: number, b: number) => a - b),
    ).toEqual([20, 36, 40, 50, 60]);
    expect(result.applied).toMatchObject({
      filters: scoped,
      rankingSort: { by: 'value', direction: 'desc' },
    });
    const values = await service.values(
      { sourceId: 1, sourceRevision, column: 'region', search: '', filters: scoped },
      actor,
    );
    expect(values.values).toEqual(['A', 'B', 'C', null]);
    // One-sided bounds keep the same inclusive comparison.
    const minOnly = await service.query(
      {
        sourceId: 1,
        sourceRevision,
        measureIds: [1],
        rankingMeasureId: 1,
        dimensionColumns: [],
        filters: [{ column: 'amount', range: { min: 60 } }],
        page: 0,
        pageSize: 25,
        includeRows: false,
      },
      actor,
    );
    expect(minOnly.kpis[0].value).toBe(130);
    const maxOnly = await service.query(
      {
        sourceId: 1,
        sourceRevision,
        measureIds: [1],
        rankingMeasureId: 1,
        dimensionColumns: [],
        filters: [{ column: 'amount', range: { max: 12 } }],
        page: 0,
        pageSize: 25,
        includeRows: false,
      },
      actor,
    );
    // Only 12 and 5 fall at or below the upper bound.
    expect(maxOnly.kpis[0].value).toBe(17);
    // Without a compared period only the measure value direction is available.
    const ascending = await service.query(
      {
        sourceId: 1,
        sourceRevision,
        measureIds: [1],
        rankingMeasureId: 1,
        dimensionColumns: ['region'],
        filters: [],
        trendGrain: 'auto',
        comparePrevious: false,
        rankingSort: { by: 'value', direction: 'asc' },
        page: 0,
        pageSize: 25,
        includeRows: false,
      },
      actor,
    );
    expect(ascending.leaderboards[0].rows.map((entry: any) => entry.category)).toEqual([
      'D',
      null,
      'C',
      'B',
      'A',
    ]);
  });

  it('rejects nonnumeric, malformed and ambiguous range filters on query and values', async () => {
    const sourceRevision = await revision();
    const body = (filters: any[]) => ({
      sourceId: 1,
      sourceRevision,
      measureIds: [1],
      rankingMeasureId: 1,
      dimensionColumns: [],
      filters,
      trendGrain: 'auto',
      comparePrevious: false,
      page: 0,
      pageSize: 25,
      includeRows: false,
    });
    const cases = [
      // A range compares raw values, so a text column has no numeric order to compare against.
      [{ column: 'region', range: { min: 1 } }],
      [{ column: 'missing', range: { min: 1 } }],
      [{ column: 'amount', range: {} }],
      [{ column: 'amount', range: { min: 10, max: 5 } }],
      [{ column: 'amount', range: { min: '10' } }],
      [{ column: 'amount', range: { min: Number.NaN } }],
      [{ column: 'amount', range: { min: Number.POSITIVE_INFINITY } }],
      [{ column: 'amount', range: { min: 1, extra: 2 } }],
      [{ column: 'amount', range: null }],
      [{ column: 'amount', range: [1, 2] }],
      [{ column: 'amount', values: [1], range: { min: 1 } }],
      [{ column: 'amount', value: 1, range: { min: 1 } }],
      [{ column: 'amount', range: { min: 1 }, extra: 1 }],
    ];
    for (const filters of cases)
      await expect(service.query(body(filters), actor)).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.values(
        {
          sourceId: 1,
          sourceRevision,
          column: 'region',
          search: '',
          filters: [{ column: 'region', range: { min: 1 } }],
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect((await service.catalog({ sourceId: 1 }, actor)).rowCount).toBe('9');
  });

  it('sorts every compared group by delta and percentChange before limiting', async () => {
    state.filename = await writeSource(`CREATE TABLE uploaded_data AS
      SELECT 'ok' AS region, 10::DOUBLE AS amount, DATE '2026-01-01' AS day
      UNION ALL SELECT 'ok', 20, DATE '2026-01-02'
      UNION ALL SELECT 'zero', 0, DATE '2026-01-01'
      UNION ALL SELECT 'zero', 5, DATE '2026-01-02'
      UNION ALL SELECT 'gone', 10, DATE '2026-01-01'
      UNION ALL SELECT 'huge', 1e16, DATE '2026-01-01'
      UNION ALL SELECT 'huge', 2e16, DATE '2026-01-02'
      UNION ALL SELECT 'X', 1, DATE '2026-01-01'
      UNION ALL SELECT 'X', 100, DATE '2026-01-02'
      UNION ALL SELECT 'Y', 100, DATE '2026-01-01'
      UNION ALL SELECT 'Y', 150, DATE '2026-01-02'
      UNION ALL SELECT 'Z', 1000, DATE '2026-01-01'
      UNION ALL SELECT 'Z', 1000, DATE '2026-01-02'
      UNION ALL SELECT 'W', 500, DATE '2026-01-01'
      UNION ALL SELECT 'W', 600, DATE '2026-01-02'
      UNION ALL SELECT 'N', 300, DATE '2026-01-02'`);
    metrics = [metric(1, 'Revenue', { aggregation: 'SUM', column: 'amount' })];
    const sourceRevision = await revision();
    const body = (rankingSort?: any) => ({
      sourceId: 1,
      sourceRevision,
      measureIds: [1],
      rankingMeasureId: 1,
      dimensionColumns: ['region'],
      filters: [],
      dateRange: { column: 'day', start: '2026-01-02', end: '2026-01-02' },
      trendGrain: 'auto',
      comparePrevious: true,
      page: 0,
      pageSize: 25,
      includeRows: false,
      ...(rankingSort ? { rankingSort } : {}),
    });
    const order = async (sort: any) =>
      (await service.query(body(sort), actor)).leaderboards[0].rows.map(
        (entry: any) => entry.category,
      );
    expect(await order({ by: 'delta', direction: 'desc' })).toEqual([
      'W',
      'X',
      'Y',
      'ok',
      'zero',
      'Z',
      'N',
      'gone',
      'huge',
    ]);
    expect(await order({ by: 'delta', direction: 'asc' })).toEqual([
      'Z',
      'zero',
      'ok',
      'Y',
      'X',
      'W',
      'N',
      'gone',
      'huge',
    ]);
    // percentChange divides by abs(previous), so a negative baseline keeps the delta's sign.
    expect(await order({ by: 'percentChange', direction: 'desc' })).toEqual([
      'X',
      'ok',
      'Y',
      'W',
      'Z',
      'N',
      'gone',
      'huge',
      'zero',
    ]);
    expect(await order({ by: 'percentChange', direction: 'asc' })).toEqual([
      'Z',
      'W',
      'Y',
      'ok',
      'X',
      'N',
      'gone',
      'huge',
      'zero',
    ]);
    const rows = (await service.query(body({ by: 'delta', direction: 'desc' }), actor))
      .leaderboards[0].rows;
    expect(rows.find((row: any) => row.category === 'X')).toEqual({
      category: 'X',
      value: 100,
      previousValue: 1,
      delta: 99,
      percentChange: 9900,
    });
    // A zero baseline reports no percent change instead of an infinite one.
    expect(rows.find((row: any) => row.category === 'zero')).toEqual({
      category: 'zero',
      value: 5,
      previousValue: 0,
      delta: 5,
      percentChange: null,
    });
    // A previous-only group keeps its null current value and is ordered last.
    expect(rows.find((row: any) => row.category === 'gone')).toEqual({
      category: 'gone',
      value: null,
      previousValue: 10,
      delta: null,
      percentChange: null,
    });
    expect(rows.find((row: any) => row.category === 'N')).toEqual({
      category: 'N',
      value: 300,
      previousValue: null,
      delta: null,
      percentChange: null,
    });
    // Beyond the exact integer range the change is suppressed and cannot lead a change sort.
    expect(rows[rows.length - 1]).toMatchObject({
      category: 'huge',
      delta: null,
      percentChange: null,
      unavailable: expect.any(String),
    });
    const percent = (await service.query(body({ by: 'percentChange', direction: 'desc' }), actor))
      .leaderboards[0].rows;
    expect(percent[0]).toEqual({
      category: 'X',
      value: 100,
      previousValue: 1,
      delta: 99,
      percentChange: 9900,
    });
    expect(percent[percent.length - 1]).toMatchObject({ category: 'zero', percentChange: null });
  });

  it('returns a category outside the current top twenty through a change sort', async () => {
    state.filename = await writeSource(`CREATE TABLE uploaded_data AS
      SELECT 'X' AS region, -400::DOUBLE AS amount, DATE '2026-01-02' AS day
      UNION ALL SELECT 'X', -500, DATE '2026-01-01'
      UNION ALL SELECT 'P' || lpad(CAST(i AS VARCHAR), 2, '0'), CAST(100 + i AS DOUBLE),
        DATE '2026-01-02' FROM range(30) t(i)`);
    metrics = [metric(1, 'Revenue', { aggregation: 'SUM', column: 'amount' })];
    const sourceRevision = await revision();
    const body = (rankingSort?: any) => ({
      sourceId: 1,
      sourceRevision,
      measureIds: [1],
      rankingMeasureId: 1,
      dimensionColumns: ['region'],
      filters: [],
      dateRange: { column: 'day', start: '2026-01-02', end: '2026-01-02' },
      trendGrain: 'auto',
      comparePrevious: true,
      page: 0,
      pageSize: 25,
      includeRows: false,
      ...(rankingSort ? { rankingSort } : {}),
    });
    const byValue = await service.query(body(), actor);
    expect(byValue.leaderboards[0].truncated).toBe(true);
    expect(byValue.leaderboards[0].rows).toHaveLength(20);
    expect(byValue.leaderboards[0].rows.map((row: any) => row.category)).not.toContain('X');
    const byDelta = await service.query(body({ by: 'delta', direction: 'desc' }), actor);
    expect(byDelta.leaderboards[0].truncated).toBe(true);
    expect(byDelta.leaderboards[0].rows).toHaveLength(20);
    // The negative previous baseline keeps a positive delta and a positive percent change.
    expect(byDelta.leaderboards[0].rows[0]).toEqual({
      category: 'X',
      value: -400,
      previousValue: -500,
      delta: 100,
      percentChange: 20,
    });
    const byPercent = await service.query(body({ by: 'percentChange', direction: 'desc' }), actor);
    expect(byPercent.leaderboards[0].rows[0]).toEqual({
      category: 'X',
      value: -400,
      previousValue: -500,
      delta: 100,
      percentChange: 20,
    });
  });

  it('suppresses decimal text that rounds inward at the exact integer boundary', async () => {
    state.filename = await writeSource(`CREATE TABLE uploaded_data AS
      SELECT 'edge' AS region, 9007199254740991.0000::DECIMAL(38, 4) AS amount,
        DATE '2026-01-01' AS day
      UNION ALL SELECT 'edge', 9007199254740991.0000::DECIMAL(38, 4), DATE '2026-01-02'
      UNION ALL SELECT 'safe', 2::DECIMAL(38, 4), DATE '2026-01-01'
      UNION ALL SELECT 'safe', 4::DECIMAL(38, 4), DATE '2026-01-02'`);
    metrics = [metric(1, 'Revenue', { aggregation: 'SUM', column: 'amount' })];
    const sourceRevision = await revision();
    const result = await service.query(
      {
        sourceId: 1,
        sourceRevision,
        measureIds: [1],
        rankingMeasureId: 1,
        dimensionColumns: ['region'],
        filters: [],
        dateRange: { column: 'day', start: '2026-01-02', end: '2026-01-02' },
        trendGrain: 'auto',
        comparePrevious: true,
        rankingSort: { by: 'delta', direction: 'asc' },
        page: 0,
        pageSize: 25,
        includeRows: false,
      },
      actor,
    );
    const rows = result.leaderboards[0].rows;
    // Without the exact-range guard the boundary row would sort first on its zero delta.
    expect(rows.map((row: any) => row.category)).toEqual(['safe', 'edge']);
    expect(rows[0]).toMatchObject({ delta: 2, percentChange: 100 });
    expect(rows[1]).toMatchObject({
      category: 'edge',
      delta: null,
      percentChange: null,
      unavailable: expect.any(String),
    });
  });

  it('rejects change sorts without a compared period and unknown sort fields', async () => {
    const sourceRevision = await revision();
    const body = (rankingSort: any) => ({
      sourceId: 1,
      sourceRevision,
      measureIds: [1],
      rankingMeasureId: 1,
      dimensionColumns: ['region'],
      filters: [],
      trendGrain: 'auto',
      comparePrevious: false,
      rankingSort,
      page: 0,
      pageSize: 25,
      includeRows: false,
    });
    const cases = [
      { by: 'delta' },
      { by: 'delta', direction: 'desc' },
      { by: 'percentChange', direction: 'asc' },
      { by: 'median' },
      { by: 'value', direction: 'sideways' },
      { by: 'value', extra: true },
      'value',
      [],
    ];
    for (const rankingSort of cases)
      await expect(service.query(body(rankingSort), actor)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    const defaulted = await service.query(
      { ...body({ by: 'value' }), dimensionColumns: [] },
      actor,
    );
    expect(defaulted.applied.rankingSort).toEqual({ by: 'value', direction: 'desc' });
  });
});
