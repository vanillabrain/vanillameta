import { User } from '../user/entities/user.entity';
jest.mock('../connection/connection.service', () => ({ ConnectionService: class {} }));
import { DataSource } from 'typeorm';
import { serializeMetadataWork } from '../common/metadata-work';
import { Database } from '../database/entities/database.entity';
import { DatabaseService } from '../database/database.service';
import { Metric, MetricAggregation } from '../metric/entities/metric.entity';
import { MetricService } from '../metric/metric.service';
import { ResponseStatus } from '../common/enum/response-status.enum';
const gate = () => {
  let resolve: () => void;
  const promise = new Promise<void>(done => {
    resolve = done;
  });
  return { promise, resolve: () => resolve() };
};
describe('NFR005/008 catalog metadata operations', () => {
  let db: DataSource;
  const original = process.env.CONFIG_SECRET_KEY;
  beforeEach(async () => {
    process.env.CONFIG_SECRET_KEY = 'catalog-boundary-synthetic';
    db = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      synchronize: true,
      entities: [Database, Metric, User],
    }).initialize();
    await db.manager.insert(User, {
      id: 1,
      userId: 'catalog-owner',
      email: 'catalog-owner@example.invalid',
      password: 'unused',
    });
  });
  afterEach(async () => {
    await db.destroy();
    if (original === undefined) delete process.env.CONFIG_SECRET_KEY;
    else process.env.CONFIG_SECRET_KEY = original;
  });
  it('commits source and metric saves independently after another metadata transaction rolls back', async () => {
    const entered = gate(),
      release = gate();
    const first = serializeMetadataWork(db, () =>
      db.transaction(async manager => {
        await manager.save(Database, {
          name: 'provisional',
          type: 'FILE',
          engine: 'duckdb',
          connectionConfig: '{}',
        });
        entered.resolve();
        await release.promise;
        throw new Error('expected rollback');
      }),
    ).catch(error => error);
    await entered.promise;
    const sources = new DatabaseService(
      db.getRepository(Database),
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    const metrics = new MetricService(db.getRepository(Metric), {} as any);
    let completed = 0;
    const results = Promise.all([
      sources.create(
        {
          name: 'Source',
          engine: 'duckdb',
          type: 'FILE',
          connectionConfig: { filename: 'synthetic.duckdb' },
        } as any,
        1,
      ),
      metrics.create(
        {
          name: 'Revenue',
          databaseId: 1,
          tableName: 'uploaded_data',
          expression: 'amount',
          aggregation: MetricAggregation.SUM,
        },
        1,
        0,
      ),
    ]).then(result => {
      completed++;
      return result;
    });
    let early: number;
    try {
      await Promise.race([results, new Promise(resolve => setTimeout(resolve, 150))]);
      early = completed;
    } finally {
      release.resolve();
      await first;
    }
    const saved = await results;
    expect(saved.map(value => value.status)).toEqual([
      ResponseStatus.SUCCESS,
      ResponseStatus.SUCCESS,
    ]);
    expect({
      early,
      sources: await db.getRepository(Database).count(),
      metrics: await db.getRepository(Metric).count(),
    }).toEqual({ early: 0, sources: 1, metrics: 1 });
  });
  it('does not expose a provisional metric definition through lookup or evaluation', async () => {
    const row = await db.getRepository(Metric).save({
      name: 'Revenue',
      databaseId: 1,
      tableName: 'uploaded_data',
      expression: 'amount',
      aggregation: MetricAggregation.SUM,
    });
    const entered = gate(),
      release = gate();
    const held = serializeMetadataWork(db, () =>
      db.transaction(async manager => {
        await manager.update(Metric, row.id, { expression: 'provisional_column' });
        entered.resolve();
        await release.promise;
        throw new Error('expected rollback');
      }),
    ).catch(error => error);
    await entered.promise;
    const query = jest.fn(async () => ({ datas: [{ value: 17 }] }));
    const service = new MetricService(db.getRepository(Metric), {
      isDuckDB: async () => true,
      queryDuckDB: query,
    } as any);
    const results = Promise.all([service.findOne(row.id), service.evaluate(row.id)]);
    let earlyQuery: number;
    try {
      await Promise.race([results, new Promise(resolve => setTimeout(resolve, 150))]);
      earlyQuery = query.mock.calls.length;
    } finally {
      release.resolve();
      await held;
    }
    const [lookup, evaluation] = await results;
    expect(earlyQuery).toBe(0);
    expect(lookup.data.expression).toBe('amount');
    expect(evaluation.data.metric.expression).toBe('amount');
    expect(query).toHaveBeenCalledWith(1, 'SELECT SUM(amount) AS value FROM uploaded_data', []);
  });
  it('reads a committed metric definition then releases the queue before analytical SQL', async () => {
    const row = await db.getRepository(Metric).save({
      name: 'Revenue',
      databaseId: 1,
      tableName: 'uploaded_data',
      expression: 'amount',
      aggregation: MetricAggregation.SUM,
    });
    const entered = gate(),
      release = gate();
    const service = new MetricService(db.getRepository(Metric), {
      isDuckDB: async () => true,
      queryDuckDB: async () => {
        entered.resolve();
        await release.promise;
        return { datas: [{ value: 17 }] };
      },
    } as any);
    const evaluation = service.evaluate(row.id);
    await entered.promise;
    let progressed = false;
    try {
      await Promise.race([
        serializeMetadataWork(db, async () => {
          progressed = true;
        }),
        new Promise(resolve => setTimeout(resolve, 150)),
      ]);
    } finally {
      release.resolve();
    }
    expect(progressed).toBe(true);
    expect((await evaluation).data.result).toEqual([{ value: 17 }]);
  });
});
