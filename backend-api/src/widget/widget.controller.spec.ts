import { Test, TestingModule } from '@nestjs/testing';
import { WidgetController } from './widget.controller';
import { WidgetService } from './widget.service';

describe('WidgetController', () => {
  let controller: WidgetController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WidgetController],
      providers: [WidgetService],
    }).compile();

    controller = module.get<WidgetController>(WidgetController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
