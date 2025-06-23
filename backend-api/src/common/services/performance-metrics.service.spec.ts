import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PerformanceMetricsService, RequestMetrics, ErrorMetrics, PerformanceAlert } from './performance-metrics.service';
import { getRedisToken } from '@liaoliaots/nestjs-redis';
import { Redis } from 'ioredis';

describe('PerformanceMetricsService', () => {
  let service: PerformanceMetricsService;
  let redis: jest.Mocked<Redis>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  const mockRequestMetrics: RequestMetrics = {
    requestId: 'test-123',
    method: 'GET',
    endpoint: '/api/dashboards/:id',
    url: '/api/dashboards/123',
    statusCode: 200,
    responseTime: 150,
    memoryDelta: {
      heapUsed: 1000000,
      external: 500000,
      arrayBuffers: 100000,
    },
    cpuUsage: {
      user: 100000,
      system: 50000,
    },
    activeRequests: 5,
    timestamp: new Date(),
  };

  const mockErrorMetrics: ErrorMetrics = {
    requestId: 'error-123',
    method: 'POST',
    endpoint: '/api/users',
    url: '/api/users',
    statusCode: 500,
    responseTime: 50,
    error: 'Internal Server Error',
    errorStack: 'Error stack trace',
    activeRequests: 3,
    timestamp: new Date(),
  };

  beforeEach(async () => {
    const mockRedis = {
      setex: jest.fn().mockResolvedValue('OK'),
      zadd: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(1),
      get: jest.fn().mockResolvedValue(null),
      hincrby: jest.fn().mockResolvedValue(1),
      set: jest.fn().mockResolvedValue('OK'),
      keys: jest.fn().mockResolvedValue([]),
      zcard: jest.fn().mockResolvedValue(0),
      zremrangebyrank: jest.fn().mockResolvedValue(0),
      zrange: jest.fn().mockResolvedValue([]),
      ttl: jest.fn().mockResolvedValue(3600),
    };

    const mockEventEmitter = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PerformanceMetricsService,
        {
          provide: getRedisToken(),
          useValue: mockRedis,
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
      ],
    }).compile();

    service = module.get<PerformanceMetricsService>(PerformanceMetricsService);
    redis = module.get(getRedisToken());
    eventEmitter = module.get(EventEmitter2);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('recordRequestMetrics', () => {
    it('요청 메트릭을 Redis에 저장해야 함', async () => {
      await service.recordRequestMetrics(mockRequestMetrics);

      // 개별 요청 메트릭 저장 확인
      expect(redis.setex).toHaveBeenCalledWith(
        `metrics:request:${mockRequestMetrics.requestId}`,
        86400,
        JSON.stringify(mockRequestMetrics),
      );

      // 엔드포인트별 메트릭 추가 확인
      expect(redis.zadd).toHaveBeenCalledWith(
        `metrics:endpoint:${mockRequestMetrics.endpoint}`,
        expect.any(Number),
        mockRequestMetrics.requestId,
      );

      // 시계열 데이터 추가 확인
      expect(redis.zadd).toHaveBeenCalledWith(
        expect.stringContaining('metrics:timeseries:'),
        mockRequestMetrics.responseTime,
        expect.any(String),
      );
    });

    it('느린 응답에 대해 경고 알림을 발송해야 함', async () => {
      const slowMetrics = { ...mockRequestMetrics, responseTime: 3500 };
      await service.recordRequestMetrics(slowMetrics);

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'performance.alert',
        expect.objectContaining({
          type: 'slow_response',
          severity: 'critical',
          value: 3500,
          threshold: 3000,
        }),
      );
    });

    it('높은 메모리 사용량에 대해 경고를 발송해야 함', async () => {
      const highMemoryMetrics = {
        ...mockRequestMetrics,
        memoryDelta: {
          heapUsed: 60 * 1024 * 1024, // 60MB
          external: 1000000,
          arrayBuffers: 500000,
        },
      };
      await service.recordRequestMetrics(highMemoryMetrics);

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'performance.alert',
        expect.objectContaining({
          type: 'memory_leak',
          severity: 'warning',
        }),
      );
    });

    it('높은 CPU 사용률에 대해 경고를 발송해야 함', async () => {
      const highCpuMetrics = {
        ...mockRequestMetrics,
        cpuUsage: {
          user: 800000000,
          system: 200000000,
        },
      };
      await service.recordRequestMetrics(highCpuMetrics);

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'performance.alert',
        expect.objectContaining({
          type: 'high_cpu',
          severity: 'warning',
        }),
      );
    });
  });

  describe('recordErrorMetrics', () => {
    it('에러 메트릭을 Redis에 저장해야 함', async () => {
      await service.recordErrorMetrics(mockErrorMetrics);

      // 에러 메트릭 저장 확인
      expect(redis.setex).toHaveBeenCalledWith(
        `metrics:error:${mockErrorMetrics.requestId}`,
        86400,
        JSON.stringify(mockErrorMetrics),
      );

      // 엔드포인트별 에러 카운트 증가 확인
      expect(redis.hincrby).toHaveBeenCalledWith(
        `metrics:endpoint:errors:${mockErrorMetrics.endpoint}`,
        mockErrorMetrics.statusCode.toString(),
        1,
      );
    });
  });

  describe('updateActiveRequests', () => {
    it('활성 요청 수를 업데이트해야 함', async () => {
      await service.updateActiveRequests(10);

      expect(redis.set).toHaveBeenCalledWith('metrics:active:requests', 10);
      expect(redis.zadd).toHaveBeenCalled();
    });
  });

  describe('getEndpointStats', () => {
    it('엔드포인트 통계를 반환해야 함', async () => {
      const mockStats = {
        endpoint: '/api/dashboards/:id',
        count: 100,
        avgResponseTime: 250,
        minResponseTime: 50,
        maxResponseTime: 1000,
        p50ResponseTime: 200,
        p90ResponseTime: 450,
        p95ResponseTime: 600,
        p99ResponseTime: 900,
        errorRate: 0.02,
        successRate: 0.98,
        avgMemoryDelta: 1000000,
        avgCpuUsage: 15,
        lastUpdated: new Date(),
      };

      redis.get.mockResolvedValue(JSON.stringify(mockStats));
      redis.zrange.mockResolvedValue(['item1', '200', 'item2', '450']);

      const result = await service.getEndpointStats('/api/dashboards/:id');

      expect(result).toBeDefined();
      expect(result?.endpoint).toBe('/api/dashboards/:id');
      expect(redis.get).toHaveBeenCalledWith('metrics:stats:/api/dashboards/:id');
    });

    it('통계가 없을 때 null을 반환해야 함', async () => {
      redis.get.mockResolvedValue(null);

      const result = await service.getEndpointStats('/api/dashboards/:id');

      expect(result).toBeNull();
    });
  });

  describe('getOverallStats', () => {
    it('전체 엔드포인트 통계를 반환해야 함', async () => {
      const mockKeys = [
        'metrics:stats:/api/dashboards/:id',
        'metrics:stats:/api/users',
      ];
      const mockStats1 = {
        endpoint: '/api/dashboards/:id',
        count: 100,
        avgResponseTime: 250,
      };
      const mockStats2 = {
        endpoint: '/api/users',
        count: 200,
        avgResponseTime: 150,
      };

      redis.keys.mockResolvedValue(mockKeys);
      redis.get
        .mockResolvedValueOnce(JSON.stringify(mockStats1))
        .mockResolvedValueOnce(JSON.stringify(mockStats2));
      redis.zrange.mockResolvedValue(['item', '100']);

      const result = await service.getOverallStats();

      expect(Object.keys(result)).toHaveLength(2);
      expect(result['/api/dashboards/:id']).toBeDefined();
      expect(result['/api/users']).toBeDefined();
    });
  });

  describe('백분위수 계산', () => {
    it('올바른 백분위수를 계산해야 함', async () => {
      // 100개의 응답 시간 시뮬레이션
      redis.zcard.mockResolvedValue(100);
      redis.zrange
        .mockResolvedValueOnce(['p50', '200']) // P50
        .mockResolvedValueOnce(['p90', '450']) // P90
        .mockResolvedValueOnce(['p95', '600']) // P95
        .mockResolvedValueOnce(['p99', '900']); // P99

      const mockStats = {
        endpoint: '/api/test',
        count: 100,
        avgResponseTime: 300,
        minResponseTime: 50,
        maxResponseTime: 1000,
        p50ResponseTime: 0,
        p90ResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        errorRate: 0,
        successRate: 1,
        avgMemoryDelta: 0,
        avgCpuUsage: 0,
        lastUpdated: new Date(),
      };

      redis.get.mockResolvedValue(JSON.stringify(mockStats));

      const result = await service.getEndpointStats('/api/test');

      expect(result?.p50ResponseTime).toBe(200);
      expect(result?.p90ResponseTime).toBe(450);
      expect(result?.p95ResponseTime).toBe(600);
      expect(result?.p99ResponseTime).toBe(900);
    });
  });

  describe('메트릭 정리', () => {
    it('주기적으로 오래된 메트릭을 정리해야 함', async () => {
      jest.useFakeTimers();
      
      const mockKeys = [
        'metrics:request:old-1',
        'metrics:request:old-2',
        'metrics:error:old-1',
      ];
      redis.keys.mockResolvedValue(mockKeys);
      redis.ttl.mockResolvedValue(-1); // TTL이 설정되지 않음

      // 5분 후 정리 작업 실행
      jest.advanceTimersByTime(5 * 60 * 1000);

      // setInterval 콜백이 실행될 때까지 대기
      await new Promise(resolve => setImmediate(resolve));

      expect(redis.expire).toHaveBeenCalledTimes(mockKeys.length);
      mockKeys.forEach(key => {
        expect(redis.expire).toHaveBeenCalledWith(key, 86400);
      });

      jest.useRealTimers();
    });
  });

  describe('통계 업데이트', () => {
    it('기존 통계를 업데이트해야 함', async () => {
      const existingStats = {
        endpoint: '/api/dashboards/:id',
        count: 100,
        avgResponseTime: 200,
        minResponseTime: 50,
        maxResponseTime: 500,
        errorRate: 0.02,
        successRate: 0.98,
        avgMemoryDelta: 1000000,
        avgCpuUsage: 10,
        lastUpdated: new Date(),
      };

      redis.get.mockResolvedValue(JSON.stringify(existingStats));

      const newMetrics = {
        ...mockRequestMetrics,
        responseTime: 300,
      };

      await service.recordRequestMetrics(newMetrics);

      // 통계 업데이트 확인
      const updateCall = redis.setex.mock.calls.find(
        call => call[0] === 'metrics:stats:/api/dashboards/:id',
      );

      expect(updateCall).toBeDefined();
      const updatedStats = JSON.parse(updateCall![2]);
      expect(updatedStats.count).toBe(101);
      expect(updatedStats.avgResponseTime).toBeCloseTo(201, 0);
      expect(updatedStats.minResponseTime).toBe(50);
      expect(updatedStats.maxResponseTime).toBe(500);
    });

    it('새로운 엔드포인트의 통계를 생성해야 함', async () => {
      redis.get.mockResolvedValue(null); // 기존 통계 없음

      await service.recordRequestMetrics(mockRequestMetrics);

      const createCall = redis.setex.mock.calls.find(
        call => call[0] === 'metrics:stats:/api/dashboards/:id',
      );

      expect(createCall).toBeDefined();
      const newStats = JSON.parse(createCall![2]);
      expect(newStats.count).toBe(1);
      expect(newStats.avgResponseTime).toBe(150);
      expect(newStats.minResponseTime).toBe(150);
      expect(newStats.maxResponseTime).toBe(150);
    });
  });
});