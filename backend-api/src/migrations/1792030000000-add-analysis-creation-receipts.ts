import { MigrationInterface, QueryRunner, Table, TableUnique } from 'typeorm';
export class AddAnalysisCreationReceipts1792030000000 implements MigrationInterface {
  async up(runner: QueryRunner) {
    if (await runner.hasTable('analysis_creation_receipt')) return;
    await runner.createTable(
      new Table({
        name: 'analysis_creation_receipt',
        columns: [
          {
            name: 'id',
            type: 'integer',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'actorId', type: 'integer' },
          { name: 'requestId', type: 'varchar', length: '36' },
          { name: 'payloadDigest', type: 'varchar', length: '64' },
          { name: 'dashboardId', type: 'integer', isNullable: true },
          { name: 'createdAt', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
        ],
        uniques: [
          new TableUnique({
            name: 'UQ_analysis_creation_request',
            columnNames: ['actorId', 'requestId'],
          }),
        ],
      }),
    );
  }
  async down(runner: QueryRunner) {
    if (!(await runner.hasTable('analysis_creation_receipt'))) return;
    const count = await runner.query('SELECT COUNT(*) AS n FROM analysis_creation_receipt');
    if (Number(count[0].n))
      throw new Error(
        'Back up creation receipts before rollback; idempotency history must be preserved.',
      );
    await runner.dropTable('analysis_creation_receipt');
  }
}
