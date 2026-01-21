import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class AddUserApprovalEntity1703123456790 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // user_approvals 테이블 생성
    await queryRunner.createTable(
      new Table({
        name: 'user_approvals',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'userId',
            type: 'uuid',
          },
          {
            name: 'applicationNote',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['pending', 'approved', 'rejected'],
            default: `'pending'`,
          },
          {
            name: 'reviewNote',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'rejectionReason',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'reviewedBy',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'reviewedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Foreign Keys 추가
    await queryRunner.createForeignKey(
      'user_approvals',
      new TableForeignKey({
        columnNames: ['userId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'user',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'user_approvals',
      new TableForeignKey({
        columnNames: ['reviewedBy'],
        referencedColumnNames: ['id'],
        referencedTableName: 'user',
        onDelete: 'SET NULL',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('user_approvals');
    
    // Foreign Keys 제거
    const userIdForeignKey = table.foreignKeys.find(
      fk => fk.columnNames.indexOf('userId') !== -1,
    );
    const reviewedByForeignKey = table.foreignKeys.find(
      fk => fk.columnNames.indexOf('reviewedBy') !== -1,
    );

    if (userIdForeignKey) {
      await queryRunner.dropForeignKey('user_approvals', userIdForeignKey);
    }
    if (reviewedByForeignKey) {
      await queryRunner.dropForeignKey('user_approvals', reviewedByForeignKey);
    }

    // 테이블 삭제
    await queryRunner.dropTable('user_approvals');
  }
}