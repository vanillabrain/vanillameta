import { MigrationInterface, QueryRunner, Table } from 'typeorm';

/** Existing deployments already recorded the baseline, so the new summary table needs its own migration. */
export class AddDocumentSummary1793520000000 implements MigrationInterface {
  name = 'AddDocumentSummary1793520000000';

  async up(runner: QueryRunner): Promise<void> {
    if (await runner.hasTable('document_summary')) return;
    await runner.createTable(
      new Table({
        name: 'document_summary',
        columns: [
          { name: 'documentId', type: 'varchar', length: '36', isPrimary: true },
          { name: 'version', type: 'integer', isPrimary: true },
          { name: 'ownerId', type: 'integer' },
          { name: 'organizationId', type: 'integer' },
          { name: 'sourceSha256', type: 'varchar', length: '64' },
          { name: 'summary', type: 'text' },
          { name: 'generatedAt', type: 'varchar', length: '30' },
        ],
      }),
    );
  }

  async down(): Promise<void> {
    throw new Error('document_summary rollback requires a reviewed backup plan.');
  }
}
