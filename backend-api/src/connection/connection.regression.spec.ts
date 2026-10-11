import { BadRequestException, NotFoundException } from '@nestjs/common';
import { knex } from 'knex';
import { ConnectionService } from './connection.service';
import { DatabaseService } from '../database/database.service';
import { ResponseStatus } from '../common/enum/response-status.enum';
import { encryptConnectionConfig } from '../utils/crypto.util';

jest.mock('knex', () => {
  const actual = jest.requireActual('knex');
  return { ...actual, knex: Object.assign(jest.fn(), { Client: actual.knex.Client }) };
});

describe('connection identity, pools and stored-config cache regressions', () => {
  const repository = { findOne: jest.fn(), update: jest.fn(), remove: jest.fn() };
  const gateway = { emitTo: jest.fn() };
  let connection: ConnectionService;
  let database: DatabaseService;
  const environment = { ...process.env };
  const config = (name: string) =>
    encryptConnectionConfig(
      JSON.stringify({ client: 'sqlite3', connection: { filename: `${name}.db` } }),
    );
  const pool = (value: string) => ({
    client: { config: { client: 'sqlite3' } },
    raw: jest.fn().mockResolvedValue([{ value }]),
    destroy: jest.fn().mockResolvedValue(undefined),
  });

  beforeEach(() => {
    jest.resetAllMocks();
    process.env.CONFIG_SECRET_KEY = 'unit-regression-key';
    delete process.env.QUERY_CACHE_TTL_MS;
    connection = new ConnectionService(repository as any, gateway as any);
    database = new DatabaseService(repository as any, {} as any, {} as any, {} as any, connection);
  });

  afterEach(async () => {
    await connection.removeKnex(1);
    await connection.removeKnex(812345);
    process.env = { ...environment };
  });

  it('canonicalizes a decimal string id for repositories and the pool map', async () => {
    repository.findOne.mockResolvedValue({ id: 1, connectionConfig: config('A') });
    const a = pool('A');
    (knex as unknown as jest.Mock).mockReturnValue(a);
    expect(await connection.getKnex('1')).toBe(a);
    expect(await connection.getKnex(1)).toBe(a);
    expect(repository.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
    expect(knex).toHaveBeenCalledTimes(1);
    const dto = { id: '1', query: 'SELECT 1' } as any;
    expect((await connection.executeQuery(dto)).datas).toEqual([{ value: 'A' }]);
    expect(dto.id).toBe('1');
  });

  it.each([0, -1, NaN, 1.5, '', '1.5', ' 1', '1e0', true, [], {}, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid id %p before a repository query',
    async id => {
      await expect(connection.getKnex(id as any)).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        connection.executeQuery({ id, query: 'SELECT 1' } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repository.findOne).not.toHaveBeenCalled();
    },
  );

  it('controls missing connection and database detail/update/delete ids', async () => {
    repository.findOne.mockResolvedValue(null);
    await expect(connection.getKnex('1')).rejects.toBeInstanceOf(NotFoundException);
    await expect(connection.executeQuery({ id: 1, query: 'SELECT 1' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(database.findOne(1)).rejects.toBeInstanceOf(NotFoundException);
    await expect(database.findOneInfo(1)).rejects.toBeInstanceOf(NotFoundException);
    expect((await database.update(1, {} as any)).status).toBe(ResponseStatus.ERROR);
    expect((await database.remove(1)).status).toBe(ResponseStatus.ERROR);
    expect(repository.update).not.toHaveBeenCalled();
    expect(repository.remove).not.toHaveBeenCalled();
  });

  it.each([NaN, 0, -1, 1.5, '', true, [], {}])(
    'rejects public database id %p before repository access',
    async id => {
      await expect(database.findOne(id as any)).rejects.toBeInstanceOf(BadRequestException);
      await expect(database.findOneInfo(id as any)).rejects.toBeInstanceOf(BadRequestException);
      await expect(database.update(id as any, {} as any)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(database.remove(id as any)).rejects.toBeInstanceOf(BadRequestException);
      expect(repository.findOne).not.toHaveBeenCalled();
    },
  );

  it('closes pool A after a successful source edit and executes through new pool B', async () => {
    let stored = { id: 1, engine: 'sqlite3', connectionConfig: config('A') };
    repository.findOne.mockImplementation(async () => ({ ...stored }));
    repository.update.mockImplementation(async (_where, fields) => {
      stored = { ...stored, ...fields };
      return { affected: 1 };
    });
    const a = pool('A');
    const b = pool('B');
    (knex as unknown as jest.Mock).mockReturnValueOnce(a).mockReturnValueOnce(b);
    expect((await connection.executeQuery({ id: 1, query: 'SELECT 1' })).datas).toEqual([
      { value: 'A' },
    ]);
    expect(
      (await database.update(1, { name: 'B', connectionConfig: { filename: 'B.db' } } as any))
        .status,
    ).toBe(ResponseStatus.SUCCESS);
    expect(a.destroy).toHaveBeenCalledTimes(1);
    expect(connection.hasKnex(1)).toBe(false);
    expect((await connection.executeQuery({ id: 1, query: 'SELECT 1' })).datas).toEqual([
      { value: 'B' },
    ]);
    expect(knex).toHaveBeenLastCalledWith(
      expect.objectContaining({ connection: { filename: 'B.db' } }),
    );
  });

  it('removes the old entry before waiting for pool destruction', async () => {
    let finish: () => void;
    const a = pool('A');
    a.destroy.mockImplementation(
      () =>
        new Promise<void>(resolve => {
          finish = resolve;
        }),
    );
    (knex as unknown as jest.Mock).mockReturnValue(a);
    connection.addKnex(1, {});
    const removed = connection.removeKnex(1);
    expect(connection.hasKnex(1)).toBe(false);
    finish();
    await removed;
  });

  it('does not reuse cached query results after the stored configuration changes', async () => {
    process.env.QUERY_CACHE_TTL_MS = '60000';
    let storedConfig = config('A');
    repository.findOne.mockImplementation(async () => ({
      id: 812345,
      connectionConfig: storedConfig,
    }));
    const run = jest
      .spyOn(connection as any, 'runQuery')
      .mockResolvedValueOnce({ status: ResponseStatus.SUCCESS, datas: [{ value: 'A' }] })
      .mockResolvedValueOnce({ status: ResponseStatus.SUCCESS, datas: [{ value: 'B' }] });
    const dto = { id: '812345', query: 'SELECT 1 AS stored_config_regression' } as any;
    expect((await connection.executeQuery(dto)).datas).toEqual([{ value: 'A' }]);
    expect((await connection.executeQuery(dto)).datas).toEqual([{ value: 'A' }]);
    storedConfig = config('B');
    expect((await connection.executeQuery(dto)).datas).toEqual([{ value: 'B' }]);
    expect(run).toHaveBeenCalledTimes(2);
    expect(run).toHaveBeenLastCalledWith({ ...dto, id: 812345 }, undefined);
    repository.findOne.mockResolvedValueOnce(null);
    await expect(connection.executeQuery(dto)).rejects.toBeInstanceOf(NotFoundException);
  });
});
