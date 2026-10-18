import { DatabaseService } from './database.service';
import { DuckDBService } from '../analysis/duckdb.service';
import { ResponseStatus } from '../common/enum/response-status.enum';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { decryptConnectionConfig } from '../utils/crypto.util';

describe('DatabaseService uploadFile (DuckDB worker)', () => {
  let uploadDir: string;
  let service: DatabaseService;
  let duckdb: DuckDBService;
  let savedEntity: any;
  const repo = {
    manager: { connection: { options: { type: 'sqlite' } } },
    save: jest.fn(),
  };
  const previousEnv = {
    CONFIG_SECRET_KEY: process.env.CONFIG_SECRET_KEY,
    FILE_UPLOAD_DIR: process.env.FILE_UPLOAD_DIR,
  };

  beforeAll(() => {
    uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'upload-duckdb-test-'));
    process.env.CONFIG_SECRET_KEY = 'test-secret';
    process.env.FILE_UPLOAD_DIR = uploadDir;
    duckdb = new DuckDBService();
    service = new DatabaseService(repo as any, {} as any, {} as any, {} as any, {} as any, duckdb);
  });

  beforeEach(() => {
    savedEntity = null;
    repo.save.mockReset();
    repo.save.mockImplementation(async entity => {
      savedEntity = entity;
      return { id: 42, ...entity };
    });
  });

  afterAll(async () => {
    try {
      if (duckdb) await duckdb.onModuleDestroy();
    } finally {
      if (uploadDir) fs.rmSync(uploadDir, { recursive: true, force: true });
      for (const [key, value] of Object.entries(previousEnv)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });

  const uploadedFilename = () => {
    const cfg = JSON.parse(decryptConnectionConfig(savedEntity.connectionConfig));
    expect(cfg.client).toBe('duckdb');
    expect(path.isAbsolute(cfg.connection.filename)).toBe(true);
    expect(path.basename(cfg.connection.filename)).toBe('data.duckdb');
    expect(fs.existsSync(cfg.connection.filename)).toBe(true);
    return cfg.connection.filename as string;
  };

  const uploadedRows = async (sql = 'SELECT * FROM uploaded_data') =>
    (await duckdb.query(uploadedFilename(), sql)).datas;

  const uploadedColumnNames = async () =>
    (await duckdb.query(uploadedFilename(), 'DESCRIBE uploaded_data')).datas.map(
      column => column.column_name,
    );

  it('creates a DuckDB database and returns the upload contract for CSV', async () => {
    const res = await service.uploadFile({
      originalname: 'sales.csv',
      buffer: Buffer.from('name,amount\nalpha,10\nbeta,20\n'),
    });
    expect(res).toEqual({
      status: ResponseStatus.SUCCESS,
      data: { id: 42, name: 'sales', tableName: 'uploaded_data', rows: 2 },
    });
    expect(await uploadedRows('SELECT * FROM uploaded_data ORDER BY amount')).toEqual([
      { name: 'alpha', amount: 10 },
      { name: 'beta', amount: 20 },
    ]);
    expect(await uploadedColumnNames()).toEqual(['name', 'amount']);
  });

  it('accepts a disk-backed upload without a buffer', async () => {
    const sourcePath = path.join(uploadDir, 'disk-source.csv');
    fs.writeFileSync(sourcePath, 'name,amount\nfrom-disk,7\n');
    const res = await service.uploadFile({ originalname: 'disk.csv', path: sourcePath });
    expect(res.status).toBe(ResponseStatus.SUCCESS);
    expect(res.data.rows).toBe(1);
    expect(await uploadedRows()).toEqual([{ name: 'from-disk', amount: 7 }]);
  });

  it('sanitizes dangerous column names in the stored schema', async () => {
    const res = await service.uploadFile({
      originalname: 'x.csv',
      buffer: Buffer.from('a;b,"c""d"\n1,2\n'),
    });
    expect(res.status).toBe(ResponseStatus.SUCCESS);
    expect(await uploadedColumnNames()).toEqual(['a_b', 'c_d']);
    expect(await uploadedRows()).toEqual([{ a_b: 1, c_d: 2 }]);
  });

  it('imports actual Parquet values', async () => {
    const { ParquetWriter, ParquetSchema } = await import('parquetjs-lite');
    const schema = new ParquetSchema({ name: { type: 'UTF8' }, score: { type: 'DOUBLE' } });
    const sourcePath = path.join(uploadDir, 'sample.parquet');
    const writer = await ParquetWriter.openFile(schema, sourcePath);
    try {
      await writer.appendRow({ name: 'a', score: 1.5 });
      await writer.appendRow({ name: 'b', score: 2.5 });
    } finally {
      await writer.close();
    }
    const res = await service.uploadFile({
      originalname: 'sample.parquet',
      buffer: fs.readFileSync(sourcePath),
    });
    expect(res.status).toBe(ResponseStatus.SUCCESS);
    expect(res.data.rows).toBe(2);
    expect(await uploadedRows('SELECT * FROM uploaded_data ORDER BY score')).toEqual([
      { name: 'a', score: 1.5 },
      { name: 'b', score: 2.5 },
    ]);
  });

  it('imports a JSON array', async () => {
    const res = await service.uploadFile({
      originalname: 'cities.json',
      buffer: Buffer.from(
        JSON.stringify([
          { city: 'Seoul', n: 1 },
          { city: 'Busan', n: 2 },
        ]),
      ),
    });
    expect(res.status).toBe(ResponseStatus.SUCCESS);
    expect(res.data.rows).toBe(2);
    expect(await uploadedRows('SELECT * FROM uploaded_data ORDER BY n')).toEqual([
      { city: 'Seoul', n: 1 },
      { city: 'Busan', n: 2 },
    ]);
  });

  it('rejects an empty file without saving metadata', async () => {
    await expect(
      service.uploadFile({ originalname: 'e.csv', buffer: Buffer.alloc(0) }),
    ).rejects.toThrow();
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('rejects JSON that is not an array of objects', async () => {
    await expect(
      service.uploadFile({ originalname: 'bad.json', buffer: Buffer.from('{"a":1}') }),
    ).rejects.toThrow('array of objects');
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('retains both values from duplicate CSV headers using DuckDB native names', async () => {
    await service.uploadFile({
      originalname: 'duplicate.csv',
      buffer: Buffer.from('amount,amount\n1,2\n'),
    });
    // DuckDB deduplicates the second raw header as amount_1 (legacy parser used amount_).
    expect(await uploadedColumnNames()).toEqual(['amount', 'amount_1']);
    expect(await uploadedRows()).toEqual([{ amount: 1, amount_1: 2 }]);
  });

  it('unions heterogeneous JSON keys and preserves SQL nulls', async () => {
    await service.uploadFile({
      originalname: 'heterogeneous.json',
      buffer: Buffer.from(JSON.stringify([{ a: 1 }, { b: 2 }, { a: 3, b: null }])),
    });
    expect(await uploadedColumnNames()).toEqual(['a', 'b']);
    expect(await uploadedRows('SELECT * FROM uploaded_data ORDER BY a NULLS LAST')).toEqual([
      { a: 1, b: null },
      { a: 3, b: null },
      { a: null, b: 2 },
    ]);
  });

  it('preserves the three-row amount oracle', async () => {
    await service.uploadFile({
      originalname: 'amounts.json',
      buffer: Buffer.from(JSON.stringify([{ amount: 100 }, { amount: 250 }, { amount: 150 }])),
    });
    expect(await uploadedRows('SELECT amount FROM uploaded_data ORDER BY amount')).toEqual([
      { amount: 100 },
      { amount: 150 },
      { amount: 250 },
    ]);
  });

  it('preserves BOM, CRLF, quoted commas, escaped quotes and newlines through import', async () => {
    await service.uploadFile({
      originalname: 'quoted.csv',
      buffer: Buffer.from('\uFEFFname,detail\r\n"a,b","line1\nline2 ""quoted"""\r\n'),
    });
    expect(await uploadedRows()).toEqual([{ name: 'a,b', detail: 'line1\nline2 "quoted"' }]);
  });

  it('rejects unsupported text without saving metadata', async () => {
    await expect(
      service.uploadFile({ originalname: 'data.txt', buffer: Buffer.from('a\n1') }),
    ).rejects.toThrow('unsupported file extension');
    expect(repo.save).not.toHaveBeenCalled();
  });

  it.each([
    ['empty.csv', 'amount\n'],
    ['empty.json', '[]'],
  ])(
    'rejects %s without data rows and removes partial import artifacts',
    async (originalname, text) => {
      const before = fs.readdirSync(uploadDir).sort();
      await expect(service.uploadFile({ originalname, buffer: Buffer.from(text) })).rejects.toThrow(
        'no rows',
      );
      expect(repo.save).not.toHaveBeenCalled();
      expect(fs.readdirSync(uploadDir).sort()).toEqual(before);
    },
  );

  it('imports more than 100000 CSV rows without the legacy cap', async () => {
    const rowCount = 100001;
    // A repeated fixture avoids allocating a JS object per row; only aggregate results return.
    const res = await service.uploadFile({
      originalname: 'large.csv',
      buffer: Buffer.from(`amount\n${'1\n'.repeat(rowCount)}`),
    });
    expect(res.status).toBe(ResponseStatus.SUCCESS);
    expect(res.data.rows).toBe(rowCount);
    expect(
      await uploadedRows('SELECT COUNT(*) AS row_count, SUM(amount) AS total FROM uploaded_data'),
    ).toEqual([{ row_count: rowCount, total: rowCount }]);
  });

  it('removes the imported database and source when metadata saving fails', async () => {
    const before = fs.readdirSync(uploadDir).sort();
    let filename = '';
    repo.save.mockImplementationOnce(async entity => {
      filename = JSON.parse(decryptConnectionConfig(entity.connectionConfig)).connection.filename;
      expect(fs.existsSync(filename)).toBe(true);
      throw new Error('metadata save failed');
    });
    await expect(
      service.uploadFile({ originalname: 'failed.csv', buffer: Buffer.from('amount\n1\n') }),
    ).rejects.toThrow('metadata save failed');
    expect(repo.save).toHaveBeenCalledTimes(1);
    expect(filename).not.toBe('');
    expect(fs.existsSync(filename)).toBe(false);
    expect(fs.existsSync(path.dirname(filename))).toBe(false);
    expect(fs.readdirSync(uploadDir).sort()).toEqual(before);
  });
});
