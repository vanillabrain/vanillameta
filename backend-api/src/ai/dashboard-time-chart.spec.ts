import { buildTimeChartQuery, buildTrendQuery, TrendGrain } from './dashboard-trend';
import { DuckDBService } from '../analysis/duckdb.service';
import { sourceQuery } from './dashboard-draft';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const expression = 'sum(revenue) / nullif(sum(impressions), 0)';
const chart = (category = '"day"', value = expression, where = '') =>
  `SELECT ${category} AS dimension, ${value} AS value FROM source${
    where ? ` WHERE ${where}` : ''
  } GROUP BY ${category} ORDER BY dimension LIMIT 500`;

describe('time chart query boundaries', () => {
  it.each([
    '"day"',
    'day',
    'date_trunc(\'day\', "day")',
    'strftime("day", \'%Y-%m-%d\')',
    'strftime(\'%Y-%m-%d\', "day")',
    "strftime(date_trunc('month', \"day\"), '%Y-%m')",
  ])('retains chart aliases for temporal projection %s', category => {
    const result = buildTimeChartQuery(chart(category), 'value', 'dimension', 'day', 'week', [
      'dimension',
      'value',
    ]);
    expect(result).toBeDefined();
    expect(result?.timeField).toBe('dimension');
    expect(result?.valueAlias).toBe('value');
    expect(result?.sql).toContain(`${expression} AS "value"`);
    expect(result?.sql).toContain('date_trunc(\'week\', "day")');
    expect(result?.sql).toMatch(/LIMIT 241$/);
  });
  it('preserves escaped literal WHERE values and aggregate CASE formulas', () => {
    const aggregate =
      'CASE WHEN MIN(impressions) < 0 THEN NULL ELSE SUM(revenue * impressions) / NULLIF(SUM(CASE WHEN revenue IS NOT NULL THEN impressions END), 0) END';
    const where = "device = 'phone''s group' AND revenue IS NOT NULL";
    const result = buildTimeChartQuery(
      chart('"day"', aggregate, where),
      'value',
      'dimension',
      'day',
      'month',
    );
    expect(result?.sql).toContain(`${aggregate} AS "value"`);
    expect(result?.sql).toContain(`WHERE ${where} GROUP BY`);
  });
  it.each([
    'ORDER BY dimension LIMIT 500',
    'ORDER BY dimension ASC LIMIT 500',
    'ORDER BY "dimension" ASC LIMIT 241',
    'ORDER BY dimension',
    '',
  ])('allows chronological or unlimited chart shape %s', tail => {
    const sql = chart().replace('ORDER BY dimension LIMIT 500', tail);
    expect(buildTimeChartQuery(sql, 'value', 'dimension', 'day', 'week')).toBeDefined();
  });
  it.each([
    'ORDER BY value DESC LIMIT 1',
    'ORDER BY value DESC LIMIT 500',
    'ORDER BY value ASC LIMIT 500',
    'ORDER BY value',
    'ORDER BY dimension DESC LIMIT 500',
    'ORDER BY dimension LIMIT 1',
    'ORDER BY dimension ASC LIMIT 240',
    'LIMIT 500',
    'ORDER BY dimension LIMIT 9007199254740993',
  ])('rejects selection-defining chart shape %s', tail => {
    const sql = chart().replace('ORDER BY dimension LIMIT 500', tail);
    expect(buildTimeChartQuery(sql, 'value', 'dimension', 'day', 'week')).toBeUndefined();
  });
  it.each([
    chart('device'),
    chart('d ay'),
    chart('"other_day"'),
    chart('lower(device)'),
    chart('strftime("day", \'%w\')'),
    chart('"day"', 'revenue'),
    chart('"day"', 'sum(revenue) + impressions'),
    chart('"day"', 'sum(max(revenue))'),
    chart('"day"', 'sum(revenue), count(*) AS extra'),
    chart().replace('GROUP BY "day"', 'GROUP BY device'),
    chart().replace('GROUP BY "day"', 'GROUP BY dim ension'),
    chart().replace('GROUP BY "day"', 'GROUP BY "day", device'),
    chart().replace('ORDER BY dimension', 'ORDER BY random()'),
    chart().replace('LIMIT 500', 'LIMIT 500 OFFSET 2'),
    chart().replace('GROUP BY "day"', 'GROUP BY "day" HAVING sum(revenue) > 0'),
    chart('"day"', expression, 'revenue > 0 UNION SELECT * FROM other'),
    chart('"day"', expression, 'revenue > 0; DROP TABLE source'),
    chart('"day"', expression, 'revenue > 0 -- comment'),
    chart('"day"', expression, "query('secret') = 1"),
    chart('"day"', expression, 'revenue OVER () > 0'),
    chart().replace('FROM source', 'FROM other'),
  ])('returns undefined for unsupported or unsafe shape %s', sql => {
    expect(buildTimeChartQuery(sql, 'value', 'dimension', 'day', 'day')).toBeUndefined();
  });
  it('rejects absent, mismatched and unsafe aliases and invalid grains', () => {
    expect(buildTimeChartQuery(chart(), 'value', undefined, 'day', 'day')).toBeUndefined();
    expect(buildTimeChartQuery(chart(), 'value', 'day', 'day', 'day')).toBeUndefined();
    expect(
      buildTimeChartQuery(
        chart().replace('AS dimension', 'AS "x;drop"'),
        'value',
        'x;drop',
        'day',
        'day',
      ),
    ).toBeUndefined();
    expect(
      buildTimeChartQuery(chart(), 'value', 'dimension', 'day', 'year' as TrendGrain),
    ).toBeUndefined();
  });
});

describe('calendar grains with actual DuckDB', () => {
  let root: string;
  let filename: string;
  let worker: DuckDBService;
  const uploadRoot = process.env.FILE_UPLOAD_DIR;
  beforeAll(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'time-chart-'));
    process.env.FILE_UPLOAD_DIR = root;
    worker = new DuckDBService();
    const imported = await worker.importFile({
      originalname: 'metrics.csv',
      buffer: Buffer.from(
        'day,revenue,impressions,device\n' +
          '2025-12-28T00:00:00Z,10,1,phone\n' +
          '2025-12-29T00:00:00Z,60,3,phone\n' +
          '2026-01-01T00:00:00Z,100,1,phone\n' +
          '2026-01-04T00:00:00Z,250,5,phone\n' +
          '2026-01-05T00:00:00Z,16,2,phone\n' +
          '2026-01-07T01:00:00+02:00,30,1,phone\n' +
          '2026-01-08T00:00:00Z,,0,phone\n' +
          '2026-01-01T00:00:00Z,9999,1,excluded\n',
      ),
    });
    filename = imported.filename;
  });
  afterAll(async () => {
    await worker?.onModuleDestroy();
    if (root) fs.rmSync(root, { recursive: true, force: true });
    if (uploadRoot === undefined) delete process.env.FILE_UPLOAD_DIR;
    else process.env.FILE_UPLOAD_DIR = uploadRoot;
  });
  const expected = {
    day: [
      ['2025-12-28', 10],
      ['2025-12-29', 20],
      ['2026-01-01', 100],
      ['2026-01-04', 50],
      ['2026-01-05', 8],
      ['2026-01-06', 30],
      ['2026-01-08', null],
    ],
    week: [
      ['2025-12-22', 10],
      ['2025-12-29', 410 / 9],
      ['2026-01-05', 46 / 3],
    ],
    month: [
      ['2025-12-01', 70 / 4],
      ['2026-01-01', 396 / 9],
    ],
  };
  it('returns 241 points so the caller can detect an oversized chart', async () => {
    const rows = Array.from({ length: 250 }, (_, index) => {
      const day = new Date(Date.UTC(2026, 0, 1) + index * 86400000).toISOString();
      return `${day},1,1,phone`;
    });
    const file = await worker.importFile({
      originalname: 'many-days.csv',
      buffer: Buffer.from(`day,revenue,impressions,device\n${rows.join('\n')}\n`),
    });
    const query = buildTimeChartQuery(chart(), 'value', 'dimension', 'day', 'day');
    if (!query) throw new Error('missing temporal query');
    const wrapped = sourceQuery(query.sql, ['day', 'revenue', 'impressions', 'device']);
    const result = await worker.query(file.filename, wrapped.sql, wrapped.bindings);
    expect(result.datas).toHaveLength(241);
    expect(result.datas[0]).toEqual({ dimension: '2026-01-01T00:00:00Z', value: 1 });
  });
  it.each(['day', 'week', 'month'] as const)(
    'recomputes the weighted ratio at %s grain in UTC',
    async grain => {
      for (const query of [
        buildTimeChartQuery(
          chart('"day"', expression, "device = 'phone'"),
          'value',
          'dimension',
          'day',
          grain,
        ),
        buildTrendQuery(
          `SELECT ${expression} AS value FROM source WHERE device = 'phone'`,
          'value',
          'day',
          grain,
        ),
      ]) {
        expect(query).toBeDefined();
        if (!query) throw new Error('missing temporal query');
        const wrapped = sourceQuery(query.sql, ['day', 'revenue', 'impressions', 'device']);
        const result = await worker.query(filename, wrapped.sql, wrapped.bindings);
        expect(result.datas.map(row => row[query.timeField])).toEqual(
          expected[grain].map(([date]) => `${date}T00:00:00Z`),
        );
        result.datas.forEach((row, i) => {
          const value = expected[grain][i][1];
          if (value === null) expect(row[query.valueAlias]).toBeNull();
          else expect(row[query.valueAlias]).toBeCloseTo(Number(value), 10);
        });
      }
    },
  );
});
