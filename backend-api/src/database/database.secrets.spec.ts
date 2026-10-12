import { DatabaseService } from './database.service';
import { decryptConnectionConfig, encryptConnectionConfig } from '../utils/crypto.util';

describe('DatabaseService public connection responses', () => {
  const secret = 'private-database-fixture-secret';
  const previousSecret = process.env.CONFIG_SECRET_KEY;
  let stored: any;
  let service: DatabaseService;

  beforeEach(() => {
    process.env.CONFIG_SECRET_KEY = 'response-redaction-test';
    stored = {
      id: 9,
      name: 'private source',
      engine: 'pg',
      connectionConfig: encryptConnectionConfig(
        JSON.stringify({
          client: 'pg',
          password: secret,
          connection: {
            host: '127.0.0.1',
            password: secret,
            connectionString: `postgresql://user:${secret}@localhost/sample`,
          },
        }),
      ),
    };
    service = new DatabaseService(
      {
        find: jest.fn(async () => [{ ...stored }]),
        findOne: jest.fn(async () => ({ ...stored })),
        save: jest.fn(async entity => {
          stored = { ...entity, id: 9 };
          return { ...stored };
        }),
      } as any,
      {} as any,
      {
        find: jest.fn(async () => []),
      } as any,
      {} as any,
      {
        executeQuery: jest.fn(async () => ({ datas: [{ table_name: 'uploaded_data' }] })),
      } as any,
    );
  });

  afterEach(() => {
    if (previousSecret === undefined) delete process.env.CONFIG_SECRET_KEY;
    else process.env.CONFIG_SECRET_KEY = previousSecret;
  });

  it.each(['create', 'list', 'info', 'detail'])(
    '%s omits passwords and credential URLs without changing stored credentials',
    async method => {
      const result =
        method === 'create'
          ? await service.create({
              name: 'private source',
              engine: 'cockroachdb',
              type: 'pg',
              connectionConfig: {
                user: 'user',
                host: 'localhost',
                port: 5432,
                database: 'sample',
                password: secret,
              },
            } as any)
          : method === 'list'
          ? await service.findAll()
          : method === 'info'
          ? await service.findOneInfo(9)
          : await service.findOne(9);
      expect(JSON.stringify(result)).not.toContain(secret);
      expect(JSON.stringify(result)).not.toContain('connectionString');
      expect(decryptConnectionConfig(stored.connectionConfig)).toContain(secret);
      if (method === 'detail') expect(result.data.tables[0].tableName).toBe('uploaded_data');
    },
  );
});
