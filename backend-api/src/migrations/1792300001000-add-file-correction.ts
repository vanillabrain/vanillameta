import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';
export class AddFileCorrection1792300001000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    if (
      (await runner.hasTable('file_refresh')) &&
      !(await runner.hasColumn('file_refresh', 'correction'))
    )
      await runner.addColumn(
        'file_refresh',
        new TableColumn({ name: 'correction', type: 'text', isNullable: true }),
      );
  }
  async down(runner: QueryRunner): Promise<void> {
    if (
      (await runner.hasTable('file_refresh')) &&
      (await runner.hasColumn('file_refresh', 'correction'))
    )
      await runner.dropColumn('file_refresh', 'correction');
  }
}
