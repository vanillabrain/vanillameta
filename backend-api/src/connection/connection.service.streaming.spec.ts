import { Test, TestingModule } from '@nestjs/testing';
import { ConnectionService } from './connection.service';
import { Repository } from 'typeorm';
import { Database } from '../database/entities/database.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CustomLoggerService } from '../common/logger/logger.service';
import { SqlValidationService } from '../common/security/sql-validation.service';
import { QueryAnalyzerService } from '../common/monitoring/query-analyzer.service';
import { QueryCollector } from '../common/utils/query-collector';
import { SlowQueryMonitorService } from '../common/monitoring/slow-query-monitor.service';
import { DatabaseOptimizerFactory } from './database-optimizers/database-optimizer-factory';
import { REQUEST } from '@nestjs/core';
import { Readable } from 'stream';

describe('ConnectionService - Streaming Query', () => {
  let service: ConnectionService;
  let databaseRepository: jest.Mocked<Repository<Database>>;
  let logger: jest.Mocked<CustomLoggerService>;
  let sqlValidationService: jest.Mocked<SqlValidationService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConnectionService,
        {
          provide: getRepositoryToken(Database),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: CustomLoggerService,
          useValue: {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
          },
        },
        {
          provide: SqlValidationService,
          useValue: {
            validateQuery: jest.fn(),
            formatValidationError: jest.fn(),
          },
        },
        {
          provide: QueryAnalyzerService,
          useValue: {
            analyzeQuery: jest.fn(),
          },
        },
        {
          provide: QueryCollector,
          useValue: {
            collect: jest.fn(),
          },
        },
        {
          provide: SlowQueryMonitorService,
          useValue: {
            logSlowQuery: jest.fn(),
          },
        },
        {
          provide: DatabaseOptimizerFactory,
          useValue: {
            getOptimizedConnectionConfig: jest.fn(),
            isSupported: jest.fn(),
            getOptimizationStats: jest.fn(),
          },
        },
        {
          provide: REQUEST,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<ConnectionService>(ConnectionService);
    databaseRepository = module.get(getRepositoryToken(Database));
    logger = module.get(CustomLoggerService);
    sqlValidationService = module.get(SqlValidationService);
  });

  describe('executeStreamingQuery', () => {
    it('should return a readable stream for valid query', async () => {
      // SQL 검증 성공 설정
      sqlValidationService.validateQuery.mockReturnValue({
        isValid: true,
        errors: [],
        warnings: [],
        riskLevel: 'LOW',
        sanitizedQuery: 'SELECT * FROM users',
      });

      // Mock Knex 인스턴스
      const mockStream = new Readable({
        objectMode: true,
        read() {
          this.push({ id: 1, name: 'John' });
          this.push({ id: 2, name: 'Jane' });
          this.push(null); // 스트림 종료
        },
      });

      const mockKnex = {
        raw: jest.fn().mockReturnValue({
          stream: jest.fn().mockReturnValue(mockStream),
        }),
        client: {
          config: {
            client: 'mysql2',
          },
        },
      };

      // getKnex 메서드 모킹
      jest.spyOn(service, 'getKnex').mockResolvedValue(mockKnex as any);

      const result = await service.executeStreamingQuery({
        id: 1,
        query: 'SELECT * FROM users',
      });

      expect(result).toHaveProperty('stream');
      expect(result.stream).toBeInstanceOf(Readable);
      expect(result.error).toBeUndefined();
    });

    it('should handle SQL validation failure', async () => {
      // SQL 검증 실패 설정
      sqlValidationService.validateQuery.mockReturnValue({
        isValid: false,
        errors: ['Dangerous SQL pattern detected'],
        warnings: [],
        riskLevel: 'HIGH',
        sanitizedQuery: 'DROP TABLE users',
      });
      sqlValidationService.formatValidationError.mockReturnValue('Dangerous SQL pattern detected');

      await expect(
        service.executeStreamingQuery({
          id: 1,
          query: 'DROP TABLE users',
        }),
      ).rejects.toThrow('SQL validation failed');

      expect(logger.warn).toHaveBeenCalledWith(
        'SQL validation failed for streaming query',
        'ConnectionService',
        expect.any(Object),
      );
    });

    it('should process chunks correctly for different database types', async () => {
      const databases = [
        { client: 'mysql2', expectedChunkSize: 16 * 1024 },
        { client: 'pg', expectedChunkSize: 64 * 1024 },
        { client: 'sqlite3', expectedChunkSize: 8 * 1024 },
      ];

      for (const db of databases) {
        // @ts-ignore - private 메서드 테스트
        const options = service.getStreamOptionsForDatabase(db.client);
        expect(options.highWaterMark).toBe(db.expectedChunkSize);
        expect(options.objectMode).toBe(true);
      }
    });

    it('should collect NDJSON formatted output', (done) => {
      // SQL 검증 성공 설정
      sqlValidationService.validateQuery.mockReturnValue({
        isValid: true,
        errors: [],
        warnings: [],
        riskLevel: 'LOW',
        sanitizedQuery: 'SELECT * FROM test',
      });

      // Mock 스트림 생성
      const mockStream = new Readable({
        objectMode: true,
        read() {
          this.push({ id: 1, value: 'test1' });
          this.push({ id: 2, value: 'test2' });
          this.push(null);
        },
      });

      const mockKnex = {
        raw: jest.fn().mockReturnValue({
          stream: jest.fn().mockReturnValue(mockStream),
        }),
        client: {
          config: {
            client: 'sqlite3',
          },
        },
      };

      jest.spyOn(service, 'getKnex').mockResolvedValue(mockKnex as any);

      const result = await service.executeStreamingQuery({
        id: 1,
        query: 'SELECT * FROM test',
      });

      const chunks: string[] = [];
      result.stream.on('data', (chunk) => {
        chunks.push(chunk.toString());
      });

      result.stream.on('end', () => {
        const fullOutput = chunks.join('');
        const lines = fullOutput.split('\n').filter(line => line.trim());

        // 첫 번째 라인: 필드 정보
        const fields = JSON.parse(lines[0]);
        expect(fields.type).toBe('fields');
        expect(fields.data).toHaveLength(2); // id, value

        // 데이터 라인들
        const data1 = JSON.parse(lines[1]);
        expect(data1.type).toBe('data');
        expect(data1.data).toEqual({ id: 1, value: 'test1' });

        const data2 = JSON.parse(lines[2]);
        expect(data2.type).toBe('data');
        expect(data2.data).toEqual({ id: 2, value: 'test2' });

        // 완료 라인
        const complete = JSON.parse(lines[lines.length - 1]);
        expect(complete.type).toBe('complete');
        expect(complete.rowCount).toBe(2);

        done();
      });
    });

    it('should handle stream errors gracefully', (done) => {
      // SQL 검증 성공 설정
      sqlValidationService.validateQuery.mockReturnValue({
        isValid: true,
        errors: [],
        warnings: [],
        riskLevel: 'LOW',
        sanitizedQuery: 'SELECT * FROM users',
      });

      // 에러를 발생시키는 스트림
      const mockStream = new Readable({
        objectMode: true,
        read() {
          this.emit('error', new Error('Database connection lost'));
        },
      });

      const mockKnex = {
        raw: jest.fn().mockReturnValue({
          stream: jest.fn().mockReturnValue(mockStream),
        }),
        client: {
          config: {
            client: 'mysql2',
          },
        },
      };

      jest.spyOn(service, 'getKnex').mockResolvedValue(mockKnex as any);

      const result = await service.executeStreamingQuery({
        id: 1,
        query: 'SELECT * FROM test',
      });

      result.stream.on('data', (chunk) => {
        const data = chunk.toString();
        const parsed = JSON.parse(data.trim());
        
        if (parsed.type === 'error') {
          expect(parsed.error).toContain('Database connection lost');
          done();
        }
      });
    });

    it('should log progress for large datasets', async () => {
      jest.setTimeout(30000); // 30초로 타임아웃 증가
      // SQL 검증 성공 설정
      sqlValidationService.validateQuery.mockReturnValue({
        isValid: true,
        errors: [],
        warnings: [],
        riskLevel: 'LOW',
        sanitizedQuery: 'SELECT * FROM users',
      });

      // 많은 데이터를 생성하는 스트림
      let count = 0;
      const mockStream = new Readable({
        objectMode: true,
        read() {
          if (count < 10001) {
            this.push({ id: count++, data: 'test' });
          } else {
            this.push(null);
          }
        },
      });

      const mockKnex = {
        raw: jest.fn().mockReturnValue({
          stream: jest.fn().mockReturnValue(mockStream),
        }),
        client: {
          config: {
            client: 'pg',
          },
        },
      };

      jest.spyOn(service, 'getKnex').mockResolvedValue(mockKnex as any);

      const result = await service.executeStreamingQuery({
        id: 1,
        query: 'SELECT * FROM large_table',
      });

      await new Promise((resolve) => {
        result.stream.on('end', resolve);
        result.stream.resume(); // 스트림 소비
      });

      // 10000행마다 로깅되는지 확인
      expect(logger.info).toHaveBeenCalledWith(
        'Streaming query progress',
        'ConnectionService',
        expect.objectContaining({
          rowsProcessed: 10000,
        }),
      );
    });
  });
});