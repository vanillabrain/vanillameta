import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { User } from './entities/user.entity';
import { UserMapping } from './entities/user-mapping.entity';
import { AuthService } from '../auth/auth.service';
import {
  createMockRepository,
  getRepositoryTokenFor,
  createMockService,
} from '../../test/test-helpers';

describe('UserService', () => {
  let service: UserService;
  let userRepository: any;
  let userMappingRepository: any;
  let authService: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: getRepositoryTokenFor(User),
          useValue: createMockRepository(),
        },
        {
          provide: getRepositoryTokenFor(UserMapping),
          useValue: createMockRepository(),
        },
        {
          provide: AuthService,
          useValue: createMockService(['validateUser', 'generateAccessToken', 'checkAccess']),
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    userRepository = module.get(getRepositoryTokenFor(User));
    userMappingRepository = module.get(getRepositoryTokenFor(UserMapping));
    authService = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findOne', () => {
    it('should return user data without password when user exists', async () => {
      const mockUser = {
        id: 1,
        userId: 'testuser',
        email: 'test@example.com',
        password: 'hashedpassword',
      };
      userRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.findOne(1);

      expect((result as any).data).toEqual({
        id: 1,
        userId: 'testuser',
        email: 'test@example.com',
      });
      expect((result as any).data.password).toBeUndefined();
      expect((result as any).message).toBe('success');
    });

    it('should throw HttpException when user not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow('User not found');
    });
  });

  describe('findDashboardId', () => {
    it('should return user dashboard mappings', async () => {
      const mockMappings = [
        { dashboardId: 1, userInfoId: 1 }, 
        { dashboardId: 2, userInfoId: 1 },
        { dashboardId: null, userInfoId: 1 } // Test null dashboard ID
      ];
      userMappingRepository.find.mockResolvedValue(mockMappings);

      const result = await service.findDashboardId(1);

      expect(result).toEqual([1, 2]); // Should only return non-null dashboard IDs
      expect(userMappingRepository.find).toHaveBeenCalledWith({
        where: { userInfoId: 1 },
      });
    });
  });

  describe('updateUserInfo', () => {
    it('should update user information', async () => {
      const updateDto = {
        email: 'newemail@example.com',
        password: 'newpassword',
        userId: 'testuser',
        new_password: 'newpassword123',
      };
      const mockUser = {
        id: 1,
        userId: 'testuser',
        email: 'old@example.com',
        password: 'oldpassword',
      };
      const updatedUser = { ...mockUser, ...updateDto };

      userRepository.findOne.mockResolvedValue(mockUser);
      userRepository.save.mockResolvedValue(updatedUser);
      authService.checkAccess.mockResolvedValue(mockUser);

      const result = await service.updateUserInfo('testuser', updateDto);

      expect(authService.checkAccess).toHaveBeenCalledWith('testuser', expect.any(String));
      expect(userRepository.save).toHaveBeenCalled();
    });
  });
});
