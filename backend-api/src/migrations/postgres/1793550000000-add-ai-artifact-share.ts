import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class AddAiArtifactShare1793550000000 implements MigrationInterface {
  async up(runner: QueryRunner) {
    if (await runner.hasTable('ai_artifact_share')) return;
    await runner.createTable(new Table({
      name: 'ai_artifact_share',
      columns: [
        { name: 'artifactId', type: 'varchar', length: '36', isPrimary: true },
        { name: 'recipientId', type: 'integer', isPrimary: true },
        { name: 'ownerEpoch', type: 'integer' },
        { name: 'recipientEpoch', type: 'integer' },
      ],
      indices: [new TableIndex({ name: 'IDX_ai_artifact_share_recipient', columnNames: ['recipientId'] })],
    }));
  }
  async down(runner: QueryRunner) {
    await runner.dropTable('ai_artifact_share');
  }
}
