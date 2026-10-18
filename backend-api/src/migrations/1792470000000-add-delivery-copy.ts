import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';
export class AddDeliveryCopy1792470000000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    const table = await runner.getTable('enterprise_dashboard_delivery');
    if (table && !table.findColumnByName('allowCopy'))
      await runner.addColumn(
        table,
        new TableColumn({ name: 'allowCopy', type: 'boolean', default: false }),
      );
  }
  async down(): Promise<void> {
    throw new Error('Copy consent rollback requires a reviewed backup plan.');
  }
}
