import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';
export class AddDashboardDeleteReceipts1792530000000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    if (await runner.hasTable('dashboard_delete_receipt')) return;
    await runner.createTable(
      new Table({
        name: 'dashboard_delete_receipt',
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
          { name: 'dashboardId', type: 'integer' },
          { name: 'requestId', type: 'varchar', length: '36' },
          { name: 'expectedRevision', type: 'varchar', length: '64' },
          { name: 'digest', type: 'varchar', length: '64' },
          { name: 'createdAt', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
        ],
        indices: [
          new TableIndex({
            name: 'UQ_dashboard_delete_request',
            columnNames: ['actorId', 'requestId'],
            isUnique: true,
          }),
          new TableIndex({ name: 'IDX_dashboard_delete_resource', columnNames: ['dashboardId'] }),
        ],
      }),
    );
  }
  async down(): Promise<void> {
    throw new Error('Dashboard deletion receipt rollback requires a reviewed backup plan.');
  }
}
