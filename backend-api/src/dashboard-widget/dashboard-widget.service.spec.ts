import { Test, TestingModule } from '@nestjs/testing';
import { DashboardWidgetService } from './dashboard-widget.service';

describe('DashboardWidgetService', () => {
  let service: DashboardWidgetService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DashboardWidgetService],
    }).compile();

    service = module.get<DashboardWidgetService>(DashboardWidgetService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
