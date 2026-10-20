import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class AddCommerceMvp1791849600000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    if (!(await runner.hasTable('commerce_source'))) {
      await runner.createTable(
        new Table({
          name: 'commerce_source',
          columns: [
            {
              name: 'id',
              type: 'int',
              isPrimary: true,
              isGenerated: true,
              generationStrategy: 'increment',
            },
            { name: 'ownerId', type: 'int' },
            { name: 'name', type: 'varchar', length: '160' },
            { name: 'publishedFilename', type: 'text', isNullable: true },
            { name: 'summaryJson', type: 'text', isNullable: true },
            { name: 'presentationJson', type: 'text', isNullable: true },
            { name: 'publishedDigest', type: 'varchar', length: '64', isNullable: true },
            { name: 'currentVersion', type: 'int', default: 0 },
            { name: 'status', type: 'varchar', length: '20', default: "'empty'" },
            { name: 'createdAt', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
            { name: 'updatedAt', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
          ],
          indices: [{ name: 'IDX_commerce_source_owner', columnNames: ['ownerId'] }],
        }),
      );
    }
    if (!(await runner.hasTable('commerce_run'))) {
      await runner.createTable(
        new Table({
          name: 'commerce_run',
          columns: [
            {
              name: 'id',
              type: 'int',
              isPrimary: true,
              isGenerated: true,
              generationStrategy: 'increment',
            },
            { name: 'ownerId', type: 'int' },
            { name: 'sourceId', type: 'int' },
            { name: 'status', type: 'varchar', length: '20' },
            { name: 'resultJson', type: 'text', isNullable: true },
            { name: 'errorMessage', type: 'text', isNullable: true },
            { name: 'inputDigest', type: 'varchar', length: '64' },
            { name: 'expectedVersion', type: 'int' },
            { name: 'publishedVersion', type: 'int', isNullable: true },
            { name: 'createdAt', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
            { name: 'updatedAt', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
          ],
          indices: [
            { name: 'IDX_commerce_run_owner', columnNames: ['ownerId'] },
            { name: 'IDX_commerce_run_source', columnNames: ['sourceId'] },
          ],
        }),
      );
    }
  }

  async down(runner: QueryRunner): Promise<void> {
    if (await runner.hasTable('commerce_run')) await runner.dropTable('commerce_run');
    if (await runner.hasTable('commerce_source')) await runner.dropTable('commerce_source');
  }
}
