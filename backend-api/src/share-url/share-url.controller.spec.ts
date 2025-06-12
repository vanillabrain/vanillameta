import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ShareUrlController } from './share-url.controller';
import { ShareUrlService } from './share-url.service';
import { User } from '../user/entities/user.entity';
import { Dashboard } from '../dashboard/entities/dashboard.entity';
import { DashboardShare } from '../dashboard/entities/dashboard_share.entity';
import { AuthService } from '../auth/auth.service';
import { DashboardService } from '../dashboard/dashboard.service';

describe('ShareUrlController', () => {
  let controller: ShareUrlController;

  const mockUserRepository = {
    findOne: jest.fn(),
  };

  const mockDashboardRepository = {
    findOne: jest.fn(),
  };

  const mockDashboardShareRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const mockAuthService = {
    generateUrlAccessToken: jest.fn(),
  };

  const mockDashboardService = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ShareUrlController],
      providers: [
        ShareUrlService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: getRepositoryToken(Dashboard),
          useValue: mockDashboardRepository,
        },
        {
          provide: getRepositoryToken(DashboardShare),
          useValue: mockDashboardShareRepository,
        },
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
        {
          provide: DashboardService,
          useValue: mockDashboardService,
        },
      ],
    }).compile();

    controller = module.get<ShareUrlController>(ShareUrlController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
