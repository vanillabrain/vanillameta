import { Test, TestingModule } from '@nestjs/testing';
import { Request, Response, NextFunction } from 'express';
import { CorrelationIdMiddleware, RequestWithCorrelationId } from './correlation-id.middleware';
import { CorrelationIdService } from './correlation-id.service';

describe('CorrelationIdMiddleware', () => {
  let middleware: CorrelationIdMiddleware;
  let mockRequest: Partial<RequestWithCorrelationId>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CorrelationIdMiddleware],
    }).compile();

    middleware = module.get<CorrelationIdMiddleware>(CorrelationIdMiddleware);

    mockRequest = {
      headers: {},
    };

    mockResponse = {
      setHeader: jest.fn(),
    };

    mockNext = jest.fn();
  });

  it('should be defined', () => {
    expect(middleware).toBeDefined();
  });

  it('should generate new correlation ID when not provided', done => {
    middleware.use(mockRequest as RequestWithCorrelationId, mockResponse as Response, () => {
      expect(mockRequest.correlationId).toBeDefined();
      expect(typeof mockRequest.correlationId).toBe('string');
      expect(mockRequest.correlationId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'X-Correlation-ID',
        mockRequest.correlationId,
      );
      done();
    });
  });

  it('should use existing correlation ID from x-correlation-id header', done => {
    const existingId = '123e4567-e89b-12d3-a456-426614174000';
    mockRequest.headers = {
      'x-correlation-id': existingId,
    };

    middleware.use(mockRequest as RequestWithCorrelationId, mockResponse as Response, () => {
      expect(mockRequest.correlationId).toBe(existingId);
      expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Correlation-ID', existingId);
      done();
    });
  });

  it('should use existing correlation ID from X-Correlation-ID header (case sensitive)', done => {
    const existingId = '123e4567-e89b-12d3-a456-426614174000';
    mockRequest.headers = {
      'X-Correlation-ID': existingId,
    };

    middleware.use(mockRequest as RequestWithCorrelationId, mockResponse as Response, () => {
      expect(mockRequest.correlationId).toBe(existingId);
      expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Correlation-ID', existingId);
      done();
    });
  });

  it('should store correlation ID in AsyncLocalStorage', done => {
    const spy = jest.spyOn(CorrelationIdService, 'run');

    middleware.use(mockRequest as RequestWithCorrelationId, mockResponse as Response, () => {
      expect(spy).toHaveBeenCalled();
      expect(spy).toHaveBeenCalledWith(mockRequest.correlationId, expect.any(Function));
      done();
    });
  });
});
