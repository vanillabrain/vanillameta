import { MigrationInterface, QueryRunner, Table } from 'typeorm';
import { AuditLog } from '../audit/entities/audit-log.entity';

/**
 * 감사 로그 테이블 생성. 이미 존재하면 건너뛴다(idempotent).
 */
export class CreateAuditLog1700000000001 implements MigrationInterface {
  name = 'CreateAuditLog1700000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tableName = queryRunner.connection.getMetadata(AuditLog).tableName;
    if (await queryRunner.hasTable(tableName)) return;

    await queryRunner.createTable(
      new Table({
        name: tableName,
        columns: [
          { name: 'id', type: 'integer', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'actorId', type: 'integer', isNullable: true },
          { name: 'actorUserId', type: 'varchar', length: '255', isNullable: true },
          { name: 'method', type: 'varchar', length: '10', isNullable: false },
          { name: 'path', type: 'varchar', length: '500', isNullable: false },
          { name: 'action', type: 'varchar', length: '200', isNullable: true },
          { name: 'statusCode', type: 'integer', isNullable: true },
          { name: 'ip', type: 'varchar', length: '45', isNullable: true },
          { name: 'requestId', type: 'varchar', length: '64', isNullable: true },
          { name: 'createdAt', type: 'datetime', default: 'CURRENT_TIMESTAMP', isNullable: false },
        ],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tableName = queryRunner.connection.getMetadata(AuditLog).tableName;
    if (await queryRunner.hasTable(tableName)) {
      await queryRunner.dropTable(tableName);
    }
  }
}
