import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';
export class AddReportDeliveries1793270000000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    if (!(await runner.hasTable('private_report_delivery')))
      await runner.createTable(
        new Table({
          name: 'private_report_delivery',
          columns: [
            { name: 'reportId', type: 'varchar', length: '36', isPrimary: true },
            { name: 'recipientId', type: 'integer', isPrimary: true },
            ...[
              'ownerId',
              'organizationId',
              'relationVersion',
              'pinnedVersion',
              'ownerAuthVersion',
              'recipientAuthVersion',
            ].map(name => ({ name, type: 'integer' })),
            { name: 'active', type: 'boolean' },
            { name: 'pinnedHash', type: 'varchar', length: '64' },
          ],
        }),
      );
    if (!(await runner.hasTable('private_report_delivery_receipt')))
      await runner.createTable(
        new Table({
          name: 'private_report_delivery_receipt',
          columns: [
            { name: 'ownerId', type: 'integer', isPrimary: true },
            { name: 'organizationId', type: 'integer', isPrimary: true },
            { name: 'requestId', type: 'varchar', length: '36', isPrimary: true },
            { name: 'reportId', type: 'varchar', length: '36' },
            { name: 'payloadHash', type: 'varchar', length: '64' },
            { name: 'result', type: 'text' },
          ],
        }),
      );
    const index = new TableIndex({
      name: 'IDX_report_delivery_recipient',
      columnNames: ['recipientId', 'active'],
    });
    if (
      !(await runner.getTable('private_report_delivery')).indices.some(
        item => item.name === index.name,
      )
    )
      await runner.createIndex('private_report_delivery', index);
    for (const [table, key] of [
      [
        'private_report_delivery',
        new TableForeignKey({
          name: 'FK_report_delivery_revision',
          columnNames: ['reportId', 'pinnedVersion'],
          referencedTableName: 'private_report_revision',
          referencedColumnNames: ['reportId', 'version'],
          onDelete: 'RESTRICT',
        }),
      ],
      [
        'private_report_delivery_receipt',
        new TableForeignKey({
          name: 'FK_report_delivery_receipt_head',
          columnNames: ['reportId'],
          referencedTableName: 'private_report',
          referencedColumnNames: ['id'],
          onDelete: 'RESTRICT',
        }),
      ],
    ] as const) {
      if (!(await runner.getTable(table)).foreignKeys.some(existing => existing.name === key.name))
        await runner.createForeignKey(table, key);
    }
  }
  async down(runner: QueryRunner): Promise<void> {
    if (await runner.hasTable('private_report_delivery_receipt'))
      await runner.dropTable('private_report_delivery_receipt');
    if (await runner.hasTable('private_report_delivery'))
      await runner.dropTable('private_report_delivery');
  }
}
