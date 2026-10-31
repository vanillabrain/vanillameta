import { DataSource } from 'typeorm';
import { metadataDatabaseConfig } from './metadata-database';
import { User } from '../user/entities/user.entity';

describe('User entity identity', () => {
  it('maps the single User metadata to the authenticated user table', async () => {
    process.env.METADATA_DB_TYPE = 'postgres';
    const db = new DataSource({
      ...metadataDatabaseConfig({
        NODE_ENV: 'prod',
        DB_HOST: '127.0.0.1',
        DB_PORT: '5432',
        DB_USERNAME: 'postgres',
        DB_NAME: 'vanillameta',
      }),
      entities: [__dirname + '/../**/*.entity{.ts,.js}'],
      synchronize: false,
    });
    await (db as unknown as { buildMetadatas(): Promise<void> }).buildMetadatas();

    const userMetadata = db.entityMetadatas.filter(meta => meta.name === 'User');
    expect(userMetadata).toHaveLength(1);
    expect(db.getMetadata(User).tableName).toBe('user');
    expect(
      (db.getRepository('User') as unknown as { metadata: { tableName: string } }).metadata
        .tableName,
    ).toBe('user');
  });
});
