import { Logger as TypeOrmLogger, QueryRunner } from 'typeorm';
import { Injectable, Logger } from '@nestjs/common';
import { CustomLoggerService } from '../logger/logger.service';
import { SlowQueryMonitorService } from './slow-query-monitor.service';
import { QueryAnalyzerService } from './query-analyzer.service';

@Injectable()
export class TypeOrmSlowQueryLogger implements TypeOrmLogger {
  private readonly logger = new Logger(TypeOrmSlowQueryLogger.name);
  private readonly slowQueryThreshold: number;

  constructor(
    private readonly customLogger: CustomLoggerService,
    private readonly slowQueryMonitorService: SlowQueryMonitorService,
    private readonly queryAnalyzerService: QueryAnalyzerService,
  ) {
    this.slowQueryThreshold = parseInt(process.env.SLOW_QUERY_THRESHOLD || '1000');
  }

  /**
   * 쿼리 로그 (실행 전)
   */
  logQuery(query: string, parameters?: any[], queryRunner?: QueryRunner): void {
    const startTime = Date.now();

    // QueryRunner에 시작 시간 저장
    if (queryRunner) {
      if (!queryRunner.data) {
        queryRunner.data = {};
      }
      queryRunner.data.queryStartTime = startTime;
      queryRunner.data.query = query;
      queryRunner.data.parameters = parameters;
    }

    this.customLogger.debug('TypeORM query started', 'TypeOrmSlowQueryLogger', {
      query: this.sanitizeQuery(query),
      parameters: this.sanitizeParameters(parameters),
    });
  }

  /**
   * 쿼리 에러 로그
   */
  logQueryError(
    error: string | Error,
    query: string,
    parameters?: any[],
    queryRunner?: QueryRunner,
  ): void {
    const duration = queryRunner?.data?.queryStartTime
      ? Date.now() - queryRunner.data.queryStartTime
      : 0;

    this.customLogger.error(
      'TypeORM query error',
      error instanceof Error ? error.stack : String(error),
      'TypeOrmSlowQueryLogger',
      {
        query: this.sanitizeQuery(query),
        parameters: this.sanitizeParameters(parameters),
        duration,
        errorMessage: error instanceof Error ? error.message : error,
      },
    );
  }

  /**
   * 슬로우 쿼리 로그
   */
  logQuerySlow(time: number, query: string, parameters?: any[], queryRunner?: QueryRunner): void {
    if (time > this.slowQueryThreshold) {
      this.customLogger.warn('Slow TypeORM query detected', 'TypeOrmSlowQueryLogger', {
        query: this.sanitizeQuery(query),
        parameters: this.sanitizeParameters(parameters),
        executionTime: time,
        threshold: this.slowQueryThreshold,
        correlationId: queryRunner?.data?.correlationId,
      });

      // 비동기로 쿼리 분석 및 슬로우 쿼리 로깅
      this.handleSlowQuery(query, parameters, time, queryRunner).catch(error => {
        this.logger.error('Failed to handle slow TypeORM query', error.stack);
      });
    }
  }

  /**
   * 스키마 빌드 로그
   */
  logSchemaBuild(message: string, queryRunner?: QueryRunner): void {
    this.customLogger.info('TypeORM schema build', 'TypeOrmSlowQueryLogger', {
      message,
    });
  }

  /**
   * 마이그레이션 로그
   */
  logMigration(message: string, queryRunner?: QueryRunner): void {
    this.customLogger.info('TypeORM migration', 'TypeOrmSlowQueryLogger', {
      message,
    });
  }

  /**
   * 일반 로그
   */
  log(level: 'log' | 'info' | 'warn', message: any, queryRunner?: QueryRunner): void {
    const metadata = {
      message: typeof message === 'string' ? message : JSON.stringify(message),
    };

    switch (level) {
      case 'log':
        this.customLogger.log('TypeORM log', 'TypeOrmSlowQueryLogger', metadata);
        break;
      case 'info':
        this.customLogger.info('TypeORM log', 'TypeOrmSlowQueryLogger', metadata);
        break;
      case 'warn':
        this.customLogger.warn('TypeORM log', 'TypeOrmSlowQueryLogger', metadata);
        break;
    }
  }

  /**
   * 슬로우 쿼리 처리
   */
  private async handleSlowQuery(
    query: string,
    parameters?: any[],
    executionTime?: number,
    queryRunner?: QueryRunner,
  ): Promise<void> {
    try {
      // TypeORM은 MySQL을 메인 DB로 사용
      const databaseEngine = 'mysql2';

      const analysis = await this.queryAnalyzerService.analyzeQuery(
        query,
        0, // TypeORM uses the main DB (ID: 0)
      );
      // Add execution time to the analysis result
      if (analysis && executionTime) {
        analysis.executionTime = executionTime;
      }

      await this.slowQueryMonitorService.logSlowQuery(analysis, {
        databaseId: 0, // TypeORM은 메인 DB (ID: 0)
        databaseEngine,
        userId: this.getCurrentUserId(queryRunner),
        requestPath: this.getCurrentRequestPath(queryRunner),
        httpMethod: this.getCurrentHttpMethod(queryRunner),
        clientIp: this.getCurrentClientIp(queryRunner),
        userAgent: this.getCurrentUserAgent(queryRunner),
        requestId: this.getCurrentRequestId(queryRunner),
        parameters,
      });
    } catch (error) {
      this.logger.error('Failed to analyze slow TypeORM query', error.stack);
    }
  }

  /**
   * 쿼리 정리 (민감한 정보 제거)
   */
  private sanitizeQuery(query: string): string {
    if (!query) return '';

    // 긴 쿼리는 잘라내기
    const maxLength = 500;
    if (query.length > maxLength) {
      return query.substring(0, maxLength) + '...';
    }

    return query.replace(/\s+/g, ' ').trim();
  }

  /**
   * 파라미터 정리 (민감한 정보 마스킹)
   */
  private sanitizeParameters(params?: any[]): any[] {
    if (!params || !Array.isArray(params)) return [];

    return params.map(param => {
      if (typeof param === 'string') {
        // 패스워드나 토큰 같은 민감한 정보 마스킹
        if (param.length > 20) {
          return `${param.substring(0, 5)}***${param.substring(param.length - 5)}`;
        }
        if (
          param.toLowerCase().includes('password') ||
          param.toLowerCase().includes('token') ||
          param.toLowerCase().includes('secret')
        ) {
          return '***MASKED***';
        }
      }

      return param;
    });
  }

  /**
   * 현재 사용자 ID 추출
   */
  private getCurrentUserId(queryRunner?: QueryRunner): string | undefined {
    return queryRunner?.data?.userId;
  }

  /**
   * 현재 요청 경로 추출
   */
  private getCurrentRequestPath(queryRunner?: QueryRunner): string | undefined {
    return queryRunner?.data?.requestPath;
  }

  /**
   * 현재 HTTP 메서드 추출
   */
  private getCurrentHttpMethod(queryRunner?: QueryRunner): string | undefined {
    return queryRunner?.data?.httpMethod;
  }

  /**
   * 현재 클라이언트 IP 추출
   */
  private getCurrentClientIp(queryRunner?: QueryRunner): string | undefined {
    return queryRunner?.data?.clientIp;
  }

  /**
   * 현재 User Agent 추출
   */
  private getCurrentUserAgent(queryRunner?: QueryRunner): string | undefined {
    return queryRunner?.data?.userAgent;
  }

  /**
   * 현재 요청 ID 추출
   */
  private getCurrentRequestId(queryRunner?: QueryRunner): string | undefined {
    return queryRunner?.data?.requestId || queryRunner?.data?.correlationId;
  }
}
