import { Test } from '@nestjs/testing';
import { getDataSourceToken, TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

it('boots and closes the real TypeORM adapter with a single DataSource identity', async () => {
  expect(getDataSourceToken()).toBe(DataSource);
  const module = await Test.createTestingModule({
    imports: [TypeOrmModule.forRoot({ type: 'sqlite', database: ':memory:', entities: [] })],
  }).compile();
  const source = module.get(DataSource);
  try {
    await module.init();
    expect(source).toBeInstanceOf(DataSource);
    expect(source.isInitialized).toBe(true);
    expect(await source.query('SELECT 1 AS healthy')).toEqual([{ healthy: 1 }]);
  } finally {
    await module.close();
  }
  expect(source.isInitialized).toBe(false);
});
