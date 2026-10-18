jest.mock('../ai/ai.service', () => ({ AiService: class {} }));

import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { DuckDBInstance } from '@duckdb/node-api';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DuckDBService } from '../analysis/duckdb.service';
import { ConnectionService } from '../connection/connection.service';
import { Database } from '../database/entities/database.entity';
import { Metric } from '../metric/entities/metric.entity';
import { SourceAccessService } from '../ownership/source-access.service';
import { studioDemoData } from '../dashboard-studio/studio-demo-data';
import { BiSegmentController } from './bi-segment.controller';
import { BiSegmentService } from './bi-segment.service';
import { BiService } from './bi.service';
import { BiExploreService } from './bi-explore.service';

jest.setTimeout(120000);

describe('BiSegmentService aggregate segments over real DuckDB', () => {
  const actor = 10;
  const revision64 = /^[a-f0-9]{64}$/;
  const MARGIN_COLUMNS = [
    'day',
    'company',
    'plan',
    'location',
    'environment',
    'component',
    'sku',
    'pipeline',
    'currency',
    'revenue',
    'cost',
    'profit',
  ];
  /** 260 distinct skus and 260 distinct days: enough to prove group and trend truncation. */
  const bulkSql =
    'CREATE TABLE uploaded_data AS SELECT ' +
    "CAST('sku-' || lpad(CAST(i AS VARCHAR), 3, '0') AS VARCHAR) AS sku, " +
    'CAST(i AS DOUBLE) AS amount, ' +
    "CAST('g' || CAST(i % 3 AS VARCHAR) AS VARCHAR) AS region, " +
    "CAST(DATE '2025-01-01' + CAST(i - 1 AS INTEGER) AS DATE) AS day " +
    'FROM range(1, 261) t(i)';
  /** A NULL company and the literal string 'null' must stay separate groups. */
  const categoriesSql =
    'CREATE TABLE uploaded_data AS SELECT * FROM (VALUES ' +
    "(CAST(NULL AS VARCHAR), CAST(10 AS DOUBLE), CAST(5 AS DOUBLE), CAST(DATE '2025-01-05' AS DATE)), " +
    "(CAST('null' AS VARCHAR), 20, 0, DATE '2025-01-05'), " +
    "(CAST('A' AS VARCHAR), 30, 3, DATE '2025-01-06'), " +
    "(CAST(NULL AS VARCHAR), 40, 5, DATE '2025-01-06'), " +
    "(CAST('Z' AS VARCHAR), 0, 0, DATE '2025-01-06')" +
    ') t(company, amount, weight, day)';
  const plainSql =
    'CREATE TABLE uploaded_data AS SELECT * FROM (VALUES ' +
    "(CAST('A' AS VARCHAR), CAST(10 AS DOUBLE)), (CAST('B' AS VARCHAR), 20)" +
    ') t(company, amount)';
  /** Source columns intentionally reuse the internal alias names of the segment SQL. */
  const collisionSql =
    'CREATE TABLE uploaded_data AS SELECT * FROM (VALUES ' +
    "(CAST('x' AS VARCHAR), CAST(10 AS DOUBLE), CAST(1 AS DOUBLE)), " +
    "(CAST('y' AS VARCHAR), 20, 2), " +
    "(CAST('x' AS VARCHAR), 5, 3)" +
    ') t(__vm_seg_dim, __vm_seg_m0, __vm_seg_k0)';
  /** One row has no timestamp, so its bucket must never surface as the string 'null'. */
  const nullDaySql =
    'CREATE TABLE uploaded_data AS SELECT * FROM (VALUES ' +
    "(CAST('A' AS VARCHAR), CAST(10 AS DOUBLE), CAST(DATE '2025-01-05' AS DATE)), " +
    "(CAST('B' AS VARCHAR), 20, CAST(NULL AS DATE))" +
    ') t(company, amount, day)';

  const metric = (id: number, label: string, fields: any, databaseId: number) => ({
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
      ...(fields.scale !== undefined ? { scale: fields.scale } : {}),
    }),
    useYn: 'Y',
  });

  const previousRoot = process.env.FILE_UPLOAD_DIR;
  let root: string;
  let worker: DuckDBService;
  let service: BiSegmentService;
  let connection: ConnectionService;
  let metrics: any[];
  let sources: any[];
  let databaseRepo: any;
  const files: Record<number, string> = {};

  const writeSource = async (sql: string) => {
    const directory = path.join(root, randomUUID());
    fs.mkdirSync(directory, { recursive: true });
    const filename = path.join(directory, 'data.duckdb');
    const instance = await DuckDBInstance.create(filename, { access_mode: 'READ_WRITE' });
    const session = await instance.connect();
    await session.run(sql);
    await session.run('CHECKPOINT');
    session.closeSync();
    instance.closeSync();
    return filename;
  };

  /** Odd sources keep a placeholder revision so ownership and type rejections stay the subject. */
  const revision = async (sourceId = 1) => {
    const source = sources.find(candidate => candidate.id === sourceId);
    if (!source || source.engine !== 'duckdb') return 'f'.repeat(64);
    return connection.duckDBVersion(sourceId);
  };

  beforeAll(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'vm-bi-segment-'));
    process.env.FILE_UPLOAD_DIR = root;
    worker = new DuckDBService();
    // The margin fixture is loaded through the real CSV import path, quotes included.
    const margin = studioDemoData('margin');
    const imported = await worker.importFile({
      originalname: margin.filename,
      buffer: margin.csv,
    });
    files[1] = imported.filename;
    files[2] = await writeSource(bulkSql);
    files[3] = await writeSource(categoriesSql);
    files[4] = await writeSource(plainSql);
    files[5] = await writeSource(plainSql);
    files[6] = await writeSource(collisionSql);
    files[7] = await writeSource(nullDaySql);
    files[9] = await writeSource(bulkSql);
  });

  afterAll(async () => {
    await worker?.onModuleDestroy();
    if (root) fs.rmSync(root, { recursive: true, force: true });
    if (previousRoot === undefined) delete process.env.FILE_UPLOAD_DIR;
    else process.env.FILE_UPLOAD_DIR = previousRoot;
  });

  beforeEach(() => {
    metrics = [
      metric(
        1,
        '매출',
        { aggregation: 'SUM', column: 'revenue', unit: 'USD', decimalPlaces: 2 },
        1,
      ),
      metric(2, '비용', { aggregation: 'SUM', column: 'cost', unit: 'USD', decimalPlaces: 2 }, 1),
      metric(3, '이익', { aggregation: 'SUM', column: 'profit', unit: 'USD', decimalPlaces: 2 }, 1),
      metric(
        4,
        '마진율',
        {
          aggregation: 'RATIO_SUM',
          column: 'profit',
          denominatorColumn: 'revenue',
          scale: 1,
          decimalPlaces: 4,
        },
        1,
      ),
      metric(5, '건수', { aggregation: 'COUNT', column: '*' }, 1),
      metric(
        11,
        '금액',
        { aggregation: 'SUM', column: 'amount', unit: 'USD', decimalPlaces: 2 },
        2,
      ),
      metric(12, '건수', { aggregation: 'COUNT', column: '*' }, 2),
      metric(21, '금액', { aggregation: 'SUM', column: 'amount', decimalPlaces: 2 }, 3),
      metric(
        22,
        '비중',
        {
          aggregation: 'RATIO_SUM',
          column: 'amount',
          denominatorColumn: 'weight',
          scale: 1,
          decimalPlaces: 4,
        },
        3,
      ),
      metric(23, '건수', { aggregation: 'COUNT', column: '*' }, 3),
      metric(31, '금액', { aggregation: 'SUM', column: 'amount', decimalPlaces: 2 }, 4),
      metric(61, '충돌측정', { aggregation: 'SUM', column: '__vm_seg_m0', decimalPlaces: 2 }, 6),
      metric(71, '금액', { aggregation: 'SUM', column: 'amount', decimalPlaces: 2 }, 7),
    ];
    sources = [
      { id: 1, name: 'Margin', engine: 'duckdb', ownerId: 10 },
      { id: 2, name: 'Bulk', engine: 'duckdb', ownerId: 10 },
      { id: 3, name: 'Categories', engine: 'duckdb', ownerId: 10 },
      { id: 4, name: 'Plain', engine: 'duckdb', ownerId: 10 },
      { id: 5, name: 'Legacy', engine: 'sqlite', ownerId: 10 },
      { id: 6, name: 'Collision', engine: 'duckdb', ownerId: 10 },
      { id: 7, name: 'NullDay', engine: 'duckdb', ownerId: 10 },
      { id: 9, name: 'Foreign', engine: 'duckdb', ownerId: 99 },
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
            connection: { filename: files[source.id] },
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
    const db: any = {
      options: { type: 'sqlite' },
      getRepository: jest.fn((entity: any) => {
        if (entity === Database) return databaseRepo;
        if (entity === Metric) return metricRepo;
        throw new Error('unexpected repository');
      }),
    };
    db.manager = db;
    databaseRepo.manager = { connection: db };
    connection = new ConnectionService(databaseRepo, {} as any, worker);
    const bi = new BiService(db as any, new SourceAccessService(db as any), connection, {
      save: jest.fn(),
    } as any);
    service = new BiSegmentService(bi, connection);
  });

  const valid = async (extra: any = {}) => {
    const sourceId = extra.sourceId === undefined ? 1 : extra.sourceId;
    return {
      sourceId,
      sourceRevision: await revision(sourceId),
      dimensionColumn: 'company',
      measureIds: [1],
      conditions: [{ measureId: 1, operator: 'gte', value: 1 }],
      ...extra,
    };
  };

  const kpiValue = (result: any, id: number) => {
    const kpi = result.kpis.find((candidate: any) => candidate.id === id);
    if (!kpi) throw new Error('missing kpi ' + id);
    return kpi.value;
  };

  it('returns qualified groups, canonical KPIs, trends and details for the margin fixture', async () => {
    const result = await service.segments(
      await valid({
        measureIds: [1, 2, 3, 4, 5],
        conditions: [{ measureId: 1, operator: 'gte', value: 1000 }],
      }),
      actor,
    );
    expect(result.sourceRevision).toMatch(revision64);
    expect(result.scope).toEqual({
      dimensionColumn: 'company',
      conditions: [{ measureId: 1, operator: 'gte', value: 1000 }],
      filters: [],
      totalGroups: '4',
      rows: '14',
    });
    // Six companies exist; two of them fall below the aggregate threshold.
    expect(result.kpis.map((kpi: any) => kpi.id)).toEqual([1, 2, 3, 4, 5]);
    expect(result.kpis[0]).toMatchObject({ id: 1, label: '매출', unit: 'USD', decimalPlaces: 2 });
    expect(Number(kpiValue(result, 1))).toBeCloseTo(14057.4, 6);
    expect(Number(kpiValue(result, 2))).toBeCloseTo(11545.86, 6);
    expect(Number(kpiValue(result, 3))).toBeCloseTo(2511.54, 6);
    // Grand margin is the canonical ratio of the qualified totals, not a mean of group ratios.
    expect(Number(kpiValue(result, 4))).toBeCloseTo(0.17866319518545, 9);
    expect(Number(kpiValue(result, 5))).toBe(14);
    expect(result.groupsTruncated).toBe(false);
    expect(result.groups.map((group: any) => group.category)).toEqual([
      'Cheonji Retail',
      'Hanul Foods',
      'Samil Trading, Inc.',
      'Baro Tech',
    ]);
    expect(result.groups[0].values.map((value: any) => value.id)).toEqual([1, 2, 3, 4, 5]);
    expect(Number(result.groups[0].values[0].value)).toBeCloseTo(6750.65, 6);
    expect(Number(result.groups[0].values[2].value)).toBeCloseTo(1763.65, 6);
    // The grouped COUNT covers every source row of that company, not only one bucket.
    expect(Number(result.groups[0].values[4].value)).toBe(4);
    expect(result.time).toEqual({ column: 'day', grain: 'day', timeZone: 'UTC' });
    expect(result.trendsTruncated).toBe(false);
    expect(result.trends).toHaveLength(12);
    expect(result.trends[0].time).toBe('2025-01-06');
    expect(result.trends[0].values.map((value: any) => value.id)).toEqual([1, 2, 3, 4, 5]);
    expect(Number(result.trends[0].values[0].value)).toBeCloseTo(1200, 9);
    expect(Number(result.trends[0].values[3].value)).toBeCloseTo(0.25, 9);
    expect(Number(result.trends[0].values[4].value)).toBe(1);
    // 2025-01-15 aggregates two qualified rows, so its ratio is not one row's ratio.
    const twoRows = result.trends.find((trend: any) => trend.time === '2025-01-15');
    expect(Number(twoRows.values[0].value)).toBeCloseTo(530.75, 6);
    expect(Number(twoRows.values[3].value)).toBeCloseTo(0.1369571, 6);
    expect(Number(twoRows.values[4].value)).toBe(2);
    expect(result.details).toMatchObject({ totalRows: '14', page: 0, pageSize: 25 });
    expect(result.details.rows).toHaveLength(14);
    expect(Object.keys(result.details.rows[0])).toEqual(MARGIN_COLUMNS);
    expect([...new Set(result.details.rows.map((row: any) => row.company))].sort()).toEqual([
      'Baro Tech',
      'Cheonji Retail',
      'Hanul Foods',
      'Samil Trading, Inc.',
    ]);
    // Query results carry a view identity for bounded CSV export, without saved views/Pivot.
    expect(Object.keys(result).sort()).toEqual([
      'details',
      'groups',
      'groupsTruncated',
      'kpis',
      'scope',
      'sourceRevision',
      'time',
      'trends',
      'trendsTruncated',
      'viewRevision',
    ]);
  });

  it('requires every aggregated condition to hold at the same time', async () => {
    const single = await service.segments(
      await valid({
        measureIds: [1, 3],
        conditions: [{ measureId: 1, operator: 'gte', value: 1000 }],
      }),
      actor,
    );
    expect(single.scope.totalGroups).toBe('4');
    const both = await service.segments(
      await valid({
        measureIds: [1, 3],
        conditions: [
          { measureId: 1, operator: 'gte', value: 1000 },
          { measureId: 3, operator: 'gt', value: 100 },
        ],
      }),
      actor,
    );
    expect(both.scope.totalGroups).toBe('3');
    expect(both.scope.rows).toBe('10');
    expect(Number(kpiValue(both, 1))).toBeCloseTo(12886.15, 6);
    expect(Number(kpiValue(both, 3))).toBeCloseTo(2460.75, 6);
    expect(both.groups.map((group: any) => group.category)).toEqual([
      'Cheonji Retail',
      'Hanul Foods',
      'Samil Trading, Inc.',
    ]);
    // The dropped group is the one that failed the second rule only.
    expect(single.groups.map((group: any) => group.category)).toContain('Baro Tech');
  });

  it('reapplies qualification from the current filtered period on every call', async () => {
    const all = await service.segments(
      await valid({
        measureIds: [1, 3],
        conditions: [{ measureId: 1, operator: 'gte', value: 1000 }],
      }),
      actor,
    );
    const windowed = await service.segments(
      await valid({
        measureIds: [1, 3],
        conditions: [{ measureId: 1, operator: 'gte', value: 1000 }],
        dateRange: { column: 'day', start: '2025-01-13', end: '2025-01-19' },
      }),
      actor,
    );
    const production = await service.segments(
      await valid({
        measureIds: [1, 3],
        conditions: [{ measureId: 1, operator: 'gte', value: 1000 }],
        filters: [{ column: 'environment', values: ['production'] }],
      }),
      actor,
    );
    expect(all.scope).toMatchObject({ totalGroups: '4', rows: '14' });
    expect(windowed.scope).toMatchObject({ totalGroups: '3', rows: '6' });
    expect(windowed.scope.dateRange).toEqual({
      column: 'day',
      start: '2025-01-13',
      end: '2025-01-19',
    });
    expect(Number(kpiValue(windowed, 1))).toBeCloseTo(8475.9, 6);
    expect(Number(kpiValue(windowed, 3))).toBeCloseTo(1804.7, 6);
    expect(windowed.groups.map((group: any) => group.category)).toEqual([
      'Cheonji Retail',
      'Hanul Foods',
      'Samil Trading, Inc.',
    ]);
    expect(production.scope).toMatchObject({ totalGroups: '4', rows: '12' });
    expect(production.scope.filters).toEqual([{ column: 'environment', values: ['production'] }]);
    expect(Number(kpiValue(production, 1))).toBeCloseTo(14057.4, 6);
    expect(Number(kpiValue(production, 3))).toBeCloseTo(2721.54, 6);
    // Repeating the same request is stable and does not accumulate period state.
    const again = await service.segments(
      await valid({
        measureIds: [1, 3],
        conditions: [{ measureId: 1, operator: 'gte', value: 1000 }],
        dateRange: { column: 'day', start: '2025-01-13', end: '2025-01-19' },
      }),
      actor,
    );
    expect(again.groups).toEqual(windowed.groups);
    expect(again.kpis).toEqual(windowed.kpis);
  });

  it('keeps a NULL category separate from the string "null"', async () => {
    const result = await service.segments(
      await valid({
        sourceId: 3,
        dimensionColumn: 'company',
        measureIds: [21, 23],
        conditions: [{ measureId: 21, operator: 'gte', value: 1 }],
      }),
      actor,
    );
    expect(result.scope.totalGroups).toBe('3');
    expect(result.groups.map((group: any) => group.category)).toEqual([null, 'A', 'null']);
    expect(result.groups[0].category).toBeNull();
    expect(result.groups[1].category).toBe('A');
    expect(result.groups[2].category).toBe('null');
    expect(Number(result.groups[0].values[0].value)).toBeCloseTo(50, 9);
    expect(Number(result.groups[2].values[0].value)).toBeCloseTo(20, 9);
    expect(Number(kpiValue(result, 21))).toBeCloseTo(100, 9);
    expect(Number(kpiValue(result, 23))).toBe(4);
  });

  it('excludes a group whose compared ratio is NULL instead of treating it as zero', async () => {
    const ratio = await service.segments(
      await valid({
        sourceId: 3,
        dimensionColumn: 'company',
        measureIds: [22, 23],
        conditions: [{ measureId: 22, operator: 'gte', value: 0 }],
      }),
      actor,
    );
    // 'null' and 'Z' divide by a zero denominator, so NULL excludes them from every comparison.
    expect(ratio.scope.totalGroups).toBe('2');
    expect(ratio.groups.map((group: any) => group.category)).toEqual(['A', null]);
    expect(Number(kpiValue(ratio, 22))).toBeCloseTo(6.153846153846154, 9);
    expect(Number(kpiValue(ratio, 23))).toBe(3);
    const sum = await service.segments(
      await valid({
        sourceId: 3,
        dimensionColumn: 'company',
        measureIds: [21, 23],
        conditions: [{ measureId: 21, operator: 'gte', value: 0 }],
      }),
      actor,
    );
    // A plain sum comparison still keeps the zero-valued group.
    expect(sum.scope.totalGroups).toBe('4');
    expect(sum.groups.map((group: any) => group.category)).toContain('Z');
  });

  it('reports zero groups with a count of 0 and a NULL sum when nothing qualifies', async () => {
    const result = await service.segments(
      await valid({
        measureIds: [1, 5],
        conditions: [{ measureId: 1, operator: 'gt', value: 1000000 }],
      }),
      actor,
    );
    expect(result.scope).toMatchObject({ totalGroups: '0', rows: '0' });
    expect(result.groups).toEqual([]);
    expect(result.groupsTruncated).toBe(false);
    expect(kpiValue(result, 1)).toBeNull();
    expect(kpiValue(result, 5)).toBe(0);
    expect(result.details).toMatchObject({ rows: [], totalRows: '0', page: 0, pageSize: 25 });
    expect(result.trends).toEqual([]);
    expect(result.trendsTruncated).toBe(false);
    expect(result.time).toEqual({ column: 'day', grain: 'day', timeZone: 'UTC' });
  });

  it('truncates group rows at 50 without truncating the exact totals', async () => {
    const result = await service.segments(
      await valid({
        sourceId: 2,
        dimensionColumn: 'sku',
        measureIds: [11, 12],
        conditions: [{ measureId: 12, operator: 'gte', value: 1 }],
      }),
      actor,
    );
    expect(result.scope).toMatchObject({ totalGroups: '260', rows: '260' });
    expect(result.groups).toHaveLength(50);
    expect(result.groupsTruncated).toBe(true);
    expect(result.groups[0].category).toBe('sku-260');
    expect(Number(result.groups[0].values[0].value)).toBeCloseTo(260, 9);
    // Totals come from the reaggregated scope, so a truncated list changes nothing here.
    expect(Number(kpiValue(result, 11))).toBeCloseTo(33930, 6);
    expect(Number(kpiValue(result, 12))).toBe(260);
    expect(result.details.totalRows).toBe('260');
  });

  it('caps trends at 200 points and reports truncation', async () => {
    const daily = await service.segments(
      await valid({
        sourceId: 2,
        dimensionColumn: 'sku',
        measureIds: [11],
        conditions: [{ measureId: 11, operator: 'gte', value: 1 }],
      }),
      actor,
    );
    expect(daily.trendsTruncated).toBe(true);
    expect(daily.trends).toHaveLength(200);
    expect(daily.trends[0].time).toBe('2025-01-01');
    expect(daily.trends[199].time).toBe('2025-07-19');
    expect(daily.time).toEqual({ column: 'day', grain: 'day', timeZone: 'UTC' });
    // Truncation must not change the untouched group scope.
    expect(daily.scope.totalGroups).toBe('260');
    const monthly = await service.segments(
      await valid({
        sourceId: 2,
        dimensionColumn: 'sku',
        measureIds: [11],
        conditions: [{ measureId: 11, operator: 'gte', value: 1 }],
        trendGrain: 'month',
      }),
      actor,
    );
    expect(monthly.time).toEqual({ column: 'day', grain: 'month', timeZone: 'UTC' });
    expect(monthly.trendsTruncated).toBe(false);
    expect(monthly.trends).toHaveLength(9);
    expect(monthly.trends[0].time).toBe('2025-01-01');
    expect(monthly.trends[8].time).toBe('2025-09-01');
  });

  it('returns no trend series when the source has no temporal column', async () => {
    const result = await service.segments(
      await valid({
        sourceId: 4,
        dimensionColumn: 'company',
        measureIds: [31],
        conditions: [{ measureId: 31, operator: 'gte', value: 1 }],
      }),
      actor,
    );
    expect(result.time).toBeNull();
    expect(result.trends).toEqual([]);
    expect(result.trendsTruncated).toBe(false);
    expect(Number(kpiValue(result, 31))).toBeCloseTo(30, 9);
  });

  it('keeps source columns named like the internal aliases unambiguous', async () => {
    const result = await service.segments(
      await valid({
        sourceId: 6,
        dimensionColumn: '__vm_seg_dim',
        measureIds: [61],
        conditions: [{ measureId: 61, operator: 'gte', value: 1 }],
      }),
      actor,
    );
    expect(result.scope).toMatchObject({
      dimensionColumn: '__vm_seg_dim',
      totalGroups: '2',
      rows: '3',
    });
    expect(Number(kpiValue(result, 61))).toBeCloseTo(35, 9);
    expect(result.groups.map((group: any) => group.category)).toEqual(['y', 'x']);
    expect(result.groups.map((group: any) => Number(group.values[0].value))).toEqual([20, 15]);
    expect(result.details.totalRows).toBe('3');
    expect(result.time).toBeNull();
  });

  it('never reports a NULL timestamp bucket as a trend point', async () => {
    const result = await service.segments(
      await valid({
        sourceId: 7,
        dimensionColumn: 'company',
        measureIds: [71],
        conditions: [{ measureId: 71, operator: 'gte', value: 1 }],
      }),
      actor,
    );
    expect(result.scope).toMatchObject({ totalGroups: '2', rows: '2' });
    expect(Number(kpiValue(result, 71))).toBeCloseTo(30, 9);
    expect(result.time).toEqual({ column: 'day', grain: 'day', timeZone: 'UTC' });
    expect(result.trends).toHaveLength(1);
    expect(result.trends[0].time).toBe('2025-01-05');
    expect(Number(result.trends[0].values[0].value)).toBeCloseTo(10, 9);
  });

  it('rejects malformed segment requests', async () => {
    const cases: Array<[string, any]> = [
      ['unknown field', { comparePrevious: true }],
      ['unknown trend field', { includeTrends: true }],
      ['missing revision', { sourceRevision: undefined }],
      ['no measures', { measureIds: [] }],
      ['too many measures', { measureIds: [1, 2, 3, 4, 5, 6, 7] }],
      ['duplicate measure', { measureIds: [1, 1] }],
      ['no conditions', { conditions: [] }],
      [
        'too many conditions',
        {
          conditions: [
            { measureId: 1, operator: 'gte', value: 1 },
            { measureId: 1, operator: 'gte', value: 1 },
            { measureId: 1, operator: 'gte', value: 1 },
            { measureId: 1, operator: 'gte', value: 1 },
          ],
        },
      ],
      [
        'condition outside the selected measures',
        { conditions: [{ measureId: 3, operator: 'gte', value: 1 }] },
      ],
      ['invalid operator', { conditions: [{ measureId: 1, operator: 'like', value: 1 }] }],
      [
        'non finite condition value',
        { conditions: [{ measureId: 1, operator: 'gte', value: Number.NaN }] },
      ],
      [
        'unknown condition field',
        { conditions: [{ measureId: 1, operator: 'gte', value: 1, column: 'revenue' }] },
      ],
      ['unknown dimension column', { dimensionColumn: 'nope' }],
      ['missing dimension column', { dimensionColumn: '' }],
      ['negative page', { page: -1 }],
      ['page out of range', { page: 10001 }],
      ['page size zero', { pageSize: 0 }],
      ['page size too large', { pageSize: 51 }],
      ['invalid trend grain', { trendGrain: 'hour' }],
      [
        'too many filters',
        {
          filters: Array.from({ length: 6 }, (_unused, index) => ({
            column: 'company',
            values: ['c' + index],
          })),
        },
      ],
      [
        'date range on a non temporal column',
        { dateRange: { column: 'company', start: '2025-01-01', end: '2025-01-02' } },
      ],
      [
        'reversed date range',
        { dateRange: { column: 'day', start: '2025-01-19', end: '2025-01-13' } },
      ],
      [
        'unknown measure id',
        { measureIds: [999], conditions: [{ measureId: 999, operator: 'gte', value: 1 }] },
      ],
    ];
    for (const [label, extra] of cases) {
      let thrown: unknown;
      try {
        await service.segments(await valid(extra), actor);
      } catch (error) {
        thrown = error;
      }
      expect([label, thrown instanceof BadRequestException]).toEqual([label, true]);
    }
  });

  it('rejects a foreign source, a stale revision and a non-DuckDB source', async () => {
    await expect(service.segments(await valid({ sourceId: 9 }), actor)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(
      service.segments(await valid({ sourceRevision: 'f'.repeat(64) }), actor),
    ).rejects.toBeInstanceOf(ConflictException);
    // The legacy source is owned by the actor but is not a managed DuckDB file.
    await expect(
      service.segments({ ...(await valid()), sourceId: 5 }, actor),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.segments(await valid({ sourceId: 404 }), actor)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('serves POST /bi/explore/segments through the SUCCESS envelope', async () => {
    const calls: any[] = [];
    const stub = {
      segments: jest.fn(async (body: any, who: number) => {
        calls.push([body, who]);
        return { ok: true };
      }),
    };
    const controller = new BiSegmentController(stub as any);
    const response = await controller.segments({ sourceId: 1 }, {
      user: { accessKeyData: { id: 7 } },
    } as any);
    expect(response).toEqual({ status: 'SUCCESS', data: { ok: true } });
    expect(calls).toEqual([[{ sourceId: 1 }, 7]]);
    expect(Reflect.getMetadata('path', BiSegmentController)).toBe('bi/explore');
    expect(Reflect.getMetadata('method', BiSegmentController.prototype.segments)).toBe(1);
    expect(Reflect.getMetadata('path', BiSegmentController.prototype.segments)).toBe('segments');
  });
  it('exports applied aggregate scope with exact values and rejects changed metric definitions', async () => {
    const query = await valid({
      measureIds: [1, 4],
      conditions: [
        { measureId: 1, operator: 'gte', value: 1000 },
        { measureId: 4, operator: 'lt', value: 0.2 },
      ],
    });
    const shown = await service.segments(query, actor);
    expect((shown as any).viewRevision).toMatch(revision64);
    const exported = await (service as any).exportCsv(
      { ...query, viewRevision: (shown as any).viewRevision },
      actor,
    );
    expect(exported.mimeType).toBe('text/csv;charset=utf-8');
    expect(exported.csv).toContain('Hanul Foods');
    expect(exported.csv).toContain('5431.25');
    expect(exported.csv).toContain('conditions');
    expect(exported.csv).toContain('groupsTruncated');
    expect(exported.csv).not.toContain('Cheonji Retail');
    expect(exported.bytes).toBe(Buffer.byteLength(exported.csv, 'utf8'));
    expect(exported.viewRevision).toBe((shown as any).viewRevision);
    const record = metrics.find(metric => metric.id === 1);
    record.definition = JSON.stringify({ ...JSON.parse(record.definition), column: 'cost' });
    await expect(
      (service as any).exportCsv({ ...query, viewRevision: (shown as any).viewRevision }, actor),
    ).rejects.toBeInstanceOf(ConflictException);
  });
  it('requires the applied view and retains display truncation metadata in exports', async () => {
    const query = await valid({
      sourceId: 2,
      dimensionColumn: 'sku',
      measureIds: [11],
      conditions: [{ measureId: 11, operator: 'gte', value: 1 }],
    });
    const shown = await service.segments(query, actor);
    const exported = await (service as any).exportCsv(
      { ...query, viewRevision: (shown as any).viewRevision },
      actor,
    );
    expect(exported.csv).toContain('260');
    expect(exported.csv).toContain('groupsTruncated');
    expect(exported.csv).toContain('true');
    expect(exported.csv).not.toContain('sku-001');
    await expect((service as any).exportCsv(query, actor)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      (service as any).exportCsv(
        { ...query, viewRevision: (shown as any).viewRevision, sourceRevision: 'stale' },
        actor,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      (service as any).exportCsv({ ...query, viewRevision: (shown as any).viewRevision }, 99),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('rejects definition changes during a segment execution and scope changes before export', async () => {
    const query = await valid();
    const shown = await service.segments(query, actor);
    await expect(
      service.exportCsv(
        {
          ...query,
          viewRevision: shown.viewRevision,
          conditions: [{ measureId: 1, operator: 'gt', value: 1000 }],
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    const original = connection.queryDuckDB.bind(connection);
    const spy = jest
      .spyOn(connection, 'queryDuckDB')
      .mockImplementationOnce(async (...args: Parameters<ConnectionService['queryDuckDB']>) => {
        const rows = await original(...args);
        const record = metrics.find(metric => metric.id === 1);
        record.definition = JSON.stringify({ ...JSON.parse(record.definition), column: 'cost' });
        return rows;
      });
    await expect(service.segments(query, actor)).rejects.toBeInstanceOf(ConflictException);
    spy.mockRestore();
  });
  it('does not fetch raw detail rows when exporting aggregates', async () => {
    const query = await valid();
    const shown = await service.segments(query, actor);
    const spy = jest.spyOn(connection, 'queryDuckDB');
    await service.exportCsv({ ...query, viewRevision: shown.viewRevision }, actor);
    expect(spy.mock.calls.some(call => String(call[1]).includes('__vm_detail_'))).toBe(false);
    spy.mockRestore();
  });
  it('pivots only the qualified rows with canonical row/column/grand ratios', async () => {
    const query = await valid({
      measureIds: [1, 4],
      conditions: [
        { measureId: 1, operator: 'gte', value: 1000 },
        { measureId: 4, operator: 'lt', value: 0.2 },
      ],
      pivotColumn: 'component',
    });
    const result: any = await service.segments(query, actor);
    expect(result.pivot.column).toBe('component');
    expect(result.pivot.columns.map(c => c.value)).toEqual(['Compute', 'Storage']);
    const hanul = result.pivot.rows.find(r => r.category === 'Hanul Foods');
    const compute = hanul.cells.find(c => c.column === 'Compute');
    expect(Number(compute.values[0].value)).toBeCloseTo(3460, 8);
    expect(Number(compute.values[1].value)).toBeCloseTo(442 / 3460, 10);
    expect(Number(result.pivot.columns[0].totals[0].value)).toBeCloseTo(4100.5, 8);
    expect(Number(result.pivot.columns[0].totals[1].value)).toBeCloseTo(360.1 / 4100.5, 10);
    expect(Number(result.kpis[1].value)).toBeCloseTo(292.79 / 5431.25, 10);
    const csv = await service.exportCsv({ ...query, viewRevision: result.viewRevision }, actor);
    expect(csv.csv).toContain('pivot_cell');
    expect(csv.csv).toContain('pivot_column_total');
    await expect(
      service.segments({ ...query, pivotColumn: 'company' }, actor),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.segments({ ...query, pivotColumn: 'revenue' }, actor),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
  it('drills a cell after qualification, returns exact canonical totals and pages only those rows', async () => {
    const query = await valid({
      measureIds: [1, 3, 4],
      conditions: [
        { measureId: 1, operator: 'gte', value: 1000 },
        { measureId: 4, operator: 'lt', value: 0.2 },
      ],
      pivotColumn: 'component',
    });
    const shown = await service.segments(query, actor);
    const spy = jest.spyOn(connection, 'queryDuckDB');
    const detail = await service.details(
      {
        ...query,
        viewRevision: shown.viewRevision,
        selection: { row: 'Baro Tech', column: 'Compute' },
        pageSize: 2,
      },
      actor,
    );
    expect(detail.selection).toEqual({ row: 'Baro Tech', column: 'Compute' });
    expect(detail.viewRevision).toBe(shown.viewRevision);
    expect(detail.details).toMatchObject({ totalRows: '3', page: 0, pageSize: 2 });
    expect(detail.details.rows).toHaveLength(2);
    expect(
      detail.details.rows.every(row => row.company === 'Baro Tech' && row.component === 'Compute'),
    ).toBe(true);
    expect(Number(detail.kpis.find(m => m.id === 1).value)).toBeCloseTo(640.5, 9);
    expect(Number(detail.kpis.find(m => m.id === 3).value)).toBeCloseTo(-81.9, 9);
    expect(Number(detail.kpis.find(m => m.id === 4).value)).toBeCloseTo(-81.9 / 640.5, 10);
    expect(spy.mock.calls.some(call => String(call[1]).includes('date_trunc'))).toBe(false);
    expect(spy.mock.calls.some(call => String(call[1]).includes('__vm_cell_'))).toBe(false);
    spy.mockRestore();
    const next = await service.details(
      {
        ...query,
        viewRevision: shown.viewRevision,
        selection: { row: 'Baro Tech', column: 'Compute' },
        pageSize: 2,
        page: 1,
      },
      actor,
    );
    expect(next.details.rows).toHaveLength(1);
    expect(
      new Set([...detail.details.rows, ...next.details.rows].map(r => JSON.stringify(r))).size,
    ).toBe(3);
    const column = await service.details(
      { ...query, viewRevision: shown.viewRevision, selection: { column: 'Compute' } },
      actor,
    );
    expect(column.details.totalRows).toBe('6');
    expect(Number(column.kpis[0].value)).toBeCloseTo(4100.5, 9);
    const absent = await service.details(
      { ...query, viewRevision: shown.viewRevision, selection: { row: 'not a qualified company' } },
      actor,
    );
    expect(absent.details.totalRows).toBe('0');
    expect(absent.details.rows).toEqual([]);
    const grand = await service.details(
      { ...query, viewRevision: shown.viewRevision, selection: {} },
      actor,
    );
    expect(grand.details.totalRows).toBe('8');
    expect(Number(grand.kpis[0].value)).toBeCloseTo(5431.25, 9);
    const sqlValue = await service.details(
      { ...query, viewRevision: shown.viewRevision, selection: { row: "Baro Tech' OR 1=1 --" } },
      actor,
    );
    expect(sqlValue.details.totalRows).toBe('0');
    for (const extra of [
      { selection: { arbitraryColumn: 'revenue' } },
      { selection: { row: {} } },
      { selection: null },
      { viewRevision: undefined },
    ])
      await expect(
        service.details(
          { ...query, viewRevision: shown.viewRevision, selection: {}, ...extra },
          actor,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.details({ ...query, viewRevision: 'f'.repeat(64), selection: {} }, actor),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      service.details(
        {
          ...query,
          conditions: [{ measureId: 1, operator: 'gte', value: 600 }],
          viewRevision: shown.viewRevision,
          selection: {},
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      service.details(
        { ...query, sourceId: 9, viewRevision: shown.viewRevision, selection: {} },
        actor,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    const original = metrics[0].definition;
    metrics[0].definition = JSON.stringify({ ...JSON.parse(original), column: 'cost' });
    await expect(
      service.details({ ...query, viewRevision: shown.viewRevision, selection: {} }, actor),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('bounds Pivot columns while calculating full column and grand totals', async () => {
    const result: any = await service.segments(
      await valid({
        sourceId: 2,
        dimensionColumn: 'region',
        measureIds: [11],
        conditions: [{ measureId: 11, operator: 'gte', value: 0 }],
        pivotColumn: 'sku',
      }),
      actor,
    );
    expect(result.pivot.columns).toHaveLength(20);
    expect(result.pivot.truncatedColumns).toBe(true);
    expect(result.pivot.rows).toHaveLength(3);
    expect(Number(result.kpis[0].value)).toBe(33930);
    expect(result.pivot.columns.reduce((a, c) => a + Number(c.totals[0].value), 0)).toBe(210);
  });
  it('keeps NULL row and column axes distinct from the literal null string', async () => {
    files[8] = await writeSource(
      categoriesSql.replace(
        'SELECT * FROM',
        "SELECT *, CASE WHEN company IS NULL THEN CAST(NULL AS VARCHAR) ELSE 'null' END AS split FROM",
      ),
    );
    sources.push({ id: 8, name: 'Null axes', engine: 'duckdb', ownerId: actor });
    metrics.push(metric(81, 'Amount', { aggregation: 'SUM', column: 'amount' }, 8));
    const result: any = await service.segments(
      await valid({
        sourceId: 8,
        dimensionColumn: 'company',
        measureIds: [81],
        conditions: [{ measureId: 81, operator: 'gte', value: 0 }],
        pivotColumn: 'split',
      }),
      actor,
    );
    const nullRow = result.pivot.rows.find(r => r.category === null),
      literalRow = result.pivot.rows.find(r => r.category === 'null');
    expect(nullRow.cells.find(c => c.column === null).values[0].value).toBe(50);
    expect(nullRow.cells.find(c => c.column === 'null').values[0].value).toBeNull();
    expect(literalRow.cells.find(c => c.column === 'null').values[0].value).toBe(20);
    expect(result.pivot.columns.map(c => c.value)).toEqual(['null', null]);
    const base = await valid({
      sourceId: 8,
      dimensionColumn: 'company',
      measureIds: [81],
      conditions: [{ measureId: 81, operator: 'gte', value: 0 }],
      pivotColumn: 'split',
    });
    const nullDetail = await service.details(
      { ...base, viewRevision: result.viewRevision, selection: { row: null, column: null } },
      actor,
    );
    expect(nullDetail.details.totalRows).toBe('2');
    expect(Number(nullDetail.kpis[0].value)).toBe(50);
    const literalDetail = await service.details(
      { ...base, viewRevision: result.viewRevision, selection: { row: 'null', column: 'null' } },
      actor,
    );
    expect(literalDetail.details.totalRows).toBe('1');
    expect(Number(literalDetail.kpis[0].value)).toBe(20);
    const emptyCell = await service.details(
      { ...base, viewRevision: result.viewRevision, selection: { row: null, column: 'null' } },
      actor,
    );
    expect(emptyCell.details.totalRows).toBe('0');
  });
  it('pins saved catalog revision before qualification and detects metric mutation during query', async () => {
    const bi = (service as any).bi;
    const explore = new BiExploreService(bi, {} as any, connection);
    const catalog = await explore.catalog({ sourceId: 1 }, actor);
    const input = await valid({ pivotColumn: 'component', catalogRevision: catalog.viewRevision });
    const shown = await service.segments(input, actor);
    expect(shown.pivot).toBeDefined();
    const original = metrics[0].definition;
    metrics[0].definition = JSON.stringify({ ...JSON.parse(original), label: 'Changed' });
    await expect(service.segments(input, actor)).rejects.toThrow(ConflictException);
    metrics[0].definition = original;
    const originalQuery = connection.queryDuckDB.bind(connection);
    let mutated = false;
    const spy = jest
      .spyOn(connection, 'queryDuckDB')
      .mockImplementation(async (id, sql, bindings) => {
        const rows = await originalQuery(id, sql, bindings);
        if (!mutated && sql.includes('scoped_rows')) {
          mutated = true;
          metrics[0].definition = JSON.stringify({
            ...JSON.parse(original),
            label: 'Changed during query',
          });
        }
        return rows;
      });
    await expect(service.segments(input, actor)).rejects.toThrow(ConflictException);
    expect(mutated).toBe(true);
    metrics[0].definition = original;
    mutated = false;
    await expect(
      service.details(
        {
          ...input,
          viewRevision: shown.viewRevision,
          selection: { row: 'Hanul Foods', column: 'Compute' },
        },
        actor,
      ),
    ).rejects.toThrow(ConflictException);
    expect(mutated).toBe(true);
    spy.mockRestore();
  });
});
