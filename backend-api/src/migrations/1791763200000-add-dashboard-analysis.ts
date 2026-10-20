import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/** Persist AI drafts while retaining existing metadata and dashboards. */
export class AddDashboardAnalysis1791763200000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    if (!(await runner.hasColumn('dashboard', 'analysisDefinition'))) {
      await runner.addColumn(
        'dashboard',
        new TableColumn({ name: 'analysisDefinition', type: 'text', isNullable: true }),
      );
    }
  }
  async down(runner: QueryRunner): Promise<void> {
    if (await runner.hasColumn('dashboard', 'analysisDefinition')) {
      await runner.dropColumn('dashboard', 'analysisDefinition');
    }
  }
}
