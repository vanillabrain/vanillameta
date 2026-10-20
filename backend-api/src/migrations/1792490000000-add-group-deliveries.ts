import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';
export class AddGroupDeliveries1792490000000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    if (!(await runner.hasTable('enterprise_group_delivery')))
      await runner.createTable(
        new Table({
          name: 'enterprise_group_delivery',
          columns: [
            ...['ownerId', 'organizationId', 'dashboardId', 'groupId'].map(name => ({
              name,
              type: 'integer',
              isPrimary: true,
            })),
            { name: 'version', type: 'integer' },
            { name: 'active', type: 'boolean', default: false },
            { name: 'allowCopy', type: 'boolean', default: false },
          ],
          indices: [
            new TableIndex({
              name: 'IDX_enterprise_group_delivery_group',
              columnNames: ['groupId', 'organizationId', 'active'],
            }),
          ],
        }),
      );
  }
  async down(): Promise<void> {
    throw new Error('Group delivery rollback requires a reviewed backup plan.');
  }
}
