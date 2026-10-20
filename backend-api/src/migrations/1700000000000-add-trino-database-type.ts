import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Trino 데이터소스 타입 추가 (HTTP 인터페이스 엔진)
 */
export class AddTrinoDatabaseType1700000000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    const existing = await queryRunner.query(
      `SELECT id FROM databaseType WHERE type = 'trino' LIMIT 1`,
    );
    if (existing.length > 0) return;
    await queryRunner.query(
      `INSERT INTO databaseType (engine, type, title, seq, useYn, createdAt, updatedAt)
       VALUES ('trino', 'trino', 'Trino', 15, 'Y', NOW(), NOW())`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM databaseType WHERE type = 'trino'`);
  }
}
