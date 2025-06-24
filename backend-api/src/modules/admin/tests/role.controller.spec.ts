import { Test, TestingModule } from '@nestjs/testing';
import { RoleController } from '../role.controller';
import { AdminRolesService } from '../admin-roles.service';
import { RoleService } from '../role.service';
import { User } from '../../../user/entities/user.entity';

describe('RoleController', () => {
  let controller: RoleController;
  let adminRolesService: AdminRolesService;
  let roleService: RoleService;

  const mockUser: User = {
    id: 1,
    name: 'Test User',
    email: 'test@example.com',
  } as User;

  const mockRole = {
    id: '1',
    name: 'test_role',
    displayName: 'Test Role',
    description: 'Test role description',
    level: 50,
    isActive: true,
    isDefault: false,
    permissions: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockRoleWithStats = {
    ...mockRole,
    userCount: 5,
    permissionCount: 10,
  };

  const mockRoleDetail = {
    ...mockRole,
    permissions: [],
    users: [],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RoleController],
      providers: [
        {
          provide: AdminRolesService,
          useValue: {
            getRolesWithStats: jest.fn(),
            getRoleDetail: jest.fn(),
            createRole: jest.fn(),
            updateRole: jest.fn(),
            deleteRole: jest.fn(),
            getRolePermissions: jest.fn(),
            updateRolePermissions: jest.fn(),
            getRoleUsers: jest.fn(),
            assignUsersToRole: jest.fn(),
            removeUserFromRole: jest.fn(),
            getGroupedPermissions: jest.fn(),
            cloneRole: jest.fn(),
            getRoleDeletionImpact: jest.fn(),
          },
        },
        {
          provide: RoleService,
          useValue: {},
        },
      ],
    }).compile();

    controller = module.get<RoleController>(RoleController);
    adminRolesService = module.get<AdminRolesService>(AdminRolesService);
    roleService = module.get<RoleService>(RoleService);
  });

  describe('getRoles', () => {
    it('역할 목록을 반환해야 한다', async () => {
      jest.spyOn(adminRolesService, 'getRolesWithStats').mockResolvedValue([mockRoleWithStats]);

      const result = await controller.getRoles({ page: 1, limit: 10 });

      expect(result).toHaveLength(1);
      expect(result[0].userCount).toBe(5);
    });
  });

  describe('getRoleById', () => {
    it('역할 상세 정보를 반환해야 한다', async () => {
      jest.spyOn(adminRolesService, 'getRoleDetail').mockResolvedValue(mockRoleDetail as any);

      const result = await controller.getRoleById('1');

      expect(result.id).toBe('1');
    });
  });

  describe('createRole', () => {
    it('새 역할을 생성해야 한다', async () => {
      const createDto = {
        name: 'new_role',
        displayName: 'New Role',
        description: 'New role description',
        level: 30,
        permissionIds: ['1', '2'],
      };

      jest.spyOn(adminRolesService, 'createRole').mockResolvedValue(mockRole as any);

      const result = await controller.createRole(createDto, mockUser);

      expect(result).toEqual(mockRole);
      expect(adminRolesService.createRole).toHaveBeenCalledWith(createDto, mockUser);
    });
  });

  describe('updateRole', () => {
    it('역할 정보를 업데이트해야 한다', async () => {
      const updateDto = {
        displayName: 'Updated Role',
        description: 'Updated description',
      };

      jest.spyOn(adminRolesService, 'updateRole').mockResolvedValue({
        ...mockRole,
        displayName: 'Updated Role',
      } as any);

      const result = await controller.updateRole('1', updateDto, mockUser);

      expect(result.displayName).toBe('Updated Role');
    });
  });

  describe('deleteRole', () => {
    it('역할을 삭제해야 한다', async () => {
      jest.spyOn(adminRolesService, 'deleteRole').mockResolvedValue(undefined);

      await controller.deleteRole('1', mockUser);

      expect(adminRolesService.deleteRole).toHaveBeenCalledWith('1', mockUser);
    });
  });

  describe('getRolePermissions', () => {
    it('역할 권한을 반환해야 한다', async () => {
      const mockPermissions = [
        {
          id: '1',
          name: 'admin.users.view',
          displayName: '사용자 조회',
          description: '사용자 목록을 조회할 수 있습니다',
          module: 'admin',
          resource: 'users',
          action: 'view',
        },
      ];

      jest.spyOn(adminRolesService, 'getRolePermissions').mockResolvedValue(mockPermissions);

      const result = await controller.getRolePermissions('1');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('admin.users.view');
    });
  });

  describe('updateRolePermissions', () => {
    it('역할 권한을 업데이트해야 한다', async () => {
      const updateDto = {
        permissionIds: ['1', '2', '3'],
      };

      jest.spyOn(adminRolesService, 'updateRolePermissions').mockResolvedValue(undefined);

      await controller.updateRolePermissions('1', updateDto, mockUser);

      expect(adminRolesService.updateRolePermissions).toHaveBeenCalledWith('1', updateDto, mockUser);
    });
  });

  describe('getRoleUsers', () => {
    it('역할 사용자 목록을 반환해야 한다', async () => {
      const mockResponse = {
        data: [
          {
            id: '1',
            name: 'User 1',
            email: 'user1@example.com',
          },
        ],
        meta: {
          total: 1,
          page: 1,
          limit: 10,
          totalPages: 1,
        },
      };

      jest.spyOn(adminRolesService, 'getRoleUsers').mockResolvedValue(mockResponse);

      const result = await controller.getRoleUsers('1', { page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });
  });

  describe('assignUsersToRole', () => {
    it('사용자를 역할에 할당해야 한다', async () => {
      const assignDto = {
        userIds: ['1', '2'],
        expiresAt: '2024-12-31T23:59:59Z',
      };

      jest.spyOn(adminRolesService, 'assignUsersToRole').mockResolvedValue(undefined);

      await controller.assignUsersToRole('1', assignDto, mockUser);

      expect(adminRolesService.assignUsersToRole).toHaveBeenCalledWith('1', assignDto, mockUser);
    });
  });

  describe('removeUserFromRole', () => {
    it('사용자를 역할에서 제거해야 한다', async () => {
      jest.spyOn(adminRolesService, 'removeUserFromRole').mockResolvedValue(undefined);

      await controller.removeUserFromRole('1', '2', mockUser);

      expect(adminRolesService.removeUserFromRole).toHaveBeenCalledWith('1', '2', mockUser);
    });
  });

  describe('getGroupedPermissions', () => {
    it('그룹화된 권한을 반환해야 한다', async () => {
      const mockGroupedPermissions = {
        admin: {
          users: [
            {
              id: '1',
              name: 'admin.users.view',
              displayName: '사용자 조회',
              description: '사용자 목록을 조회할 수 있습니다',
              module: 'admin',
              resource: 'users',
              action: 'view',
            },
          ],
        },
      };

      jest.spyOn(adminRolesService, 'getGroupedPermissions').mockResolvedValue(mockGroupedPermissions);

      const result = await controller.getGroupedPermissions();

      expect(result).toHaveProperty('admin');
      expect(result.admin).toHaveProperty('users');
    });
  });

  describe('cloneRole', () => {
    it('역할을 복사해야 한다', async () => {
      const cloneDto = {
        name: 'cloned_role',
        displayName: 'Cloned Role',
        description: 'Cloned role description',
      };

      jest.spyOn(adminRolesService, 'cloneRole').mockResolvedValue({
        ...mockRole,
        id: '2',
        name: 'cloned_role',
        displayName: 'Cloned Role',
      } as any);

      const result = await controller.cloneRole('1', cloneDto, mockUser);

      expect(result.name).toBe('cloned_role');
    });
  });

  describe('getRoleDeletionImpact', () => {
    it('역할 삭제 영향도를 반환해야 한다', async () => {
      const mockImpact = {
        roleId: '1',
        roleName: 'test_role',
        affectedUserCount: 3,
        affectedUsers: [
          { id: '1', name: 'User 1', email: 'user1@example.com' },
          { id: '2', name: 'User 2', email: 'user2@example.com' },
          { id: '3', name: 'User 3', email: 'user3@example.com' },
        ],
        canDelete: false,
        warnings: ['3명의 사용자가 영향받습니다'],
      };

      jest.spyOn(adminRolesService, 'getRoleDeletionImpact').mockResolvedValue(mockImpact);

      const result = await controller.getRoleDeletionImpact('1');

      expect(result.affectedUserCount).toBe(3);
      expect(result.canDelete).toBe(false);
    });
  });
});