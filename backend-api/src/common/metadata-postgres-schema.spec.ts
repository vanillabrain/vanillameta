import { DataSource } from 'typeorm';
import { metadataDatabaseConfig } from './metadata-database';

describe('PostgreSQL metadata schema', () => {
  it('accepts every entity column and relation without a live server', async () => {
    const previous = process.env.METADATA_DB_TYPE;
    process.env.METADATA_DB_TYPE = 'postgres';
    const db = new DataSource({
      ...metadataDatabaseConfig({
        NODE_ENV: 'prod',
        DB_HOST: '127.0.0.1',
        DB_PORT: '5432',
        DB_USERNAME: 'postgres',
        DB_NAME: 'vanillameta',
      }),
      entities: [__dirname + '/../**/*.entity{.ts,.js}', __dirname + '/../**/*.entities{.ts,.js}'],
      synchronize: false,
    });
    try {
      await expect((db as any).buildMetadatas()).resolves.toBeUndefined();
      expect(db.entityMetadatas.length).toBeGreaterThan(90);
      expect(
        db.entityMetadatas.every(meta => meta.columns.every(column => column.type !== 'datetime')),
      ).toBe(true);
    } finally {
      if (previous === undefined) delete process.env.METADATA_DB_TYPE;
      else process.env.METADATA_DB_TYPE = previous;
    }
  });
});
