import { MigrationInterface, QueryRunner, Table, TableColumn, TableIndex } from 'typeorm';
export class AddEnterpriseResourceGrants1792410000000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    if (!(await runner.hasTable('enterprise_resource_grant')))
      await runner.createTable(
        new Table({
          name: 'enterprise_resource_grant',
          columns: [
            { name: 'resourceKind', type: 'varchar', length: '16', isPrimary: true },
            { name: 'resourceId', type: 'integer', isPrimary: true },
            { name: 'recipientId', type: 'integer', isPrimary: true },
            { name: 'organizationId', type: 'integer' },
            { name: 'ownerId', type: 'integer' },
            { name: 'version', type: 'integer' },
            ...['read', 'edit', 'publish', 'export'].map(name => ({
              name,
              type: 'boolean',
              default: false,
            })),
          ],
          indices: [
            new TableIndex({
              name: 'IDX_enterprise_grant_recipient',
              columnNames: ['recipientId', 'organizationId'],
            }),
          ],
        }),
      );
    if (await runner.hasTable('dashboard_publication')) {
      for (const name of ['publisherId', 'sourceId'])
        if (!(await runner.hasColumn('dashboard_publication', name)))
          await runner.addColumn(
            'dashboard_publication',
            new TableColumn({ name, type: 'integer', isNullable: true }),
          );
    }
    if (
      (await runner.hasTable('enterprise_audit_event')) &&
      !(await runner.hasColumn('enterprise_audit_event', 'subjectId'))
    )
      await runner.addColumn(
        'enterprise_audit_event',
        new TableColumn({ name: 'subjectId', type: 'integer', isNullable: true }),
      );
  }
  async down(): Promise<void> {
    throw new Error('Resource policy rollback requires a reviewed backup plan.');
  }
}
