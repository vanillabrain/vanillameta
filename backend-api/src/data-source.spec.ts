import dataSource from './data-source';
import { MigrationInterface } from 'typeorm';
import { AddAccountIntegrity1792430000000 } from './migrations/1792430000000-add-account-integrity';

describe('CLI migration discovery', () => {
  it('loads migration constructors without importing specs or treating shared helpers as migrations', () => {
    const migrations = dataSource.options.migrations as (new () => MigrationInterface)[];
    expect(migrations.length).toBeGreaterThan(0);
    expect(migrations).toContain(AddAccountIntegrity1792430000000);
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
