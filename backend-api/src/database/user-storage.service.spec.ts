import { ForbiddenException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DataSource } from 'typeorm';
import { productionConfigProblems } from '../config/production-guard';
import { DuckDBService } from '../analysis/duckdb.service';
import { encryptConnectionConfig } from '../utils/crypto.util';
import { Database } from './entities/database.entity';
import { SourceDeleteReceipt } from './entities/source-delete-receipt.entity';
import { UserStorageService } from './user-storage.service';
import { uploadLimitProblems, uploadLimits } from './upload-limits';

describe('UserStorageService (real SQLite, real files)', () => {
  let db: DataSource;
  let root: string;
  let service: UserStorageService;
  const saved = {
    FILE_UPLOAD_DIR: process.env.FILE_UPLOAD_DIR,
    CONFIG_SECRET_KEY: process.env.CONFIG_SECRET_KEY,
  };

  beforeAll(async () => {
    process.env.CONFIG_SECRET_KEY = 'test-secret';
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'user-storage-'));
    process.env.FILE_UPLOAD_DIR = root;
    db = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      synchronize: true,
      entities: [Database, SourceDeleteReceipt],
    }).initialize();
    service = new UserStorageService(db, new DuckDBService());
  });
  afterAll(async () => {
    await db.destroy();
    fs.rmSync(root, { recursive: true, force: true });
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  beforeEach(async () => {
    await db.manager.clear(SourceDeleteReceipt);
    await db.manager.clear(Database);
    for (const entry of fs.readdirSync(root))
      fs.rmSync(path.join(root, entry), { recursive: true, force: true });
  });

  /** A managed import directory (`<root>/<uuid>`) holding `bytes` bytes in two files. */
  const importDir = (bytes: number, parent = root) => {
    const directory = path.join(parent, randomUUID());
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, 'data.duckdb'), Buffer.alloc(bytes - 10));
    fs.writeFileSync(path.join(directory, 'source.csv'), Buffer.alloc(10));
    return directory;
  };
  const source = (
    ownerId: number,
    directories: string[],
    extra: Partial<Database> = {},
    current = directories[directories.length - 1],
  ) =>
    db.getRepository(Database).save({
      ownerId,
      name: 's',
      engine: 'duckdb',
      type: 'duckdb',
      connectionConfig: encryptConnectionConfig(
        JSON.stringify({
          client: 'duckdb',
          connection: { filename: path.join(current, 'data.duckdb') },
          fileVersions: directories.map(d => ({ filename: path.join(d, 'data.duckdb') })),
        }),
      ),
      ...extra,
    });
  const receipt = (actorId: number, directories: string[], status: string, done = false) =>
    db.getRepository(SourceDeleteReceipt).save({
      actorId,
      organizationId: null,
      sourceId: 1,
      requestId: randomUUID(),
      expectedRevision: 'a'.repeat(64),
      digest: 'b'.repeat(64),
      filePlan: encryptConnectionConfig(
        JSON.stringify({
          version: 1,
          connectionClosed: true,
          files: directories.map(d => ({
            kind: 'duckdb',
            filename: path.join(d, 'data.duckdb'),
            done,
          })),
        }),
      ),
      managedFiles: directories.length,
      cleanupStatus: status as never,
    });
  const staged = (actorId: number, bytes: number) => {
    const directory = path.join(root, 'refresh-input', randomUUID());
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, 'admission.json'), JSON.stringify({ actorId }));
    fs.writeFileSync(path.join(directory, 'source.csv'), Buffer.alloc(bytes));
    return directory;
  };
  const bytesIn = (directory: string) =>
    fs
      .readdirSync(directory)
      .reduce((sum, name) => sum + fs.statSync(path.join(directory, name)).size, 0);

  it('counts the current file and every kept version of a live source, and only the owner’s', async () => {
    const a = importDir(1000);
    const b = importDir(2000);
    await source(1, [a, b]);
    await source(2, [importDir(5000)]);
    expect(await service.usage(db.manager, 1)).toEqual({ sources: 1, bytes: 3000 });
    expect(await service.usage(db.manager, 3)).toEqual({ sources: 0, bytes: 0 });
  });

  it('counts a directory once however many places point at it, and ignores other engines and outside paths', async () => {
    const shared = importDir(1000);
    await source(1, [shared, shared]);
    await source(1, [importDir(500)], { engine: 'sqlite3', type: 'sqlite' });
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'elsewhere-'));
    fs.writeFileSync(path.join(outside, 'data.duckdb'), Buffer.alloc(9999));
    await source(1, [outside]);
    try {
      expect(await service.usage(db.manager, 1)).toEqual({ sources: 2, bytes: 1000 });
    } finally {
      fs.rmSync(outside, { recursive: true, force: true });
    }
  });

  it('keeps counting the files of a deleted source until its cleanup finishes', async () => {
    await receipt(1, [importDir(700)], 'pending');
    await receipt(1, [importDir(800)], 'retry_required');
    await receipt(1, [importDir(900)], 'complete');
    await receipt(1, [importDir(600)], 'pending', true);
    await receipt(2, [importDir(4000)], 'pending');
    expect(await service.usage(db.manager, 1)).toEqual({ sources: 0, bytes: 1500 });
  });

  it('counts refresh inputs staged for the user and no one else’s', async () => {
    const mine = staged(1, 3000);
    staged(2, 7000);
    fs.mkdirSync(path.join(root, 'refresh-input', 'not-a-uuid'), { recursive: true });
    const orphan = path.join(root, 'refresh-input', randomUUID());
    fs.mkdirSync(orphan, { recursive: true });
    fs.writeFileSync(path.join(orphan, 'source.csv'), Buffer.alloc(8000));
    expect((await service.usage(db.manager, 1)).bytes).toBe(bytesIn(mine));
  });

  it('counts the files of an inactive source but not the source itself', async () => {
    await source(1, [importDir(1200)], { catalogActive: false });
    expect(await service.usage(db.manager, 1)).toEqual({ sources: 0, bytes: 1200 });
  });

  it('refuses a new source at the count limit and any upload past the byte limit, 403 with the numbers', async () => {
    await source(1, [importDir(1000)]);
    await source(1, [importDir(1000)]);
    const limits = { maxSources: 2, maxBytes: 5000 };
    const refused = async (incoming: { bytes: number; newSource?: boolean }) => {
      try {
        await service.assertWithin(db.manager, 1, incoming, limits);
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenException);
        return (error as ForbiddenException).getResponse() as any;
      }
      throw new Error('expected a refusal');
    };
    expect(await refused({ bytes: 1, newSource: true })).toMatchObject({
      error: 'UPLOAD_QUOTA_EXCEEDED',
      reason: 'sources',
      limit: 2,
      used: 2,
    });
    // Replacing a file adds bytes but not a source.
    await service.assertWithin(db.manager, 1, { bytes: 3000 }, limits);
    expect(await refused({ bytes: 3001 })).toMatchObject({
      reason: 'bytes',
      limit: 5000,
      used: 2000,
    });
  });

  it('allows an upload that lands exactly on the limit', async () => {
    await source(1, [importDir(1000)]);
    await service.assertWithin(
      db.manager,
      1,
      { bytes: 4000, newSource: true },
      { maxSources: 2, maxBytes: 5000 },
    );
    await expect(
      service.assertWithin(
        db.manager,
        1,
        { bytes: 4001, newSource: true },
        { maxSources: 2, maxBytes: 5000 },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('upload limit settings', () => {
  it('defaults to 20 sources and 1 GiB and accepts overrides', () => {
    expect(uploadLimits({})).toEqual({ maxSources: 20, maxBytes: 1024 ** 3 });
    expect(
      uploadLimits({
        UPLOAD_MAX_SOURCES_PER_USER: '3',
        UPLOAD_MAX_BYTES_PER_USER: ' 5000 ',
      } as any),
    ).toEqual({ maxSources: 3, maxBytes: 5000 });
  });

  it.each(['0', '-1', '1.5', 'many'])('rejects %s', value => {
    expect(() => uploadLimits({ UPLOAD_MAX_SOURCES_PER_USER: value } as any)).toThrow(
      'UPLOAD_MAX_SOURCES_PER_USER must be a positive integer',
    );
    expect(uploadLimitProblems({ UPLOAD_MAX_BYTES_PER_USER: value } as any)).toEqual([
      'UPLOAD_MAX_BYTES_PER_USER must be a positive integer',
    ]);
  });

  it('stops a production boot on a malformed value', () => {
    const base = {
      NODE_ENV: 'prod',
      ACCESS_SECRET: 'a'.repeat(40),
      REFRESH_SECRET: 'b'.repeat(40),
      JWT_ACCESS_SECRET: 'c'.repeat(40),
      URL_ACCESS_SECRET: 'd'.repeat(40),
      CONFIG_SECRET_KEY: 'e'.repeat(40),
      CORS_ORIGIN: 'https://app.example.test',
    } as any;
    expect(productionConfigProblems({ ...base, UPLOAD_MAX_BYTES_PER_USER: '0' })).toHaveLength(1);
    expect(productionConfigProblems({ ...base, UPLOAD_MAX_BYTES_PER_USER: '500000000' })).toEqual(
      [],
    );
  });
});
