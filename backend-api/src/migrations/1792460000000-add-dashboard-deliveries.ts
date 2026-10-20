import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';
export class AddDashboardDeliveries1792460000000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    if (!(await runner.hasTable('enterprise_dashboard_delivery')))
      await runner.createTable(
        new Table({
          name: 'enterprise_dashboard_delivery',
          columns: [
            ...['ownerId', 'organizationId', 'dashboardId', 'recipientId'].map(name => ({
              name,
              type: 'integer',
              isPrimary: true,
            })),
            { name: 'version', type: 'integer' },
            { name: 'active', type: 'boolean', default: false },
          ],
          indices: [
            new TableIndex({
              name: 'IDX_enterprise_delivery_recipient',
              columnNames: ['recipientId', 'organizationId', 'active'],
            }),
          ],
        }),
      );
    if (!(await runner.hasTable('enterprise_delivery_receipt')))
      await runner.createTable(
        new Table({
          name: 'enterprise_delivery_receipt',
          columns: [
            { name: 'ownerId', type: 'integer', isPrimary: true },
            { name: 'requestId', type: 'varchar', length: '36', isPrimary: true },
            { name: 'organizationId', type: 'integer' },
            { name: 'digest', type: 'varchar', length: '64' },
            { name: 'response', type: 'text' },
          ],
        }),
      );
  }
  async down(): Promise<void> {
    throw new Error('Delivery rollback requires a reviewed backup plan.');
  }
}
