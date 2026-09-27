import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';
import { Component } from '../component/entities/component.entity';

/**
 * component.useYn 을 char(1) → varchar(1) 로 변경.
 * MySQL 등 char 를 지원하는 DB 에서만 동작하며, 이미 varchar 면 건너뛴다(idempotent).
 */
export class ComponentUseYnVarchar1700000000002 implements MigrationInterface {
  name = 'ComponentUseYnVarchar1700000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = queryRunner.connection.getMetadata(Component).tableName;
    const column = (await queryRunner.getTable(table))?.findColumnByName('useYn');
    if (!column || String(column.type).toLowerCase() !== 'char') return;

    await queryRunner.changeColumn(
      table,
      'useYn',
      new TableColumn({
        name: 'useYn',
        type: 'varchar',
        length: '1',
        default: "'Y'",
        isNullable: false,
      }),
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  public async down(): Promise<void> {
    // char 로 되돌리는 것은 데이터 손실 위험이 있어 지원하지 않는다.
  }
}
