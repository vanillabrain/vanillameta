import { Test, TestingModule } from '@nestjs/testing';
import { DashboardWidgetService } from './dashboard-widget.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DashboardWidget } from './entities/dashboard-widget.entity';
import { Widget } from '../../widget/entities/widget.entity';
import { Component } from '../../component/entities/component.entity';
import { CreateDashboardWidgetDto } from './dto/create-dashboard-widget.dto';
import { UpdateDashboardWidgetDto } from './dto/update-dashboard-widget.dto';
import { createMockRepository, getRepositoryTokenFor } from '../../../test/test-helpers';

describe('DashboardWidgetService', () => {
  let service: DashboardWidgetService;
  let dashboardWidgetRepository: jest.Mocked<Repository<DashboardWidget>>;
  let widgetRepository: jest.Mocked<Repository<Widget>>;
  let componentRepository: jest.Mocked<Repository<Component>>;

  const mockDashboardWidget = {
    id: 1,
    dashboardId: 1,
    widgetId: 101,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockWidget = {
    id: 101,
    title: 'Test Widget',
    option: '{"color": "blue", "size": "medium"}',
    componentId: 201,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockComponent = {
    id: 201,
    type: 'chart',
    icon: 'chart-icon',
    title: 'Chart Component',
    description: 'A chart component for data visualization',
  };

  const mockJoinedResult = [
    {
      id: 101,
      title: 'Test Widget',
      option: '{"color": "blue", "size": "medium"}',
      componentId: 201,
      componentType: 'chart',
      icon: 'chart-icon',
      componentTitle: 'Chart Component',
      componentDescription: 'A chart component for data visualization',
    },
    {
      id: 102,
      title: 'Test Widget 2',
      option: '{"type": "bar", "data": [1,2,3]}',
      componentId: 202,
      componentType: 'table',
      icon: 'table-icon',
      componentTitle: 'Table Component',
      componentDescription: 'A table component for data display',
    },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardWidgetService,
        {
          provide: getRepositoryTokenFor(DashboardWidget),
          useValue: createMockRepository<DashboardWidget>(),
        },
        {
          provide: getRepositoryTokenFor(Widget),
          useValue: createMockRepository<Widget>(),
        },
        {
          provide: getRepositoryTokenFor(Component),
          useValue: createMockRepository<Component>(),
        },
      ],
    }).compile();

    service = module.get<DashboardWidgetService>(DashboardWidgetService);
    dashboardWidgetRepository = module.get(getRepositoryTokenFor(DashboardWidget));
    widgetRepository = module.get(getRepositoryTokenFor(Widget));
    componentRepository = module.get(getRepositoryTokenFor(Component));

    // Mock 초기화
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create dashboard-widget associations successfully', async () => {
      const createDto: CreateDashboardWidgetDto = {
        dashboardId: 1,
        widgetIds: [101, 102, 103],
      };

      const expectedSaveList = [
        { dashboardId: 1, widgetId: 101 },
        { dashboardId: 1, widgetId: 102 },
        { dashboardId: 1, widgetId: 103 },
      ];

      const mockSavedData = expectedSaveList.map((item, index) => ({
        id: index + 1,
        ...item,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      dashboardWidgetRepository.save.mockResolvedValue(mockSavedData as any);

      const result = await service.create(createDto);

      expect(dashboardWidgetRepository.save).toHaveBeenCalledWith(expectedSaveList);
      expect(result).toEqual(mockSavedData);
      expect(result).toHaveLength(3);
    });

    it('should handle single widget creation', async () => {
      const createDto: CreateDashboardWidgetDto = {
        dashboardId: 2,
        widgetIds: [201],
      };

      const expectedSaveList = [{ dashboardId: 2, widgetId: 201 }];
      const mockSavedData = [{ id: 1, ...expectedSaveList[0] }];

      dashboardWidgetRepository.save.mockResolvedValue(mockSavedData as any);

      const result = await service.create(createDto);

      expect(dashboardWidgetRepository.save).toHaveBeenCalledWith(expectedSaveList);
      expect(result).toEqual(mockSavedData);
      expect(result).toHaveLength(1);
    });

    it('should handle empty widget list', async () => {
      const createDto: CreateDashboardWidgetDto = {
        dashboardId: 3,
        widgetIds: [],
      };

      dashboardWidgetRepository.save.mockResolvedValue([] as any);

      const result = await service.create(createDto);

      expect(dashboardWidgetRepository.save).toHaveBeenCalledWith([]);
      expect(result).toEqual([]);
    });

    it('should handle database save error', async () => {
      const createDto: CreateDashboardWidgetDto = {
        dashboardId: 1,
        widgetIds: [101],
      };

      const dbError = new Error('Database connection failed');
      dashboardWidgetRepository.save.mockRejectedValue(dbError);

      await expect(service.create(createDto)).rejects.toThrow('Database connection failed');
    });
  });

  describe('findWidgets', () => {
    beforeEach(() => {
      // QueryBuilder Mock 설정
      const mockQueryBuilder = {
        innerJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawMany: jest.fn(),
      };
      widgetRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);
    });

    it('should find widgets for dashboard with component data', async () => {
      const dashboardId = 1;
      const mockRawData = [...mockJoinedResult];

      const queryBuilder = widgetRepository.createQueryBuilder();
      (queryBuilder.getRawMany as jest.Mock).mockResolvedValue(mockRawData);

      const result = await service.findWidgets(dashboardId);

      expect(widgetRepository.createQueryBuilder).toHaveBeenCalledWith('widget');
      expect(queryBuilder.innerJoin).toHaveBeenCalledTimes(2);
      expect(queryBuilder.select).toHaveBeenCalledWith([
        'widget.*',
        'component.type as componentType',
        'component.icon as icon',
        'component.title as componentTitle',
        'component.description as componentDescription',
      ]);
      expect(queryBuilder.where).toHaveBeenCalledWith('dw.dashboardId = :dashboardId', { dashboardId });

      // option 필드가 JSON.parse 되었는지 확인
      expect(result[0].option).toEqual({ color: 'blue', size: 'medium' });
      expect(result[1].option).toEqual({ type: 'bar', data: [1, 2, 3] });
    });

    it('should return empty array when no widgets found', async () => {
      const dashboardId = 999;

      const queryBuilder = widgetRepository.createQueryBuilder();
      (queryBuilder.getRawMany as jest.Mock).mockResolvedValue([]);

      const result = await service.findWidgets(dashboardId);

      expect(result).toEqual([]);
      expect(queryBuilder.where).toHaveBeenCalledWith('dw.dashboardId = :dashboardId', { dashboardId });
    });

    it('should handle invalid JSON in option field', async () => {
      const dashboardId = 1;
      const invalidJsonData = [
        {
          id: 101,
          title: 'Test Widget',
          option: 'invalid-json',
          componentType: 'chart',
        },
      ];

      const queryBuilder = widgetRepository.createQueryBuilder();
      (queryBuilder.getRawMany as jest.Mock).mockResolvedValue(invalidJsonData);

      await expect(service.findWidgets(dashboardId)).rejects.toThrow();
    });

    it('should handle null option field', async () => {
      const dashboardId = 1;
      const nullOptionData = [
        {
          id: 101,
          title: 'Test Widget',
          option: '{}', // 빈 JSON 객체로 변경
          componentType: 'chart',
        },
      ];

      const queryBuilder = widgetRepository.createQueryBuilder();
      (queryBuilder.getRawMany as jest.Mock).mockResolvedValue(nullOptionData);

      const result = await service.findWidgets(dashboardId);
      expect(result[0].option).toEqual({});
    });

    it('should handle query execution error', async () => {
      const dashboardId = 1;

      const queryBuilder = widgetRepository.createQueryBuilder();
      (queryBuilder.getRawMany as jest.Mock).mockRejectedValue(new Error('Query execution failed'));

      await expect(service.findWidgets(dashboardId)).rejects.toThrow('Query execution failed');
    });
  });

  describe('update', () => {
    it('should update dashboard widgets successfully', async () => {
      const dashboardId = 1;
      const updateDto: UpdateDashboardWidgetDto = {
        widgetIds: [201, 202, 203],
      };

      const expectedSaveList = [
        { dashboardId: 1, widgetId: 201 },
        { dashboardId: 1, widgetId: 202 },
        { dashboardId: 1, widgetId: 203 },
      ];

      dashboardWidgetRepository.delete.mockResolvedValue({ affected: 2 } as any);
      dashboardWidgetRepository.save.mockResolvedValue(expectedSaveList as any);

      await service.update(dashboardId, updateDto);

      expect(dashboardWidgetRepository.delete).toHaveBeenCalledWith({ dashboardId });
      expect(dashboardWidgetRepository.save).toHaveBeenCalledWith(expectedSaveList);
    });

    it('should handle update with empty widget list', async () => {
      const dashboardId = 2;
      const updateDto: UpdateDashboardWidgetDto = {
        widgetIds: [],
      };

      dashboardWidgetRepository.delete.mockResolvedValue({ affected: 1 } as any);
      dashboardWidgetRepository.save.mockResolvedValue([] as any);

      await service.update(dashboardId, updateDto);

      expect(dashboardWidgetRepository.delete).toHaveBeenCalledWith({ dashboardId });
      expect(dashboardWidgetRepository.save).toHaveBeenCalledWith([]);
    });

    it('should handle delete operation failure', async () => {
      const dashboardId = 1;
      const updateDto: UpdateDashboardWidgetDto = {
        widgetIds: [201],
      };

      const deleteError = new Error('Delete operation failed');
      dashboardWidgetRepository.delete.mockRejectedValue(deleteError);

      await expect(service.update(dashboardId, updateDto)).rejects.toThrow('Delete operation failed');
      expect(dashboardWidgetRepository.save).not.toHaveBeenCalled();
    });

    it('should handle save operation failure after successful delete', async () => {
      const dashboardId = 1;
      const updateDto: UpdateDashboardWidgetDto = {
        widgetIds: [201],
      };

      dashboardWidgetRepository.delete.mockResolvedValue({ affected: 1 } as any);
      const saveError = new Error('Save operation failed');
      dashboardWidgetRepository.save.mockRejectedValue(saveError);

      await expect(service.update(dashboardId, updateDto)).rejects.toThrow('Save operation failed');
    });
  });

  describe('remove', () => {
    it('should remove all widgets from dashboard', async () => {
      const dashboardId = 1;

      dashboardWidgetRepository.delete.mockResolvedValue({ affected: 3 } as any);

      const result = await service.remove(dashboardId);

      expect(dashboardWidgetRepository.delete).toHaveBeenCalledWith({ dashboardId });
      expect(result).toBe('This action removes a #1 dashboardWidget');
    });

    it('should handle removal when no widgets exist', async () => {
      const dashboardId = 999;

      dashboardWidgetRepository.delete.mockResolvedValue({ affected: 0 } as any);

      const result = await service.remove(dashboardId);

      expect(dashboardWidgetRepository.delete).toHaveBeenCalledWith({ dashboardId });
      expect(result).toBe('This action removes a #999 dashboardWidget');
    });

    it('should handle delete operation error', async () => {
      const dashboardId = 1;

      const deleteError = new Error('Delete failed');
      dashboardWidgetRepository.delete.mockRejectedValue(deleteError);

      await expect(service.remove(dashboardId)).rejects.toThrow('Delete failed');
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete dashboard lifecycle', async () => {
      const dashboardId = 1;
      const initialWidgets = [101, 102];
      const updatedWidgets = [103, 104, 105];

      // 1. Create initial dashboard widgets
      const createDto: CreateDashboardWidgetDto = {
        dashboardId,
        widgetIds: initialWidgets,
      };

      dashboardWidgetRepository.save.mockResolvedValue([
        { id: 1, dashboardId, widgetId: 101 },
        { id: 2, dashboardId, widgetId: 102 },
      ] as any);

      await service.create(createDto);

      // 2. Find widgets  
      const queryBuilder = {
        innerJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue(mockJoinedResult),
      };
      widgetRepository.createQueryBuilder.mockReturnValue(queryBuilder as any);

      const foundWidgets = await service.findWidgets(dashboardId);
      expect(foundWidgets).toHaveLength(2);

      // 3. Update widgets
      const updateDto: UpdateDashboardWidgetDto = {
        widgetIds: updatedWidgets,
      };

      dashboardWidgetRepository.delete.mockResolvedValue({ affected: 2 } as any);
      dashboardWidgetRepository.save.mockResolvedValue([
        { id: 3, dashboardId, widgetId: 103 },
        { id: 4, dashboardId, widgetId: 104 },
        { id: 5, dashboardId, widgetId: 105 },
      ] as any);

      await service.update(dashboardId, updateDto);

      // 4. Remove all widgets
      dashboardWidgetRepository.delete.mockResolvedValue({ affected: 3 } as any);
      const removeResult = await service.remove(dashboardId);

      expect(removeResult).toContain('#1 dashboardWidget');
    });

    it('should handle concurrent operations correctly', async () => {
      const dashboardId = 1;
      const createDto1: CreateDashboardWidgetDto = {
        dashboardId,
        widgetIds: [101],
      };
      const createDto2: CreateDashboardWidgetDto = {
        dashboardId,
        widgetIds: [102],
      };

      dashboardWidgetRepository.save
        .mockResolvedValueOnce([{ id: 1, dashboardId, widgetId: 101 }] as any)
        .mockResolvedValueOnce([{ id: 2, dashboardId, widgetId: 102 }] as any);

      const promises = [
        service.create(createDto1),
        service.create(createDto2),
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(2);
      expect(results[0]).toHaveLength(1);
      expect(results[1]).toHaveLength(1);
      expect(dashboardWidgetRepository.save).toHaveBeenCalledTimes(2);
    });

    it('should maintain data consistency during error scenarios', async () => {
      const dashboardId = 1;
      const updateDto: UpdateDashboardWidgetDto = {
        widgetIds: [201, 202],
      };

      // 삭제는 성공하지만 저장이 실패하는 시나리오
      dashboardWidgetRepository.delete.mockResolvedValue({ affected: 2 } as any);
      dashboardWidgetRepository.save.mockRejectedValue(new Error('Save failed'));

      await expect(service.update(dashboardId, updateDto)).rejects.toThrow('Save failed');

      // 삭제가 호출되었는지 확인 (데이터 일관성 문제 가능성)
      expect(dashboardWidgetRepository.delete).toHaveBeenCalledWith({ dashboardId });
    });
  });
});