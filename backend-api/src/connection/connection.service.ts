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
import { DatabaseOptimizerFactory } from './database-optimizers/database-optimizer-factory';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { Transform, Readable, PassThrough } from 'stream';
import { getDatabaseSpecificConfig } from './database-specific.config';
import { KnexQueryMonitor } from '../common/monitoring/knex-query-monitor';

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
    private readonly databaseOptimizerFactory: DatabaseOptimizerFactory,
    private readonly knexQueryMonitor: KnexQueryMonitor,
    @Inject(REQUEST) private readonly request: Request,
  ) {}

  /**
   * Knex 객체 생성 후 pool에 추가
   * @param id - 데이터베이스 ID
   * @param options - Knex 설정 옵션
   */
  addKnex(id: number, options: Knex.Config) {
    if (!this.hasKnex(id)) {
      const environment = process.env.NODE_ENV || 'dev';
      const databaseType = typeof options.client === 'string' ? options.client : 'unknown';

      // 데이터베이스별 특화 설정 적용
      const dbSpecificConfig = getDatabaseSpecificConfig(databaseType);
      const optimizer = this.databaseOptimizerFactory.getOptimizer(databaseType);

      // 기본 최적화된 설정 + DB별 특화 설정 결합
      let optimizedOptions: Knex.Config = {
        ...options,
        pool: {
          min: 0, // Lambda에서는 0으로 시작
          max: parseInt(process.env.KNEX_POOL_MAX) || 3, // 기본값
          createTimeoutMillis: 30000,
          acquireTimeoutMillis: 30000,
          idleTimeoutMillis: 30000,
          reapIntervalMillis: 1000,
          createRetryIntervalMillis: 100,
          propagateCreateError: false,
        },
        acquireConnectionTimeout: 30000,
      };

      // DB별 특화 설정이 있으면 적용
      if (dbSpecificConfig) {
        optimizedOptions = {
          ...optimizedOptions,
          ...dbSpecificConfig.connectionConfig,
          // 연결 풀 설정 병합
          pool: {
            ...optimizedOptions.pool,
            ...dbSpecificConfig.connectionConfig.pool,
            // Lambda 환경에서는 최대 연결 수 제한
            max: Math.min(
              dbSpecificConfig.performanceSettings.maxConnections,
              parseInt(process.env.KNEX_POOL_MAX) || 3
            ),
          },
          // 연결 설정 병합
          connection: {
            ...((options.connection as any) || {}),
            ...((dbSpecificConfig.connectionConfig.connection as any) || {}),
          },
        };

        this.logger.info(
          'Applied database-specific optimizations',
          'ConnectionService',
          {
            databaseId: id,
            databaseType,
            batchSize: dbSpecificConfig.performanceSettings.batchSize,
            maxConnections: dbSpecificConfig.performanceSettings.maxConnections,
            features: dbSpecificConfig.features,
          },
        );
      }

      // 옵티마이저를 통한 추가 최적화
      if (optimizer) {
        optimizedOptions = optimizer.getOptimizedConnectionConfig(optimizedOptions);
        
        this.logger.info(
          'Applied optimizer-specific configurations',
          'ConnectionService',
          {
            databaseId: id,
            optimizerType: optimizer.getDatabaseType(),
          },
        );
      }

      this.logger.info(
        'Creating Knex connection with database-specific optimizations',
        'ConnectionService',
        {
          databaseId: id,
          databaseType,
          environment,
          client: options.client,
          optimized: this.databaseOptimizerFactory.isSupported(databaseType),
          poolSettings: optimizedOptions.pool,
          hasOptimizer: !!optimizer,
          hasDbSpecificConfig: !!dbSpecificConfig,
        },
      );

      const knexInstance = knex(optimizedOptions);
      knexConnections.set(id, knexInstance);

      // Knex 쿼리 모니터링 연결
      this.knexQueryMonitor.attachToKnex(knexInstance, id, databaseType);

      // 최적화 통계 로깅
      const stats = this.databaseOptimizerFactory.getOptimizationStats();
      this.logger.debug('Database optimization stats', 'ConnectionService', stats);
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
      try {
        (one as any).connectionConfig = JSON.parse(one.connectionConfig);
      } catch (error) {
        (one as any).connectionConfig = {};
      }
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

    // Parse connectionConfig if it's a string
    let parsedConnectionConfig: any = createDatabaseDto.connectionConfig;
    if (typeof parsedConnectionConfig === 'string') {
      try {
        parsedConnectionConfig = JSON.parse(parsedConnectionConfig);
      } catch (error) {
        parsedConnectionConfig = {};
      }
    }

    if (createDatabaseDto.engine === 'cockroachdb') {
      // URL 인코딩을 통한 보안 강화
      const user = encodeURIComponent(parsedConnectionConfig['user'] || '');
      const password = encodeURIComponent(parsedConnectionConfig['password'] || '');
      const host = encodeURIComponent(parsedConnectionConfig['host'] || 'localhost');
      const port = parsedConnectionConfig['port'] || 26257;
      const database = encodeURIComponent(parsedConnectionConfig['database'] || 'defaultdb');
      
      const cockroach_url = `postgresql://${user}:${password}@${host}:${port}/${database}?sslmode=verify-full&options=--cluster%3Dvanillameta-cockroach-3010`;
      parsedConnectionConfig['connectionString'] = cockroach_url;
    }

    // 데이터베이스별 최적화된 연결 설정 적용
    const environment = process.env.NODE_ENV || 'dev';
    const optimizedConfig = this.databaseOptimizerFactory.getOptimizedConnectionConfig(
      createDatabaseDto.engine,
      parsedConnectionConfig,
      environment,
    );

    const connectionConfig: Knex.Config = {
      client: engine,
      connection: parsedConnectionConfig,
      useNullAsDefault: true,
      // 테스트 연결을 위한 최소한의 풀 설정 (최적화된 설정 기반)
      pool: {
        ...optimizedConfig.pool,
        min: 0,
        max: 1, // 테스트용이므로 1개만
        createTimeoutMillis: 10000, // 10초 - 테스트용이므로 짧게
        acquireTimeoutMillis: 10000,
        idleTimeoutMillis: 0, // 즉시 정리
        reapIntervalMillis: 500,
      },
      acquireConnectionTimeout: 10000,
      // 다른 최적화 설정들 적용 (타임아웃 제외)
      debug: optimizedConfig.debug,
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
      // 보안: SQL 에러 메시지를 일반화하여 DB 구조 정보 노출 방지
      let safeErrorMessage = '데이터베이스 연결 테스트에 실패했습니다.';
      
      // 일반적인 연결 오류에 대해서만 구체적인 메시지 제공
      if (e.message?.includes('ECONNREFUSED')) {
        safeErrorMessage = '데이터베이스 서버에 연결할 수 없습니다.';
      } else if (e.message?.includes('ETIMEDOUT')) {
        safeErrorMessage = '연결 시간이 초과되었습니다.';
      } else if (e.message?.includes('Access denied') || e.message?.includes('authentication')) {
        safeErrorMessage = '인증에 실패했습니다. 사용자명과 비밀번호를 확인해주세요.';
      } else if (e.message?.includes('Unknown database')) {
        safeErrorMessage = '데이터베이스를 찾을 수 없습니다.';
      }
      
      returnObj = { status: ResponseStatus.ERROR, message: safeErrorMessage };
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

    // 데이터베이스별 최적화 적용
    const databaseType = knex.client.config.client;
    const optimizer = this.databaseOptimizerFactory.getOptimizer(databaseType);
    const dbSpecificConfig = getDatabaseSpecificConfig(databaseType);

    let datas = [];
    const fields = [];
    const resultObj = { status: null, message: null, datas: [], fields: [] };
    const startTime = Date.now();

    try {
      // 3. 정리된 쿼리 사용 (LIMIT 자동 추가 등)
      let sanitizedQuery = validationResult.sanitizedQuery;

      // 4. DB별 쿼리 최적화 적용
      if (optimizer) {
        try {
          // Raw 쿼리를 QueryBuilder로 변환하여 최적화 적용
          const queryBuilder = knex.queryBuilder().select(knex.raw(sanitizedQuery));
          const optimizedQueryBuilder = optimizer.optimizeQuery(queryBuilder);
          sanitizedQuery = optimizedQueryBuilder.toString();

          this.logger.debug('Applied database-specific query optimization', 'ConnectionService', {
            databaseId: queryExecuteDto.id,
            databaseType: optimizer.getDatabaseType(),
            originalQuery: validationResult.sanitizedQuery.substring(0, 100),
            optimizedQuery: sanitizedQuery.substring(0, 100),
          });
        } catch (optimizationError) {
          // 최적화 실패 시 원본 쿼리 사용
          this.logger.warn('Query optimization failed, using original query', 'ConnectionService', {
            databaseId: queryExecuteDto.id,
            error: optimizationError.message,
          });
          sanitizedQuery = validationResult.sanitizedQuery;
        }
      }

      // 5. 쿼리 실행 계획 분석 (비동기로 처리하여 성능 영향 최소화)
      this.analyzeQueryAsync(sanitizedQuery, queryExecuteDto.id);

      // 5. 매개변수가 있는 경우 파라미터화된 쿼리 실행
      let queryRes;
      if (queryExecuteDto.parameters && queryExecuteDto.parameters.length > 0) {
        const paramValues = queryExecuteDto.parameters.map(param => {
          // 타입에 따른 변환 및 유효성 검사
          switch (param.type) {
            case 'number':
              const numValue = Number(param.value);
              if (isNaN(numValue)) {
                throw new BadRequestException(`잘못된 숫자 형식: ${param.name}`);
              }
              // 숫자 범위 검증 (SQL 인젝션 방지)
              if (Math.abs(numValue) > Number.MAX_SAFE_INTEGER) {
                throw new BadRequestException(`숫자 범위 초과: ${param.name}`);
              }
              return numValue;
              
            case 'date':
              const dateValue = new Date(param.value);
              if (isNaN(dateValue.getTime())) {
                throw new BadRequestException(`잘못된 날짜 형식: ${param.name}`);
              }
              // 날짜 범위 검증 (1900-2100)
              const year = dateValue.getFullYear();
              if (year < 1900 || year > 2100) {
                throw new BadRequestException(`날짜 범위 초과: ${param.name}`);
              }
              return dateValue;
              
            case 'boolean':
              return String(param.value) === 'true';
              
            default:
              // 문자열 길이 제한 (SQL 인젝션 방지)
              if (typeof param.value === 'string' && param.value.length > 1000) {
                throw new BadRequestException(`문자열 길이 초과: ${param.name}`);
              }
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

      // 타임아웃 에러 감지 및 사용자 친화적 메시지 제공
      const timeoutMessage = this.detectTimeoutError(e, executionTime);
      if (timeoutMessage) {
        resultObj.message = timeoutMessage;
      } else {
        // 보안: SQL 에러 메시지를 일반화하여 DB 구조 정보 노출 방지
        const errorMsg = e.sqlMessage || e.message || '';
        
        // 일반적인 SQL 오류를 사용자 친화적 메시지로 변환
        if (errorMsg.includes('syntax error') || errorMsg.includes('Syntax error')) {
          resultObj.message = '쿼리 구문에 오류가 있습니다.';
        } else if (errorMsg.includes('does not exist') || errorMsg.includes('doesn\'t exist')) {
          resultObj.message = '요청한 리소스를 찾을 수 없습니다.';
        } else if (errorMsg.includes('permission denied') || errorMsg.includes('Access denied')) {
          resultObj.message = '권한이 없습니다.';
        } else if (errorMsg.includes('duplicate key') || errorMsg.includes('Duplicate entry')) {
          resultObj.message = '중복된 데이터가 존재합니다.';
        } else if (errorMsg.includes('foreign key') || errorMsg.includes('Cannot delete')) {
          resultObj.message = '참조 무결성 제약으로 인해 작업을 수행할 수 없습니다.';
        } else if (errorMsg.includes('connection') || errorMsg.includes('Can\'t connect')) {
          resultObj.message = '데이터베이스 연결에 실패했습니다.';
        } else {
          // 기타 모든 SQL 에러는 일반적인 메시지로 대체
          resultObj.message = '쿼리 실행 중 오류가 발생했습니다.';
        }
      }

      this.logger.error('Query execution failed', e.stack, 'ConnectionService', {
        databaseId: queryExecuteDto.id,
        query: queryExecuteDto.query?.substring(0, 200) + '...', // 긴 쿼리는 일부만 로깅
        sqlMessage: e.sqlMessage,
        errorMessage: e.message,
        executionTime,
        isTimeout: !!timeoutMessage,
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
          where: { id: queryExecuteDto.id },
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
   * 타임아웃 에러 감지 및 사용자 친화적 메시지 반환
   * @param error - 발생한 에러 객체
   * @param executionTime - 실행 시간 (ms)
   * @returns 타임아웃 관련 메시지 또는 null
   */
  private detectTimeoutError(error: any, executionTime: number): string | null {
    const errorMessage = error.message?.toLowerCase() || '';
    const sqlMessage = error.sqlMessage?.toLowerCase() || '';
    const errorCode = error.code || error.errno || '';

    // 실행 시간 기반 타임아웃 감지 (25초 이상)
    const isLongRunning = executionTime >= 25000;

    // MySQL/MariaDB 타임아웃 에러
    if (
      errorCode === 'ER_QUERY_TIMEOUT' ||
      errorMessage.includes('query timeout') ||
      errorMessage.includes('max_execution_time') ||
      sqlMessage.includes('query execution was interrupted')
    ) {
      return '쿼리 실행 시간이 25초를 초과하여 중단되었습니다. 쿼리를 최적화하거나 필터 조건을 추가해 주세요.';
    }

    // PostgreSQL 타임아웃 에러
    if (
      errorMessage.includes('statement timeout') ||
      errorMessage.includes('canceling statement due to statement timeout') ||
      errorCode === '57014'
    ) {
      return '쿼리 실행 시간이 허용된 시간을 초과했습니다. 더 구체적인 조건으로 데이터를 필터링해 주세요.';
    }

    // Oracle 타임아웃 에러
    if (
      errorCode === 'ORA-01013' ||
      errorMessage.includes('user requested cancel') ||
      errorMessage.includes('ora-01013')
    ) {
      return '쿼리 실행이 시간 초과로 인해 취소되었습니다. 쿼리 조건을 더 구체적으로 설정해 주세요.';
    }

    // SQL Server 타임아웃 에러
    if (
      errorCode === 'EREQUEST' ||
      errorMessage.includes('timeout') ||
      errorMessage.includes('execution timeout expired') ||
      sqlMessage.includes('timeout period elapsed')
    ) {
      return '쿼리 실행 시간이 초과되었습니다. 검색 범위를 줄이거나 인덱스가 있는 컬럼으로 필터링해 주세요.';
    }

    // BigQuery 타임아웃 에러
    if (
      errorMessage.includes('timeout') ||
      errorMessage.includes('job exceeded rate limits') ||
      errorMessage.includes('query exceeded resource limits')
    ) {
      return 'BigQuery 쿼리 실행 시간이 초과되었습니다. 더 작은 데이터 범위로 쿼리를 실행해 주세요.';
    }

    // Snowflake 타임아웃 에러
    if (
      errorMessage.includes('statement reached its timeout') ||
      errorMessage.includes('query timeout') ||
      errorCode === '604'
    ) {
      return 'Snowflake 쿼리 실행 시간이 초과되었습니다. 더 효율적인 쿼리로 수정하거나 데이터 범위를 줄여주세요.';
    }

    // 연결 타임아웃 에러
    if (
      errorMessage.includes('connection timeout') ||
      errorMessage.includes('connect timeout') ||
      errorCode === 'ETIMEDOUT' ||
      errorCode === 'ECONNRESET'
    ) {
      return '데이터베이스 연결 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.';
    }

    // 일반적인 타임아웃 키워드 기반 감지
    if ((errorMessage.includes('timeout') || sqlMessage.includes('timeout')) && isLongRunning) {
      return '쿼리 실행 시간이 허용 시간을 초과했습니다. 쿼리를 단순화하거나 데이터 범위를 제한해 주세요.';
    }

    // Lambda 함수 타임아웃 근처 (28초 이상)
    if (executionTime >= 28000) {
      return '쿼리 실행 시간이 시스템 한계에 근접했습니다. 더 구체적인 조건으로 데이터를 필터링해 주세요.';
    }

    return null;
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

  /**
   * 스트리밍 쿼리 실행
   * @param queryExecuteDto 쿼리 실행 DTO
   * @param userId 사용자 ID (보안 로깅용)
   * @param chunkSize 청크 크기 (기본값: 1000)
   * @returns 스트림 객체와 메타데이터
   */
  async executeStreamingQuery(
    queryExecuteDto: QueryExecuteDto,
    userId?: string,
    chunkSize = 1000,
  ): Promise<{
    stream: Readable;
    fields?: any[];
    error?: string;
  }> {
    // 1. SQL 보안 검증
    const validationResult = this.sqlValidationService.validateQuery(
      queryExecuteDto.query,
      {
        allowDDL: false,
        allowDML: false,
        allowMultipleStatements: false,
        maxQueryLength: 10000,
        // 스트리밍에서는 LIMIT 제한 없음
      },
      userId,
    );

    if (!validationResult.isValid) {
      const errorMessage = this.sqlValidationService.formatValidationError(validationResult);
      this.logger.warn('SQL validation failed for streaming query', 'ConnectionService', {
        userId,
        query: queryExecuteDto.query.substring(0, 200),
        errors: validationResult.errors,
        warnings: validationResult.warnings,
        riskLevel: validationResult.riskLevel,
      });

      throw new ForbiddenException(`SQL validation failed: ${errorMessage}`);
    }

    // 2. 보안 감사 로그
    this.logger.info('Streaming SQL query execution approved', 'ConnectionService', {
      userId,
      databaseId: queryExecuteDto.id,
      queryLength: queryExecuteDto.query.length,
      riskLevel: validationResult.riskLevel,
      chunkSize,
    });

    const knexInstance = await this.getKnex(queryExecuteDto.id);
    const startTime = Date.now();

    // PassThrough 스트림 생성 (Transform 스트림의 한 종류)
    const outputStream = new PassThrough({
      objectMode: false, // NDJSON 포맷을 위해 string mode 사용
    });

    // 필드 정보를 저장할 변수
    let fields = [];
    let firstChunk = true;
    let rowCount = 0;
    let errorOccurred = false;

    try {
      const sanitizedQuery = validationResult.sanitizedQuery || queryExecuteDto.query;

      // 쿼리 실행 계획 분석 (비동기)
      this.analyzeQueryAsync(sanitizedQuery, queryExecuteDto.id);

      // 데이터베이스 타입 확인
      const clientType =
        typeof knexInstance.client.config.client === 'function'
          ? knexInstance.client.config.client.name
          : knexInstance.client.config.client;

      // 데이터베이스별 스트림 설정 최적화
      const streamOptions = this.getStreamOptionsForDatabase(clientType);

      // Knex 스트림 생성
      const queryStream = knexInstance
        .raw(sanitizedQuery)
        .stream(streamOptions) as unknown as NodeJS.ReadableStream;

      // 데이터베이스별 스트림 처리를 위한 Transform 스트림
      const transformStream = new Transform({
        objectMode: true,
        transform: (chunk, encoding, callback) => {
          try {
            // 데이터베이스별 청크 처리
            const processedChunk = this.processChunkByDatabase(chunk, clientType);

            if (!processedChunk) {
              callback();
              return;
            }

            rowCount++;

            // 첫 번째 청크에서 필드 정보 추출
            if (firstChunk && processedChunk) {
              firstChunk = false;

              fields = this.extractFieldsFromChunk(processedChunk, clientType);

              // 필드 정보를 첫 번째 라인으로 전송
              outputStream.push(JSON.stringify({ type: 'fields', data: fields }) + '\n');
            }

            // 데이터 행을 NDJSON 형식으로 변환
            outputStream.push(JSON.stringify({ type: 'data', data: processedChunk }) + '\n');

            // 진행상황 로깅 (매 10000행마다)
            if (rowCount % 10000 === 0) {
              this.logger.info('Streaming query progress', 'ConnectionService', {
                databaseId: queryExecuteDto.id,
                rowsProcessed: rowCount,
                elapsedTime: Date.now() - startTime,
                databaseType: clientType,
              });
            }

            callback();
          } catch (error) {
            callback(error);
          }
        },
      });

      // 스트림 파이프라인 설정
      queryStream
        .pipe(transformStream)
        .on('error', error => {
          errorOccurred = true;
          this.logger.error('Stream transformation error', error.stack, 'ConnectionService', {
            databaseId: queryExecuteDto.id,
            rowsProcessed: rowCount,
            error: error.message,
          });

          // 에러 정보를 스트림에 전송
          outputStream.push(
            JSON.stringify({
              type: 'error',
              error: error.message || 'Stream transformation error',
            }) + '\n',
          );
          outputStream.end();
        })
        .on('end', async () => {
          if (!errorOccurred) {
            const executionTime = Date.now() - startTime;

            // 완료 정보 전송
            outputStream.push(
              JSON.stringify({
                type: 'complete',
                rowCount,
                executionTime,
              }) + '\n',
            );

            // 스트림 종료
            outputStream.end();

            // 쿼리 수집 및 슬로우 쿼리 모니터링
            this.queryCollector.collect(
              sanitizedQuery,
              `database-${queryExecuteDto.id}-stream`,
              queryExecuteDto.parameters?.map(p => p.value),
              executionTime,
            );

            await this.recordSlowQueryMetrics(
              sanitizedQuery,
              executionTime,
              queryExecuteDto,
              userId,
              rowCount,
            );

            this.logger.info('Streaming query completed', 'ConnectionService', {
              databaseId: queryExecuteDto.id,
              rowCount,
              executionTime,
              throughput: Math.round((rowCount / executionTime) * 1000) + ' rows/sec',
            });
          }
        });

      // 쿼리 스트림 에러 처리
      queryStream.on('error', error => {
        errorOccurred = true;
        const executionTime = Date.now() - startTime;

        // 타임아웃 에러 감지
        const timeoutMessage = this.detectTimeoutError(error, executionTime);
        const errorMessage =
          timeoutMessage || error.sqlMessage || error.message || 'Query execution error';

        this.logger.error('Query stream error', error.stack, 'ConnectionService', {
          databaseId: queryExecuteDto.id,
          error: error.message,
          sqlMessage: error.sqlMessage,
          executionTime,
          isTimeout: !!timeoutMessage,
        });

        outputStream.push(
          JSON.stringify({
            type: 'error',
            error: errorMessage,
          }) + '\n',
        );
        outputStream.end();
      });

      return {
        stream: outputStream,
        fields,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;

      // 타임아웃 에러 감지
      const timeoutMessage = this.detectTimeoutError(error, executionTime);
      const errorMessage =
        timeoutMessage || error.message || 'Failed to initialize streaming query';

      this.logger.error('Failed to initialize streaming query', error.stack, 'ConnectionService', {
        databaseId: queryExecuteDto.id,
        query: queryExecuteDto.query?.substring(0, 200),
        error: error.message,
        executionTime,
        isTimeout: !!timeoutMessage,
      });

      // 에러가 발생한 경우에도 스트림 반환 (에러 정보 포함)
      outputStream.push(
        JSON.stringify({
          type: 'error',
          error: errorMessage,
        }) + '\n',
      );
      outputStream.end();

      return {
        stream: outputStream,
        error: errorMessage,
      };
    }
  }

  /**
   * 첫 번째 데이터 청크에서 필드 정보 추출
   */
  private extractFieldsFromChunk(chunk: any, clientType: string): any[] {
    const fields = [];

    if (!chunk || typeof chunk !== 'object') {
      return fields;
    }

    // 객체의 키를 필드로 사용
    const fieldNames = Object.keys(chunk);

    fieldNames.forEach(fieldName => {
      fields.push({
        columnName: fieldName,
        columnType: FieldTypeUtil.FieldType([chunk[fieldName]]),
      });
    });

    return fields;
  }

  /**
   * 데이터베이스별 스트림 옵션 반환
   */
  private getStreamOptionsForDatabase(clientType: string): any {
    switch (clientType) {
      case 'mysql2':
        return {
          highWaterMark: 16 * 1024, // 16KB 청크
          objectMode: true,
        };

      case 'pg':
      case 'cockroachdb':
        return {
          highWaterMark: 64 * 1024, // 64KB 청크 (PostgreSQL은 더 큰 청크 처리 가능)
          objectMode: true,
        };

      case 'oracledb':
        return {
          highWaterMark: 32 * 1024, // 32KB 청크
          objectMode: true,
          fetchArraySize: 1000, // Oracle 특정 옵션
        };

      case 'sqlite3':
        return {
          highWaterMark: 8 * 1024, // 8KB 청크 (SQLite는 작은 청크가 효율적)
          objectMode: true,
        };

      case 'mssql':
        return {
          highWaterMark: 32 * 1024, // 32KB 청크
          objectMode: true,
        };

      case 'BigQueryClient':
      case 'SnowflakeDialect':
        return {
          highWaterMark: 128 * 1024, // 128KB 청크 (클라우드 DB는 큰 청크 가능)
          objectMode: true,
        };

      default:
        return {
          highWaterMark: 16 * 1024, // 기본값 16KB
          objectMode: true,
        };
    }
  }

  /**
   * 데이터베이스별 청크 처리
   */
  private processChunkByDatabase(chunk: any, clientType: string): any {
    // 데이터베이스별 특수 처리
    switch (clientType) {
      case 'mysql2':
      case 'pg':
      case 'cockroachdb':
        // PostgreSQL 계열은 chunk가 이미 row 객체
        return chunk;

      case 'oracledb':
        // Oracle은 배열 형태로 올 수 있음
        if (Array.isArray(chunk)) {
          // 첫 번째 row가 컬럼명일 수 있으므로 확인 필요
          return chunk;
        }
        return chunk;

      case 'BigQueryClient':
      case 'SnowflakeDialect':
        // 클라우드 DB들은 특수한 포맷을 가질 수 있음
        return chunk;

      default:
        return chunk;
    }
  }
}
