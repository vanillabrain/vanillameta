import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';
export class AddStudioExecution1792040000000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    if (await runner.hasTable('studio_execution')) return;
    await runner.createTable(
      new Table({
        name: 'studio_execution',
        columns: [
          { name: 'runId', type: 'varchar', length: '36', isPrimary: true },
          { name: 'actorId', type: 'integer' },
          { name: 'dashboardId', type: 'integer' },
          { name: 'requestId', type: 'varchar', length: '128' },
          { name: 'payloadHash', type: 'varchar', length: '64' },
          { name: 'status', type: 'varchar', length: '24' },
          { name: 'state', type: 'text' },
          { name: 'createdAt', type: 'datetime', isNullable: true, default: 'CURRENT_TIMESTAMP' },
          { name: 'updatedAt', type: 'datetime', isNullable: true, default: 'CURRENT_TIMESTAMP' },
        ],
        indices: [
          new TableIndex({
            name: 'IDX_studio_execution_actor_request',
            columnNames: ['actorId', 'requestId'],
            isUnique: true,
          }),
        ],
      }),
    );
  }
  async down(runner: QueryRunner): Promise<void> {
    if (await runner.hasTable('studio_execution')) await runner.dropTable('studio_execution');
  }
}
