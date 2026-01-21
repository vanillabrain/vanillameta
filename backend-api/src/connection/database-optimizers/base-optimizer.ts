import { Knex } from 'knex';
import { Injectable, Logger } from '@nestjs/common';

/**
 * 데이터베이스 최적화를 위한 기본 추상 클래스
 * 각 DB별 Optimizer는 이 클래스를 상속받아 구현
 */
@Injectable()
export abstract class BaseDatabaseOptimizer {
  protected readonly logger = new Logger(this.constructor.name);

  /**
   * 데이터베이스 타입 반환
   */
  abstract getDatabaseType(): string;

  /**
   * 쿼리 최적화 적용
   * @param queryBuilder - Knex 쿼리 빌더
   * @param options - 추가 옵션
   */
  abstract optimizeQuery(queryBuilder: Knex.QueryBuilder, options?: any): Knex.QueryBuilder;

  /**
   * 연결 설정 최적화
   * @param baseConfig - 기본 연결 설정
   * @param environment - 환경 (dev, prod, local)
   */
  abstract getOptimizedConnectionConfig(baseConfig: any, environment?: string): Knex.Config;

  /**
   * 배치 삽입 최적화
   * @param knex - Knex 인스턴스
   * @param tableName - 테이블명
   * @param data - 삽입할 데이터 배열
   * @param options - 추가 옵션
   */
  abstract batchInsert(knex: Knex, tableName: string, data: any[], options?: any): Promise<any>;

  /**
   * 배치 업데이트 최적화
   * @param knex - Knex 인스턴스
   * @param tableName - 테이블명
   * @param data - 업데이트할 데이터 배열
   * @param keyColumns - 키 컬럼들
   */
  abstract batchUpdate(
    knex: Knex,
    tableName: string,
    data: any[],
    keyColumns: string[],
  ): Promise<any>;

  /**
   * 쿼리 힌트 추가 (주석 처리 - Knex는 hint를 직접 지원하지 않음)
   * @param queryBuilder - Knex 쿼리 빌더
   * @param hints - 힌트 문자열 또는 배열
   */
  // addQueryHints(queryBuilder: Knex.QueryBuilder, hints: string | string[]): Knex.QueryBuilder {
  //   const hintStr = Array.isArray(hints) ? hints.join(' ') : hints;
  //   // TODO: raw 쿼리를 사용하여 힌트 구현 필요
  //   return queryBuilder;
  // }

  /**
   * 페이지네이션 최적화
   * @param queryBuilder - Knex 쿼리 빌더
   * @param page - 페이지 번호
   * @param limit - 페이지 크기
   */
  optimizePagination(
    queryBuilder: Knex.QueryBuilder,
    page: number,
    limit: number,
  ): Knex.QueryBuilder {
    const offset = (page - 1) * limit;
    return queryBuilder.limit(limit).offset(offset);
  }

  /**
   * 배열 청크 분할 (대용량 배치 처리용)
   * @param array - 분할할 배열
   * @param chunkSize - 청크 크기
   */
  protected chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * 환경별 기본 풀 설정 반환
   * @param environment - 환경
   */
  protected getBasePoolConfig(environment = 'dev') {
    const isProduction = environment === 'prod';
    const isLocal = environment === 'local';

    return {
      min: isLocal ? 0 : 0, // Lambda에서는 항상 0부터 시작
      max: isLocal ? 2 : isProduction ? 10 : 5,
      createTimeoutMillis: 30000,
      acquireTimeoutMillis: 30000,
      idleTimeoutMillis: isLocal ? 10000 : 30000,
      reapIntervalMillis: 1000,
      createRetryIntervalMillis: 100,
      propagateCreateError: false,
    };
  }

  /**
   * 환경별 기본 연결 타임아웃 설정
   * @param environment - 환경
   * @param databaseType - 데이터베이스 타입 (환경 변수 키 생성용)
   */
  protected getBaseTimeouts(environment = 'dev', databaseType?: string) {
    const isProduction = environment === 'prod';

    // 환경 변수에서 타임아웃 값 가져오기
    const getEnvTimeout = (type: string, defaultValue: number): number => {
      const dbSpecificKey = databaseType
        ? `${databaseType.toUpperCase()}_${type.toUpperCase()}_TIMEOUT`
        : null;
      const genericKey = `DB_${type.toUpperCase()}_TIMEOUT`;

      // 데이터베이스별 환경 변수 우선 확인
      if (dbSpecificKey && process.env[dbSpecificKey]) {
        const envValue = parseInt(process.env[dbSpecificKey], 10);
        if (!isNaN(envValue) && envValue > 0) {
          return envValue;
        }
      }

      // 일반 환경 변수 확인
      if (process.env[genericKey]) {
        const envValue = parseInt(process.env[genericKey], 10);
        if (!isNaN(envValue) && envValue > 0) {
          return envValue;
        }
      }

      return defaultValue;
    };

    return {
      connectTimeout: getEnvTimeout('connect', isProduction ? 10000 : 30000),
      socketTimeout: getEnvTimeout('socket', isProduction ? 30000 : 60000),
      acquireConnectionTimeout: getEnvTimeout('acquire', 30000),
      queryTimeout: getEnvTimeout('query', isProduction ? 25000 : 60000), // Lambda 제한 고려
    };
  }

  /**
   * 데이터베이스별 성능 메트릭 수집 (선택적 구현)
   * @param knex - Knex 인스턴스
   * @param args - 추가 인자들
   */
  async getPerformanceMetrics?(knex: Knex, ...args: any[]): Promise<any> {
    // 각 데이터베이스별 optimizer에서 선택적으로 구현
    return null;
  }

  /**
   * 데이터베이스별 슬로우 쿼리 분석 (선택적 구현)
   * @param knex - Knex 인스턴스
   * @param args - 추가 인자들 (minDuration, projectId 등)
   */
  async getSlowQueries?(knex: Knex, ...args: any[]): Promise<any[]> {
    // 각 데이터베이스별 optimizer에서 선택적으로 구현
    return [];
  }
}
