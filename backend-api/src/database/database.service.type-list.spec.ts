import { DatabaseService } from './database.service';

describe('DatabaseService findTypeList', () => {
  const rows = [
    { type: 'mysql', engine: 'mysql2' },
    { type: 'postgres', engine: 'pg' },
    { type: 'oracle', engine: 'oracledb' },
    { type: 'sqlite', engine: 'sqlite3' },
  ];
  const previous = {
    NODE_ENV: process.env.NODE_ENV,
    ALLOWED_SOURCE_TYPES: process.env.ALLOWED_SOURCE_TYPES,
  };
  const service = () =>
    new DatabaseService(
      {} as any,
      { find: jest.fn().mockResolvedValue(rows) } as any,
      {} as any,
      {} as any,
      {} as any,
    );

  afterEach(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('lists every type outside production', async () => {
    process.env.NODE_ENV = 'test';
    delete process.env.ALLOWED_SOURCE_TYPES;
    const { data } = await service().findTypeList();
    expect(data.map(type => type.type)).toEqual(['mysql', 'postgres', 'oracle', 'sqlite']);
  });

  it('leaves out the network engines production refuses, keeping the upload-only SQLite entry', async () => {
    process.env.NODE_ENV = 'prod';
    delete process.env.ALLOWED_SOURCE_TYPES;
    const { data } = await service().findTypeList();
    expect(data.map(type => type.type)).toEqual(['sqlite']);
  });

  it('lists an engine the operator opts into', async () => {
    process.env.NODE_ENV = 'prod';
    process.env.ALLOWED_SOURCE_TYPES = 'file,sample,pg';
    const { data } = await service().findTypeList();
    expect(data.map(type => type.type)).toEqual(['postgres', 'sqlite']);
  });
});
