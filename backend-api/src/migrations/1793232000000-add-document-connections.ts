import { MigrationInterface, QueryRunner, Table } from 'typeorm';
export class AddDocumentConnections1793232000000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    if (!(await runner.hasTable('document_connection')))
      await runner.createTable(
        new Table({
          name: 'document_connection',
          indices: [
            {
              name: 'UQ_document_owner_org_file',
              columnNames: ['ownerId', 'organizationId', 'fileId'],
              isUnique: true,
            },
          ],
          columns: [
            { name: 'id', type: 'varchar', length: '36', isPrimary: true },
            { name: 'ownerId', type: 'integer', isPrimary: false },
            { name: 'organizationId', type: 'integer', isPrimary: false },
            { name: 'fileId', type: 'varchar', length: '200', isPrimary: false },
          { name: 'provider', type: 'varchar', length: '20', default: "'google'" },
            { name: 'title', type: 'varchar', length: '1000', isPrimary: false },
            { name: 'currentVersion', type: 'integer', isPrimary: false },
            { name: 'generation', type: 'integer', isPrimary: false },
            { name: 'credentialEpoch', type: 'integer', isPrimary: false },
            { name: 'credentials', type: 'text', isPrimary: false },
            { name: 'connected', type: 'boolean', isPrimary: false },
            { name: 'updatedAt', type: 'varchar', length: '30', isPrimary: false },
          ],
          foreignKeys: [
            {
              columnNames: ['ownerId'],
              referencedTableName: 'user',
              referencedColumnNames: ['id'],
              onDelete: 'RESTRICT',
            },
            {
              columnNames: ['organizationId'],
              referencedTableName: 'enterprise_organization',
              referencedColumnNames: ['id'],
              onDelete: 'RESTRICT',
            },
          ],
        }),
      );
    if (!(await runner.hasTable('document_authorization')))
      await runner.createTable(
        new Table({
          name: 'document_authorization',
          columns: [
            { name: 'id', type: 'varchar', length: '64', isPrimary: true },
            { name: 'documentId', type: 'varchar', length: '36', isPrimary: false },
            { name: 'ownerId', type: 'integer', isPrimary: false },
            { name: 'organizationId', type: 'integer', isPrimary: false },
            { name: 'epoch', type: 'integer', isPrimary: false },
            { name: 'generation', type: 'integer', isPrimary: false },
            { name: 'fileId', type: 'varchar', length: '200', isPrimary: false },
            { name: 'status', type: 'varchar', length: '16', isPrimary: false },
            { name: 'verifier', type: 'text', isPrimary: false },
            { name: 'expiresAt', type: 'varchar', length: '30', isPrimary: false },
          ],
          foreignKeys: [
            {
              columnNames: ['ownerId'],
              referencedTableName: 'user',
              referencedColumnNames: ['id'],
              onDelete: 'RESTRICT',
            },
            {
              columnNames: ['organizationId'],
              referencedTableName: 'enterprise_organization',
              referencedColumnNames: ['id'],
              onDelete: 'RESTRICT',
            },
          ],
        }),
      );
    if (!(await runner.hasTable('document_refresh')))
      await runner.createTable(
        new Table({
          name: 'document_refresh',
          columns: [
            { name: 'documentId', type: 'varchar', length: '36', isPrimary: true },
            { name: 'requestId', type: 'varchar', length: '36', isPrimary: true },
            { name: 'expectedVersion', type: 'integer', isPrimary: false },
            { name: 'generation', type: 'integer', isPrimary: false },
            { name: 'epoch', type: 'integer', isPrimary: false },
            { name: 'status', type: 'varchar', length: '16', isPrimary: false },
            { name: 'token', type: 'varchar', length: '36', isPrimary: false },
            { name: 'leaseUntil', type: 'varchar', length: '30', isPrimary: false },
            { name: 'result', type: 'text', isPrimary: false },
          ],
          foreignKeys: [
            {
              columnNames: ['documentId'],
              referencedTableName: 'document_connection',
              referencedColumnNames: ['id'],
              onDelete: 'RESTRICT',
            },
          ],
        }),
      );
    if (!(await runner.hasTable('document_version')))
      await runner.createTable(
        new Table({
          name: 'document_version',
          columns: [
            { name: 'documentId', type: 'varchar', length: '36', isPrimary: true },
            { name: 'version', type: 'integer', isPrimary: true },
            { name: 'sourceVersion', type: 'varchar', length: '200', isPrimary: false },
            { name: 'sourceModifiedAt', type: 'varchar', length: '30', isPrimary: false },
            { name: 'capturedAt', type: 'varchar', length: '30', isPrimary: false },
            { name: 'sha256', type: 'varchar', length: '64', isPrimary: false },
            { name: 'byteSize', type: 'integer', isPrimary: false },
          ],
          foreignKeys: [
            {
              columnNames: ['documentId'],
              referencedTableName: 'document_connection',
              referencedColumnNames: ['id'],
              onDelete: 'RESTRICT',
            },
          ],
        }),
      );
    if (!(await runner.hasTable('document_chunk')))
      await runner.createTable(
        new Table({
          name: 'document_chunk',
          columns: [
            { name: 'documentId', type: 'varchar', length: '36', isPrimary: true },
            { name: 'version', type: 'integer', isPrimary: true },
            { name: 'position', type: 'integer', isPrimary: true },
            { name: 'content', type: 'text', isPrimary: false },
          ],
          foreignKeys: [
            {
              columnNames: ['documentId'],
              referencedTableName: 'document_connection',
              referencedColumnNames: ['id'],
              onDelete: 'RESTRICT',
            },
          ],
        }),
      );
  }
  async down(): Promise<void> {
    throw new Error('Document rollback requires a reviewed backup plan.');
  }
}
