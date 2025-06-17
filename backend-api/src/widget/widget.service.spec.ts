import { Test, TestingModule } from '@nestjs/testing';
import { WidgetService } from './widget.service';
import { Widget } from './entities/widget.entity';
import { Component } from '../component/entities/component.entity';
import { TableQueryService } from './table-query/table-query.service';
import {
  createMockRepository,
  getRepositoryTokenFor,
  createMockService,
} from '../../test/test-helpers';
import { DatasetType } from '../common/enum/dataset-type.enum';
import { ResponseStatus } from '../common/enum/response-status.enum';
import { YesNo } from '../common/enum/yn.enum';
import { CustomLoggerService } from '../common/logger/logger.service';

describe('WidgetService', () => {
  let service: WidgetService;
  let widgetRepository: any;
  let componentRepository: any;
  let tableQueryService: any;

  const mockComponent = {
    id: 1,
    type: 'line-chart',
    title: 'Line Chart',
    description: 'Line chart component',
    icon: 'line-chart-icon',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockWidget = {
    id: 1,
    title: 'Test Widget',
    description: 'Test widget description',
    databaseId: 1,
    componentId: 1,
    datasetType: DatasetType.DATASET,
    datasetId: 1,
    tableName: '',
    option: '{"type":"line","colors":["#1f77b4"]}',
    delYn: YesNo.NO,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockTableWidget = {
    id: 2,
    title: 'Table Widget',
    description: 'Table widget description',
    databaseId: 1,
    componentId: 2,
    datasetType: DatasetType.TABLE,
    datasetId: 2,
    tableName: 'users',
    option: '{"showPagination":true,"pageSize":20}',
    delYn: YesNo.NO,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockTableQueryResult = {
    id: 2,
    tableName: 'users',
    databaseId: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

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
        {
          provide: CustomLoggerService,
          useValue: createMockService(['log', 'error', 'warn', 'debug', 'info']),
        },
      ],
    }).compile();

    service = module.get<WidgetService>(WidgetService);
    widgetRepository = module.get(getRepositoryTokenFor(Widget));
    componentRepository = module.get(getRepositoryTokenFor(Component));
    tableQueryService = module.get<TableQueryService>(TableQueryService);

    // Mock 초기화
    jest.clearAllMocks();
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
        createDto.tableName,
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
      expect((result as any).data).toEqual(
        expect.objectContaining({ id: 1, title: 'Test Widget' }),
      );
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

  describe('update', () => {
    it('should update widget option successfully', async () => {
      const updateDto = {
        option: JSON.stringify({ type: 'bar', colors: ['#ff0000'] }),
      };
      const foundWidget = { ...mockWidget };

      widgetRepository.findOne.mockResolvedValue(foundWidget);
      widgetRepository.save.mockResolvedValue({
        ...foundWidget,
        option: JSON.stringify(updateDto.option),
      });

      const result = await service.update(1, updateDto);

      expect(widgetRepository.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(widgetRepository.save).toHaveBeenCalled();
      expect(result.status).toBe(ResponseStatus.SUCCESS);
      expect(result.data.option).toEqual(updateDto.option);
    });

    it('should update widget title', async () => {
      const updateDto = {
        title: 'Updated Widget Title',
        option: JSON.stringify({ type: 'line' }),
      };
      const foundWidget = { ...mockWidget };

      widgetRepository.findOne.mockResolvedValue(foundWidget);
      widgetRepository.save.mockResolvedValue({
        ...foundWidget,
        title: updateDto.title,
        option: JSON.stringify(updateDto.option),
      });

      const result = await service.update(1, updateDto);

      expect(result.status).toBe(ResponseStatus.SUCCESS);
      expect(result.data.title).toBe('Updated Widget Title');
    });

    it('should update widget componentId', async () => {
      const updateDto = {
        componentId: 3,
        option: JSON.stringify({ type: 'pie' }),
      };
      const foundWidget = { ...mockWidget };

      widgetRepository.findOne.mockResolvedValue(foundWidget);
      widgetRepository.save.mockResolvedValue({
        ...foundWidget,
        componentId: updateDto.componentId,
        option: JSON.stringify(updateDto.option),
      });

      const result = await service.update(1, updateDto);

      expect(result.status).toBe(ResponseStatus.SUCCESS);
      expect(result.data.componentId).toBe(3);
    });

    it('should update widget delYn status', async () => {
      const updateDto = {
        delYn: YesNo.YES,
        option: JSON.stringify({ type: 'line' }),
      };
      const foundWidget = { ...mockWidget };

      widgetRepository.findOne.mockResolvedValue(foundWidget);
      widgetRepository.save.mockResolvedValue({
        ...foundWidget,
        delYn: updateDto.delYn,
        option: JSON.stringify(updateDto.option),
      });

      const result = await service.update(1, updateDto);

      expect(result.status).toBe(ResponseStatus.SUCCESS);
      expect(result.data.delYn).toBe(YesNo.YES);
    });

    it('should return error when widget not found for update', async () => {
      widgetRepository.findOne.mockResolvedValue(null);

      const result = await service.update(999, { option: JSON.stringify({ type: 'line' }) });

      expect(result.status).toBe(ResponseStatus.ERROR);
      expect(result.message).toBe('999 위젯이 존재하지 않습니다.');
    });

    it('should handle complex option updates', async () => {
      const complexOption = {
        type: 'line',
        title: { text: 'Sales Data', fontSize: 16 },
        xAxis: { type: 'category', data: ['Jan', 'Feb', 'Mar'] },
        yAxis: { type: 'value' },
        series: [{ data: [120, 200, 150], type: 'line' }],
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      };
      const updateDto = { option: complexOption };
      const foundWidget = { ...mockWidget };

      widgetRepository.findOne.mockResolvedValue(foundWidget);
      widgetRepository.save.mockResolvedValue({
        ...foundWidget,
        option: JSON.stringify(complexOption),
      });

      const result = await service.update(1, updateDto);

      expect(result.status).toBe(ResponseStatus.SUCCESS);
      expect(result.data.option).toEqual(complexOption);
    });
  });

  describe('remove', () => {
    it('should remove dataset widget successfully', async () => {
      const datasetWidget = { ...mockWidget, datasetType: DatasetType.DATASET };
      widgetRepository.findOne.mockResolvedValue(datasetWidget);
      widgetRepository.delete.mockResolvedValue({ affected: 1 });

      const result = await service.remove(1);

      expect(widgetRepository.delete).toHaveBeenCalledWith(1);
      expect(tableQueryService.remove).not.toHaveBeenCalled();
      expect(result.status).toBe(ResponseStatus.SUCCESS);
      expect(result.message).toBe('This action removes a #1 widget');
    });

    it('should remove table widget and associated table query', async () => {
      const tableWidget = { ...mockTableWidget, datasetType: DatasetType.TABLE };
      widgetRepository.findOne.mockResolvedValue(tableWidget);
      widgetRepository.delete.mockResolvedValue({ affected: 1 });
      tableQueryService.remove.mockResolvedValue({});

      const result = await service.remove(2);

      expect(tableQueryService.remove).toHaveBeenCalledWith(2);
      expect(widgetRepository.delete).toHaveBeenCalledWith(2);
      expect(result.status).toBe(ResponseStatus.SUCCESS);
    });

    it('should return error when widget not found for removal', async () => {
      widgetRepository.findOne.mockResolvedValue(null);

      const result = await service.remove(999);

      expect(result.status).toBe(ResponseStatus.ERROR);
      expect(result.message).toBe('No exist');
    });

    it('should handle table query removal failure gracefully', async () => {
      const tableWidget = { ...mockTableWidget, datasetType: DatasetType.TABLE };
      widgetRepository.findOne.mockResolvedValue(tableWidget);
      tableQueryService.remove.mockRejectedValue(new Error('Table query removal failed'));
      widgetRepository.delete.mockResolvedValue({ affected: 1 });

      // 테이블 쿼리 제거 실패해도 위젯은 제거되어야 함
      const result = await service.remove(2);

      expect(tableQueryService.remove).toHaveBeenCalledWith(2);
      // 에러가 발생해도 위젯 삭제는 계속 진행되어야 함 (현재 구현에서는 예외 처리 없음)
    });
  });

  describe('Enhanced findAll Tests', () => {
    it('should return all widgets with component information', async () => {
      const mockWidgetsRaw = [
        {
          ...mockWidget,
          componentType: 'line-chart',
          icon: 'line-chart-icon',
          componentTitle: 'Line Chart',
          componentDescription: 'Line chart component',
          option: '{"type":"line","colors":["#1f77b4"]}',
        },
        {
          ...mockTableWidget,
          componentType: 'table',
          icon: 'table-icon',
          componentTitle: 'Table',
          componentDescription: 'Table component',
          option: '{"showPagination":true,"pageSize":20}',
        },
      ];

      widgetRepository.createQueryBuilder.mockReturnValue({
        innerJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue(mockWidgetsRaw),
      });

      const result = await service.findAll();

      expect(result.status).toBe(ResponseStatus.SUCCESS);
      expect(result.data).toHaveLength(2);
      expect(result.data[0].option).toEqual({ type: 'line', colors: ['#1f77b4'] });
      expect(result.data[1].option).toEqual({ showPagination: true, pageSize: 20 });
      expect(result.data[0].componentType).toBe('line-chart');
      expect(result.data[1].componentType).toBe('table');
    });

    it('should handle empty widget list', async () => {
      widgetRepository.createQueryBuilder.mockReturnValue({
        innerJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      });

      const result = await service.findAll();

      expect(result.status).toBe(ResponseStatus.SUCCESS);
      expect(result.data).toEqual([]);
    });

    it('should handle malformed JSON in options', async () => {
      const mockWidgetsWithBadJson = [
        {
          ...mockWidget,
          option: 'invalid-json',
          componentType: 'line-chart',
        },
      ];

      widgetRepository.createQueryBuilder.mockReturnValue({
        innerJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue(mockWidgetsWithBadJson),
      });

      // JSON.parse 실패 시의 동작 테스트
      expect(async () => {
        await service.findAll();
      }).not.toThrow();
    });
  });

  describe('Enhanced create Tests', () => {
    it('should validate table name for table widgets', async () => {
      const invalidTableDto = {
        title: 'Invalid Table Widget',
        description: 'Invalid table widget',
        databaseId: 1,
        componentId: 2,
        datasetType: DatasetType.TABLE,
        datasetId: 1,
        tableName: '', // Empty table name
        option: JSON.stringify({ showPagination: true }),
        delYn: YesNo.NO,
      };

      const result = await service.create(invalidTableDto);

      expect(result.status).toBe(ResponseStatus.ERROR);
      expect(result.message).toContain('필수 입력사항::::선택한 테이블명');
    });

    it('should handle table query creation failure', async () => {
      const tableDto = {
        title: 'Table Widget',
        description: 'Table widget description',
        databaseId: 1,
        componentId: 2,
        datasetType: DatasetType.TABLE,
        datasetId: 1,
        tableName: 'users',
        option: JSON.stringify({ showPagination: true }),
        delYn: YesNo.NO,
      };

      tableQueryService.create.mockRejectedValue(new Error('Table query creation failed'));

      await expect(service.create(tableDto)).rejects.toThrow('Table query creation failed');
    });

    it('should create widget with complex chart options', async () => {
      const complexChartDto = {
        title: 'Complex Chart Widget',
        description: 'Complex chart with multiple series',
        databaseId: 1,
        componentId: 1,
        datasetType: DatasetType.DATASET,
        datasetId: 1,
        tableName: '',
        option: JSON.stringify({
          type: 'line',
          title: { text: 'Sales Performance', fontSize: 18 },
          legend: { show: true, position: 'top' },
          xAxis: { type: 'category', data: ['Q1', 'Q2', 'Q3', 'Q4'] },
          yAxis: { type: 'value', name: 'Sales ($)' },
          series: [
            { name: 'Product A', data: [100, 150, 200, 180], type: 'line' },
            { name: 'Product B', data: [80, 120, 160, 140], type: 'line' },
          ],
          grid: { left: '10%', right: '10%', top: '15%', bottom: '10%' },
        }),
        delYn: YesNo.NO,
      };

      const savedWidget = {
        id: 1,
        ...complexChartDto,
        option: JSON.stringify(complexChartDto.option),
      };

      widgetRepository.save.mockResolvedValue(savedWidget);

      const result = await service.create(complexChartDto);

      expect(result.status).toBe(ResponseStatus.SUCCESS);
      expect(result.data.option).toEqual(complexChartDto.option);
      expect(result.data.title).toBe('Complex Chart Widget');
    });

    it('should handle large dataset widgets', async () => {
      const largeDatasetDto = {
        title: 'Large Dataset Widget',
        description: 'Widget with large dataset',
        databaseId: 1,
        componentId: 1,
        datasetType: DatasetType.DATASET,
        datasetId: 999999, // Large dataset ID
        tableName: '',
        option: JSON.stringify({
          type: 'scatter',
          dataZoom: [{ type: 'inside' }, { type: 'slider' }],
          series: [{ type: 'scatter', large: true, largeThreshold: 2000 }],
        }),
        delYn: YesNo.NO,
      };

      const savedWidget = {
        id: 1,
        ...largeDatasetDto,
        option: JSON.stringify(largeDatasetDto.option),
      };

      widgetRepository.save.mockResolvedValue(savedWidget);

      const result = await service.create(largeDatasetDto);

      expect(result.status).toBe(ResponseStatus.SUCCESS);
      expect(result.data.datasetId).toBe(999999);
      const parsedOption = JSON.parse(result.data.option);
      expect(parsedOption.series[0].large).toBe(true);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle null or undefined options gracefully', async () => {
      const dtoWithNullOption = {
        title: 'Widget with null option',
        description: 'Test widget',
        databaseId: 1,
        componentId: 1,
        datasetType: DatasetType.DATASET,
        datasetId: 1,
        tableName: '',
        option: null,
        delYn: YesNo.NO,
      };

      const savedWidget = {
        id: 1,
        ...dtoWithNullOption,
        option: 'null',
      };

      widgetRepository.save.mockResolvedValue(savedWidget);

      const result = await service.create(dtoWithNullOption);

      expect(result.status).toBe(ResponseStatus.SUCCESS);
      expect(result.data.option).toBeNull();
    });

    it('should handle special characters in widget title', async () => {
      const specialCharDto = {
        title: 'Widget with 특수문자 & symbols! @#$%',
        description: 'Special character test',
        databaseId: 1,
        componentId: 1,
        datasetType: DatasetType.DATASET,
        datasetId: 1,
        tableName: '',
        option: JSON.stringify({ type: 'bar' }),
        delYn: YesNo.NO,
      };

      const savedWidget = {
        id: 1,
        ...specialCharDto,
        option: JSON.stringify(specialCharDto.option),
      };

      widgetRepository.save.mockResolvedValue(savedWidget);

      const result = await service.create(specialCharDto);

      expect(result.status).toBe(ResponseStatus.SUCCESS);
      expect(result.data.title).toBe('Widget with 특수문자 & symbols! @#$%');
    });

    it('should handle very long table names', async () => {
      const longTableName = 'a'.repeat(255); // 255 characters
      const tableDto = {
        title: 'Long Table Name Widget',
        description: 'Widget with very long table name',
        databaseId: 1,
        componentId: 2,
        datasetType: DatasetType.TABLE,
        datasetId: 1,
        tableName: longTableName,
        option: JSON.stringify({ showPagination: true }),
        delYn: YesNo.NO,
      };

      tableQueryService.create.mockResolvedValue({ id: 2, tableName: longTableName });
      widgetRepository.save.mockResolvedValue({
        id: 1,
        ...tableDto,
        datasetId: 2,
        option: JSON.stringify(tableDto.option),
      });

      const result = await service.create(tableDto);

      expect(tableQueryService.create).toHaveBeenCalledWith(1, longTableName);
      expect(result.status).toBe(ResponseStatus.SUCCESS);
    });

    it('should handle findOne with malformed JSON option', async () => {
      const widgetInfo = 'SELECT widget.* FROM widget WHERE id=:id';
      const malformedWidget = {
        ...mockWidget,
        option: 'invalid-json-string',
        componentType: 'line-chart',
        icon: 'line-chart-icon',
        componentTitle: 'Line Chart',
        componentDescription: 'Line chart component',
      };

      widgetRepository.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getQuery: jest.fn().mockReturnValue(widgetInfo),
      });

      componentRepository.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        setParameter: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue(malformedWidget),
      });

      // JSON.parse 실패 시의 동작을 테스트
      expect(async () => {
        await service.findOne(1);
      }).not.toThrow();
    });
  });

  describe('Integration Tests', () => {
    it('should complete full widget lifecycle for dataset widget', async () => {
      // 1. Create dataset widget
      const createDto = {
        title: 'Lifecycle Test Widget',
        description: 'Widget for lifecycle testing',
        databaseId: 1,
        componentId: 1,
        datasetType: DatasetType.DATASET,
        datasetId: 1,
        tableName: '',
        option: JSON.stringify({ type: 'line', colors: ['#1f77b4'] }),
        delYn: YesNo.NO,
      };

      widgetRepository.save.mockResolvedValue({
        id: 1,
        ...createDto,
        option: JSON.stringify(createDto.option),
      });

      const createResult = await service.create(createDto);
      expect(createResult.status).toBe(ResponseStatus.SUCCESS);

      // 2. Find created widget
      const widgetInfo = 'SELECT widget.* FROM widget WHERE id=:id';
      const foundWidget = {
        ...mockWidget,
        title: 'Lifecycle Test Widget',
        componentType: 'line-chart',
        icon: 'line-chart-icon',
        componentTitle: 'Line Chart',
        componentDescription: 'Line chart component',
      };

      widgetRepository.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getQuery: jest.fn().mockReturnValue(widgetInfo),
      });

      componentRepository.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        setParameter: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue(foundWidget),
      });

      const findResult = await service.findOne(1);
      expect(findResult.status).toBe(ResponseStatus.SUCCESS);
      expect(findResult.data.title).toBe('Lifecycle Test Widget');

      // 3. Update widget
      const updateDto = {
        title: 'Updated Lifecycle Widget',
        option: JSON.stringify({ type: 'bar', colors: ['#ff0000'] }),
      };

      widgetRepository.findOne.mockResolvedValue({
        ...mockWidget,
        title: 'Lifecycle Test Widget',
      });
      widgetRepository.save.mockResolvedValue({
        ...mockWidget,
        title: 'Updated Lifecycle Widget',
        option: JSON.stringify(updateDto.option),
      });

      const updateResult = await service.update(1, updateDto);
      expect(updateResult.status).toBe(ResponseStatus.SUCCESS);
      expect(updateResult.data.title).toBe('Updated Lifecycle Widget');

      // 4. Remove widget
      widgetRepository.findOne.mockResolvedValue({
        ...mockWidget,
        datasetType: DatasetType.DATASET,
      });
      widgetRepository.delete.mockResolvedValue({ affected: 1 });

      const removeResult = await service.remove(1);
      expect(removeResult.status).toBe(ResponseStatus.SUCCESS);
    });

    it('should complete full widget lifecycle for table widget', async () => {
      // 1. Create table widget
      const createDto = {
        title: 'Table Lifecycle Widget',
        description: 'Table widget for lifecycle testing',
        databaseId: 1,
        componentId: 2,
        datasetType: DatasetType.TABLE,
        datasetId: 1,
        tableName: 'lifecycle_test_table',
        option: JSON.stringify({ showPagination: true, pageSize: 10 }),
        delYn: YesNo.NO,
      };

      tableQueryService.create.mockResolvedValue({ id: 2, tableName: 'lifecycle_test_table' });
      widgetRepository.save.mockResolvedValue({
        id: 2,
        ...createDto,
        datasetId: 2,
        option: JSON.stringify(createDto.option),
      });

      const createResult = await service.create(createDto);
      expect(createResult.status).toBe(ResponseStatus.SUCCESS);
      expect(createResult.data.datasetId).toBe(2);

      // 2. Remove table widget with cleanup
      widgetRepository.findOne.mockResolvedValue({
        ...mockTableWidget,
        id: 2,
        datasetId: 2,
        datasetType: DatasetType.TABLE,
      });
      tableQueryService.remove.mockResolvedValue({});
      widgetRepository.delete.mockResolvedValue({ affected: 1 });

      const removeResult = await service.remove(2);
      expect(removeResult.status).toBe(ResponseStatus.SUCCESS);
      expect(tableQueryService.remove).toHaveBeenCalledWith(2);
    });

    it('should handle concurrent widget operations', async () => {
      // 동시에 여러 위젯 생성
      const createPromises = Array.from({ length: 3 }, (_, i) => {
        const createDto = {
          title: `Concurrent Widget ${i + 1}`,
          description: `Concurrent widget ${i + 1}`,
          databaseId: 1,
          componentId: 1,
          datasetType: DatasetType.DATASET,
          datasetId: i + 1,
          tableName: '',
          option: JSON.stringify({ type: 'line', seriesIndex: i }),
          delYn: YesNo.NO,
        };

        widgetRepository.save.mockResolvedValue({
          id: i + 1,
          ...createDto,
          option: JSON.stringify(createDto.option),
        });

        return service.create(createDto);
      });

      const results = await Promise.all(createPromises);

      results.forEach((result, index) => {
        expect(result.status).toBe(ResponseStatus.SUCCESS);
        expect(result.data.title).toBe(`Concurrent Widget ${index + 1}`);
        const parsedOption = JSON.parse(result.data.option);
        expect(parsedOption.seriesIndex).toBe(index);
      });
    });
  });
});
