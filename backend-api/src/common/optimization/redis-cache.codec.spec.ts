import { createHash } from 'crypto';
import { RedisCacheService } from './redis-cache.service';
import { CompressionService, CompressionType } from './compression.service';

function incompressibleText(): string {
  const bytes = Buffer.concat(
    Array.from({ length: 110 }, (_, i) =>
      createHash('sha256').update(`synthetic-codec-${i}`).digest(),
    ),
  );
  return Array.from({ length: 850 }, (_, i) => {
    const offset = i * 4;
    const choice = bytes[offset] % 100;
    const value = bytes.readUInt16BE(offset + 1);
    return String.fromCharCode(
      choice < 60
        ? 33 + (value % 94)
        : choice < 90
        ? 0x80 + (value % 0x700)
        : 0x800 + (value % 0xc000),
    );
  }).join('');
}
const fixtures = [
  { name: 'small', value: 'A', type: CompressionType.NONE },
  { name: 'incompressible', value: incompressibleText(), type: CompressionType.NONE },
  { name: 'gzip', value: 'synthetic record '.repeat(200), type: CompressionType.GZIP },
  { name: 'brotli', value: 'synthetic record '.repeat(2000), type: CompressionType.BROTLI },
];
const payload = (literal: string) => ({
  data: [{ literal, total: 600 }],
  fields: [{ name: 'literal' }, { name: 'total' }],
});

describe('RedisCacheService with the real CompressionService codec', () => {
  let service: RedisCacheService;
  let compression: CompressionService;
  let store: Map<string, string>;
  let redis: any;
  let hit: jest.SpyInstance;
  let miss: jest.SpyInstance;
  beforeEach(() => {
    compression = new CompressionService();
    jest.spyOn((compression as any).logger, 'debug').mockImplementation(() => undefined);
    jest.spyOn((compression as any).logger, 'error').mockImplementation(() => undefined);
    service = new RedisCacheService(
      { get: (_key: string, fallback: any) => fallback } as any,
      { debug: jest.fn(), warn: jest.fn() } as any,
      compression,
    );
    store = new Map();
    redis = {
      get: jest.fn(async key => store.get(key) ?? null),
      setex: jest.fn(async (key, _ttl, value) => {
        store.set(key, value);
      }),
      del: jest.fn(async key => store.delete(key)),
    };
    Object.assign(service as any, { redis, connected: true });
    jest.spyOn(service as any, 'updateStatsOnSet').mockResolvedValue(undefined);
    hit = jest.spyOn(service as any, 'updateStatsOnHit').mockResolvedValue(undefined);
    miss = jest.spyOn(service as any, 'updateStatsOnMiss').mockResolvedValue(undefined);
    jest.spyOn((service as any).logger, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());
  async function put(value: ReturnType<typeof payload>) {
    await service.set('duckdb', 'owned-source-revision', 'SELECT ?', value.data, value.fields, [
      'A',
    ]);
    expect(store.size).toBe(1);
    const key = [...store.keys()][0];
    return { key, entry: JSON.parse(store.get(key)!) };
  }
  const get = () => service.get('duckdb', 'owned-source-revision', 'SELECT ?', ['A']);

  it.each(fixtures)(
    'roundtrips $name rows and fields without leaking a codec envelope',
    async fixture => {
      const value = payload(fixture.value);
      const encoded = JSON.parse(await compression.compress(value));
      expect(encoded.type).toBe(fixture.type);
      if (fixture.name === 'incompressible') expect(encoded.originalSize).toBeGreaterThan(1024);
      const { entry } = await put(value);
      expect(entry.compressed).toBe(fixture.type !== CompressionType.NONE);
      if (fixture.type === CompressionType.NONE) expect(JSON.parse(entry.data)).toEqual(value);
      expect(await get()).toEqual(value);
      expect(hit).toHaveBeenCalledTimes(1);
      expect(miss).not.toHaveBeenCalled();
    },
  );

  describe.each([false, true])('legacy compressed flag=%s', flag => {
    it('reads legacy raw JSON without changing row or field values', async () => {
      const value = payload('legacy raw');
      const { key, entry } = await put(value);
      store.set(key, JSON.stringify({ ...entry, data: JSON.stringify(value), compressed: flag }));
      expect(await get()).toEqual(value);
    });
    it.each(fixtures)(
      'reads the actual $name envelope regardless of historical ratio flag',
      async fixture => {
        const value = payload(fixture.value);
        const { key, entry } = await put(value);
        store.set(
          key,
          JSON.stringify({ ...entry, data: await compression.compress(value), compressed: flag }),
        );
        expect(await get()).toEqual(value);
      },
    );
  });

  it.each([
    'invalid-json',
    JSON.stringify({
      type: CompressionType.GZIP,
      data: 'not-gzip',
      originalSize: 50,
      compressedSize: 8,
    }),
    JSON.stringify({
      type: CompressionType.GZIP,
      data: Buffer.from('bad-gzip').toString('base64'),
      originalSize: 50,
      compressedSize: 8,
    }),
    JSON.stringify({ type: 99, data: 'e30=', originalSize: 2, compressedSize: 2 }),
    JSON.stringify({
      type: CompressionType.NONE,
      data: Buffer.from('{"data":"wrong-shape"}').toString('base64'),
      originalSize: 22,
      compressedSize: 22,
    }),
    JSON.stringify({ data: 'missing fields' }),
  ])('treats malformed payload %s as a miss, never a successful corrupted hit', async data => {
    const { key, entry } = await put(payload('good'));
    store.set(key, JSON.stringify({ ...entry, data, compressed: true }));
    expect(await get()).toBeNull();
    expect(hit).not.toHaveBeenCalled();
    expect(miss).toHaveBeenCalledTimes(1);
    expect(JSON.parse(store.get(key)!).hits).toBe(0);
  });

  it('rejects an envelope with a wrong declared decoded size', async () => {
    const value = payload('invalid size');
    const { key, entry } = await put(value);
    const envelope = JSON.parse(await compression.compress(value));
    envelope.originalSize += 1;
    store.set(key, JSON.stringify({ ...entry, data: JSON.stringify(envelope), compressed: false }));
    expect(await get()).toBeNull();
    expect(hit).not.toHaveBeenCalled();
  });

  it('preserves raw fallback when compression itself fails', async () => {
    jest.spyOn(compression, 'compress').mockRejectedValue(new Error('codec unavailable'));
    const value = payload('fallback');
    const { entry } = await put(value);
    expect(entry.compressed).toBe(false);
    expect(JSON.parse(entry.data)).toEqual(value);
    expect(await get()).toEqual(value);
  });
});
