import { DatabaseService } from './database.service';
import { ResponseStatus } from '../common/enum/response-status.enum';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { knex } from 'knex';
import { decryptConnectionConfig } from '../utils/crypto.util';

describe('DatabaseService uploadFile', () => {
  const uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'upload-test-'));
  let service: DatabaseService;
  let savedEntity: any;

  beforeAll(() => {
    process.env.CONFIG_SECRET_KEY = 'test-secret';
    process.env.FILE_UPLOAD_DIR = uploadDir;
    const repo = { save: jest.fn(async e => ({ id: 42, ...e })) };
    service = new DatabaseService(repo as any, {} as any, {} as any, {} as any, {} as any);
    savedEntity = null;
    repo.save.mockImplementation(async e => {
      savedEntity = e;
      return { id: 42, ...e };
    });
  });

  it('creates a sqlite database from a CSV upload', async () => {
    const csv = 'name,amount\nalpha,10\nbeta,20\n';
    const res = await service.uploadFile({ originalname: 'sales.csv', buffer: Buffer.from(csv) });
    expect(res.status).toBe(ResponseStatus.SUCCESS);
    expect(res.data.tableName).toBe('uploaded_data');
    expect(res.data.rows).toBe(2);

    // 실제 sqlite 파일이 생성되고 데이터를 조회할 수 있는지 확인
    const cfg = JSON.parse(decryptConnectionConfig(savedEntity.connectionConfig));
    expect(cfg.client).toBe('sqlite3');
    const db = knex({
      client: 'sqlite3',
      connection: { filename: cfg.connection.filename },
      useNullAsDefault: true,
    });
    const rows = await db('uploaded_data').select('*');
    await db.destroy();
    expect(rows).toHaveLength(2);
    expect(rows[0].name).toBe('alpha');
    expect(rows[0].amount).toBe(10); // 숫자 컬럼 추론
  });

  it('sanitizes dangerous column names', async () => {
    const csv = 'a;b,c"d\n1,2\n';
    const res = await service.uploadFile({ originalname: 'x.csv', buffer: Buffer.from(csv) });
    expect(res.status).toBe(ResponseStatus.SUCCESS);
    const cfg = JSON.parse(decryptConnectionConfig(savedEntity.connectionConfig));
    const db = knex({
      client: 'sqlite3',
      connection: { filename: cfg.connection.filename },
      useNullAsDefault: true,
    });
    const info = await db.raw('PRAGMA table_info(uploaded_data)');
    await db.destroy();
    const names = info.map((i: any) => i.name);
    expect(names).toEqual(['a_b', 'c_d']);
  });

  it('accepts a parquet file upload', async () => {
    const { ParquetWriter, ParquetSchema } = await import('parquetjs-lite');
    const schema = new ParquetSchema({ name: { type: 'UTF8' }, score: { type: 'DOUBLE' } });
    const tmp = path.join(uploadDir, 'sample.parquet');
    const writer = await ParquetWriter.openFile(schema, tmp);
    await writer.appendRow({ name: 'a', score: 1.5 });
    await writer.appendRow({ name: 'b', score: 2.5 });
    await writer.close();
    const res = await service.uploadFile({
      originalname: 'sample.parquet',
      buffer: fs.readFileSync(tmp),
    });
    expect(res.status).toBe(ResponseStatus.SUCCESS);
    expect(res.data.rows).toBe(2);
  });

  it('accepts a JSON array upload', async () => {
    const json = JSON.stringify([
      { city: 'Seoul', n: 1 },
      { city: 'Busan', n: 2 },
    ]);
    const res = await service.uploadFile({
      originalname: 'cities.json',
      buffer: Buffer.from(json),
    });
    expect(res.status).toBe(ResponseStatus.SUCCESS);
    expect(res.data.rows).toBe(2);
  });

  it('rejects an empty file', async () => {
    await expect(
      service.uploadFile({ originalname: 'e.csv', buffer: Buffer.alloc(0) }),
    ).rejects.toThrow();
  });

  it('rejects a json file that is not an array of objects', async () => {
    await expect(
      service.uploadFile({ originalname: 'bad.json', buffer: Buffer.from('{"a":1}') }),
    ).rejects.toThrow('array of objects');
  });

  const uploadedRows = async () => {
    const cfg = JSON.parse(decryptConnectionConfig(savedEntity.connectionConfig));
    const db = knex(cfg);
    try {
      return await db('uploaded_data').select('*');
    } finally {
      await db.destroy();
    }
  };

  it('retains both values from identical raw CSV headers', async () => {
    await service.uploadFile({
      originalname: 'duplicate.csv',
      buffer: Buffer.from('amount,amount\n1,2\n'),
    });
    expect(await uploadedRows()).toEqual([{ amount: 1, amount_: 2 }]);
  });

  it('unions heterogeneous JSON keys and preserves SQL nulls', async () => {
    await service.uploadFile({
      originalname: 'heterogeneous.json',
      buffer: Buffer.from(JSON.stringify([{ a: 1 }, { b: 2 }, { a: 3, b: null }])),
    });
    expect(await uploadedRows()).toEqual([
      { a: 1, b: null },
      { a: null, b: 2 },
      { a: 3, b: null },
    ]);
  });

  it('preserves the three-row amount oracle', async () => {
    await service.uploadFile({
      originalname: 'amounts.json',
      buffer: Buffer.from(JSON.stringify([{ amount: 100 }, { amount: 250 }, { amount: 150 }])),
    });
    expect((await uploadedRows()).map(row => row.amount)).toEqual([100, 250, 150]);
  });

  it('preserves BOM, CRLF, quoted commas, escaped quotes and newlines', () => {
    expect(
      (service as any).parseCsvRows(
        Buffer.from('\uFEFFname,detail\r\n"a,b","line1\nline2 ""quoted"""\r\n'),
      ),
    ).toEqual([{ name: 'a,b', detail: 'line1\nline2 "quoted"' }]);
  });

  it('rejects unsupported text before parsing or saving a source', async () => {
    const previous = savedEntity;
    await expect(
      service.uploadFile({ originalname: 'data.txt', buffer: Buffer.from('a\n1') }),
    ).rejects.toThrow('unsupported file extension');
    expect(savedEntity).toBe(previous);
  });

  it('rejects a supported source without data rows', async () => {
    await expect(
      service.uploadFile({ originalname: 'empty.csv', buffer: Buffer.from('amount\n') }),
    ).rejects.toThrow('no rows');
  });

  it('rejects the 100001st Parquet row and always closes its reader', async () => {
    const { ParquetReader } = await import('parquetjs-lite');
    let count = 0;
    const close = jest.fn().mockResolvedValue(undefined);
    const open = jest.spyOn(ParquetReader, 'openBuffer').mockResolvedValue({
      getCursor: () => ({ next: async () => (++count <= 100001 ? { amount: count } : null) }),
      close,
    } as any);
    const previous = savedEntity;
    try {
      await expect(
        service.uploadFile({ originalname: 'large.parquet', buffer: Buffer.from('mock-parquet') }),
      ).rejects.toThrow('row limit exceeded');
      expect(close).toHaveBeenCalledTimes(1);
      expect(savedEntity).toBe(previous);
    } finally {
      open.mockRestore();
    }
  });
});
