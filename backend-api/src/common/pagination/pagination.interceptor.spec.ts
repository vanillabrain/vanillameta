import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';
import { PaginationInterceptor, PaginationTransformInterceptor } from './pagination.interceptor';
import { PaginatedResponse } from './pagination.interface';

describe('PaginationInterceptor', () => {
  let interceptor: PaginationInterceptor;
  let mockExecutionContext: ExecutionContext;
  let mockCallHandler: CallHandler;

  beforeEach(() => {
    interceptor = new PaginationInterceptor();
    mockExecutionContext = {} as ExecutionContext;
    mockCallHandler = {
      handle: jest.fn(),
    };
  });

  it('이미 PaginatedResponse 형식인 경우 그대로 반환해야 함', (done) => {
    const response: PaginatedResponse<any> = {
      data: [{ id: 1 }, { id: 2 }],
      meta: {
        hasNext: true,
        hasPrevious: false,
        count: 2,
        limit: 10,
      },
    };

    mockCallHandler.handle = jest.fn().mockReturnValue(of(response));

    interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe((result) => {
      expect(result).toBe(response);
      done();
    });
  });

  it('레거시 페이지네이션 응답을 변환해야 함', (done) => {
    const legacyResponse = {
      data: [{ id: 1 }, { id: 2 }],
      total: 50,
      page: 2,
      limit: 10,
    };

    mockCallHandler.handle = jest.fn().mockReturnValue(of(legacyResponse));

    interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe((result: PaginatedResponse<any>) => {
      expect(result.data).toEqual(legacyResponse.data);
      expect(result.meta.total).toBe(50);
      expect(result.meta.page).toBe(2);
      expect(result.meta.limit).toBe(10);
      expect(result.meta.hasNext).toBe(true);
      expect(result.meta.hasPrevious).toBe(true);
      expect(result.meta.count).toBe(2);
      done();
    });
  });

  it('배열 응답을 기본 페이지네이션 형식으로 래핑해야 함', (done) => {
    const arrayResponse = [{ id: 1 }, { id: 2 }, { id: 3 }];

    mockCallHandler.handle = jest.fn().mockReturnValue(of(arrayResponse));

    interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe((result: PaginatedResponse<any>) => {
      expect(result.data).toEqual(arrayResponse);
      expect(result.meta.hasNext).toBe(false);
      expect(result.meta.hasPrevious).toBe(false);
      expect(result.meta.count).toBe(3);
      expect(result.meta.limit).toBe(3);
      done();
    });
  });

  it('추가 메타데이터를 보존해야 함', (done) => {
    const legacyResponse = {
      data: [{ id: 1 }],
      total: 100,
      page: 1,
      limit: 20,
      customField: 'value',
      extraMeta: { foo: 'bar' },
    };

    mockCallHandler.handle = jest.fn().mockReturnValue(of(legacyResponse));

    interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe((result: PaginatedResponse<any>) => {
      expect(result.meta).toMatchObject({
        total: 100,
        page: 1,
        limit: 20,
        customField: 'value',
        extraMeta: { foo: 'bar' },
      });
      done();
    });
  });

  it('null이나 undefined는 그대로 반환해야 함', (done) => {
    mockCallHandler.handle = jest.fn().mockReturnValue(of(null));

    interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe((result) => {
      expect(result).toBeNull();
      done();
    });
  });

  it('객체가 아닌 응답은 그대로 반환해야 함', (done) => {
    mockCallHandler.handle = jest.fn().mockReturnValue(of('string response'));

    interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe((result) => {
      expect(result).toBe('string response');
      done();
    });
  });
});

describe('PaginationTransformInterceptor', () => {
  let interceptor: PaginationTransformInterceptor;
  let mockExecutionContext: ExecutionContext;
  let mockCallHandler: CallHandler;
  let mockRequest: any;

  beforeEach(() => {
    interceptor = new PaginationTransformInterceptor({ defaultLimit: 20 });
    mockRequest = { query: {} };
    mockExecutionContext = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
    } as ExecutionContext;
    mockCallHandler = {
      handle: jest.fn(),
    };
  });

  it('배열을 페이지네이션해야 함', (done) => {
    const data = Array.from({ length: 50 }, (_, i) => ({ id: i + 1 }));
    mockRequest.query = { page: '2', limit: '10' };

    mockCallHandler.handle = jest.fn().mockReturnValue(of(data));

    interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe((result: PaginatedResponse<any>) => {
      expect(result.data).toHaveLength(10);
      expect(result.data[0].id).toBe(11);
      expect(result.meta.hasNext).toBe(true);
      expect(result.meta.hasPrevious).toBe(true);
      expect(result.meta.page).toBe(2);
      expect(result.meta.limit).toBe(10);
      expect(result.meta.total).toBe(50);
      done();
    });
  });

  it('기본 limit을 사용해야 함', (done) => {
    const data = Array.from({ length: 30 }, (_, i) => ({ id: i + 1 }));

    mockCallHandler.handle = jest.fn().mockReturnValue(of(data));

    interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe((result: PaginatedResponse<any>) => {
      expect(result.data).toHaveLength(20);
      expect(result.meta.limit).toBe(20);
      done();
    });
  });

  it('maxLimit을 초과하지 않아야 함', (done) => {
    interceptor = new PaginationTransformInterceptor({ maxLimit: 50 });
    const data = Array.from({ length: 100 }, (_, i) => ({ id: i + 1 }));
    mockRequest.query = { limit: '100' };

    mockCallHandler.handle = jest.fn().mockReturnValue(of(data));

    interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe((result: PaginatedResponse<any>) => {
      expect(result.data).toHaveLength(50);
      expect(result.meta.limit).toBe(50);
      done();
    });
  });

  it('첫 페이지에서는 hasPrevious가 false여야 함', (done) => {
    const data = Array.from({ length: 30 }, (_, i) => ({ id: i + 1 }));
    mockRequest.query = { page: '1' };

    mockCallHandler.handle = jest.fn().mockReturnValue(of(data));

    interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe((result: PaginatedResponse<any>) => {
      expect(result.meta.hasPrevious).toBe(false);
      expect(result.meta.hasNext).toBe(true);
      done();
    });
  });

  it('마지막 페이지에서는 hasNext가 false여야 함', (done) => {
    const data = Array.from({ length: 25 }, (_, i) => ({ id: i + 1 }));
    mockRequest.query = { page: '2', limit: '20' };

    mockCallHandler.handle = jest.fn().mockReturnValue(of(data));

    interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe((result: PaginatedResponse<any>) => {
      expect(result.data).toHaveLength(5);
      expect(result.meta.hasNext).toBe(false);
      expect(result.meta.hasPrevious).toBe(true);
      done();
    });
  });

  it('includeTotalCount가 false일 때 total을 제외해야 함', (done) => {
    interceptor = new PaginationTransformInterceptor({ includeTotalCount: false });
    const data = [{ id: 1 }, { id: 2 }];

    mockCallHandler.handle = jest.fn().mockReturnValue(of(data));

    interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe((result: PaginatedResponse<any>) => {
      expect(result.meta.total).toBeUndefined();
      done();
    });
  });

  it('배열이 아닌 응답은 그대로 반환해야 함', (done) => {
    const data = { id: 1, name: 'Test' };

    mockCallHandler.handle = jest.fn().mockReturnValue(of(data));

    interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe((result) => {
      expect(result).toBe(data);
      done();
    });
  });

  it('빈 배열을 올바르게 처리해야 함', (done) => {
    mockCallHandler.handle = jest.fn().mockReturnValue(of([]));

    interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe((result: PaginatedResponse<any>) => {
      expect(result.data).toHaveLength(0);
      expect(result.meta.hasNext).toBe(false);
      expect(result.meta.hasPrevious).toBe(false);
      expect(result.meta.total).toBe(0);
      done();
    });
  });

  it('잘못된 page나 limit 값을 처리해야 함', (done) => {
    const data = Array.from({ length: 10 }, (_, i) => ({ id: i + 1 }));
    mockRequest.query = { page: 'invalid', limit: '-5' };

    mockCallHandler.handle = jest.fn().mockReturnValue(of(data));

    interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe((result: PaginatedResponse<any>) => {
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(1); // -5는 1로 변환됨
      done();
    });
  });
});