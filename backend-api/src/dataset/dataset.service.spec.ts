import { DataSource } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { Database } from '../database/entities/database.entity';
import { SourceAccessService } from '../ownership/source-access.service';
import { HybridCacheService } from '../common/optimization/hybrid-cache.service';
import { QueryCacheService } from '../common/optimization/query-cache.service';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DatasetService } from './dataset.service';
import { ConnectionService } from '../connection/connection.service';
import { Dataset } from './entities/dataset.entity';
import { Widget } from '../widget/entities/widget.entity';

describe('DatasetService', () => {
  let service: DatasetService;
  const mockRepository = () => ({
    find: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(),
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DatasetService,
        { provide: getRepositoryToken(Dataset), useFactory: mockRepository },
        { provide: getRepositoryToken(Widget), useFactory: mockRepository },
        { provide: ConnectionService, useValue: { executeQuery: jest.fn() } },
      ],
    }).compile();

    service = module.get<DatasetService>(DatasetService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

describe('Hybrid cache revision and authority integration', () => {
  let db: DataSource, service: DatasetService, l1: QueryCacheService, hybrid: HybridCacheService;
  const query = jest.fn();
  const logger: any = {
    log: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
  beforeEach(async () => {
    query.mockReset().mockResolvedValue({ status: 'SUCCESS', datas: [{ value: 'A' }], fields: [] });
    db = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      synchronize: true,
      entities: [User, Database, Dataset],
    }).initialize();
    await db.manager.insert(
      User,
      [7, 8].map(id => ({
        id,
        userId: `hybrid-owner-${id}`,
        email: `hybrid-${id}@example.invalid`,
        password: 'unused',
        active: true,
        authVersion: 0,
      })),
    );
    for (const id of [1, 2]) {
      await db.manager.insert(Database, {
        id,
        ownerId: 7,
        catalogVersion: 0,
        catalogActive: true,
        name: `Source ${id}`,
        type: 'mysql',
        engine: 'mysql2',
        connectionConfig: JSON.stringify({ fileVersions: ['v1'] }),
      });
      await db.manager.insert(Dataset, {
        id,
        databaseId: id,
        title: `Dataset ${id}`,
        query: "SELECT 'A' AS value",
      });
    }
    l1 = new QueryCacheService(
      { getCacheConfig: () => ({ enabled: true, ttl: 3600, maxSize: 100 }) } as any,
      logger,
    );
    hybrid = new HybridCacheService(
      l1,
      { isConnected: () => false, get: jest.fn().mockResolvedValue(null) } as any,
      logger,
    );
    service = new DatasetService(
      db.getRepository(Dataset),
      {} as any,
      { executeQuery: query } as any,
      db.getRepository(Database),
      hybrid,
      logger,
      undefined,
      undefined,
      new SourceAccessService(db),
    );
  });
  afterEach(async () => {
    await l1?.onModuleDestroy();
    await db?.destroy();
  });
  it('binds actual L1 hits to source identity and changed registered file versions', async () => {
    const actor = { actor: 7, epoch: 0 };
    expect((await service.executeCachedQuery(1, {}, actor)).data).toEqual([{ value: 'A' }]);
    expect((await service.executeCachedQuery(1, {}, actor)).cache.hit).toBe(true);
    query.mockResolvedValue({ status: 'SUCCESS', datas: [{ value: 'B' }], fields: [] });
    expect((await service.executeCachedQuery(2, {}, actor)).data).toEqual([{ value: 'B' }]);
    await db.manager.update(Database, 1, {
      connectionConfig: JSON.stringify({ fileVersions: ['v2'] }),
    });
    expect((await service.executeCachedQuery(1, {}, actor)).data).toEqual([{ value: 'B' }]);
    expect(query).toHaveBeenCalledTimes(3);
  });
  it('rejects an owner change during a populated cache read without SQL or streaming fallback', async () => {
    const actor = { actor: 7, epoch: 0 };
    await service.executeCachedQuery(1, {}, actor);
    const original = hybrid.get.bind(hybrid);
    jest.spyOn(hybrid, 'get').mockImplementationOnce(async (...args) => {
      const hit = await original(...args);
      await db.manager.update(Database, 1, { ownerId: 8, catalogVersion: 1 });
      return hit;
    });
    const fallback = jest.spyOn(service, 'executeStreamingQuery');
    await expect(
      service.executeCachedQuery(1, { useStreamingFallback: true }, actor),
    ).rejects.toMatchObject({ status: 403 });
    expect(query).toHaveBeenCalledTimes(1);
    expect(fallback).not.toHaveBeenCalled();
  });
  it('rejects a revoked JWT before cache lookup and does not cache stale computation', async () => {
    const actor = { actor: 7, epoch: 0 };
    await service.executeCachedQuery(1, {}, actor);
    const get = jest.spyOn(hybrid, 'get');
    await db.manager.update(User, 7, { authVersion: 1 });
    await expect(service.executeCachedQuery(1, {}, actor)).rejects.toMatchObject({ status: 401 });
    expect(get).not.toHaveBeenCalled();
    query.mockImplementationOnce(async () => {
      await db.manager.update(Database, 1, { catalogVersion: 1 });
      return { status: 'SUCCESS', datas: [{ value: 'stale' }], fields: [] };
    });
    const set = jest.spyOn(hybrid, 'set');
    await expect(
      service.executeCachedQuery(1, { forceRefresh: true }, { actor: 7, epoch: 1 }),
    ).rejects.toMatchObject({ status: 409 });
    expect(set).not.toHaveBeenCalled();
  });
  it.each(['hit', 'miss'] as const)(
    'rejects epoch revocation while cache get waits on a %s without SQL or fallback',
    async mode => {
      const actor = { actor: 7, epoch: 0 };
      if (mode === 'hit') await service.executeCachedQuery(1, {}, actor);
      query.mockClear();
      let entered: () => void;
      let release: () => void;
      const waiting = new Promise<void>(resolve => (entered = resolve));
      const resume = new Promise<void>(resolve => (release = resolve));
      const original = hybrid.get.bind(hybrid);
      jest.spyOn(hybrid, 'get').mockImplementationOnce(async (...args) => {
        const result = await original(...args);
        expect(!!result).toBe(mode === 'hit');
        entered();
        await resume;
        return result;
      });
      const fallback = jest.spyOn(service, 'executeStreamingQuery');
      const pending = service.executeCachedQuery(1, { useStreamingFallback: true }, actor);
      const rejected = expect(pending).rejects.toMatchObject({ status: 401 });
      await waiting;
      await db.manager.update(User, 7, { authVersion: 1 });
      release();
      await rejected;
      expect(query).not.toHaveBeenCalled();
      expect(fallback).not.toHaveBeenCalled();
    },
  );
  it('withholds the result when the epoch is revoked during cache set', async () => {
    const actor = { actor: 7, epoch: 0 };
    let entered: () => void;
    let release: () => void;
    const waiting = new Promise<void>(resolve => (entered = resolve));
    const resume = new Promise<void>(resolve => (release = resolve));
    const original = hybrid.set.bind(hybrid);
    jest.spyOn(hybrid, 'set').mockImplementationOnce(async (...args) => {
      await original(...args);
      entered();
      await resume;
    });
    const fallback = jest.spyOn(service, 'executeStreamingQuery');
    const pending = service.executeCachedQuery(1, { useStreamingFallback: true }, actor);
    const rejected = expect(pending).rejects.toMatchObject({ status: 401 });
    await waiting;
    await db.manager.update(User, 7, { authVersion: 1 });
    release();
    await rejected;
    expect(query).toHaveBeenCalledTimes(1);
    expect(fallback).not.toHaveBeenCalled();
    const get = jest.spyOn(hybrid, 'get');
    get.mockClear();
    await expect(service.executeCachedQuery(1, {}, actor)).rejects.toMatchObject({ status: 401 });
    expect(get).not.toHaveBeenCalled();
  });
});
