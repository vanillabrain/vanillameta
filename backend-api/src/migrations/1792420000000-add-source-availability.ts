import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';
export class AddSourceAvailability1792420000000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    if (!(await runner.hasTable('database'))) return;
    for (const column of [
      new TableColumn({ name: 'catalogActive', type: 'boolean', default: true }),
      new TableColumn({ name: 'catalogVersion', type: 'integer', default: 0 }),
    ])
      if (!(await runner.hasColumn('database', column.name)))
        await runner.addColumn('database', column);
  }
  async down(): Promise<void> {
    throw new Error('Availability rollback requires a reviewed backup plan.');
  }
}
