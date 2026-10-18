import { MigrationInterface, QueryRunner, Table, TableColumn, TableIndex } from 'typeorm';
export class AddEnterpriseMembership1792400000000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    if ((await runner.hasTable('user')) && !(await runner.hasColumn('user', 'active')))
      await runner.addColumn(
        'user',
        new TableColumn({ name: 'active', type: 'boolean', default: true }),
      );
    if ((await runner.hasTable('user')) && !(await runner.hasColumn('user', 'authVersion')))
      await runner.addColumn(
        'user',
        new TableColumn({ name: 'authVersion', type: 'integer', default: 0 }),
      );
    const id = {
      name: 'id',
      type: 'integer',
      isPrimary: true,
      isGenerated: true,
      generationStrategy: 'increment' as const,
    };
    const integer = (name: string) => ({ name, type: 'integer' });
    const tables = [
      new Table({
        name: 'enterprise_enrollment',
        columns: [
          { ...integer('userId'), isPrimary: true },
          integer('organizationId'),
          { name: 'codeHash', type: 'varchar', length: '64' },
          { name: 'expiresAt', type: 'datetime' },
        ],
        indices: [
          new TableIndex({
            name: 'IDX_enterprise_enrollment_hash',
            columnNames: ['codeHash'],
            isUnique: true,
          }),
        ],
      }),
      new Table({
        name: 'enterprise_organization',
        columns: [
          id,
          { name: 'name', type: 'varchar', length: '100' },
          { ...integer('version'), default: 1 },
        ],
      }),
      new Table({
        name: 'enterprise_membership',
        columns: [
          { ...integer('userId'), isPrimary: true },
          integer('organizationId'),
          { name: 'role', type: 'varchar', length: '16' },
          { name: 'team', type: 'varchar', length: '100', default: "''" },
        ],
        indices: [
          new TableIndex({
            name: 'IDX_enterprise_membership_org',
            columnNames: ['organizationId'],
          }),
        ],
      }),
      new Table({
        name: 'enterprise_audit_event',
        columns: [
          id,
          integer('organizationId'),
          integer('actorId'),
          { name: 'action', type: 'varchar', length: '40' },
          integer('resourceId'),
          integer('version'),
          { name: 'createdAt', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
        ],
        indices: [
          new TableIndex({ name: 'IDX_enterprise_audit_org', columnNames: ['organizationId'] }),
        ],
      }),
    ];
    for (const table of tables)
      if (!(await runner.hasTable(table.name))) await runner.createTable(table);
  }
  async down(): Promise<void> {
    throw new Error('Enterprise membership and audit rollback requires a reviewed backup plan.');
  }
}
