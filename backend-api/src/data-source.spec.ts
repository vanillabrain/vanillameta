import dataSource from './data-source';
import { MigrationInterface } from 'typeorm';
import { metadataDatabaseType } from './common/metadata-database';
import { AddAccountIntegrity1792430000000 } from './migrations/1792430000000-add-account-integrity';
import { PostgresBaseline1793500000000 } from './migrations/postgres/1793500000000-postgres-baseline';

describe('CLI migration discovery', () => {
  it('loads migration constructors without importing specs or treating shared helpers as migrations', () => {
    const migrations = dataSource.options.migrations as (new () => MigrationInterface)[];
    expect(migrations.length).toBeGreaterThan(0);
    // The CLI reads only the directory of the configured metadata database: PostgreSQL has its own baseline
    // and never loads the older SQLite-era files, which stay for local SQLite databases.
    const [own, other] =
      metadataDatabaseType() === 'postgres'
        ? [PostgresBaseline1793500000000, AddAccountIntegrity1792430000000]
        : [AddAccountIntegrity1792430000000, PostgresBaseline1793500000000];
    expect(migrations).toContain(own);
    expect(migrations).not.toContain(other);
    for (const migration of migrations) {
      expect(typeof migration).toBe('function');
      expect(migration.name).toMatch(/\d{13}$/);
      expect(typeof migration.prototype.up).toBe('function');
      expect(typeof migration.prototype.down).toBe('function');
    }
    expect(dataSource.isInitialized).toBe(false);
    expect(dataSource.options.synchronize).toBe(false);
  });
});
