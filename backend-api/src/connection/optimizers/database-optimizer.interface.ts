import { Knex } from 'knex';

/**
 * 데이터베이스별 최적화 인터페이스
 */
export interface IDatabaseOptimizer {
  /**
   * 데이터베이스 타입
   */
  readonly databaseType: string;

  /**
   * 연결 설정 최적화
   */
  getOptimizedConnectionConfig(baseConfig: any): Knex.Config;

  /**
   * 쿼리 최적화
   */
  optimizeQuery(queryBuilder: Knex.QueryBuilder): Knex.QueryBuilder;

  /**
   * 배치 처리 최적화
   */
  getBatchSize(): number;

  /**
   * 특화 기능 활용 가능 여부
   */
  supportsFeature(feature: DatabaseFeature): boolean;

  /**
   * 에러 처리 매핑
   */
  mapError(error: any): DatabaseError;

  /**
   * 성능 힌트 제공
   */
  getPerformanceHints(): PerformanceHint[];
}

/**
 * 데이터베이스 특화 기능 열거형
 */
export enum DatabaseFeature {
  JSON_OPERATIONS = 'json_operations',
  ARRAY_OPERATIONS = 'array_operations',
  WINDOW_FUNCTIONS = 'window_functions',
  CTE = 'common_table_expressions',
  PARTITIONING = 'partitioning',
  CLUSTERING = 'clustering',
  MATERIALIZED_VIEWS = 'materialized_views',
  STORED_PROCEDURES = 'stored_procedures',
  FULL_TEXT_SEARCH = 'full_text_search',
  GEOSPATIAL = 'geospatial',
  TIME_SERIES = 'time_series',
  UPSERT = 'upsert',
  BULK_INSERT = 'bulk_insert',
  STREAMING = 'streaming',
}

/**
 * 데이터베이스 에러 정보
 */
export interface DatabaseError {
  code: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  retryable: boolean;
  suggestions: string[];
}

/**
 * 성능 힌트 정보
 */
export interface PerformanceHint {
  category: 'indexing' | 'query' | 'connection' | 'configuration';
  priority: 'low' | 'medium' | 'high';
  description: string;
  implementation: string;
}

/**
 * 최적화 메트릭
 */
export interface OptimizationMetrics {
  connectionPoolUtilization: number;
  averageQueryTime: number;
  slowQueryCount: number;
  errorRate: number;
  throughput: number;
}