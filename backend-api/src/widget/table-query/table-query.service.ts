import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TableQuery } from './entity/table-query.entity';
import { Database } from '../../database/entities/database.entity';
import { SqlValidationService } from '../../common/security/sql-validation.service';

@Injectable()
export class TableQueryService {
  constructor(
    @InjectRepository(TableQuery)
    private tableQueryRepository: Repository<TableQuery>,
    @InjectRepository(Database)
    private databaseRepository: Repository<Database>,
    private readonly sqlValidationService: SqlValidationService,
  ) {}

  /**
   * tableQuery 생성
   * @param databaseId
   * @param tableName
   */
  async create(databaseId: number, tableName: string) {
    const selectQuery = await this.makeSelectAllQuery(databaseId, tableName);

    return await this.tableQueryRepository.save({
      databaseId,
      query: selectQuery,
    });
  }

  async makeSelectAllQuery(databaseId: number, tableName: string) {
    // 1. 테이블명 보안 검증
    if (!this.isValidTableName(tableName)) {
      throw new BadRequestException(
        `Invalid table name: ${tableName}. Table names must contain only letters, numbers, and underscores.`,
      );
    }

    const databaseOne = await this.databaseRepository.findOne({ where: { id: databaseId } });
    if (!databaseOne) {
      throw new BadRequestException(`Database with id ${databaseId} not found`);
    }

    let selectQuery;
    let schemaName;

    try {
      switch (databaseOne.type) {
        case 'bigquery':
          const connectionConfig = JSON.parse(databaseOne.connectionConfig);
          schemaName = connectionConfig.connection?.schema;

          if (!schemaName || !this.isValidSchemaName(schemaName)) {
            throw new BadRequestException(`Invalid schema name: ${schemaName}`);
          }

          // 안전한 식별자 래핑 - BigQuery는 백틱 사용
          selectQuery = `SELECT * FROM \`${this.sanitizeIdentifier(
            schemaName,
          )}\`.\`${this.sanitizeIdentifier(tableName)}\``;
          break;

        case 'oracle':
          // Oracle은 더블 쿼트 사용
          selectQuery = `SELECT * FROM "${this.sanitizeIdentifier(tableName)}"`;
          break;

        case 'postgresql':
        case 'postgres':
          // PostgreSQL도 더블 쿼트 사용
          selectQuery = `SELECT * FROM "${this.sanitizeIdentifier(tableName)}"`;
          break;

        case 'mysql':
        case 'mariadb':
          // MySQL/MariaDB는 백틱 사용
          selectQuery = `SELECT * FROM \`${this.sanitizeIdentifier(tableName)}\``;
          break;

        case 'mssql':
        case 'sqlserver':
          // SQL Server는 대괄호 사용
          selectQuery = `SELECT * FROM [${this.sanitizeIdentifier(tableName)}]`;
          break;

        default:
          // 기본적으로 백틱 사용 (대부분의 DB에서 지원)
          selectQuery = `SELECT * FROM \`${this.sanitizeIdentifier(tableName)}\``;
          break;
      }

      // 2. 생성된 쿼리에 대한 최종 보안 검증
      const validationResult = this.sqlValidationService.validateQuery(selectQuery, {
        allowDDL: false,
        allowDML: false,
        allowMultipleStatements: false,
        maxQueryLength: 1000,
        maxResultLimit: 10000,
      });

      if (!validationResult.isValid) {
        throw new BadRequestException(
          `Generated query failed security validation: ${validationResult.errors.join(', ')}`,
        );
      }

      return selectQuery;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Failed to create select query: ${error.message}`);
    }
  }

  /**
   * 테이블명 유효성 검사
   */
  private isValidTableName(tableName: string): boolean {
    if (!tableName || typeof tableName !== 'string') {
      return false;
    }

    // 테이블명은 영문자로 시작하고, 영문자, 숫자, 언더스코어만 허용
    const tableNameRegex = /^[a-zA-Z][a-zA-Z0-9_]*$/;
    if (!tableNameRegex.test(tableName)) {
      return false;
    }

    // 길이 제한 (최대 64자)
    if (tableName.length > 64) {
      return false;
    }

    // SQL 키워드와 겹치는 이름 금지
    const sqlKeywords = [
      'SELECT',
      'FROM',
      'WHERE',
      'ORDER',
      'GROUP',
      'HAVING',
      'UNION',
      'JOIN',
      'INNER',
      'LEFT',
      'RIGHT',
      'FULL',
      'CROSS',
      'INSERT',
      'UPDATE',
      'DELETE',
      'CREATE',
      'DROP',
      'ALTER',
      'TABLE',
      'INDEX',
      'VIEW',
      'DATABASE',
      'SCHEMA',
    ];

    if (sqlKeywords.includes(tableName.toUpperCase())) {
      return false;
    }

    return true;
  }

  /**
   * 스키마명 유효성 검사
   */
  private isValidSchemaName(schemaName: string): boolean {
    if (!schemaName || typeof schemaName !== 'string') {
      return false;
    }

    // 스키마명도 테이블명과 같은 규칙 적용
    return this.isValidTableName(schemaName);
  }

  /**
   * 식별자 정리 (SQL 인젝션 방지)
   */
  private sanitizeIdentifier(identifier: string): string {
    if (!identifier || typeof identifier !== 'string') {
      throw new BadRequestException('Invalid identifier');
    }

    // 식별자에서 위험한 문자 제거
    const sanitized = identifier.replace(/[^a-zA-Z0-9_]/g, '');

    if (sanitized !== identifier) {
      throw new BadRequestException(`Identifier contains invalid characters: ${identifier}`);
    }

    return sanitized;
  }

  /**
   * tableQuery 삭제
   * @param id
   */
  async remove(id: number) {
    const tableQuery = await this.tableQueryRepository.findOne({ where: { id: id } });
    if (!tableQuery) {
      return 'No exist';
    } else {
      await this.tableQueryRepository.delete(tableQuery.id);
    }

    return `This action removes a #${id} widgetView`;
  }
}
