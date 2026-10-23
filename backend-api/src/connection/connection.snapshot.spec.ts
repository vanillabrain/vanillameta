import { ConnectionService } from './connection.service';

describe('ConnectionService DuckDB snapshots', () => {
  let current: Map<number, string>;
  let repository: { findOne: jest.Mock; manager: any };
  let worker: { query: jest.Mock };
  let service: ConnectionService;

  beforeEach(() => {
    current = new Map([
      [1, 'first.duckdb'],
      [2, 'second.duckdb'],
    ]);
    repository = {
      manager: { connection: { options: { type: 'mysql' } } },
      findOne: jest.fn(async ({ where: { id } }) => ({
        connectionConfig: JSON.stringify({
          client: 'duckdb',
          connection: { filename: current.get(id) },
        }),
      })),
    };
    worker = { query: jest.fn(async filename => ({ datas: [{ filename }] })) };
    service = new ConnectionService(repository as any, {} as any, worker as any);
  });

  it('answers a snapshot of a missing source like a source the caller may not use', async () => {
    repository.findOne.mockResolvedValueOnce(null);
    await expect(service.withDuckDBSnapshot(99, async () => 'never')).rejects.toMatchObject({
      status: 403,
    });
  });

  it('preserves the file and revision in nested snapshots of the same source', async () => {
    const initial = await service.duckDBVersion(1);
    const result = await service.withDuckDBSnapshot(1, async () => {
      current.set(1, 'replacement.duckdb');
      return service.withDuckDBSnapshot(1, async () => {
        expect(await service.duckDBVersion(1)).toBe(initial);
        expect(await service.isDuckDB(1)).toBe(true);
        return service.queryDuckDB(1, 'SELECT 1');
      });
    });
    expect(result.datas).toEqual([{ filename: 'first.duckdb' }]);
    expect(await service.duckDBVersion(1)).not.toBe(initial);
    expect((await service.queryDuckDB(1, 'SELECT 1')).datas).toEqual([
      { filename: 'replacement.duckdb' },
    ]);
  });

  it('keeps the outer source pinned while nesting another source', async () => {
    await service.withDuckDBSnapshot(1, async () => {
      current.set(1, 'replacement.duckdb');
      await service.withDuckDBSnapshot(2, async () => {
        current.set(2, 'second-replacement.duckdb');
        expect((await service.queryDuckDB(1, 'SELECT 1')).datas[0].filename).toBe('first.duckdb');
        expect((await service.queryDuckDB(2, 'SELECT 1')).datas[0].filename).toBe('second.duckdb');
      });
      expect((await service.queryDuckDB(2, 'SELECT 1')).datas[0].filename).toBe(
        'second-replacement.duckdb',
      );
    });
  });

  it('isolates overlapping operations across an atomic source switch', async () => {
    let release: () => void;
    let started: () => void;
    const barrier = new Promise<void>(resolve => (release = resolve));
    const ready = new Promise<void>(resolve => (started = resolve));
    const first = service.withDuckDBSnapshot(1, async () => {
      started();
      await barrier;
      return service.queryDuckDB(1, 'SELECT 1');
    });
    await ready;
    current.set(1, 'replacement.duckdb');
    try {
      const second = await service.withDuckDBSnapshot(1, () => service.queryDuckDB(1, 'SELECT 1'));
      expect(second.datas[0].filename).toBe('replacement.duckdb');
    } finally {
      release();
    }
    expect((await first).datas[0].filename).toBe('first.duckdb');
  });

  it('releases the snapshot after a callback rejects', async () => {
    await expect(
      service.withDuckDBSnapshot(1, async () => {
        current.set(1, 'replacement.duckdb');
        throw new Error('preview failed');
      }),
    ).rejects.toThrow('preview failed');
    expect((await service.queryDuckDB(1, 'SELECT 1')).datas[0].filename).toBe('replacement.duckdb');
  });
});
