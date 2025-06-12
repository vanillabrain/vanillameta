import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
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

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { BigQueryClient } = require('knex-bigquery');

const knexConnections = new Map<number, Knex>();

@Injectable()
export class ConnectionService {
  constructor(
    @InjectRepository(Database) private databaseRepository: Repository<Database>,
    private readonly logger: CustomLoggerService,
    private readonly sqlValidationService: SqlValidationService,
  ) {}

  /**
   * Knex 객체 생성 후 pool에 추가
   * @param id
   * @param options
   */
  addKnex(id: number, options: Knex.Config) {
    if (!this.hasKnex(id)) {
      knexConnections.set(id, knex(options));
    }
  }

  /**
   * Knex 객체 pool에서 삭제
   * @param id
   */
  removeKnex(id: number) {
    knexConnections.delete(id);
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
      this.addKnex(id, one.connectionConfig as Knex.Config);
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

    const connectionConfig = {
      client: engine,
      connection: createDatabaseDto.connectionConfig,
      useNullAsDefault: true,
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
    try {
      // 3. 정리된 쿼리 사용 (LIMIT 자동 추가 등)
      const sanitizedQuery = validationResult.sanitizedQuery;

      // 4. 매개변수가 있는 경우 파라미터화된 쿼리 실행
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
    } catch (e) {
      resultObj.status = ResponseStatus.ERROR;
      if (e.sqlMessage) resultObj.message = e.sqlMessage;
      else if (e.message) resultObj.message = e.message; // bigquery

      this.logger.error('Query execution failed', e.stack, 'ConnectionService', {
        databaseId: queryExecuteDto.id,
        query: queryExecuteDto.query?.substring(0, 200) + '...', // 긴 쿼리는 일부만 로깅
        sqlMessage: e.sqlMessage,
        errorMessage: e.message,
      });
    }

    return resultObj;
  }
}
