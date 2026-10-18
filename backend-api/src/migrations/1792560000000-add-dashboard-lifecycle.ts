import { MigrationInterface, QueryRunner, Table, TableColumn, TableIndex } from 'typeorm';

export class AddDashboardLifecycle1792560000000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    if (await runner.hasTable('dashboard')) {
      for (const column of [
        new TableColumn({ name: 'assetActive', type: 'boolean', default: true }),
        new TableColumn({ name: 'assetVersion', type: 'integer', default: 0 }),
      ]) {
        if (!(await runner.hasColumn('dashboard', column.name)))
          await runner.addColumn('dashboard', column);
      }
    }
    if (!(await runner.hasTable('dashboard_lifecycle_receipt'))) {
      await runner.createTable(
        new Table({
          name: 'dashboard_lifecycle_receipt',
          columns: [
            {
              name: 'id',
              type: 'integer',
              isPrimary: true,
              isGenerated: true,
              generationStrategy: 'increment',
            },
            { name: 'actorId', type: 'integer' },
            { name: 'organizationId', type: 'integer' },
            { name: 'dashboardId', type: 'integer' },
            { name: 'requestId', type: 'varchar', length: '36' },
            { name: 'payloadDigest', type: 'varchar', length: '64' },
            { name: 'active', type: 'boolean' },
            { name: 'version', type: 'integer' },
            { name: 'createdAt', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
          ],
          indices: [
            new TableIndex({
              name: 'UQ_dashboard_lifecycle_request',
              columnNames: ['actorId', 'requestId'],
              isUnique: true,
            }),
            new TableIndex({
              name: 'IDX_dashboard_lifecycle_resource',
              columnNames: ['dashboardId'],
            }),
          ],
        }),
      );
    }
  }
  async down(): Promise<void> {
    throw new Error('Dashboard lifecycle rollback requires a reviewed backup plan.');
  }
}
