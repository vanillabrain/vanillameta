import { MigrationInterface, QueryRunner, Table, TableColumn, TableIndex } from 'typeorm';
export class AddBiGovernance1792300003000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    if ((await runner.hasTable('dashboard')) && !(await runner.hasColumn('dashboard', 'governed')))
      await runner.addColumn(
        'dashboard',
        new TableColumn({ name: 'governed', type: 'boolean', default: false }),
      );
    const id = () => ({
      name: 'id',
      type: 'integer',
      isPrimary: true,
      isGenerated: true,
      generationStrategy: 'increment' as const,
    });
    const int = (name: string, nullable = false) => ({
      name,
      type: 'integer',
      isNullable: nullable,
    });
    const str = (name: string, length = '100', nullable = false) => ({
      name,
      type: 'varchar',
      length,
      isNullable: nullable,
    });
    const active = () => ({ name: 'active', type: 'boolean', default: true });
    const version = () => ({ name: 'version', type: 'integer', default: 1 });
    const created = () => ({ name: 'createdAt', type: 'datetime', default: 'CURRENT_TIMESTAMP' });
    const definitions = [
      new Table({
        name: 'bi_organization',
        columns: [id(), int('ownerId'), str('name'), version(), active(), created()],
        indices: [
          new TableIndex({
            name: 'UQ_bi_org_owner_name',
            columnNames: ['ownerId', 'name'],
            isUnique: true,
          }),
        ],
      }),
      new Table({
        name: 'bi_organization_group',
        columns: [id(), int('organizationId'), str('name'), active()],
        indices: [
          new TableIndex({
            name: 'UQ_bi_org_group_name',
            columnNames: ['organizationId', 'name'],
            isUnique: true,
          }),
        ],
      }),
      new Table({
        name: 'bi_organization_member',
        columns: [
          id(),
          int('organizationId'),
          int('actorId'),
          int('groupId', true),
          str('role', '12'),
          version(),
          active(),
        ],
        indices: [
          new TableIndex({
            name: 'UQ_bi_org_member',
            columnNames: ['organizationId', 'actorId'],
            isUnique: true,
          }),
        ],
      }),
      new Table({
        name: 'bi_dashboard_policy',
        columns: [
          id(),
          int('organizationId'),
          int('groupId'),
          int('dashboardId'),
          str('displayTitle'),
          version(),
          active(),
          { name: 'allowAi', type: 'boolean', default: false },
          { name: 'allowExport', type: 'boolean', default: false },
          str('dashboardRevision', '64'),
          str('sourceRevision', '64'),
          { name: 'recipe', type: 'text' },
          str('expiresAt', '40', true),
          created(),
        ],
        indices: [
          new TableIndex({
            name: 'UQ_bi_dashboard_policy_group',
            columnNames: ['organizationId', 'dashboardId', 'groupId'],
            isUnique: true,
          }),
        ],
      }),
      new Table({
        name: 'bi_policy_audit',
        columns: [
          id(),
          int('organizationId'),
          int('actorId'),
          int('policyId', true),
          int('policyVersion', true),
          str('action', '24'),
          str('outcome', '12'),
          created(),
        ],
        indices: [
          new TableIndex({
            name: 'IDX_bi_policy_audit_org',
            columnNames: ['organizationId', 'id'],
          }),
        ],
      }),
    ];
    for (const table of definitions)
      if (!(await runner.hasTable(table.name))) await runner.createTable(table);
  }
  async down(runner: QueryRunner): Promise<void> {
    // Rolling back access policy must never silently reopen a governed artifact.
    for (const name of ['bi_organization', 'bi_dashboard_policy', 'bi_policy_audit']) {
      if (await runner.hasTable(name)) {
        const rows = await runner.query(`SELECT COUNT(*) AS count FROM ${name}`);
        if (Number(rows[0].count) > 0)
          throw new Error(
            'Back up organization policies and explicitly retire governed dashboards before rollback.',
          );
      }
    }
    if (await runner.hasColumn('dashboard', 'governed')) {
      const rows = await runner.query('SELECT COUNT(*) AS count FROM dashboard WHERE governed = 1');
      if (Number(rows[0].count) > 0)
        throw new Error(
          'Back up organization policies and explicitly retire governed dashboards before rollback.',
        );
    }
    for (const name of [
      'bi_policy_audit',
      'bi_dashboard_policy',
      'bi_organization_member',
      'bi_organization_group',
      'bi_organization',
    ])
      if (await runner.hasTable(name)) await runner.dropTable(name);
    if (await runner.hasColumn('dashboard', 'governed'))
      await runner.dropColumn('dashboard', 'governed');
  }
}
