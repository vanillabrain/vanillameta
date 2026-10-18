import { DataSource } from 'typeorm';
import { metadataTransaction } from '../common/metadata-work';
import { Database } from '../database/entities/database.entity';
import { Metric, MetricAggregation } from './entities/metric.entity';
import {
  lockMetricReferences,
  lockMetricReferenceSets,
  lockMetricSources,
  lockMetricWrite,
} from './metric-write-lock';

describe('Metric write fences', () => {
  it.each(['mysql', 'mariadb', 'sqlite'])(
    '%s locks all sources before globally sorted metrics',
    async type => {
      const order: string[] = [];
      const manager: any = {
        queryRunner: { isTransactionActive: true },
        connection: { options: { type } },
        findOne: jest.fn(async (entity, options) => {
          expect(options.lock).toEqual(
            type === 'sqlite' ? undefined : { mode: 'pessimistic_write' },
          );
          const id = options.where.id;
          order.push(`${entity === Database ? 'source' : 'metric'}:${id}`);
          return { id, databaseId: id === 8 ? 2 : 1, useYn: 'Y' };
        }),
      };
      const rows = await lockMetricReferenceSets(manager, [
        { sourceId: 2, ids: [8] },
        { sourceId: 1, ids: [9, 3, 9] },
      ]);
      expect(order).toEqual(['source:1', 'source:2', 'metric:3', 'metric:8', 'metric:9']);
      expect([...rows.keys()]).toEqual([3, 8, 9]);
    },
  );
  it('requires explicit transactions even for an empty reference set', async () => {
    const manager: any = { queryRunner: { isTransactionActive: false } };
    await expect(lockMetricWrite(manager, 1)).rejects.toThrow('active transaction');
    await expect(lockMetricSources(manager, [])).rejects.toThrow('active transaction');
    await expect(lockMetricReferenceSets(manager, [])).rejects.toThrow('active transaction');
  });
  let db: DataSource;
  beforeEach(async () => {
    db = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      synchronize: true,
      entities: [Database, Metric],
    }).initialize();
    await db.manager.insert(Database, {
      id: 1,
      name: 'Synthetic',
      ownerId: 7,
      engine: 'duckdb',
      type: 'FILE',
      connectionConfig: '{}',
    });
    await db.manager.insert(Metric, {
      id: 1,
      name: 'Synthetic metric',
      databaseId: 1,
      tableName: 'uploaded_data',
      aggregation: MetricAggregation.SUM,
      expression: 'amount',
      useYn: 'Y',
    });
  });
  afterEach(async () => {
    await db.destroy();
  });
  it('returns current rows and rejects missing sources, invalid IDs and wrong-source references', async () => {
    const rows = await metadataTransaction(db, manager => lockMetricReferences(manager, 1, [1, 1]));
    expect(rows.get(1)).toMatchObject({ databaseId: 1, useYn: 'Y' });
    for (const id of [0, -1, 1.5, 999])
      await expect(
        metadataTransaction(db, manager => lockMetricReferences(manager, 1, [id])),
      ).rejects.toThrow();
    await expect(
      metadataTransaction(db, manager => lockMetricReferences(manager, 999, [])),
    ).rejects.toThrow('Source unavailable');
    await db.manager.update(Metric, 1, { databaseId: 2 });
    await expect(
      metadataTransaction(db, manager => lockMetricReferences(manager, 1, [1])),
    ).rejects.toThrow('source changed');
  });
  it('deletion first blocks a later reference; only reactivation may lock inactive rows', async () => {
    await metadataTransaction(db, async manager => {
      await lockMetricSources(manager, [1]);
      await lockMetricWrite(manager, 1);
      await manager.update(Metric, 1, { useYn: 'N' });
    });
    await expect(
      metadataTransaction(db, manager => lockMetricReferences(manager, 1, [1])),
    ).rejects.toThrow('Metric unavailable');
    await metadataTransaction(db, async manager => {
      await lockMetricSources(manager, [1]);
      expect(await lockMetricWrite(manager, 1, { allowInactive: true })).toMatchObject({
        useYn: 'N',
      });
      await manager.update(Metric, 1, { useYn: 'Y' });
    });
    expect(
      (await metadataTransaction(db, manager => lockMetricReferences(manager, 1, [1]))).size,
    ).toBe(1);
  });
});
