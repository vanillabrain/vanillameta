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
import { previousDateRange } from './dashboard-period';
import { contributionGroupFingerprint } from './dashboard-contribution';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

describe('previous-period contributor points: actual DuckDB', () => {
  let root: string;
  let worker: DuckDBService;
  let connection: ConnectionService;
  let service: AiDashboardService;
  let filename: string;
  let original: string;
  let replacement: string;
  let stored: any;
  const oldRoot = process.env.FILE_UPLOAD_DIR;
  const range = { column: 'event_time', start: '2026-01-08', end: '2026-01-10' };
  const numeric = (expression = 'sum(amount)') => ({
    title: 'Metric',
    description: '',
    type: 'BOARD_NUMERIC',
    sql: `SELECT ${expression} AS value FROM source WHERE accepted = true`,
    valueField: 'value',
  });
  const line = () => ({
    ...numeric(),
    type: 'CHART_LINE',
    categoryField: 'period',
    sql: "SELECT date_trunc('day', event_time) AS period, sum(amount) AS value FROM source WHERE accepted=true GROUP BY period ORDER BY period LIMIT 500",
  });
  const save = (widget = numeric()) => {
    stored.analysisDefinition = JSON.stringify({
      databaseId: 1,
      title: 'Previous',
      explanation: '',
      widgets: [widget],
    });
  };
  beforeAll(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'previous-contributors-'));
    process.env.FILE_UPLOAD_DIR = root;
    worker = new DuckDBService();
    original = (
      await worker.importFile({
        originalname: 'periods.csv',
        buffer: Buffer.from(
          'row_id,event_time,amount,weight,channel,accepted\n' +
            '1,2026-01-05 10:00:00,100,2,online,true\n' +
            '2,2026-01-05 11:00:00,0,0,online,true\n' +
            '3,2026-01-06 10:00:00,,3,online,true\n' +
            '4,2026-01-06 11:00:00,200,4,retail,true\n' +
            '5,2026-01-07 11:00:00,-10,1,online,true\n' +
            '6,2026-01-07 12:00:00,999,9,online,false\n' +
            '7,2026-01-08 10:00:00,50,1,online,true\n' +
            '8,2026-01-09 10:00:00,60,2,online,true\n' +
            '9,2026-01-10 10:00:00,70,3,online,true\n' +
            '10,2026-01-04 23:00:00,5,1,online,true\n',
        ),
      })
    ).filename;
    replacement = (
      await worker.importFile({
        originalname: 'new.csv',
        buffer: Buffer.from(
          'row_id,event_time,amount,weight,channel,accepted\n99,2026-01-05 10:00:00,999,9,online,true\n',
        ),
      })
    ).filename;
  });
  beforeEach(() => {
    filename = original;
    stored = { id: 42, delYn: 'N', title: 'Previous', layout: null, structuredDefinition: null };
    save();
    connection = new ConnectionService(
      {
        findOne: jest.fn(async () => ({
          connectionConfig: JSON.stringify({ client: 'duckdb', connection: { filename } }),
        })),
      } as any,
      {} as any,
      worker,
    );
    const manager = {
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
  const request = async (options: any = {}) => {
    const saved = (await service.analysis(42, 7, true)).data;
    const scope = { comparePrevious: true, dateRange: range, includeTrends: true, ...options };
    const preview = (await service.preview({ draft: saved, ...scope }, 7)).data;
    const widget = preview.widgets[0];
    const contribution: any = {
      widgetIndex: 0,
      expectedRevision: saved.revision,
      period: 'previous',
      trendGrain: options.trendGrain,
    };
    if (widget.type === 'BOARD_NUMERIC') {
      const trend = widget.previousTrend;
      contribution.trendPoint = {
        column: trend.column,
        grain: trend.grain,
        time: trend.points[0].time,
        groupFingerprint: trend.contribution.groupFingerprint,
      };
    } else {
      contribution.category = widget.previousDatas[0].period;
      contribution.groupFingerprint = widget.previousContribution.groupFingerprint;
    }
    return {
      body: {
        dashboardId: 42,
        draft: saved,
        sourceRevision: preview.sourceRevision,
        ...scope,
        contribution,
      },
      widget,
      preview,
    };
  };
  const ids = (result: any) => result.datas.map(row => row.row_id);
  it.each(['auto', 'day', 'week', 'month'])(
    'derives prior %s buckets with identical filters and WHERE and disjoint current rows',
    async grain => {
      const { body, widget } = await request({
        trendGrain: grain,
        filters: [{ column: 'channel', values: ['online'] }],
      });
      const result = (await service.details(body, 7)).data;
      expect(widget.previousTrend.grain).toBe(grain === 'auto' ? 'hour' : grain);
      expect(ids(result)).toEqual(grain === 'auto' ? [1] : grain === 'day' ? [1, 2] : [1, 2, 5]);
      expect(result.contribution.period).toBe('previous');
      expect(result.contribution.dateRange).toEqual(previousDateRange(range));
      expect(result.contribution.trendPoint).toEqual(body.contribution.trendPoint);
      expect(result.contribution.title).toBe('Metric');
      expect(result.contribution).not.toHaveProperty('category');
      expect(result.contribution).not.toHaveProperty('groupFingerprint');
      expect(
        widget.previousTrend.timeSelection.ranges.every(
          r => r.start >= '2026-01-05' && r.end <= '2026-01-08T00:00:00Z',
        ),
      ).toBe(true);
      const currentContribution = { ...body.contribution };
      delete currentContribution.period;
      const current = (
        await service.details(
          {
            ...body,
            contribution: {
              ...currentContribution,
              trendPoint: {
                column: widget.trend.column,
                grain: widget.trend.grain,
                time: widget.trend.points[0].time,
                groupFingerprint: widget.trend.contribution.groupFingerprint,
              },
            },
          },
          7,
        )
      ).data;
      expect(ids(current)).toEqual(grain === 'auto' || grain === 'day' ? [7] : [7, 8, 9]);
      expect(ids(current).every(id => !ids(result).includes(id))).toBe(true);
      expect(body.dateRange).toEqual(range);
    },
  );
  it('retains NULL weighted denominator-only points and returns zero SUM inputs for the same NULL point', async () => {
    save(numeric('sum(amount * weight) / nullif(sum(weight), 0)'));
    const { body, widget } = await request();
    expect(
      widget.previousTrend.points.find(p => p.time === '2026-01-06T10:00:00Z').value,
    ).toBeNull();
    expect(widget.previousTrend.contribution.groupFingerprint).toBe(
      contributionGroupFingerprint(widget.previousTrend.points.map(p => p.time)),
    );
    body.contribution.trendPoint.time = '2026-01-06T10:00:00Z';
    const result = (await service.details(body, 7)).data;
    expect(ids(result)).toEqual([3]);
    expect(result.contributionComponents).toEqual([['SUM(weight)']]);
    save();
    const next = (await request()).body;
    next.contribution.trendPoint.time = '2026-01-06T10:00:00Z';
    expect((await service.details(next, 7)).data.totalRows).toBe('0');
  });
  it('clips prior week/month inputs and time selection to the derived timestamp interval', async () => {
    // Equal 3-day intervals: prior [Jan5 10:30, Jan8 10:30), current [Jan8 10:30, Jan11 10:30).
    const current = {
      column: 'event_time',
      start: '2026-01-08T10:30:00Z',
      end: '2026-01-11T10:30:00Z',
      precision: 'timestamp' as const,
    };
    for (const grain of ['week', 'month']) {
      const { body, widget } = await request({ trendGrain: grain, dateRange: current });
      expect(widget.previousTrend.timeSelection.ranges[0]).toEqual({
        ...current,
        start: '2026-01-05T10:30:00Z',
        end: '2026-01-08T10:30:00Z',
      });
      const result = (await service.details(body, 7)).data;
      expect(ids(result)).toEqual([2, 4, 5, 7]);
      expect(result.contribution.dateRange).toEqual(previousDateRange(current));
    }
  });
  it.each(['auto', 'day', 'week', 'month'])(
    'exposes only proven prior line %s groups and their exact input rows',
    async grain => {
      save(line());
      const { body, widget } = await request({ trendGrain: grain });
      expect(widget.previousContribution.supported).toBe(true);
      expect(widget.previousContribution.components).toEqual(['SUM(amount)']);
      expect(widget.previousTimeSelection.grain).toBe(grain === 'auto' ? 'day' : grain);
      const result = (await service.details(body, 7)).data;
      expect(ids(result)).toEqual(grain === 'auto' || grain === 'day' ? [1, 2] : [1, 2, 4, 5]);
      expect(result.contribution.category).toBe(body.contribution.category);
      expect(result.contribution.groupFingerprint).toBe(
        widget.previousContribution.groupFingerprint,
      );
      expect(result.contribution.dateRange).toEqual(previousDateRange(range));
      expect(result.contribution).not.toHaveProperty('trendPoint');
    },
  );
  it.each([
    { comparePrevious: false },
    { comparePrevious: undefined },
    { dateRange: undefined },
    { contribution: { period: 'current' } },
    { contribution: { period: null } },
    { contribution: { period: 'previous', dateRange: range } },
    { dateRange: { column: 'event_time', start: '0001-01-01', end: '0001-01-02' } },
    { dateRange: { column: 'event_time', start: '2026-02-30', end: '2026-03-01' } },
  ])('rejects disabled comparison, untrusted ranges or invalid period/date: %j', async invalid => {
    const { body } = await request();
    const spy = jest.spyOn(connection, 'queryDuckDB');
    const { contribution, ...overrides } = invalid;
    await expect(
      service.details(
        { ...body, ...overrides, contribution: { ...body.contribution, ...contribution } },
        7,
      ),
    ).rejects.toThrow();
    expect(spy).not.toHaveBeenCalled();
  });
  it('rejects previous whole numeric, whole line, bars and unproven temporal line categories', async () => {
    const { body } = await request();
    delete body.contribution.trendPoint;
    await expect(service.details(body, 7)).rejects.toThrow('invalid previous contribution request');
    save(line());
    const lineBody = (await request()).body;
    delete lineBody.contribution.category;
    await expect(service.details(lineBody, 7)).rejects.toThrow(
      'invalid previous contribution request',
    );
    for (const type of ['CHART_COLUMN', 'CHART_LINE']) {
      save({
        ...line(),
        type,
        sql: 'SELECT channel AS period, sum(amount) AS value FROM source WHERE accepted=true GROUP BY channel ORDER BY period LIMIT 500',
      });
      const saved = (await service.analysis(42, 7, true)).data;
      const preview = (
        await service.preview({ draft: saved, dateRange: range, comparePrevious: true }, 7)
      ).data;
      expect(preview.widgets[0].previousContribution?.supported).not.toBe(true);
      await expect(
        service.details(
          {
            ...lineBody,
            draft: saved,
            sourceRevision: preview.sourceRevision,
            contribution: {
              ...lineBody.contribution,
              expectedRevision: saved.revision,
              category: 'online',
              groupFingerprint: contributionGroupFingerprint(['online', 'retail']),
            },
          },
          7,
        ),
      ).rejects.toThrow();
    }
  });
  it('keeps current responses backward compatible without previous period/range metadata', async () => {
    const { body, widget } = await request();
    delete body.contribution.period;
    body.contribution.trendPoint = {
      column: widget.trend.column,
      grain: widget.trend.grain,
      time: widget.trend.points[0].time,
      groupFingerprint: widget.trend.contribution.groupFingerprint,
    };
    const result = (await service.details(body, 7)).data;
    expect(ids(result)).toEqual([7]);
    expect(result.contribution).not.toHaveProperty('period');
    expect(result.contribution).not.toHaveProperty('dateRange');
  });
  it('checks selected prior time/hash, stored revision, file version and owner on every page before counting', async () => {
    const { body } = await request();
    const spy = jest.spyOn(connection, 'queryDuckDB');
    await expect(service.details(body, 8)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.details({ ...body, sourceRevision: 'stale' }, 7)).rejects.toBeInstanceOf(
      ConflictException,
    );
    for (const patch of [{ time: '2026-01-08T10:00:00Z' }, { groupFingerprint: '0'.repeat(64) }])
      for (const page of [0, 1]) {
        await expect(
          service.details(
            {
              ...body,
              page,
              contribution: {
                ...body.contribution,
                trendPoint: { ...body.contribution.trendPoint, ...patch },
              },
            },
            7,
          ),
        ).rejects.toBeInstanceOf(ConflictException);
      }
    await expect(
      service.details(
        { ...body, contribution: { ...body.contribution, expectedRevision: '0'.repeat(64) } },
        7,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(spy.mock.calls.every(([, sql]) => !sql.includes('CAST(count(*) AS VARCHAR)'))).toBe(
      true,
    );
  });
  it('pins prior group/count/row queries and rechecks the canonical definition before returning', async () => {
    const { body } = await request();
    const run = worker.query.bind(worker);
    const spy = jest.spyOn(worker, 'query').mockImplementation(async (file, sql, bindings) => {
      if (sql.includes('strftime(')) filename = replacement;
      return run(file, sql, bindings);
    });
    const result = (await service.details(body, 7)).data;
    expect(ids(result)).toEqual([1]);
    expect(result.sourceRevision).toBe(body.sourceRevision);
    expect(spy.mock.calls.every(([file]) => file === original)).toBe(true);
    spy.mockRestore();
    filename = original;
    jest.spyOn(worker, 'query').mockImplementation(async (file, sql, bindings) => {
      const result = await run(file, sql, bindings);
      if (sql.includes('__vm_contribution_0')) save(numeric('avg(amount)'));
      return result;
    });
    await expect(service.details(body, 7)).rejects.toBeInstanceOf(ConflictException);
  });
  it.each(['BOARD_NUMERIC', 'CHART_LINE'])(
    'enforces each %s period cap independently and leaves valid prior points actionable',
    async type => {
      const currentStart = Date.UTC(2026, 8, 1);
      const day = 86400000;
      const currentRange = {
        column: 'event_time',
        start: new Date(currentStart).toISOString().slice(0, 10),
        end: new Date(currentStart + 240 * day).toISOString().slice(0, 10),
      };
      const prior = previousDateRange(currentRange);
      for (const manyPrevious of [false, true]) {
        filename = (
          await worker.importFile({
            originalname: 'caps.csv',
            buffer: Buffer.from(
              'row_id,event_time,amount,weight,channel,accepted\n' +
                Array.from(
                  { length: 241 },
                  (_, i) =>
                    `${i},${new Date(
                      (manyPrevious ? currentStart - 241 * day : currentStart) + i * day,
                    ).toISOString()},1,1,online,true`,
                ).join('\n') +
                `\n999,${
                  manyPrevious ? currentRange.start : prior.start
                }T10:00:00Z,10,1,online,true\n`,
            ),
          })
        ).filename;
        save(type === 'BOARD_NUMERIC' ? numeric() : line());
        const saved = (await service.analysis(42, 7, true)).data;
        const preview = (
          await service.preview(
            {
              draft: saved,
              dateRange: currentRange,
              comparePrevious: true,
              includeTrends: true,
              trendGrain: 'day',
            },
            7,
          )
        ).data;
        const widget = preview.widgets[0];
        const contribution: any = {
          widgetIndex: 0,
          expectedRevision: saved.revision,
          period: 'previous',
          trendGrain: 'day',
        };
        if (type === 'BOARD_NUMERIC') {
          if (manyPrevious) {
            expect(widget.previousTrend).toBeUndefined();
            expect(widget.previousTrendUnavailable).toContain('240');
            contribution.trendPoint = {
              column: 'event_time',
              grain: 'day',
              time: prior.start + 'T00:00:00Z',
              groupFingerprint: '0'.repeat(64),
            };
          } else {
            expect(widget.trendUnavailable).toContain('240');
            expect(widget.previousTrend.contribution.supported).toBe(true);
            const trend = widget.previousTrend;
            contribution.trendPoint = {
              column: trend.column,
              grain: trend.grain,
              time: trend.points[0].time,
              groupFingerprint: trend.contribution.groupFingerprint,
            };
          }
        } else {
          if (manyPrevious) {
            expect(widget.previousUnavailable).toContain('240');
            expect(widget.previousContribution.supported).toBe(false);
            contribution.category = prior.start + 'T00:00:00Z';
            contribution.groupFingerprint = '0'.repeat(64);
          } else {
            expect(widget.grainUnavailable).toContain('240');
            expect(widget.previousContribution.supported).toBe(true);
            contribution.category = widget.previousDatas[0].period;
            contribution.groupFingerprint = widget.previousContribution.groupFingerprint;
          }
        }
        const body = {
          dashboardId: 42,
          draft: saved,
          sourceRevision: preview.sourceRevision,
          dateRange: currentRange,
          comparePrevious: true,
          contribution,
        };
        if (manyPrevious)
          await expect(service.details(body, 7)).rejects.toBeInstanceOf(
            UnprocessableEntityException,
          );
        else expect(ids((await service.details(body, 7)).data)).toEqual([999]);
      }
    },
  );
});
