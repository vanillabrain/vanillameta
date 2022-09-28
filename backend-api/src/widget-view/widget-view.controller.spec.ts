import { Test, TestingModule } from '@nestjs/testing';
import { WidgetViewController } from './widget-view.controller';
import { WidgetViewService } from './widget-view.service';

describe('WidgetViewController', () => {
  let controller: WidgetViewController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WidgetViewController],
      providers: [WidgetViewService],
    }).compile();

    controller = module.get<WidgetViewController>(WidgetViewController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
