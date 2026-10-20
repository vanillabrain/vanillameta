import { MigrationInterface, QueryRunner, Table } from 'typeorm';
export class AddStudioPublication1792050000000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    if (!(await runner.hasTable('studio_publication')))
      await runner.createTable(
        new Table({
          name: 'studio_publication',
          columns: [
            { name: 'token', type: 'varchar', length: '64', isPrimary: true },
            { name: 'actorId', type: 'integer' },
            { name: 'dashboardId', type: 'integer' },
            { name: 'sourceId', type: 'integer' },
            { name: 'version', type: 'integer' },
            { name: 'visibility', type: 'varchar', length: '12' },
            { name: 'allowRemix', type: 'boolean' },
            { name: 'expiresAt', type: 'varchar', isNullable: true },
            { name: 'revokedAt', type: 'varchar', isNullable: true },
            { name: 'asOf', type: 'varchar' },
            { name: 'dataVersion', type: 'varchar', length: '64' },
            { name: 'snapshot', type: 'text' },
            { name: 'createdAt', type: 'datetime', isNullable: true, default: 'CURRENT_TIMESTAMP' },
            { name: 'updatedAt', type: 'datetime', isNullable: true, default: 'CURRENT_TIMESTAMP' },
          ],
          indices: [{ name: 'IDX_studio_publication_dashboard', columnNames: ['dashboardId'] }],
        }),
      );
    if (!(await runner.hasTable('studio_publication_request')))
      await runner.createTable(
        new Table({
          name: 'studio_publication_request',
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
            { name: 'result', type: 'text' },
            { name: 'createdAt', type: 'datetime', isNullable: true, default: 'CURRENT_TIMESTAMP' },
            { name: 'updatedAt', type: 'datetime', isNullable: true, default: 'CURRENT_TIMESTAMP' },
          ],
          indices: [
            {
              name: 'IDX_studio_publication_request_actor',
              columnNames: ['actorId', 'requestId'],
              isUnique: true,
            },
          ],
        }),
      );
  }
  async down(runner: QueryRunner): Promise<void> {
    if (await runner.hasTable('studio_publication_request'))
      await runner.dropTable('studio_publication_request');
    if (await runner.hasTable('studio_publication')) await runner.dropTable('studio_publication');
  }
}
