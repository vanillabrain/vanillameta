import { Test, TestingModule } from '@nestjs/testing';
import { SqlValidationService } from '../../src/common/security/sql-validation.service';
import { CustomLoggerService } from '../../src/common/logger/logger.service';

describe('SQL Injection Prevention (E2E)', () => {
  let sqlValidationService: SqlValidationService;
  let mockLogger: jest.Mocked<CustomLoggerService>;

  // 테스트용 악성 SQL 쿼리들
  const maliciousQueries = [
    // Classic SQL injection
    "'; DROP TABLE users; --",
    "1' OR '1'='1",
    "1' UNION SELECT * FROM admin_users --",

    // Boolean-based blind injection
    "1' AND (SELECT COUNT(*) FROM information_schema.tables) > 0 --",
    "1' AND (SELECT SUBSTRING(password,1,1) FROM users WHERE id=1)='a' --",

    // Time-based blind injection
    "1'; WAITFOR DELAY '00:00:10' --",
    "1' AND (SELECT SLEEP(10)) --",
    "1' OR BENCHMARK(10000000,MD5(1)) --",

    // Error-based injection
    "1' AND EXTRACTVALUE(1, CONCAT(0x7e, (SELECT database()), 0x7e)) --",
    "1' AND (SELECT COUNT(*) FROM (SELECT 1 UNION SELECT 2 UNION SELECT 3)x GROUP BY CONCAT(password,0x3a,0x3a,FLOOR(RAND(0)*2)))>0 FROM users) --",

    // File operations
    "1' INTO OUTFILE '/tmp/passwords.txt' --",
    "1' UNION SELECT LOAD_FILE('/etc/passwd') --",

    // System commands (MySQL)
    "'; SELECT '<?php system($_GET[\"cmd\"]); ?>' INTO OUTFILE '/var/www/html/shell.php' --",

    // Stacked queries
    "1'; INSERT INTO users (username, password) VALUES ('hacker', 'hacked'); --",
    "1'; DELETE FROM users WHERE id > 1; --",
    "1'; UPDATE users SET password = 'hacked' WHERE id = 1; --",

    // Advanced techniques
    "1' AND ASCII(SUBSTRING((SELECT password FROM users WHERE id=1),1,1)) > 64 --",
    "1' AND (SELECT COUNT(*) FROM mysql.user) > 0 --",

    // Hex encoding attempts
    '0x61646d696e',
    'CHAR(97,100,109,105,110)',

    // Comment variations
    "1'/**/OR/**/1=1/**/--",
    "1'||'1'='1'#",

    // Function abuse
    "1' AND user() LIKE 'root%' --",
    "1' AND version() LIKE '5.%' --",
    "1' AND database() = 'sensitive_db' --",
  ];

  beforeAll(async () => {
    mockLogger = {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
    } as any;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      providers: [
        SqlValidationService,
        {
          provide: CustomLoggerService,
          useValue: mockLogger,
        },
      ],
    }).compile();

    sqlValidationService = moduleFixture.get<SqlValidationService>(SqlValidationService);
  });

  describe('SQL Validation Service Protection', () => {
    it('should block all known SQL injection patterns', () => {
      maliciousQueries.forEach((maliciousQuery, index) => {
        const result = sqlValidationService.validateQuery(maliciousQuery);

        expect(result.isValid).toBe(false);
        expect(['HIGH', 'CRITICAL']).toContain(result.riskLevel);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });

    it('should allow legitimate queries', () => {
      const legitimateQueries = [
        'SELECT id, name FROM users WHERE active = 1',
        'SELECT COUNT(*) FROM orders WHERE date >= "2023-01-01"',
        'SELECT u.name, p.title FROM users u JOIN posts p ON u.id = p.user_id',
        'SELECT * FROM products WHERE price BETWEEN 10 AND 100 ORDER BY name',
        'SELECT category, SUM(amount) FROM sales GROUP BY category HAVING SUM(amount) > 1000',
      ];

      legitimateQueries.forEach(query => {
        const result = sqlValidationService.validateQuery(query);

        expect(result.isValid).toBe(true);
        expect(['LOW', 'MEDIUM']).toContain(result.riskLevel);
      });
    });
  });

  describe('Query Length and Complexity Limits', () => {
    it('should reject extremely long queries', () => {
      const longQuery = 'SELECT * FROM users WHERE ' + 'name = "test" AND '.repeat(1000) + '1=1';

      const result = sqlValidationService.validateQuery(longQuery, { maxQueryLength: 5000 });

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('exceeds maximum'))).toBe(true);
    });

    it('should limit result set size', () => {
      const result = sqlValidationService.validateQuery('SELECT * FROM users', {
        maxResultLimit: 100,
      });

      expect(result.isValid).toBe(true);
      expect(result.sanitizedQuery).toContain('LIMIT 100');
    });

    it('should detect deeply nested queries', () => {
      const deeplyNested =
        'SELECT * FROM (' + 'SELECT * FROM ('.repeat(10) + 'SELECT 1' + ')'.repeat(10) + ')';

      const result = sqlValidationService.validateQuery(deeplyNested);

      expect(result.warnings.some(w => w.includes('nesting'))).toBe(true);
    });
  });

  describe('Database-Specific Security', () => {
    it('should handle different database types safely', () => {
      const queries = [
        { db: 'mysql', query: 'SELECT * FROM `users`' },
        { db: 'postgresql', query: 'SELECT * FROM "users"' },
        { db: 'oracle', query: 'SELECT * FROM "USERS"' },
        { db: 'mssql', query: 'SELECT * FROM [users]' },
      ];

      queries.forEach(({ db, query }) => {
        const result = sqlValidationService.validateQuery(query);
        expect(result.isValid).toBe(true);
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle null and undefined inputs gracefully', () => {
      expect(() => sqlValidationService.validateQuery(null as any)).not.toThrow();
      expect(() => sqlValidationService.validateQuery(undefined as any)).not.toThrow();
      expect(() => sqlValidationService.validateQuery('')).not.toThrow();
    });

    it('should block dangerous injection patterns in complex queries', () => {
      const dangerousPatterns = [
        'SELECT * FROM users; DROP TABLE users;',
        'SELECT * FROM users WHERE id = 1 UNION SELECT * FROM admin',
        'SELECT * FROM users WHERE id = 1; DELETE FROM users;',
        'SELECT LOAD_FILE("/etc/passwd") FROM users',
      ];

      dangerousPatterns.forEach((query, index) => {
        const result = sqlValidationService.validateQuery(query);
        expect(result.isValid).toBe(false);
        expect(['HIGH', 'CRITICAL']).toContain(result.riskLevel);
      });
    });
  });

  describe('Performance and DoS Protection', () => {
    it('should have reasonable validation performance', () => {
      const start = Date.now();

      for (let i = 0; i < 100; i++) {
        sqlValidationService.validateQuery('SELECT * FROM users WHERE id = 1');
      }

      const end = Date.now();
      const duration = end - start;

      // Validation should complete within reasonable time (less than 1 second for 100 queries)
      expect(duration).toBeLessThan(1000);
    });

    it('should handle regex DoS attempts', () => {
      // Create a query that might cause regex backtracking
      const maliciousRegexQuery = 'SELECT * FROM users WHERE name = ' + '"a"'.repeat(1000);

      const start = Date.now();
      const result = sqlValidationService.validateQuery(maliciousRegexQuery);
      const end = Date.now();

      // Should complete quickly even with potentially problematic input
      expect(end - start).toBeLessThan(100);
      expect(result).toBeDefined();
    });
  });
});
