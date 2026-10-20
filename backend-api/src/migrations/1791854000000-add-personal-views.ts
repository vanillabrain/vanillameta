import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';
export class AddPersonalViews1791854000000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    if (await runner.hasTable('personal_view')) return;
    await runner.createTable(
      new Table({
        name: 'personal_view',
        columns: [
          {
            name: 'id',
            type: 'integer',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'dashboardId', type: 'integer' },
          { name: 'userId', type: 'integer' },
          { name: 'name', type: 'varchar', length: '80' },
          { name: 'revision', type: 'varchar', length: '64' },
          { name: 'state', type: 'text' },
          { name: 'createdAt', type: 'datetime', isNullable: true, default: 'CURRENT_TIMESTAMP' },
          { name: 'updatedAt', type: 'datetime', isNullable: true, default: 'CURRENT_TIMESTAMP' },
        ],
      }),
    );
    await runner.createIndex(
      'personal_view',
      new TableIndex({ name: 'IDX_personal_view_owner', columnNames: ['dashboardId', 'userId'] }),
    );
  }
  async down(): Promise<void> {
    throw new Error('Personal saved views require backup before rollback.');
  }
}
