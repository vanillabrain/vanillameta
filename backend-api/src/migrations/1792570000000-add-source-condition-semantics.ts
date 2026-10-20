import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';
export class AddSourceConditionSemantics1792570000000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    if (
      (await runner.hasTable('source_condition_entry')) &&
      !(await runner.hasColumn('source_condition_entry', 'semanticsJSON'))
    )
      await runner.addColumn(
        'source_condition_entry',
        new TableColumn({ name: 'semanticsJSON', type: 'text', isNullable: true }),
      );
  }
  async down(): Promise<void> {
    throw new Error('Condition semantics rollback requires a reviewed backup plan.');
  }
}
