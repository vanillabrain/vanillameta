import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

/**
 * One row per saved state of a Studio dashboard (DashboardRevision): what a restore starts from and
 * who changed the dashboard, a person or an external AI through a named connection.
 */
export class AddDashboardRevision1793610000000 implements MigrationInterface {
  name = 'AddDashboardRevision1793610000000';

  async up(runner: QueryRunner): Promise<void> {
    if (await runner.hasTable('dashboard_revision')) return;
    await runner.createTable(
      new Table({
        name: 'dashboard_revision',
        columns: [
          {
            name: 'seq',
            type: 'integer',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'revisionId', type: 'varchar', length: '36', isUnique: true },
          { name: 'dashboardId', type: 'integer' },
          { name: 'revision', type: 'varchar', length: '64' },
          { name: 'studioDocument', type: 'text' },
          { name: 'title', type: 'varchar', length: '300' },
          { name: 'layout', type: 'text' },
          { name: 'analysisDefinition', type: 'text', isNullable: true },
          { name: 'structuredDefinition', type: 'text', isNullable: true },
          { name: 'pivotDefinitions', type: 'text', isNullable: true },
          { name: 'actorId', type: 'integer' },
          { name: 'organizationId', type: 'integer', isNullable: true },
          { name: 'operation', type: 'varchar', length: '8' },
          { name: 'authorKind', type: 'varchar', length: '12' },
          { name: 'aiGrantId', type: 'varchar', length: '36', isNullable: true },
          { name: 'aiClientName', type: 'varchar', length: '255', isNullable: true },
          { name: 'requestId', type: 'varchar', length: '128', isNullable: true },
          { name: 'createdAt', type: 'varchar', length: '32' },
        ],
        indices: [
          new TableIndex({
            name: 'IDX_dashboard_revision_dashboard',
            columnNames: ['dashboardId', 'seq'],
          }),
        ],
      }),
    );
  }

  async down(): Promise<void> {
    throw new Error('dashboard revision rollback requires a reviewed backup plan.');
  }
}
