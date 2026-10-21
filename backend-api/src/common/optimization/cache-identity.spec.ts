import { QueryCacheService } from './query-cache.service';
import { RedisCacheService } from './redis-cache.service';
import { HybridCacheService } from './hybrid-cache.service';

const logger: any = { log: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
const optimization: any = { getCacheConfig: () => ({ enabled: true, ttl: 3600, maxSize: 100 }) };

describe('Lossless query cache identity', () => {
  let l1: QueryCacheService;
  beforeEach(() => {
    l1 = new QueryCacheService(optimization, logger);
  });
  afterEach(async () => {
    await l1.onModuleDestroy();
  });

  it.each([
    ["SELECT 'A'", "SELECT 'a'"],
    ["SELECT 'a  b'", "SELECT 'a b'"],
    ["SELECT '-- secret'", "SELECT '-- other'"],
    ["SELECT '/* x */'", "SELECT '/* y */'"],
    ['SELECT "Case"', 'SELECT "case"'],
  ])('does not collide SQL literals or identifiers: %s / %s', async (left, right) => {
    await l1.set('pg', left, [1], [], undefined, 'source-1');
    expect(await l1.get('pg', right, undefined, 'source-1')).toBeNull();
    const redis = new RedisCacheService(
      { get: (_key: string, fallback: any) => fallback } as any,
      logger,
      {} as any,
    );
    expect((redis as any).generateQueryHash('source-1', left)).not.toBe(
      (redis as any).generateQueryHash('source-1', right),
    );
  });

  it.each([
    [undefined, null],
    [NaN, null],
    [BigInt(1), '1'],
    [new Date(0), new Date(0).toISOString()],
    [-0, 0],
  ])('preserves parameter types: %s / %s', async (left, right) => {
    await l1.set('pg', 'SELECT ?', [1], [], [left]);
    expect(await l1.get('pg', 'SELECT ?', [right])).toBeNull();
  });

  it('isolates L1 hits by database and source revision', async () => {
    const l2: any = { isConnected: () => false, get: jest.fn().mockResolvedValue(null) };
    const hybrid = new HybridCacheService(l1, l2, logger);
    await hybrid.set('pg', 'source-1', 'SELECT 1', [1], [], [], {
      l1Only: true,
      revisionContext: 'revision-1',
    });
    expect(await hybrid.get('pg', 'source-1', 'SELECT 1', [], 'revision-1')).toEqual({
      data: [1],
      fields: [],
    });
    expect(await hybrid.get('pg', 'source-2', 'SELECT 1', [], 'revision-1')).toBeNull();
    expect(await hybrid.get('pg', 'source-1', 'SELECT 1', [], 'revision-2')).toBeNull();
  });

  it('retains the identical source context for L2 writes, reads and L1 promotion', async () => {
    const l2: any = {
      isConnected: () => true,
      set: jest.fn().mockResolvedValue(undefined),
      get: jest.fn().mockResolvedValue({ data: [2], fields: [] }),
    };
    const hybrid = new HybridCacheService(l1, l2, logger);
    await hybrid.set('pg', 'source-1', 'SELECT 1', [2], [], [], {
      l2Only: true,
      revisionContext: 'r2',
    });
    await hybrid.get('pg', 'source-1', 'SELECT 1', [], 'r2');
    const identity = JSON.stringify(['source-1', 'r2']);
    expect(l2.set.mock.calls[0][1]).toBe(identity);
    expect(l2.get).toHaveBeenCalledWith('pg', identity, 'SELECT 1', []);
    expect(await l1.get('pg', 'SELECT 1', [], identity)).toEqual({ data: [2], fields: [] });
    expect(await l1.get('pg', 'SELECT 1', [], JSON.stringify(['source-2', 'r2']))).toBeNull();
  });
});
