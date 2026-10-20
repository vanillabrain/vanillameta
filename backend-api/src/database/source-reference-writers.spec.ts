jest.mock('../connection/connection.service', () => ({ ConnectionService: class {} }));
import { DataSource } from 'typeorm';
import { Database } from './entities/database.entity';
import { Dataset } from '../dataset/entities/dataset.entity';
import { Widget } from '../widget/entities/widget.entity';
import { TableQuery } from '../widget/tabel-query/entity/table-query.entity';
import { User } from '../user/entities/user.entity';
import { DatabaseService } from './database.service';
import { DatasetService } from '../dataset/dataset.service';
import { WidgetService } from '../widget/widget.service';
import { TableQueryService } from '../widget/tabel-query/table-query.service';
import { encryptConnectionConfig } from '../utils/crypto.util';
import { SampleService } from '../sample/sample.service';

describe('UC055 Source reference write boundaries (actual SQLite)', () => {
  let db: DataSource,
    database: DatabaseService,
    datasets: DatasetService,
    tables: TableQueryService,
    widgets: WidgetService;
  let execute: jest.Mock, removeKnex: jest.Mock;
  const input = () =>
    ({
      name: 'Web source',
      engine: 'pg',
      type: 'postgresql',
      connectionConfig: { host: 'localhost', database: 'synthetic' },
    } as any);
  beforeEach(async () => {
    process.env.CONFIG_SECRET_KEY = 'test-secret';
    db = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      entities: [Database, Dataset, Widget, TableQuery, User],
      synchronize: true,
    }).initialize();
    await db.manager.save(User, {
      id: 7,
      userId: 'writer',
      email: 'writer@example.invalid',
      password: 'not-a-credential',
    });
    await db.manager.save(Database, {
      id: 1,
      ownerId: 7,
      name: 'Parent',
      engine: 'pg',
      type: 'postgresql',
      connectionConfig: encryptConnectionConfig(
        JSON.stringify({ client: 'pg', connection: { host: 'localhost' } }),
      ),
    });
    execute = jest.fn(async () => {
      expect(db.createQueryRunner().isTransactionActive).toBe(false);
      return { status: 'SUCCESS', datas: [] };
    });
    removeKnex = jest.fn();
    database = new DatabaseService(
      db.getRepository(Database),
      {} as any,
      db.getRepository(Dataset),
      db.getRepository(TableQuery),
      { removeKnex } as any,
    );
    datasets = new DatasetService(db.getRepository(Dataset), db.getRepository(Widget), {
      executeQuery: execute,
    } as any);
    tables = new TableQueryService(db.getRepository(TableQuery), db.getRepository(Database));
    widgets = new WidgetService(db.getRepository(Widget), {} as any, tables);
  });
  afterEach(async () => db.destroy());
  it('creates and updates only for the current owner/epoch', async () => {
    const created = await database.create(input(), 7, 0);
    await database.update(created.data.id, { name: 'Changed' }, 7, 0);
    expect((await db.manager.findOneBy(Database, { id: created.data.id })).name).toBe('Changed');
    await db.manager.update(User, 7, { authVersion: 1 });
    await expect(database.update(created.data.id, { name: 'Stale' }, 7, 0)).rejects.toMatchObject({
      status: 403,
    });
    expect((await db.manager.findOneBy(Database, { id: created.data.id })).name).toBe('Changed');
    await expect(database.create(input())).rejects.toMatchObject({ status: 403 });
  });
  it.each(['ownerId', 'catalogActive', 'catalogVersion', 'id', 'createdAt', 'unexpected'])(
    'rejects Source mass assignment %s without any insert/update',
    async key => {
      await expect(database.create({ ...input(), [key]: 9 }, 7, 0)).rejects.toMatchObject({
        status: 400,
      });
      await expect(database.update(1, { [key]: 9 } as any, 7, 0)).rejects.toMatchObject({
        status: 400,
      });
      expect(await db.manager.count(Database)).toBe(1);
      expect((await db.manager.findOneBy(Database, { id: 1 })).catalogActive).toBe(true);
    },
  );
  it.each([
    { filename: '/tmp/escape' },
    { fileVersions: [] },
    { connection: { filename: '/tmp/escape' } },
  ])('rejects managed connection config injection %j', async config => {
    await expect(
      database.create({ ...input(), connectionConfig: config }, 7, 0),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      database.update(1, { connectionConfig: config } as any, 7, 0),
    ).rejects.toMatchObject({ status: 400 });
    expect(await db.manager.count(Database)).toBe(1);
  });
  it('does not resurrect a deleted Source via update', async () => {
    await db.manager.delete(Database, 1);
    await expect(database.update(1, { name: 'Resurrect' }, 7, 0)).rejects.toMatchObject({
      status: 403,
    });
    expect(await db.manager.count(Database)).toBe(0);
  });
  it('accepts the existing Dataset UI canonical string Source ID and persists a numeric binding', async () => {
    const result = await datasets.create(
      { databaseId: '1', title: 'UI dataset', query: 'SELECT 1' } as any,
      7,
      0,
    );
    expect(execute).toHaveBeenCalledWith({ id: 1, query: 'SELECT 1' });
    expect(result.data.databaseId).toBe(1);
    expect((await db.manager.findOneBy(Dataset, { id: result.data.id })).databaseId).toBe(1);
  });
  it.each([
    '0',
    '-1',
    '1.5',
    '1e0',
    '01',
    ' 1 ',
    '1x',
    '9007199254740992',
    0,
    -1,
    1.5,
    NaN,
    undefined,
  ])('rejects malformed Dataset UI Source ID %p before SQL or persistence', async databaseId => {
    await expect(
      datasets.create({ databaseId, title: 'No', query: 'SELECT 1' } as any, 7, 0),
    ).rejects.toMatchObject({ status: 400 });
    expect(execute).not.toHaveBeenCalled();
    expect(await db.manager.count(Dataset)).toBe(0);
  });
  it('keeps Dataset unknown-field rejection when normalizing an existing UI Source ID', async () => {
    await expect(
      datasets.create({ databaseId: '1', title: 'No', query: 'SELECT 1', id: 9 } as any, 7, 0),
    ).rejects.toMatchObject({ status: 400 });
    expect(execute).not.toHaveBeenCalled();
    expect(await db.manager.count(Dataset)).toBe(0);
  });
  it('finishes SQL outside the transaction, then refuses Dataset insert after Source deletion', async () => {
    execute.mockImplementation(async () => {
      await db.manager.delete(Database, 1);
      return { status: 'SUCCESS' };
    });
    await expect(
      datasets.create({ databaseId: 1, title: 'Orphan', query: 'SELECT 1' }, 7, 0),
    ).rejects.toMatchObject({ status: 403 });
    expect(await db.manager.count(Dataset)).toBe(0);
    expect(execute).toHaveBeenCalledTimes(1);
  });
  it('refuses Dataset update when Source is deleted during SQL', async () => {
    await db.manager.save(Dataset, { id: 1, databaseId: 1, title: 'Keep', query: 'SELECT 1' });
    execute.mockImplementation(async () => {
      await db.manager.delete(Database, 1);
      return { status: 'SUCCESS' };
    });
    await expect(
      datasets.update(1, { title: 'No', query: 'SELECT 2' }, 7, 0),
    ).rejects.toMatchObject({ status: 403 });
    expect((await db.manager.findOneBy(Dataset, { id: 1 })).title).toBe('Keep');
  });
  it('refuses changed Source basis between Dataset SQL and insert', async () => {
    execute.mockImplementation(async () => {
      await db.manager.update(Database, 1, { connectionConfig: 'changed' });
      return { status: 'SUCCESS' };
    });
    await expect(
      datasets.create({ databaseId: 1, title: 'No', query: 'SELECT 1' }, 7, 0),
    ).rejects.toMatchObject({ status: 409 });
    expect(await db.manager.count(Dataset)).toBe(0);
  });
  it('persists TABLE Widget and TableQuery together, and rejects both after Source deletion', async () => {
    const value: any = {
      databaseId: 1,
      tableName: 'orders',
      componentId: 1,
      datasetType: 'TABLE',
      datasetId: 0,
      option: {},
      title: 'Table',
    };
    const result = await widgets.create(value, 7, 0);
    expect(result.data.id).toBeGreaterThan(0);
    expect(await db.manager.count(TableQuery)).toBe(1);
    await db.manager.delete(Database, 1);
    await expect(widgets.create({ ...value }, 7, 0)).rejects.toMatchObject({ status: 403 });
    await expect(tables.create(1, 'orders', 7, 0)).rejects.toMatchObject({ status: 403 });
    expect(await db.manager.count(Widget)).toBe(1);
    expect(await db.manager.count(TableQuery)).toBe(1);
  });
  it('rejects DATASET Widget insert/update for a missing Source', async () => {
    await db.manager.save(Dataset, { id: 1, databaseId: 1, title: 'Dataset', query: 'SELECT 1' });
    const value: any = {
      componentId: 1,
      datasetType: 'DATASET',
      datasetId: 1,
      option: {},
      title: 'Keep',
    };
    const created = await widgets.create(value, 7, 0);
    await db.manager.delete(Database, 1);
    await expect(widgets.create({ ...value }, 7, 0)).rejects.toMatchObject({ status: 403 });
    await expect(widgets.update(created.data.id, { title: 'No' }, 7, 0)).rejects.toMatchObject({
      status: 403,
    });
    expect((await db.manager.findOneBy(Widget, { id: created.data.id })).title).toBe('Keep');
  });
  it('rejects Sample Dataset creation if the previously selected Source was deleted', async () => {
    await db.manager.update(Database, 1, { name: '샘플 매출 데이터' });
    const repository = db.getRepository(Database);
    const find = repository.findOne.bind(repository);
    jest.spyOn(repository, 'findOne').mockImplementationOnce(async options => {
      const selected = await find(options);
      await db.manager.delete(Database, 1);
      return selected;
    });
    const sample = new SampleService(
      repository,
      db.getRepository(Dataset),
      db.getRepository(Widget),
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    await expect((sample as any).ensureSampleAssets(7)).rejects.toMatchObject({ status: 403 });
    expect(await db.manager.count(Dataset)).toBe(0);
  });
});
