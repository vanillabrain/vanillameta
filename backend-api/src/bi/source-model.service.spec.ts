jest.mock('../utils/crypto.util', () => ({
  encryptConnectionConfig: (v: string) => v,
  decryptConnectionConfig: (v: string) => v,
}));
jest.mock('../connection/connection.service', () => ({ ConnectionService: class {} }));
jest.mock('../ai/ai-dashboard.service', () => ({ AiDashboardService: class {} }));
import { DataSource } from 'typeorm';
import { createHash, randomUUID } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { DuckDBService } from '../analysis/duckdb.service';
import { DatabaseService } from '../database/database.service';
import { Database } from '../database/entities/database.entity';
import { User } from '../user/entities/user.entity';
import { Metric } from '../metric/entities/metric.entity';
import { SourceAccessService } from '../ownership/source-access.service';
import { BiService } from './bi.service';
import { SourceModelReceipt } from './source-model-receipt.entity';
import { SourceModelService } from './source-model.service';

describe('owned source lookup preview and atomic snapshot receipts', () => {
  let db: DataSource,
    worker: DuckDBService,
    files: DatabaseService,
    bi: BiService,
    service: SourceModelService,
    root: string,
    spec: any,
    factId: number;
  const previousRoot = process.env.FILE_UPLOAD_DIR;
  const config = async (id: number) =>
    JSON.parse((await db.manager.findOneByOrFail(Database, { id })).connectionConfig);
  const make = () => new SourceModelService(db, bi, new SourceAccessService(db), worker);
  const upload = async (name: string, body: string) =>
    (await files.uploadFile({ originalname: name, buffer: Buffer.from(body) }, 1, 3)).data.id;
  const counts = async () => ({
    sources: await db.manager.count(Database),
    receipts: await db.manager.count(SourceModelReceipt),
  });
  const input = (preview: any) => ({
    spec: preview.spec,
    previewDigest: preview.previewDigest,
    requestId: randomUUID(),
    name: '지출과 제공자',
    keepUnmatched: true,
  });
  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'source-model-'));
    process.env.FILE_UPLOAD_DIR = root;
    db = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      entities: [Database, User, Metric, SourceModelReceipt],
      synchronize: true,
    }).initialize();
    await db.manager.save(User, {
      id: 1,
      authVersion: 3,
      active: true,
      userId: 'model-test',
      password: 'not-used',
      email: 'model@example.invalid',
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
    const connection: any = {
      withDuckDBSnapshot: async (_id: number, run: () => Promise<any>) => run(),
      queryDuckDB: async (id: number, sql: string, bindings: any[]) =>
        worker.query((await config(id)).connection.filename, sql, bindings),
      duckDBVersion: async (id: number) =>
        createHash('sha256')
          .update((await config(id)).connection.filename)
          .digest('hex'),
    };
    bi = new BiService(db, new SourceAccessService(db), connection, {} as any);
    service = make();
    factId = await upload(
      'fact.csv',
      'provider_id,amount,beneficiaries\nP1,100.00,10\nP1,120.00,12\nP2,80.00,8\nP9,50.00,5\n',
    );
    const lookupId = await upload(
      'lookup.csv',
      'provider_id,name\nP1,Seoul\nP2,Busan\nP3,Unused\n',
    );
    spec = {
      factSourceId: factId,
      lookupSourceId: lookupId,
      factRevision: (await bi.profile(factId, 1)).dataVersion,
      lookupRevision: (await bi.profile(lookupId, 1)).dataVersion,
      definition: {
        factKey: 'provider_id',
        lookupKey: 'provider_id',
        attributes: [{ column: 'name', alias: 'provider_name' }],
        nonAdditiveColumns: ['beneficiaries'],
      },
    };
  });
  afterEach(async () => {
    await worker?.onModuleDestroy();
    await db?.destroy();
    await fs.rm(root, { recursive: true, force: true });
    if (previousRoot === undefined) delete process.env.FILE_UPLOAD_DIR;
    else process.env.FILE_UPLOAD_DIR = previousRoot;
    jest.restoreAllMocks();
  });
  it('previews quality read-only and removes its disposable candidate', async () => {
    const directories = (await fs.readdir(root)).sort(),
      before = await counts();
    const p = await service.preview(spec, 1);
    expect(p.quality).toMatchObject({
      factRows: 4,
      unmatchedFactRows: 1,
      unusedLookupRows: 1,
      outputRows: 4,
      ready: true,
    });
    expect(p.preview).toHaveLength(4);
    expect(p.previewDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(await counts()).toEqual(before);
    expect((await fs.readdir(root)).sort()).toEqual(directories);
    expect(JSON.stringify(p)).not.toContain(root);
  });
  it('requires explicit unmatched consent and then saves one private immutable snapshot with exact totals', async () => {
    const p = await service.preview(spec, 1),
      body = input(p);
    await expect(service.save({ ...body, keepUnmatched: false }, 1)).rejects.toThrow('명시적으로');
    expect(await counts()).toEqual({ sources: 2, receipts: 0 });
    const saved = await service.save(body, 1);
    const stored = await config(saved.id);
    expect((await db.manager.findOneByOrFail(Database, { id: saved.id })).ownerId).toBe(1);
    expect(
      (
        await worker.query(
          stored.connection.filename,
          'SELECT COUNT(*) AS n,SUM(amount)::DECIMAL(18,2) AS amount FROM uploaded_data',
        )
      ).datas,
    ).toEqual([{ n: 4, amount: '350.00' }]);
    expect(stored.fileModel.nonAdditiveColumns).toEqual(['beneficiaries']);
    expect(
      (await bi.profile(saved.id, 1)).columns.find(c => c.name === 'beneficiaries'),
    ).toMatchObject({ nonAdditive: true });
    expect((await files.fileVersions(saved.id, 1)).data).toMatchObject({
      supportsRefresh: false,
      supportsCorrection: false,
    });
    await expect(
      files.replaceFile(
        saved.id,
        { originalname: 'bad.csv', buffer: Buffer.from('n\n1\n') },
        (
          await files.fileVersions(saved.id, 1)
        ).data.revision,
        1,
      ),
    ).rejects.toThrow('고정 스냅샷');
    expect(await counts()).toEqual({ sources: 3, receipts: 1 });
  });
  it('replays after a service restart without rematerializing and rejects changed request payload', async () => {
    const body = input(await service.preview(spec, 1)),
      first = await service.save(body, 1);
    service = make();
    const spy = jest.spyOn(worker, 'lookupFiles');
    expect(await service.save(body, 1)).toEqual({ ...first, replayed: true });
    expect(spy).not.toHaveBeenCalled();
    await expect(service.save({ ...body, name: '다른 이름' }, 1)).rejects.toThrow('내용이 달라');
    expect(await counts()).toEqual({ sources: 3, receipts: 1 });
  });
  it('does not join duplicate dictionaries or create metadata when asked to save them', async () => {
    const id = await upload('duplicate.csv', 'provider_id,name\nP1,Seoul\nP1,Other\n');
    const next = {
      ...spec,
      lookupSourceId: id,
      lookupRevision: (await bi.profile(id, 1)).dataVersion,
    };
    const p = await service.preview(next, 1);
    expect(p.quality.ready).toBe(false);
    expect(p.quality.duplicateLookupKeys).toBe(1);
    expect(p.preview).toEqual([]);
    await expect(service.save(input(p), 1)).rejects.toThrow('중복');
    expect(await counts()).toEqual({ sources: 3, receipts: 0 });
  });
  it('authorizes both inputs before worker work and blocks stale previews', async () => {
    const spy = jest.spyOn(worker, 'lookupFiles');
    await expect(service.preview(spec, 2)).rejects.toThrow();
    expect(spy).not.toHaveBeenCalled();
    const p = await service.preview(spec, 1);
    const next = await upload('new.csv', 'provider_id,amount,beneficiaries\nP1,999.00,99\n');
    const source = await db.manager.findOneByOrFail(Database, { id: factId });
    source.connectionConfig = (
      await db.manager.findOneByOrFail(Database, { id: next })
    ).connectionConfig;
    await db.manager.save(source);
    spy.mockClear();
    await expect(service.save(input(p), 1)).rejects.toThrow('바뀌었습니다');
    expect(spy).not.toHaveBeenCalled();
    expect(await db.manager.count(SourceModelReceipt)).toBe(0);
  });
  it('rolls back metadata if input ownership changes during materialization and cleans only its candidate', async () => {
    const p = await service.preview(spec, 1),
      lookup = worker.lookupFiles.bind(worker);
    const before = (await fs.readdir(root)).sort();
    jest.spyOn(worker, 'lookupFiles').mockImplementationOnce(async (...args) => {
      const out = await lookup(...args);
      await db.manager.update(Database, factId, { ownerId: 2 });
      return out;
    });
    await expect(service.save(input(p), 1)).rejects.toThrow('사용할 수 없습니다');
    expect(await counts()).toEqual({ sources: 2, receipts: 0 });
    expect((await fs.readdir(root)).sort()).toEqual(before);
  });
  it('serializes identical local saves into one source and cleans the losing candidate', async () => {
    const body = input(await service.preview(spec, 1));
    const [a, b] = await Promise.all([service.save(body, 1), service.save(body, 1)]);
    expect(a.id).toBe(b.id);
    expect(await counts()).toEqual({ sources: 3, receipts: 1 });
    expect((await fs.readdir(root)).filter(x => x !== 'incoming')).toHaveLength(3);
  });
  it('keeps a committed candidate when its transaction response is lost and replays without a new source', async () => {
    const body = input(await service.preview(spec, 1));
    const transaction = db.transaction.bind(db);
    jest.spyOn(db, 'transaction').mockImplementationOnce(async (...args: any[]) => {
      await (transaction as any)(...args);
      throw new Error('commit reply lost');
    });
    await expect(service.save(body, 1)).rejects.toThrow('commit reply lost');
    expect(await counts()).toEqual({ sources: 3, receipts: 1 });
    const saved = await service.save(body, 1);
    await expect(fs.stat((await config(saved.id)).connection.filename)).resolves.toBeDefined();
    expect(saved.replayed).toBe(true);
  });
  it('keeps inherited nonadditive flags when a model is reused as a fact source', async () => {
    const first = await service.save(input(await service.preview(spec, 1)), 1);
    const model = await bi.profile(first.id, 1);
    const second = await service.preview(
      {
        ...spec,
        factSourceId: first.id,
        factRevision: model.dataVersion,
        definition: {
          ...spec.definition,
          attributes: [{ column: 'name', alias: 'second_name' }],
          nonAdditiveColumns: [],
        },
      },
      1,
    );
    expect(second.spec.definition.nonAdditiveColumns).toEqual(['beneficiaries']);
  });
  it('blocks reaggregation of distinct counts, including denominator/weight, but counts real provider keys', async () => {
    const model = await service.save(input(await service.preview(spec, 1)), 1);
    const base = {
      sourceId: model.id,
      label: '고유 인원',
      unit: '건',
      decimalPlaces: 0,
      numberNotation: 'plain',
    };
    for (const aggregation of ['SUM', 'AVG', 'MIN', 'MAX', 'COUNT_DISTINCT'])
      await expect(
        bi.createMetric({ ...base, aggregation, column: 'beneficiaries' }, 1),
      ).rejects.toThrow('집계된 고유값');
    await expect(
      bi.createMetric(
        {
          ...base,
          aggregation: 'RATIO_SUM',
          column: 'amount',
          denominatorColumn: 'beneficiaries',
          scale: 1,
        },
        1,
      ),
    ).rejects.toThrow('분모');
    await expect(
      bi.createMetric(
        { ...base, aggregation: 'WEIGHTED_AVG', column: 'amount', weightColumn: 'beneficiaries' },
        1,
      ),
    ).rejects.toThrow('분모');
    expect(await db.manager.count(Metric)).toBe(0);
    expect(
      await bi.createMetric(
        { ...base, label: '제공자 코드 수', aggregation: 'COUNT_DISTINCT', column: 'provider_id' },
        1,
      ),
    ).toMatchObject({ definition: { column: 'provider_id', aggregation: 'COUNT_DISTINCT' } });
  });
  it('pins numeric parent attributes as nonadditive even after another model composes them as VARCHAR', async () => {
    const lookupId = await upload('numeric-lookup.csv', 'provider_id,parent_count\nP1,10\nP2,20\n');
    const next = {
      ...spec,
      lookupSourceId: lookupId,
      lookupRevision: (await bi.profile(lookupId, 1)).dataVersion,
      definition: {
        ...spec.definition,
        attributes: [{ column: 'parent_count', alias: 'lookup_count' }],
      },
    };
    const p = await service.preview(next, 1);
    expect(p.nonAdditiveColumns).toContain('lookup_count');
    const model = await service.save(input(p), 1);
    const profile = await bi.profile(model.id, 1);
    expect(profile.columns.find(c => c.name === 'lookup_count')).toMatchObject({
      type: 'VARCHAR',
      nonAdditive: true,
    });
    const composed = await service.preview(
      {
        ...spec,
        factSourceId: model.id,
        factRevision: profile.dataVersion,
        definition: {
          ...spec.definition,
          attributes: [{ column: 'name', alias: 'second_label' }],
          nonAdditiveColumns: [],
        },
      },
      1,
    );
    expect(composed.spec.definition.nonAdditiveColumns).toContain('lookup_count');
    expect(composed.nonAdditiveColumns).toContain('lookup_count');
  });
  it('reconciles a committed duplicate receipt and retries a bounded deadlock without another source', async () => {
    const body = input(await service.preview(spec, 1)),
      transaction = db.transaction.bind(db);
    const spy = jest.spyOn(db, 'transaction').mockImplementationOnce(async (...args: any[]) => {
      await (transaction as any)(...args);
      throw Object.assign(new Error('duplicate request'), { code: 'ER_DUP_ENTRY' });
    });
    const saved = await service.save(body, 1);
    expect(saved.replayed).toBe(true);
    expect(await counts()).toEqual({ sources: 3, receipts: 1 });
    spy.mockRestore();
    const next = { ...body, requestId: randomUUID(), name: '다른 복사본' };
    jest
      .spyOn(db, 'transaction')
      .mockRejectedValueOnce(
        Object.assign(new Error('deadlock'), { driverError: { code: 'ER_LOCK_DEADLOCK' } }),
      );
    expect(await service.save(next, 1)).toMatchObject({ replayed: false });
    expect(await counts()).toEqual({ sources: 4, receipts: 2 });
  });
  it('does not disclose filesystem paths from preview or save failures', async () => {
    const p = await service.preview(spec, 1);
    jest
      .spyOn(worker, 'lookupFiles')
      .mockRejectedValue(
        Object.assign(new Error('EACCES /private/internal/file.duckdb'), { code: 'EACCES' }),
      );
    for (const run of [() => service.preview(spec, 1), () => service.save(input(p), 1)]) {
      try {
        await run();
        throw new Error('must fail');
      } catch (error) {
        expect(error.message).not.toContain('/private');
        expect(error.getStatus()).toBe(503);
      }
    }
    expect(await counts()).toEqual({ sources: 2, receipts: 0 });
  });
  it('propagates nine protected columns through model composition without weakening the flags', async () => {
    const names = Array.from({ length: 8 }, (_, i) => 'count_' + i);
    const lookupId = await upload(
      'counts.csv',
      'provider_id,' +
        names.join(',') +
        '\nP1,' +
        names.map(() => 10).join(',') +
        '\nP2,' +
        names.map(() => 20).join(',') +
        '\n',
    );
    const p = await service.preview(
      {
        ...spec,
        lookupSourceId: lookupId,
        lookupRevision: (await bi.profile(lookupId, 1)).dataVersion,
        definition: {
          ...spec.definition,
          attributes: names.map(column => ({ column, alias: 'lookup_' + column })),
        },
      },
      1,
    );
    expect(p.nonAdditiveColumns).toHaveLength(9);
    const model = await service.save(input(p), 1);
    const profile = await bi.profile(model.id, 1);
    const next = await service.preview(
      {
        ...spec,
        factSourceId: model.id,
        factRevision: profile.dataVersion,
        definition: {
          ...spec.definition,
          attributes: [{ column: 'name', alias: 'label_again' }],
          nonAdditiveColumns: [],
        },
      },
      1,
    );
    expect(next.quality.ready).toBe(true);
    expect(next.nonAdditiveColumns).toHaveLength(9);
    expect(next.spec.definition.nonAdditiveColumns).toHaveLength(9);
  });
});
