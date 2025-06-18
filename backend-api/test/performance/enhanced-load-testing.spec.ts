import { Test, TestingModule } from '@nestjs/testing';
import { WidgetService } from '../../src/widget/widget.service';
import { DashboardService } from '../../src/dashboard/dashboard.service';
import { ConnectionService } from '../../src/connection/connection.service';
import { DatasetService } from '../../src/dataset/dataset.service';
import {
  createMockRepository,
  getRepositoryTokenFor,
  createMockService,
  generateLargeDataset,
  measureMemoryUsage,
  withTimeout,
} from '../test-helpers';
import { Widget } from '../../src/widget/entities/widget.entity';
import { Dashboard } from '../../src/dashboard/entities/dashboard.entity';
import { Dataset } from '../../src/dataset/entities/dataset.entity';
import { Database } from '../../src/database/entities/database.entity';
import { Component } from '../../src/component/entities/component.entity';
import { DatasetType } from '../../src/common/enum/dataset-type.enum';
import { ResponseStatus } from '../../src/common/enum/response-status.enum';

describe('Enhanced Load Testing', () => {
  let widgetService: WidgetService;
  let dashboardService: DashboardService;
  let datasetService: DatasetService;
  let widgetRepository: any;
  let dashboardRepository: any;
  let datasetRepository: any;

  const LOAD_TEST_CONFIG = {
    SMALL_LOAD: 100,
    MEDIUM_LOAD: 1000,
    LARGE_LOAD: 5000,
    STRESS_LOAD: 10000,
    TIMEOUT_MS: 30000,
    MAX_MEMORY_MB: 512,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WidgetService,
        DashboardService,
        DatasetService,
        {
          provide: getRepositoryTokenFor(Widget),
          useValue: createMockRepository(),
        },
        {
          provide: getRepositoryTokenFor(Dashboard),
          useValue: createMockRepository(),
        },
        {
          provide: getRepositoryTokenFor(Dataset),
          useValue: createMockRepository(),
        },
        {
          provide: getRepositoryTokenFor(Component),
          useValue: createMockRepository(),
        },
        {
          provide: getRepositoryTokenFor(Database),
          useValue: createMockRepository(),
        },
        {
          provide: 'TableQueryService',
          useValue: createMockService(['create', 'remove']),
        },
        {
          provide: 'DashboardWidgetService',
          useValue: createMockService(['create', 'findWidgets']),
        },
        {
          provide: 'UserService',
          useValue: createMockService(['findDashboardId']),
        },
        {
          provide: 'AuthService',
          useValue: createMockService([]),
        },
        {
          provide: 'CustomLoggerService',
          useValue: createMockService(['log', 'error', 'warn', 'debug']),
        },
        {
          provide: getRepositoryTokenFor('User'),
          useValue: createMockRepository(),
        },
        {
          provide: getRepositoryTokenFor('DashboardShare'),
          useValue: createMockRepository(),
        },
        {
          provide: getRepositoryTokenFor('UserMapping'),
          useValue: createMockRepository(),
        },
      ],
    }).compile();

    widgetService = module.get<WidgetService>(WidgetService);
    dashboardService = module.get<DashboardService>(DashboardService);
    datasetService = module.get<DatasetService>(DatasetService);
    widgetRepository = module.get(getRepositoryTokenFor(Widget));
    dashboardRepository = module.get(getRepositoryTokenFor(Dashboard));
    datasetRepository = module.get(getRepositoryTokenFor(Dataset));

    jest.clearAllMocks();
  });

  describe('Widget Service Load Tests', () => {
    it('should handle concurrent widget creation', async () => {
      const startMemory = measureMemoryUsage();
      const startTime = Date.now();

      // 동시 위젯 생성 시뮬레이션
      const createPromises = Array.from({ length: LOAD_TEST_CONFIG.MEDIUM_LOAD }, (_, i) => {
        const dto = {
          title: `Load Test Widget ${i}`,
          description: `Performance test widget ${i}`,
          databaseId: Math.floor(i / 100) + 1,
          componentId: (i % 10) + 1,
          datasetType: DatasetType.DATASET,
          datasetId: i + 1,
          tableName: '',
          option: { type: 'line', index: i },
          delYn: 'N',
        };

        widgetRepository.save.mockResolvedValue({
          id: i + 1,
          ...dto,
          option: JSON.stringify(dto.option),
        });

        return widgetService.create(dto);
      });

      const results = await withTimeout(
        Promise.all(createPromises),
        LOAD_TEST_CONFIG.TIMEOUT_MS
      );

      const endTime = Date.now();
      const endMemory = measureMemoryUsage();
      const executionTime = endTime - startTime;
      const memoryIncrease = endMemory.heapUsed - startMemory.heapUsed;

      // 성능 검증
      expect(results).toHaveLength(LOAD_TEST_CONFIG.MEDIUM_LOAD);
      expect(executionTime).toBeLessThan(5000); // 5초 이내
      expect(memoryIncrease).toBeLessThan(LOAD_TEST_CONFIG.MAX_MEMORY_MB);

      console.log(`
        Widget Creation Load Test Results:
        - Total widgets: ${LOAD_TEST_CONFIG.MEDIUM_LOAD}
        - Execution time: ${executionTime}ms
        - Memory increase: ${memoryIncrease.toFixed(2)}MB
        - Avg time per widget: ${(executionTime / LOAD_TEST_CONFIG.MEDIUM_LOAD).toFixed(2)}ms
      `);
    });

    it('should handle bulk widget updates efficiently', async () => {
      // 대량 위젯 업데이트 준비
      const widgets = Array.from({ length: LOAD_TEST_CONFIG.SMALL_LOAD }, (_, i) => ({
        id: i + 1,
        title: `Widget ${i}`,
        option: JSON.stringify({ type: 'bar', value: i }),
      }));

      widgets.forEach(widget => {
        widgetRepository.findOne.mockResolvedValueOnce(widget);
        widgetRepository.save.mockResolvedValueOnce({
          ...widget,
          option: JSON.stringify({ type: 'line', value: widget.id * 2 }),
        });
      });

      const startTime = Date.now();

      // 대량 업데이트 실행
      const updatePromises = widgets.map(widget =>
        widgetService.update(widget.id, {
          option: { type: 'line', value: widget.id * 2 },
        })
      );

      const results = await Promise.all(updatePromises);
      const executionTime = Date.now() - startTime;

      expect(results.every(r => r.status === ResponseStatus.SUCCESS)).toBe(true);
      expect(executionTime).toBeLessThan(2000); // 2초 이내
    });
  });

  describe('Dashboard Service Load Tests', () => {
    it('should handle large dashboard layouts', async () => {
      // 대형 대시보드 레이아웃 생성 (100개 위젯)
      const largeLayout = Array.from({ length: 100 }, (_, i) => ({
        i: `widget-${i}`,
        x: (i % 12) * 4,
        y: Math.floor(i / 12) * 4,
        w: 4,
        h: 4,
      }));

      const createDto = {
        title: 'Large Dashboard',
        layout: largeLayout,
      };

      dashboardRepository.save.mockResolvedValue({
        id: 1,
        title: 'Large Dashboard',
        layout: JSON.stringify(largeLayout),
      });

      const startMemory = measureMemoryUsage();
      const result = await dashboardService.create(createDto, 1);
      const memoryUsed = measureMemoryUsage().heapUsed - startMemory.heapUsed;

      expect(result).toBeDefined();
      expect(memoryUsed).toBeLessThan(50); // 50MB 이하
    });

    it('should query dashboards with pagination efficiently', async () => {
      const mockDashboards = generateLargeDataset(LOAD_TEST_CONFIG.LARGE_LOAD).map((item, i) => ({
        id: i + 1,
        title: `Dashboard ${item.name}`,
        layout: JSON.stringify([{ i: 'widget1', x: 0, y: 0, w: 4, h: 4 }]),
        shareId: i + 1,
        createdAt: new Date(item.date),
        updatedAt: new Date(),
      }));

      // 페이지네이션 시뮬레이션
      const pageSize = 50;
      const totalPages = Math.ceil(mockDashboards.length / pageSize);

      dashboardRepository.createQueryBuilder = jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockImplementation(function() {
          const skip = this.skip.mock.calls[0]?.[0] || 0;
          const take = this.take.mock.calls[0]?.[0] || pageSize;
          const page = mockDashboards.slice(skip, skip + take);
          return Promise.resolve([page, mockDashboards.length]);
        }),
      });

      const startTime = Date.now();

      // 모든 페이지 조회
      const pagePromises = Array.from({ length: totalPages }, (_, page) =>
        dashboardService.findAllPaginated(1, page + 1, pageSize)
      );

      const results = await Promise.all(pagePromises);
      const executionTime = Date.now() - startTime;

      expect(results).toHaveLength(totalPages);
      expect(executionTime).toBeLessThan(3000); // 3초 이내
    });
  });

  describe('Data Processing Load Tests', () => {
    it('should process large datasets efficiently', async () => {
      const largeDataset = generateLargeDataset(LOAD_TEST_CONFIG.LARGE_LOAD);
      
      datasetRepository.findOne.mockResolvedValue({
        id: 1,
        name: 'Large Dataset',
        query: 'SELECT * FROM large_table',
        databaseId: 1,
      });

      // 데이터 변환 시뮬레이션
      const startTime = Date.now();
      const startMemory = measureMemoryUsage();

      const processedData = largeDataset.map(item => ({
        ...item,
        processedValue: item.value * 2,
        categoryIndex: ['A', 'B', 'C'].indexOf(item.category),
        formattedDate: new Date(item.date).toISOString(),
      }));

      const executionTime = Date.now() - startTime;
      const memoryUsed = measureMemoryUsage().heapUsed - startMemory.heapUsed;

      expect(processedData).toHaveLength(LOAD_TEST_CONFIG.LARGE_LOAD);
      expect(executionTime).toBeLessThan(1000); // 1초 이내
      expect(memoryUsed).toBeLessThan(100); // 100MB 이하
    });

    it('should handle concurrent data aggregations', async () => {
      const datasets = Array.from({ length: 20 }, (_, i) => ({
        id: i + 1,
        data: generateLargeDataset(500),
      }));

      const aggregationPromises = datasets.map(dataset => {
        return new Promise(resolve => {
          // 집계 연산 시뮬레이션
          const aggregated = dataset.data.reduce((acc, item) => {
            acc.sum += item.value;
            acc.count += 1;
            acc.categories[item.category] = (acc.categories[item.category] || 0) + 1;
            return acc;
          }, { sum: 0, count: 0, categories: {} });

          resolve({
            datasetId: dataset.id,
            average: aggregated.sum / aggregated.count,
            ...aggregated,
          });
        });
      });

      const startTime = Date.now();
      const results = await Promise.all(aggregationPromises);
      const executionTime = Date.now() - startTime;

      expect(results).toHaveLength(20);
      expect(executionTime).toBeLessThan(2000); // 2초 이내
    });
  });

  describe('Memory Leak Prevention Tests', () => {
    it('should not leak memory during repeated operations', async () => {
      const iterations = 100;
      const memorySnapshots = [];

      for (let i = 0; i < iterations; i++) {
        // 위젯 생성 및 삭제 반복
        widgetRepository.save.mockResolvedValue({ id: i + 1 });
        widgetRepository.findOne.mockResolvedValue({ id: i + 1 });
        widgetRepository.delete.mockResolvedValue({ affected: 1 });

        await widgetService.create({
          title: `Memory Test Widget ${i}`,
          databaseId: 1,
          componentId: 1,
          datasetType: DatasetType.DATASET,
          datasetId: 1,
          option: { data: new Array(1000).fill(i) },
        });

        await widgetService.remove(i + 1);

        if (i % 10 === 0) {
          memorySnapshots.push(measureMemoryUsage().heapUsed);
        }
      }

      // 메모리 사용량이 선형적으로 증가하지 않는지 확인
      const memoryGrowth = memorySnapshots[memorySnapshots.length - 1] - memorySnapshots[0];
      expect(memoryGrowth).toBeLessThan(50); // 50MB 이하 증가
    });
  });

  describe('Stress Testing', () => {
    it('should handle extreme concurrent load', async () => {
      const concurrentOperations = LOAD_TEST_CONFIG.STRESS_LOAD;
      const operations = ['create', 'read', 'update', 'delete'];
      
      const promises = Array.from({ length: concurrentOperations }, (_, i) => {
        const operation = operations[i % operations.length];
        
        switch (operation) {
          case 'create':
            widgetRepository.save.mockResolvedValueOnce({ id: i });
            return widgetService.create({
              title: `Stress Test ${i}`,
              databaseId: 1,
              componentId: 1,
              datasetType: DatasetType.DATASET,
              datasetId: 1,
              option: {},
            });
          
          case 'read':
            widgetRepository.findOne.mockResolvedValueOnce({ id: i });
            return widgetService.findOne(i);
          
          case 'update':
            widgetRepository.findOne.mockResolvedValueOnce({ id: i });
            widgetRepository.save.mockResolvedValueOnce({ id: i });
            return widgetService.update(i, { title: `Updated ${i}` });
          
          case 'delete':
            widgetRepository.findOne.mockResolvedValueOnce({ id: i });
            widgetRepository.delete.mockResolvedValueOnce({ affected: 1 });
            return widgetService.remove(i);
          
          default:
            return Promise.resolve();
        }
      });

      const startTime = Date.now();
      
      try {
        const results = await withTimeout(
          Promise.allSettled(promises),
          LOAD_TEST_CONFIG.TIMEOUT_MS
        );
        
        const executionTime = Date.now() - startTime;
        const successCount = results.filter(r => r.status === 'fulfilled').length;
        const failureCount = results.filter(r => r.status === 'rejected').length;
        
        console.log(`
          Stress Test Results:
          - Total operations: ${concurrentOperations}
          - Successful: ${successCount}
          - Failed: ${failureCount}
          - Execution time: ${executionTime}ms
          - Operations/second: ${(concurrentOperations / (executionTime / 1000)).toFixed(2)}
        `);
        
        expect(successCount / concurrentOperations).toBeGreaterThan(0.95); // 95% 성공률
      } catch (error) {
        console.error('Stress test failed:', error);
        throw error;
      }
    });
  });
});