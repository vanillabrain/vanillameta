import { Test, TestingModule } from '@nestjs/testing';
import { ShareUrlService } from './share-url.service';
import { User } from '../user/entities/user.entity';
import { Dashboard } from '../dashboard/entities/dashboard.entity';
import { DashboardShare } from '../dashboard/entities/dashboard_share.entity';
import { AuthService } from '../auth/auth.service';
import { DashboardService } from '../dashboard/dashboard.service';
import { createMockRepository, getRepositoryTokenFor, createMockService } from '../../test/test-helpers';

describe('ShareUrlService', () => {
  let service: ShareUrlService;
  let userRepository: any;
  let dashboardRepository: any;
  let dashboardShareRepository: any;
  let authService: any;
  let dashboardService: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShareUrlService,
        {
          provide: getRepositoryTokenFor(User),
          useValue: createMockRepository(),
        },
        {
          provide: getRepositoryTokenFor(Dashboard),
          useValue: createMockRepository(),
        },
        {
          provide: getRepositoryTokenFor(DashboardShare),
          useValue: createMockRepository(),
        },
        {
          provide: AuthService,
          useValue: createMockService(['generateUrlAccessToken', 'verifyAccessToken']),
        },
        {
          provide: DashboardService,
          useValue: createMockService(['findOne', 'findAll']),
        },
      ],
    }).compile();

    service = module.get<ShareUrlService>(ShareUrlService);
    userRepository = module.get(getRepositoryTokenFor(User));
    dashboardRepository = module.get(getRepositoryTokenFor(Dashboard));
    dashboardShareRepository = module.get(getRepositoryTokenFor(DashboardShare));
    authService = module.get<AuthService>(AuthService);
    dashboardService = module.get<DashboardService>(DashboardService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('checkShareUrlOn', () => {
    it('should enable share url when user exists', async () => {
      const shareUrlOnDto = {
        userId: 'testuser',
        endDate: '12/31/2024',
      };
      const mockUser = { id: 1, userId: 'testuser' };
      const mockToken = 'generated-share-token';
      
      userRepository.findOne.mockResolvedValue(mockUser);
      authService.generateUrlAccessToken.mockResolvedValue(mockToken);
      dashboardRepository.findOne.mockResolvedValue({ id: 1, title: 'Test Dashboard' });
      dashboardRepository.save.mockResolvedValue({ id: 1, shareYn: 'Y' });

      const result = await service.checkShareUrlOn('testuser', 1, shareUrlOnDto);

      expect(userRepository.findOne).toHaveBeenCalledWith({ where: { userId: 'testuser' } });
      expect(authService.generateUrlAccessToken).toHaveBeenCalledWith('1');
    });

    it('should return error when user does not exist', async () => {
      const shareUrlOnDto = {
        userId: 'nonexistent',
        endDate: '12/31/2024',
      };
      
      userRepository.findOne.mockResolvedValue(null);

      const result = await service.checkShareUrlOn('nonexistent', 1, shareUrlOnDto);

      expect(result).toBe('not exist user');
    });
  });
});
