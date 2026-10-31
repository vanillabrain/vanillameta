import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class AddDocumentShare1793540000000 implements MigrationInterface {
  name = 'AddDocumentShare1793540000000';
  async up(runner: QueryRunner): Promise<void> {
    if (!(await runner.hasTable('document_share'))) {
      await runner.createTable(
        new Table({
          name: 'document_share',
          columns: [
            { name: 'id', type: 'varchar', length: '36', isPrimary: true },
            { name: 'documentId', type: 'varchar', length: '36' },
            { name: 'ownerId', type: 'integer' },
            { name: 'organizationId', type: 'integer' },
            { name: 'granteeId', type: 'integer' },
            { name: 'active', type: 'boolean', default: true },
            { name: 'createdAt', type: 'varchar', length: '30' },
            { name: 'revokedAt', type: 'varchar', length: '30', isNullable: true },
          ],
          indices: [
            new TableIndex({ name: 'UQ_document_share_grantee', columnNames: ['documentId', 'granteeId'], isUnique: true }),
            new TableIndex({ name: 'IDX_document_share_grantee', columnNames: ['granteeId', 'organizationId', 'active'] }),
          ],
        }),
      );
    }
  }
  async down(): Promise<void> {
    throw new Error('document_share rollback requires a reviewed backup plan.');
  }
}

