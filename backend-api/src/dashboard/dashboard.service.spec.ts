import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { Dashboard } from './entities/dashboard.entity';
import { DashboardShare } from './entities/dashboard_share.entity';
import { User } from '../user/entities/user.entity';
import { UserMapping } from '../user/entities/user-mapping.entity';
import { DashboardWidgetService } from './dashboard-widget/dashboard-widget.service';
import { UserService } from 'src/user/user.service';
import { AuthService } from 'src/auth/auth.service';
import { CustomLoggerService } from '../common/logger/logger.service';
import {
  createMockRepository,
  getRepositoryTokenFor,
  createMockService,
} from '../../test/test-helpers';
import { ResponseStatus } from '../common/enum/response-status.enum';
import { YesNo } from '../common/enum/yn.enum';

describe('DashboardService', () => {
  let service: DashboardService;
  let dashboardRepository: any;
  let userRepository: any;
  let dashboardShareRepository: any;
  let userMappingRepository: any;
  let dashboardWidgetService: any;
  let userService: any;
  let authService: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        {
          provide: getRepositoryTokenFor(Dashboard),
          useValue: createMockRepository(),
        },
        {
          provide: getRepositoryTokenFor(User),
          useValue: createMockRepository(),
        },
        {
          provide: getRepositoryTokenFor(DashboardShare),
          useValue: createMockRepository(),
        },
        {
          provide: getRepositoryTokenFor(UserMapping),
          useValue: createMockRepository(),
        },
        {
          provide: DashboardWidgetService,
          useValue: createMockService(['create', 'findWidgets', 'update', 'remove']),
        },
        {
          provide: UserService,
          useValue: createMockService(['findDashboardId', 'saveDashboard']),
        },
        {
          provide: AuthService,
          useValue: createMockService(['validateUser', 'generateAccessToken']),
        },
        {
          provide: CustomLoggerService,
          useValue: createMockService(['debug', 'error', 'log']),
        },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
    dashboardRepository = module.get(getRepositoryTokenFor(Dashboard));
    userRepository = module.get(getRepositoryTokenFor(User));
    dashboardShareRepository = module.get(getRepositoryTokenFor(DashboardShare));
    userMappingRepository = module.get(getRepositoryTokenFor(UserMapping));
    dashboardWidgetService = module.get<DashboardWidgetService>(DashboardWidgetService);
    userService = module.get<UserService>(UserService);
    authService = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new dashboard successfully', async () => {
      const createDto = {
        title: 'Test Dashboard',
        layout: [{ i: 1, x: 0, y: 0, w: 4, h: 4 }],
      };
      const mockUser = { id: 1, userId: 'testuser', email: 'test@example.com' };
      const mockShareId = { id: 1 };
      const mockDashboard = {
        id: 1,
        title: 'Test Dashboard',
        layout: JSON.stringify(createDto.layout),
        shareId: 1,
      };

      userRepository.findOne.mockResolvedValue(mockUser);
      dashboardShareRepository.save.mockResolvedValue(mockShareId);
      dashboardRepository.save.mockResolvedValue(mockDashboard);
      userMappingRepository.save.mockResolvedValue({});
      dashboardWidgetService.create.mockResolvedValue({});

      const result = await service.create(createDto, 1);

      expect((result as any).status).toBe(ResponseStatus.SUCCESS);
      expect((result as any).data.title).toBe('Test Dashboard');
      expect((result as any).data.layout).toEqual(createDto.layout);
    });

    it('should return Bad Request when user not found', async () => {
      const createDto = {
        title: 'Test Dashboard',
        layout: [{ i: 1, x: 0, y: 0, w: 4, h: 4 }],
      };
      userRepository.findOne.mockResolvedValue(null);

      const result = await service.create(createDto, 999);

      expect(result).toBe('Bad Request');
    });
  });

  describe('findOne', () => {
    it('should return dashboard with widgets', async () => {
      const mockDashboard = {
        id: 1,
        title: 'Test Dashboard',
        layout: JSON.stringify([{ i: 'widget1', x: 0, y: 0, w: 4, h: 4 }]),
        shareId: 1,
      };
      const mockShareInfo = { id: 1, uuid: 'test-uuid' };
      const mockWidgets = [{ id: 1, title: 'Test Widget' }];

      dashboardRepository.findOne.mockResolvedValue(mockDashboard);
      dashboardShareRepository.findOne.mockResolvedValue(mockShareInfo);
      dashboardWidgetService.findWidgets.mockResolvedValue(mockWidgets);

      const result = await service.findOne(1);

      expect(result.status).toBe(ResponseStatus.SUCCESS);
      expect(result.data.id).toBe(1);
      expect(result.data.layout).toEqual([{ i: 'widget1', x: 0, y: 0, w: 4, h: 4 }]);
      expect(result.data.widgets).toEqual(mockWidgets);
    });

    it('should return error when dashboard not found', async () => {
      dashboardRepository.findOne.mockResolvedValue(null);

      const result = await service.findOne(999);

      expect(result.status).toBe(ResponseStatus.ERROR);
      expect(result.message).toBe('대시보드가 존재하지 않습니다.');
    });
  });
});
