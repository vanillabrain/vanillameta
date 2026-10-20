import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';
export class AddMetricDeleteReceipts1792540000000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    if (await runner.hasTable('metric_delete_receipt')) return;
    await runner.createTable(
      new Table({
        name: 'metric_delete_receipt',
        columns: [
          {
            name: 'id',
            type: 'integer',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'actorId', type: 'integer' },
          { name: 'organizationId', type: 'integer', isNullable: true },
          { name: 'metricId', type: 'integer' },
          { name: 'requestId', type: 'varchar', length: '36' },
          { name: 'expectedRevision', type: 'varchar', length: '64' },
          { name: 'digest', type: 'varchar', length: '64' },
          { name: 'createdAt', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
        ],
        indices: [
          new TableIndex({
            name: 'UQ_metric_delete_request',
            columnNames: ['actorId', 'requestId'],
            isUnique: true,
          }),
          new TableIndex({ name: 'IDX_metric_delete_resource', columnNames: ['metricId'] }),
        ],
      }),
    );
  }
  async down(): Promise<void> {
    throw new Error('Metric deletion receipt rollback requires a reviewed backup plan.');
  }
}
