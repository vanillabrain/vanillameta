import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ShareUrlService } from '../../src/share-url/share-url.service';
import { LoginService } from '../../src/login/login.service';
import { Dashboard } from '../../src/dashboard/entities/dashboard.entity';
import { DashboardShare } from '../../src/dashboard/entities/dashboard_share.entity';
import { User } from '../../src/user/entities/user.entity';
import { RefreshToken } from '../../src/auth/entities/refresh_token.entity';
import { AuthService } from '../../src/auth/auth.service';
import { DashboardService } from '../../src/dashboard/dashboard.service';
import { HttpException } from '@nestjs/common';

describe('Additional N+1 Query Resolution Tests', () => {
  describe('ShareUrlService', () => {
    let service: ShareUrlService;
    let dashboardRepository: Repository<Dashboard>;
    let queryCount: number;

    beforeEach(async () => {
      queryCount = 0;
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ShareUrlService,
          {
            provide: getRepositoryToken(Dashboard),
            useValue: {
              findOne: jest.fn().mockImplementation(options => {
                queryCount++;
                if (options.relations && options.relations.includes('dashboardShare')) {
                  return Promise.resolve({
                    id: 1,
                    title: 'Test Dashboard',
                    shareId: 1,
                    dashboardShare: {
                      id: 1,
                      uuid: 'test-uuid',
                      shareToken: '',
                      shareYn: 'N',
                      endDate: null,
                    },
                  });
                }
                return Promise.resolve({ id: 1, title: 'Test Dashboard', shareId: 1 });
              }),
              createQueryBuilder: jest.fn(() => ({
                innerJoinAndSelect: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                getOne: jest.fn().mockImplementation(() => {
                  queryCount++;
                  return Promise.resolve({
                    id: 1,
                    dashboardShare: {
                      uuid: 'test-uuid',
                      endDate: new Date('2025-12-31'),
                    },
                  });
                }),
              })),
            },
          },
          {
            provide: getRepositoryToken(User),
            useValue: {
              findOne: jest.fn().mockResolvedValue({ id: 1, userId: 'testuser' }),
            },
          },
          {
            provide: getRepositoryToken(DashboardShare),
            useValue: {
              save: jest.fn().mockImplementation(entity => Promise.resolve(entity)),
            },
          },
          {
            provide: AuthService,
            useValue: {
              generateUrlAccessToken: jest.fn().mockResolvedValue('new-token'),
            },
          },
          {
            provide: DashboardService,
            useValue: {
              findOne: jest.fn().mockResolvedValue({ data: {} }),
            },
          },
        ],
      }).compile();

      service = module.get<ShareUrlService>(ShareUrlService);
      dashboardRepository = module.get<Repository<Dashboard>>(getRepositoryToken(Dashboard));
    });

    it('should use relations to avoid N+1 query in checkShareUrlOn', async () => {
      queryCount = 0;
      const result = await service.checkShareUrlOn('testuser', 1, {
        userId: 'testuser',
        endDate: '12/31/2025',
      });

      // 한 번의 쿼리로 dashboard와 dashboardShare를 함께 조회
      expect(queryCount).toBe(1);
      expect(dashboardRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: ['dashboardShare'],
      });
      expect(result).toHaveProperty('uuid', 'test-uuid');
    });

    it('should use single query in shareDashboardInfo', async () => {
      queryCount = 0;
      const result = await service.shareDashboardInfo('test-uuid');

      // 한 번의 Join 쿼리로 처리
      expect(queryCount).toBe(1);
    });
  });

  describe('LoginService', () => {
    let service: LoginService;
    let userRepository: Repository<User>;
    let queryBuilder: any;
    let queryCount: number;

    beforeEach(async () => {
      queryCount = 0;
      queryBuilder = {
        where: jest.fn().mockReturnThis(),
        orWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockImplementation(() => {
          queryCount++;
          return Promise.resolve(null); // 중복되지 않은 경우
        }),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          LoginService,
          {
            provide: getRepositoryToken(User),
            useValue: {
              createQueryBuilder: jest.fn(() => queryBuilder),
              save: jest.fn().mockResolvedValue({ id: 1 }),
            },
          },
          {
            provide: getRepositoryToken(RefreshToken),
            useValue: {},
          },
          {
            provide: AuthService,
            useValue: {
              validateUser: jest.fn(),
            },
          },
        ],
      }).compile();

      service = module.get<LoginService>(LoginService);
      userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    });

    it('should check email and userId in single query during signup', async () => {
      queryCount = 0;
      const createLoginDto = {
        email: 'test@example.com',
        userId: 'testuser',
        password: 'password123',
      };

      const result = await service.signup(createLoginDto);

      // 한 번의 쿼리로 email과 userId 중복 체크
      expect(queryCount).toBe(1);
      expect(queryBuilder.where).toHaveBeenCalledWith('user.email = :email', {
        email: createLoginDto.email,
      });
      expect(queryBuilder.orWhere).toHaveBeenCalledWith('user.userId = :userId', {
        userId: createLoginDto.userId,
      });
      expect(result).toBe('success');
    });

    it('should throw conflict error for existing userId', async () => {
      queryBuilder.getOne.mockResolvedValueOnce({
        id: 1,
        userId: 'testuser',
        email: 'other@example.com',
      });

      const createLoginDto = {
        email: 'test@example.com',
        userId: 'testuser',
        password: 'password123',
      };

      await expect(service.signup(createLoginDto)).rejects.toThrow(HttpException);
    });
  });
});
