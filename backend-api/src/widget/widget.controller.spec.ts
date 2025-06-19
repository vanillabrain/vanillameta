import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { WidgetController } from './widget.controller';
import { WidgetService } from './widget.service';
import { Widget } from './entities/widget.entity';
import { Component } from '../component/entities/component.entity';
import { TableQueryService } from './table-query/table-query.service';
import { CustomLoggerService } from '../common/logger/logger.service';
import { PaginationService } from '../common/services/pagination.service';

describe('WidgetController', () => {
  let controller: WidgetController;

  const mockWidgetRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn().mockReturnValue({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getMany: jest.fn(),
    }),
  };

  const mockComponentRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
  };

  const mockTableQueryService = {
    findWidgetDataById: jest.fn(),
  };

  const mockCustomLoggerService = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
  };

  const mockPaginationService = {
    paginate: jest.fn(),
    getPaginationMeta: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WidgetController],
      providers: [
        WidgetService,
        {
          provide: getRepositoryToken(Widget),
          useValue: mockWidgetRepository,
        },
        {
          provide: getRepositoryToken(Component),
          useValue: mockComponentRepository,
        },
        {
          provide: TableQueryService,
          useValue: mockTableQueryService,
        },
        {
          provide: CustomLoggerService,
          useValue: mockCustomLoggerService,
        },
        {
          provide: PaginationService,
          useValue: mockPaginationService,
        },
      ],
    }).compile();

    controller = module.get<WidgetController>(WidgetController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
