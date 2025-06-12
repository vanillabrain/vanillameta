import { Test, TestingModule } from '@nestjs/testing';
import { WidgetService } from './widget.service';
import { Widget } from './entities/widget.entity';
import { Component } from '../component/entities/component.entity';
import { TableQueryService } from './tabel-query/table-query.service';
import { createMockRepository, getRepositoryTokenFor, createMockService } from '../../test/test-helpers';
import { DatasetType } from '../common/enum/dataset-type.enum';
import { ResponseStatus } from '../common/enum/response-status.enum';

describe('WidgetService', () => {
  let service: WidgetService;
  let widgetRepository: any;
  let componentRepository: any;
  let tableQueryService: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WidgetService,
        {
          provide: getRepositoryTokenFor(Widget),
          useValue: createMockRepository(),
        },
        {
          provide: getRepositoryTokenFor(Component),
          useValue: createMockRepository(),
        },
        {
          provide: TableQueryService,
          useValue: createMockService(['create', 'findAll', 'update', 'remove']),
        },
      ],
    }).compile();

    service = module.get<WidgetService>(WidgetService);
    widgetRepository = module.get(getRepositoryTokenFor(Widget));
    componentRepository = module.get(getRepositoryTokenFor(Component));
    tableQueryService = module.get<TableQueryService>(TableQueryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new widget with query dataset', async () => {
      const createDto = {
        title: 'Test Widget',
        description: 'Test description',
        databaseId: 1,
        componentId: 1,
        datasetType: DatasetType.DATASET,
        datasetId: 1,
        tableName: '',
        option: '{"type":"line"}',
        delYn: 'N',
      };
      const savedWidget = { id: 1, ...createDto };
      
      widgetRepository.save.mockResolvedValue(savedWidget);

      const result = await service.create(createDto);

      expect(widgetRepository.save).toHaveBeenCalled();
      expect(result.status).toBe(ResponseStatus.SUCCESS);
      expect(result.data).toEqual(savedWidget);
    });

    it('should create a widget with table dataset', async () => {
      const createDto = {
        title: 'Table Widget',
        description: 'Table description',
        databaseId: 1,
        componentId: 2,
        datasetType: DatasetType.TABLE,
        datasetId: 1,
        tableName: 'users',
        option: '{"showPagination":true}',
        delYn: 'N',
      };
      const savedWidget = { id: 1, ...createDto };
      const tableQueryResult = { id: 1, tableName: 'users' };
      
      widgetRepository.save.mockResolvedValue(savedWidget);
      tableQueryService.create.mockResolvedValue(tableQueryResult);

      const result = await service.create(createDto);

      expect(tableQueryService.create).toHaveBeenCalledWith(
        createDto.databaseId,
        createDto.tableName
      );
    });
  });

  describe('findAll', () => {
    it('should return all widgets', async () => {
      const mockWidgets = [
        { id: 1, title: 'Widget 1', datasetType: DatasetType.DATASET, option: '{}' },
        { id: 2, title: 'Widget 2', datasetType: DatasetType.TABLE, option: '{}' },
      ];
      widgetRepository.createQueryBuilder.mockReturnValue({
        innerJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue(mockWidgets),
      });

      const result = await service.findAll();

      expect(result.status).toBe(ResponseStatus.SUCCESS);
      expect(result.data).toHaveLength(2);
    });
  });

  describe('findOne', () => {
    it('should return a widget by id', async () => {
      const mockWidget = { id: 1, title: 'Test Widget', option: '{}' };
      
      // widgetRepository.createQueryBuilder를 모킹
      widgetRepository.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getQuery: jest.fn().mockReturnValue('SELECT widget.* FROM widget WHERE id=?'),
      });
      
      componentRepository.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        setParameter: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue(mockWidget),
      });

      const result = await service.findOne(1);

      expect((result as any).status).toBe(ResponseStatus.SUCCESS);
      expect((result as any).data).toEqual(expect.objectContaining({ id: 1, title: 'Test Widget' }));
    });

    it('should return error when widget not found', async () => {
      // widgetRepository.createQueryBuilder를 모킹
      widgetRepository.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getQuery: jest.fn().mockReturnValue('SELECT widget.* FROM widget WHERE id=?'),
      });
      
      componentRepository.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        setParameter: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue(null),
      });

      const result = await service.findOne(999);

      expect((result as any).status).toBe(ResponseStatus.ERROR);
      expect((result as any).message).toContain('위젯이 존재하지 않습니다');
    });
  });

  describe('remove', () => {
    it('should remove widget successfully', async () => {
      const mockWidget = { id: 1, title: 'Test Widget', datasetType: DatasetType.DATASET };
      widgetRepository.findOne.mockResolvedValue(mockWidget);
      widgetRepository.delete.mockResolvedValue({ affected: 1 });

      const result = await service.remove(1);

      expect(widgetRepository.delete).toHaveBeenCalledWith(1);
      expect(result.status).toBe(ResponseStatus.SUCCESS);
    });

    it('should return error when widget not found for removal', async () => {
      widgetRepository.findOne.mockResolvedValue(null);

      const result = await service.remove(999);

      expect(result.status).toBe(ResponseStatus.ERROR);
    });
  });
});
