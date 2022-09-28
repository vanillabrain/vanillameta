import { Test, TestingModule } from '@nestjs/testing';
import { WidgetService } from './widget.service';

describe('WidgetService', () => {
  let service: WidgetService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WidgetService],
    }).compile();

    service = module.get<WidgetService>(WidgetService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
