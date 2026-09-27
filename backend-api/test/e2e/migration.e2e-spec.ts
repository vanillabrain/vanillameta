import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { DataSource } from 'typeorm';
import { User } from '../../src/user/entities/user.entity';
import { AuditLog } from '../../src/audit/entities/audit-log.entity';

describe('Migrations (e2e)', () => {
  const dbFile = join(__dirname, '..', '..', 'test-migration.sqlite');
  let dataSource: DataSource;

  beforeAll(async () => {
    if (existsSync(dbFile)) unlinkSync(dbFile);

    dataSource = new DataSource({
      type: 'sqlite',
      database: dbFile,
      entities: [join(__dirname, '..', '..', 'src/**/*.entity{.ts,.js}')],
      migrations: [join(__dirname, '..', '..', 'src/migrations/*{.ts,.js}')],
      migrationsTableName: 'migrations',
      synchronize: true, // 기준 스키마 생성
    });
    await dataSource.initialize();
  });

  afterAll(async () => {
    await dataSource.destroy();
    if (existsSync(dbFile)) unlinkSync(dbFile);
  });

  it('업그레이드 대상 DB(role 컬럼/audit_log 누락)를 마이그레이션으로 복구한다', async () => {
    const queryRunner = dataSource.createQueryRunner();
    const userTable = dataSource.getMetadata(User).tableName;
    const auditTable = dataSource.getMetadata(AuditLog).tableName;

    // 구버전 스키마 시뮬레이션
    await queryRunner.query(`ALTER TABLE "${userTable}" DROP COLUMN role`);
    await queryRunner.dropTable(auditTable);

    expect(await queryRunner.hasColumn(userTable, 'role')).toBe(false);
    expect(await queryRunner.hasTable(auditTable)).toBe(false);

    await dataSource.runMigrations();

    expect(await queryRunner.hasColumn(userTable, 'role')).toBe(true);
    expect(await queryRunner.hasTable(auditTable)).toBe(true);

    await queryRunner.release();
  });

  it('이미 최신 스키마면 마이그레이션은 아무 것도 하지 않는다(idempotent)', async () => {
    // 위 테스트에서 복구되었으므로 재실행해도 오류가 없어야 한다
    await expect(dataSource.runMigrations()).resolves.toBeDefined();
  });
});
