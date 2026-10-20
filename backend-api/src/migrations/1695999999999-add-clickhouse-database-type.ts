import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ClickHouse 데이터소스 타입 추가 (HTTP 인터페이스 엔진)
 */
export class AddClickhouseDatabaseType1695999999999 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    const existing = await queryRunner.query(
      `SELECT id FROM databaseType WHERE type = 'clickhouse' LIMIT 1`,
    );
    if (existing.length > 0) return;
    await queryRunner.query(
      `INSERT INTO databaseType (engine, type, title, seq, useYn, createdAt, updatedAt)
       VALUES ('clickhouse', 'clickhouse', 'ClickHouse', 14, 'Y', NOW(), NOW())`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM databaseType WHERE type = 'clickhouse'`);
  }
}
