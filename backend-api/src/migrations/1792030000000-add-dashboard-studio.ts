import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

/** Studio version documents and the save idempotency journal; legacy dashboard tables stay untouched. */
export class AddDashboardStudio1792030000000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    if (!(await runner.hasTable('studio_state'))) {
      await runner.createTable(
        new Table({
          name: 'studio_state',
          columns: [
            { name: 'dashboardId', type: 'integer', isPrimary: true },
            { name: 'document', type: 'text' },
            { name: 'legacyRevision', type: 'varchar', length: '64' },
            { name: 'createdAt', type: 'datetime', isNullable: true, default: 'CURRENT_TIMESTAMP' },
            { name: 'updatedAt', type: 'datetime', isNullable: true, default: 'CURRENT_TIMESTAMP' },
          ],
        }),
      );
    }
    if (!(await runner.hasTable('studio_run'))) {
      await runner.createTable(
        new Table({
          name: 'studio_run',
          columns: [
            {
              name: 'id',
              type: 'integer',
              isPrimary: true,
              isGenerated: true,
              generationStrategy: 'increment',
            },
            { name: 'actorId', type: 'integer' },
            { name: 'requestId', type: 'varchar', length: '128' },
            { name: 'payloadHash', type: 'varchar', length: '64' },
            { name: 'result', type: 'text', isNullable: true },
            { name: 'createdAt', type: 'datetime', isNullable: true, default: 'CURRENT_TIMESTAMP' },
            { name: 'updatedAt', type: 'datetime', isNullable: true, default: 'CURRENT_TIMESTAMP' },
          ],
          indices: [
            new TableIndex({
              name: 'IDX_studio_run_actor_request',
              columnNames: ['actorId', 'requestId'],
              isUnique: true,
            }),
          ],
        }),
      );
    }
  }

  async down(runner: QueryRunner): Promise<void> {
    if (await runner.hasTable('studio_run')) await runner.dropTable('studio_run');
    if (await runner.hasTable('studio_state')) await runner.dropTable('studio_state');
  }
}
