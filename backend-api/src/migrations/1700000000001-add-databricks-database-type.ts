import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Databricks 데이터소스 타입 추가 (Statement Execution API 엔진)
 */
export class AddDatabricksDatabaseType1700000000001 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    const existing = await queryRunner.query(
      `SELECT id FROM databaseType WHERE type = 'databricks' LIMIT 1`,
    );
    if (existing.length > 0) return;
    await queryRunner.query(
      `INSERT INTO databaseType (engine, type, title, seq, useYn, createdAt, updatedAt)
       VALUES ('databricks', 'databricks', 'Databricks', 16, 'Y', NOW(), NOW())`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM databaseType WHERE type = 'databricks'`);
  }
}
