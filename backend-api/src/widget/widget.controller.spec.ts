import { Test, TestingModule } from '@nestjs/testing';
import { WidgetController } from './widget.controller';
import { WidgetService } from './widget.service';
import { TableQueryService } from './table-query/table-query.service';
import { commonTestProviders } from '../../test/util/test-providers';

describe('WidgetController', () => {
  let controller: WidgetController;

  // Mock TableQueryService (not in commonTestProviders)
  const mockTableQueryService = {
    findWidgetDataById: jest.fn(),
    executeTableQuery: jest.fn(),
    getTableStructure: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WidgetController],
      providers: [
        WidgetService,
        {
          provide: TableQueryService,
          useValue: mockTableQueryService,
        },
        ...commonTestProviders,
      ],
    }).compile();

    controller = module.get<WidgetController>(WidgetController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
