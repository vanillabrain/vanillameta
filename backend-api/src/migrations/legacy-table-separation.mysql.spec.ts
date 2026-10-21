import { execFileSync } from 'child_process';
import { createHash, randomBytes, randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { DataSource, QueryRunner } from 'typeorm';
import { SeparateLegacyEventAndJobTables1792620300000 } from './1792620300000-separate-legacy-event-and-job-tables';

// Explicit opt-in reuses only the owned local server; all writes use a new child schema.
const suite = process.env.VM_MAIN_LEGACY_MYSQL_CONFIG ? describe : describe.skip;
suite('legacy table separation on an owned MySQL 8.4 child schema', () => {
  jest.setTimeout(60000);
  const runtimePath = path.resolve(
    __dirname,
    '../../../.aiwf/evidence/TC050-integrated-mysql/runtime/runtime.json',
  );
  const schema = 'vm_main_legacy_' + randomBytes(12).toString('hex');
  const owner = randomBytes(16).toString('hex');
  const migration = new SeparateLegacyEventAndJobTables1792620300000();
  const parents = ['background_jobs', 'queue_jobs', 'event_sessions'];
  const legacy = ['job_results', 'analytics_events'];
  const targets = [
    'background_job_results',
    'queued_job_results',
    'analytics_collected_events',
    'client_analytics_events',
  ];
  const ids = {
    background: randomUUID(),
    queued: randomUUID(),
    duplicate: randomUUID(),
    mixedBackground: randomUUID(),
    mixedQueue: randomUUID(),
    session: randomUUID(),
    precisionBackground: randomUUID(),
    precisionQueue: randomUUID(),
  };
  let config: any;
  let admin: DataSource;
  let db: DataSource;
  let runner: QueryRunner;
  let created = false;
  let original: any;
  let background: any;
  let queued: any;
  let collected: any;
  let client: any;

  function verifyLocalOwnership() {
    const runtime = JSON.parse(fs.readFileSync(runtimePath, 'utf8'));
    const file = process.env.VM_MAIN_LEGACY_MYSQL_CONFIG;
    if (
      !path.isAbsolute(file) ||
      fs.lstatSync(file).isSymbolicLink() ||
      (fs.statSync(file).mode & 0o777) !== 0o600 ||
      fs.realpathSync(file) !== fs.realpathSync(runtime.databaseConfigPath) ||
      runtime.status !== 'ready'
    )
      throw new Error('Explicit private active QA config required');
    const current = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (
      current.gate !== 'owned-enterprise-http-mysql-v1' ||
      !/^[a-f0-9]{24}$/.test(current.owner) ||
      current.host !== '127.0.0.1' ||
      !Number.isInteger(current.port) ||
      current.port < 1024 ||
      current.port > 65535 ||
      current.username !== 'root' ||
      !current.password ||
      !current.serverUuid ||
      current.database !== 'vm_enterprise_' + current.owner ||
      current.containerName !== 'vm-enterprise-qa-' + current.owner ||
      !/^[a-f0-9]{64}$/.test(current.containerId) ||
      fs.readFileSync(path.join(runtime.runRoot, 'owner'), 'utf8') !== current.owner
    )
      throw new Error('Refusing an unowned QA MySQL server');
    if (config && JSON.stringify(current) !== JSON.stringify(config))
      throw new Error('QA config changed; retain child schema');
    const live = JSON.parse(
      execFileSync('docker', ['inspect', current.containerId], {
        encoding: 'utf8',
        timeout: 15000,
        stdio: ['ignore', 'pipe', 'pipe'],
      }),
    )[0];
    const ports = live.NetworkSettings?.Ports?.['3306/tcp'];
    if (
      live.Id !== current.containerId ||
      live.Name !== '/' + current.containerName ||
      live.State?.Running !== true ||
      live.Config?.Labels?.['vanillameta.enterprise.qa.owner'] !== current.owner ||
      !ports?.some(p => p.HostIp === '127.0.0.1' && Number(p.HostPort) === current.port)
    )
      throw new Error('Docker ownership or loopback binding changed');
    return current;
  }

  function open(database: string) {
    return new DataSource({
      type: 'mysql',
      host: config.host,
      port: config.port,
      username: config.username,
      password: config.password,
      database,
      timezone: 'Z',
      logging: false,
      synchronize: false,
      extra: { dateStrings: true, supportBigNumbers: true, bigNumberStrings: true },
    }).initialize();
  }
  async function serverIdentity(connection: DataSource, database: string) {
    const [identity] = await connection.query(
      'SELECT @@server_uuid AS uuid, VERSION() AS version, DATABASE() AS db',
    );
    expect(identity.uuid).toBe(config.serverUuid);
    expect(identity.version).toMatch(/^8\.4\./);
    expect(identity.db).toBe(database);
  }
  async function parentIdentity() {
    verifyLocalOwnership();
    await serverIdentity(admin, config.database);
    const markers = await admin.query('SELECT token FROM qa_runtime_owner');
    expect(markers).toEqual([{ token: config.owner }]);
  }
  const rows = (table: string) => db.query(`SELECT * FROM \`${table}\` ORDER BY id`);
  async function snapshot(tables: string[]) {
    const result = {};
    for (const table of tables) {
      const [ddl] = await db.query(`SHOW CREATE TABLE \`${table}\``);
      const data = await rows(table);
      result[table] = {
        ddl: ddl['Create Table'],
        rows: data,
        sha256: createHash('sha256').update(JSON.stringify(data)).digest('hex'),
      };
    }
    return result;
  }
  async function legacyBytes() {
    return {
      jobs: await db.query(
        'SELECT id, HEX(resultData) AS bytes, SHA2(resultData,256) AS digest FROM job_results ORDER BY id',
      ),
      events: await db.query(
        'SELECT id, HEX(metadata) AS metadataBytes, HEX(properties) AS propertyBytes FROM analytics_events ORDER BY id',
      ),
    };
  }
  async function insert(table: string, values: any[]) {
    for (const value of values) {
      const columns = Object.keys(value);
      await db.query(
        `INSERT INTO \`${table}\` (${columns.map(c => '`' + c + '`').join(',')}) VALUES (${columns
          .map(() => '?')
          .join(',')})`,
        columns.map(c => value[c]),
      );
    }
  }

  beforeAll(async () => {
    config = verifyLocalOwnership();
    admin = await open(config.database);
    await parentIdentity();
    if (!/^vm_main_legacy_[a-f0-9]{24}$/.test(schema) || schema === config.database)
      throw new Error('Invalid child schema');
    // No IF NOT EXISTS: a collision must fail before claiming ownership.
    await admin.query(
      `CREATE DATABASE \`${schema}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
    created = true;
    db = await open(schema);
    await db.query(
      'CREATE TABLE legacy_separation_fixture_owner (token CHAR(32) NOT NULL, parentOwner CHAR(24) NOT NULL)',
    );
    await db.query('INSERT INTO legacy_separation_fixture_owner VALUES (?,?)', [
      owner,
      config.owner,
    ]);
    await serverIdentity(db, schema);
    console.info(
      JSON.stringify({
        phase: 'child-created',
        schema,
        ownershipVerified: true,
        ownerHash: createHash('sha256').update(owner).digest('hex'),
      }),
    );
    await db.query('CREATE TABLE background_jobs (id VARCHAR(100) PRIMARY KEY)');
    await db.query('CREATE TABLE queue_jobs (id VARCHAR(36) PRIMARY KEY)');
    await db.query(
      'CREATE TABLE event_sessions (id VARCHAR(36) PRIMARY KEY, sessionId VARCHAR(36) UNIQUE NOT NULL)',
    );
    await insert(
      'background_jobs',
      [ids.background, ids.duplicate, ids.mixedBackground, ids.precisionBackground].map(id => ({
        id,
      })),
    );
    await insert(
      'queue_jobs',
      [ids.queued, ids.mixedQueue, ids.precisionQueue].map(id => ({ id })),
    );
    await insert('event_sessions', [{ id: ids.session, sessionId: ids.session }]);
    await db.query(`CREATE TABLE job_results (
      id VARCHAR(36) PRIMARY KEY, backgroundJobId VARCHAR(100), jobId VARCHAR(36),
      storageType VARCHAR(50), resultData TEXT, storageLocation VARCHAR(500),
      resultSizeBytes BIGINT, rowCount INT, resultMetadata TEXT, expiresAt DATETIME(6),
      isCompressed BOOLEAN, compressionType VARCHAR(50), createdAt DATETIME(6), updatedAt DATETIME(6),
      resultType VARCHAR(50), downloadUrl VARCHAR(255), fileName VARCHAR(255), fileSizeBytes BIGINT,
      mimeType VARCHAR(100), isDownloaded BOOLEAN, downloadCount INT, metadata TEXT)`);
    await db.query(`CREATE TABLE analytics_events (
      id VARCHAR(36) PRIMARY KEY, category VARCHAR(100), action VARCHAR(100), label VARCHAR(255),
      value DECIMAL(20,4), userId VARCHAR(36), sessionId VARCHAR(100), correlationId VARCHAR(36),
      metadata TEXT, userAgent TEXT, screenResolution VARCHAR(20), viewport VARCHAR(20),
      url TEXT, referrer TEXT, ipAddress VARCHAR(45), country VARCHAR(10), region VARCHAR(10),
      city VARCHAR(100), browser VARCHAR(50), browserVersion VARCHAR(50), os VARCHAR(50),
      osVersion VARCHAR(50), device VARCHAR(50), createdAt DATETIME(6), eventTimestamp DATETIME(6),
      properties TEXT, userProperties TEXT, anonymizedIp VARCHAR(45), pageUrl TEXT)`);
    background = {
      id: randomUUID(),
      backgroundJobId: ids.background,
      storageType: 'database',
      resultData: '{"preserve":"한글\\nbytes\\u0000"}',
      resultSizeBytes: '9007199254740993',
      rowCount: 1,
      resultMetadata: '{ "exact" : true }',
      expiresAt: '2026-10-27 01:02:03.000000',
      isCompressed: 0,
      createdAt: '2025-01-02 03:04:05.123456',
      updatedAt: '2025-01-03 03:04:05.654321',
    };
    queued = {
      id: randomUUID(),
      jobId: ids.queued,
      resultType: 'query_result',
      resultData: '{"queued":true}',
      expiresAt: '2026-10-27 01:02:03.000000',
      isDownloaded: 0,
      downloadCount: 0,
      createdAt: '2025-01-02 03:04:05.123456',
    };
    await insert('job_results', [
      background,
      queued,
      {
        ...background,
        id: randomUUID(),
        backgroundJobId: ids.mixedBackground,
        jobId: ids.mixedQueue,
      },
      { ...background, id: randomUUID(), backgroundJobId: randomUUID() },
      ...[0, 1].map(() => ({ ...background, id: randomUUID(), backgroundJobId: ids.duplicate })),
      {
        ...background,
        id: randomUUID(),
        backgroundJobId: ids.precisionBackground,
        expiresAt: '2026-10-27 01:02:03.987654',
      },
      {
        ...queued,
        id: randomUUID(),
        jobId: ids.precisionQueue,
        expiresAt: '2026-10-27 01:02:03.987654',
      },
    ]);
    collected = {
      id: randomUUID(),
      action: 'collected',
      category: 'qa',
      sessionId: 'collector-session',
      metadata: '{ "kind" : "한글 collector" }',
      eventTimestamp: '2025-01-01 12:34:56.000000',
      value: '1.0000',
      createdAt: '2025-01-02 03:04:05.123456',
    };
    client = {
      id: randomUUID(),
      action: 'client',
      category: 'qa',
      sessionId: ids.session,
      correlationId: randomUUID(),
      properties: '{ "kind" : "client" }',
      value: '1.2500',
      createdAt: '2025-01-02 03:04:05.123456',
    };
    await insert('analytics_events', [
      collected,
      client,
      { ...collected, id: randomUUID(), metadata: null, eventTimestamp: null },
      { ...collected, id: randomUUID(), properties: '{}' },
      { ...collected, id: randomUUID(), metadata: 'invalid-json' },
      { ...collected, id: randomUUID(), value: '1.2500' },
      { ...collected, id: randomUUID(), category: 'x'.repeat(51) },
      { ...client, id: randomUUID(), sessionId: randomUUID() },
      { ...client, id: randomUUID(), correlationId: null },
      { ...collected, id: randomUUID(), eventTimestamp: '2025-01-01 12:34:56.456789' },
    ]);
    original = { snapshot: await snapshot([...parents, ...legacy]), bytes: await legacyBytes() };
    runner = db.createQueryRunner();
    await runner.connect();
    await migration.up(runner);
  });

  afterAll(async () => {
    try {
      if (created) {
        await parentIdentity();
        await serverIdentity(db, schema);
        expect(await db.query('SELECT * FROM legacy_separation_fixture_owner')).toEqual([
          { token: owner, parentOwner: config.owner },
        ]);
        await runner?.release();
        await db.destroy();
        await admin.query(`DROP DATABASE \`${schema}\``);
        expect(
          await admin.query(
            'SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME=?',
            [schema],
          ),
        ).toEqual([]);
        console.info(
          JSON.stringify({
            phase: 'child-removed',
            schema,
            ownershipVerified: true,
            absentVerified: true,
          }),
        );
      }
    } finally {
      if (runner && !runner.isReleased) await runner.release();
      if (db?.isInitialized) await db.destroy();
      if (admin?.isInitialized) await admin.destroy();
    }
  });

  it('backfills unambiguous families with the original IDs, payloads and history', async () => {
    const backgroundPayload = { ...background };
    const queuedPayload = { ...queued };
    const collectedPayload = { ...collected };
    delete backgroundPayload.expiresAt;
    delete queuedPayload.expiresAt;
    delete collectedPayload.eventTimestamp;
    expect(await rows(targets[0])).toEqual([expect.objectContaining(backgroundPayload)]);
    expect(await rows(targets[1])).toEqual([expect.objectContaining(queuedPayload)]);
    expect(await rows(targets[2])).toEqual([
      expect.objectContaining({ ...collectedPayload, value: 1 }),
    ]);
    const copied = await rows(targets[3]);
    expect(copied).toEqual([
      expect.objectContaining({
        ...client,
        value: '1.25',
        properties: JSON.parse(client.properties),
      }),
    ]);
    expect(copied[0].properties).toEqual(JSON.parse(client.properties));
    const [bytes] = await db.query(
      'SELECT HEX(resultData) AS bytes FROM background_job_results WHERE id=?',
      [background.id],
    );
    expect(bytes.bytes).toBe(Buffer.from(background.resultData).toString('hex').toUpperCase());
  });

  it.each([
    [
      'background_job_results',
      'job_results',
      'background',
      ['createdAt', 'updatedAt', 'expiresAt'],
    ],
    ['queued_job_results', 'job_results', 'queued', ['createdAt', 'expiresAt']],
    [
      'analytics_collected_events',
      'analytics_events',
      'collected',
      ['createdAt', 'eventTimestamp'],
    ],
    ['client_analytics_events', 'analytics_events', 'client', ['createdAt']],
  ] as const)(
    'preserves all six timestamp digits in %s history',
    async (target, source, family, columns) => {
      const fixture = { background, queued, collected, client }[family];
      // DATE_FORMAT returns lexical SQL values; never pass history through JS Date milliseconds.
      const projection = columns
        .map(column => `DATE_FORMAT(\`${column}\`, '%Y-%m-%d %H:%i:%s.%f') AS \`${column}\``)
        .join(', ');
      const [oldHistory] = await db.query(`SELECT ${projection} FROM \`${source}\` WHERE id=?`, [
        fixture.id,
      ]);
      const [newHistory] = await db.query(`SELECT ${projection} FROM \`${target}\` WHERE id=?`, [
        fixture.id,
      ]);
      const expected = Object.fromEntries(columns.map(column => [column, fixture[column]]));
      expect(oldHistory).toEqual(expected);
      expect(newHistory).toEqual(expected);
    },
  );

  it.each([
    ['background_job_results', 'createdAt', 'datetime', 6, 'YES', 'current_timestamp(6)', false],
    ['background_job_results', 'updatedAt', 'datetime', 6, 'YES', 'current_timestamp(6)', true],
    ['background_job_results', 'expiresAt', 'datetime', 0, 'NO', 'current_timestamp', false],
    ['queued_job_results', 'createdAt', 'datetime', 6, 'NO', 'current_timestamp(6)', false],
    ['queued_job_results', 'expiresAt', 'datetime', 0, 'YES', null, false],
    [
      'analytics_collected_events',
      'createdAt',
      'timestamp',
      6,
      'NO',
      'current_timestamp(6)',
      false,
    ],
    ['analytics_collected_events', 'eventTimestamp', 'timestamp', 0, 'YES', null, false],
    ['client_analytics_events', 'createdAt', 'datetime', 6, 'NO', 'current_timestamp(6)', false],
  ] as const)(
    'keeps %s.%s precision, nullability and timestamp defaults',
    async (table, column, dataType, precisionDigits, nullable, defaultValue, updated) => {
      const [metadata] = await db.query(
        `SELECT DATA_TYPE AS dataType, DATETIME_PRECISION AS precisionDigits,
      IS_NULLABLE AS nullable, COLUMN_DEFAULT AS defaultValue, EXTRA AS extra
      FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND COLUMN_NAME=?`,
        [schema, table, column],
      );
      expect(metadata).toMatchObject({ dataType, precisionDigits, nullable });
      if (defaultValue)
        expect(metadata.defaultValue.toLowerCase().replace(/\(\)$/, '')).toBe(defaultValue);
      else expect(metadata.defaultValue).toBeNull();
      if (updated) expect(metadata.extra.toLowerCase()).toContain('on update current_timestamp(6)');
      else expect(metadata.extra.toLowerCase()).not.toContain('on update');
    },
  );

  it('generates timestamps for future inserts that omit their history fields', async () => {
    const futureId = randomUUID(),
      backgroundId = randomUUID(),
      queueId = randomUUID();
    const [before] = await db.query("SELECT DATE_FORMAT(NOW(6), '%Y-%m-%d %H:%i:%s.%f') AS stamp");
    try {
      await insert('background_jobs', [{ id: backgroundId }]);
      await insert('queue_jobs', [{ id: queueId }]);
      await insert('background_job_results', [{ id: futureId, backgroundJobId: backgroundId }]);
      await insert('queued_job_results', [
        { id: futureId, jobId: queueId, resultType: 'query_result' },
      ]);
      await insert('analytics_collected_events', [
        { id: futureId, category: 'qa', action: 'future', sessionId: 'collector-session' },
      ]);
      await insert('client_analytics_events', [
        {
          id: futureId,
          category: 'qa',
          action: 'future',
          sessionId: ids.session,
          correlationId: randomUUID(),
        },
      ]);
      const [after] = await db.query("SELECT DATE_FORMAT(NOW(6), '%Y-%m-%d %H:%i:%s.%f') AS stamp");
      for (const table of targets) {
        const columns =
          table === 'background_job_results' ? ['createdAt', 'updatedAt'] : ['createdAt'];
        const projection = columns
          .map(column => `DATE_FORMAT(\`${column}\`, '%Y-%m-%d %H:%i:%s.%f') AS \`${column}\``)
          .join(', ');
        const [history] = await db.query(`SELECT ${projection} FROM \`${table}\` WHERE id=?`, [
          futureId,
        ]);
        for (const column of columns) {
          expect(history[column]).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{6}$/);
          expect(history[column] >= before.stamp).toBe(true);
          expect(history[column] <= after.stamp).toBe(true);
        }
      }
    } finally {
      for (const table of targets)
        await db.query(`DELETE FROM \`${table}\` WHERE id=?`, [futureId]);
      await db.query('DELETE FROM background_jobs WHERE id=?', [backgroundId]);
      await db.query('DELETE FROM queue_jobs WHERE id=?', [queueId]);
    }
  });

  it('leaves all shared history and parents byte-for-byte unchanged, retaining ambiguous and invalid rows', async () => {
    expect(await snapshot([...parents, ...legacy])).toEqual(original.snapshot);
    expect(await legacyBytes()).toEqual(original.bytes);
    expect(await rows('job_results')).toHaveLength(8);
    expect(await rows('analytics_events')).toHaveLength(10);
    for (const [table, id] of [
      [targets[0], background.id],
      [targets[1], queued.id],
      [targets[2], collected.id],
      [targets[3], client.id],
    ])
      expect((await rows(table)).map(row => row.id)).toEqual([id]);
  });

  it('replays up without duplicate rows, schema changes or destination overwrites', async () => {
    // Distinct destination bytes prove replay does not UPSERT/REPLACE an existing ID.
    await db.query('UPDATE background_job_results SET resultData=? WHERE id=?', [
      'existing destination bytes',
      background.id,
    ]);
    try {
      const before = await snapshot([...parents, ...legacy, ...targets]);
      await migration.up(runner);
      expect(await snapshot([...parents, ...legacy, ...targets])).toEqual(before);
      expect(await legacyBytes()).toEqual(original.bytes);
    } finally {
      await db.query('UPDATE background_job_results SET resultData=? WHERE id=?', [
        background.resultData,
        background.id,
      ]);
    }
  });

  it('blocks destructive down and preserves every source and destination', async () => {
    const before = await snapshot([...parents, ...legacy, ...targets]);
    await expect(migration.down()).rejects.toThrow('no tables or history are dropped');
    expect(await snapshot([...parents, ...legacy, ...targets])).toEqual(before);
  });
});
