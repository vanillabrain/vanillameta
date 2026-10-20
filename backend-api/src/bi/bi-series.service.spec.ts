jest.mock('../ai/ai.service', () => ({ AiService: class {} }));

import { DuckDBInstance } from '@duckdb/node-api';
import { BiSeriesService } from './bi-series.service';
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';

describe('BiSeriesService bounded comparison', () => {
  let instance: any;
  let session: any;
  let revision: string;
  let service: BiSeriesService;
  let bi: any;
  let snapshot: jest.Mock;
  const actor = 10;
  const measures = [
    { id: 1, label: '매출', unit: 'USD', decimalPlaces: 2 },
    { id: 2, label: '마진율', unit: '%', decimalPlaces: 2 },
    { id: 3, label: '계산 마진율', unit: '%', decimalPlaces: 2 },
  ];
  const defs: Record<number, string> = {
    1: 'SELECT SUM("amount") AS value FROM source',
    2: 'SELECT SUM("profit") / NULLIF(SUM("amount"), 0) * 100 AS value FROM source',
    // The prepared SQL is the canonical output for a stored FORMULA metric as well.
    3: 'SELECT (SUM("amount") - SUM("cost")) / NULLIF(SUM("amount"), 0) * 100 AS value FROM source',
  };
  const data = [
    [null, 100, 20, 80, '2026-01-01'],
    ['null', 100, 40, 60, '2026-01-01'],
    [null, 100, 40, 60, '2026-01-02'],
    ['null', 100, 10, 90, '2026-01-02'],
    ['A', 100, 30, 70, '2026-01-01'],
  ];
  const sqlLiteral = (value: any) =>
    value === null
      ? 'NULL'
      : typeof value === 'number'
      ? String(value)
      : `'${String(value).replace(/'/g, "''")}'`;

  beforeEach(async () => {
    instance = await DuckDBInstance.create(':memory:');
    session = await instance.connect();
    const rows = data.map(row => `(${row.map(sqlLiteral).join(', ')})`).join(', ');
    await session.run(
      `CREATE TABLE uploaded_data AS SELECT CAST(v0 AS VARCHAR) AS company, CAST(v1 AS DOUBLE) AS amount, CAST(v2 AS DOUBLE) AS profit, CAST(v3 AS DOUBLE) AS cost, CAST(v4 AS DATE) AS day, CAST(v0 = 'null' AS BOOLEAN) AS active FROM (VALUES ${rows}) t(v0,v1,v2,v3,v4)`,
    );
    revision = 'a'.repeat(64);
    snapshot = jest.fn((_id: number, callback: () => any) => callback());
    const connection = {
      withDuckDBSnapshot: snapshot,
      duckDBVersion: async () => revision,
      queryDuckDB: async (_id: number, sql: string, bindings: any[] = []) => {
        const result = await session.runAndReadAll(sql, bindings);
        return { datas: result.getRowObjects() };
      },
    };
    bi = {
      metrics: jest.fn(async (_sourceId: number, requester: number) => {
        if (requester !== actor) throw new ForbiddenException('data access denied');
        return measures.map(measure => ({ ...measure }));
      }),
      profile: jest.fn(async () => ({
        supported: true,
        sourceId: 1,
        columns: [
          { name: 'company', type: 'VARCHAR', temporal: false },
          { name: 'amount', type: 'DOUBLE', temporal: false },
          { name: 'profit', type: 'DOUBLE', temporal: false },
          { name: 'cost', type: 'DOUBLE', temporal: false },
          { name: 'day', type: 'DATE', temporal: true },
          { name: 'active', type: 'BOOLEAN', temporal: false },
        ],
      })),
      prepare: async ({ metricId }: any) => ({
        definition: measures[metricId - 1],
        draft: { widgets: [{ sql: defs[metricId], decimalPlaces: 2 }] },
      }),
    };
    service = new BiSeriesService(bi, connection as any);
  });

  afterEach(() => {
    session?.closeSync();
    instance?.closeSync();
  });

  const request = (extra: any = {}) => ({
    sourceId: 1,
    sourceRevision: revision,
    dimensionColumn: 'company',
    dimensionValues: [null, 'null'],
    measureIds: [1, 2, 3],
    grain: 'day',
    ...extra,
  });

  it('keeps NULL distinct from literal "null" and computes each ratio over its exact aggregate', async () => {
    const result = await service.compare(request(), actor);
    expect(result.sourceRevision).toBe(revision);
    expect(result.time).toEqual({ column: 'day', grain: 'day', timeZone: 'UTC' });
    expect(result.series.map((series: any) => series.value)).toEqual([null, 'null']);
    expect(result.series[0].label).toBe('(값 없음)');
    expect(result.series[1].label).toBe('null');
    expect(Number(result.series[0].kpis[0].value)).toBe(200);
    expect(Number(result.series[0].kpis[1].value)).toBe(30);
    expect(Number(result.series[0].kpis[2].value)).toBe(30);
    expect(result.series[0].points.map((point: any) => point.time)).toEqual([
      '2026-01-01',
      '2026-01-02',
    ]);
    expect(Number(result.series[0].points[0].values[1].value)).toBe(20);
    expect(Number(result.series[0].points[1].values[1].value)).toBe(40);
    expect(result.measures.map((measure: any) => measure.id)).toEqual([1, 2, 3]);
  });

  it('applies the same filters, date range and grain to both KPI and trend queries', async () => {
    const result = await service.compare(
      request({
        dimensionValues: ['null'],
        filters: [{ column: 'profit', range: { min: 10 } }],
        dateRange: { column: 'day', start: '2026-01-01', end: '2026-01-02' },
        grain: 'week',
      }),
      actor,
    );
    expect(result.time).toEqual({ column: 'day', grain: 'week', timeZone: 'UTC' });
    expect(result.series[0].points).toHaveLength(1);
    expect(Number(result.series[0].kpis[0].value)).toBe(200);
    expect(result.series[0].points[0].time).toBe('2025-12-29');
  });

  it('rejects stale revisions and selections above the bound', async () => {
    await expect(
      service.compare(request({ sourceRevision: 'f'.repeat(64) }), actor),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      service.compare(request({ dimensionValues: ['a', 'b', 'c', 'd', 'e'] }), actor),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects explicit non-UTC date ranges for values and trends before reading the source', async () => {
    const dateRange = {
      column: 'day',
      start: '2026-01-01',
      end: '2026-01-02',
      timeZone: 'Asia/Seoul',
    };
    await expect(service.compare(request({ dateRange }), actor)).rejects.toThrow(
      '차원 추세 비교는 UTC 기간만 지원합니다.',
    );
    await expect(
      service.values({ sourceId: 1, sourceRevision: revision, column: 'active', dateRange }, actor),
    ).rejects.toThrow('차원 추세 비교는 UTC 기간만 지원합니다.');
    expect(snapshot).not.toHaveBeenCalled();
  });

  it('returns typed selectable values under the same filters and date scope', async () => {
    const result = await service.values(
      {
        sourceId: 1,
        sourceRevision: revision,
        column: 'active',
        search: 'tr',
        filters: [{ column: 'profit', range: { min: 30 } }],
        dateRange: { column: 'day', start: '2026-01-01', end: '2026-01-01' },
      },
      actor,
    );
    expect(result.sourceRevision).toBe(revision);
    expect(result.values).toEqual([true]);
    expect(typeof result.values[0]).toBe('boolean');
    expect(result.truncated).toBe(false);
  });

  it('rejects a foreign actor before opening the pinned source snapshot', async () => {
    await expect(service.compare(request(), 99)).rejects.toBeInstanceOf(ForbiddenException);
    expect(bi.metrics).toHaveBeenCalledWith(1, 99);
    expect(snapshot).not.toHaveBeenCalled();
    expect(bi.profile).not.toHaveBeenCalled();
  });
});
