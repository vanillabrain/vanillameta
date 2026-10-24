import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/** Marks ledger rows whose tokens are an estimate (a reservation, or a provider that reported none). */
export class AddAiUsageEstimated1792700200000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    if (!(await runner.hasColumn('ai_usage_ledger', 'usageEstimated')))
      await runner.addColumn(
        'ai_usage_ledger',
        new TableColumn({ name: 'usageEstimated', type: 'boolean', default: false }),
      );
  }

  async down(runner: QueryRunner): Promise<void> {
    if (await runner.hasColumn('ai_usage_ledger', 'usageEstimated'))
      await runner.dropColumn('ai_usage_ledger', 'usageEstimated');
  }
}
