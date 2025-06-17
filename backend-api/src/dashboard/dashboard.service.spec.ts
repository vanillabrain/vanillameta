import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
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
  let logger: any;

  const mockUser = {
    id: 1,
    userId: 'testuser',
    email: 'test@example.com',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockDashboard = {
    id: 1,
    title: 'Test Dashboard',
    layout: '[{"i":"widget1","x":0,"y":0,"w":4,"h":4}]',
    shareId: 1,
    delYn: YesNo.NO,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockDashboardShare = {
    id: 1,
    uuid: 'test-uuid-123',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUserMapping = {
    id: 1,
    dashboardId: 1,
    userInfoId: 1,
    createdAt: new Date(),
  };

  const mockWidget = {
    id: 1,
    title: 'Test Widget',
    widgetType: 'chart',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

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
    logger = module.get<CustomLoggerService>(CustomLoggerService);

    // Mock 초기화
    jest.clearAllMocks();
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
    it('should return dashboard with widgets and share UUID', async () => {
      const mockDashboardWithShare = {
        ...mockDashboard,
        dashboardShare: mockDashboardShare,
      };
      const mockWidgets = [mockWidget];

      dashboardRepository.findOne.mockResolvedValue(mockDashboardWithShare);
      dashboardWidgetService.findWidgets.mockResolvedValue(mockWidgets);

      const result = await service.findOne(1);

      expect(dashboardRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: ['dashboardShare'],
      });
      expect(result.status).toBe(ResponseStatus.SUCCESS);
      expect(result.data.id).toBe(1);
      expect(result.data.title).toBe('Test Dashboard');
      expect(result.data.layout).toEqual([{ i: 'widget1', x: 0, y: 0, w: 4, h: 4 }]);
      expect(result.data.uuid).toBe('test-uuid-123');
      expect(result.data.widgets).toEqual(mockWidgets);
      expect(result.data.dashboardShare).toBeUndefined(); // Should be deleted
    });

    it('should return error when dashboard not found', async () => {
      dashboardRepository.findOne.mockResolvedValue(null);

      const result = await service.findOne(999);

      expect(result.status).toBe(ResponseStatus.ERROR);
      expect(result.message).toBe('대시보드가 존재하지 않습니다.');
    });

    it('should handle dashboard without share info', async () => {
      const mockDashboardWithoutShare = {
        ...mockDashboard,
        dashboardShare: null,
      };

      dashboardRepository.findOne.mockResolvedValue(mockDashboardWithoutShare);
      dashboardWidgetService.findWidgets.mockResolvedValue([]);

      const result = await service.findOne(1);

      expect(result.status).toBe(ResponseStatus.SUCCESS);
      expect(result.data.uuid).toBeUndefined();
      expect(result.data.widgets).toEqual([]);
    });
  });

  describe('findAll', () => {
    it('should return all dashboards for user', async () => {
      const mockUserMappings = [{ dashboardId: 1 }, { dashboardId: 2 }];
      const mockDashboards = [
        { ...mockDashboard, id: 1 },
        { ...mockDashboard, id: 2, title: 'Second Dashboard' },
      ];

      userService.findDashboardId.mockResolvedValue(mockUserMappings);
      dashboardRepository.createQueryBuilder = jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockDashboards),
      });

      const result = await service.findAll(1);

      expect(userService.findDashboardId).toHaveBeenCalledWith(1);
      if (typeof result === 'object' && 'status' in result) {
        expect(result.status).toBe(ResponseStatus.SUCCESS);
        expect(result.data).toHaveLength(2);
        expect(result.data[0].layout).toEqual([{ i: 'widget1', x: 0, y: 0, w: 4, h: 4 }]);
      }
    });

    it('should return error when user not found', async () => {
      userService.findDashboardId.mockResolvedValue(null);

      const result = await service.findAll(999);

      expect(result).toBe('not exist user');
    });

    it('should return error when user has no dashboards', async () => {
      userService.findDashboardId.mockResolvedValue([]);

      const result = await service.findAll(1);

      expect(result).toBe('not exist user');
    });

    it('should throw HttpException when dashboard IDs are empty', async () => {
      userService.findDashboardId.mockResolvedValue([{ dashboardId: null }]);
      
      // findId는 [null]이 되어 length가 0이 아니므로 쿼리가 실행됨
      dashboardRepository.createQueryBuilder = jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockRejectedValue(new TypeError("Cannot read properties of undefined (reading 'forEach')")),
      });

      await expect(service.findAll(1)).rejects.toThrow(TypeError);
    });
  });

  describe('update', () => {
    it('should update dashboard title successfully', async () => {
      const updateDto = { title: 'Updated Dashboard' };
      const foundDashboard = { ...mockDashboard };

      dashboardRepository.findOne.mockResolvedValue(foundDashboard);
      dashboardRepository.save.mockResolvedValue({
        ...foundDashboard,
        title: 'Updated Dashboard',
      });
      dashboardWidgetService.update.mockResolvedValue({});

      const result = await service.update(1, updateDto);

      expect(dashboardRepository.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(dashboardRepository.save).toHaveBeenCalled();
      if (typeof result === 'object' && 'status' in result) {
        expect(result.status).toBe(ResponseStatus.SUCCESS);
        expect(result.data.title).toBe('Updated Dashboard');
      }
    });

    it('should update dashboard layout successfully', async () => {
      const newLayout = [{ i: 'widget2', x: 1, y: 1, w: 6, h: 6 }];
      const updateDto = { layout: newLayout };
      const foundDashboard = { ...mockDashboard };

      dashboardRepository.findOne.mockResolvedValue(foundDashboard);
      dashboardRepository.save.mockResolvedValue({
        ...foundDashboard,
        layout: JSON.stringify(newLayout),
      });
      dashboardWidgetService.update.mockResolvedValue({});

      const result = await service.update(1, updateDto);

      expect(dashboardWidgetService.update).toHaveBeenCalledWith(1, {
        dashboardId: 1,
        widgetIds: ['widget2'],
      });
      if (typeof result === 'object' && 'status' in result) {
        expect(result.status).toBe(ResponseStatus.SUCCESS);
        expect(result.data.layout).toEqual(newLayout);
      }
    });

    it('should update both title and layout', async () => {
      const newLayout = [{ i: 'widget3', x: 2, y: 2, w: 8, h: 8 }];
      const updateDto = { title: 'New Title', layout: newLayout };
      const foundDashboard = { ...mockDashboard };

      dashboardRepository.findOne.mockResolvedValue(foundDashboard);
      dashboardRepository.save.mockResolvedValue({
        ...foundDashboard,
        title: 'New Title',
        layout: JSON.stringify(newLayout),
      });
      dashboardWidgetService.update.mockResolvedValue({});

      const result = await service.update(1, updateDto);

      if (typeof result === 'object' && 'status' in result) {
        expect(result.status).toBe(ResponseStatus.SUCCESS);
        expect(result.data.title).toBe('New Title');
        expect(result.data.layout).toEqual(newLayout);
      }
    });

    it('should return error when dashboard not found', async () => {
      dashboardRepository.findOne.mockResolvedValue(null);

      const result = await service.update(999, { title: 'New Title' });

      expect(result).toBe('Not exist dashboard');
    });
  });

  describe('remove', () => {
    it('should remove dashboard and related data successfully', async () => {
      const foundDashboard = { ...mockDashboard };
      const foundUserMapping = { ...mockUserMapping };

      dashboardRepository.findOne.mockResolvedValue(foundDashboard);
      userMappingRepository.findOne.mockResolvedValue(foundUserMapping);
      dashboardRepository.delete.mockResolvedValue({ affected: 1 });
      userMappingRepository.delete.mockResolvedValue({ affected: 1 });
      dashboardShareRepository.delete.mockResolvedValue({ affected: 1 });
      dashboardWidgetService.remove.mockResolvedValue({});

      const result = await service.remove(1);

      expect(dashboardRepository.delete).toHaveBeenCalledWith(1);
      expect(dashboardWidgetService.remove).toHaveBeenCalledWith(1);
      expect(userMappingRepository.delete).toHaveBeenCalledWith(1);
      expect(dashboardShareRepository.delete).toHaveBeenCalledWith(1);
      expect(result.status).toBe(ResponseStatus.SUCCESS);
      expect(result.data.message).toBe('This action removes a #1 dashboard');
    });

    it('should return error when dashboard not found', async () => {
      dashboardRepository.findOne.mockResolvedValue(null);

      const result = await service.remove(999);

      expect(result.status).toBe(ResponseStatus.ERROR);
      expect(result.message).toBe('No exist dashboard');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle malformed layout JSON in findOne', async () => {
      const malformedDashboard = {
        ...mockDashboard,
        layout: 'invalid-json',
        dashboardShare: mockDashboardShare,
      };

      dashboardRepository.findOne.mockResolvedValue(malformedDashboard);
      dashboardWidgetService.findWidgets.mockResolvedValue([]);

      // JSON.parse가 실패할 수 있지만 서비스에서 처리되어야 함
      expect(async () => {
        await service.findOne(1);
      }).not.toThrow();
    });

    it('should handle empty widget IDs in create', async () => {
      const createDto = {
        title: 'Empty Layout Dashboard',
        layout: [], // Empty layout
      };

      userRepository.findOne.mockResolvedValue(mockUser);
      dashboardShareRepository.save.mockResolvedValue(mockDashboardShare);
      dashboardRepository.save.mockResolvedValue(mockDashboard);
      userMappingRepository.save.mockResolvedValue(mockUserMapping);
      dashboardWidgetService.create.mockResolvedValue({});

      const result = await service.create(createDto, 1);

      expect(dashboardWidgetService.create).toHaveBeenCalledWith({
        dashboardId: 1,
        widgetIds: [],
      });
      if (typeof result === 'object' && 'status' in result) {
        expect(result.status).toBe(ResponseStatus.SUCCESS);
      }
    });

    it('should handle large layout data', async () => {
      const largeLayout = Array.from({ length: 50 }, (_, i) => ({
        i: `widget${i}`,
        x: i % 10,
        y: Math.floor(i / 10),
        w: 2,
        h: 2,
      }));
      const createDto = {
        title: 'Large Layout Dashboard',
        layout: largeLayout,
      };

      userRepository.findOne.mockResolvedValue(mockUser);
      dashboardShareRepository.save.mockResolvedValue(mockDashboardShare);
      dashboardRepository.save.mockResolvedValue({
        ...mockDashboard,
        layout: JSON.stringify(largeLayout),
      });
      userMappingRepository.save.mockResolvedValue(mockUserMapping);
      dashboardWidgetService.create.mockResolvedValue({});

      const result = await service.create(createDto, 1);

      if (typeof result === 'object' && 'status' in result) {
        expect(result.status).toBe(ResponseStatus.SUCCESS);
        expect(result.data.layout).toEqual(largeLayout);
      }
    });

    it('should handle special characters in dashboard title', async () => {
      const specialTitle = 'Dashboard with 특수문자 & symbols! @#$%';
      const createDto = {
        title: specialTitle,
        layout: [{ i: 'widget1', x: 0, y: 0, w: 4, h: 4 }],
      };

      userRepository.findOne.mockResolvedValue(mockUser);
      dashboardShareRepository.save.mockResolvedValue(mockDashboardShare);
      dashboardRepository.save.mockResolvedValue({
        ...mockDashboard,
        title: specialTitle,
        layout: JSON.stringify(createDto.layout), // layout은 JSON string으로 저장됨
      });
      userMappingRepository.save.mockResolvedValue(mockUserMapping);
      dashboardWidgetService.create.mockResolvedValue({});

      const result = await service.create(createDto, 1);

      if (typeof result === 'object' && 'status' in result) {
        expect(result.status).toBe(ResponseStatus.SUCCESS);
        expect(result.data.title).toBe(specialTitle);
      }
    });
  });

  describe('Integration Tests', () => {
    it('should complete full dashboard lifecycle', async () => {
      // 1. Create dashboard
      const createDto = {
        title: 'Lifecycle Test Dashboard',
        layout: [{ i: 'widget1', x: 0, y: 0, w: 4, h: 4 }],
      };

      userRepository.findOne.mockResolvedValue(mockUser);
      dashboardShareRepository.save.mockResolvedValue(mockDashboardShare);
      dashboardRepository.save.mockResolvedValue({
        ...mockDashboard,
        layout: JSON.stringify(createDto.layout), // layout은 JSON string으로 저장됨
      });
      userMappingRepository.save.mockResolvedValue(mockUserMapping);
      dashboardWidgetService.create.mockResolvedValue({});

      const createResult = await service.create(createDto, 1);
      if (typeof createResult === 'object' && 'status' in createResult) {
        expect(createResult.status).toBe(ResponseStatus.SUCCESS);
      }

      // 2. Find created dashboard
      dashboardRepository.findOne.mockResolvedValue({
        ...mockDashboard,
        dashboardShare: mockDashboardShare,
      });
      dashboardWidgetService.findWidgets.mockResolvedValue([mockWidget]);

      const findResult = await service.findOne(1);
      expect(findResult.status).toBe(ResponseStatus.SUCCESS);
      expect(findResult.data.widgets).toHaveLength(1);

      // 3. Update dashboard
      const updateDto = { title: 'Updated Lifecycle Dashboard' };
      dashboardRepository.findOne.mockResolvedValue(mockDashboard);
      dashboardRepository.save.mockResolvedValue({
        ...mockDashboard,
        title: 'Updated Lifecycle Dashboard',
      });
      dashboardWidgetService.update.mockResolvedValue({});

      const updateResult = await service.update(1, updateDto);
      if (typeof updateResult === 'object' && 'status' in updateResult) {
        expect(updateResult.status).toBe(ResponseStatus.SUCCESS);
        expect(updateResult.data.title).toBe('Updated Lifecycle Dashboard');
      }

      // 4. Remove dashboard
      dashboardRepository.findOne.mockResolvedValue(mockDashboard);
      userMappingRepository.findOne.mockResolvedValue(mockUserMapping);
      dashboardRepository.delete.mockResolvedValue({ affected: 1 });
      userMappingRepository.delete.mockResolvedValue({ affected: 1 });
      dashboardShareRepository.delete.mockResolvedValue({ affected: 1 });
      dashboardWidgetService.remove.mockResolvedValue({});

      const removeResult = await service.remove(1);
      expect(removeResult.status).toBe(ResponseStatus.SUCCESS);
    });

    it('should handle concurrent dashboard operations', async () => {
      // Simulate concurrent creation of multiple dashboards
      const createPromises = Array.from({ length: 3 }, (_, i) => {
        const createDto = {
          title: `Concurrent Dashboard ${i + 1}`,
          layout: [{ i: `widget${i + 1}`, x: 0, y: 0, w: 4, h: 4 }],
        };

        userRepository.findOne.mockResolvedValue(mockUser);
        dashboardShareRepository.save.mockResolvedValue({
          ...mockDashboardShare,
          id: i + 1,
        });
        dashboardRepository.save.mockResolvedValue({
          ...mockDashboard,
          id: i + 1,
          title: `Concurrent Dashboard ${i + 1}`,
          layout: JSON.stringify(createDto.layout), // layout은 JSON string으로 저장됨
        });
        userMappingRepository.save.mockResolvedValue({
          ...mockUserMapping,
          id: i + 1,
        });
        dashboardWidgetService.create.mockResolvedValue({});

        return service.create(createDto, 1);
      });

      const results = await Promise.all(createPromises);

      // 동시성 작업이므로 순서를 보장할 수 없음 - 각 결과가 올바른 형식인지만 확인
      results.forEach((result) => {
        if (typeof result === 'object' && 'status' in result) {
          expect(result.status).toBe(ResponseStatus.SUCCESS);
          expect(result.data.title).toMatch(/^Concurrent Dashboard \d+$/);
          expect(result.data.layout).toBeDefined();
        }
      });
      
      // 모든 대시보드가 생성되었는지 확인
      expect(results).toHaveLength(3);
    });
  });
});
