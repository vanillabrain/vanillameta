import { Test, TestingModule } from '@nestjs/testing';
import { CompressionLoggingMiddleware } from './compression-logging.middleware';
import { CustomLoggerService } from '../common/logger/logger.service';
import { Request, Response, NextFunction } from 'express';

describe('CompressionLoggingMiddleware', () => {
  jest.setTimeout(10000); // 테스트 타임아웃 설정
  let middleware: CompressionLoggingMiddleware;
  let mockLogger: jest.Mocked<CustomLoggerService>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(async () => {
    // Mock logger
    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompressionLoggingMiddleware,
        {
          provide: CustomLoggerService,
          useValue: mockLogger,
        },
      ],
    }).compile();

    middleware = module.get<CompressionLoggingMiddleware>(CompressionLoggingMiddleware);

    // Mock request
    mockRequest = {
      method: 'GET',
      path: '/api/test',
    };

    // Mock response
    mockResponse = {
      write: jest.fn().mockImplementation(function(chunk) {
        return true;
      }),
      end: jest.fn().mockImplementation(function(chunk) {
        // Simulate the 'finish' event
        setTimeout(() => {
          if (this.listeners && this.listeners('finish')) {
            this.listeners('finish').forEach(listener => listener());
          }
        }, 0);
        return this;
      }),
      getHeader: jest.fn(),
      on: jest.fn(),
      listeners: jest.fn().mockReturnValue([]),
    };

    // Store original methods
    const originalWrite = mockResponse.write;
    const originalEnd = mockResponse.end;
    mockResponse['originalWrite'] = originalWrite;
    mockResponse['originalEnd'] = originalEnd;

    // Add event emitter functionality
    const events = {};
    mockResponse.on = jest.fn().mockImplementation((event, handler) => {
      if (!events[event]) events[event] = [];
      events[event].push(handler);
    });
    mockResponse.listeners = jest.fn().mockImplementation((event) => events[event] || []);

    mockNext = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('로그 미들웨어가 정의되어야 함', () => {
    expect(middleware).toBeDefined();
  });

  it('압축된 응답에 대한 압축 정보를 로깅해야 함', (done) => {
    // Setup
    const testData = 'This is a test response that should be compressed';
    const uncompressedSize = Buffer.from(testData).length;
    const compressedSize = 25; // 모의 압축 크기

    mockResponse.getHeader = jest.fn().mockImplementation((header) => {
      if (header === 'content-encoding') return 'gzip';
      if (header === 'content-length') return compressedSize.toString();
      if (header === 'content-type') return 'application/json';
      return null;
    });

    // Execute
    middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

    // Response 작성 시뮬레이션
    mockResponse.write(testData);
    mockResponse.end();

    // Verify
    setTimeout(() => {
      expect(mockNext).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Response compression applied',
        'CompressionMiddleware',
        expect.objectContaining({
          method: 'GET',
          path: '/api/test',
          contentType: 'application/json',
          encoding: 'gzip',
          uncompressedSize,
          compressedSize,
          compressionRatio: expect.stringMatching(/\d+\.\d+%/),
          saved: uncompressedSize - compressedSize,
        })
      );
      done();
    }, 10);
  });

  it('압축되지 않은 큰 응답에 대해 디버그 로그를 남겨야 함', (done) => {
    // Setup
    const testData = 'x'.repeat(2000); // 2KB 데이터
    const uncompressedSize = Buffer.from(testData).length;

    mockResponse.getHeader = jest.fn().mockImplementation((header) => {
      if (header === 'content-encoding') return null;
      if (header === 'content-type') return 'text/plain';
      return null;
    });

    // Execute
    middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

    // Response 작성 시뮬레이션
    mockResponse.write(testData);
    mockResponse.end();

    // Verify
    setTimeout(() => {
      expect(mockNext).toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Response not compressed',
        'CompressionMiddleware',
        expect.objectContaining({
          method: 'GET',
          path: '/api/test',
          contentType: 'text/plain',
          size: uncompressedSize,
          reason: 'Check content-type or client Accept-Encoding header',
        })
      );
      done();
    }, 10);
  });

  it('작은 응답에 대해서는 로깅하지 않아야 함', (done) => {
    // Setup
    const testData = 'Small data'; // < 1KB
    
    mockResponse.getHeader = jest.fn().mockReturnValue(null);

    // Execute
    middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

    // Response 작성 시뮬레이션
    mockResponse.write(testData);
    mockResponse.end();

    // Verify
    setTimeout(() => {
      expect(mockNext).toHaveBeenCalled();
      expect(mockLogger.info).not.toHaveBeenCalled();
      expect(mockLogger.debug).not.toHaveBeenCalled();
      done();
    }, 10);
  });

  it('청크로 분할된 응답을 올바르게 처리해야 함', (done) => {
    // Setup
    const chunk1 = 'First chunk of data ';
    const chunk2 = 'Second chunk of data ';
    const chunk3 = 'Third chunk of data';
    const totalData = chunk1 + chunk2 + chunk3;
    const uncompressedSize = Buffer.from(totalData).length;
    const compressedSize = 30;

    mockResponse.getHeader = jest.fn().mockImplementation((header) => {
      if (header === 'content-encoding') return 'gzip';
      if (header === 'content-length') return compressedSize.toString();
      if (header === 'content-type') return 'application/json';
      return null;
    });

    // Execute
    middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

    // Response 작성 시뮬레이션
    mockResponse.write(chunk1);
    mockResponse.write(chunk2);
    mockResponse.end(chunk3);

    // Verify
    setTimeout(() => {
      expect(mockNext).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Response compression applied',
        'CompressionMiddleware',
        expect.objectContaining({
          uncompressedSize,
          compressedSize,
          saved: uncompressedSize - compressedSize,
        })
      );
      done();
    }, 10);
  });
});