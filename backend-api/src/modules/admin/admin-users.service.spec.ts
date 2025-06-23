import { Test, TestingModule } from '@nestjs/testing';
import { AdminUsersService } from './admin-users.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { User, UserStatus } from '../../user/entities/user.entity';
import { GetUsersQueryDto, UserResponseDto, ApproveUserDto, RejectUserDto } from './dto/admin-users.dto';
import { createMockRepository, getRepositoryTokenFor } from '../../../test/test-helpers';

describe('AdminUsersService', () => {
  let service: AdminUsersService;
  let userRepository: jest.Mocked<Repository<User>>;

  const mockUser = {
    id: 1,
    userId: 'testuser123',
    email: 'test@example.com',
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-01'),
    roles: [],
  };

  const mockUser2 = {
    id: 2,
    userId: 'testuser456',
    email: 'test2@example.com',
    createdAt: new Date('2023-01-02'),
    updatedAt: new Date('2023-01-02'),
    roles: [],
  };

  const mockUsers = [mockUser, mockUser2];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminUsersService,
        {
          provide: getRepositoryTokenFor(User),
          useValue: createMockRepository<User>(),
        },
      ],
    }).compile();

    service = module.get<AdminUsersService>(AdminUsersService);
    userRepository = module.get(getRepositoryTokenFor(User));

    // Mock 초기화
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getUsers', () => {
    beforeEach(() => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        withDeleted: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn(),
      };
      userRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);
    });

    it('should return paginated users with default parameters', async () => {
      const query: GetUsersQueryDto = {};
      const queryBuilder = userRepository.createQueryBuilder();
      (queryBuilder.getManyAndCount as jest.Mock).mockResolvedValue([mockUsers, 2]);

      const result = await service.getUsers(query);

      expect(userRepository.createQueryBuilder).toHaveBeenCalledWith('user');
      expect(queryBuilder.leftJoinAndSelect).toHaveBeenCalledWith('user.roles', 'roles');
      expect(queryBuilder.withDeleted).toHaveBeenCalled();
      expect(queryBuilder.orderBy).toHaveBeenCalledWith('user.createdAt', 'DESC');
      expect(queryBuilder.skip).toHaveBeenCalledWith(0);
      expect(queryBuilder.take).toHaveBeenCalledWith(20);

      expect(result).toEqual({
        data: [
          {
            id: '1',
            userId: 'testuser123',
            email: 'test@example.com',
            name: 'testuser123',
            status: 'active',
            roles: ['user'],
            createdAt: mockUser.createdAt,
            updatedAt: mockUser.updatedAt,
            lastLoginAt: null,
          },
          {
            id: '2',
            userId: 'testuser456',
            email: 'test2@example.com',
            name: 'testuser456',
            status: 'active',
            roles: ['user'],
            createdAt: mockUser2.createdAt,
            updatedAt: mockUser2.updatedAt,
            lastLoginAt: null,
          },
        ],
        meta: {
          total: 2,
          page: 1,
          limit: 20,
          totalPages: 1,
        },
      });
    });

    it('should handle search functionality', async () => {
      const query: GetUsersQueryDto = { search: 'test@example.com' };
      const queryBuilder = userRepository.createQueryBuilder();
      (queryBuilder.getManyAndCount as jest.Mock).mockResolvedValue([[mockUser], 1]);

      await service.getUsers(query);

      expect(queryBuilder.where).toHaveBeenCalledWith(
        'user.email LIKE :search OR user.userId LIKE :search',
        { search: '%test@example.com%' }
      );
    });

    it('should handle custom pagination parameters', async () => {
      const query: GetUsersQueryDto = { page: 3, limit: 5 };
      const queryBuilder = userRepository.createQueryBuilder();
      (queryBuilder.getManyAndCount as jest.Mock).mockResolvedValue([[], 0]);

      await service.getUsers(query);

      expect(queryBuilder.skip).toHaveBeenCalledWith(10); // (3-1) * 5
      expect(queryBuilder.take).toHaveBeenCalledWith(5);
    });

    it('should handle custom sorting', async () => {
      const query: GetUsersQueryDto = { sortBy: 'email', sortOrder: 'ASC' };
      const queryBuilder = userRepository.createQueryBuilder();
      (queryBuilder.getManyAndCount as jest.Mock).mockResolvedValue([[], 0]);

      await service.getUsers(query);

      expect(queryBuilder.orderBy).toHaveBeenCalledWith('user.email', 'ASC');
    });

    it('should handle database error', async () => {
      const query: GetUsersQueryDto = {};
      const queryBuilder = userRepository.createQueryBuilder();
      const dbError = new Error('Database connection failed');
      (queryBuilder.getManyAndCount as jest.Mock).mockRejectedValue(dbError);

      await expect(service.getUsers(query)).rejects.toThrow('Database connection failed');
      expect(console.error).toHaveBeenCalledWith('Error getting users:', dbError);
    });

    it('should calculate correct total pages', async () => {
      const query: GetUsersQueryDto = { limit: 3 };
      const queryBuilder = userRepository.createQueryBuilder();
      (queryBuilder.getManyAndCount as jest.Mock).mockResolvedValue([[], 7]);

      const result = await service.getUsers(query);

      expect(result.meta.totalPages).toBe(3); // Math.ceil(7/3)
    });
  });

  describe('getUserById', () => {
    it('should return user by ID', async () => {
      userRepository.findOne.mockResolvedValue(mockUser as any);

      const result = await service.getUserById('1');

      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        select: ['id', 'userId', 'email', 'createdAt', 'updatedAt']
      });

      expect(result).toEqual({
        id: '1',
        userId: 'testuser123',
        email: 'test@example.com',
        name: 'testuser123',
        status: 'active',
        roles: ['user'],
        createdAt: mockUser.createdAt,
        updatedAt: mockUser.updatedAt,
        lastLoginAt: null,
      });
    });

    it('should throw NotFoundException when user not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.getUserById('999')).rejects.toThrow(NotFoundException);
      await expect(service.getUserById('999')).rejects.toThrow('사용자를 찾을 수 없습니다.');
    });

    it('should handle invalid ID format', async () => {
      const invalidId = 'invalid-id';
      userRepository.findOne.mockResolvedValue(null);

      // parseInt('invalid-id', 10) returns NaN, which will be passed to the query
      await expect(service.getUserById(invalidId)).rejects.toThrow(NotFoundException);
    });

    it('should handle database error', async () => {
      const dbError = new Error('Database error');
      userRepository.findOne.mockRejectedValue(dbError);

      await expect(service.getUserById('1')).rejects.toThrow(dbError);
      expect(console.error).toHaveBeenCalledWith('Error getting user by id:', dbError);
    });
  });

  describe('updateUserStatus', () => {
    it('should update user status (placeholder implementation)', async () => {
      userRepository.findOne.mockResolvedValue(mockUser as any);

      const result = await service.updateUserStatus('1', 'inactive');

      expect(userRepository.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(console.log).toHaveBeenCalledWith('User 1 status change requested to: inactive');
      
      expect(result).toEqual({
        id: '1',
        userId: 'testuser123',
        email: 'test@example.com',
        name: 'testuser123',
        status: 'active',
        roles: ['user'],
        createdAt: mockUser.createdAt,
        updatedAt: mockUser.updatedAt,
        lastLoginAt: null,
      });
    });

    it('should throw NotFoundException when user not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.updateUserStatus('999', 'active')).rejects.toThrow(NotFoundException);
    });

    it('should handle database error', async () => {
      const dbError = new Error('Database error');
      userRepository.findOne.mockRejectedValue(dbError);

      await expect(service.updateUserStatus('1', 'active')).rejects.toThrow(dbError);
      expect(console.error).toHaveBeenCalledWith('Error updating user status:', dbError);
    });
  });

  describe('getUserStats', () => {
    it('should return user statistics', async () => {
      userRepository.count
        .mockResolvedValueOnce(100) // total users
        .mockResolvedValueOnce(25); // recent users

      const result = await service.getUserStats();

      expect(userRepository.count).toHaveBeenCalledTimes(2);
      expect(userRepository.count).toHaveBeenNthCalledWith(1); // total count
      expect(userRepository.count).toHaveBeenNthCalledWith(2, {
        where: {
          createdAt: expect.any(Date),
        },
      });

      expect(result).toEqual({
        totalUsers: 100,
        recentUsers: 25,
        activeUsers: 80, // Math.floor(100 * 0.8)
        inactiveUsers: 20, // Math.floor(100 * 0.2)
        pendingUsers: 0,
      });
    });

    it('should handle date filtering for recent users', async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      userRepository.count.mockResolvedValue(50);

      await service.getUserStats();

      const secondCall = userRepository.count.mock.calls[1][0];
      expect(secondCall.where.createdAt).toEqual(MoreThanOrEqual(expect.any(Date)));
    });

    it('should return default values on error', async () => {
      const dbError = new Error('Database error');
      userRepository.count.mockRejectedValue(dbError);

      const result = await service.getUserStats();

      expect(result).toEqual({
        totalUsers: 0,
        recentUsers: 0,
        activeUsers: 0,
        inactiveUsers: 0,
        pendingUsers: 0,
      });

      expect(console.error).toHaveBeenCalledWith('Error getting user stats:', dbError);
    });

    it('should calculate active/inactive percentages correctly', async () => {
      userRepository.count
        .mockResolvedValueOnce(37) // odd number to test Math.floor
        .mockResolvedValueOnce(5);

      const result = await service.getUserStats();

      expect(result.activeUsers).toBe(29); // Math.floor(37 * 0.8)
      expect(result.inactiveUsers).toBe(7); // Math.floor(37 * 0.2)
    });
  });

  describe('getPendingUsers', () => {
    beforeEach(() => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        withDeleted: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn(),
      };
      userRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);
    });

    it('should return pending users with default parameters', async () => {
      const query: GetUsersQueryDto = {};
      const queryBuilder = userRepository.createQueryBuilder();
      (queryBuilder.getManyAndCount as jest.Mock).mockResolvedValue([mockUsers, 2]);

      const result = await service.getPendingUsers(query);

      expect(queryBuilder.where).toHaveBeenCalledWith('user.status = :status', { status: UserStatus.PENDING });
      expect(queryBuilder.leftJoinAndSelect).toHaveBeenCalledWith('user.roles', 'roles');
      expect(queryBuilder.withDeleted).toHaveBeenCalled();
      expect(queryBuilder.orderBy).toHaveBeenCalledWith('user.createdAt', 'DESC');

      expect(result.data).toHaveLength(2);
      expect(result.data[0].status).toBe('pending');
      expect(result.data[1].status).toBe('pending');
    });

    it('should handle search in pending users', async () => {
      const query: GetUsersQueryDto = { search: 'test@example.com' };
      const queryBuilder = userRepository.createQueryBuilder();
      (queryBuilder.getManyAndCount as jest.Mock).mockResolvedValue([[], 0]);

      await service.getPendingUsers(query);

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        '(user.email LIKE :search OR user.userId LIKE :search)',
        { search: '%test@example.com%' }
      );
    });

    it('should handle database error', async () => {
      const query: GetUsersQueryDto = {};
      const queryBuilder = userRepository.createQueryBuilder();
      const dbError = new Error('Database error');
      (queryBuilder.getManyAndCount as jest.Mock).mockRejectedValue(dbError);

      await expect(service.getPendingUsers(query)).rejects.toThrow(dbError);
      expect(console.error).toHaveBeenCalledWith('Error getting pending users:', dbError);
    });
  });

  describe('approveUser', () => {
    it('should approve user successfully', async () => {
      const approveDto: ApproveUserDto = { reason: 'Valid registration' };
      userRepository.findOne.mockResolvedValue(mockUser as any);

      const result = await service.approveUser('1', approveDto);

      expect(userRepository.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(console.log).toHaveBeenCalledWith('✅ 사용자 승인: test@example.com (ID: 1)');
      expect(console.log).toHaveBeenCalledWith('승인 사유: Valid registration');

      expect(result).toEqual({
        id: '1',
        userId: 'testuser123',
        email: 'test@example.com',
        name: 'testuser123',
        status: 'active',
        roles: ['user'],
        createdAt: mockUser.createdAt,
        updatedAt: mockUser.updatedAt,
        lastLoginAt: null,
      });
    });

    it('should handle approval without reason', async () => {
      const approveDto: ApproveUserDto = {};
      userRepository.findOne.mockResolvedValue(mockUser as any);

      await service.approveUser('1', approveDto);

      expect(console.log).toHaveBeenCalledWith('승인 사유: 사유 없음');
    });

    it('should throw NotFoundException when user not found', async () => {
      const approveDto: ApproveUserDto = { reason: 'Valid' };
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.approveUser('999', approveDto)).rejects.toThrow(NotFoundException);
    });

    it('should handle database error', async () => {
      const approveDto: ApproveUserDto = { reason: 'Valid' };
      const dbError = new Error('Database error');
      userRepository.findOne.mockRejectedValue(dbError);

      await expect(service.approveUser('1', approveDto)).rejects.toThrow(dbError);
      expect(console.error).toHaveBeenCalledWith('Error approving user:', dbError);
    });
  });

  describe('rejectUser', () => {
    it('should reject user successfully', async () => {
      const rejectDto: RejectUserDto = { reason: 'Invalid documentation' };
      userRepository.findOne.mockResolvedValue(mockUser as any);

      const result = await service.rejectUser('1', rejectDto);

      expect(userRepository.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(console.log).toHaveBeenCalledWith('❌ 사용자 거부: test@example.com (ID: 1)');
      expect(console.log).toHaveBeenCalledWith('거부 사유: Invalid documentation');

      expect(result).toEqual({
        id: '1',
        userId: 'testuser123',
        email: 'test@example.com',
        name: 'testuser123',
        status: 'active',
        roles: ['user'],
        createdAt: mockUser.createdAt,
        updatedAt: mockUser.updatedAt,
        lastLoginAt: null,
      });
    });

    it('should throw NotFoundException when user not found', async () => {
      const rejectDto: RejectUserDto = { reason: 'Invalid' };
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.rejectUser('999', rejectDto)).rejects.toThrow(NotFoundException);
    });

    it('should handle database error', async () => {
      const rejectDto: RejectUserDto = { reason: 'Invalid' };
      const dbError = new Error('Database error');
      userRepository.findOne.mockRejectedValue(dbError);

      await expect(service.rejectUser('1', rejectDto)).rejects.toThrow(dbError);
      expect(console.error).toHaveBeenCalledWith('Error rejecting user:', dbError);
    });
  });

  describe('Unimplemented Methods', () => {
    it('should throw error for createUser', async () => {
      await expect(service.createUser({})).rejects.toThrow('Method not implemented.');
    });

    it('should throw error for updateUser', async () => {
      await expect(service.updateUser('1', {})).rejects.toThrow('Method not implemented.');
    });

    it('should throw error for deleteUser', async () => {
      await expect(service.deleteUser('1')).rejects.toThrow('Method not implemented.');
    });

    it('should throw error for bulkAction', async () => {
      await expect(service.bulkAction({})).rejects.toThrow('Method not implemented.');
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete user management workflow', async () => {
      // 1. Get all users
      const queryBuilder = userRepository.createQueryBuilder();
      (queryBuilder.getManyAndCount as jest.Mock).mockResolvedValue([mockUsers, 2]);
      userRepository.count.mockResolvedValue(100);

      const allUsers = await service.getUsers({});
      expect(allUsers.data).toHaveLength(2);

      // 2. Get user stats
      const stats = await service.getUserStats();
      expect(stats.totalUsers).toBe(100);

      // 3. Get specific user
      userRepository.findOne.mockResolvedValue(mockUser as any);
      const user = await service.getUserById('1');
      expect(user.id).toBe('1');

      // 4. Approve user
      const approveResult = await service.approveUser('1', { reason: 'Valid' });
      expect(approveResult.id).toBe('1');

      // Verify all repository methods were called
      expect(userRepository.createQueryBuilder).toHaveBeenCalled();
      expect(userRepository.count).toHaveBeenCalled();
      expect(userRepository.findOne).toHaveBeenCalledTimes(2);
    });

    it('should handle concurrent user operations', async () => {
      userRepository.findOne.mockResolvedValue(mockUser as any);

      const promises = [
        service.getUserById('1'),
        service.approveUser('1', { reason: 'Valid' }),
        service.updateUserStatus('1', 'active'),
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.id).toBe('1');
      });

      expect(userRepository.findOne).toHaveBeenCalledTimes(3);
    });

    it('should maintain data consistency across methods', async () => {
      const queryBuilder = userRepository.createQueryBuilder();
      (queryBuilder.getManyAndCount as jest.Mock).mockResolvedValue([[mockUser], 1]);
      userRepository.findOne.mockResolvedValue(mockUser as any);

      // Get user from list
      const usersList = await service.getUsers({});
      const userFromList = usersList.data[0];

      // Get same user by ID
      const userById = await service.getUserById('1');

      // Data should be consistent
      expect(userFromList.id).toBe(userById.id);
      expect(userFromList.email).toBe(userById.email);
      expect(userFromList.userId).toBe(userById.userId);
    });

    it('should handle large datasets efficiently', async () => {
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        ...mockUser,
        id: i + 1,
        email: `user${i + 1}@example.com`,
      }));

      const queryBuilder = userRepository.createQueryBuilder();
      (queryBuilder.getManyAndCount as jest.Mock).mockResolvedValue([largeDataset.slice(0, 50), 1000]);

      const result = await service.getUsers({ page: 1, limit: 50 });

      expect(result.data).toHaveLength(50);
      expect(result.meta.total).toBe(1000);
      expect(result.meta.totalPages).toBe(20);
    });
  });
});