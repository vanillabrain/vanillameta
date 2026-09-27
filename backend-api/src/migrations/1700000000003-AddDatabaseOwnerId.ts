import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';
import { Database } from '../database/entities/database.entity';

/**
 * Database.ownerId 컬럼 추가 (데이터소스 소유권).
 * 이미 존재하면 건너뛴다(idempotent).
 */
export class AddDatabaseOwnerId1700000000003 implements MigrationInterface {
  name = 'AddDatabaseOwnerId1700000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = queryRunner.connection.getMetadata(Database).tableName;
    if (await queryRunner.hasColumn(table, 'ownerId')) return;

    await queryRunner.addColumn(
      table,
      new TableColumn({ name: 'ownerId', type: 'integer', isNullable: true }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = queryRunner.connection.getMetadata(Database).tableName;
    if (await queryRunner.hasColumn(table, 'ownerId')) {
      await queryRunner.dropColumn(table, 'ownerId');
    }
  }
}
