import { Database } from '../database/entities/database.entity';
import { sourceRevision } from './source-revision';
jest.mock('../connection/connection.service', () => ({ ConnectionService: class {} }));
import { DataSource } from 'typeorm';
import { ForbiddenException } from '@nestjs/common';
import { SourceConditionsService } from './source-conditions.service';
import { SourceConditionEntry } from './entities/source-condition-entry.entity';
import { AddSourceConditions1792440000000 } from '../migrations/1792440000000-add-source-conditions';

describe('UC052 saved source condition context', () => {
  let db: DataSource,
    service: SourceConditionsService,
    access: any,
    revision: string,
    connection: any;
  const definition = {
    include: { kind: 'predicate', column: 'amount', operator: 'gte', values: [10] },
    exclude: null,
  };
  const request = () => ({ sourceId: 3, sourceRevision: revision, version: 0, definition });
  beforeEach(async () => {
    db = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      entities: [SourceConditionEntry, Database],
      synchronize: false,
    }).initialize();
    const runner = db.createQueryRunner();
    await new AddSourceConditions1792440000000().up(runner);
    await new AddSourceConditions1792440000000().up(runner);
    await runner.release();
    await db.synchronize();
    access = {
      actor: jest.fn(),
      id: (x: any) => Number(x),
      assert: jest.fn(async (_kind, _id, actor, action) => {
        if (actor !== 7 && !(actor === 8 && action === 'read')) throw new ForbiddenException();
      }),
    };
    const sources = db.getRepository(Database);
    const source = await sources.save({
      id: 3,
      ownerId: 7,
      name: 'Synthetic',
      engine: 'duckdb',
      type: 'FILE',
      connectionConfig: '{}',
    });
    revision = sourceRevision(source, 'file-v1');
    connection = {
      captureDuckDBSnapshot: jest.fn(async () => ({ run: async run => run() })),
      duckDBVersion: jest.fn(async () => 'file-v1'),
      queryDuckDB: jest.fn(async (_id, sql) =>
        sql.startsWith('DESCRIBE')
          ? {
              datas: [
                { column_name: 'amount', column_type: 'DOUBLE' },
                { column_name: 'channel', column_type: 'VARCHAR' },
              ],
            }
          : { datas: [{ total: '10', matched: '4', excluded: '1', remaining: '3' }] },
      ),
    };
    service = new SourceConditionsService(db, access, connection);
  });
  afterEach(async () => db?.destroy());
  it('starts empty and never returns source rows or writes', async () => {
    const result = await service.read({ sourceId: 3 }, 7);
    expect(result).toMatchObject({
      sourceId: 3,
      version: 0,
      sourceRevision: revision,
      definition: { include: null, exclude: null },
    });
    expect(JSON.stringify(result)).not.toContain('private');
    expect(await db.getRepository(SourceConditionEntry).count()).toBe(0);
    expect(
      connection.queryDuckDB.mock.calls.filter(call => !call[1].startsWith('DESCRIBE')),
    ).toHaveLength(0);
  });
  it('previews bound conditions once with full-population ratios and no writes', async () => {
    const result = await service.preview(request(), 8);
    expect(result.draft).toEqual(request());
    expect(result.population).toEqual({
      total: '10',
      matched: '4',
      excluded: '1',
      remaining: '3',
      matchedRatio: 0.4,
      remainingRatio: 0.3,
    });
    expect(connection.queryDuckDB.mock.calls.find(call => call[1].startsWith('WITH'))[2]).toEqual([
      10,
    ]);
    expect(await db.getRepository(SourceConditionEntry).count()).toBe(0);
  });
  it('restores immutable attributed versions after restart and rejects stale CAS', async () => {
    expect((await service.save(request(), 7)).version).toBe(1);
    expect(
      (await new SourceConditionsService(db, access, connection).read({ sourceId: 3 }, 7))
        .definition,
    ).toEqual(definition);
    await expect(service.save(request(), 7)).rejects.toMatchObject({ status: 409 });
    expect(await db.getRepository(SourceConditionEntry).find()).toMatchObject([
      { actorId: 7, version: 1, sourceRevision: revision },
    ]);
  });
  it('requires read before profiling and edit before writes', async () => {
    await expect(service.preview(request(), 9)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.save(request(), 8)).rejects.toBeInstanceOf(ForbiddenException);
    expect(connection.captureDuckDBSnapshot).not.toHaveBeenCalled();

    expect(await db.getRepository(SourceConditionEntry).count()).toBe(0);
  });
  it('rejects malformed types, unknown fields and stale source with no writes', async () => {
    for (const body of [
      { ...request(), extra: 'sql' },
      { ...request(), sourceRevision: 'old' },
      {
        ...request(),
        definition: { include: { ...definition.include, values: ['10'] }, exclude: null },
      },
    ])
      await expect(service.save(body, 7)).rejects.toThrow();
    expect(await db.getRepository(SourceConditionEntry).count()).toBe(0);
  });
  it('rejects a source replacement after pinned execution', async () => {
    connection.queryDuckDB
      .mockImplementationOnce(async () => ({
        datas: [{ column_name: 'amount', column_type: 'DOUBLE' }],
      }))
      .mockImplementationOnce(async () => {
        connection.duckDBVersion.mockResolvedValue('file-v2');
        return { datas: [{ total: '1', matched: '1', excluded: '0', remaining: '1' }] };
      });
    await expect(service.preview(request(), 7)).rejects.toMatchObject({ status: 409 });
  });
  it('rejects counts when another condition version commits during execution', async () => {
    connection.queryDuckDB
      .mockImplementationOnce(async () => ({
        datas: [{ column_name: 'amount', column_type: 'DOUBLE' }],
      }))
      .mockImplementationOnce(async () => {
        const entries = db.getRepository(SourceConditionEntry);
        await entries.insert({
          sourceId: 3,
          version: 1,
          actorId: 7,
          sourceRevision: revision,
          definition: JSON.stringify({ include: null, exclude: null }),
        });
        return { datas: [{ total: '1', matched: '1', excluded: '0', remaining: '1' }] };
      });
    await expect(service.preview(request(), 7)).rejects.toMatchObject({ status: 409 });
    expect(await db.getRepository(SourceConditionEntry).count()).toBe(1);
  });

  it('rechecks read authority after execution', async () => {
    connection.queryDuckDB
      .mockImplementationOnce(async () => ({
        datas: [{ column_name: 'amount', column_type: 'DOUBLE' }],
      }))
      .mockImplementationOnce(async () => {
        access.assert.mockRejectedValue(new ForbiddenException());
        return { datas: [{ total: '1', matched: '1', excluded: '0', remaining: '1' }] };
      });
    await expect(service.preview(request(), 7)).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('returns null ratios for empty full population', async () => {
    connection.queryDuckDB.mockImplementation(async (_id, sql) =>
      sql.startsWith('DESCRIBE')
        ? { datas: [{ column_name: 'amount', column_type: 'DOUBLE' }] }
        : { datas: [{ total: '0', matched: '0', excluded: '0', remaining: '0' }] },
    );
    expect((await service.preview(request(), 7)).population).toMatchObject({
      matchedRatio: null,
      remainingRatio: null,
    });
  });
  it('appends only one winner for concurrent same-version saves', async () => {
    const results = await Promise.allSettled([
      service.save(request(), 7),
      service.save(request(), 7),
    ]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(r => r.status === 'rejected')).toHaveLength(1);
    expect(await db.getRepository(SourceConditionEntry).count()).toBe(1);
  });
  it('fails closed for damaged stored definitions', async () => {
    await service.save(request(), 7);
    await db
      .getRepository(SourceConditionEntry)
      .update({ sourceId: 3, version: 1 }, { definition: '{broken' });
    await expect(service.read({ sourceId: 3 }, 7)).rejects.toMatchObject({ status: 409 });
    await expect(service.preview({ ...request(), version: 1 }, 7)).rejects.toMatchObject({
      status: 409,
    });
    await expect(service.save({ ...request(), version: 1 }, 7)).rejects.toMatchObject({
      status: 409,
    });
    expect(await db.getRepository(SourceConditionEntry).count()).toBe(1);
  });
});
