import { Test, TestingModule } from '@nestjs/testing';
import { SqlValidationService } from './sql-validation.service';
import { CustomLoggerService } from '../logger/logger.service';

describe('SqlValidationService', () => {
  let service: SqlValidationService;
  let mockLogger: jest.Mocked<CustomLoggerService>;

  beforeEach(async () => {
    mockLogger = {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SqlValidationService,
        {
          provide: CustomLoggerService,
          useValue: mockLogger,
        },
      ],
    }).compile();

    service = module.get<SqlValidationService>(SqlValidationService);
  });

  describe('Valid Queries', () => {
    it('should allow simple SELECT query', () => {
      const result = service.validateQuery('SELECT * FROM users');
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.riskLevel).toBe('LOW');
    });

    it('should allow SELECT with WHERE clause', () => {
      const result = service.validateQuery('SELECT id, name FROM users WHERE age > 18');
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should allow SELECT with JOINs', () => {
      const result = service.validateQuery(`
        SELECT u.name, p.title 
        FROM users u 
        JOIN posts p ON u.id = p.user_id 
        WHERE u.active = 1
      `);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should allow WITH clause (CTE)', () => {
      const result = service.validateQuery(`
        WITH active_users AS (
          SELECT * FROM users WHERE active = 1
        )
        SELECT * FROM active_users
      `);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should allow aggregate functions', () => {
      const result = service.validateQuery('SELECT COUNT(*), AVG(age) FROM users GROUP BY department');
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('SQL Injection Prevention', () => {
    it('should block DROP TABLE attacks', () => {
      const result = service.validateQuery('SELECT * FROM users; DROP TABLE users; --');
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('DROP'))).toBe(true);
      expect(result.riskLevel).toBe('CRITICAL');
    });

    it('should block INSERT attacks', () => {
      const result = service.validateQuery("SELECT * FROM users WHERE id = 1; INSERT INTO users (name) VALUES ('hacker'); --");
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('INSERT'))).toBe(true);
      expect(result.riskLevel).toBe('CRITICAL');
    });

    it('should block DELETE attacks', () => {
      const result = service.validateQuery('SELECT * FROM users WHERE id = 1 OR 1=1; DELETE FROM users; --');
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('DELETE'))).toBe(true);
      expect(result.riskLevel).toBe('CRITICAL');
    });

    it('should block UPDATE attacks', () => {
      const result = service.validateQuery("SELECT * FROM users; UPDATE users SET password = 'hacked'; --");
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('UPDATE'))).toBe(true);
      expect(result.riskLevel).toBe('CRITICAL');
    });

    it('should block UNION-based injection', () => {
      const result = service.validateQuery("SELECT name FROM users WHERE id = 1 UNION SELECT password FROM admin_users");
      
      expect(result.isValid).toBe(false);
      expect(result.riskLevel).toBe('CRITICAL');
    });

    it('should warn about comment-based injection patterns', () => {
      const result = service.validateQuery("SELECT * FROM users WHERE id = 1 -- AND password = 'secret'");
      
      expect(result.isValid).toBe(true);  // Comments are warnings, not errors
      expect(result.warnings.some(w => w.includes('comment'))).toBe(true);
      expect(result.riskLevel).toBe('MEDIUM');
    });

    it('should block file operations', () => {
      const result = service.validateQuery("SELECT * INTO OUTFILE '/tmp/users.txt' FROM users");
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('OUTFILE'))).toBe(true);
      expect(result.riskLevel).toBe('CRITICAL');
    });

    it('should warn about system functions', () => {
      const result = service.validateQuery('SELECT USER(), VERSION(), DATABASE()');
      
      expect(result.isValid).toBe(true);  // System functions are warnings, not errors in BI context
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.riskLevel).toBe('HIGH');  // Multiple system functions raise risk to HIGH
    });

    it('should block time-based injection', () => {
      const result = service.validateQuery("SELECT * FROM users WHERE id = 1 AND (SELECT SLEEP(10))");
      
      expect(result.isValid).toBe(false);
      expect(result.riskLevel).toBe('CRITICAL');
    });

    it('should warn about hex encoding attempts', () => {
      const result = service.validateQuery('SELECT * FROM users WHERE name = 0x61646d696e');
      
      expect(result.isValid).toBe(true);  // Hex values are warnings, might be legitimate in some cases
      expect(result.warnings.some(w => w.includes('pattern'))).toBe(true);
      expect(result.riskLevel).toBe('MEDIUM');
    });
  });

  describe('Query Structure Validation', () => {
    it('should reject non-SELECT queries', () => {
      const result = service.validateQuery('CREATE TABLE test (id INT)');
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Only SELECT'))).toBe(true);
      expect(result.riskLevel).toBe('CRITICAL');
    });

    it('should reject empty queries', () => {
      const result = service.validateQuery('   ');
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Empty query'))).toBe(true);
    });

    it('should reject queries that are too long', () => {
      const longQuery = 'SELECT * FROM users WHERE ' + 'a'.repeat(10000);
      const result = service.validateQuery(longQuery, { maxQueryLength: 5000 });
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('exceeds maximum'))).toBe(true);
      expect(result.riskLevel).toBe('HIGH');
    });

    it('should reject multiple statements', () => {
      const result = service.validateQuery('SELECT * FROM users; SELECT * FROM posts;');
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Multiple SQL statements'))).toBe(true);
      expect(result.riskLevel).toBe('HIGH');
    });

    it('should add LIMIT automatically when missing', () => {
      const result = service.validateQuery('SELECT * FROM users', { maxResultLimit: 100 });
      
      expect(result.isValid).toBe(true);
      expect(result.sanitizedQuery).toContain('LIMIT 100');
      expect(result.warnings.some(w => w.includes('LIMIT clause'))).toBe(true);
    });

    it('should preserve existing LIMIT clause', () => {
      const result = service.validateQuery('SELECT * FROM users LIMIT 50', { maxResultLimit: 100 });
      
      expect(result.isValid).toBe(true);
      expect(result.sanitizedQuery).toBe('SELECT * FROM users LIMIT 50');
    });

    it('should handle ORDER BY with auto LIMIT', () => {
      const result = service.validateQuery('SELECT * FROM users ORDER BY name', { maxResultLimit: 100 });
      
      expect(result.isValid).toBe(true);
      expect(result.sanitizedQuery).toContain('ORDER BY name LIMIT 100');
    });
  });

  describe('Function Validation', () => {
    it('should allow safe functions', () => {
      const result = service.validateQuery('SELECT COUNT(*), SUM(price), UPPER(name) FROM products LIMIT 100');
      
      expect(result.isValid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it('should warn about potentially dangerous functions', () => {
      const result = service.validateQuery('SELECT LOAD_FILE("/etc/passwd") FROM users');
      
      expect(result.isValid).toBe(false);
      expect(result.warnings.some(w => w.includes('dangerous function'))).toBe(true);
    });
  });

  describe('Risk Level Assessment', () => {
    it('should assign LOW risk to simple queries', () => {
      const result = service.validateQuery('SELECT name, email FROM users WHERE active = 1');
      
      expect(result.riskLevel).toBe('LOW');
    });

    it('should assign MEDIUM risk to queries with warnings', () => {
      const result = service.validateQuery('SELECT name FROM users WHERE id = 1 ORDER BY (SELECT COUNT(*) FROM products)');
      
      expect(result.riskLevel).toBe('MEDIUM');
    });

    it('should assign HIGH risk to queries with multiple warnings', () => {
      // Create a query with many warnings to trigger HIGH risk
      const query = 'SELECT USER(), VERSION(), DATABASE(), UNKNOWN_FUNC(), 0x123456 FROM users WHERE id = 1 -- comment /* another comment */';
      const result = service.validateQuery(query);
      
      expect(result.warnings.length).toBeGreaterThan(3);
      expect(result.riskLevel).toBe('HIGH');
    });

    it('should assign CRITICAL risk to injection attempts', () => {
      const result = service.validateQuery('SELECT * FROM users WHERE id = 1; DROP TABLE users;');
      
      expect(result.riskLevel).toBe('CRITICAL');
    });
  });

  describe('Query Sanitization', () => {
    it('should remove SQL comments', () => {
      const dirtyQuery = `
        SELECT * FROM users 
        -- This is a comment
        WHERE id = 1 /* Another comment */
      `;
      
      const sanitized = service.sanitizeQuery(dirtyQuery);
      
      expect(sanitized).not.toContain('--');
      expect(sanitized).not.toContain('/*');
      expect(sanitized).not.toContain('*/');
    });

    it('should normalize whitespace', () => {
      const dirtyQuery = '  SELECT    *   FROM   users   WHERE   id  =  1  ';
      const sanitized = service.sanitizeQuery(dirtyQuery);
      
      expect(sanitized).toBe('SELECT * FROM users WHERE id = 1');
    });
  });

  describe('Error Message Generation', () => {
    it('should return empty string for valid queries', () => {
      const result = service.validateQuery('SELECT * FROM users');
      const errorMessage = service.formatValidationError(result);
      
      expect(errorMessage).toBe('');
    });

    it('should return formatted error message for invalid queries', () => {
      const result = service.validateQuery('DROP TABLE users');
      const errorMessage = service.formatValidationError(result);
      
      expect(errorMessage).toContain('SQL validation failed');
      expect(errorMessage).toContain('DROP');
    });
  });

  describe('Logging Behavior', () => {
    it('should log high-risk queries', () => {
      service.validateQuery('SELECT * FROM users; DROP TABLE users;', {}, 'testuser');
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'High-risk SQL query detected',
        'SqlValidationService',
        expect.objectContaining({
          userId: 'testuser',
          riskLevel: 'CRITICAL',
        })
      );
    });

    it('should log successful validations with warnings', () => {
      service.validateQuery('SELECT UNKNOWN_FUNCTION() FROM users', {}, 'testuser');
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        'SQL query validation completed with warnings',
        'SqlValidationService',
        expect.objectContaining({
          userId: 'testuser',
          warningsCount: expect.any(Number),
        })
      );
    });

    it('should log clean queries in debug mode', () => {
      service.validateQuery('SELECT name FROM users WHERE id = 1 LIMIT 100', {}, 'testuser');
      
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'SQL query validation passed',
        'SqlValidationService',
        expect.objectContaining({
          userId: 'testuser',
          riskLevel: 'LOW',
        })
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle null/undefined queries', () => {
      expect(() => service.validateQuery(null as any)).not.toThrow();
      expect(() => service.validateQuery(undefined as any)).not.toThrow();
    });

    it('should handle malformed queries gracefully', () => {
      const result = service.validateQuery('SELECT FROM WHERE');
      
      expect(result).toBeDefined();
      expect(result.isValid).toBeDefined();
    });

    it('should handle deeply nested queries', () => {
      const nestedQuery = `
        SELECT * FROM (
          SELECT * FROM (
            SELECT * FROM (
              SELECT * FROM users
            ) t1
          ) t2
        ) t3
      `;
      
      const result = service.validateQuery(nestedQuery);
      
      expect(result).toBeDefined();
      expect(result.warnings.some(w => w.includes('nesting'))).toBe(true);
    });
  });
});