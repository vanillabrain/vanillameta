import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';
import { User } from '../user/entities/user.entity';

/**
 * User.role 컬럼 추가 (RBAC).
 * 이미 존재하면 건너뛴다(idempotent).
 */
export class AddUserRole1700000000000 implements MigrationInterface {
  name = 'AddUserRole1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = queryRunner.connection.getMetadata(User).tableName;
    if (await queryRunner.hasColumn(table, 'role')) return;

    await queryRunner.addColumn(
      table,
      new TableColumn({
        name: 'role',
        type: 'varchar',
        length: '20',
        default: "'user'",
        isNullable: false,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = queryRunner.connection.getMetadata(User).tableName;
    if (await queryRunner.hasColumn(table, 'role')) {
      await queryRunner.dropColumn(table, 'role');
    }
  }
}
