import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';
export class AddPrivateReports1793260000000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    if (!(await runner.hasTable('private_report')))
      await runner.createTable(
        new Table({
          name: 'private_report',
          columns: [
            { name: 'id', type: 'varchar', length: '36', isPrimary: true },
            { name: 'ownerId', type: 'integer' },
            { name: 'organizationKey', type: 'integer' },
            { name: 'dashboardId', type: 'integer' },
            { name: 'sourceId', type: 'integer' },
            { name: 'version', type: 'integer' },
            { name: 'revision', type: 'varchar', length: '64' },
            { name: 'title', type: 'varchar', length: '800' },
            { name: 'updatedAt', type: 'varchar', length: '32' },
          ],
        }),
      );
    if (!(await runner.hasTable('private_report_revision')))
      await runner.createTable(
        new Table({
          name: 'private_report_revision',
          columns: [
            { name: 'reportId', type: 'varchar', length: '36', isPrimary: true },
            { name: 'version', type: 'integer', isPrimary: true },
            { name: 'ownerId', type: 'integer' },
            { name: 'revision', type: 'varchar', length: '64' },
            { name: 'bytes', type: 'integer' },
            { name: 'chunkCount', type: 'integer' },
          ],
        }),
      );
    if (!(await runner.hasTable('private_report_chunk')))
      await runner.createTable(
        new Table({
          name: 'private_report_chunk',
          columns: [
            { name: 'reportId', type: 'varchar', length: '36', isPrimary: true },
            { name: 'version', type: 'integer', isPrimary: true },
            { name: 'ordinal', type: 'integer', isPrimary: true },
            { name: 'payload', type: 'text' },
          ],
        }),
      );
    if (!(await runner.hasTable('private_report_request')))
      await runner.createTable(
        new Table({
          name: 'private_report_request',
          columns: [
            { name: 'ownerId', type: 'integer', isPrimary: true },
            { name: 'organizationKey', type: 'integer', isPrimary: true },
            { name: 'requestId', type: 'varchar', length: '36', isPrimary: true },
            { name: 'reportId', type: 'varchar', length: '36' },
            { name: 'payloadHash', type: 'varchar', length: '64' },
            { name: 'version', type: 'integer' },
          ],
        }),
      );
    const index = new TableIndex({
      name: 'IDX_private_report_owner',
      columnNames: ['ownerId', 'organizationKey'],
    });
    if (!(await runner.getTable('private_report')).indices.some(item => item.name === index.name))
      await runner.createIndex('private_report', index);
    for (const [table, name, columns, parent, referenced] of [
      [
        'private_report_revision',
        'FK_private_report_revision_head',
        ['reportId'],
        'private_report',
        ['id'],
      ],
      [
        'private_report_chunk',
        'FK_private_report_chunk_revision',
        ['reportId', 'version'],
        'private_report_revision',
        ['reportId', 'version'],
      ],
      [
        'private_report_request',
        'FK_private_report_request_revision',
        ['reportId', 'version'],
        'private_report_revision',
        ['reportId', 'version'],
      ],
    ] as const) {
      if (!(await runner.getTable(table)).foreignKeys.some(key => key.name === name))
        await runner.createForeignKey(
          table,
          new TableForeignKey({
            name,
            columnNames: [...columns],
            referencedTableName: parent,
            referencedColumnNames: [...referenced],
            onDelete: 'RESTRICT',
          }),
        );
    }
  }
  async down(runner: QueryRunner): Promise<void> {
    if (await runner.hasTable('private_report_request'))
      await runner.dropTable('private_report_request');
    if (await runner.hasTable('private_report_chunk'))
      await runner.dropTable('private_report_chunk');
    if (await runner.hasTable('private_report_revision'))
      await runner.dropTable('private_report_revision');
    if (await runner.hasTable('private_report')) await runner.dropTable('private_report');
  }
}
