import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';
export class AddSourceModelReceipt1792300002000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    if (await runner.hasTable('source_model_receipt')) return;
    await runner.createTable(
      new Table({
        name: 'source_model_receipt',
        columns: [
          {
            name: 'id',
            type: 'integer',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'actorId', type: 'integer' },
          { name: 'requestId', type: 'varchar', length: '36' },
          { name: 'payloadDigest', type: 'varchar', length: '64' },
          { name: 'sourceId', type: 'integer', isNullable: true },
          { name: 'createdAt', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
        ],
        indices: [
          new TableIndex({
            name: 'UQ_source_model_actor_request',
            columnNames: ['actorId', 'requestId'],
            isUnique: true,
          }),
        ],
      }),
    );
  }
  async down(runner: QueryRunner): Promise<void> {
    if (await runner.hasTable('source_model_receipt'))
      await runner.dropTable('source_model_receipt');
  }
}
