jest.mock('../ai/ai.service', () => ({ AiService: class {} }));
// Isolated metadata tests never read a host encryption secret.
jest.mock('../utils/crypto.util', () => ({ encryptConnectionConfig: (value: string) => value }));
import { DataSource } from 'typeorm';
import { DuckDBService } from '../analysis/duckdb.service';
import { Database } from '../database/entities/database.entity';
import { SourceAccessService } from '../ownership/source-access.service';
import { StudioSampleService } from './studio-sample.service';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

describe('T6 owned samples with actual source oracles', () => {
  let db: DataSource, worker: DuckDBService, service: StudioSampleService, root: string;
  const previous = process.env.FILE_UPLOAD_DIR;
  const query = async (id: number, sql: string) => {
    const row = await db.manager.findOne(Database, { where: { id } });
    return worker.query(JSON.parse(row.connectionConfig).connection.filename, sql);
  };
  beforeAll(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-samples-'));
    process.env.FILE_UPLOAD_DIR = root;
    worker = new DuckDBService();
    db = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      synchronize: true,
      entities: [Database],
    }).initialize();
    service = new StudioSampleService(db, worker, new SourceAccessService(db), {
      withDuckDBSnapshot: (_id, cb) => cb(),
      queryDuckDB: query,
    } as any);
  });
  afterAll(async () => {
    await worker?.onModuleDestroy();
    await db?.destroy();
    fs.rmSync(root, { recursive: true, force: true });
    if (previous === undefined) delete process.env.FILE_UPLOAD_DIR;
    else process.env.FILE_UPLOAD_DIR = previous;
  });
  it('installs established 37-order fixture, returns a single source and reuses only within the actor', async () => {
    const [a, b] = await Promise.all([
      service.sample({ sample: 'commerce' }, 7),
      service.sample({ sample: 'commerce' }, 7),
    ]);
    expect(a).toEqual(b);
    expect(await service.sample({ sample: 'commerce' }, 7)).toEqual(a);
    const rows = (
      await query(
        a.sourceId,
        'SELECT COUNT(*) AS n, SUM(revenue) AS sales, SUM(refund_amount) AS refund, SUM(net_amount) AS net FROM uploaded_data',
      )
    ).datas;
    expect(rows).toEqual([{ n: 37, sales: '20994.61', refund: '4457.60', net: '16537.01' }]);
    const c = await service.sample({ sample: 'commerce' }, 8);
    expect(c.sourceId).not.toBe(a.sourceId);
    expect(await db.manager.count(Database)).toBe(2);
  });
  it('imports pinned official Rill Parquet and verifies all three independent oracle values', async () => {
    const result = await service.sample({ sample: 'rill' }, 7);
    const row = (
      await query(
        result.sourceId,
        'SELECT COUNT(*) AS n, SUM(bid_request_cnt) AS requests, SUM(bid_floor)/SUM(has_bid_floor_cnt) AS average FROM uploaded_data',
      )
    ).datas[0];
    expect(row.n).toBe(1391572);
    expect(row.requests).toBe(634513000);
    expect(row.average).toBeCloseTo(5.571238676526892, 9);
    expect(await service.sample({ sample: 'rill' }, 7)).toEqual(result);
  }, 120000);
  it('rejects unknown sample, client paths and invalid actor', async () => {
    await expect(service.sample({ sample: 'other' }, 7)).rejects.toThrow();
    await expect(service.sample({ sample: 'commerce', path: '/tmp/other' }, 7)).rejects.toThrow();
    await expect(service.sample({ sample: 'commerce' }, 0)).rejects.toThrow();
  });
  it.each(['margin', 'funnel', 'margin-reuse', 'margin-missing', 'margin-krw'])(
    'installs VM %s once per owner and verifies reused data',
    async sample => {
      const before = await db.manager.count(Database);
      const [a, b] = await Promise.all([
        service.sample({ sample }, 71),
        service.sample({ sample }, 71),
      ]);
      expect(a).toEqual(b);
      expect(await service.sample({ sample }, 71)).toEqual(a);
      const other = await service.sample({ sample }, 72);
      expect(other.sourceId).not.toBe(a.sourceId);
      expect(await db.manager.count(Database)).toBe(before + 2);
      const corruptedResult = jest
        .spyOn(worker, 'query')
        .mockResolvedValueOnce({ datas: [{ n: 0 }] } as any);
      try {
        await expect(service.sample({ sample }, 71)).rejects.toThrow('고정된 수치 기준과 다릅니다');
      } finally {
        corruptedResult.mockRestore();
      }
    },
  );
  it('rolls back failed source registration and discards exactly its own unregistered import', async () => {
    const sibling = await service.sample({ sample: 'funnel' }, 21);
    const siblingFile = JSON.parse(
      (await db.manager.findOneByOrFail(Database, { id: sibling.sourceId })).connectionConfig,
    ).connection.filename;
    const count = await db.manager.count(Database);
    const imported: string[] = [];
    const originalImport = worker.importFile.bind(worker);
    const importing = jest
      .spyOn(worker, 'importFile')
      .mockImplementation(async (...args: any[]) => {
        const result = await (originalImport as any)(...args);
        imported.push(result.filename);
        return result;
      });
    const originalCommerce = worker.importCommerce.bind(worker);
    const importingCommerce = jest
      .spyOn(worker, 'importCommerce')
      .mockImplementation(async (...args: any[]) => {
        const result = await (originalCommerce as any)(...args);
        imported.push(result.filename);
        return result;
      });
    const discard = jest.spyOn(worker, 'discardImport');
    await db.query(
      "CREATE TRIGGER fail_sample BEFORE INSERT ON database BEGIN SELECT RAISE(ABORT,'metadata unavailable'); END",
    );
    try {
      await expect(service.sample({ sample: 'commerce' }, 21)).rejects.toThrow(
        'metadata unavailable',
      );
      // Only the abandoned import is discarded, and its own directory is actually gone.
      expect(imported).toHaveLength(1);
      expect(discard).toHaveBeenCalledTimes(1);
      expect(discard).toHaveBeenCalledWith(imported[0]);
      expect(fs.existsSync(path.dirname(imported[0]))).toBe(false);
      // The registered sibling keeps its file and stays queryable.
      expect(fs.existsSync(siblingFile)).toBe(true);
      expect(
        (await query(sibling.sourceId, 'SELECT COUNT(*) AS n FROM uploaded_data')).datas,
      ).toEqual([{ n: 16 }]);
      expect(await db.manager.count(Database)).toBe(count);
    } finally {
      discard.mockRestore();
      importing.mockRestore();
      importingCommerce.mockRestore();
      await db.query('DROP TRIGGER fail_sample');
    }
  });
  it('accepts exact oracle amounts when the worker serializes decimals as numbers', async () => {
    const original = worker.query.bind(worker);
    const spy = jest.spyOn(worker, 'query').mockImplementation(async (...args) => {
      const result = await original(...args);
      for (const row of result.datas)
        for (const key of ['sales', 'refund', 'net'])
          if (row[key] !== undefined) row[key] = Number(row[key]);
      return result;
    });
    try {
      expect((await service.sample({ sample: 'commerce' }, 7)).sourceId).toBeGreaterThan(0);
    } finally {
      spy.mockRestore();
    }
  });
});
