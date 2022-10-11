import { Test, TestingModule } from '@nestjs/testing';
import { DashboardWidgetController } from './dashboard-widget.controller';
import { DashboardWidgetService } from './dashboard-widget.service';

describe('DashboardWidgetController', () => {
  let controller: DashboardWidgetController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DashboardWidgetController],
      providers: [DashboardWidgetService],
    }).compile();

    controller = module.get<DashboardWidgetController>(DashboardWidgetController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
