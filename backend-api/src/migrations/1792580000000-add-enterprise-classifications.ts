import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class AddEnterpriseClassifications1792580000000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    if (!(await runner.hasTable('enterprise_classification')))
      await runner.createTable(
        new Table({
          name: 'enterprise_classification',
          columns: [
            {
              name: 'id',
              type: 'integer',
              isPrimary: true,
              isGenerated: true,
              generationStrategy: 'increment',
            },
            { name: 'organizationId', type: 'integer' },
            { name: 'name', type: 'varchar', length: '80' },
            { name: 'nameKey', type: 'varchar', length: '64' },
            { name: 'active', type: 'boolean', default: true },
            { name: 'version', type: 'integer' },
          ],
          indices: [
            new TableIndex({
              name: 'UQ_enterprise_classification_name',
              columnNames: ['organizationId', 'nameKey'],
              isUnique: true,
            }),
          ],
        }),
      );
    if (!(await runner.hasTable('enterprise_classification_request')))
      await runner.createTable(
        new Table({
          name: 'enterprise_classification_request',
          columns: [
            { name: 'actorId', type: 'integer', isPrimary: true },
            { name: 'requestId', type: 'varchar', length: '36', isPrimary: true },
            { name: 'organizationId', type: 'integer' },
            { name: 'payloadHash', type: 'varchar', length: '64' },
            { name: 'result', type: 'text' },
          ],
        }),
      );
  }
  async down(): Promise<void> {
    throw new Error('Classification rollback requires a reviewed backup plan.');
  }
}
