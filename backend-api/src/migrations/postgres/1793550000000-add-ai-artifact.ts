import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class AddAiArtifact1793550000000 implements MigrationInterface {
  name = 'AddAiArtifact1793550000000';
  async up(runner: QueryRunner): Promise<void> {
    if (await runner.hasTable('ai_artifact')) return;
    await runner.createTable(
      new Table({
        name: 'ai_artifact',
        columns: [
          { name: 'id', type: 'varchar', length: '36', isPrimary: true },
          { name: 'ownerId', type: 'integer' },
          { name: 'organizationId', type: 'integer', isNullable: true },
          { name: 'kind', type: 'varchar', length: '16' },
          { name: 'title', type: 'varchar', length: '200' },
          { name: 'content', type: 'text' },
          { name: 'revision', type: 'integer' },
          { name: 'createdAt', type: 'varchar', length: '32' },
          { name: 'updatedAt', type: 'varchar', length: '32' },
          { name: 'deletedAt', type: 'varchar', length: '32', isNullable: true },
        ],
        indices: [
          new TableIndex({ name: 'IDX_ai_artifact_owner', columnNames: ['ownerId', 'updatedAt'] }),
        ],
      }),
    );
  }
  async down(): Promise<void> {
    throw new Error('ai_artifact rollback requires a reviewed backup plan.');
  }
}
