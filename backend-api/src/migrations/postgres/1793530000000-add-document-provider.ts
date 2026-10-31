import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDocumentProvider1793530000000 implements MigrationInterface {
  name = 'AddDocumentProvider1793530000000';
  async up(runner: QueryRunner): Promise<void> {
    if (!(await runner.hasColumn('document_connection', 'provider')))
      await runner.query(
        "ALTER TABLE document_connection ADD COLUMN provider varchar(20) NOT NULL DEFAULT 'google'",
      );
  }
  async down(): Promise<void> {
    throw new Error('document provider rollback requires a reviewed backup plan.');
  }
}

