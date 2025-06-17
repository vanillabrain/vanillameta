import { Test, TestingModule } from '@nestjs/testing';
import { IntegratedMetricsService } from './integrated-metrics.service';
import { CloudWatchMetricsService } from './cloudwatch-metrics.service';
import { ConfigService } from '@nestjs/config';

describe('IntegratedMetricsService', () => {
  let service: IntegratedMetricsService;
  let cloudWatchMetricsService: CloudWatchMetricsService;
  let configService: ConfigService;

  const mockCloudWatchMetricsService = {
    putMetric: jest.fn().mockResolvedValue(undefined),
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: any) => {
      const config = {
        NODE_ENV: 'test',
      };
      return config[key] || defaultValue;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IntegratedMetricsService,
        {
          provide: CloudWatchMetricsService,
          useValue: mockCloudWatchMetricsService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<IntegratedMetricsService>(IntegratedMetricsService);
    cloudWatchMetricsService = module.get<CloudWatchMetricsService>(CloudWatchMetricsService);
    configService = module.get<ConfigService>(ConfigService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('recordApiRequest', () => {
    it('should record API request metrics', async () => {
      await service.recordApiRequest('GET', '/api/users', 200, 150, 'user123');

      expect(cloudWatchMetricsService.putMetric).toHaveBeenCalledWith(
        'VanillaMeta/test',
        'ApiRequestCount',
        1,
        'Count',
        expect.objectContaining({
          Method: 'GET',
          Path: '/api/users',
          StatusCodeGroup: '2XX',
          HasUser: 'true',
        }),
      );

      expect(cloudWatchMetricsService.putMetric).toHaveBeenCalledWith(
        'VanillaMeta/test',
        'ApiResponseTime',
        150,
        'Milliseconds',
        expect.any(Object),
      );
    });

    it('should record error metrics for 5XX responses', async () => {
      await service.recordApiRequest('POST', '/api/users', 500, 200);

      expect(cloudWatchMetricsService.putMetric).toHaveBeenCalledWith(
        'VanillaMeta/test',
        'ErrorCount',
        1,
        'Count',
        expect.objectContaining({
          ErrorType: 'ServerError',
          StatusCode: '500',
        }),
      );

      expect(cloudWatchMetricsService.putMetric).toHaveBeenCalledWith(
        'VanillaMeta/test',
        'Http5xxErrorCount',
        1,
        'Count',
      );
    });

    it('should record slow response metrics', async () => {
      await service.recordApiRequest('GET', '/api/data', 200, 6000);

      expect(cloudWatchMetricsService.putMetric).toHaveBeenCalledWith(
        'VanillaMeta/test',
        'SlowResponseCount',
        1,
        'Count',
        expect.objectContaining({
          ResponseTimeRange: '5-10s',
        }),
      );
    });

    it('should sanitize dynamic path segments', async () => {
      await service.recordApiRequest(
        'GET',
        '/api/users/123e4567-e89b-12d3-a456-426614174000',
        200,
        100,
      );

      expect(cloudWatchMetricsService.putMetric).toHaveBeenCalledWith(
        'VanillaMeta/test',
        'ApiRequestCount',
        1,
        'Count',
        expect.objectContaining({
          Path: '/api/users/:id',
        }),
      );
    });
  });

  describe('recordConnectionPoolMetrics', () => {
    it('should record connection pool metrics', async () => {
      await service.recordConnectionPoolMetrics(10, 6, 4, 2);

      expect(cloudWatchMetricsService.putMetric).toHaveBeenCalledWith(
        'VanillaMeta/test/Database',
        'ConnectionPoolSize',
        10,
        'Count',
      );

      expect(cloudWatchMetricsService.putMetric).toHaveBeenCalledWith(
        'VanillaMeta/test/Database',
        'ActiveConnections',
        6,
        'Count',
      );

      expect(cloudWatchMetricsService.putMetric).toHaveBeenCalledWith(
        'VanillaMeta/test/Database',
        'ConnectionPoolUtilization',
        60,
        'Percent',
      );
    });

    it('should handle zero pool size', async () => {
      await service.recordConnectionPoolMetrics(0, 0, 0, 0);

      expect(cloudWatchMetricsService.putMetric).toHaveBeenCalledWith(
        'VanillaMeta/test/Database',
        'ConnectionPoolUtilization',
        0,
        'Percent',
      );
    });
  });

  describe('recordLambdaMetrics', () => {
    it('should record Lambda metrics with cold start', async () => {
      await service.recordLambdaMetrics(true, 128, 1500);

      expect(cloudWatchMetricsService.putMetric).toHaveBeenCalledWith(
        'VanillaMeta/test',
        'ColdStartCount',
        1,
        'Count',
      );

      expect(cloudWatchMetricsService.putMetric).toHaveBeenCalledWith(
        'VanillaMeta/test',
        'LambdaMemoryUsed',
        128,
        'Megabytes',
        expect.objectContaining({
          ColdStart: 'true',
        }),
      );
    });

    it('should record Lambda metrics without cold start', async () => {
      await service.recordLambdaMetrics(false, 256, 500);

      expect(cloudWatchMetricsService.putMetric).not.toHaveBeenCalledWith(
        'VanillaMeta/test',
        'ColdStartCount',
        expect.any(Number),
        'Count',
      );

      expect(cloudWatchMetricsService.putMetric).toHaveBeenCalledWith(
        'VanillaMeta/test',
        'LambdaMemoryUsed',
        256,
        'Megabytes',
        expect.objectContaining({
          ColdStart: 'false',
        }),
      );
    });
  });

  describe('recordBusinessMetric', () => {
    it('should record custom business metrics', async () => {
      await service.recordBusinessMetric('UserSignups', 5, 'Count', {
        Plan: 'Premium',
      });

      expect(cloudWatchMetricsService.putMetric).toHaveBeenCalledWith(
        'VanillaMeta/test/Business',
        'UserSignups',
        5,
        'Count',
        {
          Plan: 'Premium',
        },
      );
    });
  });

  describe('getCurrentMetrics', () => {
    it('should return current system metrics', async () => {
      const metrics = await service.getCurrentMetrics();

      expect(metrics).toHaveProperty('cpuUsage');
      expect(metrics).toHaveProperty('memoryUsage');
      expect(metrics).toHaveProperty('activeConnections');
      expect(metrics).toHaveProperty('requestRate');
      expect(metrics).toHaveProperty('errorRate');
      expect(metrics).toHaveProperty('avgResponseTime');

      expect(typeof metrics.cpuUsage).toBe('number');
      expect(typeof metrics.memoryUsage).toBe('number');
    });
  });
});