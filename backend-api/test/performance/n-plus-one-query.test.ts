import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DashboardService } from '../../src/dashboard/dashboard.service';
import { Dashboard } from '../../src/dashboard/entities/dashboard.entity';
import { DashboardShare } from '../../src/dashboard/entities/dashboard_share.entity';
import { User } from '../../src/user/entities/user.entity';
import { UserMapping } from '../../src/user/entities/user-mapping.entity';
import { DashboardWidgetService } from '../../src/dashboard/dashboard-widget/dashboard-widget.service';
import { UserService } from '../../src/user/user.service';
import { AuthService } from '../../src/auth/auth.service';
import { CustomLoggerService } from '../../src/common/logger/logger.service';

describe('N+1 Query Resolution Tests', () => {
  let service: DashboardService;
  let dashboardRepository: Repository<Dashboard>;
  let userService: UserService;
  let queryBuilder: any;
  let queryCount: number;

  beforeEach(async () => {
    queryCount = 0;
    queryBuilder = {
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockImplementation(() => {
        queryCount++;
        return Promise.resolve([
          { id: 1, title: 'Dashboard 1', layout: '[]', updatedAt: new Date() },
          { id: 2, title: 'Dashboard 2', layout: '[]', updatedAt: new Date() }
        ]);
      }),
      getOne: jest.fn().mockImplementation(() => {
        queryCount++;
        return Promise.resolve({
          id: 1,
          title: 'Dashboard 1',
          layout: '[]',
          shareId: 1,
          dashboardShare: { uuid: 'test-uuid' }
        });
      })
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        {
          provide: getRepositoryToken(Dashboard),
          useValue: {
            findOne: jest.fn().mockImplementation(() => {
              queryCount++;
              return Promise.resolve({ id: 1, title: 'Dashboard', layout: '[]' });
            }),
            save: jest.fn(),
            createQueryBuilder: jest.fn(() => queryBuilder)
          }
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn()
          }
        },
        {
          provide: getRepositoryToken(DashboardShare),
          useValue: {
            findOne: jest.fn().mockImplementation(() => {
              queryCount++;
              return Promise.resolve({ id: 1, uuid: 'test-uuid' });
            }),
            save: jest.fn()
          }
        },
        {
          provide: getRepositoryToken(UserMapping),
          useValue: {
            save: jest.fn()
          }
        },
        {
          provide: DashboardWidgetService,
          useValue: {
            create: jest.fn(),
            findWidgets: jest.fn().mockResolvedValue([])
          }
        },
        {
          provide: UserService,
          useValue: {
            findDashboardId: jest.fn().mockResolvedValue([
              { dashboardId: 1 },
              { dashboardId: 2 }
            ])
          }
        },
        {
          provide: AuthService,
          useValue: {}
        },
        {
          provide: CustomLoggerService,
          useValue: {
            debug: jest.fn(),
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn()
          }
        }
      ]
    }).compile();

    service = module.get<DashboardService>(DashboardService);
    dashboardRepository = module.get<Repository<Dashboard>>(getRepositoryToken(Dashboard));
    userService = module.get<UserService>(UserService);
  });

  describe('Dashboard findAll', () => {
    it('should execute only one query for multiple dashboards (no N+1)', async () => {
      const userId = 1;
      queryCount = 0;

      const result = await service.findAll(userId);

      // userService.findDashboardId는 한 번 호출
      expect(userService.findDashboardId).toHaveBeenCalledWith(userId);
      
      // 대시보드 조회는 한 번의 쿼리로 처리되어야 함
      expect(queryCount).toBe(1);
      expect(queryBuilder.where).toHaveBeenCalledWith('dashboard.id IN (:...ids)', { ids: [1, 2] });
      expect(result.data).toHaveLength(2);
    });
  });

  describe('Dashboard findOne', () => {
    it('should use join to fetch related data in one query', async () => {
      const dashboardId = 1;
      queryCount = 0;

      const result = await service.findOne(dashboardId);

      // Join을 사용하여 한 번의 쿼리로 dashboard와 dashboardShare 조회
      expect(queryCount).toBe(1);
      expect(queryBuilder.leftJoinAndSelect).toHaveBeenCalled();
      expect(result.data).toHaveProperty('uuid', 'test-uuid');
    });
  });
});