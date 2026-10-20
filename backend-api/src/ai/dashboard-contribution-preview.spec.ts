jest.mock('./ai.service', () => ({ AiService: class {} }));
import {
  ConflictException,
  ForbiddenException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { AiDashboardService } from './ai-dashboard.service';
import { ConnectionService } from '../connection/connection.service';
import { DuckDBService } from '../analysis/duckdb.service';
import { UserMapping } from '../user/entities/user-mapping.entity';
import { contributionGroupFingerprint } from './dashboard-contribution';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

describe('aggregate inputs: actual DuckDB, stored definitions and snapshots', () => {
  let root: string;
  let worker: DuckDBService;
  let connection: ConnectionService;
  let service: AiDashboardService;
  let filename: string;
  let files: string[];
  let stored: any;
  const oldRoot = process.env.FILE_UPLOAD_DIR;
  const numeric = (expression = 'sum(amount)') => ({
    title: 'Metric',
    description: '',
    type: 'BOARD_NUMERIC',
    sql: `SELECT ${expression} AS value FROM source WHERE accepted = true`,
    valueField: 'value',
  });
  const chart = (category = 'channel', tail = 'ORDER BY value DESC LIMIT 2') => ({
    ...numeric(),
    type: 'CHART_COLUMN',
    categoryField: 'dimension',
    sql: `SELECT ${category} AS dimension, sum(amount) AS value FROM source WHERE accepted = true GROUP BY ${category} ${tail}`,
  });
  const definition = (widget = numeric()) => ({
    databaseId: 1,
    title: 'Contributors',
    explanation: '',
    widgets: [widget],
  });
  const saveDefinition = (widget = numeric()) => {
    stored.analysisDefinition = JSON.stringify(definition(widget));
  };
  beforeAll(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'contribution-preview-'));
    process.env.FILE_UPLOAD_DIR = root;
    worker = new DuckDBService();
    const csv =
      'row_id,channel,event_time,amount,refund,weight,accepted,contributionComponents,__vm_contribution_0\n' +
      '1,online,2026-01-01 10:00:00,100,10,2,true,original,false\n' +
      '2,online,2026-01-01 11:00:00,0,0,0,true,original,false\n' +
      '3,online,2026-01-02 10:00:00,,5,3,true,original,false\n' +
      '4,retail,2026-01-02 10:00:00,200,,4,true,original,false\n' +
      '5,retail,2026-01-02 11:00:00,-10,,1,true,original,false\n' +
      '6,retail,2026-01-03 10:00:00,10,1,,true,original,false\n' +
      '7,,2026-01-03 11:00:00,20,,,true,original,false\n' +
      '8,online,2026-01-04 10:00:00,50,0,2,false,original,false\n' +
      '9,online,2026-01-05 10:00:00,30,3,3,true,original,false\n' +
      "10,online') OR true --,2026-01-05 11:00:00,9,,1,true,original,false\n" +
      '11,retail,2026-01-06 10:00:00,,,2,true,original,false\n' +
      '12,online,2026-01-06 11:00:00,5,1,1,true,original,false\n' +
      '1,online,2026-01-01 10:00:00,100,10,2,true,original,false\n';
    files = [
      (await worker.importFile({ originalname: 'inputs.csv', buffer: Buffer.from(csv) })).filename,
      (
        await worker.importFile({
          originalname: 'replacement.csv',
          buffer: Buffer.from(
            'row_id,channel,event_time,amount,refund,weight,accepted\n99,replacement,2026-02-01 00:00:00,999,99,9,true\n',
          ),
        })
      ).filename,
    ];
  });
  beforeEach(() => {
    filename = files[0];
    stored = {
      id: 42,
      delYn: 'N',
      title: 'Contributors',
      layout: JSON.stringify([{ i: '5', x: 0, y: 0, w: 6, h: 3 }]),
      structuredDefinition: null,
      analysisDefinition: JSON.stringify(definition()),
    };
    const source = {
      manager: { connection: { options: { type: 'mysql' } } },
      findOne: jest.fn(async () => ({
        connectionConfig: JSON.stringify({ client: 'duckdb', connection: { filename } }),
      })),
    };
    connection = new ConnectionService(source as any, {} as any, worker);
    const manager = {
      find: jest.fn().mockResolvedValue([{ widgetId: 5 }]),
      findOne: jest.fn(async (entity, options) =>
        entity === UserMapping ? (options.where.userInfoId === 7 ? { id: 1 } : null) : stored,
      ),
    };
    service = new AiDashboardService({} as any, connection, { manager } as any);
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    await worker?.onModuleDestroy();
    fs.rmSync(root, { recursive: true, force: true });
    if (oldRoot === undefined) delete process.env.FILE_UPLOAD_DIR;
    else process.env.FILE_UPLOAD_DIR = oldRoot;
  });
  const request = async (contribution: any = {}, options: any = {}) => {
    const saved = (await service.analysis(42, 7, true)).data;
    const preview = (
      await service.preview({ draft: saved, ...options, trendGrain: contribution.trendGrain }, 7)
    ).data;
    return {
      dashboardId: 42,
      draft: saved,
      sourceRevision: preview.sourceRevision,
      ...options,
      contribution: {
        widgetIndex: 0,
        expectedRevision: saved.revision,
        ...(preview.widgets[0].contribution.groupFingerprint
          ? { groupFingerprint: preview.widgets[0].contribution.groupFingerprint }
          : {}),
        ...contribution,
      },
    };
  };
  const details = async (contribution: any = {}, options: any = {}) =>
    (await service.details(await request(contribution, options), 7)).data;
  const ids = (data: any) => data.datas.map(row => row.row_id);

  const trendRequest = async (options: any = {}, time?: string) => {
    const saved = (await service.analysis(42, 7, true)).data;
    const preview = (await service.preview({ draft: saved, includeTrends: true, ...options }, 7))
      .data;
    const trend = preview.widgets[0].trend;
    return {
      dashboardId: 42,
      draft: saved,
      sourceRevision: preview.sourceRevision,
      ...options,
      contribution: {
        widgetIndex: 0,
        expectedRevision: saved.revision,
        trendGrain: options.trendGrain,
        trendPoint: {
          column: trend.column,
          grain: trend.grain,
          time: time ?? trend.points[0].time,
          groupFingerprint: trend.contribution.groupFingerprint,
        },
      },
    };
  };

  it('applies numeric ranges to raw and contribution details and rejects nonnumeric ranges on both paths', async () => {
    const options = { filters: [{ column: 'amount', range: { min: 9, max: 10 } }] };
    const body = await request({}, options);
    expect((await service.details(body, 7)).data.totalRows).toBe('2');
    expect(ids((await service.details(body, 7)).data)).toEqual([6, 10]);
    const { contribution, ...raw } = body;
    expect(contribution.widgetIndex).toBe(0);
    expect(ids((await service.details(raw, 7)).data)).toEqual([6, 10]);
    for (const candidate of [body, raw]) {
      for (const column of ['channel', 'event_time']) {
        await expect(
          service.details({ ...candidate, filters: [{ column, range: { min: 0 } }] }, 7),
        ).rejects.toThrow('numeric');
      }
    }
  });
  it('drills an auto-hour KPI point into its exact input rows without changing common scope', async () => {
    const body = await trendRequest();
    expect(body.contribution.trendPoint.grain).toBe('hour');
    const result = (await service.details(body, 7)).data;
    expect(ids(result)).toEqual([1, 1]);
    expect(result.totalRows).toBe('2');
    expect(result.contribution.title).toBe('Metric');
    expect(result.contribution.trendPoint).toEqual(body.contribution.trendPoint);
    expect(result.contribution).not.toHaveProperty('category');
    expect(result.contribution).not.toHaveProperty('groupFingerprint');
    expect(body).not.toHaveProperty('dateRange');
  });
  it('includes NULL-valued points in the fingerprint and retains denominator-only weighted input', async () => {
    saveDefinition(numeric('sum(amount * weight) / nullif(sum(weight), 0)'));
    const saved = (await service.analysis(42, 7, true)).data;
    const trend = (await service.preview({ draft: saved, includeTrends: true }, 7)).data.widgets[0]
      .trend;
    expect(trend.points.find(point => point.time === '2026-01-06T10:00:00Z').value).toBeNull();
    expect(trend.contribution).toEqual({
      supported: true,
      groupFingerprint: contributionGroupFingerprint(trend.points.map(point => point.time)),
    });
    const result = (await service.details(await trendRequest({}, '2026-01-06T10:00:00Z'), 7)).data;
    expect(ids(result)).toEqual([11]);
    expect(result.contributionComponents).toEqual([['SUM(weight)']]);
    saveDefinition(numeric());
    const nullSum = (await service.details(await trendRequest({}, '2026-01-06T10:00:00Z'), 7)).data;
    expect(nullSum.totalRows).toBe('0');
    expect(nullSum.datas).toEqual([]);
  });
  it.each(['day', 'week', 'month'] as const)(
    'clips a selected %s point to existing filters and partial UTC range',
    async grain => {
      const options = {
        trendGrain: grain,
        filters: [{ column: 'channel', values: ['online'] }],
        dateRange: {
          column: 'event_time',
          start: '2026-01-01T10:30:00Z',
          end: '2026-01-06T10:30:00Z',
          precision: 'timestamp',
        },
      };
      const body = await trendRequest(options);
      const result = (await service.details(body, 7)).data;
      expect(ids(result)).toEqual(grain === 'month' ? [2, 9] : [2]);
      expect(result.datas.every(row => row.accepted === true && row.channel === 'online')).toBe(
        true,
      );
      expect(body.dateRange).toEqual(options.dateRange);
    },
  );
  it.each([
    { category: null },
    { groupFingerprint: 'a'.repeat(64) },
    { trendPoint: null },
    { trendPoint: undefined },
    {
      trendPoint: {
        column: 'event_time',
        grain: 'hour',
        time: '2026-01-01T10:00:00Z',
        groupFingerprint: 'a'.repeat(64),
        extra: true,
      },
    },
    {
      trendPoint: {
        column: 'event_time',
        grain: 'hour',
        time: '2026-02-30T10:00:00Z',
        groupFingerprint: 'a'.repeat(64),
      },
    },
    {
      trendPoint: {
        column: 'event_time',
        grain: 'minute',
        time: '2026-01-01T10:00:00Z',
        groupFingerprint: 'a'.repeat(64),
      },
    },
    {
      trendPoint: {
        column: 'event_time',
        grain: 'hour',
        time: "2026-01-01') OR TRUE --",
        groupFingerprint: 'a'.repeat(64),
      },
    },
  ])('rejects mixed or malformed trend point contexts before queries: %j', async invalid => {
    const body = await trendRequest();
    const spy = jest.spyOn(connection, 'queryDuckDB');
    await expect(
      service.details({ ...body, contribution: { ...body.contribution, ...invalid } }, 7),
    ).rejects.toThrow();
    expect(spy).not.toHaveBeenCalled();
  });
  it('rejects stale time, auto grain, temporal column and fingerprint before count on every page', async () => {
    const body = await trendRequest();
    const spy = jest.spyOn(connection, 'queryDuckDB');
    for (const point of [
      { time: '2026-01-01T09:00:00Z' },
      { column: 'amount' },
      { grain: 'day' },
      { groupFingerprint: '0'.repeat(64) },
    ])
      for (const page of [0, 1]) {
        await expect(
          service.details(
            {
              ...body,
              page,
              contribution: {
                ...body.contribution,
                trendPoint: { ...body.contribution.trendPoint, ...point },
              },
            },
            7,
          ),
        ).rejects.toBeInstanceOf(ConflictException);
      }
    expect(spy.mock.calls.every(([, sql]) => !sql.includes('CAST(count(*) AS VARCHAR)'))).toBe(
      true,
    );
  });
  it('rejects chart trendPoint contexts and unsupported KPI lineage', async () => {
    const body = await trendRequest();
    saveDefinition(chart());
    const saved = (await service.analysis(42, 7, true)).data;
    await expect(
      service.details(
        {
          ...body,
          draft: saved,
          contribution: { ...body.contribution, expectedRevision: saved.revision },
        },
        7,
      ),
    ).rejects.toThrow('invalid contribution request');
    saveDefinition(numeric('sum(DISTINCT amount)'));
    const next = (await service.analysis(42, 7, true)).data;
    const trend = (await service.preview({ draft: next, includeTrends: true }, 7)).data.widgets[0]
      .trend;
    expect(trend.contribution.supported).toBe(false);
    await expect(
      service.details(
        {
          ...body,
          draft: next,
          contribution: { ...body.contribution, expectedRevision: next.revision },
        },
        7,
      ),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });
  it('preserves trend ownership, pinned source and final canonical definition checks', async () => {
    const body = await trendRequest();
    await expect(service.details(body, 8)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.details({ ...body, sourceRevision: 'stale' }, 7)).rejects.toBeInstanceOf(
      ConflictException,
    );
    const run = worker.query.bind(worker);
    const spy = jest.spyOn(worker, 'query').mockImplementation(async (file, sql, bindings) => {
      if (sql.includes('strftime(')) filename = files[1];
      return run(file, sql, bindings);
    });
    const result = (await service.details(body, 7)).data;
    expect(ids(result)).toEqual([1, 1]);
    expect(result.sourceRevision).toBe(body.sourceRevision);
    expect(spy.mock.calls.every(([file]) => file === files[0])).toBe(true);
    spy.mockRestore();
    filename = files[0];
    jest.spyOn(worker, 'query').mockImplementation(async (file, sql, bindings) => {
      const result = await run(file, sql, bindings);
      if (sql.includes('AS "__vm_contribution_0"')) saveDefinition(numeric('avg(amount)'));
      return result;
    });
    await expect(service.details(body, 7)).rejects.toBeInstanceOf(ConflictException);
  });

  it.each([
    ['2026-01-12', 'day'],
    ['2027-01-01', 'week'],
    ['2030-01-01', 'month'],
  ])(
    'reconstructs auto grain %s from the same full-source stats even with excluded far rows',
    async (end, grain) => {
      const original = filename;
      filename = (
        await worker.importFile({
          originalname: 'auto.csv',
          buffer: Buffer.from(
            `row_id,event_time,amount,accepted\n1,2026-01-01 10:00:00,10,true\n2,${end} 10:00:00,999,false\n`,
          ),
        })
      ).filename;
      try {
        const body = await trendRequest();
        expect(body.contribution.trendPoint.grain).toBe(grain);
        const result = (await service.details(body, 7)).data;
        expect(ids(result)).toEqual([1]);
        expect(result.contribution.trendPoint).toEqual(body.contribution.trendPoint);
      } finally {
        filename = original;
      }
    },
  );
  it('declines KPI contributor queries over 240 trend points without returning truncated inputs', async () => {
    const original = filename;
    filename = (
      await worker.importFile({
        originalname: 'many-times.csv',
        buffer: Buffer.from(
          'row_id,event_time,amount,accepted\n' +
            Array.from(
              { length: 241 },
              (_, i) => `${i},${new Date(Date.UTC(2026, 0, 1 + i)).toISOString()},1,true`,
            ).join('\n') +
            '\n',
        ),
      })
    ).filename;
    try {
      const body = await request({ trendGrain: 'day' });
      const preview = (
        await service.preview({ draft: body.draft, includeTrends: true, trendGrain: 'day' }, 7)
      ).data.widgets[0];
      expect(preview.trend).toBeUndefined();
      expect(preview.trendUnavailable).toContain('240');
      await expect(
        service.details(
          {
            ...body,
            contribution: {
              ...body.contribution,
              trendPoint: {
                column: 'event_time',
                grain: 'day',
                time: '2026-01-01T00:00:00Z',
                groupFingerprint: '0'.repeat(64),
              },
            },
          },
          7,
        ),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    } finally {
      filename = original;
    }
  });

  it('returns original WHERE inputs, retaining zeros and physical duplicates with collision-safe component metadata', async () => {
    const result = await details();
    expect(result.totalRows).toBe('10');
    expect(ids(result)).toEqual([1, 1, 2, 4, 5, 6, 7, 9, 10, 12]);
    expect(result.datas.reduce((sum, row) => sum + row.amount, 0)).toBe(464);
    expect(result.scope).toBe('widget aggregate input rows');
    expect(result.contribution.components).toEqual(['SUM(amount)']);
    expect(result.contributionComponents).toEqual(Array(10).fill(['SUM(amount)']));
    expect(
      result.datas.every(
        row => row.contributionComponents === 'original' && row.__vm_contribution_0 === false,
      ),
    ).toBe(true);
    expect(result.fields.map(field => field.columnName)).not.toContain('__vm_detail_0');
  });
  it.each([
    ['avg(amount)', 10],
    ['count(amount)', 10],
    ['count(*)', 12],
    ['count_if(amount > 0)', 8],
    ['min(amount)', 10],
    ['max(amount)', 10],
  ] as const)('includes the exact eligible inputs for %s', async (measure, count) => {
    saveDefinition(numeric(measure));
    const result = await details();
    expect(result.totalRows).toBe(String(count));
    if (/min|max/.test(measure)) {
      expect(ids(result)).toContain(5);
      expect(ids(result)).toContain(4);
      expect(result.contribution.semantics).toContain('모든 비NULL 입력');
    }
  });
  it('returns a ratio union with numerator-only and denominator-only input component labels', async () => {
    saveDefinition(numeric('sum(refund) / nullif(sum(amount), 0)'));
    const result = await details();
    expect(result.totalRows).toBe('11');
    const refundOnly = ids(result).indexOf(3),
      amountOnly = ids(result).indexOf(4);
    expect(result.contributionComponents[refundOnly]).toEqual(['SUM(refund)']);
    expect(result.contributionComponents[amountOnly]).toEqual(['SUM(amount)']);
    expect(result.contributionComponents[ids(result).indexOf(2)]).toEqual([
      'SUM(refund)',
      'SUM(amount)',
    ]);
    expect(ids(result)).not.toContain(11);
  });
  it('uses evaluated weighted/CASE arguments rather than guessing source nonnull columns', async () => {
    saveDefinition(numeric('sum(amount * weight) / nullif(sum(weight), 0)'));
    const result = await details();
    expect(result.totalRows).toBe('10');
    expect(result.contributionComponents[ids(result).indexOf(3)]).toEqual(['SUM(weight)']);
    expect(ids(result)).not.toContain(6);
    expect(ids(result)).not.toContain(7);
    expect(result.contributionComponents[ids(result).indexOf(2)]).toEqual([
      'SUM(amount * weight)',
      'SUM(weight)',
    ]);
    saveDefinition(numeric('sum(CASE WHEN amount > 0 THEN amount END)'));
    expect((await details()).totalRows).toBe('8');
  });
  it('restricts whole and selected top-N chart details to displayed groups and rejects hidden NULL groups', async () => {
    saveDefinition(chart());
    const whole = await details();
    expect(whole.totalRows).toBe('8');
    expect(new Set(whole.datas.map(row => row.channel))).toEqual(new Set(['online', 'retail']));
    const selected = await details({ category: 'online' });
    expect(selected.totalRows).toBe('5');
    expect(selected.datas.every(row => row.channel === 'online')).toBe(true);
    expect(selected.contribution.category).toBe('online');
    expect(selected.contribution.groupFingerprint).toMatch(/^[a-f0-9]{64}$/);
    await expect(details({ category: null })).rejects.toBeInstanceOf(ConflictException);
  });
  it('binds a displayed injection-looking category and distinguishes selected NULL from omitted category', async () => {
    saveDefinition(chart('channel', 'ORDER BY value DESC LIMIT 500'));
    const value = "online') OR true --";
    const spy = jest.spyOn(connection, 'queryDuckDB');
    const injected = await details({ category: value });
    expect(ids(injected)).toEqual([10]);
    expect(
      spy.mock.calls
        .filter(([, sql]) => sql.includes('__vm_detail_'))
        .every(([, sql, bindings]) => !sql.includes(value) && bindings.includes(value)),
    ).toBe(true);
    const empty = await details({ category: null });
    expect(ids(empty)).toEqual([7]);
    expect(empty.contribution).toHaveProperty('category', null);
    const whole = await details();
    expect(whole.totalRows).toBe('10');
    expect(whole.contribution).not.toHaveProperty('category');
  });
  it.each(['day', 'week', 'month'] as const)(
    'matches original and effective UTC %s groups with current filters/dates',
    async grain => {
      saveDefinition({
        ...chart("date_trunc('day', event_time)", 'ORDER BY dimension LIMIT 500'),
        type: 'CHART_LINE',
      });
      const options = {
        filters: [{ column: 'channel', values: ['online'] }],
        dateRange: { column: 'event_time', start: '2026-01-01', end: '2026-01-02' },
      };
      const body = await request({ trendGrain: grain }, options);
      const preview = (
        await service.preview({ draft: body.draft, ...options, trendGrain: grain }, 7)
      ).data.widgets[0];
      const result = (
        await service.details(
          { ...body, contribution: { ...body.contribution, category: preview.datas[0].dimension } },
          7,
        )
      ).data;
      expect(ids(result)).toEqual([1, 1, 2]);
      expect(result.contribution.category).toBe(preview.datas[0].dimension);
      const auto = await details({ trendGrain: 'auto', category: '2026-01-01 00:00:00' }, options);
      expect(ids(auto)).toEqual([1, 1, 2]);
    },
  );
  it('preserves raw common-filter row mode and all NULL inputs', async () => {
    const body = await request();
    delete body.contribution;
    const raw = (await service.details(body, 7)).data;
    expect(raw.scope).toBe('current common-filter source rows');
    expect(raw.totalRows).toBe('13');
    expect(raw).not.toHaveProperty('contributionComponents');
  });
  it('explicitly declines DISTINCT/HAVING/windows and computed categories without raw fallback', async () => {
    for (const widget of [
      numeric('sum(DISTINCT amount)'),
      {
        ...chart(),
        sql: chart().sql.replace('ORDER BY value', 'HAVING sum(amount)>0 ORDER BY value'),
      },
      {
        ...chart(),
        sql: chart()
          .sql.replace('channel AS dimension', 'lower(channel) AS dimension')
          .replace('GROUP BY channel', 'GROUP BY lower(channel)'),
      },
    ]) {
      saveDefinition(widget);
      const body = await request();
      expect(
        (await service.preview({ draft: body.draft }, 7)).data.widgets[0].contribution.supported,
      ).toBe(false);
      if (widget.type !== 'BOARD_NUMERIC')
        body.contribution.groupFingerprint = contributionGroupFingerprint([]);
      await expect(service.details(body, 7)).rejects.toBeInstanceOf(UnprocessableEntityException);
    }
  });
  it('checks owner, source version, stored revision and canonical draft before contribution queries', async () => {
    const body = await request();
    const spy = jest.spyOn(connection, 'queryDuckDB');
    await expect(service.details(body, 8)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.details({ ...body, sourceRevision: 'old-file' }, 7),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      service.details(
        { ...body, contribution: { ...body.contribution, expectedRevision: '0'.repeat(64) } },
        7,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      service.details({ ...body, draft: { ...body.draft, title: 'unsaved' } }, 7),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      service.details({ ...body, draft: { ...body.draft, databaseId: 2 } }, 7),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(spy).not.toHaveBeenCalled();
  });
  it('rechecks a definition changed during row queries before returning any results', async () => {
    const body = await request();
    const run = worker.query.bind(worker);
    jest.spyOn(worker, 'query').mockImplementation(async (file, sql, bindings) => {
      const result = await run(file, sql, bindings);
      if (sql.includes('AS "__vm_contribution_0"')) saveDefinition(numeric('avg(amount)'));
      return result;
    });
    await expect(service.details(body, 7)).rejects.toBeInstanceOf(ConflictException);
  });
  it('pins group/count/row queries to one file during atomic source replacement', async () => {
    saveDefinition(chart());
    const body = await request();
    const run = worker.query.bind(worker);
    const spy = jest.spyOn(worker, 'query').mockImplementation(async (file, sql, bindings) => {
      if (sql.includes('GROUP BY channel')) filename = files[1];
      return run(file, sql, bindings);
    });
    const result = (await service.details(body, 7)).data;
    expect(result.totalRows).toBe('8');
    expect(result.sourceRevision).toBe(body.sourceRevision);
    expect(spy.mock.calls.every(([file]) => file === files[0])).toBe(true);
    await expect(service.details(body, 7)).rejects.toBeInstanceOf(ConflictException);
  });
  it('rejects changed displayed group fingerprints on every page before count or row queries', async () => {
    saveDefinition(chart());
    const body = await request();
    const run = connection.queryDuckDB.bind(connection);
    const spy = jest
      .spyOn(connection, 'queryDuckDB')
      .mockImplementation(async (id, sql, bindings) => {
        const result = await run(id, sql, bindings);
        if (sql.includes('GROUP BY channel'))
          result.datas = [
            { dimension: 'retail', value: 200 },
            { dimension: null, value: 200 },
          ];
        return result;
      });
    for (const page of [0, 1]) {
      await expect(service.details({ ...body, page }, 7)).rejects.toBeInstanceOf(ConflictException);
    }
    expect(
      spy.mock.calls.every(
        ([, sql]) =>
          !sql.includes('AS "__vm_contribution_0"') && !sql.includes('CAST(count(*) AS VARCHAR)'),
      ),
    ).toBe(true);
  });
  it('requires the preview group fingerprint and rejects stale selected categories before counting', async () => {
    saveDefinition(chart());
    const body = await request();
    const spy = jest.spyOn(connection, 'queryDuckDB');
    const missing = { ...body, contribution: { ...body.contribution } };
    delete missing.contribution.groupFingerprint;
    await expect(service.details(missing, 7)).rejects.toThrow('invalid contribution request');
    expect(spy).not.toHaveBeenCalled();
    await expect(
      service.details(
        { ...body, contribution: { ...body.contribution, category: 'not-displayed' } },
        7,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(spy.mock.calls.every(([, sql]) => !sql.includes('CAST(count(*) AS VARCHAR)'))).toBe(
      true,
    );
  });
  it('keeps empty displayed groups stable and returns no inferred raw rows', async () => {
    saveDefinition({
      ...chart(),
      sql: chart().sql.replace('accepted = true', "accepted = true AND channel = 'absent'"),
    });
    const result = await details();
    expect(result.totalRows).toBe('0');
    expect(result.datas).toEqual([]);
    expect(result.contributionComponents).toEqual([]);
    expect(result.contribution.groupFingerprint).toBe(contributionGroupFingerprint([]));
  });
  it('declines aggregate input details over the displayed group cap', async () => {
    const original = filename;
    filename = (
      await worker.importFile({
        originalname: 'groups.csv',
        buffer: Buffer.from(
          'channel,amount,accepted\n' +
            Array.from({ length: 241 }, (_, i) => `group-${i},1,true`).join('\n') +
            '\n',
        ),
      })
    ).filename;
    saveDefinition(chart('channel', 'ORDER BY value DESC LIMIT 500'));
    try {
      const body = await request({ groupFingerprint: '0'.repeat(64) });
      expect(
        (await service.preview({ draft: body.draft }, 7)).data.widgets[0].contribution.supported,
      ).toBe(false);
      await expect(service.details(body, 7)).rejects.toBeInstanceOf(UnprocessableEntityException);
    } finally {
      filename = original;
    }
  });
  it('keeps the 50-column safe projection and exact count independent of row pagination', async () => {
    const original = filename;
    const columns = [
      'row_id',
      'amount',
      'accepted',
      ...Array.from({ length: 52 }, (_, i) => `extra_${i}`),
    ];
    filename = (
      await worker.importFile({
        originalname: 'wide.csv',
        buffer: Buffer.from(
          columns.join(',') +
            '\n' +
            Array.from({ length: 30 }, (_, i) =>
              [i, i, 'true', ...Array(52).fill(i)].join(','),
            ).join('\n') +
            '\n',
        ),
      })
    ).filename;
    try {
      const first = await details({}, { pageSize: 25 });
      const second = await details({}, { pageSize: 25, page: 1 });
      expect(first.fields).toHaveLength(50);
      expect(first.columnCount).toBe(55);
      expect(first.totalRows).toBe('30');
      expect(first.datas).toHaveLength(25);
      expect(second.datas).toHaveLength(5);
      expect(new Set([...ids(first), ...ids(second)]).size).toBe(30);
      expect(second.contributionComponents).toHaveLength(5);
    } finally {
      filename = original;
    }
  });
});
