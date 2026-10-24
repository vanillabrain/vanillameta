import { ForbiddenException } from '@nestjs/common';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DataSource } from 'typeorm';
import { DuckDBService } from '../analysis/duckdb.service';
import { User } from '../user/entities/user.entity';
import { DatabaseService } from './database.service';
import { Database } from './entities/database.entity';
import { SourceDeleteReceipt } from './entities/source-delete-receipt.entity';
import { UserStorageService } from './user-storage.service';

const csv = (name: string, rows = 3) => ({
  originalname: name,
  buffer: Buffer.from(
    'a,b\n' + Array.from({ length: rows }, (_, i) => `${i},x${i}`).join('\n') + '\n',
  ),
});

describe('uploadFile against the per-user limits (real SQLite, real DuckDB import)', () => {
  jest.setTimeout(60000);
  let db: DataSource;
  let duckdb: DuckDBService;
  let service: DatabaseService;
  let root: string;
  let user: number;
  const saved = {
    FILE_UPLOAD_DIR: process.env.FILE_UPLOAD_DIR,
    CONFIG_SECRET_KEY: process.env.CONFIG_SECRET_KEY,
    UPLOAD_MAX_SOURCES_PER_USER: process.env.UPLOAD_MAX_SOURCES_PER_USER,
    UPLOAD_MAX_BYTES_PER_USER: process.env.UPLOAD_MAX_BYTES_PER_USER,
  };

  beforeAll(async () => {
    process.env.CONFIG_SECRET_KEY = 'test-secret';
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'upload-limits-'));
    process.env.FILE_UPLOAD_DIR = root;
    duckdb = new DuckDBService();
    db = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      synchronize: true,
      entities: [User, Database, SourceDeleteReceipt],
    }).initialize();
    service = new DatabaseService(
      db.getRepository(Database),
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      duckdb,
      new UserStorageService(db, duckdb),
    );
    user = (await db.getRepository(User).save({ userId: 'u', email: 'u@x.test', password: 'x' }))
      .id;
  });
  afterAll(async () => {
    await duckdb.onModuleDestroy();
    await db.destroy();
    fs.rmSync(root, { recursive: true, force: true });
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  beforeEach(async () => {
    process.env.UPLOAD_MAX_SOURCES_PER_USER = '50';
    process.env.UPLOAD_MAX_BYTES_PER_USER = '1000000000';
    await db.manager.clear(Database);
    for (const entry of fs.readdirSync(root))
      fs.rmSync(path.join(root, entry), { recursive: true, force: true });
  });

  const upload = (name = 'one.csv') => service.uploadFile(csv(name), user, 0);
  const refusal = async (promise: Promise<unknown>) => {
    try {
      await promise;
    } catch (error) {
      expect(error).toBeInstanceOf(ForbiddenException);
      return (error as ForbiddenException).getResponse() as any;
    }
    throw new Error('expected the upload to be refused');
  };
  const leftovers = () => fs.readdirSync(root).filter(name => name !== 'refresh-input');

  it('refuses the upload past the source limit and leaves nothing behind', async () => {
    process.env.UPLOAD_MAX_SOURCES_PER_USER = '2';
    await upload('a.csv');
    await upload('b.csv');
    const before = leftovers();
    expect(await refusal(upload('c.csv'))).toMatchObject({
      error: 'UPLOAD_QUOTA_EXCEEDED',
      reason: 'sources',
      limit: 2,
      used: 2,
    });
    expect(await db.getRepository(Database).count()).toBe(2);
    expect(leftovers()).toEqual(before);
  });

  it('refuses before converting when the file alone is over the byte limit', async () => {
    process.env.UPLOAD_MAX_BYTES_PER_USER = '10';
    expect(await refusal(upload())).toMatchObject({ reason: 'bytes', limit: 10 });
    expect(leftovers()).toEqual([]);
    expect(await db.getRepository(Database).count()).toBe(0);
  });

  it('refuses under the actor lock when the converted import does not fit, and removes it', async () => {
    // The CSV is tiny, so the early check passes; the DuckDB file it becomes is far larger.
    process.env.UPLOAD_MAX_BYTES_PER_USER = '100000';
    expect(await refusal(upload())).toMatchObject({ reason: 'bytes', limit: 100000 });
    expect(await db.getRepository(Database).count()).toBe(0);
    expect(leftovers()).toEqual([]);
  });

  it('lets exactly the source limit through when uploads race, because same-user uploads queue on the lock', async () => {
    process.env.UPLOAD_MAX_SOURCES_PER_USER = '2';
    const outcomes = await Promise.allSettled(['a', 'b', 'c', 'd'].map(n => upload(`${n}.csv`)));
    expect(outcomes.filter(o => o.status === 'fulfilled')).toHaveLength(2);
    expect(await db.getRepository(Database).count()).toBe(2);
    expect(leftovers()).toHaveLength(2);
  });

  it('counts the first upload’s bytes against the second', async () => {
    await upload('a.csv');
    const used = (await new UserStorageService(db, duckdb).usage(db.manager, user)).bytes;
    expect(used).toBeGreaterThan(0);
    process.env.UPLOAD_MAX_BYTES_PER_USER = String(used + 10);
    expect(await refusal(upload('b.csv'))).toMatchObject({ reason: 'bytes' });
    expect(await db.getRepository(Database).count()).toBe(1);
  });

  it('refuses a file replacement that would pass the byte limit, but not one a refresh already admitted', async () => {
    const { data } = await upload('a.csv');
    const row = await db.getRepository(Database).findOneByOrFail({ id: data.id });
    const revision = createHash('sha256').update(row.connectionConfig).digest('hex');
    const used = (await new UserStorageService(db, duckdb).usage(db.manager, user)).bytes;
    process.env.UPLOAD_MAX_BYTES_PER_USER = String(used + 10);
    expect(
      await refusal(service.replaceFile(data.id, csv('a.csv', 9), revision, user, 0)),
    ).toMatchObject({
      reason: 'bytes',
    });
    // A refresh passes a commit callback and was checked when its input was staged.
    const commit = (activate: (manager: any) => Promise<any>) =>
      db.transaction(manager => activate(manager));
    await service.replaceFile(
      data.id,
      csv('a.csv', 9),
      revision,
      user,
      commit as any,
      undefined,
      0,
    );
    expect(
      (await db.getRepository(Database).findOneByOrFail({ id: data.id })).connectionConfig,
    ).not.toBe(row.connectionConfig);
  });

  it('does not check anything without a storage service or an owner (unit-test construction)', async () => {
    const bare = new DatabaseService(
      db.getRepository(Database),
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      duckdb,
    );
    process.env.UPLOAD_MAX_SOURCES_PER_USER = '1';
    await bare.uploadFile(csv('x.csv'), user, 0);
    await bare.uploadFile(csv('y.csv'), user, 0);
    expect(await db.getRepository(Database).count()).toBe(2);
  });
});
