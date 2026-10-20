import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';
/** Additive only: old sources stay NULL; no inferred owner or deleted source. */
export class AddSourceOwner1791850000000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    if (!(await runner.hasTable('database'))) return;
    if (!(await runner.hasColumn('database', 'ownerId')))
      await runner.addColumn(
        'database',
        new TableColumn({ name: 'ownerId', type: 'int', isNullable: true }),
      );
  }
  async down(): Promise<void> {
    throw new Error(
      'Ownership rollback requires a reviewed backup; dropping ownerId would reopen access.',
    );
  }
}
