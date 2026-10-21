jest.mock('v8', () => ({
  ...jest.requireActual('v8'),
  writeHeapSnapshot: jest.fn(filename => filename),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { MemoryMonitorMiddleware } from './memory-monitor.middleware';
import { CustomLoggerService } from '../logger/logger.service';
import { Request, Response } from 'express';
import { CloudWatchMetricsService } from './cloudwatch-metrics.service';

describe('MemoryMonitorMiddleware', () => {
  let middleware: MemoryMonitorMiddleware;
  let mockLogger: Partial<CustomLoggerService>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.Mock;
  let finishResponse: () => void;

  beforeEach(async () => {
    jest.useFakeTimers({ doNotFake: ['performance'] });
    const usage = process.memoryUsage();
    jest.spyOn(process, 'memoryUsage').mockReturnValue({ ...usage, rss: 256 * 1024 * 1024 });
    // Mock logger
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Mock request
    mockRequest = {
      method: 'GET',
      path: '/test',
      route: { path: '/test' },
    };

    // Mock response
    mockResponse = {
      on: jest.fn((event, callback) => {
        if (event === 'finish') {
          finishResponse = callback;
        }
        return mockResponse as Response;
      }),
    };

    // Mock next function
    mockNext = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MemoryMonitorMiddleware,
        {
          provide: CloudWatchMetricsService,
          useValue: { putMetric: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: CustomLoggerService,
          useValue: mockLogger,
        },
      ],
    }).compile();

    middleware = module.get<MemoryMonitorMiddleware>(MemoryMonitorMiddleware);
  });

  it('미들웨어가 생성되어야 함', () => {
    expect(middleware).toBeDefined();
  });

  it('요청을 처리하고 다음 미들웨어를 호출해야 함', () => {
    middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });

  it('응답 완료 시 메모리 사용량을 로깅해야 함', () => {
    middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
    expect(mockLogger.debug).not.toHaveBeenCalled();

    finishResponse();

    expect(mockLogger.debug).toHaveBeenCalledWith(
      'Request memory usage',
      'MemoryMonitor',
      expect.objectContaining({
        method: 'GET',
        path: '/test',
        initialMemory: expect.any(String),
        finalMemory: expect.any(String),
        memoryDelta: expect.any(String),
        percentUsed: expect.any(String),
        executionTime: expect.any(Number),
      }),
    );
  });

  it('큰 메모리 할당 시 경고를 발생시켜야 함', () => {
    const initial = middleware.getMemoryStats();
    jest
      .spyOn(middleware as any, 'getMemoryMetrics')
      .mockReturnValueOnce({ ...initial, heapUsed: 100 * 1024 * 1024, percentUsed: 10 })
      .mockReturnValueOnce({ ...initial, heapUsed: 151 * 1024 * 1024, percentUsed: 12 });

    middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
    expect(mockLogger.warn).not.toHaveBeenCalled();
    finishResponse();

    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Large memory allocation detected',
      'MemoryMonitor',
      expect.objectContaining({
        path: '/test',
        memoryIncrease: '51 MB',
        currentUsage: '12.0%',
      }),
    );
  });

  it('메모리 통계를 반환해야 함', () => {
    const stats = middleware.getMemoryStats();

    expect(stats).toMatchObject({
      timestamp: expect.any(Date),
      rss: expect.any(Number),
      heapTotal: expect.any(Number),
      heapUsed: expect.any(Number),
      external: expect.any(Number),
      arrayBuffers: expect.any(Number),
      percentUsed: expect.any(Number),
      available: expect.any(Number),
      gcStats: expect.objectContaining({
        totalHeapSize: expect.any(Number),
        usedHeapSize: expect.any(Number),
        heapSizeLimit: expect.any(Number),
      }),
    });
  });

  it('메모리 임계치 확인 시 경고 임계치에서 경고를 발생시켜야 함', () => {
    // 경고 임계치(80%) 도달 시뮬레이션
    const mockMetrics = {
      timestamp: new Date(),
      rss: 2.5 * 1024 * 1024 * 1024, // 2.5GB
      heapTotal: 2 * 1024 * 1024 * 1024,
      heapUsed: 1.8 * 1024 * 1024 * 1024,
      external: 0,
      arrayBuffers: 0,
      percentUsed: 81, // 81%
      available: 0.5 * 1024 * 1024 * 1024,
    };

    // private 메서드 테스트를 위한 우회 방법
    const checkThreshold = (middleware as any).checkMemoryThreshold.bind(middleware);

    // global.gc가 없는 경우 처리
    const originalGc = global.gc;
    global.gc = jest.fn();

    try {
      jest.advanceTimersByTime(5000);
      checkThreshold(mockMetrics);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Memory usage warning threshold reached',
        'MemoryMonitor',
        expect.objectContaining({
          percentUsed: '81.0%',
          heapUsed: expect.any(String),
          recommendation: expect.any(String),
        }),
      );

      // 가비지 컬렉션이 호출되었는지 확인
      expect(global.gc).toHaveBeenCalled();
    } finally {
      global.gc = originalGc;
    }
  });

  it('메모리 임계치 확인 시 중단 임계치에서 에러를 발생시켜야 함', () => {
    // 중단 임계치(90%) 도달 시뮬레이션
    const mockMetrics = {
      timestamp: new Date(),
      rss: 2.8 * 1024 * 1024 * 1024, // 2.8GB
      heapTotal: 2.5 * 1024 * 1024 * 1024,
      heapUsed: 2.3 * 1024 * 1024 * 1024,
      external: 0,
      arrayBuffers: 0,
      percentUsed: 91, // 91%
      available: 0.2 * 1024 * 1024 * 1024,
    };

    const checkThreshold = (middleware as any).checkMemoryThreshold.bind(middleware);

    // global.gc가 없는 경우 처리
    const originalGc = global.gc;
    global.gc = jest.fn();

    try {
      jest.advanceTimersByTime(5000);
      expect(() => checkThreshold(mockMetrics)).toThrow(
        '서버 메모리가 부족합니다. 잠시 후 다시 시도해주세요.',
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Critical memory threshold reached: 91.0%',
        null,
        'MemoryMonitor',
        expect.objectContaining({
          percentUsed: '91.0%',
          heapUsed: expect.any(String),
          rss: expect.any(String),
        }),
      );
    } finally {
      global.gc = originalGc;
    }
  });

  it('힙 스냅샷을 생성해야 함', () => {
    const filename = middleware.createHeapSnapshot();

    expect(filename).toMatch(/^\/tmp\/heapdump-.*\.heapsnapshot$/);
    expect(mockLogger.info).toHaveBeenCalledWith('Heap snapshot created', 'MemoryMonitor', {
      filename,
    });
  });

  it('keeps periodic pressure reporting alive while rejecting requests at critical memory', () => {
    const usage = process.memoryUsage();
    jest.spyOn(process, 'memoryUsage').mockReturnValue({ ...usage, rss: 3 * 1024 * 1024 * 1024 });
    expect(() => jest.advanceTimersByTime(30000)).not.toThrow();
    expect((middleware as any).cloudWatchMetrics.putMetric).toHaveBeenCalled();
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Critical memory threshold reached'),
      null,
      'MemoryMonitor',
      expect.any(Object),
    );
    expect(() =>
      middleware.use(mockRequest as Request, mockResponse as Response, mockNext),
    ).toThrow('서버 메모리가 부족합니다');
    expect(mockNext).not.toHaveBeenCalled();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });
});
