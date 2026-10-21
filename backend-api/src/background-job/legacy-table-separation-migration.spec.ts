import { randomUUID } from 'crypto';
import { DataSource, Table, TableColumn } from 'typeorm';
import { SeparateLegacyEventAndJobTables1792620300000 } from '../migrations/1792620300000-separate-legacy-event-and-job-tables';

describe('additive legacy table separation migration', () => {
  let db: DataSource;
  const migration = new SeparateLegacyEventAndJobTables1792620300000();
  beforeEach(async () => {
    db = await new DataSource({ type: 'sqlite', database: ':memory:' }).initialize();
  });
  afterEach(async () => {
    await db.destroy();
  });
  async function insert(table: string, rows: any[]) {
    for (const row of rows)
      await db.createQueryBuilder().insert().into(table).values(row).execute();
  }
  async function legacyUnion(name: string, targets: string[]) {
    const runner = db.createQueryRunner();
    const columns = new Map<string, TableColumn>();
    for (const target of targets) {
      for (const column of (await runner.getTable(target)).columns) {
        if (!columns.has(column.name))
          columns.set(
            column.name,
            new TableColumn({
              name: column.name,
              type: column.name === 'value' ? 'decimal' : column.type,
              precision: column.name === 'value' ? 10 : column.precision,
              scale: column.name === 'value' ? 2 : column.scale,
              length: column.length,
              isPrimary: column.name === 'id',
              isNullable: column.name !== 'id',
            }),
          );
      }
    }
    await runner.createTable(new Table({ name, columns: [...columns.values()] }));
    await runner.release();
  }
  const rows = (table: string) => db.query(`SELECT * FROM ${table} ORDER BY id`);

  it('creates separate tables on fresh storage and refuses a destructive rollback', async () => {
    const runner = db.createQueryRunner();
    await migration.up(runner);
    await migration.up(runner);
    for (const table of [
      'background_job_results',
      'queued_job_results',
      'analytics_collected_events',
      'client_analytics_events',
    ])
      expect(await runner.hasTable(table)).toBe(true);
    expect(await runner.hasTable('job_results')).toBe(false);
    expect(await runner.hasTable('analytics_events')).toBe(false);
    await expect(migration.down()).rejects.toThrow('no tables or history are dropped');
    await runner.release();
  });

  it('copies valid, unambiguous IDs and bytes once; retains ambiguous/orphan/invalid rows and never overwrites destinations', async () => {
    await db.query('CREATE TABLE background_jobs (id varchar(36) PRIMARY KEY)');
    await db.query('CREATE TABLE queue_jobs (id varchar(36) PRIMARY KEY)');
    await db.query('CREATE TABLE event_sessions (sessionId varchar(36) PRIMARY KEY)');
    const b = Array.from({ length: 4 }, () => randomUUID()),
      q = [randomUUID(), randomUUID()],
      session = randomUUID();
    await insert(
      'background_jobs',
      b.map(id => ({ id })),
    );
    await insert(
      'queue_jobs',
      q.map(id => ({ id })),
    );
    await insert('event_sessions', [{ sessionId: session }]);
    const runner = db.createQueryRunner();
    await migration.up(runner);
    await legacyUnion('job_results', ['background_job_results', 'queued_job_results']);
    await legacyUnion('analytics_events', [
      'analytics_collected_events',
      'client_analytics_events',
    ]);
    const bg = {
      id: randomUUID(),
      backgroundJobId: b[0],
      storageType: 'database',
      resultData: '{"preserve":"한글\\nbytes"}',
      resultSizeBytes: 34,
      rowCount: 1,
      expiresAt: '2026-10-27 01:02:03',
      isCompressed: 0,
      createdAt: '2025-01-02 03:04:05.123456',
      updatedAt: '2025-01-03 03:04:05.654321',
    };
    const queued = {
      id: randomUUID(),
      jobId: q[0],
      resultType: 'query_result',
      resultData: '{"queued":true}',
      expiresAt: '2026-10-27 01:02:03',
      isDownloaded: 0,
      downloadCount: 0,
      createdAt: '2025-01-02 03:04:05.123456',
    };
    const shadow = {
      ...bg,
      id: randomUUID(),
      backgroundJobId: b[3],
      resultData: 'existing destination bytes',
    };
    await insert('background_job_results', [shadow]);
    await insert('job_results', [
      bg,
      queued,
      { ...bg, id: randomUUID(), backgroundJobId: b[1], jobId: q[1] }, // mixed origin
      { ...bg, id: randomUUID(), backgroundJobId: randomUUID() }, // missing parent
      ...[0, 1].map(() => ({ ...bg, id: randomUUID(), backgroundJobId: b[2] })), // duplicate parent link
      { ...shadow, resultData: 'legacy conflict retained' },
      { ...queued, id: randomUUID(), jobId: q[1], resultType: null }, // incomplete required history
    ]);
    const collected = {
      id: randomUUID(),
      action: 'collected',
      category: 'qa',
      sessionId: 'unknown',
      metadata: '{"kind":"collector"}',
      value: 1,
      createdAt: '2025-01-02 03:04:05.123456',
    };
    const client = {
      id: randomUUID(),
      action: 'client',
      category: 'qa',
      sessionId: session,
      correlationId: randomUUID(),
      properties: '{"kind":"client"}',
      value: 1.25,
      createdAt: '2025-01-02 03:04:05.123456',
    };
    await insert('analytics_events', [
      collected,
      client,
      { ...collected, id: randomUUID(), metadata: null }, // common fields do not establish origin
      { ...collected, id: randomUUID(), properties: '{}' }, // both family markers
      { ...collected, id: randomUUID(), metadata: 'invalid-json' },
      { ...collected, id: randomUUID(), value: 1.25 }, // collector integer would lose precision
      { ...collected, id: randomUUID(), category: 'x'.repeat(51) },
      { ...client, id: randomUUID(), sessionId: randomUUID() },
      { ...client, id: randomUUID(), correlationId: null },
    ]);
    const originalJobs = await rows('job_results'),
      originalEvents = await rows('analytics_events');
    await migration.up(runner);
    const copiedBg = await rows('background_job_results'),
      copiedQueue = await rows('queued_job_results');
    expect(copiedBg).toHaveLength(2);
    expect(copiedQueue).toHaveLength(1);
    expect(copiedBg.find(row => row.id === bg.id)).toMatchObject(bg);
    expect(copiedBg.find(row => row.id === shadow.id).resultData).toBe(shadow.resultData);
    expect(copiedQueue[0]).toMatchObject(queued);
    expect(await rows('analytics_collected_events')).toHaveLength(1);
    expect((await rows('analytics_collected_events'))[0]).toMatchObject(collected);
    expect(await rows('client_analytics_events')).toHaveLength(1);
    expect((await rows('client_analytics_events'))[0]).toMatchObject(client);
    await migration.up(runner);
    expect(await rows('background_job_results')).toEqual(copiedBg);
    expect(await rows('queued_job_results')).toEqual(copiedQueue);
    expect(await rows('job_results')).toEqual(originalJobs);
    expect(await rows('analytics_events')).toEqual(originalEvents);
    await runner.release();
  });
  it('retains legacy history when a different destination ID already owns the parent link', async () => {
    await db.query('CREATE TABLE background_jobs (id varchar(36) PRIMARY KEY)');
    const parent = randomUUID();
    await insert('background_jobs', [{ id: parent }]);
    const runner = db.createQueryRunner();
    await migration.up(runner);
    await legacyUnion('job_results', ['background_job_results']);
    const result = {
      id: randomUUID(),
      backgroundJobId: parent,
      storageType: 'database',
      resultData: 'already stored',
      resultSizeBytes: 14,
      rowCount: 1,
      isCompressed: 0,
      expiresAt: '2026-10-27 01:02:03',
      createdAt: '2025-01-02 03:04:05.123456',
    };
    await insert('background_job_results', [result]);
    await insert('job_results', [{ ...result, id: randomUUID(), resultData: 'legacy retained' }]);
    const legacy = await rows('job_results'),
      destination = await rows('background_job_results');
    await migration.up(runner);
    expect(await rows('job_results')).toEqual(legacy);
    expect(await rows('background_job_results')).toEqual(destination);
    await runner.release();
  });
  it('generates audit timestamps for new background results when migration-created tables are used without synchronize', async () => {
    await db.query('CREATE TABLE background_jobs (id varchar(36) PRIMARY KEY)');
    const parent = randomUUID();
    await insert('background_jobs', [{ id: parent }]);
    const runner = db.createQueryRunner();
    await migration.up(runner);
    await insert('background_job_results', [{ id: randomUUID(), backgroundJobId: parent }]);
    const [result] = await rows('background_job_results');
    expect(result.createdAt).not.toBeNull();
    expect(result.updatedAt).not.toBeNull();
    expect(result.expiresAt).not.toBeNull();
    expect(Number.isNaN(Date.parse(result.createdAt))).toBe(false);
    expect(Number.isNaN(Date.parse(result.updatedAt))).toBe(false);
    await runner.release();
  });
});
