import { AllExceptionsFilter } from './all-exceptions.filter';
import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import enCommon from '../i18n/en/common.json';
import enDatabase from '../i18n/en/database.json';
import koCommon from '../i18n/ko/common.json';
import koDatabase from '../i18n/ko/database.json';
import { QueryFailedError } from 'typeorm';
import {
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
  let translate: jest.Mock;

  beforeEach(async () => {
    // Mock response
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    // Mock request
    mockRequest = {
      headers: { 'accept-language': 'en' },
      url: '/test',
      route: { path: '/test' },
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
    translate = jest.fn(async (key: string, options: { lang: string }) => {
      const resources =
        options.lang === 'ko'
          ? { common: koCommon, database: koDatabase }
          : { common: enCommon, database: enDatabase };
      const translated = key.split('.').reduce((value, part) => value?.[part], resources as any);
      if (typeof translated !== 'string') throw new Error(`Missing test translation: ${key}`);
      return translated;
    });
    filter = new AllExceptionsFilter({ translate } as unknown as I18nService);

    // Mock logger to prevent console output during tests
    mockLogger = jest.spyOn(filter['logger'], 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('HTTP Exception handling', () => {
    it('should handle HttpException with string message', async () => {
      const exception = new HttpException('Test error', HttpStatus.BAD_REQUEST);

      await filter.catch(exception, mockArgumentsHost);

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

    it('should handle HttpException with object response', async () => {
      const exception = new HttpException(
        { message: 'Validation failed', error: 'Bad Request' },
        HttpStatus.BAD_REQUEST,
      );

      await filter.catch(exception, mockArgumentsHost);

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

    it('should handle validation errors with array of messages', async () => {
      const exception = new HttpException(
        {
          message: ['field1 is required', 'field2 must be a string'],
          error: 'Bad Request',
          statusCode: 400,
        },
        HttpStatus.BAD_REQUEST,
      );

      await filter.catch(exception, mockArgumentsHost);

      const response = mockResponse.json.mock.calls[0][0];
      expect(response.message).toBe(enCommon.error.validation_failed);
      // A generic HTTP label must not overwrite the specific validation code.
      expect(response.errorCode).toBe('VALIDATION_ERROR');
      expect(response.details).toEqual(['field1 is required', 'field2 must be a string']);
    });
  });

  describe('Business Exception handling', () => {
    it('should handle EntityNotFoundException', async () => {
      const exception = new EntityNotFoundException('User', 123);

      await filter.catch(exception, mockArgumentsHost);

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

    it('should handle UnauthorizedException', async () => {
      const exception = new UnauthorizedException('Invalid token');

      await filter.catch(exception, mockArgumentsHost);

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

    it('should handle DuplicateException', async () => {
      const exception = new DuplicateException('User', 'email', 'test@example.com');

      await filter.catch(exception, mockArgumentsHost);

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
    it('should handle QueryFailedError', async () => {
      const exception = new QueryFailedError(
        'SELECT * FROM users',
        ['param1'],
        new Error('Column does not exist'),
      );

      await filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: HttpStatus.BAD_REQUEST,
          message: enDatabase.query.failed,
          errorCode: 'DATABASE_ERROR',
        }),
      );
    });
  });

  describe('General Error handling', () => {
    it('should handle general Error', async () => {
      const exception = new Error('Something went wrong');

      await filter.catch(exception, mockArgumentsHost);

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

    it('should handle unknown exception types', async () => {
      const exception = { unknown: 'error' };

      await filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: HttpStatus.INTERNAL_SERVER_ERROR,
          message: enCommon.error.internal_server,
          errorCode: 'INTERNAL_ERROR',
        }),
      );
    });
  });

  describe('Translated fallback messages', () => {
    it('should forward the requested language for unknown errors', async () => {
      await filter.catch({ unknown: 'error' }, mockArgumentsHost);
      expect(translate).toHaveBeenCalledWith('common.error.internal_server', { lang: 'en' });
      expect(mockResponse.json.mock.calls[0][0].message).toBe(enCommon.error.internal_server);
    });

    it('should use Korean when no language header is supplied', async () => {
      delete mockRequest.headers['accept-language'];
      await filter.catch({ unknown: 'error' }, mockArgumentsHost);
      expect(translate).toHaveBeenCalledWith('common.error.internal_server', { lang: 'ko' });
      expect(mockResponse.json.mock.calls[0][0].message).toBe(koCommon.error.internal_server);
    });
  });

  describe('Correlation ID handling', () => {
    it('should use existing correlation ID from headers', async () => {
      const correlationId = 'test-correlation-id';
      mockRequest.headers['x-correlation-id'] = correlationId;

      const exception = new Error('Test error');
      await filter.catch(exception, mockArgumentsHost);

      const response = mockResponse.json.mock.calls[0][0];
      expect(response.correlationId).toBe(correlationId);
    });

    it('should generate new correlation ID if not provided', async () => {
      const exception = new Error('Test error');
      await filter.catch(exception, mockArgumentsHost);

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

    it('should include stack trace in non-production environment', async () => {
      process.env.NODE_ENV = 'development';
      const exception = new Error('Test error');

      await filter.catch(exception, mockArgumentsHost);

      const response = mockResponse.json.mock.calls[0][0];
      expect(response.stack).toBeDefined();
      expect(Array.isArray(response.stack)).toBe(true);
    });

    it('should exclude stack trace in production environment', async () => {
      process.env.NODE_ENV = 'production';
      const exception = new Error('Test error');

      await filter.catch(exception, mockArgumentsHost);

      const response = mockResponse.json.mock.calls[0][0];
      expect(response.stack).toBeUndefined();
    });

    it('should include query details for database errors in development', async () => {
      process.env.NODE_ENV = 'development';
      const exception = new QueryFailedError(
        'SELECT * FROM users',
        ['param1'],
        new Error('Column does not exist'),
      );

      await filter.catch(exception, mockArgumentsHost);

      const response = mockResponse.json.mock.calls[0][0];
      expect(response.details).toBeDefined();
      expect(response.details.query).toBe('SELECT * FROM users');
      expect(response.details.parameters).toEqual(['param1']);
    });

    it('should exclude query details for database errors in production', async () => {
      process.env.NODE_ENV = 'production';
      const exception = new QueryFailedError(
        'SELECT * FROM users',
        ['param1'],
        new Error('Column does not exist'),
      );

      await filter.catch(exception, mockArgumentsHost);

      const response = mockResponse.json.mock.calls[0][0];
      expect(response).not.toHaveProperty('details');
    });
  });

  describe('Error logging', () => {
    it.each([true, false])(
      'does not expose capability URLs in route fields (matched=%s)',
      async matched => {
        mockRequest.url = '/share/private-capability?token=private-capability';
        mockRequest.path = '/share/private-capability';
        mockRequest.originalUrl = mockRequest.url;
        mockRequest.baseUrl = '/tenant/private-capability';
        mockRequest.route = matched ? { path: '/share/:shareId' } : undefined;
        await filter.catch(
          new HttpException('Test error', HttpStatus.BAD_REQUEST),
          mockArgumentsHost,
        );
        const route = matched ? '/share/:shareId' : '[unmatched]';
        expect(mockResponse.json.mock.calls[0][0].path).toBe(route);
        expect(mockLogger.mock.calls[0][0]).toContain(`GET ${route}`);
        expect(JSON.stringify(mockLogger.mock.calls)).not.toContain('private-capability');
      },
    );

    it('should log error with correlation ID and details', async () => {
      const exception = new HttpException('Test error', HttpStatus.BAD_REQUEST);

      await filter.catch(exception, mockArgumentsHost);

      expect(mockLogger).toHaveBeenCalled();
      const logMessage = mockLogger.mock.calls[0][0];
      expect(logMessage).toContain('GET /test');
      expect(logMessage).toContain('400');
      expect(logMessage).toContain('INTERNAL_ERROR');
    });
  });
});
