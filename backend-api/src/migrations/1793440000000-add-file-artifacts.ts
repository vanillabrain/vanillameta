import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class AddFileArtifacts1793440000000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    if (!(await runner.hasTable('artifact_file')))
      await runner.createTable(
        new Table({
          name: 'artifact_file',
          columns: [
            { name: 'id', type: 'varchar', length: '36', isPrimary: true },
            { name: 'ownerId', type: 'integer' },
            { name: 'organizationId', type: 'integer', isNullable: true },
            { name: 'kind', type: 'varchar', length: '8' },
            { name: 'title', type: 'varchar', length: '200' },
            { name: 'headVersion', type: 'integer' },
            { name: 'revision', type: 'integer' },
            { name: 'updatedAt', type: 'varchar', length: '32' },
            { name: 'deletedAt', type: 'varchar', length: '32', isNullable: true },
            { name: 'shareHash', type: 'varchar', length: '64', isNullable: true },
            { name: 'shareExpiresAt', type: 'varchar', length: '32', isNullable: true },
          ],
          indices: [
            new TableIndex({ name: 'IDX_artifact_file_owner', columnNames: ['ownerId'] }),
            new TableIndex({
              name: 'UQ_artifact_file_share',
              columnNames: ['shareHash'],
              isUnique: true,
            }),
          ],
        }),
      );
    if (!(await runner.hasTable('artifact_file_version')))
      await runner.createTable(
        new Table({
          name: 'artifact_file_version',
          columns: [
            { name: 'artifactId', type: 'varchar', length: '36', isPrimary: true },
            { name: 'version', type: 'integer', isPrimary: true },
            { name: 'originalName', type: 'varchar', length: '255' },
            { name: 'mimeType', type: 'varchar', length: '100' },
            { name: 'extension', type: 'varchar', length: '8' },
            { name: 'byteSize', type: 'integer' },
            { name: 'sha256', type: 'varchar', length: '64' },
            { name: 'storageKey', type: 'varchar', length: '100' },
            { name: 'createdAt', type: 'varchar', length: '32' },
          ],
          foreignKeys: [
            new TableForeignKey({
              name: 'FK_artifact_version_file',
              columnNames: ['artifactId'],
              referencedTableName: 'artifact_file',
              referencedColumnNames: ['id'],
              onDelete: 'RESTRICT',
            }),
          ],
        }),
      );
  }

  async down(runner: QueryRunner): Promise<void> {
    if (await runner.hasTable('artifact_file_version'))
      await runner.dropTable('artifact_file_version');
    if (await runner.hasTable('artifact_file')) await runner.dropTable('artifact_file');
  }
}
