import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';
export class AddFileRefresh1792300000000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    if (await runner.hasTable('file_refresh')) return;
    await runner.createTable(
      new Table({
        name: 'file_refresh',
        columns: [
          { name: 'id', type: 'varchar', length: '36', isPrimary: true },
          { name: 'actorId', type: 'integer' },
          { name: 'sourceId', type: 'integer' },
          { name: 'requestId', type: 'varchar', length: '36' },
          ...['payloadDigest', 'inputDigest', 'expectedRevision'].map(name => ({
            name,
            type: 'varchar',
            length: '64',
          })),
          { name: 'originalname', type: 'varchar', length: '256' },
          { name: 'extension', type: 'varchar', length: '12' },
          { name: 'status', type: 'varchar', length: '24' },
          { name: 'storageDigest', type: 'varchar', length: '64' },
          { name: 'inputRetained', type: 'boolean', default: '1' },
          { name: 'attempts', type: 'integer', default: '0' },
          { name: 'leaseToken', type: 'varchar', length: '36', isNullable: true },
          { name: 'leaseUntil', type: 'varchar', length: '32', isNullable: true },
          { name: 'result', type: 'text', isNullable: true },
          { name: 'error', type: 'text', isNullable: true },
          { name: 'createdAt', type: 'datetime', isNullable: true, default: 'CURRENT_TIMESTAMP' },
          { name: 'updatedAt', type: 'datetime', isNullable: true, default: 'CURRENT_TIMESTAMP' },
        ],
        indices: [
          new TableIndex({
            name: 'IDX_file_refresh_actor_request',
            columnNames: ['actorId', 'requestId'],
            isUnique: true,
          }),
        ],
      }),
    );
  }
  async down(runner: QueryRunner): Promise<void> {
    if (await runner.hasTable('file_refresh')) await runner.dropTable('file_refresh');
  }
}
