# T04_S08: RBAC 시스템 기초 구현

## 태스크 개요
- **태스크 ID**: T04_S08
- **태스크 명**: RBAC 시스템 기초 구현
- **스프린트**: S08 - Admin 핵심 기능 (Phase 1)
- **예상 소요**: 5일
- **우선순위**: 높음

## 목표
역할 기반 접근 제어(Role-Based Access Control) 시스템의 기초 인프라를 구축하여 세밀한 권한 관리가 가능한 시스템을 구현합니다.

## 상세 요구사항

### 1. Role 엔티티 및 기본 역할 생성
- 5개 기본 역할 정의 (Super Admin, Admin, Manager, Editor, Viewer)
- 역할별 설명 및 권한 범위 정의
- 역할 상속 구조 설계

### 2. Permission 엔티티 및 권한 정의
- 모듈별 권한 체계 구축
- 세분화된 권한 정의 (CRUD + 특수 권한)
- 권한 그룹화 및 카테고리 분류

### 3. User-Role 매핑 구현
- 사용자별 다중 역할 할당 지원
- 역할 할당 이력 추적
- 임시 역할 부여 기능

### 4. 권한 검증 미들웨어/가드 구현
- API 레벨 권한 검증
- 프론트엔드 권한 기반 UI 제어
- 권한 캐싱 시스템

## 기술적 구현 가이드

### Backend 구현 (NestJS)

#### 1. RBAC 관련 Entity 정의
```typescript
// src/entities/role.entity.ts
@Entity('roles')
export class Role {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string; // super_admin, admin, manager, editor, viewer

  @Column()
  displayName: string; // 표시용 이름

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'int', default: 0 })
  level: number; // 권한 레벨 (높을수록 상위 권한)

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  isDefault: boolean; // 기본 역할 여부

  @ManyToMany(() => Permission, (permission) => permission.roles)
  @JoinTable({
    name: 'role_permissions',
    joinColumn: { name: 'roleId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'permissionId', referencedColumnName: 'id' },
  })
  permissions: Permission[];

  @ManyToMany(() => User, (user) => user.roles)
  users: User[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

// src/entities/permission.entity.ts
@Entity('permissions')
export class Permission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string; // admin.users.create, dashboard.view, etc.

  @Column()
  displayName: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column()
  module: string; // admin, dashboard, analytics, etc.

  @Column()
  action: string; // create, read, update, delete, manage

  @Column()
  resource: string; // users, roles, reports, etc.

  @ManyToMany(() => Role, (role) => role.permissions)
  roles: Role[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

// src/entities/user-role.entity.ts (중간 테이블 확장)
@Entity('user_roles')
export class UserRole {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  userId: string;

  @Column('uuid')
  roleId: string;

  @ManyToOne(() => User, (user) => user.userRoles)
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => Role, (role) => role.userRoles)
  @JoinColumn({ name: 'roleId' })
  role: Role;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date; // 임시 역할 만료일

  @Column({ default: true })
  isActive: boolean;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'assignedBy' })
  assignedBy: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

#### 2. 기본 데이터 시딩
```typescript
// src/database/seeds/rbac.seed.ts
export class RBACSeeder {
  static async seed(connection: Connection) {
    await this.createPermissions(connection);
    await this.createRoles(connection);
    await this.assignPermissionsToRoles(connection);
  }

  private static async createPermissions(connection: Connection) {
    const permissions = [
      // Admin 모듈 권한
      { name: 'admin.access', displayName: 'Admin 접근', module: 'admin', action: 'access', resource: 'system' },
      { name: 'admin.dashboard.view', displayName: 'Admin 대시보드 조회', module: 'admin', action: 'view', resource: 'dashboard' },
      
      // 사용자 관리 권한
      { name: 'admin.users.view', displayName: '사용자 조회', module: 'admin', action: 'view', resource: 'users' },
      { name: 'admin.users.create', displayName: '사용자 생성', module: 'admin', action: 'create', resource: 'users' },
      { name: 'admin.users.edit', displayName: '사용자 수정', module: 'admin', action: 'edit', resource: 'users' },
      { name: 'admin.users.delete', displayName: '사용자 삭제', module: 'admin', action: 'delete', resource: 'users' },
      { name: 'admin.users.approve', displayName: '사용자 승인', module: 'admin', action: 'approve', resource: 'users' },
      
      // 역할 관리 권한
      { name: 'admin.roles.view', displayName: '역할 조회', module: 'admin', action: 'view', resource: 'roles' },
      { name: 'admin.roles.create', displayName: '역할 생성', module: 'admin', action: 'create', resource: 'roles' },
      { name: 'admin.roles.edit', displayName: '역할 수정', module: 'admin', action: 'edit', resource: 'roles' },
      { name: 'admin.roles.delete', displayName: '역할 삭제', module: 'admin', action: 'delete', resource: 'roles' },
      { name: 'admin.roles.assign', displayName: '역할 할당', module: 'admin', action: 'assign', resource: 'roles' },
      
      // 감사 로그 권한
      { name: 'admin.audit.view', displayName: '감사 로그 조회', module: 'admin', action: 'view', resource: 'audit' },
      { name: 'admin.audit.export', displayName: '감사 로그 내보내기', module: 'admin', action: 'export', resource: 'audit' },
      
      // 일반 애플리케이션 권한
      { name: 'app.dashboard.view', displayName: '대시보드 조회', module: 'app', action: 'view', resource: 'dashboard' },
      { name: 'app.reports.view', displayName: '리포트 조회', module: 'app', action: 'view', resource: 'reports' },
      { name: 'app.reports.create', displayName: '리포트 생성', module: 'app', action: 'create', resource: 'reports' },
      { name: 'app.reports.edit', displayName: '리포트 수정', module: 'app', action: 'edit', resource: 'reports' },
      { name: 'app.reports.delete', displayName: '리포트 삭제', module: 'app', action: 'delete', resource: 'reports' },
      { name: 'app.reports.share', displayName: '리포트 공유', module: 'app', action: 'share', resource: 'reports' },
      
      // 데이터 소스 권한
      { name: 'app.datasources.view', displayName: '데이터소스 조회', module: 'app', action: 'view', resource: 'datasources' },
      { name: 'app.datasources.create', displayName: '데이터소스 생성', module: 'app', action: 'create', resource: 'datasources' },
      { name: 'app.datasources.edit', displayName: '데이터소스 수정', module: 'app', action: 'edit', resource: 'datasources' },
      { name: 'app.datasources.delete', displayName: '데이터소스 삭제', module: 'app', action: 'delete', resource: 'datasources' },
    ];

    const permissionRepository = connection.getRepository(Permission);
    
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

  private static async createRoles(connection: Connection) {
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

    const roleRepository = connection.getRepository(Role);
    
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

  private static async assignPermissionsToRoles(connection: Connection) {
    const roleRepository = connection.getRepository(Role);
    const permissionRepository = connection.getRepository(Permission);

    // Super Admin - 모든 권한
    const superAdmin = await roleRepository.findOne({ where: { name: 'super_admin' } });
    const allPermissions = await permissionRepository.find();
    superAdmin.permissions = allPermissions;
    await roleRepository.save(superAdmin);

    // Admin - 관리자 권한
    const admin = await roleRepository.findOne({ where: { name: 'admin' } });
    const adminPermissions = await permissionRepository.find({
      where: [
        { module: 'admin' },
        { name: In(['app.dashboard.view', 'app.reports.view']) },
      ],
    });
    admin.permissions = adminPermissions;
    await roleRepository.save(admin);

    // Manager - 매니저 권한
    const manager = await roleRepository.findOne({ where: { name: 'manager' } });
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

    // Editor - 편집자 권한
    const editor = await roleRepository.findOne({ where: { name: 'editor' } });
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

    // Viewer - 조회 권한
    const viewer = await roleRepository.findOne({ where: { name: 'viewer' } });
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
```

#### 3. 권한 검증 가드 구현
```typescript
// src/guards/permission.guard.ts
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @Inject(CACHE_MANAGER)
    private cacheManager: Cache,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      'permissions',
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return false;
    }

    const userPermissions = await this.getUserPermissions(user.id);
    
    // 권한 확인 로직
    return this.checkPermissions(requiredPermissions, userPermissions);
  }

  private async getUserPermissions(userId: string): Promise<string[]> {
    const cacheKey = `user_permissions_${userId}`;
    
    let permissions = await this.cacheManager.get<string[]>(cacheKey);
    
    if (!permissions) {
      const user = await this.userRepository.findOne({
        where: { id: userId },
        relations: ['roles', 'roles.permissions'],
      });

      if (!user) {
        return [];
      }

      const permissionSet = new Set<string>();
      
      for (const role of user.roles) {
        for (const permission of role.permissions) {
          permissionSet.add(permission.name);
        }
      }

      permissions = Array.from(permissionSet);
      
      // 5분간 캐시
      await this.cacheManager.set(cacheKey, permissions, 300);
    }

    return permissions;
  }

  private checkPermissions(
    requiredPermissions: string[],
    userPermissions: string[],
  ): boolean {
    // AND 조건: 모든 권한이 있어야 함
    return requiredPermissions.every(permission =>
      userPermissions.includes(permission)
    );
  }
}

// src/decorators/permissions.decorator.ts
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata('permissions', permissions);

// src/decorators/require-any-permission.decorator.ts
export const RequireAnyPermission = (...permissions: string[]) =>
  SetMetadata('anyPermissions', permissions);
```

#### 4. RBAC 서비스 구현
```typescript
// src/modules/rbac/rbac.service.ts
@Injectable()
export class RBACService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Role)
    private roleRepository: Repository<Role>,
    @InjectRepository(Permission)
    private permissionRepository: Repository<Permission>,
    @InjectRepository(UserRole)
    private userRoleRepository: Repository<UserRole>,
    @Inject(CACHE_MANAGER)
    private cacheManager: Cache,
    private auditLogService: AuditLogService,
  ) {}

  async assignRoleToUser(
    userId: string,
    roleId: string,
    assignedBy: string,
    expiresAt?: Date,
  ): Promise<void> {
    // 기존 할당 확인
    const existingAssignment = await this.userRoleRepository.findOne({
      where: { userId, roleId, isActive: true },
    });

    if (existingAssignment) {
      throw new BadRequestException('이미 할당된 역할입니다');
    }

    const userRole = this.userRoleRepository.create({
      userId,
      roleId,
      assignedBy,
      expiresAt,
      isActive: true,
    });

    await this.userRoleRepository.save(userRole);

    // 캐시 무효화
    await this.invalidateUserPermissionsCache(userId);

    // 감사 로그 기록
    await this.auditLogService.log({
      action: 'ROLE_ASSIGNED',
      resourceType: 'User',
      resourceId: userId,
      userId: assignedBy,
      details: { roleId, expiresAt },
    });
  }

  async removeRoleFromUser(
    userId: string,
    roleId: string,
    removedBy: string,
  ): Promise<void> {
    const userRole = await this.userRoleRepository.findOne({
      where: { userId, roleId, isActive: true },
    });

    if (!userRole) {
      throw new NotFoundException('할당된 역할을 찾을 수 없습니다');
    }

    userRole.isActive = false;
    await this.userRoleRepository.save(userRole);

    // 캐시 무효화
    await this.invalidateUserPermissionsCache(userId);

    // 감사 로그 기록
    await this.auditLogService.log({
      action: 'ROLE_REMOVED',
      resourceType: 'User',
      resourceId: userId,
      userId: removedBy,
      details: { roleId },
    });
  }

  async getUserPermissions(userId: string): Promise<Permission[]> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['roles', 'roles.permissions'],
    });

    if (!user) {
      return [];
    }

    const permissionMap = new Map<string, Permission>();
    
    for (const role of user.roles) {
      for (const permission of role.permissions) {
        permissionMap.set(permission.id, permission);
      }
    }

    return Array.from(permissionMap.values());
  }

  async hasPermission(userId: string, permissionName: string): Promise<boolean> {
    const cacheKey = `user_permission_${userId}_${permissionName}`;
    
    let hasPermission = await this.cacheManager.get<boolean>(cacheKey);
    
    if (hasPermission === undefined) {
      const permissions = await this.getUserPermissions(userId);
      hasPermission = permissions.some(p => p.name === permissionName);
      
      // 5분간 캐시
      await this.cacheManager.set(cacheKey, hasPermission, 300);
    }

    return hasPermission;
  }

  async hasAnyPermission(userId: string, permissionNames: string[]): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId);
    const userPermissionNames = permissions.map(p => p.name);
    
    return permissionNames.some(name => userPermissionNames.includes(name));
  }

  async getUserRoles(userId: string): Promise<Role[]> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['roles'],
    });

    return user?.roles || [];
  }

  async getExpiredRoles(): Promise<UserRole[]> {
    return this.userRoleRepository.find({
      where: {
        expiresAt: LessThan(new Date()),
        isActive: true,
      },
      relations: ['user', 'role'],
    });
  }

  async cleanupExpiredRoles(): Promise<number> {
    const expiredRoles = await this.getExpiredRoles();
    
    if (expiredRoles.length === 0) {
      return 0;
    }

    await this.userRoleRepository.update(
      { id: In(expiredRoles.map(ur => ur.id)) },
      { isActive: false },
    );

    // 각 사용자의 권한 캐시 무효화
    const userIds = [...new Set(expiredRoles.map(ur => ur.userId))];
    await Promise.all(
      userIds.map(userId => this.invalidateUserPermissionsCache(userId)),
    );

    return expiredRoles.length;
  }

  private async invalidateUserPermissionsCache(userId: string): Promise<void> {
    const patterns = [
      `user_permissions_${userId}`,
      `user_permission_${userId}_*`,
    ];

    for (const pattern of patterns) {
      await this.cacheManager.del(pattern);
    }
  }
}
```

### Frontend 구현 (React)

#### 1. 권한 Hook 구현
```typescript
// src/hooks/usePermissions.ts
export const usePermissions = () => {
  const { user } = useAuth();
  
  const { data: permissions, isLoading } = useQuery({
    queryKey: ['user-permissions', user?.id],
    queryFn: () => authApiClient.getUserPermissions(),
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5분
  });

  const hasPermission = useCallback(
    (permission: string): boolean => {
      if (!permissions) return false;
      return permissions.some(p => p.name === permission);
    },
    [permissions],
  );

  const hasAnyPermission = useCallback(
    (permissionList: string[]): boolean => {
      if (!permissions) return false;
      return permissionList.some(permission => hasPermission(permission));
    },
    [permissions, hasPermission],
  );

  const hasAllPermissions = useCallback(
    (permissionList: string[]): boolean => {
      if (!permissions) return false;
      return permissionList.every(permission => hasPermission(permission));
    },
    [permissions, hasPermission],
  );

  return {
    permissions,
    isLoading,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
  };
};
```

#### 2. 권한 기반 컴포넌트
```typescript
// src/components/common/ProtectedComponent.tsx
interface ProtectedComponentProps {
  permission?: string;
  anyPermissions?: string[];
  allPermissions?: string[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export const ProtectedComponent: React.FC<ProtectedComponentProps> = ({
  permission,
  anyPermissions,
  allPermissions,
  fallback = null,
  children,
}) => {
  const { hasPermission, hasAnyPermission, hasAllPermissions } = usePermissions();

  let hasAccess = true;

  if (permission) {
    hasAccess = hasPermission(permission);
  } else if (anyPermissions) {
    hasAccess = hasAnyPermission(anyPermissions);
  } else if (allPermissions) {
    hasAccess = hasAllPermissions(allPermissions);
  }

  return hasAccess ? <>{children}</> : <>{fallback}</>;
};

// src/components/common/ProtectedRoute.tsx
interface ProtectedRouteProps {
  requiredPermission?: string;
  anyPermissions?: string[];
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  requiredPermission,
  anyPermissions,
  children,
}) => {
  const { hasPermission, hasAnyPermission, isLoading } = usePermissions();

  if (isLoading) {
    return <Loading />;
  }

  let hasAccess = true;

  if (requiredPermission) {
    hasAccess = hasPermission(requiredPermission);
  } else if (anyPermissions) {
    hasAccess = hasAnyPermission(anyPermissions);
  }

  if (!hasAccess) {
    return <AccessDenied />;
  }

  return <>{children}</>;
};
```

## 파일 구조
```
backend-api/src/
├── entities/
│   ├── role.entity.ts
│   ├── permission.entity.ts
│   └── user-role.entity.ts
├── modules/rbac/
│   ├── rbac.controller.ts
│   ├── rbac.service.ts
│   ├── rbac.module.ts
│   └── dto/
│       ├── assign-role.dto.ts
│       └── role-permission.dto.ts
├── guards/
│   └── permission.guard.ts
├── decorators/
│   ├── permissions.decorator.ts
│   └── require-any-permission.decorator.ts
└── database/seeds/
    └── rbac.seed.ts

frontend-web/src/
├── hooks/
│   └── usePermissions.ts
├── components/common/
│   ├── ProtectedComponent.tsx
│   ├── ProtectedRoute.tsx
│   └── AccessDenied.tsx
└── types/
    ├── role.types.ts
    └── permission.types.ts
```

## 테스트 케이스

### Backend 테스트
1. 역할 및 권한 생성/조회/수정/삭제
2. 사용자-역할 매핑 기능
3. 권한 검증 가드 동작
4. 권한 캐싱 시스템
5. 임시 역할 만료 처리
6. 권한 상속 로직

### Frontend 테스트
1. 권한 기반 컴포넌트 렌더링
2. 보호된 라우트 접근 제어
3. 권한 Hook 동작
4. 권한 변경 시 UI 업데이트

## 완료 기준
- [ ] Role 및 Permission 엔티티 구현
- [ ] 5개 기본 역할 및 권한 시딩
- [ ] 권한 검증 가드 동작
- [ ] 사용자-역할 매핑 기능 완성
- [ ] 권한 캐싱 시스템 구현
- [ ] 프론트엔드 권한 기반 UI 제어
- [ ] Unit 테스트 커버리지 85% 이상

## 의존성
- JWT 인증 시스템
- 캐싱 시스템 (Redis)
- 감사 로그 시스템
- 데이터베이스 마이그레이션

## 위험 요소 및 대응방안
- **위험**: 권한 확인으로 인한 성능 저하
  - **대응**: 권한 캐싱 및 쿼리 최적화
- **위험**: 복잡한 권한 구조로 인한 관리 어려움
  - **대응**: 권한 그룹화 및 명확한 문서화
- **위험**: 권한 변경 시 캐시 동기화 문제
  - **대응**: 캐시 무효화 전략 수립