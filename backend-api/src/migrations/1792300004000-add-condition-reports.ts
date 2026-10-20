import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';
export class AddConditionReports1792300004000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    if (!(await runner.hasTable('bi_condition_report')))
      await runner.createTable(
        new Table({
          name: 'bi_condition_report',
          columns: [
            { name: 'id', type: 'varchar', length: '36', isPrimary: true },
            ...['actorId', 'organizationId', 'dashboardId'].map(name => ({
              name,
              type: 'integer',
            })),
            { name: 'blockId', type: 'varchar', length: '100' },
            ...['viewRevision', 'payloadDigest'].map(name => ({
              name,
              type: 'varchar',
              length: '64',
            })),
            { name: 'operator', type: 'varchar', length: '2' },
            { name: 'threshold', type: 'varchar', length: '64' },
            { name: 'intervalSeconds', type: 'integer' },
            { name: 'nextAt', type: 'varchar', length: '32' },
            { name: 'leaseToken', type: 'varchar', length: '36', isNullable: true },
            { name: 'leaseUntil', type: 'varchar', length: '32', isNullable: true },
            { name: 'active', type: 'boolean', default: true },
            { name: 'version', type: 'integer', default: 1 },
            { name: 'createdAt', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
          ],
          indices: [
            new TableIndex({ name: 'IDX_bi_report_due', columnNames: ['active', 'nextAt'] }),
          ],
        }),
      );
    if (!(await runner.hasTable('bi_condition_report_occurrence')))
      await runner.createTable(
        new Table({
          name: 'bi_condition_report_occurrence',
          columns: [
            { name: 'id', type: 'varchar', length: '36', isPrimary: true },
            { name: 'reportId', type: 'varchar', length: '36' },
            { name: 'scheduledAt', type: 'varchar', length: '32' },
            { name: 'outcome', type: 'varchar', length: '12' },
            { name: 'result', type: 'text', isNullable: true },
            { name: 'createdAt', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
          ],
          indices: [
            new TableIndex({
              name: 'UQ_bi_report_occurrence',
              columnNames: ['reportId', 'scheduledAt'],
              isUnique: true,
            }),
          ],
        }),
      );
  }
  async down(runner: QueryRunner): Promise<void> {
    for (const name of ['bi_condition_report_occurrence', 'bi_condition_report']) {
      if (await runner.hasTable(name)) {
        const rows = await runner.query(`SELECT COUNT(*) AS count FROM ${name}`);
        if (Number(rows[0].count) > 0)
          throw new Error('Back up scheduled reports before rollback.');
      }
    }
    for (const name of ['bi_condition_report_occurrence', 'bi_condition_report'])
      if (await runner.hasTable(name)) await runner.dropTable(name);
  }
}
