jest.mock('../ai/ai.service', () => ({ AiService: class {} }));
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DataSource } from 'typeorm';
import { DuckDBService } from '../analysis/duckdb.service';
import { AiDashboardService } from '../ai/ai-dashboard.service';
import { ConnectionService } from '../connection/connection.service';
import { SourceAccessService } from '../ownership/source-access.service';
import { Dashboard } from '../dashboard/entities/dashboard.entity';
import { Database } from '../database/entities/database.entity';
import { Metric } from '../metric/entities/metric.entity';
import { BiService } from './bi.service';
import { BiExploreService } from './bi-explore.service';

describe('UC052 Explore Pivot and private CSV actual DuckDB condition oracle', () => {
  let db: DataSource;
  let worker: DuckDBService;
  let root: string;
  let service: BiExploreService;
  let connection: ConnectionService;
  let revision: string;
  const uploadRoot = process.env.FILE_UPLOAD_DIR;
  const condition = () => ({
    sourceRevision: revision,
    definition: {
      include: {
        kind: 'group',
        operator: 'or',
        children: [
          { kind: 'predicate', column: 'region', operator: 'eq', values: ['A'] },
          { kind: 'predicate', column: 'channel', operator: 'eq', values: ['web'] },
        ],
      },
      exclude: { kind: 'predicate', column: 'amount', operator: 'gte', values: [90] },
    },
  });
  const query = () => ({
    sourceId: 1,
    sourceRevision: revision,
    measureIds: [1, 2],
    rankingMeasureId: 1,
    dimensionColumns: ['region'],
    conditions: condition(),
    dateRange: { column: 'day', start: '2026-01-03', end: '2026-01-04' },
    filters: [{ column: 'amount', range: { min: 15 } }],
    comparePrevious: true,
    includeRows: true,
  });
  const pivot = () => ({
    sourceId: 1,
    sourceRevision: revision,
    measureIds: [1, 2],
    rowColumns: ['region', 'channel'],
    columnColumns: ['day'],
    conditions: condition(),
    dateRange: { column: 'day', start: '2026-01-03', end: '2026-01-04' },
    filters: [{ column: 'amount', range: { min: 15 } }],
    comparePrevious: true,
    rowHierarchy: true,
  });
  beforeAll(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'uc052-explore-'));
    process.env.FILE_UPLOAD_DIR = root;
    worker = new DuckDBService();
    const file = await worker.importFile({
      originalname: 'oracle.csv',
      buffer: Buffer.from(
        'region,channel,amount,weight,day\nA,web,10,1,2026-01-01\nA,app,20,4,2026-01-02\nB,web,30,3,2026-01-02\nA,web,40,2,2026-01-03\nB,app,50,5,2026-01-03\nA,app,60,6,2026-01-04\nB,web,100,10,2026-01-04\n',
      ),
    });
    db = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      synchronize: true,
      entities: [Database, Metric, Dashboard],
    });
    await db.initialize();
    await db.manager.save(Database, {
      id: 1,
      ownerId: 7,
      name: 'Oracle',
      engine: 'duckdb',
      type: 'FILE',
      connectionConfig: JSON.stringify({
        client: 'duckdb',
        connection: { filename: file.filename },
      }),
    });
    for (const [id, label, aggregation, column, extra] of [
      [1, 'Revenue', 'SUM', 'amount', {}],
      [2, 'Ratio', 'RATIO_SUM', 'amount', { denominatorColumn: 'weight', scale: 1 }],
    ] as const) {
      await db.manager.save(Metric, {
        id,
        databaseId: 1,
        name: 'metric_' + id,
        tableName: 'uploaded_data',
        aggregation,
        expression: column,
        description: label,
        useYn: 'Y',
        definition: JSON.stringify({
          schemaVersion: 1,
          definitionVersion: 1,
          sourceId: 1,
          tableName: 'uploaded_data',
          label,
          unit: '',
          decimalPlaces: 4,
          numberNotation: 'plain',
          aggregation,
          column,
          ...extra,
        }),
      } as any);
    }
    connection = new ConnectionService(db.getRepository(Database), {} as any, worker);
    revision = await connection.duckDBVersion(1);
    expect(revision).toBe(createHash('sha256').update(file.filename).digest('hex'));
    const access = new SourceAccessService(db);
    const ai = new AiDashboardService({} as any, connection, db.getRepository(Dashboard), access);
    const bi = new BiService(db, access, connection, ai);
    service = new BiExploreService(bi, ai, connection);
  });
  afterAll(async () => {
    await worker?.onModuleDestroy();
    await db?.destroy();
    if (root) fs.rmSync(root, { recursive: true, force: true });
    if (uploadRoot === undefined) delete process.env.FILE_UPLOAD_DIR;
    else process.env.FILE_UPLOAD_DIR = uploadRoot;
  });
  it('scopes KPI, trends, rankings and raw detail with include/exclude AND filters/date', async () => {
    const result = await service.query(query(), 7);
    expect(result.kpis[0].value).toBe(100);
    expect(result.kpis[0].comparison).toMatchObject({ previousValue: 50, delta: 50 });
    expect(result.kpis[0].trend.points.map(p => p.value)).toEqual([40, 60]);
    expect(result.leaderboards[0].rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: 'A', value: 100, previousValue: 20 }),
        expect.objectContaining({ category: 'B', value: null, previousValue: 30 }),
      ]),
    );
    expect(result.details.totalRows).toBe('2');
    expect(result.details.rows.map(r => r.amount)).toEqual([60, 40]);
    expect(
      await service.values(
        {
          sourceId: 1,
          sourceRevision: revision,
          column: 'region',
          conditions: condition(),
          dateRange: query().dateRange,
        },
        7,
      ),
    ).toMatchObject({ values: ['A'] });
  });
  it('scopes advanced Pivot cells, hierarchy, both period totals and non-additive ratio', async () => {
    const result = await service.pivot(pivot(), 7);
    expect(result.grandTotal[0]).toMatchObject({ value: 100, comparison: { previousValue: 50 } });
    expect(result.grandTotal[1].value).toBe(12.5);
    expect(result.grandTotal[1].comparison.previousValue).toBeCloseTo(50 / 7);
    expect(result.rows).toEqual([
      ['A', 'app'],
      ['A', 'web'],
      ['B', 'web'],
    ]);
    expect(result.rowSubtotals.find(r => r.tuple[0] === 'A').measures[0].value).toBe(100);
    expect(result.rowSubtotals.find(r => r.tuple[0] === 'B').measures[0].value).toBeNull();
    expect(
      result.cells
        .filter(c => c.measures[0].value !== null)
        .map(c => c.measures[0].value)
        .sort(),
    ).toEqual([40, 60]);
  });
  it('scopes classic Pivot and flat advanced Pivot without changing baseline', async () => {
    const classic = await service.pivot(
      {
        sourceId: 1,
        sourceRevision: revision,
        measureIds: [1],
        rowDimensions: ['region'],
        columnDimensions: ['channel'],
        conditions: condition(),
      },
      7,
    );
    expect(classic.grandTotals).toEqual([160]);
    expect(classic.rows.map(r => r.values)).toEqual([['A'], ['B']]);
    const flat = await service.pivot({ ...pivot(), rowHierarchy: false, tableMode: 'flat' }, 7);
    expect(flat.grandTotal[0].value).toBe(100);
    const unscoped = await service.pivot(
      {
        sourceId: 1,
        sourceRevision: revision,
        measureIds: [1],
        rowColumns: ['region'],
        columnColumns: ['channel'],
      },
      7,
    );
    expect(unscoped.grandTotal[0].value).toBe(310);
  });
  it('private CSV includes canonical condition wrapper and scoped explore/pivot values; denies other actors', async () => {
    for (const mode of ['explore', 'pivot']) {
      const input = mode === 'explore' ? { ...query(), includeRows: false } : pivot();
      const output = await service.exportCsv({ mode, query: input }, 7);
      expect(output.csv).toContain('""field"":""conditions""');
      expect(output.csv).toContain('""sourceRevision"":""' + revision + '""');
      expect(output.csv).toContain('""exclude""');
      expect(output.csv).toContain('"100",number');
      expect(output.csv).not.toContain('"210",number');
      await expect(service.exportCsv({ mode, query: input }, 8)).rejects.toThrow();
    }
  });
  it('rejects stale file pin, invalid schema types, damaged wrappers and unknown condition columns', async () => {
    const bad = [
      { ...condition(), sourceRevision: 'b'.repeat(64) },
      null,
      { ...condition(), extra: true },
      {
        ...condition(),
        definition: {
          include: { kind: 'predicate', column: 'missing', operator: 'eq', values: ['A'] },
          exclude: null,
        },
      },
      {
        ...condition(),
        definition: {
          include: { kind: 'predicate', column: 'amount', operator: 'eq', values: ['40'] },
          exclude: null,
        },
      },
    ];
    for (const conditions of bad) {
      await expect(service.pivot({ ...pivot(), conditions }, 7)).rejects.toThrow();
      await expect(service.query({ ...query(), conditions }, 7)).rejects.toThrow();
      await expect(
        service.values({ sourceId: 1, sourceRevision: revision, column: 'region', conditions }, 7),
      ).rejects.toThrow();
    }
  });
});
