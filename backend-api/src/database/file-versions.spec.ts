jest.mock('../connection/connection.service', () => ({ ConnectionService: class {} }));
import { DataSource } from 'typeorm';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Database } from './entities/database.entity';
import { DatabaseService } from './database.service';
import { DuckDBService } from '../analysis/duckdb.service';
import { decryptConnectionConfig } from '../utils/crypto.util';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

describe('file version replacement', () => {
  let db: DataSource;
  let worker: DuckDBService;
  let service: DatabaseService;
  let root: string;
  let id: number;
  const previous = {
    FILE_UPLOAD_DIR: process.env.FILE_UPLOAD_DIR,
    CONFIG_SECRET_KEY: process.env.CONFIG_SECRET_KEY,
  };
  const file = (amount = 10, originalname = 'sales.csv') => ({
    originalname,
    buffer: Buffer.from(`day,channel,amount\n2026-01-01,online,${amount}\n`),
  });
  const directories = () => fs.readdirSync(root).filter(n => /^[a-f0-9-]{36}$/.test(n));
  const row = () => db.getRepository(Database).findOneBy({ id });
  const config = async () => JSON.parse(decryptConnectionConfig((await row()).connectionConfig));
  const sum = async () =>
    (
      await worker.query(
        (
          await config()
        ).connection.filename,
        'SELECT SUM(amount) AS n FROM uploaded_data',
      )
    ).datas[0].n;
  beforeAll(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'file-version-'));
    process.env.FILE_UPLOAD_DIR = root;
    process.env.CONFIG_SECRET_KEY = 'test-secret';
    worker = new DuckDBService();
    db = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      synchronize: true,
      entities: [Database],
    });
    await db.initialize();
    service = new DatabaseService(
      db.getRepository(Database),
      {} as any,
      {
        query: jest.fn().mockResolvedValue({ affected: 0 }),
        delete: jest.fn().mockResolvedValue({ affected: 0 }),
      } as any,
      { delete: jest.fn() } as any,
      { removeKnex: jest.fn() } as any,
      worker,
    );
  });
  beforeEach(async () => {
    await db.getRepository(Database).clear();
    for (const name of directories())
      await worker.removeImport(path.join(root, name, 'data.duckdb'));
    id = (await service.uploadFile(file(), 7)).data.id;
  });
  afterAll(async () => {
    await worker.onModuleDestroy();
    await db.destroy();
    fs.rmSync(root, { recursive: true, force: true });
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  it('atomically replaces and restores data without changing source ID and retains old files', async () => {
    const before = (await service.fileVersions(id, 7)).data;
    const oldFile = (await config()).connection.filename;
    const after = (await service.replaceFile(id, file(30), before.revision, 7)).data;
    expect(after.sourceId).toBe(id);
    expect(after.revision).not.toBe(before.revision);
    expect(after.versions).toHaveLength(2);
    expect(await sum()).toBe(30);
    expect(fs.existsSync(oldFile)).toBe(true);
    expect(JSON.stringify(after)).not.toContain(root);
    const restored = (
      await service.restoreFile(
        id,
        { expectedRevision: after.revision, versionId: before.currentVersionId },
        7,
      )
    ).data;
    expect(restored.currentVersionId).toBe(before.currentVersionId);
    expect(await sum()).toBe(10);
    expect(restored.versions).toHaveLength(2);
  });
  it('same raw file is a no-op even when renamed', async () => {
    const before = (await service.fileVersions(id, 7)).data;
    const importSpy = jest.spyOn(worker, 'importFile');
    const res = await service.replaceFile(id, file(10, 'renamed.csv'), before.revision, 7);
    expect(importSpy).not.toHaveBeenCalled();
    importSpy.mockRestore();
    expect(res).toMatchObject({ unchanged: true, data: before });
    expect(directories()).toHaveLength(1);
  });
  it.each([
    'day,channel,other\n2026-01-01,online,30\n',
    'day,channel,amount\n2026-01-01,online,hello\n',
    'day,channel,amount,extra\n2026-01-01,online,30,1\n',
  ])('rejects changed names/types/extra columns while preserving last good version', async csv => {
    const before = (await service.fileVersions(id, 7)).data;
    await expect(
      service.replaceFile(
        id,
        { originalname: 'changed.csv', buffer: Buffer.from(csv) },
        before.revision,
        7,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect((await service.fileVersions(id, 7)).data).toEqual(before);
    expect(await sum()).toBe(10);
    expect(directories()).toHaveLength(1);
  });
  it('rejects malformed input without any pointer or directory change', async () => {
    const before = (await service.fileVersions(id, 7)).data;
    await expect(
      service.replaceFile(
        id,
        { originalname: 'bad.json', buffer: Buffer.from('{broken') },
        before.revision,
        7,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect((await service.fileVersions(id, 7)).data).toEqual(before);
    expect(directories()).toHaveLength(1);
  });
  it('cleans incoming stale requests and rejects restore path injection', async () => {
    const before = (await service.fileVersions(id, 7)).data;
    await service.replaceFile(id, file(30), before.revision, 7);
    const incoming = path.join(root, 'incoming.csv');
    fs.writeFileSync(incoming, file(90).buffer);
    await expect(
      service.replaceFile(id, { originalname: 'new.csv', path: incoming }, before.revision, 7),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(fs.existsSync(incoming)).toBe(false);
    const now = (await service.fileVersions(id, 7)).data;
    await expect(
      service.restoreFile(id, { expectedRevision: now.revision, versionId: '../data.duckdb' }, 7),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(await sum()).toBe(30);
  });
  it('CAS allows exactly one concurrent replacement, removing only the losing candidate', async () => {
    const before = (await service.fileVersions(id, 7)).data;
    const results = await Promise.allSettled([
      service.replaceFile(id, file(30), before.revision, 7),
      service.replaceFile(id, file(90), before.revision, 7),
    ]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    const failed = results.find(r => r.status === 'rejected') as PromiseRejectedResult;
    expect(failed.reason).toBeInstanceOf(ConflictException);
    expect(directories()).toHaveLength(2);
    expect([30, 90]).toContain(await sum());
  });
  it('caps retained versions at five but still permits same-file no-op and restore', async () => {
    for (const n of [20, 30, 40, 50])
      await service.replaceFile(id, file(n), (await service.fileVersions(id, 7)).data.revision, 7);
    const before = (await service.fileVersions(id, 7)).data;
    expect(before.versions).toHaveLength(5);
    await expect(service.replaceFile(id, file(60), before.revision, 7)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(await service.replaceFile(id, file(50), before.revision, 7)).toMatchObject({
      unchanged: true,
    });
    await service.restoreFile(
      id,
      { expectedRevision: before.revision, versionId: before.versions[0].id },
      7,
    );
    expect(await sum()).toBe(10);
    expect(directories()).toHaveLength(5);
  });
  it('denies foreign ownership before import and removes this incoming upload', async () => {
    const incoming = path.join(root, 'foreign.csv');
    fs.writeFileSync(incoming, file(90).buffer);
    await expect(service.fileVersions(id, 8)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.replaceFile(id, { originalname: 'new.csv', path: incoming }, 'a'.repeat(64), 8),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.restoreFile(id, {}, 8)).rejects.toBeInstanceOf(ForbiddenException);
    expect(fs.existsSync(incoming)).toBe(false);
    expect(directories()).toHaveLength(1);
  });
  it('keeps active version intact if metadata commit fails', async () => {
    const before = (await service.fileVersions(id, 7)).data;
    const spy = jest
      .spyOn(db.getRepository(Database), 'update')
      .mockRejectedValueOnce(new Error('metadata unavailable'));
    await expect(service.replaceFile(id, file(30), before.revision, 7)).rejects.toThrow(
      'metadata unavailable',
    );
    spy.mockRestore();
    expect((await service.fileVersions(id, 7)).data).toEqual(before);
    expect(directories()).toHaveLength(1);
  });
  it('reads a legacy file without rewriting metadata and adopts it on first replacement', async () => {
    const cfg = await config();
    delete cfg.fileVersions;
    await db.getRepository(Database).update({ id }, { connectionConfig: JSON.stringify(cfg) });
    const raw = (await row()).connectionConfig;
    const before = (await service.fileVersions(id, 7)).data;
    expect((await row()).connectionConfig).toBe(raw);
    expect(before.versions[0].rows).toBe(1);
    const after = (await service.replaceFile(id, file(30), before.revision, 7)).data;
    expect(after.versions).toHaveLength(2);
    expect(after.versions[0].id).toBe(before.versions[0].id);
  });
  it('discards an unregistered candidate even when the worker queue is saturated', async () => {
    const before = (await service.fileVersions(id, 7)).data;
    const original = worker.query.bind(worker);
    let describes = 0;
    const querySpy = jest.spyOn(worker, 'query').mockImplementation((filename, sql, bindings) => {
      if (sql === 'DESCRIBE uploaded_data' && ++describes === 2)
        return Promise.reject(new ServiceUnavailableException('analysis worker busy; retry later'));
      return original(filename, sql, bindings);
    });
    const removeSpy = jest.spyOn(worker, 'removeImport').mockRejectedValue(new Error('queue full'));
    await expect(service.replaceFile(id, file(30), before.revision, 7)).rejects.toThrow(
      'analysis worker busy; retry later',
    );
    expect(removeSpy).not.toHaveBeenCalled();
    querySpy.mockRestore();
    removeSpy.mockRestore();
    expect((await service.fileVersions(id, 7)).data).toEqual(before);
    expect(directories()).toHaveLength(1);
    expect(await sum()).toBe(10);
  });
  it('omits retained private paths and hashes from the general source list', async () => {
    const oldFilename = (await config()).connection.filename;
    await service.replaceFile(id, file(30), (await service.fileVersions(id, 7)).data.revision, 7);
    const stored = await config();
    const list = await service.findAll();
    const json = JSON.stringify(list);
    expect(list.data[0].connectionConfig['fileVersions']).toBeUndefined();
    expect(json).not.toContain(oldFilename);
    for (const version of stored.fileVersions) expect(json).not.toContain(version.sha256);
    expect(stored.fileVersions).toHaveLength(2);
  });
  it('source deletion removes all retained file versions', async () => {
    await service.replaceFile(id, file(30), (await service.fileVersions(id, 7)).data.revision, 7);
    await service.remove(id);
    expect(await row()).toBeNull();
    expect(directories()).toHaveLength(0);
  });
});
