jest.mock('../utils/crypto.util', () => ({
  encryptConnectionConfig: (v: string) => v,
  decryptConnectionConfig: (v: string) => v,
}));
jest.mock('../connection/connection.service', () => ({ ConnectionService: class {} }));
import { DataSource, EntityManager } from 'typeorm';
import { randomUUID } from 'crypto';
import * as fs from 'fs/promises';
import { promises as mutableFs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DuckDBService } from '../analysis/duckdb.service';
import { SourceAccessService } from '../ownership/source-access.service';
import { User } from '../user/entities/user.entity';
import { Database } from './entities/database.entity';
import { FileRefresh } from './entities/file-refresh.entity';
import { DatabaseService } from './database.service';
import { FileRefreshService } from './file-refresh.service';

const file = (amount = '20.00') => ({
  originalname: 'amounts.csv',
  buffer: Buffer.from('day,amount\n2025-01-01,' + amount + '\n'),
});
jest.setTimeout(30000);
describe('durable file refresh using actual SQLite and DuckDB worker', () => {
  let db: DataSource,
    worker: DuckDBService,
    files: DatabaseService,
    service: FileRefreshService,
    root: string,
    id: number,
    revision: string;
  const previousRoot = process.env.FILE_UPLOAD_DIR;
  const settle = async (s = service) => {
    while ((s as any).tasks.size) await Promise.all([...(s as any).tasks.values()]);
  };
  const state = async () => (await files.fileVersions(id, 1)).data;
  const make = () => new FileRefreshService(db, files, worker, new SourceAccessService(db));
  beforeEach(async () => {
    service = undefined;
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'vm-refresh-'));
    process.env.FILE_UPLOAD_DIR = root;
    db = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      entities: [Database, User, FileRefresh],
      synchronize: true,
    }).initialize();
    await db.manager.save(User, {
      id: 1,
      userId: 'test-refresh',
      password: 'not-used-by-test',
      email: 'test-refresh@example.invalid',
    });
    worker = new DuckDBService();
    files = new DatabaseService(
      db.getRepository(Database),
      {} as any,
      {} as any,
      {} as any,
      { removeKnex: jest.fn() } as any,
      worker,
    );
    id = (await files.uploadFile(file('10.00'), 1)).data.id;
    revision = (await state()).revision;
    service = make();
  });
  afterEach(async () => {
    await service?.onModuleDestroy();
    if (service) await settle();
    await worker?.onModuleDestroy();
    await db?.destroy();
    await fs.rm(root, { force: true, recursive: true });
    if (previousRoot === undefined) delete process.env.FILE_UPLOAD_DIR;
    else process.env.FILE_UPLOAD_DIR = previousRoot;
    jest.restoreAllMocks();
  });
  it('commits pointer and receipt together, replays the same request and exposes no private paths', async () => {
    const requestId = randomUUID();
    const job = await service.start(id, file(), revision, requestId, 1);
    await settle();
    const done = await service.get(id, requestId, 1);
    expect(done.status).toBe('succeeded');
    expect(done.attempts).toBe(1);
    expect(done.result.versions).toHaveLength(2);
    const spy = jest.spyOn(worker, 'importFile');
    expect((await service.start(id, file(), revision, requestId, 1)).id).toBe(job.id);
    await settle();
    expect(spy).not.toHaveBeenCalled();
    expect(JSON.stringify(done)).not.toContain(root);
    expect(JSON.stringify(done)).not.toMatch(/inputDigest|leaseToken|filename|connectionConfig/);
    expect((await state()).versions).toHaveLength(2);
    await expect(fs.stat(path.join(root, 'refresh-input', job.id))).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });
  it('rejects a different payload or actor without applying an additional version', async () => {
    const requestId = randomUUID();
    await service.start(id, file(), revision, requestId, 1);
    await settle();
    await expect(service.start(id, file('21.00'), revision, requestId, 1)).rejects.toThrow(
      '파일 또는 기준 버전',
    );
    await expect(service.get(id, requestId, 2)).rejects.toThrow();
    expect((await state()).versions).toHaveLength(2);
    expect(await db.manager.count(FileRefresh)).toBe(1);
  });
  it('keeps an admitted input and the last success across a new service instance, then explicitly retries one job', async () => {
    const schedule = jest.spyOn(service as any, 'schedule').mockImplementation(() => undefined);
    const requestId = randomUUID();
    const job = await service.start(id, file(), revision, requestId, 1);
    await db.manager.update(
      FileRefresh,
      { id: job.id },
      {
        status: 'running',
        attempts: 1,
        leaseToken: randomUUID(),
        leaseUntil: new Date(Date.now() - 1).toISOString(),
      },
    );
    await service.onModuleDestroy();
    schedule.mockRestore();
    service = make();
    const interrupted = await service.get(id, requestId, 1);
    expect(interrupted.status).toBe('interrupted');
    expect((await state()).versions).toHaveLength(1);
    await service.retry(id, requestId, 1);
    await settle();
    const done = await service.get(id, requestId, 1);
    expect(done.id).toBe(job.id);
    expect(done.status).toBe('succeeded');
    expect(done.attempts).toBe(2);
    expect((await state()).versions).toHaveLength(2);
  });
  it('rolls back source activation if the receipt write fails and retains the input for one explicit retry', async () => {
    const update = EntityManager.prototype.update;
    const spy = jest
      .spyOn(EntityManager.prototype, 'update')
      .mockImplementation(async function (
        this: EntityManager,
        entity: any,
        criteria: any,
        patch: any,
      ) {
        if (entity === FileRefresh && patch.status === 'succeeded')
          throw new Error('receipt write failed');
        return update.call(this, entity, criteria, patch);
      } as any);
    const requestId = randomUUID();
    await service.start(id, file(), revision, requestId, 1);
    await settle();
    expect((await service.get(id, requestId, 1)).status).toBe('failed');
    expect((await state()).versions).toHaveLength(1);
    spy.mockRestore();
    await service.retry(id, requestId, 1);
    await settle();
    expect((await service.get(id, requestId, 1)).status).toBe('succeeded');
    expect((await state()).versions).toHaveLength(2);
  });
  it('reports a schema failure without replacing the successful file and preserves structured changes', async () => {
    const requestId = randomUUID();
    await service.start(
      id,
      { originalname: 'changed.csv', buffer: Buffer.from('day,renamed\n2025-01-01,20.00\n') },
      revision,
      requestId,
      1,
    );
    await settle();
    const failed = await service.get(id, requestId, 1);
    expect(failed.status).toBe('failed');
    expect(failed.error.code).toBe('FILE_SCHEMA_CHANGED');
    expect(failed.error.changes.removed.map(c => c.name)).toContain('amount');
    expect((await state()).versions).toHaveLength(1);
  });
  it('resolves a same-file no-op as one successful receipt without importing or activating again', async () => {
    const spy = jest.spyOn(worker, 'importFile');
    const requestId = randomUUID();
    await service.start(id, file('10.00'), revision, requestId, 1);
    await settle();
    expect(spy).not.toHaveBeenCalled();
    expect((await service.get(id, requestId, 1)).result.unchanged).toBe(true);
    expect((await state()).revision).toBe(revision);
  });
  it('does not activate a queued job cancelled before execution', async () => {
    const schedule = jest.spyOn(service as any, 'schedule').mockImplementation(() => undefined);
    const requestId = randomUUID();
    const job = await service.start(id, file(), revision, requestId, 1);
    expect((await service.cancel(id, requestId, 1)).status).toBe('cancelled');
    schedule.mockRestore();
    await (service as any).run(job.id);
    expect((await state()).versions).toHaveLength(1);
    expect((await service.get(id, requestId, 1)).status).toBe('cancelled');
  });
  it('releases cancellation tracking even when removing the settled attempt fails once', async () => {
    const requestId = randomUUID();
    jest.spyOn(files, 'replaceFile').mockImplementationOnce(async () => {
      await service.cancel(id, requestId, 1);
      return {} as any;
    });
    const remove = fs.rm.bind(fs);
    let injected = false;
    jest.spyOn(mutableFs, 'rm').mockImplementation(async (filename: any, options: any) => {
      if (!injected && String(filename).includes('/attempt-')) {
        injected = true;
        throw Object.assign(new Error('temporary cleanup failure'), { code: 'EACCES' });
      }
      return remove(filename, options);
    });
    const job = await service.start(id, file(), revision, requestId, 1);
    await settle();
    expect(injected).toBe(true);
    expect((service as any).cancellations.size).toBe(0);
    expect((await service.get(id, requestId, 1)).cleanupPending).toBe(false);
    expect((await state()).revision).toBe(revision);
    await expect(fs.stat(path.join(root, 'refresh-input', job.id))).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });
  it.each(['local', 'other-instance'])(
    'cancels a running import from %s and settles owned files without activating',
    async origin => {
      const requestId = randomUUID();
      const before = await state();
      const directories = (await fs.readdir(root)).filter(name => name !== 'refresh-input').sort();
      if (origin === 'other-instance') {
        const importFile = worker.importFile.bind(worker);
        jest.spyOn(worker, 'importFile').mockImplementationOnce(async file => {
          // Keep this owned operation busy long enough for the real 5s lease heartbeat.
          await worker.query(
            path.join(root, directories[0], 'data.duckdb'),
            'SELECT sum(a.range*b.range) FROM range(1000000) a CROSS JOIN range(1000000) b',
          );
          return importFile(file);
        });
      }
      const job = await service.start(
        id,
        {
          originalname: 'large.csv',
          buffer: Buffer.from('day,amount\n' + '2025-01-01,20.00\n'.repeat(400000)),
        },
        revision,
        requestId,
        1,
      );
      const deadline = Date.now() + 10000;
      const kind = origin === 'local' ? 'import' : 'query';
      while (
        ((worker as any).active?.kind !== kind ||
          (origin === 'other-instance' && !(worker as any).active?.sql?.includes('CROSS JOIN'))) &&
        Date.now() < deadline
      )
        await new Promise(resolve => setTimeout(resolve, 1));
      expect((worker as any).active?.kind).toBe(kind);
      if (origin === 'other-instance') expect((worker as any).active?.sql).toContain('CROSS JOIN');
      const oldWorker = (worker as any).worker;
      const canceller = origin === 'local' ? service : make();
      expect((await canceller.cancel(id, requestId, 1)).status).toBe('cancelled');
      await settle();
      const done = await service.get(id, requestId, 1);
      expect(done.status).toBe('cancelled');
      expect(done.cleanupPending).toBe(false);
      expect(await state()).toEqual(before);
      expect(oldWorker.threadId).toBe(-1);
      expect((await fs.readdir(root)).filter(name => name !== 'refresh-input').sort()).toEqual(
        directories,
      );
      await expect(fs.stat(path.join(root, 'refresh-input', job.id))).rejects.toMatchObject({
        code: 'ENOENT',
      });
      await expect(service.retry(id, requestId, 1)).rejects.toThrow('다시 실행');
      if (origin !== 'local') await canceller.onModuleDestroy();
    },
  );
  it('keeps durable input when admission commits but the transaction response is lost', async () => {
    const schedule = jest.spyOn(service as any, 'schedule').mockImplementation(() => undefined);
    const original = db.transaction.bind(db);
    const transaction = jest
      .spyOn(db, 'transaction')
      .mockImplementationOnce(async (callback: any) => {
        await original(callback);
        throw new Error('committed response lost');
      });
    const requestId = randomUUID();
    const admitted = await service.start(id, file(), revision, requestId, 1);
    expect(admitted.status).toBe('queued');
    await expect(
      fs.stat(path.join(root, 'refresh-input', admitted.id, 'source.csv')),
    ).resolves.toBeDefined();
    transaction.mockRestore();
    schedule.mockRestore();
    await service.retry(id, requestId, 1);
    await settle();
    expect((await service.get(id, requestId, 1)).status).toBe('succeeded');
    expect((await state()).versions).toHaveLength(2);
  });
  it('runs an explicit retry after the previous expired attempt settles', async () => {
    const original = worker.importFile.bind(worker);
    let release: () => void;
    let arrived: () => void;
    const held = new Promise<void>(resolve => {
      release = resolve;
    });
    const entered = new Promise<void>(resolve => {
      arrived = resolve;
    });
    jest.spyOn(worker, 'importFile').mockImplementationOnce(async (...args: any[]) => {
      const result = await (original as any)(...args);
      arrived();
      await held;
      return result;
    });
    const requestId = randomUUID();
    const job = await service.start(id, file(), revision, requestId, 1);
    await entered;
    await db.manager.update(
      FileRefresh,
      { id: job.id },
      { leaseUntil: new Date(Date.now() - 1000).toISOString() },
    );
    expect((await service.get(id, requestId, 1)).status).toBe('interrupted');
    await service.retry(id, requestId, 1);
    release();
    await settle();
    const done = await service.get(id, requestId, 1);
    expect(done.status).toBe('succeeded');
    expect(done.attempts).toBe(2);
    expect((await state()).versions).toHaveLength(2);
  });
  it('counts failed terminal cleanup and retries it after service restart', async () => {
    const original = fs.rm;
    const remove = jest
      .spyOn(mutableFs, 'rm')
      .mockImplementation(async (target: any, options: any) => {
        if (
          String(target).startsWith(path.join(root, 'refresh-input')) &&
          !path.extname(String(target))
        )
          throw new Error('temporary storage unavailable');
        return original(target, options);
      });
    const requestId = randomUUID();
    const job = await service.start(id, file(), revision, requestId, 1);
    await settle();
    expect((await service.get(id, requestId, 1)).cleanupPending).toBe(true);
    expect(await db.manager.count(FileRefresh, { where: { inputRetained: true } })).toBe(1);
    remove.mockRestore();
    await service.onModuleDestroy();
    service = make();
    await service.onApplicationBootstrap();
    expect((await service.get(id, requestId, 1)).cleanupPending).toBe(false);
    await expect(fs.stat(path.join(root, 'refresh-input', job.id))).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });
  it('counts unconfirmed orphan input and cleans it only after metadata recovers and admission grace expires', async () => {
    const transaction = jest
      .spyOn(db, 'transaction')
      .mockRejectedValueOnce(new Error('admission unavailable'));
    const repository = db.getRepository(FileRefresh);
    const find = repository.findOneBy.bind(repository);
    let reads = 0;
    const lookup = jest.spyOn(repository, 'findOneBy').mockImplementation(async (criteria: any) => {
      if (++reads === 2) throw new Error('reconciliation unavailable');
      return find(criteria);
    });
    await expect(service.start(id, file(), revision, randomUUID(), 1)).rejects.toThrow(
      '파일은 보존',
    );
    transaction.mockRestore();
    lookup.mockRestore();
    expect(await db.manager.count(FileRefresh)).toBe(0);
    expect(await (service as any).retainedCount(1)).toBe(1);
    await service.onApplicationBootstrap();
    expect(await (service as any).retainedCount(1)).toBe(1);
    const admissions = await (service as any).stagedAdmissions(1);
    const markerPath = path.join(root, 'refresh-input', admissions[0].id, 'admission.json');
    const marker = JSON.parse(await fs.readFile(markerPath, 'utf8'));
    marker.createdAt = Date.now() - 16 * 60 * 1000;
    await fs.writeFile(markerPath, JSON.stringify(marker));
    await service.onModuleDestroy();
    service = make();
    await service.onApplicationBootstrap();
    expect(await (service as any).retainedCount(1)).toBe(0);
    expect((await state()).versions).toHaveLength(1);
  });
  const correctionSettings = { keyColumn: 'order_id', updatedAtColumn: 'updated_at' };
  const orderFile = (rows: string[]) => ({
    originalname: 'orders.csv',
    buffer: Buffer.from('order_id,updated_at,revenue,refund_amount\n' + rows.join('\n') + '\n'),
  });
  const initialOrders = [
    'ORD-001,2025-01-02T00:00:00,100.00,0.00',
    'ORD-002,2025-01-03T00:00:00,200.00,20.00',
    'ORD-003,2025-01-04T00:00:00,300.00,0.00',
  ];
  const correctionOrders = [
    'ORD-001,2025-01-05T00:00:00,100.00,30.00',
    'ORD-002,2025-01-02T00:00:00,999.00,0.00',
    'ORD-004,2025-01-05T00:00:00,400.00,40.00',
    'ORD-004,2025-01-05T00:00:00,400.00,40.00',
    'ORD-003,2025-01-04T00:00:00,300.00,0.00',
    'ORD-001,2025-01-03T00:00:00,100.00,10.00',
  ];
  const prepareOrders = async () => {
    id = (await files.uploadFile(orderFile(initialOrders), 1)).data.id;
    revision = (await state()).revision;
  };
  it('commits correction statistics with the file receipt, replays it and applies reordered duplicate batches without another version', async () => {
    await prepareOrders();
    const requestId = randomUUID();
    const originalRevision = revision;
    await service.start(
      id,
      orderFile(correctionOrders),
      revision,
      requestId,
      1,
      JSON.stringify(correctionSettings),
    );
    await settle();
    const done = await service.get(id, requestId, 1);
    expect(done.status).toBe('succeeded');
    expect(done.correction).toEqual(correctionSettings);
    expect(done.result.correctionStats).toMatchObject({
      rows: 4,
      inputRows: 6,
      inserted: 1,
      updated: 1,
      identical: 1,
      ignoredOlder: 1,
      duplicateRowsDropped: 1,
      supersededRows: 1,
    });
    expect((await state()).versions).toHaveLength(2);
    const source = await db.manager.findOneByOrFail(Database, { id });
    const config = JSON.parse(source.connectionConfig);
    const totals = (
      await worker.query(
        config.connection.filename,
        'SELECT SUM(revenue) AS revenue,SUM(refund_amount) AS refunds FROM uploaded_data',
      )
    ).datas[0];
    expect(totals).toEqual({ revenue: 1000, refunds: 90 });
    expect(
      (
        await service.start(
          id,
          orderFile(correctionOrders),
          originalRevision,
          requestId,
          1,
          JSON.stringify(correctionSettings),
        )
      ).id,
    ).toBe(done.id);
    await expect(
      service.start(
        id,
        orderFile(correctionOrders),
        originalRevision,
        requestId,
        1,
        JSON.stringify({ keyColumn: 'updated_at', updatedAtColumn: 'order_id' }),
      ),
    ).rejects.toThrow('파일 또는 기준 버전');
    const duplicate = randomUUID();
    revision = (await state()).revision;
    await service.start(
      id,
      orderFile([...correctionOrders].reverse()),
      revision,
      duplicate,
      1,
      JSON.stringify(correctionSettings),
    );
    await settle();
    const replay = await service.get(id, duplicate, 1);
    expect(replay.result.unchanged).toBe(true);
    expect(replay.result.correctionStats).toMatchObject({ rows: 4, inserted: 0, updated: 0 });
    expect((await state()).versions).toHaveLength(2);
    expect((await state()).revision).toBe(revision);
  });
  it('keeps the previous file when a correction timestamp has conflicting values', async () => {
    await prepareOrders();
    const requestId = randomUUID();
    await service.start(
      id,
      orderFile([
        'ORD-002,2025-01-03T00:00:00,200.00,99.00',
        'ORD-002,2025-01-06T00:00:00,200.00,50.00',
      ]),
      revision,
      requestId,
      1,
      JSON.stringify(correctionSettings),
    );
    await settle();
    const failed = await service.get(id, requestId, 1);
    expect(failed.status).toBe('failed');
    expect(failed.error.code).toBe('FILE_CORRECTION_AMBIGUOUS');
    expect(failed.error.message).toContain('같은 업무 키');
    expect((await state()).revision).toBe(revision);
    expect((await state()).versions).toHaveLength(1);
  });
  it('retains correction settings across an interrupted job and retries the same input after a new service instance', async () => {
    await prepareOrders();
    const schedule = jest.spyOn(service as any, 'schedule').mockImplementation(() => undefined);
    const requestId = randomUUID();
    const job = await service.start(
      id,
      orderFile(correctionOrders),
      revision,
      requestId,
      1,
      JSON.stringify(correctionSettings),
    );
    await db.manager.update(
      FileRefresh,
      { id: job.id },
      {
        status: 'running',
        attempts: 1,
        leaseToken: randomUUID(),
        leaseUntil: new Date(Date.now() - 1).toISOString(),
      },
    );
    await service.onModuleDestroy();
    schedule.mockRestore();
    service = make();
    expect((await service.get(id, requestId, 1)).correction).toEqual(correctionSettings);
    await service.retry(id, requestId, 1);
    await settle();
    const done = await service.get(id, requestId, 1);
    expect(done.id).toBe(job.id);
    expect(done.attempts).toBe(2);
    expect(done.status).toBe('succeeded');
    expect(done.result.correctionStats.rows).toBe(4);
    expect((await state()).versions).toHaveLength(2);
  });
});
