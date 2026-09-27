import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';
import { Widget } from '../widget/entities/widget.entity';

/**
 * Widget.databaseId 컬럼 추가 (위젯 소유권 판정용).
 * 이미 존재하면 건너뛴다(idempotent).
 */
export class AddWidgetDatabaseId1700000000004 implements MigrationInterface {
  name = 'AddWidgetDatabaseId1700000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = queryRunner.connection.getMetadata(Widget).tableName;
    if (await queryRunner.hasColumn(table, 'databaseId')) return;

    await queryRunner.addColumn(
      table,
      new TableColumn({ name: 'databaseId', type: 'integer', isNullable: true }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = queryRunner.connection.getMetadata(Widget).tableName;
    if (await queryRunner.hasColumn(table, 'databaseId')) {
      await queryRunner.dropColumn(table, 'databaseId');
    }
  }
}
