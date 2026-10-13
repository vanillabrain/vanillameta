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

describe('BiExploreService pivot over real DuckDB', () => {
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
    ['A', 'web', 12, 2, '2026-01-01'],
    ['A', 'web', 18, 4, '2026-01-01'],
    [null, 'web', 36, 6, '2026-01-01'],
    ['A', 'app', 20, 0, '2026-01-02'],
    ['B', 'app', 40, 5, '2026-01-02'],
    ['B', 'app', 50, 3, '2026-01-03'],
    ['C', 'app', 60, 1, '2026-01-03'],
    ['A', 'app', 70, 2, '2026-01-04'],
    ['D', 'bulk', 5, 0, '2026-01-04'],
  ];
  const mainSql =
    'CREATE TABLE uploaded_data AS SELECT ' +
    'CAST("column0" AS VARCHAR) AS region, CAST("column1" AS VARCHAR) AS channel, ' +
    'CAST("column2" AS DOUBLE) AS amount, CAST("column3" AS DOUBLE) AS weight, ' +
    'CAST("column4" AS DATE) AS day ' +
    'FROM (VALUES ' +
    mainRows.map(row).join(', ') +
    ') t(column0, column1, column2, column3, column4)';
  const gridSql =
    "CREATE TABLE uploaded_data AS SELECT 'r' || lpad(CAST(i AS VARCHAR), 2, '0') AS r, " +
    "'c' || lpad(CAST(j AS VARCHAR), 2, '0') AS c, CAST(i + j AS DOUBLE) AS amount, " +
    'CAST(j AS DOUBLE) AS weight FROM range(50) t(i), range(20) u(j)';
  const wideRowsSql =
    "CREATE TABLE uploaded_data AS SELECT 'r' || lpad(CAST(i AS VARCHAR), 2, '0') AS r, " +
    "'c' AS c, CAST(i AS DOUBLE) AS amount FROM range(51) t(i)";
  const wideColumnsSql =
    "CREATE TABLE uploaded_data AS SELECT 'r' AS r, 'c' || lpad(CAST(j AS VARCHAR), 2, '0') AS c, " +
    'CAST(j AS DOUBLE) AS amount FROM range(21) u(j)';

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

  const revision = async () => (await service.catalog({ sourceId: 1 }, actor)).sourceRevision;
  const pivot = async (input: any, who = actor): Promise<any> => service.pivot(input, who);
  const body = (sourceRevision: string, overrides: any = {}) => ({
    sourceId: 1,
    sourceRevision,
    measureIds: [1],
    rowColumns: ['region'],
    columnColumns: ['channel'],
    ...overrides,
  });
  const tupleIndex = (tuples: any[], tuple: unknown[]) =>
    tuples.findIndex(values => JSON.stringify(values) === JSON.stringify(tuple));
  const cellOf = (result: any, r: number, c: number) =>
    result.cells.find((cell: any) => cell.row === r && cell.column === c);
  const values = (measures: any[]) => measures.map(measure => measure.value);
  const at = (result: any, r: unknown[], c: unknown[]) =>
    cellOf(result, tupleIndex(result.rows, r), tupleIndex(result.columns, c)).measures;

  beforeAll(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'vm-bi-pivot-'));
    process.env.FILE_UPLOAD_DIR = root;
    worker = new DuckDBService();
    mainFile = await writeSource(mainSql);
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
      metric(1, 'Revenue', { aggregation: 'SUM', column: 'amount' }),
      metric(2, 'Orders', { aggregation: 'COUNT', column: '*' }),
      metric(3, 'Weighted', {
        aggregation: 'WEIGHTED_AVG',
        column: 'amount',
        weightColumn: 'weight',
      }),
      metric(4, 'Per weight', {
        aggregation: 'RATIO_SUM',
        column: 'amount',
        denominatorColumn: 'weight',
        scale: 1,
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

  it('groups two axes and reaggregates non-additive totals outside the cell grid', async () => {
    const result = await pivot(body(await revision(), { measureIds: [1, 4] }));
    expect(result.sourceId).toBe(1);
    expect(result.sourceRevision).toMatch(revision64);
    expect(result.rowColumns).toEqual(['region']);
    expect(result.columnColumns).toEqual(['channel']);
    // Deterministic ascending tuples; a null group keeps its place after every value.
    expect(result.rows).toEqual([['A'], ['B'], ['C'], ['D'], [null]]);
    expect(result.columns).toEqual([['app'], ['bulk'], ['web']]);
    expect(result.applied).toEqual({ filters: [], comparePrevious: false });
    expect(result.limits).toEqual({ rows: 50, columns: 20, cells: 6000 });
    // Every row x column pair is present, so a missing combination is an explicit null.
    expect(result.cells).toHaveLength(15);
    expect(values(at(result, ['A'], ['app']))).toEqual([90, 45]);
    expect(values(at(result, ['A'], ['bulk']))).toEqual([null, null]);
    expect(values(at(result, [null], ['web']))).toEqual([36, 6]);
    expect(values(at(result, ['D'], ['bulk']))).toEqual([5, null]);
    // Region A totals come from the raw rows: 120 / (2 + 4 + 0 + 2), not 45 + 5 from the cells.
    expect(values(result.rowTotals[tupleIndex(result.rows, ['A'])])).toEqual([120, 15]);
    expect(values(result.rowTotals[tupleIndex(result.rows, ['D'])])[1]).toBeNull();
    expect(values(result.columnTotals[tupleIndex(result.columns, ['app'])])[0]).toBe(240);
    expect(values(result.columnTotals[tupleIndex(result.columns, ['bulk'])])[1]).toBeNull();
    expect(values(result.columnTotals[tupleIndex(result.columns, ['web'])])).toEqual([66, 5.5]);
    expect(result.grandTotal.map((measure: any) => measure.measureId)).toEqual([1, 4]);
    expect(values(result.grandTotal)[0]).toBe(311);
    expect(values(result.grandTotal)[1]).toBeCloseTo(311 / 23, 10);
    // The grand ratio cannot be rebuilt by summing the row totals.
    const rowRatios = result.rowTotals.map((measures: any[]) => measures[1].value ?? 0);
    expect(rowRatios.reduce((sum: number, value: number) => sum + value, 0)).not.toBeCloseTo(
      311 / 23,
      10,
    );
    // A missing combination stays null instead of a fabricated zero.
    expect(
      result.cells.flatMap((cell: any) => cell.measures.map((m: any) => m.value)),
    ).not.toContain(0);
  });

  it('keeps weighted means canonical, including a null for a zero weight group', async () => {
    const result = await pivot(body(await revision(), { measureIds: [3] }));
    expect(at(result, ['A'], ['app'])[0].value).toBeCloseTo(70, 10);
    expect(at(result, [null], ['web'])[0].value).toBeCloseTo(36, 10);
    // Region D only holds weight 0, so its weighted mean is null instead of 0.
    expect(at(result, ['D'], ['bulk'])[0].value).toBeNull();
    expect(result.rowTotals[tupleIndex(result.rows, ['A'])][0].value).toBeCloseTo(29.5, 10);
    expect(result.rowTotals[tupleIndex(result.rows, ['B'])][0].value).toBeCloseTo(43.75, 10);
    expect(result.rowTotals[tupleIndex(result.rows, ['D'])][0].value).toBeNull();
    expect(result.columnTotals[tupleIndex(result.columns, ['web'])][0].value).toBeCloseTo(26, 10);
    expect(result.grandTotal[0].value).toBeCloseTo(862 / 23, 10);
  });

  it('splits multicolumn row and column tuples into cells, row totals and column totals', async () => {
    const sourceRevision = await revision();
    // Two columns on both axes: the grouped tuple is [region, channel] | [day, weight].
    const wide = await pivot(
      body(sourceRevision, {
        measureIds: [1, 2],
        rowColumns: ['region', 'channel'],
        columnColumns: ['day', 'weight'],
      }),
    );
    expect(wide.rows).toEqual([
      ['A', 'app'],
      ['A', 'web'],
      ['B', 'app'],
      ['C', 'app'],
      ['D', 'bulk'],
      [null, 'web'],
    ]);
    // A date stays text and a weight stays numeric inside the same tuple; null sorts last.
    expect(wide.columns).toEqual([
      ['2026-01-01', 2],
      ['2026-01-01', 4],
      ['2026-01-01', 6],
      ['2026-01-02', 0],
      ['2026-01-02', 5],
      ['2026-01-03', 1],
      ['2026-01-03', 3],
      ['2026-01-04', 0],
      ['2026-01-04', 2],
    ]);
    expect(wide.cells).toHaveLength(54);
    // Each fixture row is its own four-value combination, so the split must land on this slot.
    expect(values(at(wide, ['A', 'app'], ['2026-01-04', 2]))).toEqual([70, 1]);
    expect(values(at(wide, ['A', 'app'], ['2026-01-02', 0]))).toEqual([20, 1]);
    expect(values(at(wide, [null, 'web'], ['2026-01-01', 6]))).toEqual([36, 1]);
    expect(values(at(wide, ['B', 'app'], ['2026-01-04', 0]))).toEqual([null, null]);
    const present = wide.cells.filter((cell: any) => cell.measures[0].value !== null);
    expect(present).toHaveLength(9);
    expect(present.reduce((sum: number, cell: any) => sum + cell.measures[0].value, 0)).toBe(311);
    expect(wide.grandTotal.map((measure: any) => measure.value)).toEqual([311, 9]);
    // Row and column totals map onto the same tuple positions as the grid axes.
    expect(values(wide.rowTotals[tupleIndex(wide.rows, ['A', 'app'])])).toEqual([90, 2]);
    expect(values(wide.rowTotals[tupleIndex(wide.rows, ['A', 'web'])])).toEqual([30, 2]);
    expect(values(wide.rowTotals[tupleIndex(wide.rows, [null, 'web'])])).toEqual([36, 1]);
    expect(values(wide.columnTotals[tupleIndex(wide.columns, ['2026-01-01', 2])])).toEqual([12, 1]);
    expect(values(wide.columnTotals[tupleIndex(wide.columns, ['2026-01-04', 2])])).toEqual([70, 1]);
    expect(
      wide.columnTotals.reduce((sum: number, measures: any[]) => sum + measures[1].value, 0),
    ).toBe(9);

    // A single column axis keeps the same split for its three-value tuples.
    const narrow = await pivot(
      body(sourceRevision, {
        measureIds: [1, 2],
        rowColumns: ['region', 'channel'],
        columnColumns: ['day'],
      }),
    );
    expect(narrow.columns).toEqual([
      ['2026-01-01'],
      ['2026-01-02'],
      ['2026-01-03'],
      ['2026-01-04'],
    ]);
    expect(narrow.cells).toHaveLength(24);
    expect(values(at(narrow, ['A', 'app'], ['2026-01-02']))).toEqual([20, 1]);
    expect(values(at(narrow, ['B', 'app'], ['2026-01-03']))).toEqual([50, 1]);
    expect(values(at(narrow, ['A', 'app'], ['2026-01-01']))).toEqual([null, null]);
    expect(values(narrow.rowTotals[tupleIndex(narrow.rows, ['B', 'app'])])).toEqual([90, 2]);
    expect(values(narrow.columnTotals[tupleIndex(narrow.columns, ['2026-01-01'])])).toEqual([
      66, 3,
    ]);
    expect(values(narrow.grandTotal)).toEqual([311, 9]);
  });

  it('scopes filters, range filters and date ranges exactly like the aggregate query', async () => {
    const scoped = await pivot(
      body(await revision(), { filters: [{ column: 'channel', values: ['web'] }] }),
    );
    expect(scoped.rows).toEqual([['A'], [null]]);
    expect(scoped.columns).toEqual([['web']]);
    expect(scoped.cells.map((cell: any) => cell.measures[0].value)).toEqual([30, 36]);
    expect(scoped.rowTotals.map((measures: any[]) => measures[0].value)).toEqual([30, 36]);
    expect(values(scoped.grandTotal)).toEqual([66]);
    expect(scoped.applied.filters).toEqual([{ column: 'channel', values: ['web'] }]);

    const ranged = await pivot(
      body(await revision(), { filters: [{ column: 'amount', range: { min: 20, max: 60 } }] }),
    );
    expect(ranged.rows).toEqual([['A'], ['B'], ['C'], [null]]);
    expect(ranged.columns).toEqual([['app'], ['web']]);
    // 20 + 36 + 40 + 50 + 60: both range endpoints stay inclusive.
    expect(values(ranged.grandTotal)).toEqual([206]);

    const dated = await pivot(
      body(await revision(), {
        dateRange: { column: 'day', start: '2026-01-03', end: '2026-01-04' },
      }),
    );
    expect(dated.rows).toEqual([['A'], ['B'], ['C'], ['D']]);
    expect(values(dated.grandTotal)).toEqual([185]);
    expect(dated.applied.dateRange).toEqual({
      column: 'day',
      start: '2026-01-03',
      end: '2026-01-04',
    });
    expect(dated.applied.comparePrevious).toBe(false);
  });

  it('unions previous-only tuples and compares every cell, total and the grand total', async () => {
    const result = await pivot(
      body(await revision(), {
        dateRange: { column: 'day', start: '2026-01-03', end: '2026-01-04' },
        comparePrevious: true,
      }),
    );
    // The previous period contributes its web channel and its null region.
    expect(result.rows).toEqual([['A'], ['B'], ['C'], ['D'], [null]]);
    expect(result.columns).toEqual([['app'], ['bulk'], ['web']]);
    expect(at(result, ['A'], ['app'])[0]).toEqual({
      measureId: 1,
      value: 70,
      comparison: { previousValue: 20, delta: 50, percentChange: 250 },
    });
    expect(at(result, ['B'], ['app'])[0].comparison).toEqual({
      previousValue: 40,
      delta: 10,
      percentChange: 25,
    });
    // A previous-only tuple keeps a null current value and still reports the previous one.
    expect(at(result, [null], ['web'])[0]).toEqual({
      measureId: 1,
      value: null,
      comparison: { previousValue: 36, delta: null, percentChange: null },
    });
    expect(at(result, ['C'], ['app'])[0].comparison).toEqual({
      previousValue: null,
      delta: null,
      percentChange: null,
    });
    const rowTotal = result.rowTotals[tupleIndex(result.rows, ['A'])][0];
    expect(rowTotal.value).toBe(70);
    expect(rowTotal.comparison).toEqual({ previousValue: 50, delta: 20, percentChange: 40 });
    const nullTotal = result.rowTotals[tupleIndex(result.rows, [null])][0];
    expect(nullTotal.value).toBeNull();
    expect(nullTotal.comparison.previousValue).toBe(36);
    const columnTotal = result.columnTotals[tupleIndex(result.columns, ['app'])][0];
    expect(columnTotal.value).toBe(180);
    expect(columnTotal.comparison).toEqual({
      previousValue: 60,
      delta: 120,
      percentChange: 200,
    });
    expect(result.grandTotal[0].value).toBe(185);
    expect(result.grandTotal[0].comparison).toMatchObject({ previousValue: 126, delta: 59 });
  });

  it('interprets a business timezone for timestamps on both periods', async () => {
    state.filename = await writeSource(
      "CREATE TABLE uploaded_data AS SELECT 'X' AS region, 10::DOUBLE AS amount, " +
        "TIMESTAMP '2026-01-03 14:00:00' AS event_time " +
        "UNION ALL SELECT 'X', 20, TIMESTAMP '2026-01-03 16:00:00'",
    );
    const sourceRevision = await revision();
    const seoul = await pivot({
      sourceId: 1,
      sourceRevision,
      measureIds: [1],
      rowColumns: [],
      columnColumns: [],
      dateRange: {
        column: 'event_time',
        start: '2026-01-04',
        end: '2026-01-04',
        timeZone: 'Asia/Seoul',
      },
      comparePrevious: true,
    });
    // 2026-01-04 in Asia/Seoul is 2026-01-03T15:00Z..2026-01-04T15:00Z: only the 16:00 row.
    expect(seoul.rows).toEqual([[]]);
    expect(seoul.columns).toEqual([[]]);
    expect(seoul.cells).toEqual([
      { row: 0, column: 0, measures: [expect.objectContaining({ measureId: 1, value: 20 })] },
    ]);
    // The compared period keeps the same zone: 2026-01-03 there is the 14:00 row.
    expect(seoul.grandTotal[0].comparison).toEqual({
      previousValue: 10,
      delta: 10,
      percentChange: 100,
    });
    // The same civil date without the zone stays UTC and matches no row.
    const utc = await pivot({
      sourceId: 1,
      sourceRevision,
      measureIds: [1],
      rowColumns: [],
      columnColumns: [],
      dateRange: { column: 'event_time', start: '2026-01-04', end: '2026-01-04' },
    });
    expect(utc.grandTotal[0].value).toBeNull();
    expect(utc.cells).toEqual([{ row: 0, column: 0, measures: [{ measureId: 1, value: null }] }]);
  });

  it('keeps an empty result empty and preserves null groups and large integers', async () => {
    const empty = await pivot(
      body(await revision(), {
        measureIds: [1, 2],
        filters: [{ column: 'region', values: ['Z'] }],
      }),
    );
    expect(empty.rows).toEqual([]);
    expect(empty.columns).toEqual([]);
    expect(empty.cells).toEqual([]);
    expect(empty.rowTotals).toEqual([]);
    expect(empty.columnTotals).toEqual([]);
    // No rows: SUM stays null while COUNT reports an honest zero.
    expect(values(empty.grandTotal)).toEqual([null, 0]);

    state.filename = await writeSource(
      "CREATE TABLE uploaded_data AS SELECT 'X' AS region, 9007199254740993::BIGINT AS amount, " +
        "'app' AS channel",
    );
    metrics = [metric(1, 'Revenue', { aggregation: 'SUM', column: 'amount' })];
    const large = await pivot(body(await revision(), { measureIds: [1] }));
    expect(large.cells[0].measures[0].value).toBe('9007199254740993');
    expect(large.rowTotals[0][0].value).toBe('9007199254740993');
    expect(large.grandTotal[0].value).toBe('9007199254740993');
  });

  it('caps rows, columns and data slots without truncating a total', async () => {
    state.filename = await writeSource(gridSql);
    metrics = [
      metric(1, 'Revenue', { aggregation: 'SUM', column: 'amount' }),
      metric(2, 'Orders', { aggregation: 'COUNT', column: '*' }),
      metric(3, 'Weighted', {
        aggregation: 'WEIGHTED_AVG',
        column: 'amount',
        weightColumn: 'weight',
      }),
      metric(4, 'Per weight', {
        aggregation: 'RATIO_SUM',
        column: 'amount',
        denominatorColumn: 'weight',
        scale: 1,
      }),
      metric(6, 'Average', { aggregation: 'AVG', column: 'amount' }),
      metric(7, 'Largest', { aggregation: 'MAX', column: 'amount' }),
    ];
    const result = await pivot({
      sourceId: 1,
      sourceRevision: await revision(),
      measureIds: [1, 2, 3, 4, 6, 7],
      rowColumns: ['r'],
      columnColumns: ['c'],
    });
    expect(result.limits).toEqual({ rows: 50, columns: 20, cells: 6000 });
    expect(result.rows).toHaveLength(50);
    expect(result.columns).toHaveLength(20);
    expect(result.rows[0]).toEqual(['r00']);
    expect(result.columns[19]).toEqual(['c19']);
    // 50 x 20 x 6 is exactly the advertised ceiling, and every slot is present.
    expect(result.cells).toHaveLength(1000);
    expect(result.rowTotals).toHaveLength(50);
    expect(result.columnTotals).toHaveLength(20);
    expect(result.grandTotal.map((measure: any) => measure.measureId)).toEqual([1, 2, 3, 4, 6, 7]);
    // 20 * sum(0..49) + 50 * sum(0..19) over the full grid.
    expect(result.grandTotal[0].value).toBe(34000);
  });

  it('rejects an oversized axis with Korean advice instead of truncating', async () => {
    state.filename = await writeSource(wideRowsSql);
    const sourceRevision = await revision();
    const wideRows = body(sourceRevision, { rowColumns: ['r'], columnColumns: [] });
    await expect(pivot(wideRows)).rejects.toBeInstanceOf(BadRequestException);
    await expect(pivot(wideRows)).rejects.toThrow(/행 조합이 50개를 넘습니다/);
    // The same source under a narrower filter stays inside the bound.
    const narrowed = await pivot(
      body(sourceRevision, {
        rowColumns: ['r'],
        columnColumns: [],
        filters: [{ column: 'amount', range: { min: 1 } }],
      }),
    );
    expect(narrowed.rows).toHaveLength(50);

    state.filename = await writeSource(wideColumnsSql);
    const wideRevision = await revision();
    await expect(
      pivot(body(wideRevision, { rowColumns: [], columnColumns: ['c'] })),
    ).rejects.toThrow(/열 조합이 20개를 넘습니다/);
    const narrowColumns = await pivot(
      body(wideRevision, {
        rowColumns: [],
        columnColumns: ['c'],
        filters: [{ column: 'amount', range: { min: 1 } }],
      }),
    );
    expect(narrowColumns.columns).toHaveLength(20);
  });

  it('rejects unknown fields, invalid axes, stale revisions and foreign actors', async () => {
    const sourceRevision = await revision();
    const rejects = async (overrides: any) => {
      await expect(pivot(body(sourceRevision, overrides))).rejects.toBeInstanceOf(
        BadRequestException,
      );
    };
    await rejects({ measureIds: [] });
    await rejects({ measureIds: [1, 1] });
    await rejects({ measureIds: [99] });
    await rejects({ measureIds: [5] });
    await rejects({ measureIds: [1, 2, 3, 4, 6, 7, 1] });
    await rejects({ rowColumns: ['region', 'channel', 'amount'] });
    await rejects({ rowColumns: ['region', 'region'] });
    await rejects({ columnColumns: ['channel', 'channel'] });
    await rejects({ rowColumns: ['region'], columnColumns: ['region'] });
    await rejects({ rowColumns: ['region; DROP TABLE uploaded_data'] });
    await rejects({ rowColumns: 'region' });
    await rejects({ rowColumns: ['missing'] });
    await rejects({ comparePrevious: true });
    await rejects({ comparePrevious: 'yes' });
    await rejects({ filters: [{ column: 'region', range: { min: 1 } }] });
    await rejects({ filters: [{ column: 'missing', values: ['A'] }] });
    await rejects({ filters: [{ column: 'region', value: 'A' }] });
    await rejects({ dateRange: { column: 'region', start: '2026-01-01', end: '2026-01-02' } });
    await rejects({ dateRange: { column: 'day', start: '2026-01-02', end: '2026-01-01' } });
    await rejects({ trendGrain: 'month' });
    await rejects({ rankingMeasureId: 1 });
    await rejects({ dimensionColumns: ['region'] });
    await rejects({ page: 0 });
    await rejects({ includeRows: true });
    await rejects({ sql: 'SELECT 1' });
    await expect(
      pivot(body(sourceRevision, { sourceRevision: 'f'.repeat(64) })),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(pivot(body(sourceRevision), 20)).rejects.toBeInstanceOf(ForbiddenException);
    expect((await service.catalog({ sourceId: 1 }, actor)).rowCount).toBe('9');
  });

  it('rejects a source revision that moved after the request was built', async () => {
    const sourceRevision = await revision();
    state.filename = await writeSource(
      "CREATE TABLE uploaded_data AS SELECT 'X' AS region, 1::DOUBLE AS amount, 'app' AS channel",
    );
    await expect(pivot(body(sourceRevision))).rejects.toBeInstanceOf(ConflictException);
  });
});
