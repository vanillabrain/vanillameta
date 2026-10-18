import { MigrationInterface, QueryRunner, Table } from 'typeorm';
export class AddSourceConditions1792440000000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    if (await runner.hasTable('source_condition_entry')) return;
    await runner.createTable(
      new Table({
        name: 'source_condition_entry',
        columns: [
          { name: 'sourceId', type: 'integer', isPrimary: true },
          { name: 'version', type: 'integer', isPrimary: true },
          { name: 'actorId', type: 'integer' },
          { name: 'sourceRevision', type: 'varchar', length: '128' },
          { name: 'definition', type: 'text' },
          { name: 'createdAt', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
    );
  }
  async down(): Promise<void> {
    throw new Error('Saved condition history requires a reviewed backup before rollback.');
  }
}
