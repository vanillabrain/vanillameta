import { Injectable, BadRequestException, ForbiddenException, Inject } from '@nestjs/common';
import { CreateDatabaseDto } from '../database/dto/create-database.dto';
import { QueryExecuteDto } from '../database/dto/query-execute.dto';
import { Knex, knex } from 'knex';
import { FieldTypeUtil } from '../utils/field-type.util';
import { Database } from '../database/entities/database.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ResponseStatus } from '../common/enum/response-status.enum';
import { SnowflakeDialect } from './knex-dialects/snowflake';
import { CustomLoggerService } from '../common/logger/logger.service';
import { SqlValidationService } from '../common/security/sql-validation.service';
import { QueryAnalyzerService } from '../common/monitoring/query-analyzer.service';
import { QueryCollector } from '../common/utils/query-collector';
import { SlowQueryMonitorService } from '../common/monitoring/slow-query-monitor.service';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { BigQueryClient } = require('knex-bigquery');

export const knexConnections = new Map<number, Knex>();

@Injectable()
export class ConnectionService {
  constructor(
    @InjectRepository(Database) private databaseRepository: Repository<Database>,
    private readonly logger: CustomLoggerService,
    private readonly sqlValidationService: SqlValidationService,
    private readonly queryAnalyzerService: QueryAnalyzerService,
    private readonly queryCollector: QueryCollector,
    private readonly slowQueryMonitorService: SlowQueryMonitorService,
    @Inject(REQUEST) private readonly request: Request,
  ) {}

  /**
   * Knex 객체 생성 후 pool에 추가
   * @param id
   * @param options
   */
  addKnex(id: number, options: Knex.Config) {
    if (!this.hasKnex(id)) {
      // Lambda 환경에 최적화된 연결 풀 설정 추가
      const optimizedOptions: Knex.Config = {
        ...options,
        pool: {
          min: 0, // Lambda에서는 0으로 시작
          max: parseInt(process.env.KNEX_POOL_MAX) || 3, // 작은 최대값
          createTimeoutMillis: 30000, // 30초
          acquireTimeoutMillis: 30000, // 30초
          idleTimeoutMillis: 30000, // 30초 - Lambda 유휴 시간 고려
          reapIntervalMillis: 1000, // 1초마다 유휴 연결 정리
          createRetryIntervalMillis: 100, // 100ms 후 재시도
          propagateCreateError: false, // 연결 생성 실패 시 에러 전파하지 않음
        },
        acquireConnectionTimeout: 30000, // 전체 연결 획득 타임아웃
        ...(options.client !== 'sqlite3' && {
          // SQLite를 제외한 모든 DB에 대해 추가 설정
          connection: {
            ...((options.connection as any) || {}),
            // MySQL/MariaDB 특정 설정
            ...(typeof options.client === 'string' &&
              ['mysql', 'mysql2', 'mariadb'].includes(options.client) && {
                connectTimeout: 30000,
                enableKeepAlive: true,
                keepAliveInitialDelay: 0,
              }),
          },
        }),
      };

      this.logger.info(
        'Creating Knex connection with optimized pool settings',
        'ConnectionService',
        {
          databaseId: id,
          client: options.client,
          poolSettings: optimizedOptions.pool,
        },
      );

      knexConnections.set(id, knex(optimizedOptions));
    }
  }

  /**
   * Knex 객체 pool에서 삭제
   * @param id
   */
  async removeKnex(id: number) {
    const knexInstance = knexConnections.get(id);
    if (knexInstance) {
      try {
        // 연결 풀 정리
        await knexInstance.destroy();
        this.logger.info('Knex connection pool destroyed', 'ConnectionService', {
          databaseId: id,
        });
      } catch (error) {
        this.logger.error(
          'Failed to destroy Knex connection pool',
          error.stack,
          'ConnectionService',
          {
            databaseId: id,
          },
        );
      }
      knexConnections.delete(id);
    }
  }

  /**
   * Knex 객체 pool 안에 존재 유무
   * @param id
   */
  hasKnex(id: number): boolean {
    return knexConnections.has(id);
  }

  /**
   * Knex 객체 가져오기 - 만약 없으면 가져오기
   * @param id
   */
  async getKnex(id: number): Promise<Knex> {
    if (!this.hasKnex(id)) {
      const one = await this.databaseRepository.findOne({ where: { id: id } });
      one.connectionConfig = JSON.parse(one.connectionConfig);
      const knexConfig = one.connectionConfig;
      if (knexConfig['client'] == 'bigquery') {
        knexConfig['client'] = BigQueryClient;
      } else if (knexConfig['client'] == 'snowflake') {
        knexConfig['client'] = SnowflakeDialect;
      }
      this.addKnex(id, knexConfig as Knex.Config);
    }
    return knexConnections.get(id);
  }

  /**
   * 데이터베이스 연결 테스트
   * @param createDatabaseDto
   */
  async testConnection(
    createDatabaseDto: CreateDatabaseDto,
  ): Promise<{ status: ResponseStatus; message?: string; data?: { message: string } }> {
    let engine: string | any = createDatabaseDto.engine;
    switch (createDatabaseDto.engine) {
      case 'bigquery':
        engine = BigQueryClient;
        break;
      case 'snowflake':
        engine = SnowflakeDialect;
        break;
    }

    if (createDatabaseDto.engine === 'cockroachdb') {
      const connectioninfo = createDatabaseDto.connectionConfig;
      const cockroach_url = `postgresql://${connectioninfo['user']}:${connectioninfo['password']}@${connectioninfo['host']}:${connectioninfo['port']}/${connectioninfo['database']}?sslmode=verify-full&options=--cluster%3Dvanillameta-cockroach-3010`;
      connectioninfo['connectionString'] = cockroach_url;
    }

    const connectionConfig: Knex.Config = {
      client: engine,
      connection: createDatabaseDto.connectionConfig,
      useNullAsDefault: true,
      // 테스트 연결을 위한 최소한의 풀 설정
      pool: {
        min: 0,
        max: 1, // 테스트용이므로 1개만
        createTimeoutMillis: 10000, // 10초 - 테스트용이므로 짧게
        acquireTimeoutMillis: 10000,
        idleTimeoutMillis: 0, // 즉시 정리
        reapIntervalMillis: 500,
      },
      acquireConnectionTimeout: 10000,
    };

    // createDatabaseDto.connectionConfig = JSON.stringify(connectionConfig);
    // console.log(createDatabaseDto)
    let _knex: Knex;
    let returnObj: { status: ResponseStatus; message?: string; data?: { message: string } } = {
      status: ResponseStatus.ERROR,
    };
    try {
      _knex = knex(connectionConfig as Knex.Config);
    } catch (e) {
      this.logger.error('Failed to create Knex connection', e.stack, 'ConnectionService', {
        engine: createDatabaseDto.engine,
        connectionConfig:
          typeof createDatabaseDto.connectionConfig === 'string'
            ? 'string-config'
            : createDatabaseDto.connectionConfig,
      });
      return { status: ResponseStatus.ERROR, message: 'knex not connected' };
    }

    const testQuery = createDatabaseDto.engine == 'oracledb' ? 'SELECT 1 FROM DUAL' : 'SELECT 1';

    try {
      await _knex.raw(testQuery);
      returnObj = { status: ResponseStatus.SUCCESS, data: { message: 'success' } };
    } catch (e) {
      this.logger.error('Database connection test failed', e.stack, 'ConnectionService', {
        engine: createDatabaseDto.engine,
        testQuery: testQuery,
        sqlMessage: e.sqlMessage,
        errorMessage: e.message,
      });
      returnObj = { status: ResponseStatus.ERROR, message: e.sqlMessage };
    } finally {
      await _knex.destroy();
    }

    return returnObj;
  }

  /**
   * 쿼리 실행
   * @param queryExecuteDto
   * @param userId 사용자 ID (보안 로깅용)
   */
  async executeQuery(queryExecuteDto: QueryExecuteDto, userId?: string) {
    // 1. SQL 보안 검증
    const validationResult = this.sqlValidationService.validateQuery(
      queryExecuteDto.query,
      {
        allowDDL: false,
        allowDML: false,
        allowMultipleStatements: false,
        maxQueryLength: 10000,
        maxResultLimit: queryExecuteDto.limit || 1000,
      },
      userId,
    );

    if (!validationResult.isValid) {
      const errorMessage = this.sqlValidationService.formatValidationError(validationResult);
      this.logger.warn('SQL validation failed', 'ConnectionService', {
        userId,
        query: queryExecuteDto.query.substring(0, 200),
        errors: validationResult.errors,
        warnings: validationResult.warnings,
        riskLevel: validationResult.riskLevel,
      });

      throw new ForbiddenException(`SQL validation failed: ${errorMessage}`);
    }

    // 2. 보안 감사 로그
    this.logger.info('SQL query execution approved', 'ConnectionService', {
      userId,
      databaseId: queryExecuteDto.id,
      queryLength: queryExecuteDto.query.length,
      riskLevel: validationResult.riskLevel,
      warningsCount: validationResult.warnings.length,
    });

    const knex = await this.getKnex(queryExecuteDto.id);

    let datas = [];
    const fields = [];
    const resultObj = { status: null, message: null, datas: [], fields: [] };
    const startTime = Date.now();
    
    try {
      // 3. 정리된 쿼리 사용 (LIMIT 자동 추가 등)
      const sanitizedQuery = validationResult.sanitizedQuery;

      // 4. 쿼리 실행 계획 분석 (비동기로 처리하여 성능 영향 최소화)
      this.analyzeQueryAsync(sanitizedQuery, queryExecuteDto.id);

      // 5. 매개변수가 있는 경우 파라미터화된 쿼리 실행
      let queryRes;
      if (queryExecuteDto.parameters && queryExecuteDto.parameters.length > 0) {
        const paramValues = queryExecuteDto.parameters.map(param => {
          // 타입에 따른 변환
          switch (param.type) {
            case 'number':
              return Number(param.value);
            case 'date':
              return new Date(param.value);
            default:
              return param.value;
          }
        });
        queryRes = await knex.raw(sanitizedQuery, paramValues);
      } else {
        queryRes = await knex.raw(sanitizedQuery);
      }
      // bigquery, snowflake
      if (typeof knex.client.config.client === 'function') {
        switch (knex.client.config.client.name) {
          case 'SnowflakeDialect':
            if (queryRes && queryRes.rows && queryRes.rows.length > 0) {
              datas = queryRes.rows;
              const tempFields = Object.keys(queryRes.rows[0]);
              tempFields.map(field => {
                const length = [];
                const maxCnt = queryRes.rows.length > 100 ? 100 : queryRes.rows.length;
                for (let i = 0; i < maxCnt; i++) {
                  length.push(queryRes.rows[i][field]);
                }
                const fieldInfo = {
                  columnName: field,
                  columnType: FieldTypeUtil.FieldType(length),
                };
                fields.push(fieldInfo);
              });
            }
            break;
          case 'BigQueryClient':
            if (queryRes && queryRes.length > 0) {
              datas = queryRes;
              const tempFields = Object.keys(queryRes[0]);

              tempFields.map(field => {
                const length = [];
                const maxCnt = queryRes.length > 100 ? 100 : queryRes.length;
                for (let i = 0; i < maxCnt; i++) {
                  length.push(queryRes[i][field]);
                }
                const fieldInfo = {
                  columnName: field,
                  columnType: FieldTypeUtil.FieldType(length),
                };
                fields.push(fieldInfo);
              });
            }
            break;
        }
      } else {
        switch (knex.client.config.client) {
          case 'mysql2':
            if (queryRes && queryRes[0].length > 0) {
              datas = queryRes[0];
              const tempFields = queryRes[1];
              tempFields.map(field => {
                const fieldInfo = {
                  columnName: field.name,
                  columnType: FieldTypeUtil.mysqlFieldType(field.columnType),
                };
                fields.push(fieldInfo);
              });
            }
            break;

          case 'cockroachdb':
          case 'pg':
            if (queryRes && queryRes.rows && queryRes.rows.length > 0) {
              datas = queryRes.rows;
              const tempFields = queryRes.fields;
              tempFields.map(field => {
                const length = [];
                const maxCnt = queryRes.rows.length > 100 ? 100 : queryRes.rows.length;
                for (let i = 0; i < maxCnt; i++) {
                  length.push(queryRes.rows[i][field.name]);
                }
                const fieldInfo = {
                  columnName: field.name,
                  columnType: FieldTypeUtil.FieldType(length),
                };
                fields.push(fieldInfo);
              });
            }
            break;

          // case 'sqlite3':
          // case 'mssql':
          // case 'oracledb':
          default:
            if (queryRes && queryRes.length > 0) {
              datas = queryRes;
              const tempFields = Object.keys(queryRes[0]);

              tempFields.map(field => {
                const length = [];
                const maxCnt = queryRes.length > 100 ? 100 : queryRes.length;
                for (let i = 0; i < maxCnt; i++) {
                  length.push(queryRes[i][field]);
                }
                const fieldInfo = {
                  columnName: field,
                  columnType: FieldTypeUtil.FieldType(length),
                };
                fields.push(fieldInfo);
              });
            }
            break;
        }
      }

      resultObj.status = ResponseStatus.SUCCESS;
      resultObj.message = 'success';
      resultObj.datas = datas;
      resultObj.fields = fields;
      
      // 실행 시간 측정 및 쿼리 수집
      const executionTime = Date.now() - startTime;
      this.queryCollector.collect(
        sanitizedQuery,
        `database-${queryExecuteDto.id}`,
        queryExecuteDto.parameters?.map(p => p.value),
        executionTime,
      );
      
      // 슬로우 쿼리 모니터링
      await this.recordSlowQueryMetrics(
        sanitizedQuery,
        executionTime,
        queryExecuteDto,
        userId,
        datas.length,
      );
    } catch (e) {
      const executionTime = Date.now() - startTime;
      resultObj.status = ResponseStatus.ERROR;
      if (e.sqlMessage) resultObj.message = e.sqlMessage;
      else if (e.message) resultObj.message = e.message; // bigquery

      this.logger.error('Query execution failed', e.stack, 'ConnectionService', {
        databaseId: queryExecuteDto.id,
        query: queryExecuteDto.query?.substring(0, 200) + '...', // 긴 쿼리는 일부만 로깅
        sqlMessage: e.sqlMessage,
        errorMessage: e.message,
        executionTime,
      });
      
      // 실패한 쿼리도 수집
      this.queryCollector.collect(
        queryExecuteDto.query,
        `database-${queryExecuteDto.id}-error`,
        queryExecuteDto.parameters?.map(p => p.value),
        executionTime,
      );
    }

    return resultObj;
  }

  /**
   * 슬로우 쿼리 메트릭 기록
   */
  private async recordSlowQueryMetrics(
    query: string,
    executionTime: number,
    queryExecuteDto: QueryExecuteDto,
    userId?: string,
    rowCount?: number,
  ): Promise<void> {
    try {
      // 슬로우 쿼리 임계값 확인 (1초 이상)
      if (executionTime >= 1000) {
        // 쿼리 분석 실행
        const analysis = await this.queryAnalyzerService.analyzeQuery(query, queryExecuteDto.id);
        analysis.executionTime = executionTime;
        analysis.rowsReturned = rowCount;

        // 데이터베이스 정보 조회
        const database = await this.databaseRepository.findOne({ 
          where: { id: queryExecuteDto.id } 
        });

        // 요청 메타데이터 추출
        const metadata = this.extractRequestMetadata(userId);

        // 슬로우 쿼리 로깅
        await this.slowQueryMonitorService.logSlowQuery(analysis, {
          databaseId: queryExecuteDto.id,
          databaseEngine: database?.engine,
          userId,
          requestPath: metadata.requestPath,
          httpMethod: metadata.httpMethod,
          clientIp: metadata.clientIp,
          userAgent: metadata.userAgent,
          requestId: metadata.requestId,
          parameters: queryExecuteDto.parameters?.map(p => p.value),
        });

        // 기존 로깅도 유지
        this.logger.warn('Slow query detected', 'ConnectionService', {
          databaseId: queryExecuteDto.id,
          executionTime,
          query: query.substring(0, 200),
          rowCount,
          userId,
          requestId: metadata.requestId,
        });
      }
    } catch (error) {
      this.logger.error('Failed to record slow query metrics', error.stack, 'ConnectionService', {
        databaseId: queryExecuteDto.id,
        executionTime,
        error: error.message,
      });
    }
  }

  /**
   * 요청 메타데이터 추출
   */
  private extractRequestMetadata(userId?: string) {
    const userAgent = this.request?.get?.('User-Agent') || '';
    const clientIp = this.getClientIp();
    const requestId = this.request?.get?.('X-Request-ID') || this.generateRequestId();

    return {
      userId,
      requestPath: this.request?.path || '/api/unknown',
      httpMethod: this.request?.method || 'UNKNOWN',
      clientIp,
      userAgent: userAgent.substring(0, 500), // 길이 제한
      requestId,
    };
  }

  /**
   * 클라이언트 IP 추출
   */
  private getClientIp(): string {
    if (!this.request) return 'unknown';
    
    return (
      this.request.get?.('X-Forwarded-For')?.split(',')[0] ||
      this.request.get?.('X-Real-IP') ||
      this.request.socket?.remoteAddress ||
      'unknown'
    );
  }

  /**
   * 요청 ID 생성
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * 비동기 쿼리 분석
   */
  private async analyzeQueryAsync(query: string, databaseId: number): Promise<void> {
    try {
      // 비동기로 쿼리 분석 실행 (응답 지연 방지)
      setImmediate(async () => {
        try {
          const analysis = await this.queryAnalyzerService.analyzeQuery(query, databaseId);
          
          if (analysis.optimizationSuggestions && analysis.optimizationSuggestions.length > 0) {
            this.logger.info('Query optimization opportunities found', 'ConnectionService', {
              databaseId,
              query: query.substring(0, 100),
              suggestions: analysis.optimizationSuggestions,
              scanType: analysis.scanType,
              indexUsed: analysis.indexUsed,
            });
          }
        } catch (error) {
          this.logger.debug(`Query analysis failed: ${error.message}`, 'ConnectionService');
        }
      });
    } catch (error) {
      // 분석 실패는 무시 (메인 쿼리 실행에 영향 없음)
      this.logger.debug(`Failed to initiate query analysis: ${error.message}`, 'ConnectionService');
    }
  }
}
