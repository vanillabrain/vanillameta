import { MigrationInterface, QueryRunner } from 'typeorm';

/** First PostgreSQL schema is synchronised from the canonical entities by migrate-prod. */
export class PostgresBaseline1793500000000 implements MigrationInterface {
  name = 'PostgresBaseline1793500000000';

  async up(_runner: QueryRunner): Promise<void> {
    // The baseline schema is materialized from entities before this record is inserted.
  }

  async down(_runner: QueryRunner): Promise<void> {
    throw new Error('The PostgreSQL baseline cannot be reverted');
  }
}
