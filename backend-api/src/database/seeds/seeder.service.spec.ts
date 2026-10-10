import * as os from 'os';
import * as path from 'path';
import { SeederService } from './seeder.service';
import { Database } from '../entities/database.entity';
import { DatabaseType } from '../entities/database_type.entity';
import { decryptConnectionConfig } from '../../utils/crypto.util';

describe('SeederService', () => {
  const sqlitePath = path.join(os.tmpdir(), 'vanillameta-seeder-spec', 'seeded.db');
  const OLD_CONFIG_SECRET = process.env.CONFIG_SECRET_KEY;

  const makeConfigService = (nodeEnv?: string) =>
    ({ get: jest.fn((key: string) => (key === 'NODE_ENV' ? nodeEnv : undefined)) }) as any;

  const makeDataSource = (userCount: number, database = sqlitePath) => {
    const chains: any[] = [];
    const dataSource: any = {
      options: { database },
      getRepository: jest.fn(() => ({ count: jest.fn(async () => userCount) })),
      createQueryBuilder: jest.fn(() => {
        const rec: any = {
          methods: [] as string[],
          intoArg: undefined as any,
          valuesArg: undefined as any,
        };
        const chain: any = {
          insert: jest.fn(() => {
            rec.methods.push('insert');
            return chain;
          }),
          into: jest.fn((target: any) => {
            rec.methods.push('into');
            rec.intoArg = target;
            return chain;
          }),
          values: jest.fn((v: any) => {
            rec.methods.push('values');
            rec.valuesArg = v;
            return chain;
          }),
          orIgnore: jest.fn(() => {
            rec.methods.push('orIgnore');
            return chain;
          }),
          execute: jest.fn(async () => {
            rec.methods.push('execute');
            return { identifiers: [] };
          }),
        };
        chains.push(rec);
        return chain;
      }),
      query: jest.fn(async () => undefined),
    };
    return { dataSource, chains };
  };

  const makeService = (nodeEnv: string | undefined, userCount: number, database = sqlitePath) => {
    const { dataSource, chains } = makeDataSource(userCount, database);
    const service = new SeederService(dataSource, makeConfigService(nodeEnv));
    (service as any).logger = { log: jest.fn(), error: jest.fn(), warn: jest.fn() };
    return { service, dataSource, chains, logger: (service as any).logger };
  };

  beforeEach(() => {
    process.env.CONFIG_SECRET_KEY = 'seeder-spec-disposable-secret';
  });

  afterEach(() => {
    if (OLD_CONFIG_SECRET === undefined) {
      delete process.env.CONFIG_SECRET_KEY;
    } else {
      process.env.CONFIG_SECRET_KEY = OLD_CONFIG_SECRET;
    }
  });

  it('runs the seed on local env when the user table is empty', async () => {
    const { service, chains } = makeService('local', 0);
    await expect(service.onApplicationBootstrap()).resolves.toBeUndefined();
    expect(chains.length).toBeGreaterThan(0);
    expect(chains.every(c => c.methods.includes('execute'))).toBe(true);
  });

  it('skips inserts on local env when data already exists', async () => {
    const { service, chains } = makeService('local', 3);
    await service.onApplicationBootstrap();
    expect(chains.length).toBe(0);
  });

  it.each(['dev', 'prod'])('does not count or insert on %s env', async env => {
    const { service, dataSource, chains } = makeService(env, 0);
    await service.onApplicationBootstrap();
    expect(dataSource.getRepository).not.toHaveBeenCalled();
    expect(chains.length).toBe(0);
  });

  it('catches and logs a seed failure and still resolves bootstrap', async () => {
    const { service, dataSource, logger } = makeService('local', 0);
    dataSource.getRepository.mockImplementation(() => {
      throw new Error('boom');
    });
    await expect(service.onApplicationBootstrap()).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalled();
  });

  it('stores the sample sqlite connection config encrypted with the configured database path', async () => {
    const { service, chains } = makeService('local', 0);
    await service.onApplicationBootstrap();
    const dbChain = chains.find(c => c.intoArg === Database);
    expect(dbChain).toBeDefined();
    const stored = dbChain.valuesArg[0].connectionConfig;
    expect(stored.startsWith('enc:v1:')).toBe(true);
    const cfg = JSON.parse(decryptConnectionConfig(stored));
    expect(cfg.client).toBe('sqlite3');
    expect(cfg.connection.filename).toBe(sqlitePath);
  });

  it('resolves a relative configured database path to an absolute filename', async () => {
    const { service, chains } = makeService('local', 0, 'relative-test.db');
    await service.onApplicationBootstrap();
    const dbChain = chains.find(c => c.intoArg === Database);
    expect(dbChain).toBeDefined();
    const cfg = JSON.parse(decryptConnectionConfig(dbChain.valuesArg[0].connectionConfig));
    expect(cfg.connection.filename).toBe(path.resolve('relative-test.db'));
  });

  it('seeds canonical database types including clickhouse, trino and databricks', async () => {
    const { service, chains } = makeService('local', 0);
    await service.onApplicationBootstrap();
    const typeValues = chains.filter(c => c.intoArg === DatabaseType).flatMap(c => c.valuesArg);
    expect(typeValues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'clickhouse' }),
        expect.objectContaining({ type: 'trino' }),
        expect.objectContaining({ type: 'databricks' }),
      ]),
    );
  });

  it('makes every seed insert idempotent via orIgnore', async () => {
    const { service, chains } = makeService('local', 0);
    await service.onApplicationBootstrap();
    expect(chains.length).toBeGreaterThan(0);
    for (const c of chains) {
      expect(c.methods).toContain('orIgnore');
    }
  });
});
