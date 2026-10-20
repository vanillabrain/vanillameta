import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ShareUrlService } from './share-url.service';
import { AuthService } from '../auth/auth.service';
import { DashboardService } from '../dashboard/dashboard.service';
import { User } from '../user/entities/user.entity';
import { Dashboard } from '../dashboard/entities/dashboard.entity';
import { DashboardShare } from '../dashboard/entities/dashboard_share.entity';

describe('ShareUrlService', () => {
  let service: ShareUrlService;
  const mockRepository = () => ({
    find: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(),
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShareUrlService,
        { provide: getRepositoryToken(User), useFactory: mockRepository },
        { provide: getRepositoryToken(Dashboard), useFactory: mockRepository },
        { provide: getRepositoryToken(DashboardShare), useFactory: mockRepository },
        { provide: AuthService, useValue: {} },
        { provide: DashboardService, useValue: {} },
      ],
    }).compile();

    service = module.get<ShareUrlService>(ShareUrlService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
