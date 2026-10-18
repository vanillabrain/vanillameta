import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DashboardService } from './dashboard.service';
import { DashboardWidgetService } from './dashboard-widget/dashboard-widget.service';
import { UserService } from '../user/user.service';
import { AuthService } from '../auth/auth.service';
import { Dashboard } from './entities/dashboard.entity';
import { DashboardShare } from './entities/dashboard_share.entity';
import { User } from '../user/entities/user.entity';
import { UserMapping } from '../user/entities/user-mapping.entity';
import { Widget } from '../widget/entities/widget.entity';

describe('DashboardService', () => {
  let service: DashboardService;
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
        DashboardService,
        { provide: getRepositoryToken(Dashboard), useFactory: mockRepository },
        { provide: getRepositoryToken(User), useFactory: mockRepository },
        { provide: getRepositoryToken(DashboardShare), useFactory: mockRepository },
        { provide: getRepositoryToken(UserMapping), useFactory: mockRepository },
        { provide: getRepositoryToken(Widget), useFactory: mockRepository },
        { provide: DashboardWidgetService, useValue: {} },
        { provide: UserService, useValue: {} },
        { provide: AuthService, useValue: {} },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
  it('UC-006 keeps analysis mapping order when a grid save reorders presentation entries', async () => {
    const row = { id: 42, analysisDefinition: '{}', layout: '[]' };
    const repo = (service as any).dashboardRepository;
    repo.findOne.mockResolvedValue(row);
    repo.manager = { find: jest.fn().mockResolvedValue([{ widgetId: 10 }, { widgetId: 20 }]) };
    repo.update.mockImplementation(async (_id, changes) => { Object.assign(row, changes); return { affected: 1 }; });
    (service as any).widgetRepository.find.mockResolvedValue([{ id: 10 }, { id: 20 }]);
    (service as any).dashboardWidgetService.update = jest.fn();
    const layout = [
      { i: '20', x: 0, y: 3, w: 6, h: 2 },
      { i: '10', x: 6, y: 8, w: 6, h: 4 },
    ];
    await service.update(42, { layout } as any);
    expect((service as any).dashboardWidgetService.update).toHaveBeenCalledWith(42, {
      dashboardId: 42,
      widgetIds: [10, 20],
    });
    expect(row.layout).toEqual(layout);
  });
  it('keeps a concurrently enabled organization policy when a legacy edit resumes', async () => {
    const current = { id: 43, title: 'Old', layout: '[]', governed: false };
    const repo = (service as any).dashboardRepository;
    repo.findOne.mockImplementation(async () => ({ ...current }));
    repo.update.mockImplementation(async (_id, changes) => { Object.assign(current, changes); return { affected: 1 }; });
    let resume: () => void;
    let entered: () => void;
    const blocked = new Promise<void>(r => { entered = r; });
    (service as any).dashboardWidgetService.update = jest.fn(async () => {
      entered(); await new Promise<void>(r => { resume = r; });
    });
    const saving = service.update(43, { title: 'New', layout: [] } as any);
    await blocked;
    current.governed = true;
    resume();
    const result = await saving;
    expect(current).toMatchObject({ title: 'New', governed: true });
    expect(repo.update).toHaveBeenCalledWith(43, { title: 'New', layout: '[]' });
    expect(repo.save).not.toHaveBeenCalled();
    expect((result as any).data.governed).toBe(true);
  });

});
