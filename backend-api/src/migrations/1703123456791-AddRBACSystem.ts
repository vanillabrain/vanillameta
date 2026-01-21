import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRBACSystem1703123456791 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // roles 테이블 수정
    await queryRunner.query(`
      DROP TABLE IF EXISTS roles;
    `);

    await queryRunner.query(`
      CREATE TABLE roles (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        displayName VARCHAR(255) NOT NULL,
        description TEXT,
        level INTEGER DEFAULT 0,
        isActive BOOLEAN DEFAULT 1,
        isDefault BOOLEAN DEFAULT 0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // permissions 테이블 생성
    await queryRunner.query(`
      CREATE TABLE permissions (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        displayName VARCHAR(255) NOT NULL,
        description TEXT,
        module VARCHAR(255) NOT NULL,
        action VARCHAR(255) NOT NULL,
        resource VARCHAR(255) NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // role_permissions 중간 테이블 생성
    await queryRunner.query(`
      CREATE TABLE role_permissions (
        roleId VARCHAR(36) NOT NULL,
        permissionId VARCHAR(36) NOT NULL,
        PRIMARY KEY (roleId, permissionId),
        FOREIGN KEY (roleId) REFERENCES roles(id) ON DELETE CASCADE,
        FOREIGN KEY (permissionId) REFERENCES permissions(id) ON DELETE CASCADE
      );
    `);

    // user_roles 테이블 재생성 (기존 테이블 수정)
    await queryRunner.query(`
      DROP TABLE IF EXISTS user_roles;
    `);

    await queryRunner.query(`
      CREATE TABLE user_roles (
        id VARCHAR(36) PRIMARY KEY,
        userId INTEGER NOT NULL,
        roleId VARCHAR(36) NOT NULL,
        expiresAt DATETIME,
        isActive BOOLEAN DEFAULT 1,
        assignedById INTEGER,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (roleId) REFERENCES roles(id) ON DELETE CASCADE,
        FOREIGN KEY (assignedById) REFERENCES users(id) ON DELETE SET NULL
      );
    `);

    // 인덱스 생성
    await queryRunner.query(`
      CREATE INDEX IDX_USER_ROLES_USER_ID ON user_roles(userId);
    `);
    await queryRunner.query(`
      CREATE INDEX IDX_USER_ROLES_ROLE_ID ON user_roles(roleId);
    `);
    await queryRunner.query(`
      CREATE INDEX IDX_USER_ROLES_ACTIVE ON user_roles(isActive);
    `);
    await queryRunner.query(`
      CREATE INDEX IDX_PERMISSIONS_MODULE ON permissions(module);
    `);
    await queryRunner.query(`
      CREATE INDEX IDX_PERMISSIONS_ACTION ON permissions(action);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS role_permissions;`);
    await queryRunner.query(`DROP TABLE IF EXISTS user_roles;`);
    await queryRunner.query(`DROP TABLE IF EXISTS permissions;`);
    await queryRunner.query(`DROP TABLE IF EXISTS roles;`);
  }
}