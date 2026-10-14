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
import { EXPORT_COLUMNS, EXPORT_LIMITS, ExportEntry, toCsv } from './bi-explore-export';
import { BiExploreService } from './bi-explore.service';
import { BiService } from './bi.service';

describe('BiExploreService CSV export serializer', () => {
  const entry = (overrides: Partial<ExportEntry> = {}): ExportEntry => ({
    section: 'kpi',
    rowAxis: null,
    columnAxis: null,
    measureId: 1,
    measureLabel: 'Revenue',
    value: 10,
    ...overrides,
  });
  /** Header is line 0; the trailing CRLF is dropped so the last element is the final row. */
  const dataLines = (csv: string) => {
    const lines = csv.slice(1).split('\r\n');
    lines.pop();
    return lines;
  };
  const csvOf = (entries: ExportEntry[], conditions?: Record<string, unknown>) =>
    toCsv(entries, conditions).csv;

  it('writes a UTF-8 BOM header, CRLF rows and leading condition rows', () => {
    const { csv, rowCount, bytes } = toCsv([entry()], { sourceId: 1, sourceRevision: 'abc' });
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).not.toContain('\n\r');
    const lines = dataLines(csv);
    expect(lines[0]).toBe(EXPORT_COLUMNS.map(column => `"${column}"`).join(','));
    expect(lines[1]).toBe('"condition","{""field"":""sourceId""}",,,,"1",string,,,,');
    expect(lines[2]).toBe('"condition","{""field"":""sourceRevision""}",,,,"""abc""",string,,,,');
    expect(lines[3].startsWith('"kpi",,,"1","Revenue","10",number')).toBe(true);
    // The condition rows count toward the row total and the reported byte length.
    expect(rowCount).toBe(3);
    expect(bytes).toBe(Buffer.byteLength(csv, 'utf8'));
  });

  it('quotes every field and doubles embedded quotes while keeping newlines', () => {
    const { csv } = toCsv([entry({ measureLabel: 'He said "hi"\nnext', value: 'a,b' })]);
    const line = dataLines(csv)[1];
    expect(line).toContain('"He said ""hi""\nnext"');
    expect(line).toContain('"a,b"');
  });

  it('neutralizes a formula trigger in labels and string values', () => {
    expect(dataLines(csvOf([entry({ measureLabel: '=cmd' })]))[1]).toContain('"\'=cmd"');
    expect(dataLines(csvOf([entry({ value: '@x' })]))[1]).toContain('"\'@x"');
    expect(dataLines(csvOf([entry({ value: '  =x' })]))[1]).toContain('"\'  =x"');
    expect(dataLines(csvOf([entry({ value: '-5%' })]))[1]).toContain('"\'-5%"');
    expect(dataLines(csvOf([entry({ value: 'safe' })]))[1]).toContain('"safe"');
    // A label that is a plain integer is still text, so it stays protected.
    expect(dataLines(csvOf([entry({ measureLabel: '-5' })]))[1]).toContain('"\'-5"');
  });

  it('keeps negative numbers and large integer strings exact without an apostrophe', () => {
    const negative = dataLines(csvOf([entry({ value: -5 })]))[1];
    expect(negative).toContain(',"-5",number,');
    expect(negative).not.toContain("'");
    const bigint = dataLines(csvOf([entry({ value: '-12345678901234567890' })]))[1];
    expect(bigint).toContain(',"-12345678901234567890",string,');
    expect(bigint).not.toContain("'");
    const compared = dataLines(
      csvOf([entry({ value: 5, previousValue: 7, delta: -2, percentChange: -28.5714 })]),
    )[1];
    expect(compared).toContain(',"-2","-28.5714",');
    expect(compared).not.toContain("'");
  });

  it('keeps a negative decimal or exponent string exact and still guards a formula', () => {
    // The worker reports DECIMAL/HUGEINT values as text, so a signed decimal must stay a number.
    const decimal = dataLines(csvOf([entry({ value: '-1234.56' })]))[1];
    expect(decimal).toContain(',"-1234.56",string,');
    expect(decimal).not.toContain("'");
    const exponent = dataLines(csvOf([entry({ value: '-1.23e+45' })]))[1];
    expect(exponent).toContain(',"-1.23e+45",string,');
    expect(exponent).not.toContain("'");
    expect(dataLines(csvOf([entry({ value: '1.5' })]))[1]).toContain(',"1.5",string,');
    // A formula-shaped string is not a number, so it stays neutralized.
    expect(dataLines(csvOf([entry({ value: '-1+SUM(A1)' })]))[1]).toContain('"\'-1+SUM(A1)"');
  });

  it('keeps a null blank and apart from a zero through value_type', () => {
    const blank = dataLines(csvOf([entry({ value: null })]))[1];
    expect(blank).toBe('"kpi",,,"1","Revenue",,null,,,,');
    const zero = dataLines(csvOf([entry({ value: 0 })]))[1];
    expect(zero).toBe('"kpi",,,"1","Revenue","0",number,,,,');
  });

  it('rejects more than the row cap and accepts exactly the cap', () => {
    const fill = (count: number) => Array.from({ length: count }, () => entry());
    expect(toCsv(fill(EXPORT_LIMITS.rows)).rowCount).toBe(EXPORT_LIMITS.rows);
    expect(() => toCsv(fill(EXPORT_LIMITS.rows + 1))).toThrow(BadRequestException);
    expect(() => toCsv(fill(EXPORT_LIMITS.rows + 1))).toThrow('넘습니다');
    // Condition rows share the cap, so the payload is what pushes it over.
    expect(() => toCsv(fill(EXPORT_LIMITS.rows), { sourceId: 1 })).toThrow(BadRequestException);
  });

  it('rejects a payload above the byte cap before returning anything', () => {
    const rows = Array.from({ length: 8000 }, () => entry({ value: 'x'.repeat(400) }));
    expect(rows.length).toBeLessThan(EXPORT_LIMITS.rows);
    expect(() => toCsv(rows)).toThrow(BadRequestException);
    expect(() => toCsv(rows)).toThrow('바이트');
  });
});

describe('BiExploreService CSV export over real DuckDB', () => {
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
  const dataLines = (csv: string) => {
    const lines = csv.slice(1).split('\r\n');
    lines.pop();
    return lines;
  };
  const exploreBody = (sourceRevision: string, overrides: any = {}) => ({
    sourceId: 1,
    sourceRevision,
    measureIds: [1, 2],
    rankingMeasureId: 1,
    dimensionColumns: ['region'],
    filters: [],
    dateRange: { column: 'day', start: '2026-01-03', end: '2026-01-04' },
    trendGrain: 'auto',
    comparePrevious: true,
    includeRows: false,
    ...overrides,
  });
  const pivotBody = (sourceRevision: string, overrides: any = {}) => ({
    sourceId: 1,
    sourceRevision,
    measureIds: [1],
    rowColumns: ['region'],
    columnColumns: ['channel'],
    ...overrides,
  });
  const call = (mode: 'explore' | 'pivot', query: any, who = actor) =>
    service.exportCsv({ mode, query }, who);

  beforeAll(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'vm-bi-export-'));
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

  it('exports explore sections with condition rows and no raw model rows', async () => {
    const result: any = await call('explore', exploreBody(await revision()));
    expect(result.sourceRevision).toMatch(revision64);
    expect(result.mimeType).toBe('text/csv;charset=utf-8');
    expect(result.filename).toBe('bi-explore-1.csv');
    expect(result.limits).toEqual({ rows: 10000, bytes: 2097152 });
    const lines = dataLines(result.csv);
    expect(lines.length).toBe(result.rowCount + 1);
    expect(result.bytes).toBe(Buffer.byteLength(result.csv, 'utf8'));
    // Conditions lead the file; nine applied fields are emitted before any value.
    expect(lines.slice(1, 10).every(line => line.startsWith('"condition"'))).toBe(true);
    expect(lines[1]).toBe('"condition","{""field"":""sourceId""}",,,,"1",string,,,,');
    // Range 01-03..01-04 totals 185; the compared period reports 126 with a +59 delta.
    expect(
      lines.some(line => line.startsWith('"kpi",,,"1","Revenue","185",number,"126","59"')),
    ).toBe(true);
    expect(lines.some(line => line.startsWith('"kpi",,,"2","Orders"'))).toBe(true);
    expect(lines.some(line => line.startsWith('"trend","{""time""'))).toBe(true);
    expect(lines.some(line => line.startsWith('"previous_trend","{""time""'))).toBe(true);
    // The leaderboard ranks region by revenue, so the top tuple carries the canonical label.
    expect(
      lines.some(line => line.startsWith('"ranking","{""region"":""A""}",,"1","Revenue","70"')),
    ).toBe(true);
    expect(result.csv).not.toContain('details');
  });

  it('exports pivot cells plus the three canonical totals with catalog labels', async () => {
    const result: any = await call('pivot', pivotBody(await revision()));
    expect(result.filename).toBe('bi-pivot-1.csv');
    const lines = dataLines(result.csv);
    expect(
      lines.some(line =>
        line.startsWith('"cell","{""region"":""A""}","{""channel"":""app""}","1","Revenue","90"'),
      ),
    ).toBe(true);
    expect(
      lines.some(line => line.startsWith('"row_total","{""region"":""A""}",,"1","Revenue","120"')),
    ).toBe(true);
    expect(
      lines.some(line =>
        line.startsWith('"column_total",,"{""channel"":""app""}","1","Revenue","240"'),
      ),
    ).toBe(true);
    expect(lines.some(line => line.startsWith('"grand_total",,,"1","Revenue","311"'))).toBe(true);
    // Eight pivot conditions precede the value rows.
    expect(lines[1]).toBe('"condition","{""field"":""sourceId""}",,,,"1",string,,,,');
  });

  it('reuses the canonical query and pivot entry points instead of re-aggregating', async () => {
    const sourceRevision = await revision();
    const query = exploreBody(sourceRevision);
    const pivot = pivotBody(sourceRevision);
    const querySpy = jest.spyOn(service, 'query');
    const pivotSpy = jest.spyOn(service, 'pivot');
    await service.exportCsv({ mode: 'explore', query }, actor);
    await service.exportCsv({ mode: 'pivot', query: pivot }, actor);
    expect(querySpy).toHaveBeenCalledWith(query, actor);
    expect(pivotSpy).toHaveBeenCalledWith(pivot, actor);
    querySpy.mockRestore();
    pivotSpy.mockRestore();
  });

  it('exports hierarchy subtotals and echoes the applied row ordering', async () => {
    const result: any = await call(
      'pivot',
      pivotBody(await revision(), {
        rowColumns: ['region', 'channel'],
        columnColumns: ['day'],
        rowHierarchy: true,
        rowSort: { by: 'value', direction: 'desc', measureId: 1 },
      }),
    );
    const lines = dataLines(result.csv);
    // The parent total is its own grain (120 for region A) and the parent cell is 30 on 01-01.
    expect(
      lines.some(line =>
        line.startsWith('"subtotal_total","{""region"":""A""}",,"1","Revenue","120",number'),
      ),
    ).toBe(true);
    expect(
      lines.some(line =>
        line.startsWith(
          '"subtotal_cell","{""region"":""A""}","{""day"":""2026-01-01""}","1","Revenue","30",number',
        ),
      ),
    ).toBe(true);
    // The requested ordering is echoed as metadata, never as an expanded presentation.
    expect(lines.find(line => line.includes('rowHierarchy'))).toBe(
      '"condition","{""field"":""rowHierarchy""}",,,,"true",string,,,,',
    );
    const sortMeta = lines.find(line => line.includes('rowSort')) as string;
    expect(sortMeta).toContain('"field"":""rowSort""');
    expect(sortMeta).toContain('""measureId"":1');
  });

  it('rejects raw model rows, an unknown mode or outer field, and a stale revision', async () => {
    const sourceRevision = await revision();
    await expect(
      call('explore', exploreBody(sourceRevision, { includeRows: true })),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.exportCsv({ mode: 'sheet', query: {} }, actor)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      service.exportCsv({ mode: 'explore', query: exploreBody(sourceRevision), extra: 1 }, actor),
    ).rejects.toThrow('unsupported field');
    await expect(service.exportCsv({ mode: 'explore', query: 'x' }, actor)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(call('explore', exploreBody('deadbeef'))).rejects.toBeInstanceOf(
      ConflictException,
    );
    await expect(call('pivot', pivotBody('deadbeef'))).rejects.toBeInstanceOf(ConflictException);
  });

  it('enforces source ownership for both modes', async () => {
    const sourceRevision = await revision();
    await expect(call('explore', exploreBody(sourceRevision), 99)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(call('pivot', pivotBody(sourceRevision), 99)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
