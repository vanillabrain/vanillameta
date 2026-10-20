import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';
export class AddDashboardPivots1791951000000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    if (
      (await runner.hasTable('dashboard')) &&
      !(await runner.hasColumn('dashboard', 'pivotDefinitions'))
    )
      await runner.addColumn(
        'dashboard',
        new TableColumn({ name: 'pivotDefinitions', type: 'text', isNullable: true }),
      );
  }
  async down(): Promise<void> {
    throw new Error('Dashboard Pivot snapshots require backup before rollback.');
  }
}
