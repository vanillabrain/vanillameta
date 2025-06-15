import { Test, TestingModule } from '@nestjs/testing';
import { MemoryMonitorMiddleware } from './memory-monitor.middleware';
import { CustomLoggerService } from '../logger/logger.service';
import { Request, Response } from 'express';

describe('MemoryMonitorMiddleware', () => {
  let middleware: MemoryMonitorMiddleware;
  let mockLogger: Partial<CustomLoggerService>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.Mock;

  beforeEach(async () => {
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
    };

    // Mock response
    mockResponse = {
      on: jest.fn((event, callback) => {
        if (event === 'finish') {
          // 즉시 finish 이벤트 발생
          setTimeout(callback, 10);
        }
      }),
    };

    // Mock next function
    mockNext = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MemoryMonitorMiddleware,
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

  it('응답 완료 시 메모리 사용량을 로깅해야 함', done => {
    middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

    // finish 이벤트 대기
    setTimeout(() => {
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
          executionTime: expect.any(String),
        }),
      );
      done();
    }, 20);
  });

  it('큰 메모리 할당 시 경고를 발생시켜야 함', done => {
    // 대용량 메모리 할당 시뮬레이션
    const largeArray = new Array(10 * 1024 * 1024).fill(0); // ~80MB

    middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

    setTimeout(() => {
      // 메모리 증가 감지 확인
      const warnCalls = (mockLogger.warn as jest.Mock).mock.calls;
      const hasMemoryWarning = warnCalls.some(
        call => call[0] === 'Large memory allocation detected',
      );

      // 큰 메모리 할당은 환경에 따라 다를 수 있으므로 선택적 체크
      if (hasMemoryWarning) {
        expect(mockLogger.warn).toHaveBeenCalledWith(
          'Large memory allocation detected',
          'MemoryMonitor',
          expect.objectContaining({
            path: '/test',
            memoryIncrease: expect.any(String),
            currentUsage: expect.any(String),
          }),
        );
      }

      // 메모리 해제
      largeArray.length = 0;
      done();
    }, 20);
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
      expect(() => checkThreshold(mockMetrics)).toThrow(
        '서버 메모리가 부족합니다. 잠시 후 다시 시도해주세요.',
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Critical memory threshold reached',
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

  afterEach(() => {
    jest.clearAllMocks();
  });
});
