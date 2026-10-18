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
import { sortPivotRows } from './bi-explore-sort';
import { PivotBucket, pivotAxisExpression } from './bi-explore-time';
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
  // 50 leaf rows under 50 parents and 20 columns: flat fits the cell budget, the hierarchy does not.
  const hierarchyGridSql =
    "CREATE TABLE uploaded_data AS SELECT 'r' || lpad(CAST(i AS VARCHAR), 2, '0') AS r, 'g' AS g, " +
    "'c' || lpad(CAST(j AS VARCHAR), 2, '0') AS col, CAST(i + j AS DOUBLE) AS amount, " +
    'CAST(j AS DOUBLE) AS weight FROM range(50) t(i), range(20) u(j)';

  // Row totals are P 110, Q 51, R 60; the x cell alone is P 10, Q 50, R 30, so the two orders
  // cannot be confused. The 01-02 rows give every x cell a previous value for the change sorts.
  const cellSortSql =
    'CREATE TABLE uploaded_data AS SELECT CAST("column0" AS VARCHAR) AS region, ' +
    'CAST("column1" AS VARCHAR) AS channel, CAST("column2" AS DOUBLE) AS amount, ' +
    'CAST("column3" AS DATE) AS day FROM (VALUES ' +
    [
      ['P', 'x', 10, '2026-01-03'],
      ['P', 'y', 100, '2026-01-03'],
      ['Q', 'x', 50, '2026-01-03'],
      ['Q', 'y', 1, '2026-01-03'],
      ['R', 'x', 30, '2026-01-03'],
      ['R', 'y', 30, '2026-01-03'],
      ['P', 'x', 1, '2026-01-02'],
      ['Q', 'x', 40, '2026-01-02'],
      ['R', 'x', 40, '2026-01-02'],
    ]
      .map(row)
      .join(', ') +
    ') t(column0, column1, column2, column3)';
  // Parent x 01-03 totals are P 40, Q 40, R 25, while the parent row totals are P 240, Q 41, R 55.
  const hierarchyCellSql =
    'CREATE TABLE uploaded_data AS SELECT CAST("column0" AS VARCHAR) AS region, ' +
    'CAST("column1" AS VARCHAR) AS channel, CAST("column2" AS DOUBLE) AS amount, ' +
    'CAST("column3" AS DATE) AS day FROM (VALUES ' +
    [
      ['P', 'a', 10, '2026-01-03'],
      ['P', 'b', 30, '2026-01-03'],
      ['P', 'a', 200, '2026-01-04'],
      ['Q', 'a', 40, '2026-01-03'],
      ['Q', 'a', 1, '2026-01-04'],
      ['R', 'a', 25, '2026-01-03'],
      ['R', 'a', 30, '2026-01-04'],
    ]
      .map(row)
      .join(', ') +
    ') t(column0, column1, column2, column3)';
  // America/New_York springs forward on 2026-03-08 (05:00Z..04:00Z = 23h). The naive TIMESTAMP
  // literals are UTC instants: 03-07/03-08 04:30Z are 03-06/03-07 23:30 EST, one hour from the DST
  // hour, and the 16:00Z current rows are 12:00 EDT on the two current civil days.
  const dstSql =
    'CREATE TABLE uploaded_data AS SELECT CAST("column0" AS VARCHAR) AS region, ' +
    'CAST("column1" AS DOUBLE) AS amount, CAST("column2" AS TIMESTAMP) AS event_time FROM (VALUES ' +
    [
      ['X', 5, '2026-03-07 04:30:00'],
      ['X', 7, '2026-03-08 04:30:00'],
      ['X', 11, '2026-03-08 16:00:00'],
      ['X', 13, '2026-03-09 16:00:00'],
    ]
      .map(row)
      .join(', ') +
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

  it('groups two axes and reaggregates non-additive totals outside the cell grid', async () => {
    const result = await pivot(body(await revision(), { measureIds: [1, 4] }));
    expect(result.sourceId).toBe(1);
    expect(result.sourceRevision).toMatch(revision64);
    expect(result.rowColumns).toEqual(['region']);
    expect(result.columnColumns).toEqual(['channel']);
    // Deterministic ascending tuples; a null group keeps its place after every value.
    expect(result.rows).toEqual([['A'], ['B'], ['C'], ['D'], [null]]);
    expect(result.columns).toEqual([['app'], ['bulk'], ['web']]);
    expect(result.applied).toEqual({
      filters: [],
      comparePrevious: false,
      rowHierarchy: false,
      tableMode: 'nest',
      rowSort: { by: 'label', direction: 'asc' },
    });
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

  it('adds hierarchy subtotals reaggregated at the parent and parent x column grain', async () => {
    const result = await pivot(
      body(await revision(), {
        measureIds: [1, 4],
        rowColumns: ['region', 'channel'],
        columnColumns: ['day'],
        rowHierarchy: true,
      }),
    );
    expect(result.rowSubtotals).toHaveLength(5);
    expect(result.rowSubtotals.map((subtotal: any) => subtotal.tuple)).toEqual([
      ['A'],
      ['B'],
      ['C'],
      ['D'],
      [null],
    ]);
    const parent = (value: unknown) =>
      result.rowSubtotals.find((subtotal: any) => subtotal.tuple[0] === value);
    // Region A totals come from the raw rows: SUM 120 and the ratio 120 / (2 + 4 + 0 + 2).
    expect(values(parent('A').measures)).toEqual([120, 15]);
    expect(values(parent(null).measures)).toEqual([36, 6]);
    expect(values(parent('D').measures)[1]).toBeNull();
    // Every parent covers every grid column, in the same order as the columns.
    expect(parent('A').cells.map((cell: any) => cell.column)).toEqual(
      result.columns.map((_column: any, index: number) => index),
    );
    const cellOfDay = (value: unknown, day: string) =>
      parent(value).cells.find(
        (cell: any) => JSON.stringify(result.columns[cell.column]) === JSON.stringify([day]),
      );
    // A parent x column cell is reaggregated at that grain, so a missing day stays null.
    expect(cellOfDay('A', '2026-01-01').measures.map((measure: any) => measure.value)).toEqual([
      30, 5,
    ]);
    expect(cellOfDay('A', '2026-01-03').measures.map((measure: any) => measure.value)).toEqual([
      null,
      null,
    ]);
    expect(cellOfDay('A', '2026-01-04').measures.map((measure: any) => measure.value)).toEqual([
      70, 35,
    ]);
  });

  it('orders parents by their own subtotal and keeps each parent together with its leaves', async () => {
    const result = await pivot(
      body(await revision(), {
        rowColumns: ['region', 'channel'],
        columnColumns: [],
        rowHierarchy: true,
        rowSort: { by: 'value', direction: 'desc', measureId: 1 },
      }),
    );
    // A 120, B 90, C 60, the null parent 36, then D 5; the null label still sorts after D.
    expect(result.rowSubtotals.map((subtotal: any) => subtotal.tuple[0])).toEqual([
      'A',
      'B',
      'C',
      null,
      'D',
    ]);
    // Leaves stay under their parent, sorted by their own row total.
    expect(result.rows).toEqual([
      ['A', 'app'],
      ['A', 'web'],
      ['B', 'app'],
      ['C', 'app'],
      [null, 'web'],
      ['D', 'bulk'],
    ]);
    expect(result.rowTotals.map((measures: any[]) => measures[0].value)).toEqual([
      90, 30, 90, 60, 36, 5,
    ]);
  });

  it('sorts flat rows by the current row total, keeping a null value last and a label tie asc', async () => {
    const tied = await pivot(
      body(await revision(), {
        rowColumns: ['region', 'channel'],
        columnColumns: [],
        rowSort: { by: 'value', direction: 'desc', measureId: 1 },
      }),
    );
    // A/app and B/app both total 90, so the descending value order still breaks the tie by label.
    expect(tied.rows).toEqual([
      ['A', 'app'],
      ['B', 'app'],
      ['C', 'app'],
      [null, 'web'],
      ['A', 'web'],
      ['D', 'bulk'],
    ]);
    // A row whose value is null sorts last in either direction, even against the ratio measure.
    const desc = await pivot(
      body(await revision(), {
        measureIds: [4],
        rowSort: { by: 'value', direction: 'desc', measureId: 4 },
      }),
    );
    expect(desc.rows).toEqual([['C'], ['A'], ['B'], [null], ['D']]);
    const asc = await pivot(
      body(await revision(), {
        measureIds: [4],
        rowSort: { by: 'value', direction: 'asc', measureId: 4 },
      }),
    );
    expect(asc.rows).toEqual([[null], ['B'], ['A'], ['C'], ['D']]);
    // The cell grid follows the sorted rows, so a row index still names its own tuple.
    expect(values(at(desc, ['C'], ['app']))).toEqual([60]);
    expect(values(asc.rowTotals[0])).toEqual([6]);
  });

  it('keeps the null label last when a label sort is descending', async () => {
    const result = await pivot(
      body(await revision(), { rowSort: { by: 'label', direction: 'desc' } }),
    );
    expect(result.rows).toEqual([['D'], ['C'], ['B'], ['A'], [null]]);
    expect(result.rowTotals.map((measures: any[]) => measures[0].value)).toEqual([
      5, 60, 90, 120, 36,
    ]);
  });

  it('reaggregates hierarchy subtotals over both periods and keeps a previous-only parent', async () => {
    const result = await pivot(
      body(await revision(), {
        rowColumns: ['region', 'channel'],
        columnColumns: [],
        rowHierarchy: true,
        dateRange: { column: 'day', start: '2026-01-03', end: '2026-01-04' },
        comparePrevious: true,
      }),
    );
    expect(result.rowSubtotals.map((subtotal: any) => subtotal.tuple[0])).toEqual([
      'A',
      'B',
      'C',
      'D',
      null,
    ]);
    const parent = (value: unknown) =>
      result.rowSubtotals.find((subtotal: any) => subtotal.tuple[0] === value);
    // Region A holds 70 now against 50 before; the null parent only exists in the previous period.
    expect(parent('A').measures[0]).toEqual({
      measureId: 1,
      value: 70,
      comparison: { previousValue: 50, delta: 20, percentChange: 40 },
    });
    expect(parent(null).measures[0].value).toBeNull();
    expect(parent(null).measures[0].comparison.previousValue).toBe(36);
    expect(parent('A').cells).toEqual([
      {
        column: 0,
        measures: [
          {
            measureId: 1,
            value: 70,
            comparison: { previousValue: 50, delta: 20, percentChange: 40 },
          },
        ],
      },
    ]);
  });

  it('sorts large integer values by exact magnitude instead of through Number()', async () => {
    state.filename = await writeSource(
      'CREATE TABLE uploaded_data AS SELECT * FROM (VALUES ' +
        "('a', 9007199254740992::BIGINT), ('b', 9007199254740993::BIGINT), ('c', 100::BIGINT)" +
        ') t(region, amount)',
    );
    metrics = [metric(1, 'Revenue', { aggregation: 'SUM', column: 'amount' })];
    const desc = await pivot(
      body(await revision(), {
        columnColumns: [],
        rowSort: { by: 'value', direction: 'desc', measureId: 1 },
      }),
    );
    // Number() collapses the first two into the same double, so a coercion sort would answer a, b.
    expect(desc.rows).toEqual([['b'], ['a'], ['c']]);
    expect(desc.rowTotals.map((measures: any[]) => measures[0].value)).toEqual([
      '9007199254740993',
      '9007199254740992',
      100,
    ]);
  });

  it('counts the added hierarchy parents against the cell cap without truncating', async () => {
    state.filename = await writeSource(hierarchyGridSql);
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
    const sourceRevision = await revision();
    const request = {
      sourceId: 1,
      sourceRevision,
      measureIds: [1, 2, 3, 4, 6, 7],
      rowColumns: ['r', 'g'],
      columnColumns: ['col'],
    };
    // 50 leaves x 20 columns x 6 measures is exactly the advertised ceiling without a hierarchy.
    const flat = await pivot(request);
    expect(flat.rows).toHaveLength(50);
    expect(flat.columns).toHaveLength(20);
    expect(flat.rowSubtotals).toEqual([]);
    expect(flat.cells).toHaveLength(1000);
    // The same request with hierarchy adds 50 parent rows: (50 + 50) x 20 x 6 exceeds the budget.
    await expect(pivot({ ...request, rowHierarchy: true })).rejects.toThrow(
      /표시할 값이 6000개를 넘습니다/,
    );
  });

  it('validates rowHierarchy and rowSort strictly', async () => {
    const sourceRevision = await revision();
    const rejects = async (overrides: any) => {
      await expect(pivot(body(sourceRevision, overrides))).rejects.toBeInstanceOf(
        BadRequestException,
      );
    };
    await rejects({ rowHierarchy: 'yes' });
    await rejects({ rowSort: 'asc' });
    await rejects({ rowSort: null });
    // A supplied object must state both fields; only an omitted object falls back to label asc.
    await rejects({ rowSort: {} });
    await rejects({ rowSort: { by: 'label' } });
    await rejects({ rowSort: { direction: 'desc' } });
    await rejects({ rowSort: { by: null, direction: 'asc' } });
    await rejects({ rowSort: { by: 'label', measureId: 1 } });
    await rejects({ rowSort: { by: 'label', direction: 'up' } });
    await rejects({ rowSort: { by: 'bogus', direction: 'asc' } });
    await rejects({ rowSort: { by: 'value', direction: 'desc' } });
    await rejects({ rowSort: { by: 'value', direction: 'desc', measureId: 99 } });
    await rejects({ rowSort: { by: 'value', direction: 'desc', measureId: 1, extra: true } });
    // The expanded presentation is not an API input.
    await rejects({ expanded: true });
    await rejects({ expandedRows: ['A'] });
    // Defaults: an omitted rowSort is the label order and an empty hierarchy is harmless.
    const defaults = await pivot(body(sourceRevision, { rowHierarchy: true }));
    expect(defaults.rowSubtotals).toEqual([]);
    expect(defaults.rows).toEqual([['A'], ['B'], ['C'], ['D'], [null]]);
    expect(defaults.applied.rowHierarchy).toBe(true);
    expect(defaults.applied.rowSort).toEqual({ by: 'label', direction: 'asc' });
    const sorted = await pivot(
      body(sourceRevision, { rowSort: { by: 'value', direction: 'asc', measureId: 1 } }),
    );
    expect(sorted.applied.rowSort).toEqual({ by: 'value', direction: 'asc', measureId: 1 });
    expect(sorted.applied.rowHierarchy).toBe(false);
  });

  it('buckets a temporal axis to YYYY-MM-DD labels for the day, week and month grains', async () => {
    state.filename = await writeSource(
      'CREATE TABLE uploaded_data AS SELECT CAST("column0" AS VARCHAR) AS region, ' +
        'CAST("column1" AS DOUBLE) AS amount, CAST("column2" AS DATE) AS day FROM (VALUES ' +
        [
          ['A', 10, '2025-12-29'],
          ['A', 20, '2026-01-01'],
          ['B', 30, '2026-01-05'],
          ['B', 40, '2026-01-08'],
          ['C', 50, '2026-02-02'],
        ]
          .map(row)
          .join(', ') +
        ') t(column0, column1, column2)',
    );
    metrics = [metric(1, 'Revenue', { aggregation: 'SUM', column: 'amount' })];
    const sourceRevision = await revision();
    const bucketed = (grain: 'day' | 'week' | 'month') =>
      pivot(
        body(sourceRevision, {
          columnColumns: ['day'],
          timeAxis: { column: 'day', grain, timeZone: 'UTC' },
        }),
      );
    const day = await bucketed('day');
    // The axis keeps the original column name while the tuple value is the bucket label.
    expect(day.columnColumns).toEqual(['day']);
    expect(day.columns.map((tuple: any[]) => tuple[0])).toEqual([
      '2025-12-29',
      '2026-01-01',
      '2026-01-05',
      '2026-01-08',
      '2026-02-02',
    ]);
    expect(day.applied.timeAxis).toEqual({ column: 'day', grain: 'day', timeZone: 'UTC' });
    const week = await bucketed('week');
    // A week starts on Monday, so 2025-12-29 owns both 12-29 and 01-01 and sums them.
    expect(week.columns.map((tuple: any[]) => tuple[0])).toEqual([
      '2025-12-29',
      '2026-01-05',
      '2026-02-02',
    ]);
    expect(values(at(week, ['A'], ['2025-12-29']))).toEqual([30]);
    const month = await bucketed('month');
    expect(month.columns.map((tuple: any[]) => tuple[0])).toEqual([
      '2025-12-01',
      '2026-01-01',
      '2026-02-01',
    ]);
    // The label names the bucket start while the measure still sums every row inside it.
    expect(values(at(month, ['A'], ['2025-12-01']))).toEqual([10]);
    expect(values(at(month, ['A'], ['2026-01-01']))).toEqual([20]);
    expect(month.applied.timeAxis).toEqual({ column: 'day', grain: 'month', timeZone: 'UTC' });
  });

  it('aligns shifted previous buckets onto the current civil day labels', async () => {
    state.filename = await writeSource(
      'CREATE TABLE uploaded_data AS SELECT CAST("column0" AS VARCHAR) AS region, ' +
        'CAST("column1" AS DOUBLE) AS amount, CAST("column2" AS DATE) AS day FROM (VALUES ' +
        [
          ['A', 10, '2026-01-01'],
          ['A', 20, '2026-01-02'],
          ['A', 100, '2026-01-03'],
          ['A', 200, '2026-01-04'],
          ['B', 5, '2026-01-02'],
          ['B', 50, '2026-01-04'],
        ]
          .map(row)
          .join(', ') +
        ') t(column0, column1, column2)',
    );
    metrics = [metric(1, 'Revenue', { aggregation: 'SUM', column: 'amount' })];
    const result = await pivot(
      body(await revision(), {
        columnColumns: ['day'],
        dateRange: { column: 'day', start: '2026-01-03', end: '2026-01-04' },
        comparePrevious: true,
        timeAxis: { column: 'day', grain: 'day', timeZone: 'UTC' },
      }),
    );
    // The two-day shift moves 01-01/01-02 onto 01-03/01-04, so no stale label survives.
    expect(result.columns.map((tuple: any[]) => tuple[0])).toEqual(['2026-01-03', '2026-01-04']);
    expect(at(result, ['A'], ['2026-01-03'])[0]).toEqual({
      measureId: 1,
      value: 100,
      comparison: { previousValue: 10, delta: 90, percentChange: 900 },
    });
    expect(at(result, ['A'], ['2026-01-04'])[0]).toEqual({
      measureId: 1,
      value: 200,
      comparison: { previousValue: 20, delta: 180, percentChange: 900 },
    });
    // Region B has neither a current nor a shifted value on 01-03, so the cell stays null.
    expect(at(result, ['B'], ['2026-01-03'])[0]).toEqual({
      measureId: 1,
      value: null,
      comparison: { previousValue: null, delta: null, percentChange: null },
    });
    expect(at(result, ['B'], ['2026-01-04'])[0]).toEqual({
      measureId: 1,
      value: 50,
      comparison: { previousValue: 5, delta: 45, percentChange: 900 },
    });
    expect(result.grandTotal[0]).toEqual({
      measureId: 1,
      value: 350,
      comparison: { previousValue: 35, delta: 315, percentChange: 900 },
    });
  });

  it('buckets a timestamp axis in the applied business timezone and shifts the previous period first', async () => {
    state.filename = await writeSource(
      'CREATE TABLE uploaded_data AS SELECT CAST("column0" AS VARCHAR) AS region, ' +
        'CAST("column1" AS DOUBLE) AS amount, CAST("column2" AS TIMESTAMP) AS event_time FROM (VALUES ' +
        [
          ['X', 100, '2026-01-04 14:00:00'],
          ['X', 30, '2026-01-04 15:30:00'],
          ['X', 40, '2026-01-04 16:30:00'],
          ['X', 10, '2026-01-02 15:30:00'],
          ['X', 20, '2026-01-03 14:00:00'],
        ]
          .map(row)
          .join(', ') +
        ') t(column0, column1, column2)',
    );
    metrics = [metric(1, 'Revenue', { aggregation: 'SUM', column: 'amount' })];
    const result = await pivot(
      body(await revision(), {
        columnColumns: ['event_time'],
        dateRange: {
          column: 'event_time',
          start: '2026-01-04T00:00:00Z',
          end: '2026-01-06T00:00:00Z',
          precision: 'timestamp',
          timeZone: 'Asia/Seoul',
        },
        comparePrevious: true,
        timeAxis: { column: 'event_time', grain: 'day', timeZone: 'Asia/Seoul' },
      }),
    );
    // KST is UTC+9, so 14:00 stays on 01-04 while 15:30 and 16:30 roll into 01-05.
    expect(result.columns.map((tuple: any[]) => tuple[0])).toEqual(['2026-01-04', '2026-01-05']);
    expect(values(at(result, ['X'], ['2026-01-04']))).toEqual([100]);
    expect(values(at(result, ['X'], ['2026-01-05']))).toEqual([70]);
    expect(at(result, ['X'], ['2026-01-04'])[0].comparison).toEqual({
      previousValue: null,
      delta: null,
      percentChange: null,
    });
    // The previous rows shift by the 48h UTC span before the zone bucket, landing on 01-05.
    expect(at(result, ['X'], ['2026-01-05'])[0]).toMatchObject({
      measureId: 1,
      value: 70,
      comparison: { previousValue: 30, delta: 40 },
    });
    expect(at(result, ['X'], ['2026-01-05'])[0].comparison.percentChange).toBeCloseTo(400 / 3, 6);
    expect(result.applied.timeAxis).toEqual({
      column: 'event_time',
      grain: 'day',
      timeZone: 'Asia/Seoul',
    });
  });

  it('aligns the shifted previous civil days across the New_York DST spring-forward', async () => {
    state.filename = await writeSource(dstSql);
    metrics = [metric(1, 'Revenue', { aggregation: 'SUM', column: 'amount' })];
    // Current = the two civil days 03-08 and 03-09; previous = 03-06 and 03-07 in the same zone.
    const result = await pivot(
      body(await revision(), {
        columnColumns: ['event_time'],
        dateRange: {
          column: 'event_time',
          start: '2026-03-08',
          end: '2026-03-09',
          timeZone: 'America/New_York',
        },
        comparePrevious: true,
        timeAxis: { column: 'event_time', grain: 'day', timeZone: 'America/New_York' },
      }),
    );
    // A civil shift adds whole wall-clock days, so the 23-hour 03-08 keeps every prior row on its
    // own current label. A UTC-seconds shift would have pushed 03-08T04:30Z to a stray 03-10 column.
    expect(result.columns.map((tuple: any[]) => tuple[0])).toEqual(['2026-03-08', '2026-03-09']);
    expect(at(result, ['X'], ['2026-03-08'])[0]).toEqual({
      measureId: 1,
      value: 11,
      comparison: { previousValue: 5, delta: 6, percentChange: 120 },
    });
    expect(at(result, ['X'], ['2026-03-09'])[0]).toMatchObject({
      measureId: 1,
      value: 13,
      comparison: { previousValue: 7, delta: 6 },
    });
    expect(at(result, ['X'], ['2026-03-09'])[0].comparison.percentChange).toBeCloseTo(600 / 7, 6);
    expect(result.grandTotal[0]).toEqual({
      measureId: 1,
      value: 24,
      comparison: { previousValue: 12, delta: 12, percentChange: 100 },
    });
  });

  it('shifts a timestamp-precision period by UTC seconds, distinct from the civil shift', async () => {
    state.filename = await writeSource(dstSql);
    metrics = [metric(1, 'Revenue', { aggregation: 'SUM', column: 'amount' })];
    // The same two current civil days as a 48h UTC window: the prior window shifts 172800 seconds.
    const result = await pivot(
      body(await revision(), {
        columnColumns: ['event_time'],
        dateRange: {
          column: 'event_time',
          start: '2026-03-08T05:00:00Z',
          end: '2026-03-10T05:00:00Z',
          precision: 'timestamp',
          timeZone: 'America/New_York',
        },
        comparePrevious: true,
        timeAxis: { column: 'event_time', grain: 'day', timeZone: 'America/New_York' },
      }),
    );
    // Equal elapsed seconds drift the wall clock by the DST hour: 03-08T04:30Z lands on 03-10,
    // not the 03-09 the civil shift produced, so this distinguishes the two shift rules.
    expect(result.columns.map((tuple: any[]) => tuple[0])).toEqual([
      '2026-03-08',
      '2026-03-09',
      '2026-03-10',
    ]);
    expect(at(result, ['X'], ['2026-03-08'])[0].comparison).toEqual({
      previousValue: null,
      delta: null,
      percentChange: null,
    });
    expect(at(result, ['X'], ['2026-03-09'])[0]).toEqual({
      measureId: 1,
      value: 13,
      comparison: { previousValue: 5, delta: 8, percentChange: 160 },
    });
    expect(at(result, ['X'], ['2026-03-10'])[0]).toEqual({
      measureId: 1,
      value: null,
      comparison: { previousValue: 7, delta: null, percentChange: null },
    });
    expect(result.grandTotal[0]).toEqual({
      measureId: 1,
      value: 24,
      comparison: { previousValue: 12, delta: 12, percentChange: 100 },
    });
  });

  it('keeps a large integer measure exact inside a bucketed month axis', async () => {
    state.filename = await writeSource(
      'CREATE TABLE uploaded_data AS SELECT CAST("column0" AS VARCHAR) AS region, ' +
        'CAST("column1" AS BIGINT) AS amount, CAST("column2" AS DATE) AS day FROM (VALUES ' +
        [
          // Keep the literal as text: a JS number token would round before it reaches DuckDB.
          ['X', '9007199254740993', '2026-01-15'],
          ['X', '1', '2026-02-15'],
        ]
          .map(row)
          .join(', ') +
        ') t(column0, column1, column2)',
    );
    metrics = [metric(1, 'Revenue', { aggregation: 'SUM', column: 'amount' })];
    const result = await pivot(
      body(await revision(), {
        columnColumns: ['day'],
        timeAxis: { column: 'day', grain: 'month', timeZone: 'UTC' },
      }),
    );
    expect(result.columns.map((tuple: any[]) => tuple[0])).toEqual(['2026-01-01', '2026-02-01']);
    expect(values(at(result, ['X'], ['2026-01-01']))).toEqual(['9007199254740993']);
    expect(values(at(result, ['X'], ['2026-02-01']))).toEqual([1]);
  });

  it('orders rows by a selected column cell instead of the row total', async () => {
    state.filename = await writeSource(cellSortSql);
    metrics = [metric(1, 'Revenue', { aggregation: 'SUM', column: 'amount' })];
    const sourceRevision = await revision();
    const dateRange = { column: 'day', start: '2026-01-03', end: '2026-01-03' };
    const byCell = await pivot(
      body(sourceRevision, {
        dateRange,
        rowSort: { by: 'value', direction: 'desc', measureId: 1, columnTuple: ['x'] },
      }),
    );
    // Only the x cell decides the order: Q 50, R 30, P 10.
    expect(byCell.rows).toEqual([['Q'], ['R'], ['P']]);
    expect(byCell.applied.rowSort).toEqual({
      by: 'value',
      direction: 'desc',
      columnTuple: ['x'],
      measureId: 1,
    });
    expect(values(at(byCell, ['Q'], ['x']))).toEqual([50]);
    const byTotal = await pivot(
      body(sourceRevision, {
        dateRange,
        rowSort: { by: 'value', direction: 'desc', measureId: 1 },
      }),
    );
    // The row total is a different order: P 110, R 60, Q 51.
    expect(byTotal.rows).toEqual([['P'], ['R'], ['Q']]);
  });

  it('orders a selected column cell by delta and percentChange against the prior period', async () => {
    state.filename = await writeSource(cellSortSql);
    metrics = [metric(1, 'Revenue', { aggregation: 'SUM', column: 'amount' })];
    const sourceRevision = await revision();
    const shared = {
      dateRange: { column: 'day', start: '2026-01-03', end: '2026-01-03' },
      comparePrevious: true,
    } as const;
    const delta = await pivot(
      body(sourceRevision, {
        ...shared,
        rowSort: { by: 'delta', direction: 'desc', measureId: 1, columnTuple: ['x'] },
      }),
    );
    // x deltas: Q 50-40=10, P 10-1=9, R 30-40=-10.
    expect(delta.rows).toEqual([['Q'], ['P'], ['R']]);
    expect(at(delta, ['Q'], ['x'])[0].comparison).toEqual({
      previousValue: 40,
      delta: 10,
      percentChange: 25,
    });
    const percent = await pivot(
      body(sourceRevision, {
        ...shared,
        rowSort: { by: 'percentChange', direction: 'desc', measureId: 1, columnTuple: ['x'] },
      }),
    );
    // x percents: P 900%, Q 25%, R -25%.
    expect(percent.rows).toEqual([['P'], ['Q'], ['R']]);
    expect(percent.applied.rowSort).toEqual({
      by: 'percentChange',
      direction: 'desc',
      columnTuple: ['x'],
      measureId: 1,
    });
  });

  it('orders hierarchy parents by the parent-times-column aggregate', async () => {
    state.filename = await writeSource(hierarchyCellSql);
    metrics = [metric(1, 'Revenue', { aggregation: 'SUM', column: 'amount' })];
    const result = await pivot(
      body(await revision(), {
        rowColumns: ['region', 'channel'],
        columnColumns: ['day'],
        rowHierarchy: true,
        rowSort: { by: 'value', direction: 'desc', measureId: 1, columnTuple: ['2026-01-03'] },
      }),
    );
    // P and Q tie at 40 on 01-03 (label asc breaks the tie); the parent row total would be P, R, Q.
    expect(result.rowSubtotals.map((subtotal: any) => subtotal.tuple[0])).toEqual(['P', 'Q', 'R']);
    // Leaves sort by their own 01-03 cell, so P/b 30 precedes P/a 10 despite P/a's larger total.
    expect(result.rows).toEqual([
      ['P', 'b'],
      ['P', 'a'],
      ['Q', 'a'],
      ['R', 'a'],
    ]);
    expect(result.rowTotals.map((measures: any[]) => measures[0].value)).toEqual([30, 210, 41, 55]);
  });

  it('validates the timeAxis contract strictly', async () => {
    const sourceRevision = await revision();
    const rejects = async (overrides: any) => {
      await expect(pivot(body(sourceRevision, overrides))).rejects.toBeInstanceOf(
        BadRequestException,
      );
    };
    await rejects({ timeAxis: 'day' });
    await rejects({ timeAxis: null });
    await rejects({ timeAxis: { column: 'day', grain: 'day', timeZone: 'UTC', extra: 1 } });
    await rejects({ timeAxis: { column: 'day', grain: 'hour', timeZone: 'UTC' } });
    await rejects({ timeAxis: { column: 'day', grain: 'day' } });
    await rejects({ timeAxis: { column: 1, grain: 'day', timeZone: 'UTC' } });
    // The column must be temporal and placed on one of the two axes.
    await rejects({
      rowColumns: ['region'],
      columnColumns: [],
      timeAxis: { column: 'region', grain: 'day', timeZone: 'UTC' },
    });
    await rejects({ timeAxis: { column: 'day', grain: 'day', timeZone: 'UTC' } });
    await rejects({
      rowColumns: ['missing'],
      columnColumns: [],
      timeAxis: { column: 'missing', grain: 'day', timeZone: 'UTC' },
    });
    // The zone must be a real IANA name and must match the applied range, in either direction.
    await rejects({
      rowColumns: ['day'],
      columnColumns: [],
      timeAxis: { column: 'day', grain: 'day', timeZone: 'Mars/Base' },
    });
    await rejects({
      rowColumns: ['day'],
      columnColumns: [],
      dateRange: { column: 'day', start: '2026-01-01', end: '2026-01-04', timeZone: 'Asia/Seoul' },
      timeAxis: { column: 'day', grain: 'day', timeZone: 'UTC' },
    });
    await rejects({
      rowColumns: ['day'],
      columnColumns: [],
      dateRange: { column: 'day', start: '2026-01-01', end: '2026-01-04' },
      timeAxis: { column: 'day', grain: 'day', timeZone: 'Asia/Seoul' },
    });
    // A matching zone is accepted and echoed as the applied axis.
    const matched = await pivot(
      body(sourceRevision, {
        rowColumns: ['day'],
        columnColumns: [],
        dateRange: {
          column: 'day',
          start: '2026-01-01',
          end: '2026-01-04',
          timeZone: 'Asia/Seoul',
        },
        timeAxis: { column: 'day', grain: 'month', timeZone: 'Asia/Seoul' },
      }),
    );
    expect(matched.applied.timeAxis).toEqual({
      column: 'day',
      grain: 'month',
      timeZone: 'Asia/Seoul',
    });
  });

  it('validates the expanded rowSort fields and rejects an unbounded column tuple', async () => {
    const sourceRevision = await revision();
    const rejects = async (overrides: any) => {
      await expect(pivot(body(sourceRevision, overrides))).rejects.toBeInstanceOf(
        BadRequestException,
      );
    };
    // A label order carries neither a measure nor a selected cell.
    await rejects({ rowSort: { by: 'label', direction: 'asc', columnTuple: [] } });
    await rejects({ rowSort: { by: 'value', direction: 'desc' } });
    // A change order needs the previous period comparison.
    await rejects({ rowSort: { by: 'delta', direction: 'desc', measureId: 1 } });
    await rejects({
      rowSort: { by: 'percentChange', direction: 'desc', measureId: 1, columnTuple: ['app'] },
    });
    await rejects({
      rowSort: { by: 'value', direction: 'desc', measureId: 1, columnTuple: 'app' },
    });
    await rejects({ rowSort: { by: 'value', direction: 'desc', measureId: 1, columnTuple: [{}] } });
    // The tuple arity must equal the bounded column axis, so this one-column axis rejects all of these.
    await rejects({ rowSort: { by: 'value', direction: 'desc', measureId: 1, columnTuple: [] } });
    await rejects({
      columnColumns: [],
      rowSort: { by: 'value', direction: 'desc', measureId: 1, columnTuple: ['x'] },
    });
    await rejects({
      rowSort: { by: 'value', direction: 'desc', measureId: 1, columnTuple: ['nope'] },
    });
    // A tuple that names no bounded cell is rejected even when the filtered result is empty.
    await rejects({
      filters: [{ column: 'region', values: ['Z'] }],
      rowSort: { by: 'value', direction: 'desc', measureId: 1, columnTuple: ['app'] },
    });
    await rejects({
      rowSort: { by: 'value', direction: 'desc', measureId: 1, columnTuple: ['app', 'bulk'] },
    });
    await rejects({
      rowSort: { by: 'value', direction: 'desc', measureId: 1, columnTuple: ['app', 'bulk', 'x'] },
    });
    // A real cell is accepted and echoed, and an empty tuple sorts by the row total.
    const byCell = await pivot(
      body(sourceRevision, {
        rowSort: { by: 'value', direction: 'desc', measureId: 1, columnTuple: ['app'] },
      }),
    );
    expect(byCell.applied.rowSort).toEqual({
      by: 'value',
      direction: 'desc',
      columnTuple: ['app'],
      measureId: 1,
    });
    const byTotal = await pivot(
      body(sourceRevision, {
        columnColumns: [],
        rowSort: { by: 'value', direction: 'desc', measureId: 1, columnTuple: [] },
      }),
    );
    expect(byTotal.applied.rowSort).toEqual({
      by: 'value',
      direction: 'desc',
      columnTuple: [],
      measureId: 1,
    });
  });

  it('merges both axes onto the row side for a flat table and drops the column axis', async () => {
    const result = await pivot(
      body(await revision(), {
        rowColumns: ['region'],
        columnColumns: ['channel'],
        tableMode: 'flat',
      }),
    );
    // Effective rows are the column axis first, then the row axis; the column side is empty.
    expect(result.rowColumns).toEqual(['channel', 'region']);
    expect(result.columnColumns).toEqual([]);
    expect(result.columns).toEqual([[]]);
    expect(result.applied.tableMode).toBe('flat');
    expect(result.rowSubtotals).toEqual([]);
    // One cell per combined record, and each row total is that record's own aggregate.
    expect(result.cells).toHaveLength(result.rows.length);
    expect(result.cells.every((cell: any) => cell.column === 0)).toBe(true);
    expect(result.rows).toEqual([
      ['app', 'A'],
      ['app', 'B'],
      ['app', 'C'],
      ['bulk', 'D'],
      ['web', 'A'],
      ['web', null],
    ]);
    expect(result.rowTotals.map((measures: any[]) => measures[0].value)).toEqual([
      90, 90, 60, 5, 30, 36,
    ]);
    // The grand total stays the full-filter aggregate, not the sum of the displayed records.
    expect(result.grandTotal[0].value).toBe(311);
  });

  it('keeps a flat table with no axes to a single grand record without inventing rows', async () => {
    const result = await pivot(
      body(await revision(), { rowColumns: [], columnColumns: [], tableMode: 'flat' }),
    );
    // No axis means no combined record, so the whole table is the one grand-total row.
    expect(result.rowColumns).toEqual([]);
    expect(result.columnColumns).toEqual([]);
    expect(result.rows).toEqual([[]]);
    expect(result.columns).toEqual([[]]);
    expect(result.cells).toHaveLength(1);
    expect(result.rowTotals[0][0].value).toBe(311);
    expect(result.grandTotal[0].value).toBe(311);
  });

  it('orders flat records by the combined row total and rejects a contradictory flat request', async () => {
    const sourceRevision = await revision();
    const sorted = await pivot(
      body(sourceRevision, {
        columnColumns: ['channel'],
        tableMode: 'flat',
        rowSort: { by: 'value', direction: 'desc', measureId: 1 },
      }),
    );
    // By total: app/A 90, app/B 90 (label tie asc), app/C 60, web/null 36, web/A 30, bulk/D 5.
    expect(sorted.rows).toEqual([
      ['app', 'A'],
      ['app', 'B'],
      ['app', 'C'],
      ['web', null],
      ['web', 'A'],
      ['bulk', 'D'],
    ]);
    // A flat table disables the hierarchy and the column cell, so either is contradictory.
    await expect(
      pivot(body(sourceRevision, { tableMode: 'flat', rowHierarchy: true })),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      pivot(
        body(sourceRevision, {
          tableMode: 'flat',
          rowSort: { by: 'value', direction: 'desc', measureId: 1, columnTuple: ['app'] },
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(pivot(body(sourceRevision, { tableMode: 'wide' }))).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('keeps a previous-only flat record and the prior grand ratio under flat mode', async () => {
    const result = await pivot(
      body(await revision(), {
        columnColumns: ['channel'],
        tableMode: 'flat',
        comparePrevious: true,
        dateRange: { column: 'day', start: '2026-01-03', end: '2026-01-04' },
      }),
    );
    // Current 01-03..04 records are app/A 70, app/B 50, app/C 60, bulk/D 5; the previous period
    // adds web/A 30 and web/null 36, which have no current value and stay null instead of zero.
    expect(
      result.rows.map((tuple: any[]) => tuple.map((value: any) => String(value)).join('/')),
    ).toEqual(['app/A', 'app/B', 'app/C', 'bulk/D', 'web/A', 'web/null']);
    const missing = at(result, ['web', null], []);
    expect(values(missing)).toEqual([null]);
    expect(missing[0].comparison).toMatchObject({
      previousValue: 36,
      delta: null,
      percentChange: null,
    });
    // Each row has exactly one cell, and the grand total is the full-filter aggregate.
    expect(result.cells).toHaveLength(result.rows.length);
    expect(result.grandTotal[0].value).toBe(185);
    expect(result.grandTotal[0].comparison).toMatchObject({ previousValue: 126, delta: 59 });
    expect(result.grandTotal[0].comparison.percentChange).toBeCloseTo(46.8254, 3);
  });
});

describe('BiExploreService pivot row sort comparators', () => {
  /** Sort synthetic value tuples with the real comparator and read the values back in order. */
  const order = (values: Array<number | string | null>, direction: 'asc' | 'desc') => {
    const tuples = values.map((_value, index) => [String(index)]);
    const index = new Map(tuples.map((tuple, position) => [JSON.stringify(tuple), position]));
    const at = (tuple: unknown[]) => values[index.get(JSON.stringify(tuple)) as number];
    return sortPivotRows({
      tuples,
      sort: { by: 'value', direction, measureId: 1 },
      hierarchy: false,
      value: at,
      parentValue: () => null,
    }).map(at);
  };

  it('compares integer, decimal and exponent strings by exact magnitude', () => {
    expect(order(['9007199254740993', '9007199254740992'], 'desc')).toEqual([
      '9007199254740993',
      '9007199254740992',
    ]);
    // 1.2e+1 and 12 are the same magnitude, so the tie keeps the input order.
    expect(order([12, '1.2e+1'], 'asc')).toEqual([12, '1.2e+1']);
    expect(order(['0.010', '1e-2', '0.1'], 'asc')).toEqual(['0.010', '1e-2', '0.1']);
    expect(order(['-1234.56', '-2', '10', '-0.5'], 'asc')).toEqual([
      '-1234.56',
      '-2',
      '-0.5',
      '10',
    ]);
  });

  it('keeps a null value last and falls back to text for a non-numeric value', () => {
    expect(order([null, 5, 'abc'], 'asc')).toEqual([5, 'abc', null]);
    expect(order([null, 5, 'abc'], 'desc')).toEqual(['abc', 5, null]);
  });
});

describe('BiExploreService pivot time axis SQL', () => {
  const bucket = (overrides: Partial<PivotBucket> = {}): PivotBucket => ({
    axis: { column: 'event_time', grain: 'day', timeZone: 'Asia/Seoul' },
    civil: false,
    shift: 172800,
    utcShift: true,
    ...overrides,
  });

  it('applies the timestamp shift before the timezone bucket', () => {
    // The +2 day interval must be inside the TIMESTAMPTZ cast so the shift stays absolute UTC seconds.
    expect(pivotAxisExpression('event_time', bucket())).toBe(
      "strftime(date_trunc('day', (CAST((\"event_time\" + INTERVAL '172800 seconds') AS TIMESTAMPTZ) AT TIME ZONE 'Asia/Seoul')), '%Y-%m-%d')",
    );
  });

  it('applies the civil shift after the axis stays a local calendar value', () => {
    expect(
      pivotAxisExpression(
        'day',
        bucket({
          axis: { column: 'day', grain: 'day', timeZone: 'Asia/Seoul' },
          civil: true,
          utcShift: false,
        }),
      ),
    ).toBe("strftime(date_trunc('day', (\"day\" + INTERVAL '172800 seconds')), '%Y-%m-%d')");
  });
});
