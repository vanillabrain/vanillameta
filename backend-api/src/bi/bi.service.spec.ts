// Keep provider/runtime setup outside these BiService boundary tests.
jest.mock('../connection/connection.service', () => ({ ConnectionService: class {} }));
jest.mock('../ai/ai-dashboard.service', () => ({ AiDashboardService: class {} }));

import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { DuckDBConnection, DuckDBInstance } from '@duckdb/node-api';
import { Database } from '../database/entities/database.entity';
import { Metric } from '../metric/entities/metric.entity';
import { User } from '../user/entities/user.entity';
import { EnterpriseMembership } from '../enterprise/entities/enterprise-membership.entity';
import { SourceCatalogEntry } from './entities/source-catalog-entry.entity';
import { SourceAccessService } from '../ownership/source-access.service';
import { BiService } from './bi.service';

describe('BiService structured file analysis', () => {
  let instance: DuckDBInstance;
  let duck: DuckDBConnection;
  let service: BiService;
  let queryDuckDB: jest.Mock;
  let saveDashboard: jest.Mock;
  let metricRepo: any;
  let sources: any[];
  let metrics: any[];
  const metricBody = (overrides = {}) => ({
    sourceId: 1,
    label: 'Revenue',
    aggregation: 'SUM',
    column: 'amount',
    unit: '$',
    decimalPlaces: 2,
    numberNotation: 'plain',
    ...overrides,
  });
  const chartBody = (metricId: number, overrides = {}) => ({
    sourceId: 1,
    metricId,
    title: 'Revenue chart',
    chart: 'number',
    ...overrides,
  });

  beforeEach(async () => {
    instance = await DuckDBInstance.create(':memory:');
    duck = await instance.connect();
    // The last two rows carry nulls/date extrema absent from the five-row preview.
    await duck.run(`CREATE TABLE uploaded_data AS SELECT
      CASE WHEN i = 6 THEN NULL ELSE i END AS amount,
      CASE WHEN i = 7 THEN 'B' ELSE 'A' END AS category,
      CASE WHEN i <= 5 THEN DATE '2026-01-10'
           WHEN i = 6 THEN DATE '2025-01-01' ELSE DATE '2027-12-31' END AS day,
      NULL::DOUBLE AS empty_amount FROM range(1, 8) t(i)`);
    sources = [1, 2].map(id => ({
      id,
      name: `Source ${id}`,
      engine: 'duckdb',
      ownerId: 10,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-02',
    }));
    metrics = [];
    metricRepo = {
      findOne: jest.fn(async ({ where }) => metrics.find(row => row.id === where.id)),
      create: jest.fn(row => row),
      save: jest.fn(async row => {
        if (metrics.some(existing => existing.name === row.name)) throw new Error('unique name');
        const saved = { ...row, id: metrics.length + 1 };
        metrics.push(saved);
        return saved;
      }),
    };
    const sourceRepo = {
      findOne: jest.fn(async ({ where }) => sources.find(row => row.id === where.id)),
    };
    const db: any = {
      options: { type: 'sqlite' },
      getRepository: jest.fn(entity => {
        if (entity === Database) return sourceRepo;
        if (entity === Metric) return metricRepo;
        if (entity === User)
          return {
            findOne: async ({ where }) =>
              where.id === 10 ? { id: 10, active: true, authVersion: 0 } : null,
          };
        if (entity === EnterpriseMembership || entity === SourceCatalogEntry)
          return { findOne: async () => null };
        throw new Error('unexpected repository');
      }),
    };
    const manager = {
      connection: db,
      queryRunner: { isTransactionActive: false },
      getRepository: db.getRepository,
      findOne: (entity, options) => db.getRepository(entity).findOne(options),
      findOneBy: (entity, where) => db.getRepository(entity).findOne({ where }),
    };
    db.manager = manager;
    db.transaction = async run => run({ ...manager, queryRunner: { isTransactionActive: true } });
    queryDuckDB = jest.fn(async (_id, sql) => ({
      datas: (await duck.runAndReadAll(sql)).getRowObjectsJson(),
    }));
    saveDashboard = jest.fn().mockResolvedValue({ data: { id: 42 } });
    service = new BiService(
      db as any,
      new SourceAccessService(db as any),
      {
        queryDuckDB,
        withDuckDBSnapshot: (_id, run) => run(),
        duckDBVersion: async id =>
          sources.find(s => s.id === id).connectionConfig || 'initial-file',
      } as any,
      { save: saveDashboard } as any,
    );
  });

  afterEach(() => {
    duck?.closeSync();
    instance?.closeSync();
  });

  it('checks ownership on every request, including a populated profile cache', async () => {
    const profile = await service.profile(1, 10);
    queryDuckDB.mockClear();
    // UC051: the response now carries per-request access/ownership, so the cached snapshot is
    // reused by value instead of being returned by identity.
    const cached = await service.profile(1, 10);
    expect(cached).toEqual(profile);
    expect(cached.access).toEqual({ read: true, edit: true, publish: false, export: true });
    expect(cached.owned).toBe(true);
    await expect(service.profile(1, 20)).rejects.toBeInstanceOf(ForbiddenException);
    sources[0].ownerId = 20;
    await expect(service.profile(1, 10)).rejects.toBeInstanceOf(ForbiddenException);
    expect(queryDuckDB).not.toHaveBeenCalled();
  });

  it('invalidates profile cache on file pointer changes even with identical timestamps', async () => {
    sources[0].connectionConfig = 'version-one';
    const first = await service.profile(1, 10);
    await duck.run("INSERT INTO uploaded_data VALUES (42, 'C', DATE '2026-01-11', NULL)");
    sources[0].connectionConfig = 'version-two';
    const second = await service.profile(1, 10);
    expect(second.dataVersion).not.toBe(first.dataVersion);
    expect(second.rowCount).toBe('8');
  });
  it('profiles all uploaded rows for counts, nulls and date bounds independently of preview', async () => {
    const profile = await service.profile(1, 10);
    expect(profile).toMatchObject({ sourceId: 1, supported: true, rowCount: '7' });
    expect(profile.preview).toHaveLength(5);
    expect(profile.preview.every(row => row.amount !== null && row.day === '2026-01-10')).toBe(
      true,
    );
    expect(profile.columns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'amount', numeric: true, nullCount: '1' }),
        expect.objectContaining({ name: 'empty_amount', nullCount: '7' }),
        expect.objectContaining({
          name: 'day',
          temporal: true,
          nullCount: '0',
          min: '2025-01-01',
          max: '2027-12-31',
        }),
      ]),
    );
  });

  it.each(['SUM', 'AVG', 'MIN', 'MAX'])(
    '%s accepts numeric columns and rejects text',
    async aggregation => {
      await expect(service.createMetric(metricBody({ aggregation }), 10)).resolves.toMatchObject({
        definition: { aggregation, column: 'amount', tableName: 'uploaded_data' },
      });
      await expect(
        service.createMetric(metricBody({ aggregation, column: 'category' }), 10),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(metricRepo.save).toHaveBeenCalledTimes(1);
    },
  );

  it('ignores COUNT columns, including injected text, and counts rows with null values', async () => {
    const metric = await service.createMetric(
      metricBody({ aggregation: 'COUNT', column: 'amount); DROP TABLE uploaded_data; --' }),
      10,
    );
    expect(metric.definition.column).toBe('*');
    const result = await service.preview(chartBody(metric.id), 10);
    expect(result.rows).toEqual([{ value: '7' }]);
    expect(queryDuckDB.mock.calls.at(-1)[1]).toBe(
      'WITH source AS (SELECT * FROM uploaded_data) SELECT COUNT(*) AS value FROM source',
    );
  });

  it('rejects injected metric columns and chart dimensions before executing chart SQL', async () => {
    const injected = 'amount" FROM uploaded_data; --';
    await expect(service.createMetric(metricBody({ column: injected }), 10)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    const metric = await service.createMetric(metricBody(), 10);
    queryDuckDB.mockClear();
    await expect(
      service.preview(chartBody(metric.id, { chart: 'bar', dimension: injected }), 10),
    ).rejects.toBeInstanceOf(BadRequestException);
    metrics[0].definition = JSON.stringify({ ...metric.definition, column: injected });
    await expect(service.preview(chartBody(metric.id), 10)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(queryDuckDB).not.toHaveBeenCalled();
  });

  it('requires a date dimension for line charts and evaluates COUNT_DISTINCT on text', async () => {
    const metric = await service.createMetric(
      metricBody({ aggregation: 'COUNT_DISTINCT', column: 'category' }),
      10,
    );
    await expect(
      service.preview(chartBody(metric.id, { chart: 'line', dimension: 'category' }), 10),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect((await service.preview(chartBody(metric.id), 10)).rows).toEqual([{ value: '2' }]);
    const line = await service.preview(
      chartBody(metric.id, { chart: 'line', dimension: 'day' }),
      10,
    );
    expect(line.rows).toEqual([
      { dimension: '2025-01-01', value: '1' },
      { dimension: '2026-01-10', value: '1' },
      { dimension: '2027-12-31', value: '1' },
    ]);
  });

  it.each(['databaseId', 'definition.sourceId'])(
    'rejects source A with source B metric %s',
    async mismatch => {
      const metric = await service.createMetric(metricBody(), 10);
      if (mismatch === 'databaseId') metrics[0].databaseId = 2;
      else metrics[0].definition = JSON.stringify({ ...metric.definition, sourceId: 2 });
      queryDuckDB.mockClear();
      await expect(service.save(chartBody(metric.id), 10)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(queryDuckDB).not.toHaveBeenCalled();
      expect(saveDashboard).not.toHaveBeenCalled();
    },
  );

  it('keeps FROM source inside quoted column names intact when previewing', async () => {
    await duck.run('ALTER TABLE uploaded_data RENAME COLUMN amount TO "amount FROM source"');
    const metric = await service.createMetric(metricBody({ column: 'amount FROM source' }), 10);
    expect((await service.preview(chartBody(metric.id), 10)).rows).toEqual([{ value: '22' }]);
    const sql = queryDuckDB.mock.calls.at(-1)[1];
    expect(sql).toContain('SUM("amount FROM source")');
    expect(sql).toContain('WITH source AS');
  });

  it('saves the displayed unit as a suffix matching the preview', async () => {
    const metric = await service.createMetric(metricBody({ unit: 'kg' }), 10);
    const prepared = await service.prepare(chartBody(metric.id), 10);
    expect(prepared.draft.widgets[0]).toMatchObject({ suffix: ' kg' });
    expect(prepared.draft.widgets[0]).not.toHaveProperty('prefix');
  });

  it('allows duplicate display labels with unique internal metric names', async () => {
    const first = await service.createMetric(metricBody(), 10);
    const second = await service.createMetric(metricBody(), 10);
    expect([first.label, second.label]).toEqual(['Revenue', 'Revenue']);
    expect(new Set(metrics.map(row => row.name)).size).toBe(2);
    for (const row of metrics) expect(row.name).toMatch(/^bi_[0-9a-f-]{36}$/);
    expect(first.id).not.toBe(second.id);
  });

  it('passes the full snapshot together with the draft in the single atomic save boundary', async () => {
    const metric = await service.createMetric(metricBody(), 10);
    const profile = await service.profile(1, 10);
    const body = chartBody(metric.id, { chart: 'bar', dimension: 'category' });
    expect(await service.save(body, 10)).toEqual({ id: 42 });
    expect(saveDashboard).toHaveBeenCalledTimes(1);
    expect(saveDashboard).toHaveBeenCalledWith(
      {
        draft: expect.objectContaining({
          databaseId: 1,
          widgets: [
            expect.objectContaining({
              type: 'CHART_COLUMN',
              sql: 'SELECT "category" AS dimension, SUM("amount") AS value FROM source GROUP BY "category" ORDER BY value DESC LIMIT 500',
            }),
          ],
        }),
      },
      10,
      {
        schemaVersion: 1,
        kind: 'structured-bi',
        sourceId: 1,
        dataVersion: profile.dataVersion,
        metricId: metric.id,
        definitionVersion: 1,
        definition: metric.definition,
        dimension: 'category',
        dimensionDefinition: expect.objectContaining({
          column: 'category',
          type: 'VARCHAR',
          definitionVersion: 1,
          id: expect.stringMatching(/^dim_/),
        }),
        chart: 'bar',
      },
      undefined,
      undefined,
      false,
      [],
      undefined,
      undefined,
    );
    saveDashboard.mockRejectedValueOnce(new Error('transaction rolled back'));
    await expect(service.save(body, 10)).rejects.toThrow('transaction rolled back');
  });

  it('preserves SQL NULL for an all-null SUM instead of manufacturing zero', async () => {
    const metric = await service.createMetric(metricBody({ column: 'empty_amount' }), 10);
    expect((await service.preview(chartBody(metric.id), 10)).rows).toEqual([{ value: null }]);
  });

  async function pairs() {
    await duck.run(`DROP TABLE uploaded_data;
      CREATE TABLE uploaded_data (amount DOUBLE, weight DOUBLE, category VARCHAR);
      INSERT INTO uploaded_data VALUES (10,2,'A'),(20,4,'A'),
        (NULL,3,'B'),(5,0,'B'),(8,NULL,'C'),(NULL,NULL,'D'),(9,-1,'E')`);
  }
  it('advanced ratio uses aggregate totals rather than averaging per-row ratios and preserves the snapshot', async () => {
    await pairs();
    const metric = await service.createMetric(
      metricBody({
        aggregation: 'RATIO_SUM',
        denominatorColumn: 'weight',
        scale: 100,
      }),
      10,
    );
    const result = await service.preview(
      chartBody(metric.id, { chart: 'bar', dimension: 'category' }),
      10,
    );
    const rows = Object.fromEntries(result.rows.map(r => [r.dimension, r.value]));
    expect(rows.A).toBe(500);
    expect(rows.B).toBeCloseTo(500 / 3, 9);
    expect(rows.C).toBeNull();
    expect(rows.D).toBeNull();
    expect(rows.E).toBe(-900);
    await service.save(chartBody(metric.id), 10);
    expect(saveDashboard.mock.calls[0][2].definition).toMatchObject({
      aggregation: 'RATIO_SUM',
      column: 'amount',
      denominatorColumn: 'weight',
      scale: 100,
    });
  });
  it('advanced weighted mean excludes incomplete pairs and leaves zero or negative weights without a value', async () => {
    await pairs();
    const metric = await service.createMetric(
      metricBody({
        aggregation: 'WEIGHTED_AVG',
        weightColumn: 'weight',
      }),
      10,
    );
    const result = await service.preview(
      chartBody(metric.id, { chart: 'bar', dimension: 'category' }),
      10,
    );
    const rows = Object.fromEntries(result.rows.map(r => [r.dimension, r.value]));
    expect(rows.A).toBeCloseTo(100 / 6, 9);
    for (const key of ['B', 'C', 'D', 'E']) expect(rows[key]).toBeNull();
  });
  it('advanced ratio leaves an all-null numerator and a zero denominator null', async () => {
    await duck.run('ALTER TABLE uploaded_data ADD COLUMN zero_value DOUBLE DEFAULT 0');
    for (const fields of [
      { column: 'amount', denominatorColumn: 'zero_value' },
      { column: 'empty_amount', denominatorColumn: 'amount' },
    ]) {
      const metric = await service.createMetric(
        metricBody({ aggregation: 'RATIO_SUM', scale: 1, ...fields }),
        10,
      );
      expect((await service.preview(chartBody(metric.id), 10)).rows).toEqual([{ value: null }]);
    }
  });
  it.each(['RATIO_SUM', 'WEIGHTED_AVG'])(
    'advanced %s validates both fields before executing SQL',
    async aggregation => {
      const key = aggregation === 'RATIO_SUM' ? 'denominatorColumn' : 'weightColumn';
      for (const value of [
        'category',
        'unknown',
        'amount" FROM source; DROP TABLE uploaded_data; --',
      ]) {
        await expect(
          service.createMetric(metricBody({ aggregation, [key]: value, scale: 1 }), 10),
        ).rejects.toBeInstanceOf(BadRequestException);
      }
      const metric = await service.createMetric(
        metricBody({ aggregation, [key]: 'amount', scale: 1 }),
        10,
      );
      metrics[0].definition = JSON.stringify({ ...metric.definition, [key]: 'category' });
      queryDuckDB.mockClear();
      await expect(service.preview(chartBody(metric.id), 10)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(queryDuckDB).not.toHaveBeenCalled();
    },
  );
  it.each([0, 2, Infinity, '100', null])(
    'advanced ratio rejects an arbitrary scale %s',
    async scale => {
      await expect(
        service.createMetric(
          metricBody({ aggregation: 'RATIO_SUM', denominatorColumn: 'amount', scale }),
          10,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(metricRepo.save).not.toHaveBeenCalled();
    },
  );
});
