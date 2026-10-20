import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';
export class AddExploreViews1791855000000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    if (await runner.hasTable('explore_view')) return;
    await runner.createTable(
      new Table({
        name: 'explore_view',
        columns: [
          {
            name: 'id',
            type: 'integer',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'sourceId', type: 'integer' },
          { name: 'userId', type: 'integer' },
          { name: 'name', type: 'varchar', length: '80' },
          { name: 'sourceRevision', type: 'varchar', length: '128' },
          { name: 'measureVersions', type: 'text' },
          { name: 'state', type: 'text' },
          { name: 'createdAt', type: 'datetime', isNullable: true, default: 'CURRENT_TIMESTAMP' },
          { name: 'updatedAt', type: 'datetime', isNullable: true, default: 'CURRENT_TIMESTAMP' },
        ],
      }),
    );
    await runner.createIndex(
      'explore_view',
      new TableIndex({ name: 'IDX_explore_view_owner', columnNames: ['sourceId', 'userId'] }),
    );
  }
  async down(): Promise<void> {
    throw new Error('Explore saved views require backup before rollback.');
  }
}
