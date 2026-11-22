import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class AddAiArtifactRevision1793560000000 implements MigrationInterface {
  async up(runner: QueryRunner) {
    if (await runner.hasTable('ai_artifact_revision')) return;
    await runner.createTable(
      new Table({
        name: 'ai_artifact_revision',
        columns: [
          { name: 'artifactId', type: 'varchar', length: '36', isPrimary: true },
          { name: 'revision', type: 'integer', isPrimary: true },
          { name: 'title', type: 'varchar', length: '200' },
          { name: 'content', type: 'text' },
          { name: 'updatedAt', type: 'varchar', length: '32' },
        ],
      }),
    );
  }

  async down() {
    throw new Error('Restoring earlier schema requires a backup of artifact revisions.');
  }
}
