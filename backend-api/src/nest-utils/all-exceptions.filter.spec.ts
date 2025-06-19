import { AllExceptionsFilter } from './all-exceptions.filter';
import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { QueryFailedError } from 'typeorm';
import {
  BusinessException,
  EntityNotFoundException,
  UnauthorizedException,
  DuplicateException,
} from '../common/exceptions/business.exception';

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let mockArgumentsHost: ArgumentsHost;
  let mockResponse: any;
  let mockRequest: any;
  let mockLogger: any;

  beforeEach(async () => {
    // Mock response
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    // Mock request
    mockRequest = {
      headers: {},
      url: '/test',
      method: 'GET',
    };

    // Mock ArgumentsHost
    mockArgumentsHost = {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: jest.fn().mockReturnValue(mockResponse),
        getRequest: jest.fn().mockReturnValue(mockRequest),
      }),
    } as unknown as ArgumentsHost;

    // Create filter instance
    filter = new AllExceptionsFilter();

    // Mock logger to prevent console output during tests
    mockLogger = jest.spyOn(filter['logger'], 'error').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('HTTP Exception handling', () => {
    it('should handle HttpException with string message', () => {
      const exception = new HttpException('Test error', HttpStatus.BAD_REQUEST);

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: HttpStatus.BAD_REQUEST,
          message: 'Test error',
          errorCode: 'INTERNAL_ERROR',
          path: '/test',
          method: 'GET',
        }),
      );
    });

    it('should handle HttpException with object response', () => {
      const exception = new HttpException(
        { message: 'Validation failed', error: 'Bad Request' },
        HttpStatus.BAD_REQUEST,
      );

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: HttpStatus.BAD_REQUEST,
          message: 'Validation failed',
          errorCode: 'BAD_REQUEST',
        }),
      );
    });

    it('should handle validation errors with array of messages', () => {
      const exception = new HttpException(
        {
          message: ['field1 is required', 'field2 must be a string'],
          error: 'Bad Request',
          statusCode: 400,
        },
        HttpStatus.BAD_REQUEST,
      );

      filter.catch(exception, mockArgumentsHost);

      const response = mockResponse.json.mock.calls[0][0];
      expect(response.message).toBe('Validation failed');
      expect(response.errorCode).toBe('VALIDATION_ERROR');
      expect(response.details).toEqual(['field1 is required', 'field2 must be a string']);
    });
  });

  describe('Business Exception handling', () => {
    it('should handle EntityNotFoundException', () => {
      const exception = new EntityNotFoundException('User', 123);

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: HttpStatus.NOT_FOUND,
          message: 'User with id 123 not found',
          errorCode: 'ENTITY_NOT_FOUND',
        }),
      );
    });

    it('should handle UnauthorizedException', () => {
      const exception = new UnauthorizedException('Invalid token');

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: HttpStatus.UNAUTHORIZED,
          message: 'Invalid token',
          errorCode: 'UNAUTHORIZED',
        }),
      );
    });

    it('should handle DuplicateException', () => {
      const exception = new DuplicateException('User', 'email', 'test@example.com');

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: HttpStatus.CONFLICT,
          message: "User with email 'test@example.com' already exists",
          errorCode: 'DUPLICATE_ENTITY',
        }),
      );
    });
  });

  describe('TypeORM Exception handling', () => {
    it('should handle QueryFailedError', () => {
      const exception = new QueryFailedError(
        'SELECT * FROM users',
        ['param1'],
        new Error('Column does not exist'),
      );

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: HttpStatus.BAD_REQUEST,
          message: 'Database query failed',
          errorCode: 'DATABASE_ERROR',
        }),
      );
    });
  });

  describe('General Error handling', () => {
    it('should handle general Error', () => {
      const exception = new Error('Something went wrong');

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Something went wrong',
          errorCode: 'INTERNAL_ERROR',
        }),
      );
    });

    it('should handle unknown exception types', () => {
      const exception = { unknown: 'error' };

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Internal server error',
          errorCode: 'INTERNAL_ERROR',
        }),
      );
    });
  });

  describe('Correlation ID handling', () => {
    it('should use existing correlation ID from headers', () => {
      const correlationId = 'test-correlation-id';
      mockRequest.headers['x-correlation-id'] = correlationId;

      const exception = new Error('Test error');
      filter.catch(exception, mockArgumentsHost);

      const response = mockResponse.json.mock.calls[0][0];
      expect(response.correlationId).toBe(correlationId);
    });

    it('should generate new correlation ID if not provided', () => {
      const exception = new Error('Test error');
      filter.catch(exception, mockArgumentsHost);

      const response = mockResponse.json.mock.calls[0][0];
      expect(response.correlationId).toBeDefined();
      expect(response.correlationId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
    });
  });

  describe('Environment-based error details', () => {
    const originalEnv = process.env.NODE_ENV;

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    it('should include stack trace in non-production environment', () => {
      process.env.NODE_ENV = 'development';
      const exception = new Error('Test error');

      filter.catch(exception, mockArgumentsHost);

      const response = mockResponse.json.mock.calls[0][0];
      expect(response.stack).toBeDefined();
      expect(Array.isArray(response.stack)).toBe(true);
    });

    it('should exclude stack trace in production environment', () => {
      process.env.NODE_ENV = 'production';
      const exception = new Error('Test error');

      filter.catch(exception, mockArgumentsHost);

      const response = mockResponse.json.mock.calls[0][0];
      expect(response.stack).toBeUndefined();
    });

    it('should include query details for database errors in development', () => {
      process.env.NODE_ENV = 'development';
      const exception = new QueryFailedError(
        'SELECT * FROM users',
        ['param1'],
        new Error('Column does not exist'),
      );

      filter.catch(exception, mockArgumentsHost);

      const response = mockResponse.json.mock.calls[0][0];
      expect(response.details).toBeDefined();
      expect(response.details.query).toBe('SELECT * FROM users');
      expect(response.details.parameters).toEqual(['param1']);
    });

    it('should exclude query details for database errors in production', () => {
      process.env.NODE_ENV = 'production';
      const exception = new QueryFailedError(
        'SELECT * FROM users',
        ['param1'],
        new Error('Column does not exist'),
      );

      filter.catch(exception, mockArgumentsHost);

      const response = mockResponse.json.mock.calls[0][0];
      expect(response.details).toBeNull();
    });
  });

  describe('Error logging', () => {
    it('should log error with correlation ID and details', () => {
      const exception = new HttpException('Test error', HttpStatus.BAD_REQUEST);

      filter.catch(exception, mockArgumentsHost);

      expect(mockLogger).toHaveBeenCalled();
      const logMessage = mockLogger.mock.calls[0][0];
      expect(logMessage).toContain('GET /test');
      expect(logMessage).toContain('400');
      expect(logMessage).toContain('INTERNAL_ERROR');
    });
  });
});
