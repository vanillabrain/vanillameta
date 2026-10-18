import { MigrationInterface, QueryRunner, Table } from 'typeorm';
export class AddSourceCatalog1792300000000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    if (await runner.hasTable('source_catalog_entry')) return;
    await runner.createTable(
      new Table({
        name: 'source_catalog_entry',
        columns: [
          { name: 'sourceId', type: 'integer', isPrimary: true },
          { name: 'version', type: 'integer', isPrimary: true },
          { name: 'actorId', type: 'integer' },
          { name: 'schemaRevision', type: 'varchar', length: '64' },
          { name: 'sourceRevision', type: 'varchar', length: '128' },
          { name: 'metadata', type: 'text' },
          { name: 'createdAt', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
    );
  }
  async down(): Promise<void> {
    throw new Error('Business metadata history requires backup before rollback.');
  }
}
