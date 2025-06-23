import { MigrationInterface, QueryRunner, Column, TableColumn, Table, TableForeignKey } from 'typeorm';

export class AddUserStatusAndRoles1703123456789 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // User 테이블에 새로운 컬럼 추가
        await queryRunner.addColumn('user', new TableColumn({
            name: 'name',
            type: 'varchar',
            length: '255',
            isNullable: true,
            comment: '사용자 이름'
        }));

        await queryRunner.addColumn('user', new TableColumn({
            name: 'status',
            type: 'enum',
            enum: ['active', 'inactive', 'pending', 'suspended', 'deleted'],
            default: "'pending'",
            comment: '사용자 상태'
        }));

        await queryRunner.addColumn('user', new TableColumn({
            name: 'avatar',
            type: 'varchar',
            isNullable: true,
            comment: '프로필 이미지 URL'
        }));

        await queryRunner.addColumn('user', new TableColumn({
            name: 'phone',
            type: 'varchar',
            isNullable: true,
            comment: '전화번호'
        }));

        await queryRunner.addColumn('user', new TableColumn({
            name: 'department',
            type: 'varchar',
            isNullable: true,
            comment: '부서'
        }));

        await queryRunner.addColumn('user', new TableColumn({
            name: 'lastLoginAt',
            type: 'timestamp',
            isNullable: true,
            comment: '마지막 로그인 시간'
        }));

        await queryRunner.addColumn('user', new TableColumn({
            name: 'emailVerifiedAt',
            type: 'timestamp',
            isNullable: true,
            comment: '이메일 인증 시간'
        }));

        await queryRunner.addColumn('user', new TableColumn({
            name: 'deletedAt',
            type: 'timestamp',
            isNullable: true,
            comment: '삭제일'
        }));

        // user_roles 조인 테이블 생성
        await queryRunner.createTable(new Table({
            name: 'user_roles',
            columns: [
                {
                    name: 'userId',
                    type: 'int',
                    isPrimary: true
                },
                {
                    name: 'roleId',
                    type: 'int',
                    isPrimary: true
                }
            ]
        }), true);

        // 외래 키 추가
        await queryRunner.createForeignKey('user_roles', new TableForeignKey({
            columnNames: ['userId'],
            referencedColumnNames: ['id'],
            referencedTableName: 'user',
            onDelete: 'CASCADE'
        }));

        await queryRunner.createForeignKey('user_roles', new TableForeignKey({
            columnNames: ['roleId'],
            referencedColumnNames: ['id'],
            referencedTableName: 'roles',
            onDelete: 'CASCADE'
        }));

        // 기존 사용자들의 status를 active로 업데이트
        await queryRunner.query(`UPDATE user SET status = 'active' WHERE status IS NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // 외래 키 삭제
        const table = await queryRunner.getTable('user_roles');
        const foreignKeys = table.foreignKeys;
        for (const foreignKey of foreignKeys) {
            await queryRunner.dropForeignKey('user_roles', foreignKey);
        }

        // user_roles 테이블 삭제
        await queryRunner.dropTable('user_roles');

        // User 테이블에서 컬럼 삭제
        await queryRunner.dropColumn('user', 'deletedAt');
        await queryRunner.dropColumn('user', 'emailVerifiedAt');
        await queryRunner.dropColumn('user', 'lastLoginAt');
        await queryRunner.dropColumn('user', 'department');
        await queryRunner.dropColumn('user', 'phone');
        await queryRunner.dropColumn('user', 'avatar');
        await queryRunner.dropColumn('user', 'status');
        await queryRunner.dropColumn('user', 'name');
    }
}