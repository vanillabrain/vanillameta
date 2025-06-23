import { Test, TestingModule } from '@nestjs/testing';
import { AdminService } from './admin.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Dashboard } from '../../dashboard/entities/dashboard.entity';
import { Widget } from '../../widget/entities/widget.entity';
import { AnalyticsEvent } from '../../analytics/entities/analytics-event.entity';
import { DashboardStatsDto, AuditLogSummaryDto } from './dto/dashboard-stats.dto';
import { createMockRepository, getRepositoryTokenFor } from '../../../test/test-helpers';

describe('AdminService', () => {
  let service: AdminService;
  let userRepository: jest.Mocked<Repository<User>>;
  let dashboardRepository: jest.Mocked<Repository<Dashboard>>;
  let widgetRepository: jest.Mocked<Repository<Widget>>;
  let analyticsEventRepository: jest.Mocked<Repository<AnalyticsEvent>>;

  const mockUser = {
    id: 1,
    email: 'test@example.com',
    name: 'Test User',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockDashboard = {
    id: 1,
    title: 'Test Dashboard',
    description: 'Test description',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockWidget = {
    id: 1,
    title: 'Test Widget',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockAnalyticsEvent = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    category: 'user',
    action: 'login',
    userId: '1',
    sessionId: 'session123',
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        {
          provide: getRepositoryTokenFor(User),
          useValue: createMockRepository<User>(),
        },
        {
          provide: getRepositoryTokenFor(Dashboard),
          useValue: createMockRepository<Dashboard>(),
        },
        {
          provide: getRepositoryTokenFor(Widget),
          useValue: createMockRepository<Widget>(),
        },
        {
          provide: getRepositoryTokenFor(AnalyticsEvent),
          useValue: createMockRepository<AnalyticsEvent>(),
        },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
    userRepository = module.get(getRepositoryTokenFor(User));
    dashboardRepository = module.get(getRepositoryTokenFor(Dashboard));
    widgetRepository = module.get(getRepositoryTokenFor(Widget));
    analyticsEventRepository = module.get(getRepositoryTokenFor(AnalyticsEvent));

    // Mock 초기화
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getDashboardStats', () => {
    beforeEach(() => {
      // 기본 성공 시나리오 Mock 설정
      userRepository.count.mockResolvedValue(100);
      dashboardRepository.count.mockResolvedValue(25);
      widgetRepository.count.mockResolvedValue(150);
      analyticsEventRepository.count.mockResolvedValue(15);
      analyticsEventRepository.find.mockResolvedValue([
        { ...mockAnalyticsEvent, action: 'login' },
        { ...mockAnalyticsEvent, id: '456', action: 'dashboard_view', category: 'dashboard' },
      ]);
    });

    it('should return complete dashboard statistics', async () => {
      const result = await service.getDashboardStats();

      expect(result).toEqual({
        totalUsers: 100,
        pendingApprovals: 0, // 현재 구현상 항상 0
        todayLogins: 15,
        activeSessions: 10, // 총 사용자의 10%
        totalDashboards: 25,
        totalWidgets: 150,
        recentLogs: [
          {
            id: mockAnalyticsEvent.id,
            userEmail: 'user_1',
            action: 'login',
            createdAt: mockAnalyticsEvent.createdAt,
          },
          {
            id: '456',
            userEmail: 'user_1',
            action: 'dashboard_view',
            createdAt: mockAnalyticsEvent.createdAt,
          },
        ],
      });

      expect(userRepository.count).toHaveBeenCalled();
      expect(dashboardRepository.count).toHaveBeenCalled();
      expect(widgetRepository.count).toHaveBeenCalled();
      expect(analyticsEventRepository.count).toHaveBeenCalledWith({
        where: {
          action: 'login',
          createdAt: expect.any(Object), // MoreThanOrEqual FindOperator
        },
      });
      expect(analyticsEventRepository.find).toHaveBeenCalledWith({
        order: { createdAt: 'DESC' },
        take: 5,
      });
    });

    it('should handle partial failures gracefully', async () => {
      // 일부 Repository 오류 시뮬레이션
      userRepository.count.mockRejectedValue(new Error('User DB error'));
      dashboardRepository.count.mockRejectedValue(new Error('Dashboard DB error'));
      analyticsEventRepository.count.mockResolvedValue(5);
      analyticsEventRepository.find.mockResolvedValue([]);
      widgetRepository.count.mockResolvedValue(50);

      const result = await service.getDashboardStats();

      expect(result).toEqual({
        totalUsers: 0, // 오류 시 기본값
        pendingApprovals: 0,
        todayLogins: 5,
        activeSessions: 0, // totalUsers가 0이므로
        totalDashboards: 0, // 오류 시 기본값
        totalWidgets: 50,
        recentLogs: [],
      });

      expect(console.error).toHaveBeenCalledWith('Error getting total users count:', expect.any(Error));
      expect(console.error).toHaveBeenCalledWith('Error getting total dashboards count:', expect.any(Error));
    });

    it('should handle complete service failure', async () => {
      // 일부 Repository 메서드가 실패하는 경우
      const dbError = new Error('Database connection failed');
      userRepository.count.mockRejectedValue(dbError);
      dashboardRepository.count.mockRejectedValue(dbError);
      widgetRepository.count.mockRejectedValue(dbError);
      analyticsEventRepository.count.mockRejectedValue(dbError);
      analyticsEventRepository.find.mockRejectedValue(dbError);

      const result = await service.getDashboardStats();
      
      // 오류 시 기본값들이 반환되어야 함
      expect(result).toEqual({
        totalUsers: 0,
        pendingApprovals: 0,
        todayLogins: 0,
        activeSessions: 0,
        totalDashboards: 0,
        totalWidgets: 0,
        recentLogs: [],
      });
      
      expect(console.error).toHaveBeenCalledWith('Error getting total users count:', dbError);
      expect(console.error).toHaveBeenCalledWith('Error getting total dashboards count:', dbError);
    });

    it('should calculate correct today login count with date filtering', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      userRepository.count.mockResolvedValue(50);
      dashboardRepository.count.mockResolvedValue(10);
      widgetRepository.count.mockResolvedValue(75);
      analyticsEventRepository.count.mockResolvedValue(8);
      analyticsEventRepository.find.mockResolvedValue([]);

      await service.getDashboardStats();

      expect(analyticsEventRepository.count).toHaveBeenCalledWith({
        where: {
          action: 'login',
          createdAt: MoreThanOrEqual(today),
        },
      });
    });
  });

  describe('private method testing through public interface', () => {
    describe('getTotalUsersCount', () => {
      it('should return correct user count', async () => {
        userRepository.count.mockResolvedValue(250);
        dashboardRepository.count.mockResolvedValue(1);
        widgetRepository.count.mockResolvedValue(1);
        analyticsEventRepository.count.mockResolvedValue(1);
        analyticsEventRepository.find.mockResolvedValue([]);

        const result = await service.getDashboardStats();

        expect(result.totalUsers).toBe(250);
      });

      it('should handle user count error', async () => {
        userRepository.count.mockRejectedValue(new Error('User count failed'));
        dashboardRepository.count.mockResolvedValue(1);
        widgetRepository.count.mockResolvedValue(1);
        analyticsEventRepository.count.mockResolvedValue(1);
        analyticsEventRepository.find.mockResolvedValue([]);

        const result = await service.getDashboardStats();

        expect(result.totalUsers).toBe(0);
        expect(console.error).toHaveBeenCalledWith('Error getting total users count:', expect.any(Error));
      });
    });

    describe('getPendingApprovalsCount', () => {
      it('should always return 0 for pending approvals', async () => {
        userRepository.count.mockResolvedValue(1);
        dashboardRepository.count.mockResolvedValue(1);
        widgetRepository.count.mockResolvedValue(1);
        analyticsEventRepository.count.mockResolvedValue(1);
        analyticsEventRepository.find.mockResolvedValue([]);

        const result = await service.getDashboardStats();

        expect(result.pendingApprovals).toBe(0);
      });
    });

    describe('getTodayLoginCount', () => {
      it('should count today logins correctly', async () => {
        userRepository.count.mockResolvedValue(1);
        dashboardRepository.count.mockResolvedValue(1);
        widgetRepository.count.mockResolvedValue(1);
        analyticsEventRepository.count.mockResolvedValue(42);
        analyticsEventRepository.find.mockResolvedValue([]);

        const result = await service.getDashboardStats();

        expect(result.todayLogins).toBe(42);
      });

      it('should handle analytics error', async () => {
        userRepository.count.mockResolvedValue(1);
        dashboardRepository.count.mockResolvedValue(1);
        widgetRepository.count.mockResolvedValue(1);
        analyticsEventRepository.count.mockRejectedValue(new Error('Analytics error'));
        analyticsEventRepository.find.mockResolvedValue([]);

        const result = await service.getDashboardStats();

        expect(result.todayLogins).toBe(0);
        expect(console.error).toHaveBeenCalledWith('Error getting today login count:', expect.any(Error));
      });
    });

    describe('getActiveSessionCount', () => {
      it('should calculate 10% of total users', async () => {
        userRepository.count.mockResolvedValue(100);
        dashboardRepository.count.mockResolvedValue(1);
        widgetRepository.count.mockResolvedValue(1);
        analyticsEventRepository.count.mockResolvedValue(1);
        analyticsEventRepository.find.mockResolvedValue([]);

        const result = await service.getDashboardStats();

        expect(result.activeSessions).toBe(10); // 100 * 0.1
      });

      it('should handle odd numbers correctly', async () => {
        userRepository.count.mockResolvedValue(37);
        dashboardRepository.count.mockResolvedValue(1);
        widgetRepository.count.mockResolvedValue(1);
        analyticsEventRepository.count.mockResolvedValue(1);
        analyticsEventRepository.find.mockResolvedValue([]);

        const result = await service.getDashboardStats();

        expect(result.activeSessions).toBe(3); // Math.floor(37 * 0.1)
      });

      it('should handle user count error in active sessions', async () => {
        userRepository.count.mockRejectedValue(new Error('User error'));
        dashboardRepository.count.mockResolvedValue(1);
        widgetRepository.count.mockResolvedValue(1);
        analyticsEventRepository.count.mockResolvedValue(1);
        analyticsEventRepository.find.mockResolvedValue([]);

        const result = await service.getDashboardStats();

        expect(result.activeSessions).toBe(0);
      });
    });

    describe('getTotalDashboardsCount', () => {
      it('should return correct dashboard count', async () => {
        userRepository.count.mockResolvedValue(1);
        dashboardRepository.count.mockResolvedValue(89);
        widgetRepository.count.mockResolvedValue(1);
        analyticsEventRepository.count.mockResolvedValue(1);
        analyticsEventRepository.find.mockResolvedValue([]);

        const result = await service.getDashboardStats();

        expect(result.totalDashboards).toBe(89);
      });
    });

    describe('getTotalWidgetsCount', () => {
      it('should return correct widget count', async () => {
        userRepository.count.mockResolvedValue(1);
        dashboardRepository.count.mockResolvedValue(1);
        widgetRepository.count.mockResolvedValue(456);
        analyticsEventRepository.count.mockResolvedValue(1);
        analyticsEventRepository.find.mockResolvedValue([]);

        const result = await service.getDashboardStats();

        expect(result.totalWidgets).toBe(456);
      });
    });

    describe('getRecentAuditLogs', () => {
      it('should return formatted recent logs', async () => {
        const mockEvents = [
          { id: 'uuid1', action: 'create_dashboard', userId: 5, createdAt: new Date('2023-01-01') },
          { id: 'uuid2', action: 'delete_widget', userId: null, createdAt: new Date('2023-01-02') },
          { id: 'uuid3', action: 'login', userId: 10, createdAt: new Date('2023-01-03') },
        ];

        userRepository.count.mockResolvedValue(1);
        dashboardRepository.count.mockResolvedValue(1);
        widgetRepository.count.mockResolvedValue(1);
        analyticsEventRepository.count.mockResolvedValue(1);
        analyticsEventRepository.find.mockResolvedValue(mockEvents as any);

        const result = await service.getDashboardStats();

        expect(result.recentLogs).toEqual([
          {
            id: 'uuid1',
            userEmail: 'user_5',
            action: 'create_dashboard',
            createdAt: new Date('2023-01-01'),
          },
          {
            id: 'uuid2',
            userEmail: 'anonymous',
            action: 'delete_widget',
            createdAt: new Date('2023-01-02'),
          },
          {
            id: 'uuid3',
            userEmail: 'user_10',
            action: 'login',
            createdAt: new Date('2023-01-03'),
          },
        ]);

        expect(analyticsEventRepository.find).toHaveBeenCalledWith({
          order: { createdAt: 'DESC' },
          take: 5,
        });
      });

      it('should handle audit logs error', async () => {
        userRepository.count.mockResolvedValue(1);
        dashboardRepository.count.mockResolvedValue(1);
        widgetRepository.count.mockResolvedValue(1);
        analyticsEventRepository.count.mockResolvedValue(1);
        analyticsEventRepository.find.mockRejectedValue(new Error('Audit logs error'));

        const result = await service.getDashboardStats();

        expect(result.recentLogs).toEqual([]);
        expect(console.error).toHaveBeenCalledWith('Error getting recent audit logs:', expect.any(Error));
      });

      it('should limit to 5 recent logs', async () => {
        userRepository.count.mockResolvedValue(1);
        dashboardRepository.count.mockResolvedValue(1);
        widgetRepository.count.mockResolvedValue(1);
        analyticsEventRepository.count.mockResolvedValue(1);
        analyticsEventRepository.find.mockResolvedValue([]);

        await service.getDashboardStats();

        expect(analyticsEventRepository.find).toHaveBeenCalledWith({
          order: { createdAt: 'DESC' },
          take: 5,
        });
      });
    });
  });

  describe('Integration and Performance Tests', () => {
    it('should handle concurrent dashboard stats requests', async () => {
      userRepository.count.mockResolvedValue(50);
      dashboardRepository.count.mockResolvedValue(10);
      widgetRepository.count.mockResolvedValue(100);
      analyticsEventRepository.count.mockResolvedValue(5);
      analyticsEventRepository.find.mockResolvedValue([]);

      const promises = Array.from({ length: 3 }, () => service.getDashboardStats());
      const results = await Promise.all(promises);

      results.forEach(result => {
        expect(result.totalUsers).toBe(50);
        expect(result.totalDashboards).toBe(10);
        expect(result.totalWidgets).toBe(100);
      });

      // 각 요청마다 모든 Repository 메서드가 호출되었는지 확인
      expect(userRepository.count).toHaveBeenCalledTimes(6); // 3 requests * 2 calls per request (getDashboardStats, getActiveSessionCount)
      expect(dashboardRepository.count).toHaveBeenCalledTimes(3);
      expect(widgetRepository.count).toHaveBeenCalledTimes(3);
    });

    it('should maintain consistent data structure', async () => {
      userRepository.count.mockResolvedValue(1);
      dashboardRepository.count.mockResolvedValue(1);
      widgetRepository.count.mockResolvedValue(1);
      analyticsEventRepository.count.mockResolvedValue(1);
      analyticsEventRepository.find.mockResolvedValue([]);

      const result = await service.getDashboardStats();

      const expectedKeys = [
        'totalUsers',
        'pendingApprovals',
        'todayLogins',
        'activeSessions',
        'totalDashboards',
        'totalWidgets',
        'recentLogs',
      ];

      expect(Object.keys(result)).toEqual(expectedKeys);
      expect(typeof result.totalUsers).toBe('number');
      expect(typeof result.pendingApprovals).toBe('number');
      expect(typeof result.todayLogins).toBe('number');
      expect(typeof result.activeSessions).toBe('number');
      expect(typeof result.totalDashboards).toBe('number');
      expect(typeof result.totalWidgets).toBe('number');
      expect(Array.isArray(result.recentLogs)).toBe(true);
    });

    it('should handle large numbers correctly', async () => {
      const largeNumber = 999999;
      userRepository.count.mockResolvedValue(largeNumber);
      dashboardRepository.count.mockResolvedValue(largeNumber);
      widgetRepository.count.mockResolvedValue(largeNumber);
      analyticsEventRepository.count.mockResolvedValue(largeNumber);
      analyticsEventRepository.find.mockResolvedValue([]);

      const result = await service.getDashboardStats();

      expect(result.totalUsers).toBe(largeNumber);
      expect(result.totalDashboards).toBe(largeNumber);
      expect(result.totalWidgets).toBe(largeNumber);
      expect(result.todayLogins).toBe(largeNumber);
      expect(result.activeSessions).toBe(Math.floor(largeNumber * 0.1));
    });
  });
});