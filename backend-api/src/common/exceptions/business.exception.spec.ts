import { HttpStatus } from '@nestjs/common';
import {
  BusinessException,
  EntityNotFoundException,
  DuplicateException,
  UnauthorizedException,
  ForbiddenException,
  ValidationException,
  DatabaseConnectionException,
  QueryExecutionException,
  ExternalServiceException,
  FileProcessingException,
  TokenException,
  BusinessRuleException,
} from './business.exception';

describe('Business Exceptions', () => {
  describe('BusinessException', () => {
    it('should create a business exception with default status code', () => {
      const exception = new BusinessException('Test message', 'TEST_ERROR');

      expect(exception.getStatus()).toBe(HttpStatus.BAD_REQUEST);
      expect(exception.getResponse()).toEqual({
        message: 'Test message',
        error: 'TEST_ERROR',
      });
    });

    it('should create a business exception with custom status code', () => {
      const exception = new BusinessException('Test message', 'TEST_ERROR', HttpStatus.FORBIDDEN);

      expect(exception.getStatus()).toBe(HttpStatus.FORBIDDEN);
    });
  });

  describe('EntityNotFoundException', () => {
    it('should create exception with entity and id', () => {
      const exception = new EntityNotFoundException('User', 123);

      expect(exception.getStatus()).toBe(HttpStatus.NOT_FOUND);
      expect(exception.getResponse()).toEqual({
        message: 'User with id 123 not found',
        error: 'ENTITY_NOT_FOUND',
      });
    });

    it('should create exception with entity only', () => {
      const exception = new EntityNotFoundException('User');

      expect(exception.getResponse()).toEqual({
        message: 'User not found',
        error: 'ENTITY_NOT_FOUND',
      });
    });
  });

  describe('DuplicateException', () => {
    it('should create duplicate exception', () => {
      const exception = new DuplicateException('User', 'email', 'test@example.com');

      expect(exception.getStatus()).toBe(HttpStatus.CONFLICT);
      expect(exception.getResponse()).toEqual({
        message: "User with email 'test@example.com' already exists",
        error: 'DUPLICATE_ENTITY',
      });
    });
  });

  describe('UnauthorizedException', () => {
    it('should create unauthorized exception with default message', () => {
      const exception = new UnauthorizedException();

      expect(exception.getStatus()).toBe(HttpStatus.UNAUTHORIZED);
      expect(exception.getResponse()).toEqual({
        message: 'Unauthorized access',
        error: 'UNAUTHORIZED',
      });
    });

    it('should create unauthorized exception with custom message', () => {
      const exception = new UnauthorizedException('Invalid credentials');

      expect(exception.getResponse()).toEqual({
        message: 'Invalid credentials',
        error: 'UNAUTHORIZED',
      });
    });
  });

  describe('ForbiddenException', () => {
    it('should create forbidden exception', () => {
      const exception = new ForbiddenException('admin panel');

      expect(exception.getStatus()).toBe(HttpStatus.FORBIDDEN);
      expect(exception.getResponse()).toEqual({
        message: 'Access to admin panel is forbidden',
        error: 'FORBIDDEN',
      });
    });
  });

  describe('ValidationException', () => {
    it('should create validation exception', () => {
      const errors = ['field1 is required', 'field2 must be a number'];
      const exception = new ValidationException(errors);

      expect(exception.getStatus()).toBe(HttpStatus.BAD_REQUEST);
      expect(exception.getResponse()).toEqual({
        message: 'Validation failed',
        error: 'VALIDATION_ERROR',
      });
    });
  });

  describe('DatabaseConnectionException', () => {
    it('should create database connection exception', () => {
      const exception = new DatabaseConnectionException('MySQL');

      expect(exception.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
      expect(exception.getResponse()).toEqual({
        message: 'Failed to connect to database: MySQL',
        error: 'DATABASE_CONNECTION_ERROR',
      });
    });
  });

  describe('QueryExecutionException', () => {
    it('should create query execution exception', () => {
      const exception = new QueryExecutionException('Invalid SQL syntax');

      expect(exception.getStatus()).toBe(HttpStatus.BAD_REQUEST);
      expect(exception.getResponse()).toEqual({
        message: 'Query execution failed: Invalid SQL syntax',
        error: 'QUERY_EXECUTION_ERROR',
      });
    });
  });

  describe('ExternalServiceException', () => {
    it('should create external service exception', () => {
      const exception = new ExternalServiceException('Payment Gateway', 'Connection timeout');

      expect(exception.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
      expect(exception.getResponse()).toEqual({
        message: 'External service Payment Gateway failed: Connection timeout',
        error: 'EXTERNAL_SERVICE_ERROR',
      });
    });
  });

  describe('FileProcessingException', () => {
    it('should create file processing exception', () => {
      const exception = new FileProcessingException('Invalid file format');

      expect(exception.getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
      expect(exception.getResponse()).toEqual({
        message: 'File processing failed: Invalid file format',
        error: 'FILE_PROCESSING_ERROR',
      });
    });
  });

  describe('TokenException', () => {
    it('should create token exception with default message', () => {
      const exception = new TokenException();

      expect(exception.getStatus()).toBe(HttpStatus.UNAUTHORIZED);
      expect(exception.getResponse()).toEqual({
        message: 'Invalid or expired token',
        error: 'TOKEN_ERROR',
      });
    });

    it('should create token exception with custom message', () => {
      const exception = new TokenException('Token has been revoked');

      expect(exception.getResponse()).toEqual({
        message: 'Token has been revoked',
        error: 'TOKEN_ERROR',
      });
    });
  });

  describe('BusinessRuleException', () => {
    it('should create business rule exception', () => {
      const exception = new BusinessRuleException('Cannot delete user with active orders');

      expect(exception.getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
      expect(exception.getResponse()).toEqual({
        message: 'Business rule violated: Cannot delete user with active orders',
        error: 'BUSINESS_RULE_VIOLATION',
      });
    });
  });
});
