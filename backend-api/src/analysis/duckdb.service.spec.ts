import { DuckDBService } from './duckdb.service';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

describe('DuckDB worker boundaries and recovery', () => {
  let worker: DuckDBService;
  let directory: string;
  let filename: string;
  const saved = { ...process.env };
  beforeAll(async () => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'analysis-worker-'));
    process.env.FILE_UPLOAD_DIR = directory;
    worker = new DuckDBService();
    filename = (
      await worker.importFile({ originalname: 'values.csv', buffer: Buffer.from('n\n1\n2\n') })
    ).filename;
  });
  afterAll(async () => {
    await worker.onModuleDestroy();
    fs.rmSync(directory, { recursive: true, force: true });
    for (const key of [
      'FILE_UPLOAD_DIR',
      'ANALYSIS_MAX_RESULT_ROWS',
      'QUERY_TIMEOUT_MS',
      'QUERY_ALLOW_WRITE',
      'ANALYSIS_MAX_STORAGE_BYTES',
      'ANALYSIS_MAX_RESULT_BYTES',
    ]) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });
  it('blocks file reads, writes and multiple statements even if generic writes are enabled', async () => {
    process.env.QUERY_ALLOW_WRITE = 'true';
    for (const sql of [
      "SELECT * FROM read_csv('/etc/passwd')",
      'DELETE FROM uploaded_data',
      'SELECT 1; SELECT 2',
    ]) {
      await expect(worker.query(filename, sql)).rejects.toThrow();
    }
    expect((await worker.query(filename, 'SELECT count(*) AS n FROM uploaded_data')).datas).toEqual(
      [{ n: 2 }],
    );
  });
  it('does not create or access arbitrary databases', async () => {
    await expect(worker.query('/tmp/arbitrary.duckdb', 'SELECT 1')).rejects.toThrow(
      'invalid managed',
    );
  });
  it('limits raw results but allows aggregates over the complete data', async () => {
    process.env.ANALYSIS_MAX_RESULT_ROWS = '2';
    await expect(worker.query(filename, 'SELECT * FROM range(10000)')).rejects.toThrow(
      'result exceeds',
    );
    expect((await worker.query(filename, 'SELECT count(*) AS n FROM range(10000)')).datas).toEqual([
      { n: 10000 },
    ]);
    delete process.env.ANALYSIS_MAX_RESULT_ROWS;
  });
  it('binds metric filter values and preserves integers exceeding JS precision', async () => {
    expect(
      (await worker.query(filename, 'SELECT sum(n) AS n FROM uploaded_data WHERE n > ?', [1]))
        .datas,
    ).toEqual([{ n: 2 }]);
    expect((await worker.query(filename, 'SELECT 9007199254740993::BIGINT AS n')).datas).toEqual([
      { n: '9007199254740993' },
    ]);
    const empty = await worker.query(filename, 'SELECT n FROM uploaded_data WHERE false');
    expect(empty.datas).toEqual([]);
    expect(empty.fields).toEqual([{ columnName: 'n', columnType: 'number' }]);
  });
  it('preserves decimals and dates as serializable text', async () => {
    expect(
      (
        await worker.query(
          filename,
          "SELECT 123456789012345.67::DECIMAL(18,2) AS money, DATE '2026-10-12' AS day",
        )
      ).datas,
    ).toEqual([{ money: '123456789012345.67', day: '2026-10-12' }]);
  });
  it('rejects oversized result cells and recovers', async () => {
    process.env.ANALYSIS_MAX_RESULT_BYTES = '100';
    await expect(worker.query(filename, "SELECT repeat('x', 1000) AS text")).rejects.toThrow(
      'too large',
    );
    delete process.env.ANALYSIS_MAX_RESULT_BYTES;
    expect((await worker.query(filename, 'SELECT 1 AS n')).datas).toEqual([{ n: 1 }]);
  });
  it('rejects storage overflow, cleans files and permits the next import', async () => {
    process.env.ANALYSIS_MAX_STORAGE_BYTES = '1';
    await expect(
      worker.importFile({ originalname: 'quota.csv', buffer: Buffer.from('n\n1\n') }),
    ).rejects.toThrow('storage exceeds');
    expect(fs.readdirSync(directory)).toHaveLength(1);
    delete process.env.ANALYSIS_MAX_STORAGE_BYTES;
    const imported = await worker.importFile({
      originalname: 'after.csv',
      buffer: Buffer.from('n\n3\n'),
    });
    expect(imported.rows).toBe(1);
    expect(fs.statSync(imported.sourcePath).mode & 0o777).toBe(0o600);
    await worker.removeImport(imported.filename);
    expect(fs.existsSync(imported.filename)).toBe(false);
  });
  it('terminates a timed-out task and starts a fresh worker for the next query', async () => {
    process.env.QUERY_TIMEOUT_MS = '10';
    await expect(
      worker.query(
        filename,
        'SELECT sum(a.range * b.range) FROM range(1000000) a CROSS JOIN range(1000000) b',
      ),
    ).rejects.toThrow('timeout');
    process.env.QUERY_TIMEOUT_MS = '60000';
    expect((await worker.query(filename, 'SELECT count(*) AS n FROM uploaded_data')).datas).toEqual(
      [{ n: 2 }],
    );
  });
  it('physically stops only an aborted active task and keeps an independent queued query', async () => {
    const cancellation = new AbortController();
    const slow = worker.withCancellation(cancellation.signal, () =>
      worker.query(
        filename,
        'SELECT sum(a.range*b.range) FROM range(1000000) a CROSS JOIN range(1000000) b',
      ),
    );
    const rejected = expect(slow).rejects.toThrow('cancelled');
    while (!(worker as any).active) await new Promise(resolve => setTimeout(resolve, 1));
    const oldWorker = (worker as any).worker;
    const next = worker.query(filename, 'SELECT count(*) AS n FROM uploaded_data');
    cancellation.abort();
    await rejected;
    expect((await next).datas).toEqual([{ n: 2 }]);
    expect((worker as any).worker).not.toBe(oldWorker);
  });
  it('removes an aborted queued task without interrupting its unrelated active task', async () => {
    const active = worker.query(filename, 'SELECT sum(range) AS n FROM range(10000000)');
    const oldWorker = (worker as any).worker;
    const cancellation = new AbortController();
    const queued = worker.withCancellation(cancellation.signal, () =>
      worker.query(filename, 'SELECT 99 AS n'),
    );
    const rejected = expect(queued).rejects.toThrow('cancelled');
    cancellation.abort();
    await rejected;
    expect((await active).datas).toEqual([{ n: 49999995000000 }]);
    expect((worker as any).worker).toBe(oldWorker);
    expect((await worker.query(filename, 'SELECT 1 AS n')).datas).toEqual([{ n: 1 }]);
  });
  it('does not submit an already aborted scope or leak a completed scope to later work', async () => {
    const cancellation = new AbortController();
    await worker.withCancellation(cancellation.signal, () => worker.query(filename, 'SELECT 1'));
    cancellation.abort();
    const spy = jest.spyOn(worker as any, 'submit');
    await expect(
      worker.withCancellation(cancellation.signal, () => worker.query(filename, 'SELECT 2')),
    ).rejects.toThrow('cancelled');
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
    expect((await worker.query(filename, 'SELECT 3 AS n')).datas).toEqual([{ n: 3 }]);
  });
});
