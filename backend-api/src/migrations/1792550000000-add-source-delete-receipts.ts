import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';
export class AddSourceDeleteReceipts1792550000000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    if (await runner.hasTable('source_delete_receipt')) return;
    await runner.createTable(
      new Table({
        name: 'source_delete_receipt',
        columns: [
          {
            name: 'id',
            type: 'integer',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'actorId', type: 'integer' },
          { name: 'organizationId', type: 'integer', isNullable: true },
          { name: 'sourceId', type: 'integer' },
          { name: 'requestId', type: 'varchar', length: '36' },
          { name: 'expectedRevision', type: 'varchar', length: '64' },
          { name: 'digest', type: 'varchar', length: '64' },
          { name: 'filePlan', type: 'text' },
          { name: 'managedFiles', type: 'integer' },
          { name: 'cleanupStatus', type: 'varchar', length: '16' },
          { name: 'cleanupVersion', type: 'integer', default: 0 },
          { name: 'cleanupAttempt', type: 'varchar', length: '36', isNullable: true },
          { name: 'cleanupLeaseUntil', type: 'datetime', isNullable: true },
          { name: 'createdAt', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
        ],
        indices: [
          new TableIndex({
            name: 'UQ_source_delete_request',
            columnNames: ['actorId', 'requestId'],
            isUnique: true,
          }),
          new TableIndex({ name: 'IDX_source_delete_resource', columnNames: ['sourceId'] }),
        ],
      }),
    );
  }
  async down(): Promise<void> {
    throw new Error('Source deletion receipt rollback requires a reviewed backup plan.');
  }
}
