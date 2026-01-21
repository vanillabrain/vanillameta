import { Logger as TypeOrmLogger, QueryRunner } from 'typeorm';
import { Logger } from '@nestjs/common';
import { QueryCollector } from './query-collector';

export class TypeOrmQueryLogger implements TypeOrmLogger {
  private readonly logger = new Logger(TypeOrmQueryLogger.name);
  private queryCollector: QueryCollector;

  setQueryCollector(queryCollector: QueryCollector): void {
    this.queryCollector = queryCollector;
  }

  /**
   * 쿼리 로깅 (성공)
   */
  logQuery(query: string, parameters?: any[], queryRunner?: QueryRunner): void {
    const executionTime = queryRunner?.data?.executionTime;
    
    // 쿼리 수집
    if (this.queryCollector) {
      this.queryCollector.collect(
        query,
        'TypeORM',
        parameters,
        executionTime,
      );
    }

    // 개발 환경에서만 로깅
    if (process.env.NODE_ENV === 'development') {
      this.logger.debug({
        query: query.substring(0, 200),
        parameters,
        executionTime,
      });
    }
  }

  /**
   * 쿼리 에러 로깅
   */
  logQueryError(
    error: string | Error,
    query: string,
    parameters?: any[],
    queryRunner?: QueryRunner,
  ): void {
    const executionTime = queryRunner?.data?.executionTime;
    
    this.logger.error({
      message: 'Query failed',
      error: error instanceof Error ? error.message : error,
      query: query.substring(0, 200),
      parameters,
      executionTime,
    });

    // 실패한 쿼리도 수집
    if (this.queryCollector) {
      this.queryCollector.collect(
        query,
        'TypeORM-Error',
        parameters,
        executionTime,
      );
    }
  }

  /**
   * 느린 쿼리 로깅
   */
  logQuerySlow(
    time: number,
    query: string,
    parameters?: any[],
    queryRunner?: QueryRunner,
  ): void {
    this.logger.warn({
      message: 'Slow query detected',
      query: query.substring(0, 200),
      parameters,
      executionTime: time,
    });

    // 느린 쿼리 수집
    if (this.queryCollector) {
      this.queryCollector.collect(
        query,
        'TypeORM-Slow',
        parameters,
        time,
      );
    }
  }

  /**
   * 스키마 빌드 로깅
   */
  logSchemaBuild(message: string, queryRunner?: QueryRunner): void {
    this.logger.log(message);
  }

  /**
   * 마이그레이션 로깅
   */
  logMigration(message: string, queryRunner?: QueryRunner): void {
    this.logger.log(message);
  }

  /**
   * 일반 로그
   */
  log(level: 'log' | 'info' | 'warn', message: any, queryRunner?: QueryRunner): void {
    switch (level) {
      case 'log':
      case 'info':
        this.logger.log(message);
        break;
      case 'warn':
        this.logger.warn(message);
        break;
    }
  }
}