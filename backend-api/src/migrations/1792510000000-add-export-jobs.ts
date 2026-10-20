import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';
export class AddExportJobs1792510000000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    if (!(await runner.hasTable('export_job')))
      await runner.createTable(
        new Table({
          name: 'export_job',
          columns: [
            {
              name: 'id',
              type: 'integer',
              isPrimary: true,
              isGenerated: true,
              generationStrategy: 'increment',
            },
            ...['ownerId', 'organizationId', 'sourceId', 'sourceOwnerId', 'version'].map(name => ({
              name,
              type: 'integer',
            })),
            { name: 'requestId', type: 'varchar', length: '36' },
            { name: 'digest', type: 'varchar', length: '64' },
            ...['requestJson', 'basisJson'].map(name => ({ name, type: 'text' })),
            { name: 'status', type: 'varchar', length: '16' },
            { name: 'attemptToken', type: 'varchar', length: '36', isNullable: true },
            { name: 'leaseUntil', type: 'datetime', isNullable: true },
            { name: 'createdAt', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
            { name: 'expiresAt', type: 'datetime' },
            { name: 'filename', type: 'varchar', length: '100', isNullable: true },
            { name: 'hash', type: 'varchar', length: '64', isNullable: true },
            { name: 'errorCode', type: 'varchar', length: '32', isNullable: true },
            ...['rowCount', 'bytes', 'partCount'].map(name => ({
              name,
              type: 'integer',
              default: 0,
            })),
          ],
          indices: [
            new TableIndex({
              name: 'UQ_export_job_request',
              columnNames: ['ownerId', 'requestId'],
              isUnique: true,
            }),
            new TableIndex({
              name: 'IDX_export_job_owner',
              columnNames: ['ownerId', 'organizationId', 'id'],
            }),
          ],
        }),
      );
    if (!(await runner.hasTable('export_part')))
      await runner.createTable(
        new Table({
          name: 'export_part',
          columns: [
            { name: 'jobId', type: 'integer', isPrimary: true },
            { name: 'part', type: 'integer', isPrimary: true },
            { name: 'data', type: 'text' },
          ],
        }),
      );
  }
  async down(): Promise<void> {
    throw new Error('Export jobs rollback requires a reviewed backup plan.');
  }
}
