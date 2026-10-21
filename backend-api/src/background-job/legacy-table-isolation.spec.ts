import { SeparateLegacyEventAndJobTables1792620300000 } from '../migrations/1792620300000-separate-legacy-event-and-job-tables';
import { randomUUID } from 'crypto';
import { DataSource, Table, getMetadataArgsStorage } from 'typeorm';
import { BackgroundJob, JobStatus, JobType } from './entities/background-job.entity';
import { JobResult as BackgroundResult } from './entities/job-result.entity';
import { QueueJob, JobType as QueueJobType } from '../job-queue/entities/queue-job.entity';
import { JobResult as QueueResult, ResultType } from '../job-queue/entities/job-result.entity';
import { User } from '../user/entities/user.entity';
import { Dataset } from '../dataset/entities/dataset.entity';
import { Widget } from '../widget/entities/widget.entity';
import { AnalyticsEvent as CollectedEvent } from '../analytics/entities/analytics-event.entity';
import { AnalyticsEvent as ClientEvent } from '../events/entities/analytics-event.entity';
import { EventSession } from '../events/entities/event-session.entity';
import { PerformanceMetric } from '../events/entities/performance-metric.entity';
import { QueryJobProcessor } from './processors/query-job.processor';
import { AnalyticsService } from '../analytics/analytics.service';
import { EventsService } from '../events/events.service';

// SQLite does not accept timestamp. Only this engine-specific column spelling is adapted;
// table names, fields, relations, NOT NULL constraints and all repository writes stay real.
const timestampColumns = getMetadataArgsStorage().columns.filter(
  c => c.target === CollectedEvent && c.options.type === 'timestamp',
);
const entities = [
  BackgroundJob,
  BackgroundResult,
  QueueJob,
  QueueResult,
  User,
  Dataset,
  Widget,
  CollectedEvent,
  ClientEvent,
  EventSession,
  PerformanceMetric,
];

describe('legacy globally discovered entities use isolated persistence tables', () => {
  let db: DataSource;
  const logger: any = { log: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };
  beforeAll(() => {
    for (const column of timestampColumns) column.options.type = 'datetime';
  });
  afterAll(() => {
    for (const column of timestampColumns) column.options.type = 'timestamp';
  });
  beforeEach(async () => {
    db = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      entities,
      synchronize: true,
    }).initialize();
  });
  afterEach(async () => {
    await db?.destroy();
  });

  it('executes and persists a background result alongside the dormant queue schema without a queue jobId', async () => {
    await db
      .getRepository(User)
      .save({ id: 7, userId: 'alice', email: 'alice@example.invalid', password: 'test-only' });
    const job = await db.getRepository(BackgroundJob).save({
      userId: 'alice',
      title: 'SQL',
      jobType: JobType.QUERY_EXECUTION,
      status: JobStatus.PENDING,
      metadata: JSON.stringify({
        actor: { id: 7, userId: 'alice', authVersion: 0 },
        databaseId: '1',
        query: 'SELECT 600 AS total',
      }),
    });
    const processor = new QueryJobProcessor(
      db.getRepository(BackgroundJob),
      db.getRepository(BackgroundResult),
      {} as any,
      { findOne: async () => ({ id: 1 }) } as any,
      {
        executeQuery: async () => ({
          status: 'SUCCESS',
          datas: await db.query('SELECT 600 AS total'),
        }),
      } as any,
      logger,
      { assertJob: async () => undefined } as any,
    );
    await expect(
      processor.handleQueryExecution({
        data: { backgroundJobId: job.id },
        progress: jest.fn(),
        attemptsMade: 0,
      } as any),
    ).resolves.toMatchObject({ success: true, rowCount: 1 });
    const completed = await db
      .getRepository(BackgroundJob)
      .findOne({ where: { id: job.id }, relations: ['jobResult'] });
    expect(completed.status).toBe(JobStatus.COMPLETED);
    expect(completed.jobResult.backgroundJobId).toBe(job.id);
    expect(JSON.parse(completed.jobResult.resultData).datas).toEqual([{ total: 600 }]);
    expect(await db.getRepository(QueueResult).count()).toBe(0);

    const queued = await db
      .getRepository(QueueJob)
      .save({ jobType: QueueJobType.QUERY_EXECUTION, jobData: '{}' });
    await db.getRepository(QueueResult).save({
      jobId: queued.id,
      resultType: ResultType.QUERY_RESULT,
      resultData: '{"queue":true}',
    });
    expect(await db.getRepository(QueueResult).count()).toBe(1);
    expect(await db.getRepository(BackgroundResult).count()).toBe(1);
  });

  it('persists both public ingestion families without cross-family required fields or session FK leakage', async () => {
    const analytics = new AnalyticsService(db.getRepository(CollectedEvent), logger);
    await analytics.collectEvents([{ category: 'qa', action: 'collected' }], {
      ipAddress: '127.0.0.1',
    });
    // Collector intentionally has no correlation UUID or event_sessions row.
    expect(await db.getRepository(CollectedEvent).count()).toBe(1);
    const sessionId = randomUUID(),
      correlationId = randomUUID();
    const events = new EventsService(
      db.getRepository(ClientEvent),
      db.getRepository(EventSession),
      db.getRepository(PerformanceMetric),
      logger,
    );
    await events.trackEvents(
      {
        events: [
          {
            category: 'qa',
            action: 'client',
            value: 1.25,
            properties: { sessionId, correlationId },
          },
        ],
        sessionInfo: {
          sessionId,
          startTime: Date.now(),
          lastActivityTime: Date.now(),
          pageViews: 1,
          eventCount: 1,
        },
      },
      '127.0.0.1',
      'test-agent',
    );
    expect(await db.getRepository(ClientEvent).count()).toBe(1);
    expect((await db.getRepository(ClientEvent).findOneBy({ action: 'client' })).value).toBe(1.25);
    expect(await db.getRepository(CollectedEvent).count()).toBe(1);
  });
  it('leaves both unmapped legacy tables, columns and rows unchanged during schema synchronization', async () => {
    await db.query(
      'CREATE TABLE job_results (id text PRIMARY KEY, jobId text NOT NULL, opaque text)',
    );
    await db.query(
      'CREATE TABLE analytics_events (id text PRIMARY KEY, correlationId text NOT NULL, opaque text)',
    );
    await db.query(
      "INSERT INTO job_results VALUES ('legacy-job', 'queue-parent', 'unclassified result bytes')",
    );
    await db.query(
      "INSERT INTO analytics_events VALUES ('legacy-event', 'old-correlation', 'unclassified event bytes')",
    );
    const before = {} as Record<string, any>;
    for (const table of ['job_results', 'analytics_events'])
      before[table] = {
        columns: await db.query(`PRAGMA table_info(${table})`),
        rows: await db.query(`SELECT * FROM ${table}`),
      };
    await db.synchronize();
    for (const table of ['job_results', 'analytics_events'])
      expect({
        columns: await db.query(`PRAGMA table_info(${table})`),
        rows: await db.query(`SELECT * FROM ${table}`),
      }).toEqual(before[table]);
  });
  it('matches actual MySQL entity temporal precision, generated defaults and update behavior without connecting', async () => {
    // The SQLite test adaptation must not change the independent MySQL metadata oracle.
    for (const column of timestampColumns) column.options.type = 'timestamp';
    try {
      const mysql = new DataSource({
        type: 'mysql',
        database: 'metadata_only_no_connection',
        entities,
      });
      await (mysql as any).buildMetadatas();
      const tables = new Map<string, any>();
      const runner: any = {
        connection: mysql,
        hasTable: async () => false,
        getTable: async () => undefined,
        createTable: async (table: any) => {
          tables.set(table.name, table);
        },
      };
      await new SeparateLegacyEventAndJobTables1792620300000().up(runner);
      for (const entity of [BackgroundResult, QueueResult, CollectedEvent, ClientEvent]) {
        const metadata = mysql.getMetadata(entity),
          table = tables.get(metadata.tableName);
        for (const name of ['createdAt', 'updatedAt', 'eventTimestamp', 'expiresAt']) {
          const expected = metadata.columns.find(column => column.propertyName === name);
          if (!expected) continue;
          const actual = table.findColumnByName(name);
          expect(actual.type).toBe(mysql.driver.normalizeType(expected));
          expect(actual.precision ?? 0).toBe(expected.precision ?? 0);
          expect(actual.isNullable).toBe(expected.isNullable);
          if (expected.isCreateDate || expected.isUpdateDate) {
            expect(actual.default).toBe(mysql.driver.normalizeDefault(expected));
            expect(actual.onUpdate).toBe(expected.onUpdate);
          }
        }
      }
      const legacy = new Table({
        name: 'job_results',
        columns: tables.get('background_job_results').columns.map((column: any) => column.clone()),
      });
      legacy.findColumnByName('expiresAt').precision = 6;
      const queries: string[] = [];
      runner.hasTable = async (name: string) => name === 'background_jobs' || tables.has(name);
      runner.getTable = async (name: string) =>
        name === 'job_results' ? legacy : tables.get(name);
      runner.query = async (sql: string) => {
        queries.push(sql);
      };
      await new SeparateLegacyEventAndJobTables1792620300000().up(runner);
      expect(queries).toHaveLength(1);
      expect(queries[0]).toContain('MOD(MICROSECOND(s.`expiresAt`), 1000000) = 0');
      expect(queries[0]).not.toContain('MICROSECOND(s.`createdAt`)');
      expect(legacy.findColumnByName('expiresAt').precision).toBe(6);
    } finally {
      for (const column of timestampColumns) column.options.type = 'datetime';
    }
  });
});
