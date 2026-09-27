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
});
