import { MigrationInterface, QueryRunner, Table, TableColumn } from 'typeorm';
export class AddStudioRemix1792060000000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    if (!(await runner.hasColumn('studio_publication', 'remixTemplate')))
      await runner.addColumn(
        'studio_publication',
        new TableColumn({ name: 'remixTemplate', type: 'text', isNullable: true }),
      );
    if (!(await runner.hasTable('studio_remix_request')))
      await runner.createTable(
        new Table({
          name: 'studio_remix_request',
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
              name: 'IDX_studio_remix_request_actor',
              columnNames: ['actorId', 'requestId'],
              isUnique: true,
            },
          ],
        }),
      );
  }
  async down(runner: QueryRunner): Promise<void> {
    if (await runner.hasTable('studio_remix_request'))
      await runner.dropTable('studio_remix_request');
    if (await runner.hasColumn('studio_publication', 'remixTemplate'))
      await runner.dropColumn('studio_publication', 'remixTemplate');
  }
}
