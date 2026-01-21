import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { AdminRolesService } from '../admin-roles.service';
import { Role } from '../entities/role.entity';
import { Permission } from '../entities/permission.entity';
import { User } from '../../../user/entities/user.entity';
import { UserRole } from '../entities/user-role.entity';
import { RBACService } from '../rbac.service';
import { AuditLogService } from '../audit-log.service';

describe('AdminRolesService', () => {
  let service: AdminRolesService;
  let roleRepository: Repository<Role>;
  let permissionRepository: Repository<Permission>;
  let userRepository: Repository<User>;
  let userRoleRepository: Repository<UserRole>;
  let rbacService: RBACService;
  let auditLogService: AuditLogService;

  const mockRole = {
    id: '1',
    name: 'test_role',
    displayName: 'Test Role',
    description: 'Test role description',
    level: 50,
    isActive: true,
    isDefault: false,
    permissions: [],
    users: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPermission = {
    id: '1',
    name: 'admin.users.view',
    displayName: '사용자 조회',
    description: '사용자 목록을 조회할 수 있습니다',
    module: 'admin',
    resource: 'users',
    action: 'view',
  };

  const mockUser = {
    id: 1,
    name: 'Test User',
    email: 'test@example.com',
    roles: [],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminRolesService,
        {
          provide: getRepositoryToken(Role),
          useValue: {
            createQueryBuilder: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            remove: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Permission),
          useValue: {
            findByIds: jest.fn(),
            find: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            findByIds: jest.fn(),
            find: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(UserRole),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            remove: jest.fn(),
          },
        },
        {
          provide: RBACService,
          useValue: {
            invalidateUserPermissionsCache: jest.fn(),
          },
        },
        {
          provide: AuditLogService,
          useValue: {
            createAuditLog: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AdminRolesService>(AdminRolesService);
    roleRepository = module.get<Repository<Role>>(getRepositoryToken(Role));
    permissionRepository = module.get<Repository<Permission>>(getRepositoryToken(Permission));
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    userRoleRepository = module.get<Repository<UserRole>>(getRepositoryToken(UserRole));
    rbacService = module.get<RBACService>(RBACService);
    auditLogService = module.get<AuditLogService>(AuditLogService);
  });

  describe('getRolesWithStats', () => {
    it('역할 목록을 통계와 함께 반환해야 한다', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        loadRelationCountAndMap: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([{ ...mockRole, userCount: 5 }]),
      };

      jest.spyOn(roleRepository, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any);

      const result = await service.getRolesWithStats({ search: 'test' });

      expect(result).toHaveLength(1);
      expect(result[0].userCount).toBe(5);
      expect(mockQueryBuilder.andWhere).toHaveBeenCalled();
    });
  });

  describe('getRoleDetail', () => {
    it('역할 상세 정보를 반환해야 한다', async () => {
      jest.spyOn(roleRepository, 'findOne').mockResolvedValue({
        ...mockRole,
        permissions: [mockPermission],
        users: [mockUser],
      } as any);

      const result = await service.getRoleDetail('1');

      expect(result.id).toBe('1');
      expect(result.permissions).toHaveLength(1);
      expect(result.users).toHaveLength(1);
    });

    it('역할이 없으면 NotFoundException을 발생시켜야 한다', async () => {
      jest.spyOn(roleRepository, 'findOne').mockResolvedValue(null);

      await expect(service.getRoleDetail('999')).rejects.toThrow(NotFoundException);
    });
  });

  describe('createRole', () => {
    it('새 역할을 생성해야 한다', async () => {
      jest.spyOn(roleRepository, 'findOne').mockResolvedValue(null);
      jest.spyOn(roleRepository, 'create').mockReturnValue(mockRole as any);
      jest.spyOn(roleRepository, 'save').mockResolvedValue(mockRole as any);
      jest.spyOn(permissionRepository, 'findByIds').mockResolvedValue([mockPermission] as any);

      const createDto = {
        name: 'new_role',
        displayName: 'New Role',
        description: 'New role description',
        level: 30,
        permissionIds: ['1'],
      };

      const result = await service.createRole(createDto, mockUser as any);

      expect(result.name).toBe(mockRole.name);
      expect(auditLogService.createAuditLog).toHaveBeenCalled();
    });

    it('이미 존재하는 역할명이면 BadRequestException을 발생시켜야 한다', async () => {
      jest.spyOn(roleRepository, 'findOne').mockResolvedValue(mockRole as any);

      const createDto = {
        name: 'test_role',
        displayName: 'Test Role',
      };

      await expect(service.createRole(createDto, mockUser as any)).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateRole', () => {
    it('역할 정보를 업데이트해야 한다', async () => {
      jest.spyOn(roleRepository, 'findOne').mockResolvedValue(mockRole as any);
      jest.spyOn(roleRepository, 'save').mockResolvedValue({
        ...mockRole,
        displayName: 'Updated Role',
      } as any);

      const updateDto = {
        displayName: 'Updated Role',
        description: 'Updated description',
      };

      const result = await service.updateRole('1', updateDto, mockUser as any);

      expect(result.displayName).toBe('Updated Role');
      expect(auditLogService.createAuditLog).toHaveBeenCalled();
    });

    it('시스템 기본 역할은 수정할 수 없어야 한다', async () => {
      jest.spyOn(roleRepository, 'findOne').mockResolvedValue({
        ...mockRole,
        name: 'super_admin',
      } as any);

      const updateDto = {
        displayName: 'Updated Role',
      };

      await expect(service.updateRole('1', updateDto, mockUser as any)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('deleteRole', () => {
    it('역할을 삭제해야 한다', async () => {
      jest.spyOn(roleRepository, 'findOne').mockResolvedValue(mockRole as any);
      jest.spyOn(roleRepository, 'remove').mockResolvedValue(mockRole as any);

      await service.deleteRole('1', mockUser as any);

      expect(roleRepository.remove).toHaveBeenCalledWith(mockRole);
      expect(auditLogService.createAuditLog).toHaveBeenCalled();
    });

    it('사용자가 할당된 역할은 삭제할 수 없어야 한다', async () => {
      jest.spyOn(roleRepository, 'findOne').mockResolvedValue({
        ...mockRole,
        users: [mockUser],
      } as any);

      await expect(service.deleteRole('1', mockUser as any)).rejects.toThrow(BadRequestException);
    });
  });

  describe('assignUsersToRole', () => {
    it('사용자를 역할에 할당해야 한다', async () => {
      jest.spyOn(roleRepository, 'findOne').mockResolvedValue(mockRole as any);
      jest.spyOn(userRepository, 'findByIds').mockResolvedValue([mockUser] as any);
      jest.spyOn(userRoleRepository, 'findOne').mockResolvedValue(null);
      jest.spyOn(userRoleRepository, 'create').mockReturnValue({} as any);
      jest.spyOn(userRoleRepository, 'save').mockResolvedValue({} as any);

      const assignDto = {
        userIds: ['1'],
      };

      await service.assignUsersToRole('1', assignDto, mockUser as any);

      expect(userRoleRepository.save).toHaveBeenCalled();
      expect(auditLogService.createAuditLog).toHaveBeenCalled();
    });

    it('존재하지 않는 사용자면 BadRequestException을 발생시켜야 한다', async () => {
      jest.spyOn(roleRepository, 'findOne').mockResolvedValue(mockRole as any);
      jest.spyOn(userRepository, 'findByIds').mockResolvedValue([]);

      const assignDto = {
        userIds: ['999'],
      };

      await expect(service.assignUsersToRole('1', assignDto, mockUser as any)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getGroupedPermissions', () => {
    it('그룹화된 권한을 반환해야 한다', async () => {
      jest.spyOn(permissionRepository, 'find').mockResolvedValue([mockPermission] as any);

      const result = await service.getGroupedPermissions();

      expect(result).toHaveProperty('admin');
      expect(result.admin).toHaveProperty('users');
      expect(result.admin.users).toHaveLength(1);
    });
  });

  describe('cloneRole', () => {
    it('역할을 복사해야 한다', async () => {
      jest.spyOn(roleRepository, 'findOne').mockResolvedValue({
        ...mockRole,
        permissions: [mockPermission],
      } as any);
      jest.spyOn(roleRepository, 'create').mockReturnValue({
        ...mockRole,
        name: 'cloned_role',
        displayName: 'Cloned Role',
      } as any);
      jest.spyOn(roleRepository, 'save').mockResolvedValue({
        ...mockRole,
        name: 'cloned_role',
        displayName: 'Cloned Role',
      } as any);

      const cloneDto = {
        name: 'cloned_role',
        displayName: 'Cloned Role',
      };

      const result = await service.cloneRole('1', cloneDto, mockUser as any);

      expect(result.name).toBe('cloned_role');
      expect(auditLogService.createAuditLog).toHaveBeenCalled();
    });
  });

  describe('getRoleDeletionImpact', () => {
    it('역할 삭제 영향도를 분석해야 한다', async () => {
      jest.spyOn(roleRepository, 'findOne').mockResolvedValue({
        ...mockRole,
        users: [mockUser],
      } as any);

      const result = await service.getRoleDeletionImpact('1');

      expect(result.affectedUserCount).toBe(1);
      expect(result.canDelete).toBe(false);
      expect(result.warnings).toContain('1명의 사용자가 영향받습니다');
    });

    it('기본 역할은 삭제할 수 없어야 한다', async () => {
      jest.spyOn(roleRepository, 'findOne').mockResolvedValue({
        ...mockRole,
        isDefault: true,
        users: [],
      } as any);

      const result = await service.getRoleDeletionImpact('1');

      expect(result.canDelete).toBe(false);
      expect(result.warnings).toContain('기본 역할은 삭제할 수 없습니다');
    });
  });
});