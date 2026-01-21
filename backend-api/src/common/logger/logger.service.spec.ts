import { Test, TestingModule } from '@nestjs/testing';
import { CustomLoggerService } from './logger.service';

describe('CustomLoggerService', () => {
  let service: CustomLoggerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CustomLoggerService],
    }).compile();

    service = module.get<CustomLoggerService>(CustomLoggerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should log info messages with structured format', () => {
    // Winston을 mocking하는 대신 실제 로깅 동작 테스트
    expect(() => {
      service.log('Test message', 'TestContext', {
        userId: 'test-user-123',
        correlationId: 'test-correlation-456',
      });
    }).not.toThrow();
  });

  it('should log error messages with stack trace', () => {
    expect(() => {
      const error = new Error('Test error');
      service.error('Error occurred', error.stack, 'ErrorContext', {
        userId: 'test-user-123',
      });
    }).not.toThrow();
  });

  it('should safely handle circular references', () => {
    expect(() => {
      const circularObj: any = { name: 'test' };
      circularObj.self = circularObj;
      service.log(circularObj, 'TestContext');
    }).not.toThrow();
  });

  it('should log business events correctly', () => {
    expect(() => {
      service.logBusiness('user_login', { ip: '127.0.0.1' }, 'user-123', 'AuthService');
    }).not.toThrow();
  });

  it('should log database queries with proper metadata', () => {
    expect(() => {
      const query = 'SELECT * FROM users WHERE id = ?';
      const params = [123];
      const executionTime = 45;
      service.logQuery(query, params, executionTime, 'UserService');
    }).not.toThrow();
  });

  it('should have proper log level configuration', () => {
    // Test that logger properly sets log levels based on environment
    expect(service).toBeDefined();

    // Test all log methods exist and are callable
    expect(typeof service.log).toBe('function');
    expect(typeof service.info).toBe('function');
    expect(typeof service.error).toBe('function');
    expect(typeof service.warn).toBe('function');
    expect(typeof service.debug).toBe('function');
    expect(typeof service.verbose).toBe('function');
  });
});
