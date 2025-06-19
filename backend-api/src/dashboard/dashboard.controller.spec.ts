import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { Dashboard } from './entities/dashboard.entity';
import { DashboardShare } from './entities/dashboard_share.entity';
import { User } from '../user/entities/user.entity';
import { UserMapping } from '../user/entities/user-mapping.entity';
import { DashboardWidgetService } from './dashboard-widget/dashboard-widget.service';
import { UserService } from '../user/user.service';
import { AuthService } from '../auth/auth.service';
import { CustomLoggerService } from '../common/logger/logger.service';

describe('DashboardController', () => {
  let controller: DashboardController;

  const mockDashboardRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn().mockReturnValue({
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn(),
    }),
  };

  const mockUserRepository = {
    findOne: jest.fn(),
  };

  const mockDashboardShareRepository = {
    save: jest.fn(),
    findOne: jest.fn(),
  };

  const mockUserMappingRepository = {
    save: jest.fn(),
    find: jest.fn(),
    createQueryBuilder: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawMany: jest.fn(),
    }),
  };

  const mockDashboardWidgetService = {
    create: jest.fn(),
  };

  const mockUserService = {
    findDashboardId: jest.fn(),
  };

  const mockAuthService = {
    checkAccess: jest.fn(),
  };

  const mockLoggerService = {
    debug: jest.fn(),
    error: jest.fn(),
    log: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [
        DashboardService,
        {
          provide: getRepositoryToken(Dashboard),
          useValue: mockDashboardRepository,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: getRepositoryToken(DashboardShare),
          useValue: mockDashboardShareRepository,
        },
        {
          provide: getRepositoryToken(UserMapping),
          useValue: mockUserMappingRepository,
        },
        {
          provide: DashboardWidgetService,
          useValue: mockDashboardWidgetService,
        },
        {
          provide: UserService,
          useValue: mockUserService,
        },
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
        {
          provide: CustomLoggerService,
          useValue: mockLoggerService,
        },
      ],
    }).compile();

    controller = module.get<DashboardController>(DashboardController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
