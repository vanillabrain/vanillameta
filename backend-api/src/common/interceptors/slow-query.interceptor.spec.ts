import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { SlowQueryInterceptor, RequestWithQuery } from './slow-query.interceptor';
import { SlowQueryMonitorService } from '../monitoring/slow-query-monitor.service';
import { QueryAnalyzerService } from '../monitoring/query-analyzer.service';

describe('SlowQueryInterceptor', () => {
  let interceptor: SlowQueryInterceptor;
  let slowQueryMonitorService: SlowQueryMonitorService;
  let queryAnalyzerService: QueryAnalyzerService;

  const mockSlowQueryMonitorService = {
    logSlowQuery: jest.fn(),
  };

  const mockQueryAnalyzerService = {
    analyzeQuery: jest.fn(),
  };

  const mockRequest: RequestWithQuery = {
    path: '/api/data/query',
    method: 'POST',
    get: jest.fn(),
    socket: { remoteAddress: '192.168.1.1' },
  } as any;

  const mockExecutionContext = {
    switchToHttp: jest.fn().mockReturnValue({
      getRequest: jest.fn().mockReturnValue(mockRequest),
    }),
  } as any as ExecutionContext;

  const mockCallHandler: CallHandler = {
    handle: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SlowQueryInterceptor,
        {
          provide: SlowQueryMonitorService,
          useValue: mockSlowQueryMonitorService,
        },
        {
          provide: QueryAnalyzerService,
          useValue: mockQueryAnalyzerService,
        },
      ],
    }).compile();

    interceptor = module.get<SlowQueryInterceptor>(SlowQueryInterceptor);
    slowQueryMonitorService = module.get<SlowQueryMonitorService>(SlowQueryMonitorService);
    queryAnalyzerService = module.get<QueryAnalyzerService>(QueryAnalyzerService);

    // Reset mocks
    jest.clearAllMocks();
    mockRequest.get = jest.fn();
    mockRequest.queryMetrics = undefined;
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  describe('intercept', () => {
    it('should initialize query metrics on request', done => {
      mockCallHandler.handle = jest.fn().mockReturnValue(of('result'));
      mockRequest.get = jest
        .fn()
        .mockReturnValueOnce('Mozilla/5.0 Chrome/91.0')
        .mockReturnValueOnce('req-123');

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: result => {
          expect(result).toBe('result');
          expect(mockRequest.queryMetrics).toBeDefined();
          expect(mockRequest.queryMetrics.startTime).toBeGreaterThan(0);
          expect(mockRequest.queryMetrics.queries).toEqual([]);
          done();
        },
      });
    });

    it('should process query metrics on successful response', async () => {
      // Mock the handler to add query metrics during execution (simulating database operations)
      mockCallHandler.handle = jest.fn().mockImplementation(() => {
        // Simulate query metrics being added during request processing
        if (mockRequest.queryMetrics) {
          mockRequest.queryMetrics.queries.push({
            query: 'SELECT * FROM test WHERE id = ?',
            executionTime: 1500,
            parameters: [1],
            databaseId: 1,
            databaseEngine: 'mysql2',
          });
        }
        return of('result');
      });

      mockQueryAnalyzerService.analyzeQuery.mockResolvedValue({
        query: 'SELECT * FROM test',
        executionTime: 1500,
        optimizationSuggestions: ['Add index'],
      });
      mockSlowQueryMonitorService.logSlowQuery.mockResolvedValue(undefined);

      const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler);

      // Wait for the observable to complete
      await new Promise<void>(resolve => {
        result$.subscribe({
          next: () => {
            resolve();
          },
        });
      });

      // Wait for async processing in tap operator
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(queryAnalyzerService.analyzeQuery).toHaveBeenCalledWith(
        'SELECT * FROM test WHERE id = ?',
        1,
      );
      expect(slowQueryMonitorService.logSlowQuery).toHaveBeenCalled();
    });

    it('should process query metrics on error response', async () => {
      const error = new Error('Database error');

      // Mock the handler to add query metrics before throwing error
      mockCallHandler.handle = jest.fn().mockImplementation(() => {
        // Simulate query metrics being added during request processing before error
        if (mockRequest.queryMetrics) {
          mockRequest.queryMetrics.queries.push({
            query: 'SELECT * FROM test WHERE id = ?',
            executionTime: 2000,
            parameters: [1],
            databaseId: 1,
            databaseEngine: 'mysql2',
          });
        }
        return throwError(() => error);
      });

      mockQueryAnalyzerService.analyzeQuery.mockResolvedValue({
        query: 'SELECT * FROM test',
        executionTime: 2000,
      });
      mockSlowQueryMonitorService.logSlowQuery.mockResolvedValue(undefined);

      const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler);

      // Wait for the observable to complete with error
      await new Promise<void>(resolve => {
        result$.subscribe({
          error: err => {
            expect(err).toBe(error);
            resolve();
          },
        });
      });

      // Wait for async processing in tap operator
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(queryAnalyzerService.analyzeQuery).toHaveBeenCalled();
      expect(slowQueryMonitorService.logSlowQuery).toHaveBeenCalled();
    });

    it('should not process queries below threshold', done => {
      // Mock the handler to add fast query during execution
      mockCallHandler.handle = jest.fn().mockImplementation(() => {
        // Simulate fast query (below 1000ms threshold)
        if (mockRequest.queryMetrics) {
          mockRequest.queryMetrics.queries.push({
            query: 'SELECT * FROM test LIMIT 10',
            executionTime: 500, // Below threshold
            parameters: [],
            databaseId: 1,
            databaseEngine: 'mysql2',
          });
        }
        return of('result');
      });

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: () => {
          setTimeout(() => {
            expect(queryAnalyzerService.analyzeQuery).not.toHaveBeenCalled();
            expect(slowQueryMonitorService.logSlowQuery).not.toHaveBeenCalled();
            done();
          }, 50);
        },
      });
    });
  });

  describe('recordQuery static method', () => {
    it('should record query metrics', () => {
      const request: RequestWithQuery = {} as any;

      SlowQueryInterceptor.recordQuery(request, 'SELECT * FROM users', 1500, {
        parameters: ['test@example.com'],
        databaseId: 1,
        databaseEngine: 'mysql2',
      });

      expect(request.queryMetrics).toBeDefined();
      expect(request.queryMetrics.queries).toHaveLength(1);
      expect(request.queryMetrics.queries[0]).toEqual({
        query: 'SELECT * FROM users',
        executionTime: 1500,
        parameters: ['test@example.com'],
        databaseId: 1,
        databaseEngine: 'mysql2',
      });
    });

    it('should initialize queryMetrics if not exists', () => {
      const request: RequestWithQuery = {} as any;

      SlowQueryInterceptor.recordQuery(request, 'SELECT COUNT(*) FROM orders', 800);

      expect(request.queryMetrics).toBeDefined();
      expect(request.queryMetrics.startTime).toBeGreaterThan(0);
      expect(request.queryMetrics.queries).toHaveLength(1);
    });

    it('should append to existing queries', () => {
      const request: RequestWithQuery = {
        queryMetrics: {
          startTime: Date.now(),
          queries: [
            {
              query: 'SELECT * FROM users',
              executionTime: 200,
            },
          ],
        },
      } as any;

      SlowQueryInterceptor.recordQuery(request, 'SELECT * FROM orders', 1200);

      expect(request.queryMetrics.queries).toHaveLength(2);
      expect(request.queryMetrics.queries[1].query).toBe('SELECT * FROM orders');
      expect(request.queryMetrics.queries[1].executionTime).toBe(1200);
    });

    it('should truncate long queries', () => {
      const request: RequestWithQuery = {} as any;
      const longQuery = 'SELECT * FROM users WHERE ' + 'condition AND '.repeat(100) + 'id = 1';

      SlowQueryInterceptor.recordQuery(request, longQuery, 1000);

      expect(request.queryMetrics.queries[0].query.length).toBeLessThanOrEqual(1000);
    });
  });

  describe('extractRequestMetadata', () => {
    it('should extract metadata correctly', () => {
      mockRequest.get = jest
        .fn()
        .mockReturnValueOnce('Mozilla/5.0 Chrome/91.0') // User-Agent
        .mockReturnValueOnce('192.168.1.100') // X-Forwarded-For
        .mockReturnValueOnce('req-456'); // X-Request-ID

      const metadata = (interceptor as any).extractRequestMetadata(mockRequest);

      expect(metadata.userAgent).toBe('Mozilla/5.0 Chrome/91.0');
      expect(metadata.clientIp).toBe('192.168.1.100');
      expect(metadata.requestId).toBe('req-456');
      expect(metadata.requestPath).toBe('/api/data/query');
      expect(metadata.httpMethod).toBe('POST');
    });

    it('should handle missing headers gracefully', () => {
      mockRequest.get = jest.fn().mockReturnValue(undefined);
      mockRequest.socket = { remoteAddress: '127.0.0.1' } as any;

      const metadata = (interceptor as any).extractRequestMetadata(mockRequest);

      expect(metadata.userAgent).toBe('');
      expect(metadata.clientIp).toBe('127.0.0.1');
      expect(metadata.requestId).toMatch(/^req_\d+_[a-z0-9]+$/);
    });
  });

  describe('getClientIp', () => {
    it('should extract IP from X-Forwarded-For header', () => {
      mockRequest.get = jest.fn().mockImplementation(header => {
        if (header === 'X-Forwarded-For') return '203.0.113.1, 192.168.1.1';
        return undefined;
      });

      const ip = (interceptor as any).getClientIp(mockRequest);
      expect(ip).toBe('203.0.113.1');
    });

    it('should extract IP from X-Real-IP header', () => {
      mockRequest.get = jest.fn().mockImplementation(header => {
        if (header === 'X-Real-IP') return '203.0.113.2';
        return undefined;
      });

      const ip = (interceptor as any).getClientIp(mockRequest);
      expect(ip).toBe('203.0.113.2');
    });

    it('should fallback to socket remoteAddress', () => {
      mockRequest.get = jest.fn().mockReturnValue(undefined);
      mockRequest.socket = { remoteAddress: '192.168.1.100' } as any;

      const ip = (interceptor as any).getClientIp(mockRequest);
      expect(ip).toBe('192.168.1.100');
    });

    it('should return unknown if no IP found', () => {
      mockRequest.get = jest.fn().mockReturnValue(undefined);
      mockRequest.socket = {} as any;

      const ip = (interceptor as any).getClientIp(mockRequest);
      expect(ip).toBe('unknown');
    });
  });
});
