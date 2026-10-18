jest.mock('../ai/ai.service', () => ({ AiService: class {} }));
import { DuckDBInstance } from '@duckdb/node-api';
import { createHash, randomUUID } from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DataSource } from 'typeorm';
import { DuckDBService } from '../analysis/duckdb.service';
import { ConnectionService } from '../connection/connection.service';
import { AiDashboardService } from '../ai/ai-dashboard.service';
import { SourceAccessService } from '../ownership/source-access.service';
import { Database } from '../database/entities/database.entity';
import { Metric } from '../metric/entities/metric.entity';
import { User } from '../user/entities/user.entity';
import { EnterpriseMembership } from '../enterprise/entities/enterprise-membership.entity';
import { EnterpriseAuditEvent } from '../enterprise/entities/enterprise-audit-event.entity';
import { EnterpriseResourceGrant } from '../enterprise/entities/enterprise-resource-grant.entity';
import {
  EnterpriseGroup,
  EnterpriseGroupMember,
  EnterpriseGroupGrant,
} from '../enterprise/entities/enterprise-group.entity';
import { EnterpriseResourcePolicyService } from '../enterprise/resource-policy.service';
import { EnterpriseNotificationAudience } from '../enterprise/entities/enterprise-notification-audience.entity';
import { EnterpriseNotificationState } from '../enterprise/entities/enterprise-notification-state.entity';
import { BiService } from './bi.service';
import { BiExploreService } from './bi-explore.service';
import { ExportJobsService } from './export-jobs.service';
import { ExportJob, ExportPart } from './entities/export-job.entity';

// UTC timestamps straddle New York's 23-hour 2026-03-08 and the exact following-day boundary.
const rows = [
  { region: 'A', channel: 'web', amount: 20, weight: 4, time: '2026-03-07T04:30:00Z' },
  { region: 'B', channel: 'web', amount: 30, weight: 3, time: '2026-03-08T04:30:00Z' },
  { region: 'A', channel: 'web', amount: 40, weight: 2, time: '2026-03-08T05:00:00Z' },
  { region: 'A', channel: 'app', amount: 60, weight: 6, time: '2026-03-09T16:00:00Z' },
  { region: 'B', channel: 'web', amount: 80, weight: 8, time: '2026-03-10T03:30:00Z' },
  { region: 'B', channel: 'app', amount: 50, weight: 5, time: '2026-03-08T16:00:00Z' },
  { region: 'A', channel: 'web', amount: 100, weight: 10, time: '2026-03-08T16:00:00Z' },
  { region: 'A', channel: 'app', amount: 5, weight: 1, time: '2026-03-09T18:00:00Z' },
  { region: 'C', channel: 'web', amount: 90, weight: 9, time: '2026-03-09T19:00:00Z' },
  { region: 'ZERO', channel: 'app', amount: 25, weight: 0, time: '2026-03-09T20:00:00Z' },
  { region: 'A', channel: 'web', amount: 70, weight: 7, time: '2026-03-10T04:00:00Z' },
];
const localDay = (instant: string, timeZone: string) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(instant));
  const get = (type: string) => parts.find(p => p.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
};
// Independent JS oracle: does not import the SQL/condition/date-range compilers being tested.
const select = (start: string, end: string, zone = 'America/New_York', condition = true) =>
  rows.filter(row => {
    const day = localDay(row.time, zone);
    return (
      day >= start &&
      day <= end &&
      row.amount >= 15 &&
      (!condition || ((row.region === 'A' || row.channel === 'web') && row.amount < 90))
    );
  });
const aggregate = (selected: typeof rows) => {
  const amount = selected.reduce((sum, row) => sum + row.amount, 0);
  const weight = selected.reduce((sum, row) => sum + row.weight, 0);
  return {
    sum: selected.length ? amount : null,
    ratio: weight ? amount / weight : null,
    count: selected.length,
  };
};
// Small RFC4180 reader for exported quoted JSON/CRLF fields; never reconstruct expected CSV via toCsv.
const csvRows = (csv: string) => {
  const records: string[][] = [];
  let record: string[] = [],
    cell = '',
    quoted = false;
  const input = csv.replace(/^\uFEFF/, '');
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (c === '"') {
      if (quoted && input[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === ',' && !quoted) {
      record.push(cell);
      cell = '';
    } else if (c === '\n' && !quoted) {
      record.push(cell);
      records.push(record);
      record = [];
      cell = '';
    } else if (c !== '\r' || quoted) cell += c;
  }
  const [header, ...data] = records;
  return data.map(values => Object.fromEntries(header.map((name, i) => [name, values[i]])));
};

const semanticCsv = (csv: string) =>
  csvRows(csv).map(row =>
    row.section === 'condition' ? { ...row, value: JSON.parse(row.value) } : row,
  );

describe('UC052 same-basis actual DuckDB Explore/Pivot/CSV oracle', () => {
  jest.setTimeout(30000);
  let root: string,
    filename: string,
    replacementFilename: string,
    revision: string,
    db: DataSource,
    worker: DuckDBService,
    connection: ConnectionService,
    bi: BiService,
    explore: BiExploreService,
    jobs: ExportJobsService;
  const previous = process.env.FILE_UPLOAD_DIR;
  const versions = { '1': 1, '2': 1, '3': 1 };
  const definition = (id: number, version = 1) => ({
    schemaVersion: 1,
    definitionVersion: version,
    sourceId: 1,
    tableName: 'uploaded_data',
    label: ['Revenue', 'Per weight', 'Count'][id - 1],
    unit: '',
    decimalPlaces: 6,
    numberNotation: 'plain',
    aggregation: id === 1 ? 'SUM' : id === 2 ? 'RATIO_SUM' : 'COUNT',
    column: id === 3 ? '*' : 'amount',
    ...(id === 2 ? { denominatorColumn: 'weight', scale: 1 } : {}),
  });
  const conditions = () => ({
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
  const scope = () => ({
    sourceId: 1,
    sourceRevision: revision,
    measureIds: [1, 2, 3],
    conditions: conditions(),
    filters: [{ column: 'amount', range: { min: 15 } }],
    dateRange: {
      column: 'event_time',
      start: '2026-03-08',
      end: '2026-03-09',
      timeZone: 'America/New_York',
    },
  });
  const query = () => ({
    ...scope(),
    dimensionColumns: ['region'],
    rankingMeasureId: 1,
    trendGrain: 'day',
    comparePrevious: true,
    includeRows: false,
  });
  const pivot = () => ({
    ...scope(),
    rowColumns: ['region', 'channel'],
    columnColumns: ['event_time'],
    timeAxis: { column: 'event_time', grain: 'day', timeZone: 'America/New_York' },
    rowHierarchy: true,
    comparePrevious: true,
  });
  const payload = (mode: string) => ({ mode, query: mode === 'explore' ? query() : pivot() });
  const csvRequest = (mode: string, basis = versions) => ({
    ...payload(mode),
    query: { ...payload(mode).query, expectedMeasureVersions: basis },
  });
  const freshJobs = () => new ExportJobsService(db, bi, explore, connection);
  const changeMetric = () =>
    db.manager.update(Metric, 1, { definition: JSON.stringify(definition(1, 2)) });
  beforeAll(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'vm-explore-basis-'));
    process.env.FILE_UPLOAD_DIR = root;
    const directory = path.join(root, randomUUID());
    fs.mkdirSync(directory);
    filename = path.join(directory, 'data.duckdb');
    const instance = await DuckDBInstance.create(filename, { access_mode: 'READ_WRITE' }),
      native = await instance.connect();
    try {
      await native.run(
        'CREATE TABLE uploaded_data(region VARCHAR, channel VARCHAR, amount DOUBLE, weight DOUBLE, event_time TIMESTAMP)',
      );
      const quote = (s: string) => "'" + s.replace(/'/g, "''") + "'";
      await native.run(
        'INSERT INTO uploaded_data VALUES ' +
          rows
            .map(
              row =>
                `(${quote(row.region)},${quote(row.channel)},${row.amount},${row.weight},${quote(
                  row.time,
                )})`,
            )
            .join(','),
      );
      await native.run('CHECKPOINT');
    } finally {
      native.closeSync();
      instance.closeSync();
    }
    const replacementDirectory = path.join(root, randomUUID());
    fs.mkdirSync(replacementDirectory);
    replacementFilename = path.join(replacementDirectory, 'data.duckdb');
    fs.copyFileSync(filename, replacementFilename);
    const replacementInstance = await DuckDBInstance.create(replacementFilename, {
        access_mode: 'READ_WRITE',
      }),
      replacementNative = await replacementInstance.connect();
    try {
      await replacementNative.run('UPDATE uploaded_data SET amount = amount * 2');
      await replacementNative.run('CHECKPOINT');
    } finally {
      replacementNative.closeSync();
      replacementInstance.closeSync();
    }
    db = await new DataSource({
      type: 'sqlite',
      database: path.join(root, 'metadata.db'),
      synchronize: true,
      entities: [
        User,
        EnterpriseMembership,
        EnterpriseAuditEvent,
        Database,
        Metric,
        EnterpriseResourceGrant,
        EnterpriseGroup,
        EnterpriseGroupMember,
        EnterpriseGroupGrant,
        ExportJob,
        ExportPart,
        EnterpriseNotificationAudience,
        EnterpriseNotificationState,
      ],
    }).initialize();
    await db.manager.insert(User, {
      id: 7,
      userId: 'basis-owner',
      email: 'basis-owner@example.invalid',
      password: 'unused',
      active: true,
      authVersion: 0,
    });
    await db.manager.insert(EnterpriseMembership, {
      userId: 7,
      organizationId: 1,
      role: 'admin',
      team: '',
    });
    await db.manager.insert(Database, {
      id: 1,
      ownerId: 7,
      name: 'Synthetic basis oracle',
      engine: 'duckdb',
      type: 'FILE',
      connectionConfig: JSON.stringify({ client: 'duckdb', connection: { filename } }),
    });
    for (const id of [1, 2, 3])
      await db.manager.insert(Metric, {
        id,
        databaseId: 1,
        name: 'basis-metric-' + id,
        tableName: 'uploaded_data',
        aggregation: definition(id).aggregation as any,
        expression: id === 3 ? '*' : 'amount',
        useYn: 'Y',
        definition: JSON.stringify(definition(id)),
      });
    worker = new DuckDBService();
    connection = new ConnectionService(db.getRepository(Database), {} as any, worker);
    revision = await connection.duckDBVersion(1);
    const access = new SourceAccessService(db, new EnterpriseResourcePolicyService(db));
    const ai = new AiDashboardService({} as any, connection, {} as any, access);
    bi = new BiService(db, access, connection, ai);
    explore = new BiExploreService(bi, ai, connection);
    jobs = freshJobs();
  });
  beforeEach(async () => {
    jest.restoreAllMocks();
    for (const entity of [ExportPart, ExportJob, EnterpriseAuditEvent])
      await db.getRepository(entity).clear();
    for (const id of [1, 2, 3])
      await db.manager.update(Metric, id, { definition: JSON.stringify(definition(id)) });
  });
  afterAll(async () => {
    await jobs?.onModuleDestroy();
    await worker?.onModuleDestroy();
    if (db?.isInitialized) await db.destroy();
    if (root) fs.rmSync(root, { recursive: true, force: true });
    if (previous === undefined) delete process.env.FILE_UPLOAD_DIR;
    else process.env.FILE_UPLOAD_DIR = previous;
  });

  it.each([
    ['query', 'querySnapshot'],
    ['classic Pivot', 'pivotClassic'],
    ['advanced Pivot', 'pivotSnapshot'],
    ['Explore CSV', 'query'],
    ['Pivot CSV', 'pivot'],
  ])(
    'rejects %s after an actual file replacement at unchanged metadata time inside an older outer pin',
    async (mode, aggregateMethod) => {
      const source = await db.manager.findOneByOrFail(Database, { id: 1 });
      const outer = await connection.captureDuckDBSnapshot(1);
      const original = (explore as any)[aggregateMethod].bind(explore);
      let completedAggregate = false;
      // Only schedule the metadata replacement: aggregate/profile/native SQL remain real.
      const aggregateSpy = jest
        .spyOn(explore as any, aggregateMethod)
        .mockImplementationOnce(async (...args: any[]) => {
          const result = await original(...args);
          completedAggregate = true;
          await db.query('UPDATE "database" SET "connectionConfig" = ? WHERE "id" = 1', [
            JSON.stringify({ client: 'duckdb', connection: { filename: replacementFilename } }),
          ]);
          const changed = await db.manager.findOneByOrFail(Database, { id: 1 });
          expect(changed.updatedAt).toEqual(source.updatedAt);
          expect(changed.createdAt).toEqual(source.createdAt);
          // The parent context still pins A, while an explicit fresh capture sees real file B.
          expect(await connection.duckDBVersion(1)).toBe(revision);
          const current = await connection.captureDuckDBSnapshot(1);
          await current.run(async () => {
            expect(await connection.duckDBVersion(1)).not.toBe(revision);
            const raw = await connection.queryDuckDB(
              1,
              'SELECT SUM(amount) AS total FROM uploaded_data',
            );
            expect(Number(raw.datas[0].total)).toBe(
              rows.reduce((sum, row) => sum + row.amount, 0) * 2,
            );
          });
          return result;
        });
      try {
        await expect(
          outer.run(async () => {
            if (mode === 'query') return explore.query(query(), 7);
            if (mode === 'classic Pivot')
              return explore.pivot(
                { ...scope(), rowDimensions: ['region'], columnDimensions: ['channel'] },
                7,
              );
            if (mode === 'advanced Pivot') return explore.pivot(pivot(), 7);
            return explore.exportCsv(csvRequest(mode === 'Explore CSV' ? 'explore' : 'pivot'), 7);
          }),
        ).rejects.toMatchObject({ status: 409 });
        expect(completedAggregate).toBe(true);
        expect(aggregateSpy).toHaveBeenCalledTimes(1);
        expect(await db.manager.count(ExportJob)).toBe(0);
      } finally {
        aggregateSpy.mockRestore();
        await db.query('UPDATE "database" SET "connectionConfig" = ? WHERE "id" = 1', [
          source.connectionConfig,
        ]);
      }
    },
  );
  it('returns the actual metric basis with OR/exclude/filter/DST-scoped KPI, prior period, ranking and daily trends', async () => {
    const current = aggregate(select('2026-03-08', '2026-03-09')),
      prior = aggregate(select('2026-03-06', '2026-03-07'));
    expect(current).toEqual({ sum: 180, ratio: 11.25, count: 3 });
    expect(prior).toEqual({ sum: 50, ratio: 50 / 7, count: 2 });
    const result: any = await explore.query({ ...query(), includeRows: true }, 7);
    expect(result.kpis[0]).toMatchObject({
      value: current.sum,
      comparison: { previousValue: prior.sum, delta: 130, percentChange: 260 },
    });
    expect(result.kpis[1].value).toBeCloseTo(current.ratio, 10);
    expect(result.kpis[1].comparison.previousValue).toBeCloseTo(prior.ratio, 10);
    expect(result.kpis[2]).toMatchObject({ value: 3, comparison: { previousValue: 2 } });
    expect(result.kpis[0].trend.points.map(p => [String(p.time).slice(0, 10), p.value])).toEqual([
      ['2026-03-08', 40],
      ['2026-03-09', 140],
    ]);
    expect(result.kpis[0].previousTrend.points.map(p => p.value)).toEqual([20, 30]);
    expect(result.leaderboards[0].rows).toEqual([
      expect.objectContaining({ category: 'A', value: 100, previousValue: 20, delta: 80 }),
      expect.objectContaining({ category: 'B', value: 80, previousValue: 30, delta: 50 }),
    ]);
    expect(result.details.totalRows).toBe('3');
    expect(result.details.rows.map(r => r.amount).sort((a, b) => a - b)).toEqual([40, 60, 80]);
    expect(result.measureVersions).toEqual(versions);
  });
  it('uses local civil days rather than the same literal UTC dates at the DST boundary', async () => {
    const result: any = await explore.query(
      { ...query(), dateRange: { ...scope().dateRange, timeZone: 'UTC' } },
      7,
    );
    const current = aggregate(select('2026-03-08', '2026-03-09', 'UTC')),
      prior = aggregate(select('2026-03-06', '2026-03-07', 'UTC'));
    expect(current.sum).toBe(130);
    expect(prior.sum).toBe(20);
    expect(result.kpis[0]).toMatchObject({
      value: current.sum,
      comparison: { previousValue: prior.sum },
    });
  });
  it('uses the same applied snapshot in dimension value lookup', async () => {
    const result = await explore.values(
      {
        sourceId: 1,
        sourceRevision: revision,
        column: 'region',
        conditions: conditions(),
        dateRange: scope().dateRange,
        filters: scope().filters,
      },
      7,
    );
    expect(result.values).toEqual(['A', 'B']);
  });
  it('reaggregates classic Pivot on the same current basis', async () => {
    const result: any = await explore.pivot(
      { ...scope(), rowDimensions: ['region'], columnDimensions: ['channel'] },
      7,
    );
    expect(result.grandTotals).toEqual([180, 11.25, 3]);
    expect(result.rows.map(r => r.values)).toEqual([['A'], ['B']]);
    expect(result.rows.flatMap(r => r.cells.map(c => c.values[0])).sort((a, b) => a - b)).toEqual([
      40, 60, 80,
    ]);
    expect(result.measureVersions).toEqual(versions);
  });
  it('preserves advanced hierarchy and time-aligned prior cells without adding non-additive ratios', async () => {
    const result: any = await explore.pivot(pivot(), 7);
    expect(result.grandTotal[0]).toEqual({
      measureId: 1,
      value: 180,
      comparison: { previousValue: 50, delta: 130, percentChange: 260 },
    });
    expect(result.grandTotal[1].value).toBe(11.25);
    expect(result.grandTotal[1].comparison.previousValue).toBeCloseTo(50 / 7, 10);
    expect(result.columns).toEqual([['2026-03-08'], ['2026-03-09']]);
    const parent = result.rowSubtotals.find(r => r.tuple[0] === 'A');
    expect(parent.measures[0].value).toBe(100);
    expect(parent.measures[1].value).toBe(12.5);
    const day8 = result.columnTotals[0][0],
      day9 = result.columnTotals[1][0];
    expect(day8).toMatchObject({ value: 40, comparison: { previousValue: 20 } });
    expect(day9).toMatchObject({ value: 140, comparison: { previousValue: 30 } });
    expect(result.measureVersions).toEqual(versions);
  });
  it.each(['explore', 'pivot'])(
    'exports %s immediate CSV with the same independent oracle and canonical conditions',
    async mode => {
      const file = await explore.exportCsv(csvRequest(mode), 7),
        parsed = csvRows(file.csv);
      const section = mode === 'explore' ? 'kpi' : 'grand_total';
      const sum = parsed.find(r => r.section === section && r.measure_id === '1');
      expect(sum).toMatchObject({
        value: '180',
        value_type: 'number',
        previous_value: '50',
        delta: '130',
        percent_change: '260',
      });
      expect(parsed.find(r => r.section === section && r.measure_id === '2').value).toBe('11.25');
      const condition = parsed.find(
        r => r.section === 'condition' && JSON.parse(r.row_axis).field === 'conditions',
      );
      expect(JSON.parse(condition.value)).toEqual(conditions());
      expect(file.sourceRevision).toBe(revision);
      expect(file.bytes).toBe(Buffer.byteLength(file.csv));
    },
  );
  it.each(['explore', 'pivot'])(
    'durable %s CSV matches immediate values/conditions and retains the completed historical basis after metric changes',
    async mode => {
      const immediate = await explore.exportCsv(csvRequest(mode), 7);
      const job = await jobs.create(
        { requestId: randomUUID(), payload: payload(mode), measureVersions: versions },
        7,
      );
      expect(await jobs.run(job.id, { expectedVersion: job.version }, 7)).toMatchObject({
        status: 'ready',
      });
      const file = await freshJobs().file(job.id, 7);
      expect(semanticCsv(file.csv)).toEqual(semanticCsv(immediate.csv));
      expect(file.sha256).toBe(createHash('sha256').update(file.csv).digest('hex'));
      await changeMetric();
      expect((await freshJobs().get(job.id, 7)).measureVersions).toEqual(versions);
      expect((await freshJobs().file(job.id, 7)).csv).toBe(file.csv);
      await expect(explore.exportCsv(csvRequest(mode), 7)).rejects.toMatchObject({ status: 409 });
    },
  );
  it.each(['explore', 'pivot'])(
    'keeps legacy-compatible %s immediate/durable CSV on the same real fixture basis and preserves completed history',
    async mode => {
      const metrics = await db.manager.find(Metric, { order: { id: 'ASC' } });
      const savedBasis = Object.fromEntries(
        metrics.map(metric => [String(metric.id), JSON.parse(metric.definition).definitionVersion]),
      );
      expect(savedBasis).toEqual(versions);
      // New fields are optional for existing API callers. This verifies that compatibility separately.
      const immediate = await explore.exportCsv(payload(mode), 7);
      const section = mode === 'explore' ? 'kpi' : 'grand_total';
      expect(
        csvRows(immediate.csv).find(row => row.section === section && row.measure_id === '1'),
      ).toMatchObject({ value: '180', previous_value: '50', delta: '130', percent_change: '260' });
      const queued = await jobs.create(
        { requestId: randomUUID(), payload: payload(mode), measureVersions: savedBasis },
        7,
      );
      expect(await jobs.run(queued.id, { expectedVersion: queued.version }, 7)).toMatchObject({
        status: 'ready',
      });
      const file = await freshJobs().file(queued.id, 7);
      expect(semanticCsv(file.csv)).toEqual(semanticCsv(immediate.csv));
      expect(file.sha256).toBe(createHash('sha256').update(file.csv).digest('hex'));
      await changeMetric();
      expect((await freshJobs().get(queued.id, 7)).measureVersions).toEqual(savedBasis);
      expect((await freshJobs().file(queued.id, 7)).csv).toBe(file.csv);
    },
  );

  it('keeps empty aggregate NULL/COUNT0 distinct from a nonempty zero denominator in query/Pivot/CSV', async () => {
    const empty = {
      ...query(),
      filters: [...scope().filters, { column: 'region', values: ['missing'] }],
    };
    const result: any = await explore.query(empty, 7);
    expect(result.kpis.map(k => k.value)).toEqual([null, null, 0]);
    const zeroConditions = {
      sourceRevision: revision,
      definition: {
        include: { kind: 'predicate', column: 'region', operator: 'eq', values: ['ZERO'] },
        exclude: null,
      },
    };
    const zero: any = await explore.query({ ...query(), conditions: zeroConditions }, 7);
    expect(zero.kpis.map(k => k.value)).toEqual([25, null, 1]);
    const zeroPivot: any = await explore.pivot({ ...pivot(), conditions: zeroConditions }, 7);
    expect(zeroPivot.grandTotal.map(m => m.value)).toEqual([25, null, 1]);
    const file = await explore.exportCsv(
      {
        mode: 'explore',
        query: { ...query(), conditions: zeroConditions, expectedMeasureVersions: versions },
      },
      7,
    );
    expect(csvRows(file.csv).find(r => r.section === 'kpi' && r.measure_id === '2')).toMatchObject({
      value: '',
      value_type: 'null',
    });
  });
  it('removes conditions explicitly without changing source rows or saved metric definitions', async () => {
    const { conditions: omitted, ...unscoped } = query();
    expect(omitted).toEqual(conditions());
    const before = await db.manager.find(Metric, { order: { id: 'ASC' } });
    const result: any = await explore.query(unscoped, 7);
    expect(result.kpis[0].value).toBe(
      aggregate(select('2026-03-08', '2026-03-09', 'America/New_York', false)).sum,
    );
    expect(result.kpis[0].value).toBe(445);
    const raw = await connection.queryDuckDB(1, 'SELECT COUNT(*) AS count FROM uploaded_data');
    expect(Number(raw.datas[0].count)).toBe(rows.length);
    expect(await db.manager.find(Metric, { order: { id: 'ASC' } })).toEqual(before);
  });
  it.each(['explore', 'pivot'])(
    'rejects %s export after only metric version changes at unchanged sourceRevision',
    async mode => {
      const screen: any =
        mode === 'explore' ? await explore.query(query(), 7) : await explore.pivot(pivot(), 7);
      expect(screen.measureVersions).toEqual(versions);
      await changeMetric();
      expect(await connection.duckDBVersion(1)).toBe(revision);
      await expect(
        explore.exportCsv(csvRequest(mode, screen.measureVersions), 7),
      ).rejects.toMatchObject({ status: 409 });
      expect(await db.manager.count(ExportJob)).toBe(0);
    },
  );
  it.each(['explore', 'pivot'])(
    'rejects %s CSV if a metric changes after the actual aggregate response but before serialization returns',
    async mode => {
      if (mode === 'explore') {
        const original = explore.query.bind(explore);
        jest.spyOn(explore, 'query').mockImplementationOnce(async (...args) => {
          const result = await original(...args);
          await changeMetric();
          return result;
        });
      } else {
        const original = explore.pivot.bind(explore);
        jest.spyOn(explore, 'pivot').mockImplementationOnce(async (...args) => {
          const result = await original(...args);
          await changeMetric();
          return result;
        });
      }
      await expect(explore.exportCsv(csvRequest(mode), 7)).rejects.toMatchObject({ status: 409 });
      expect(await db.manager.count(ExportJob)).toBe(0);
    },
  );
});
