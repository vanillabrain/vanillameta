import { MigrationInterface, QueryRunner, Table, TableUnique } from 'typeorm';

export class AddDashboardPublications1792040000000 implements MigrationInterface {
  async up(runner: QueryRunner) {
    if (await runner.hasTable('dashboard_publication')) return;
    await runner.createTable(
      new Table({
        name: 'dashboard_publication',
        columns: [
          { name: 'dashboardId', type: 'integer', isPrimary: true, comment: '대시보드 ID' },
          { name: 'uuid', type: 'varchar', length: '36' },
          { name: 'version', type: 'integer', default: 0 },
          { name: 'dashboardRevision', type: 'varchar', length: '64' },
          { name: 'snapshot', type: 'text' },
          { name: 'publishedAt', type: 'varchar', length: '40' },
          { name: 'expiresAt', type: 'varchar', length: '40' },
          { name: 'active', type: 'boolean', default: 1 },
          { name: 'requestId', type: 'varchar', length: '36' },
          { name: 'payloadDigest', type: 'varchar', length: '64' },
          { name: 'createdAt', type: 'datetime', default: 'CURRENT_TIMESTAMP', isNullable: true },
          { name: 'updatedAt', type: 'datetime', default: 'CURRENT_TIMESTAMP', isNullable: true },
        ],
        uniques: [
          new TableUnique({
            name: 'UQ_dashboard_publication_uuid',
            columnNames: ['uuid'],
          }),
        ],
      }),
    );
  }

  async down(runner: QueryRunner) {
    if (!(await runner.hasTable('dashboard_publication'))) return;
    const count = await runner.query('SELECT COUNT(*) AS n FROM dashboard_publication');
    if (Number(count[0].n))
      throw new Error(
        'Back up published snapshots before rollback; public links depend on this table.',
      );
    await runner.dropTable('dashboard_publication');
  }
}
