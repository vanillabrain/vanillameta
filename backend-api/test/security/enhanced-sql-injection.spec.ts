import { Test, TestingModule } from '@nestjs/testing';
import { ConnectionService } from '../../src/connection/connection.service';
import { SqlValidationService } from '../../src/common/security/sql-validation.service';
import { Database } from '../../src/database/entities/database.entity';
import { CustomLoggerService } from '../../src/common/logger/logger.service';
import { QueryAnalyzerService } from '../../src/common/monitoring/query-analyzer.service';
import { QueryCollector } from '../../src/common/utils/query-collector';
import { SlowQueryMonitorService } from '../../src/common/monitoring/slow-query-monitor.service';
import { REQUEST } from '@nestjs/core';
import {
  createMockRepository,
  getRepositoryTokenFor,
  createMockService,
} from '../test-helpers';
import { ResponseStatus } from '../../src/common/enum/response-status.enum';

describe('Enhanced SQL Injection Prevention Tests', () => {
  let connectionService: ConnectionService;
  let sqlValidationService: SqlValidationService;
  let databaseRepository: any;
  let logger: any;

  const maliciousQueries = [
    {
      name: 'Classic SQL Injection',
      query: "SELECT * FROM users WHERE id = '1' OR '1'='1'",
      expected: 'HIGH',
    },
    {
      name: 'Union Based Injection',
      query: 'SELECT name FROM users UNION SELECT password FROM admin',
      expected: 'HIGH',
    },
    {
      name: 'Stacked Query Injection',
      query: 'SELECT * FROM users; DROP TABLE users;',
      expected: 'HIGH',
    },
    {
      name: 'Time-based Blind Injection',
      query: "SELECT * FROM users WHERE id = 1 AND SLEEP(5)",
      expected: 'HIGH',
    },
    {
      name: 'Boolean-based Blind Injection',
      query: "SELECT * FROM users WHERE id = 1 AND 1=1",
      expected: 'MEDIUM',
    },
    {
      name: 'Second Order Injection',
      query: "INSERT INTO users (name) VALUES ('admin''--')",
      expected: 'HIGH',
    },
    {
      name: 'Out-of-band Injection',
      query: "SELECT * FROM users WHERE id = 1 AND LOAD_FILE('/etc/passwd')",
      expected: 'HIGH',
    },
    {
      name: 'XML Injection',
      query: "SELECT * FROM users WHERE name = '' OR extractvalue(1,concat(0x7e,database()))",
      expected: 'HIGH',
    },
    {
      name: 'NoSQL Injection Pattern',
      query: "SELECT * FROM users WHERE data LIKE '%{$ne: null}%'",
      expected: 'MEDIUM',
    },
    {
      name: 'Command Injection via SQL',
      query: "SELECT * FROM users WHERE id = 1; EXEC xp_cmdshell('whoami')",
      expected: 'HIGH',
    },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConnectionService,
        SqlValidationService,
        {
          provide: getRepositoryTokenFor(Database),
          useValue: createMockRepository(),
        },
        {
          provide: CustomLoggerService,
          useValue: createMockService(['info', 'warn', 'error', 'debug']),
        },
        {
          provide: QueryAnalyzerService,
          useValue: createMockService(['analyzeQuery']),
        },
        {
          provide: QueryCollector,
          useValue: createMockService(['collect']),
        },
        {
          provide: SlowQueryMonitorService,
          useValue: createMockService(['logSlowQuery']),
        },
        {
          provide: REQUEST,
          useValue: {
            get: jest.fn(),
            path: '/api/test',
            method: 'POST',
            socket: { remoteAddress: '127.0.0.1' },
          },
        },
      ],
    }).compile();

    connectionService = module.get<ConnectionService>(ConnectionService);
    sqlValidationService = module.get<SqlValidationService>(SqlValidationService);
    databaseRepository = module.get(getRepositoryTokenFor(Database));
    logger = module.get<CustomLoggerService>(CustomLoggerService);

    jest.clearAllMocks();
  });

  describe('SQL Injection Attack Patterns', () => {
    maliciousQueries.forEach(({ name, query, expected }) => {
      it(`should detect and prevent ${name}`, () => {
        const result = sqlValidationService.validateQuery(query);
        
        expect(result.isValid).toBe(false);
        expect(result.riskLevel).toBe(expected);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });

    it('should sanitize user input with special characters', () => {
      const userInput = "O'Reilly'; DROP TABLE users; --";
      const query = `SELECT * FROM users WHERE name = ?`;
      
      const result = sqlValidationService.validateQuery(query, [userInput]);
      
      expect(result.isValid).toBe(true);
      expect(result.sanitizedQuery).toContain('?');
      expect(result.parameters[0]).toBe(userInput);
    });

    it('should detect encoded injection attempts', () => {
      const encodedQueries = [
        'SELECT * FROM users WHERE id = 0x31204f522031%3d31', // Hex encoded
        'SELECT * FROM users WHERE id = CHAR(49)+CHAR(32)+CHAR(79)+CHAR(82)', // CHAR encoding
        'SELECT * FROM users WHERE id = 1 %55%4e%49%4f%4e', // URL encoded UNION
      ];

      encodedQueries.forEach(query => {
        const result = sqlValidationService.validateQuery(query);
        expect(result.isValid).toBe(false);
        expect(result.riskLevel).not.toBe('LOW');
      });
    });
  });

  describe('Parameter Validation', () => {
    it('should validate parameter types', () => {
      const queryDto = {
        id: 1,
        query: 'SELECT * FROM users WHERE id = ? AND active = ?',
        parameters: [
          { name: 'id', value: '1; DROP TABLE users', type: 'number' },
          { name: 'active', value: 'true', type: 'boolean' },
        ],
      };

      const validation = sqlValidationService.validateParameters(queryDto.parameters);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Parameter "id" contains invalid characters for number type');
    });

    it('should prevent buffer overflow attempts', () => {
      const longString = 'A'.repeat(10000);
      const query = `SELECT * FROM users WHERE name = ?`;
      
      const result = sqlValidationService.validateQuery(query, [longString]);
      
      expect(result.warnings).toContain('Parameter length exceeds safe limit');
    });
  });

  describe('Context-Aware Validation', () => {
    it('should apply stricter rules for admin operations', () => {
      const adminQueries = [
        'CREATE USER testuser',
        'GRANT ALL PRIVILEGES ON *.* TO testuser',
        'ALTER TABLE users ADD COLUMN secret VARCHAR(255)',
        'DROP DATABASE test',
      ];

      adminQueries.forEach(query => {
        const result = sqlValidationService.validateQuery(query, [], { isAdmin: false });
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Administrative operations not allowed');
      });
    });

    it('should detect privilege escalation attempts', () => {
      const escalationQueries = [
        "UPDATE users SET role = 'admin' WHERE id = 1",
        "INSERT INTO user_roles VALUES (1, 'superadmin')",
        "DELETE FROM permission_checks WHERE user_id = 1",
      ];

      escalationQueries.forEach(query => {
        const result = sqlValidationService.validateQuery(query);
        expect(result.riskLevel).toBe('HIGH');
        expect(result.warnings.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Performance-Based Attack Detection', () => {
    it('should detect resource exhaustion queries', () => {
      const exhaustionQueries = [
        'SELECT * FROM huge_table CROSS JOIN huge_table',
        'SELECT * FROM users WHERE REGEXP_LIKE(name, "^(a|a)*$")',
        'SELECT COUNT(*) FROM (SELECT * FROM users) a, (SELECT * FROM users) b',
      ];

      exhaustionQueries.forEach(query => {
        const result = sqlValidationService.validateQuery(query);
        expect(result.warnings).toContain('Query may cause performance issues');
      });
    });

    it('should limit subquery depth', () => {
      const deepQuery = `
        SELECT * FROM (
          SELECT * FROM (
            SELECT * FROM (
              SELECT * FROM (
                SELECT * FROM users
              ) a
            ) b
          ) c
        ) d
      `;

      const result = sqlValidationService.validateQuery(deepQuery);
      expect(result.warnings).toContain('Query nesting depth exceeds recommended limit');
    });
  });

  describe('Integration with ConnectionService', () => {
    it('should block execution of malicious queries', async () => {
      const maliciousDto = {
        id: 1,
        query: "SELECT * FROM users WHERE id = 1 OR 1=1",
        parameters: [],
      };

      databaseRepository.findOne.mockResolvedValue({
        id: 1,
        connectionConfig: JSON.stringify({}),
      });

      const result = await connectionService.executeQuery(maliciousDto, 'user123');
      
      expect(result.status).toBe(ResponseStatus.ERROR);
      expect(result.message).toContain('SQL validation failed');
      expect(logger.error).toHaveBeenCalledWith(
        'SQL validation failed',
        'ConnectionService',
        expect.objectContaining({
          userId: 'user123',
          riskLevel: expect.any(String),
        })
      );
    });

    it('should log security events', async () => {
      const suspiciousDto = {
        id: 1,
        query: "SELECT * FROM users WHERE name LIKE '%admin%'",
        parameters: [],
      };

      databaseRepository.findOne.mockResolvedValue({
        id: 1,
        connectionConfig: JSON.stringify({}),
      });

      await connectionService.executeQuery(suspiciousDto, 'user123');

      expect(logger.warn).toHaveBeenCalledWith(
        'Potentially suspicious query pattern detected',
        'ConnectionService',
        expect.objectContaining({
          userId: 'user123',
          pattern: 'admin search',
        })
      );
    });
  });

  describe('Advanced Injection Techniques', () => {
    it('should detect JSON-based injection', () => {
      const jsonInjection = `
        SELECT * FROM users 
        WHERE JSON_EXTRACT(data, '$.name') = '{"$ne": null}'
      `;

      const result = sqlValidationService.validateQuery(jsonInjection);
      expect(result.riskLevel).not.toBe('LOW');
    });

    it('should detect stored procedure injection', () => {
      const spInjection = "EXEC sp_executesql N'SELECT * FROM users WHERE id = ' + @id";
      
      const result = sqlValidationService.validateQuery(spInjection);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Dynamic SQL execution not allowed');
    });

    it('should validate multi-statement queries', () => {
      const multiStatement = `
        BEGIN TRANSACTION;
        UPDATE users SET balance = balance - 100 WHERE id = 1;
        UPDATE users SET balance = balance + 100 WHERE id = 2;
        COMMIT;
      `;

      const result = sqlValidationService.validateQuery(multiStatement);
      expect(result.warnings).toContain('Multi-statement queries require additional validation');
    });
  });
});