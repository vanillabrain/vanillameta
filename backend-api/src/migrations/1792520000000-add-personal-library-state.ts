import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class AddPersonalLibraryState1792520000000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    if (await runner.hasTable('personal_library_state')) return;
    await runner.createTable(
      new Table({
        name: 'personal_library_state',
        columns: [
          ...['userId', 'organizationId', 'dashboardId'].map(name => ({
            name,
            type: 'integer',
            isPrimary: true,
          })),
          { name: 'archived', type: 'boolean', default: false },
          { name: 'version', type: 'integer' },
          { name: 'updatedAt', type: 'datetime' },
        ],
      }),
    );
  }
  async down(): Promise<void> {
    throw new Error('Personal library rollback requires a reviewed backup plan.');
  }
}
