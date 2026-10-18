import { DataSource } from 'typeorm';
import { ConnectionService } from './connection.service';
import { Database } from '../database/entities/database.entity';
import { metadataTransaction } from '../common/metadata-work';
const gate = () => {
  let resolve: () => void;
  const promise = new Promise<void>(done => {
    resolve = done;
  });
  return { promise, resolve: () => resolve() };
};
const config = (filename: string) => JSON.stringify({ client: 'duckdb', connection: { filename } });
describe('UC052 committed snapshot capture without SQL metadata lease', () => {
  let db: DataSource, service: ConnectionService, duck: any;
  beforeEach(async () => {
    db = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      synchronize: true,
      entities: [Database],
    }).initialize();
    const sources = db.getRepository(Database);
    await sources.save({
      id: 3,
      ownerId: 7,
      name: 'Synthetic',
      engine: 'duckdb',
      type: 'FILE',
      connectionConfig: config('clean'),
    });
    duck = {
      query: jest.fn(async filename => ({
        datas: [{ column_name: filename + '_column', column_type: 'VARCHAR' }],
      })),
    };
    service = new ConnectionService(db.getRepository(Database), {} as any, duck);
  });
  afterEach(async () => db?.destroy());
  it('UC052 ordinary preview snapshots also wait for committed connection metadata', async () => {
    const entered = gate(),
      release = gate();
    const rollback = metadataTransaction(db, async manager => {
      await manager.update(Database, 3, { connectionConfig: config('rolled_back') });
      entered.resolve();
      await release.promise;
      throw new Error('expected rollback');
    }).catch(error => expect(error.message).toBe('expected rollback'));
    await entered.promise;
    let settled = false;
    const pending = service
      .withDuckDBSnapshot(3, () => service.queryDuckDB(3, 'DESCRIBE uploaded_data'))
      .then(result => {
        settled = true;
        return result;
      });
    await new Promise(resolve => setImmediate(resolve));
    try {
      expect(settled).toBe(false);
    } finally {
      release.resolve();
      await rollback;
    }
    expect((await pending).datas[0].column_name).toBe('clean_column');
  });
  it('waits for dirty connection rollback before capturing columns', async () => {
    const entered = gate(),
      release = gate();
    const rollback = metadataTransaction(db, async manager => {
      await manager.update(Database, 3, { connectionConfig: config('rolled_back') });
      entered.resolve();
      await release.promise;
      throw new Error('rollback fixture');
    }).catch(error => expect(error.message).toBe('rollback fixture'));
    await entered.promise;
    let settled = false;
    const pending = service.captureDuckDBSnapshot(3).then(value => {
      settled = true;
      return value;
    });
    await new Promise(resolve => setImmediate(resolve));
    expect(settled).toBe(false);
    release.resolve();
    await rollback;
    const captured = await pending;
    expect(
      (await captured.run(() => service.queryDuckDB(3, 'DESCRIBE uploaded_data'))).datas[0]
        .column_name,
    ).toBe('clean_column');
  });
  it('keeps its original file while fresh capture inside it sees the latest committed file', async () => {
    const original = await service.captureDuckDBSnapshot(3);
    await metadataTransaction(db, manager =>
      manager.update(Database, 3, { connectionConfig: config('new') }),
    );
    await original.run(async () => {
      expect((await service.queryDuckDB(3, 'DESCRIBE uploaded_data')).datas[0].column_name).toBe(
        'clean_column',
      );
      const latest = await service.captureDuckDBSnapshot(3);
      expect(
        (await latest.run(() => service.queryDuckDB(3, 'DESCRIBE uploaded_data'))).datas[0]
          .column_name,
      ).toBe('new_column');
      expect((await service.queryDuckDB(3, 'DESCRIBE uploaded_data')).datas[0].column_name).toBe(
        'clean_column',
      );
    });
  });
  it('does not hold the metadata lease while a captured SQL callback waits', async () => {
    const captured = await service.captureDuckDBSnapshot(3),
      entered = gate(),
      release = gate();
    const pending = captured.run(async () => {
      entered.resolve();
      await release.promise;
      return 'done';
    });
    await entered.promise;
    await metadataTransaction(db, manager =>
      manager.update(Database, 3, { name: 'Committed while SQL pending' }),
    );
    expect((await db.getRepository(Database).findOneByOrFail({ id: 3 })).name).toBe(
      'Committed while SQL pending',
    );
    release.resolve();
    expect(await pending).toBe('done');
  });
});
