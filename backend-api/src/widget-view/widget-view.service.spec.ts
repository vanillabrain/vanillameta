import { Test, TestingModule } from '@nestjs/testing';
import { WidgetViewService } from './widget-view.service';

describe('WidgetViewService', () => {
  let service: WidgetViewService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WidgetViewService],
    }).compile();

    service = module.get<WidgetViewService>(WidgetViewService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
