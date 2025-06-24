import { DataSource } from 'typeorm';
import { Role } from '../../modules/admin/entities/role.entity';
import { Permission } from '../../modules/admin/entities/permission.entity';

export class RBACSeeder {
  static async seed(dataSource: DataSource) {
    await this.createPermissions(dataSource);
    await this.createRoles(dataSource);
    await this.assignPermissionsToRoles(dataSource);
  }

  private static async createPermissions(dataSource: DataSource) {
    const permissions = [
      // Admin 모듈 권한
      { name: 'admin.access', displayName: 'Admin 접근', module: 'admin', action: 'access', resource: 'system', description: '관리자 페이지 접근' },
      { name: 'admin.dashboard.view', displayName: 'Admin 대시보드 조회', module: 'admin', action: 'view', resource: 'dashboard', description: '관리자 대시보드 조회' },
      
      // 사용자 관리 권한
      { name: 'admin.users.view', displayName: '사용자 조회', module: 'admin', action: 'view', resource: 'users', description: '사용자 목록 조회' },
      { name: 'admin.users.create', displayName: '사용자 생성', module: 'admin', action: 'create', resource: 'users', description: '새 사용자 생성' },
      { name: 'admin.users.edit', displayName: '사용자 수정', module: 'admin', action: 'edit', resource: 'users', description: '사용자 정보 수정' },
      { name: 'admin.users.delete', displayName: '사용자 삭제', module: 'admin', action: 'delete', resource: 'users', description: '사용자 계정 삭제' },
      { name: 'admin.users.approve', displayName: '사용자 승인', module: 'admin', action: 'approve', resource: 'users', description: '사용자 가입 승인' },
      
      // 역할 관리 권한
      { name: 'admin.roles.view', displayName: '역할 조회', module: 'admin', action: 'view', resource: 'roles', description: '역할 목록 조회' },
      { name: 'admin.roles.create', displayName: '역할 생성', module: 'admin', action: 'create', resource: 'roles', description: '새 역할 생성' },
      { name: 'admin.roles.edit', displayName: '역할 수정', module: 'admin', action: 'edit', resource: 'roles', description: '역할 정보 수정' },
      { name: 'admin.roles.delete', displayName: '역할 삭제', module: 'admin', action: 'delete', resource: 'roles', description: '역할 삭제' },
      { name: 'admin.roles.assign', displayName: '역할 할당', module: 'admin', action: 'assign', resource: 'roles', description: '사용자에게 역할 할당' },
      
      // 감사 로그 권한
      { name: 'admin.audit.view', displayName: '감사 로그 조회', module: 'admin', action: 'view', resource: 'audit', description: '감사 로그 조회' },
      { name: 'admin.audit.export', displayName: '감사 로그 내보내기', module: 'admin', action: 'export', resource: 'audit', description: '감사 로그 내보내기' },
      
      // 일반 애플리케이션 권한
      { name: 'app.dashboard.view', displayName: '대시보드 조회', module: 'app', action: 'view', resource: 'dashboard', description: '대시보드 조회' },
      { name: 'app.reports.view', displayName: '리포트 조회', module: 'app', action: 'view', resource: 'reports', description: '리포트 조회' },
      { name: 'app.reports.create', displayName: '리포트 생성', module: 'app', action: 'create', resource: 'reports', description: '리포트 생성' },
      { name: 'app.reports.edit', displayName: '리포트 수정', module: 'app', action: 'edit', resource: 'reports', description: '리포트 수정' },
      { name: 'app.reports.delete', displayName: '리포트 삭제', module: 'app', action: 'delete', resource: 'reports', description: '리포트 삭제' },
      { name: 'app.reports.share', displayName: '리포트 공유', module: 'app', action: 'share', resource: 'reports', description: '리포트 공유' },
      
      // 데이터 소스 권한
      { name: 'app.datasources.view', displayName: '데이터소스 조회', module: 'app', action: 'view', resource: 'datasources', description: '데이터소스 조회' },
      { name: 'app.datasources.create', displayName: '데이터소스 생성', module: 'app', action: 'create', resource: 'datasources', description: '데이터소스 생성' },
      { name: 'app.datasources.edit', displayName: '데이터소스 수정', module: 'app', action: 'edit', resource: 'datasources', description: '데이터소스 수정' },
      { name: 'app.datasources.delete', displayName: '데이터소스 삭제', module: 'app', action: 'delete', resource: 'datasources', description: '데이터소스 삭제' },
    ];

    const permissionRepository = dataSource.getRepository(Permission);
    
    for (const permData of permissions) {
      const existing = await permissionRepository.findOne({
        where: { name: permData.name },
      });
      
      if (!existing) {
        const permission = permissionRepository.create(permData);
        await permissionRepository.save(permission);
      }
    }
  }

  private static async createRoles(dataSource: DataSource) {
    const roles = [
      {
        name: 'super_admin',
        displayName: 'Super Admin',
        description: '모든 권한을 가진 최고 관리자',
        level: 100,
        isDefault: false,
      },
      {
        name: 'admin',
        displayName: 'Admin',
        description: '관리자 권한 (사용자 관리, 시스템 설정)',
        level: 80,
        isDefault: false,
      },
      {
        name: 'manager',
        displayName: 'Manager',
        description: '매니저 권한 (팀 관리, 리포트 관리)',
        level: 60,
        isDefault: false,
      },
      {
        name: 'editor',
        displayName: 'Editor',
        description: '편집자 권한 (리포트 생성/수정)',
        level: 40,
        isDefault: true,
      },
      {
        name: 'viewer',
        displayName: 'Viewer',
        description: '조회 권한만 가진 일반 사용자',
        level: 20,
        isDefault: false,
      },
    ];

    const roleRepository = dataSource.getRepository(Role);
    
    for (const roleData of roles) {
      const existing = await roleRepository.findOne({
        where: { name: roleData.name },
      });
      
      if (!existing) {
        const role = roleRepository.create(roleData);
        await roleRepository.save(role);
      }
    }
  }

  private static async assignPermissionsToRoles(dataSource: DataSource) {
    const roleRepository = dataSource.getRepository(Role);
    const permissionRepository = dataSource.getRepository(Permission);

    // Super Admin - 모든 권한
    const superAdmin = await roleRepository.findOne({ where: { name: 'super_admin' } });
    if (superAdmin) {
      const allPermissions = await permissionRepository.find();
      superAdmin.permissions = allPermissions;
      await roleRepository.save(superAdmin);
    }

    // Admin - 관리자 권한
    const admin = await roleRepository.findOne({ where: { name: 'admin' } });
    if (admin) {
      const adminPermissions = await permissionRepository.find({
        where: [
          { module: 'admin' },
          { name: In(['app.dashboard.view', 'app.reports.view']) },
        ],
      });
      admin.permissions = adminPermissions;
      await roleRepository.save(admin);
    }

    // Manager - 매니저 권한
    const manager = await roleRepository.findOne({ where: { name: 'manager' } });
    if (manager) {
      const managerPermissions = await permissionRepository.find({
        where: {
          name: In([
            'app.dashboard.view',
            'app.reports.view',
            'app.reports.create',
            'app.reports.edit',
            'app.reports.share',
            'app.datasources.view',
            'app.datasources.create',
          ]),
        },
      });
      manager.permissions = managerPermissions;
      await roleRepository.save(manager);
    }

    // Editor - 편집자 권한
    const editor = await roleRepository.findOne({ where: { name: 'editor' } });
    if (editor) {
      const editorPermissions = await permissionRepository.find({
        where: {
          name: In([
            'app.dashboard.view',
            'app.reports.view',
            'app.reports.create',
            'app.reports.edit',
            'app.datasources.view',
          ]),
        },
      });
      editor.permissions = editorPermissions;
      await roleRepository.save(editor);
    }

    // Viewer - 조회 권한
    const viewer = await roleRepository.findOne({ where: { name: 'viewer' } });
    if (viewer) {
      const viewerPermissions = await permissionRepository.find({
        where: {
          name: In([
            'app.dashboard.view',
            'app.reports.view',
          ]),
        },
      });
      viewer.permissions = viewerPermissions;
      await roleRepository.save(viewer);
    }
  }
}