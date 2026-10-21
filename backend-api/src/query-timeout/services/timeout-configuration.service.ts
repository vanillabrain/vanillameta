import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Database } from '../../database/entities/database.entity';
import {
  DatabaseEngine,
  QueryComplexity,
  TimeoutRule,
  TimeoutConfigDto,
} from '../dto/timeout-config.dto';

@Injectable()
export class TimeoutConfigurationService {
  private readonly logger = new Logger(TimeoutConfigurationService.name);

  // 기본 타임아웃 규칙 (milliseconds)
  private readonly defaultTimeoutRules: Map<string, TimeoutRule> = new Map([
    // MySQL/MariaDB
    [
      `${DatabaseEngine.MYSQL}_${QueryComplexity.SIMPLE}`,
      {
        engine: DatabaseEngine.MYSQL,
        complexity: QueryComplexity.SIMPLE,
        baseTimeoutMs: 15000, // 15초
        maxTimeoutMs: 60000, // 1분
        adaptiveMultiplier: 1.5,
        description: 'MySQL 단순 쿼리 (SELECT, 기본 WHERE 절)',
      },
    ],
    [
      `${DatabaseEngine.MYSQL}_${QueryComplexity.MEDIUM}`,
      {
        engine: DatabaseEngine.MYSQL,
        complexity: QueryComplexity.MEDIUM,
        baseTimeoutMs: 45000, // 45초
        maxTimeoutMs: 120000, // 2분
        adaptiveMultiplier: 2.0,
        description: 'MySQL 중간 복잡도 (JOIN, GROUP BY, 집계)',
      },
    ],
    [
      `${DatabaseEngine.MYSQL}_${QueryComplexity.COMPLEX}`,
      {
        engine: DatabaseEngine.MYSQL,
        complexity: QueryComplexity.COMPLEX,
        baseTimeoutMs: 120000, // 2분
        maxTimeoutMs: 300000, // 5분
        adaptiveMultiplier: 2.5,
        description: 'MySQL 복잡한 쿼리 (다중 JOIN, 서브쿼리, 윈도우 함수)',
      },
    ],
    [
      `${DatabaseEngine.MYSQL}_${QueryComplexity.BATCH}`,
      {
        engine: DatabaseEngine.MYSQL,
        complexity: QueryComplexity.BATCH,
        baseTimeoutMs: 300000, // 5분
        maxTimeoutMs: 600000, // 10분
        adaptiveMultiplier: 3.0,
        description: 'MySQL 대용량 배치 처리',
      },
    ],

    // PostgreSQL
    [
      `${DatabaseEngine.POSTGRESQL}_${QueryComplexity.SIMPLE}`,
      {
        engine: DatabaseEngine.POSTGRESQL,
        complexity: QueryComplexity.SIMPLE,
        baseTimeoutMs: 20000, // 20초
        maxTimeoutMs: 60000, // 1분
        adaptiveMultiplier: 1.5,
        description: 'PostgreSQL 단순 쿼리',
      },
    ],
    [
      `${DatabaseEngine.POSTGRESQL}_${QueryComplexity.MEDIUM}`,
      {
        engine: DatabaseEngine.POSTGRESQL,
        complexity: QueryComplexity.MEDIUM,
        baseTimeoutMs: 60000, // 1분
        maxTimeoutMs: 180000, // 3분
        adaptiveMultiplier: 2.0,
        description: 'PostgreSQL 중간 복잡도 (JSON 연산, 배열 처리)',
      },
    ],
    [
      `${DatabaseEngine.POSTGRESQL}_${QueryComplexity.COMPLEX}`,
      {
        engine: DatabaseEngine.POSTGRESQL,
        complexity: QueryComplexity.COMPLEX,
        baseTimeoutMs: 180000, // 3분
        maxTimeoutMs: 420000, // 7분
        adaptiveMultiplier: 2.5,
        description: 'PostgreSQL 복잡한 쿼리 (전문검색, CTE, 윈도우 함수)',
      },
    ],
    [
      `${DatabaseEngine.POSTGRESQL}_${QueryComplexity.BATCH}`,
      {
        engine: DatabaseEngine.POSTGRESQL,
        complexity: QueryComplexity.BATCH,
        baseTimeoutMs: 420000, // 7분
        maxTimeoutMs: 900000, // 15분
        adaptiveMultiplier: 3.0,
        description: 'PostgreSQL 대용량 배치 처리',
      },
    ],

    // BigQuery
    [
      `${DatabaseEngine.BIGQUERY}_${QueryComplexity.SIMPLE}`,
      {
        engine: DatabaseEngine.BIGQUERY,
        complexity: QueryComplexity.SIMPLE,
        baseTimeoutMs: 30000, // 30초
        maxTimeoutMs: 120000, // 2분
        adaptiveMultiplier: 2.0,
        description: 'BigQuery 단순 쿼리 (파티션 프루닝 적용)',
      },
    ],
    [
      `${DatabaseEngine.BIGQUERY}_${QueryComplexity.MEDIUM}`,
      {
        engine: DatabaseEngine.BIGQUERY,
        complexity: QueryComplexity.MEDIUM,
        baseTimeoutMs: 120000, // 2분
        maxTimeoutMs: 300000, // 5분
        adaptiveMultiplier: 2.5,
        description: 'BigQuery 중간 복잡도 (다중 테이블 JOIN)',
      },
    ],
    [
      `${DatabaseEngine.BIGQUERY}_${QueryComplexity.COMPLEX}`,
      {
        engine: DatabaseEngine.BIGQUERY,
        complexity: QueryComplexity.COMPLEX,
        baseTimeoutMs: 300000, // 5분
        maxTimeoutMs: 600000, // 10분
        adaptiveMultiplier: 3.0,
        description: 'BigQuery 복잡한 쿼리 (대용량 집계, UNNEST)',
      },
    ],
    [
      `${DatabaseEngine.BIGQUERY}_${QueryComplexity.BATCH}`,
      {
        engine: DatabaseEngine.BIGQUERY,
        complexity: QueryComplexity.BATCH,
        baseTimeoutMs: 600000, // 10분
        maxTimeoutMs: 1800000, // 30분
        adaptiveMultiplier: 4.0,
        description: 'BigQuery 대용량 배치 처리',
      },
    ],

    // Snowflake
    [
      `${DatabaseEngine.SNOWFLAKE}_${QueryComplexity.SIMPLE}`,
      {
        engine: DatabaseEngine.SNOWFLAKE,
        complexity: QueryComplexity.SIMPLE,
        baseTimeoutMs: 25000, // 25초
        maxTimeoutMs: 90000, // 1.5분
        adaptiveMultiplier: 1.8,
        description: 'Snowflake 단순 쿼리 (캐시 활용)',
      },
    ],
    [
      `${DatabaseEngine.SNOWFLAKE}_${QueryComplexity.MEDIUM}`,
      {
        engine: DatabaseEngine.SNOWFLAKE,
        complexity: QueryComplexity.MEDIUM,
        baseTimeoutMs: 90000, // 1.5분
        maxTimeoutMs: 240000, // 4분
        adaptiveMultiplier: 2.2,
        description: 'Snowflake 중간 복잡도 (웨어하우스 스케일링)',
      },
    ],
    [
      `${DatabaseEngine.SNOWFLAKE}_${QueryComplexity.COMPLEX}`,
      {
        engine: DatabaseEngine.SNOWFLAKE,
        complexity: QueryComplexity.COMPLEX,
        baseTimeoutMs: 240000, // 4분
        maxTimeoutMs: 600000, // 10분
        adaptiveMultiplier: 3.0,
        description: 'Snowflake 복잡한 쿼리 (타임 트래블, 클러스터링)',
      },
    ],
    [
      `${DatabaseEngine.SNOWFLAKE}_${QueryComplexity.BATCH}`,
      {
        engine: DatabaseEngine.SNOWFLAKE,
        complexity: QueryComplexity.BATCH,
        baseTimeoutMs: 600000, // 10분
        maxTimeoutMs: 1200000, // 20분
        adaptiveMultiplier: 3.5,
        description: 'Snowflake 대용량 배치 처리',
      },
    ],

    // SQLite (개발/테스트용)
    [
      `${DatabaseEngine.SQLITE}_${QueryComplexity.SIMPLE}`,
      {
        engine: DatabaseEngine.SQLITE,
        complexity: QueryComplexity.SIMPLE,
        baseTimeoutMs: 5000, // 5초
        maxTimeoutMs: 30000, // 30초
        adaptiveMultiplier: 1.5,
        description: 'SQLite 단순 쿼리 (파일 기반)',
      },
    ],
    [
      `${DatabaseEngine.SQLITE}_${QueryComplexity.MEDIUM}`,
      {
        engine: DatabaseEngine.SQLITE,
        complexity: QueryComplexity.MEDIUM,
        baseTimeoutMs: 30000, // 30초
        maxTimeoutMs: 60000, // 1분
        adaptiveMultiplier: 2.0,
        description: 'SQLite 중간 복잡도',
      },
    ],
    [
      `${DatabaseEngine.SQLITE}_${QueryComplexity.COMPLEX}`,
      {
        engine: DatabaseEngine.SQLITE,
        complexity: QueryComplexity.COMPLEX,
        baseTimeoutMs: 60000, // 1분
        maxTimeoutMs: 120000, // 2분
        adaptiveMultiplier: 2.5,
        description: 'SQLite 복잡한 쿼리',
      },
    ],
    [
      `${DatabaseEngine.SQLITE}_${QueryComplexity.BATCH}`,
      {
        engine: DatabaseEngine.SQLITE,
        complexity: QueryComplexity.BATCH,
        baseTimeoutMs: 120000, // 2분
        maxTimeoutMs: 300000, // 5분
        adaptiveMultiplier: 3.0,
        description: 'SQLite 배치 처리 (제한적)',
      },
    ],
  ]);

  constructor(
    @InjectRepository(Database)
    private readonly databaseRepository: Repository<Database>,
  ) {}

  /**
   * 데이터베이스 엔진에 대한 타임아웃 설정 조회
   */
  getTimeoutConfig(engine: DatabaseEngine, complexity: QueryComplexity): TimeoutRule | null {
    const key = `${engine}_${complexity}`;
    return this.defaultTimeoutRules.get(key) || null;
  }

  /**
   * 모든 타임아웃 규칙 조회
   */
  getAllTimeoutRules(): TimeoutRule[] {
    return Array.from(this.defaultTimeoutRules.values());
  }

  /**
   * 특정 엔진의 모든 타임아웃 규칙 조회
   */
  getEngineTimeoutRules(engine: DatabaseEngine): TimeoutRule[] {
    return Array.from(this.defaultTimeoutRules.values()).filter(rule => rule.engine === engine);
  }

  /**
   * 쿼리 복잡도 분석
   */
  analyzeQueryComplexity(query: string): QueryComplexity {
    const normalizedQuery = query.toLowerCase().trim();

    // 복잡도 점수 계산
    let complexityScore = 0;

    // JOIN 개수
    const joinCount = (
      normalizedQuery.match(/\s+(inner\s+join|left\s+join|right\s+join|full\s+join|join)\s+/g) || []
    ).length;
    complexityScore += joinCount * 2;

    // 서브쿼리 개수
    const subqueryCount = (normalizedQuery.match(/\(/g) || []).length;
    complexityScore += subqueryCount * 1.5;

    // 집계 함수
    const aggregationCount = (
      normalizedQuery.match(/\b(count|sum|avg|max|min|group_concat)\s*\(/g) || []
    ).length;
    complexityScore += aggregationCount * 1;

    // 윈도우 함수
    const windowFunctionCount = (normalizedQuery.match(/\bover\s*\(/g) || []).length;
    complexityScore += windowFunctionCount * 3;

    // WITH 절 (CTE)
    const cteCount = (normalizedQuery.match(/\bwith\b/g) || []).length;
    complexityScore += cteCount * 2;

    // UNION
    const unionCount = (normalizedQuery.match(/\bunion\b/g) || []).length;
    complexityScore += unionCount * 1.5;

    // 배치 처리 패턴 감지
    if (this.isBatchQuery(normalizedQuery)) {
      return QueryComplexity.BATCH;
    }

    // 복잡도 분류
    if (complexityScore <= 2) {
      return QueryComplexity.SIMPLE;
    } else if (complexityScore <= 8) {
      return QueryComplexity.MEDIUM;
    } else {
      return QueryComplexity.COMPLEX;
    }
  }

  /**
   * 배치 쿼리 패턴 감지
   */
  private isBatchQuery(query: string): boolean {
    // 대용량 처리 패턴들
    const batchPatterns = [
      /\blimit\s+\d{4,}/, // LIMIT 1000 이상
      /\boffset\s+\d{3,}/, // OFFSET 100 이상
      /\binsert\s+into.*select/, // INSERT INTO ... SELECT
      /\bbulk\s+insert/, // BULK INSERT
      /\bload\s+data/, // LOAD DATA
      /\bcopy\s+.*\bfrom/, // COPY FROM (PostgreSQL)
      /\bmerge\s+into/, // MERGE INTO
    ];

    return batchPatterns.some(pattern => pattern.test(query));
  }

  /**
   * 환경별 타임아웃 조정
   */
  getEnvironmentMultiplier(): number {
    const environment = process.env.NODE_ENV || 'development';

    switch (environment) {
      case 'production':
        return 1.0; // 기본값
      case 'staging':
        return 1.2; // 20% 여유
      case 'development':
        return 1.5; // 50% 여유 (디버깅 고려)
      case 'local':
        return 2.0; // 100% 여유 (로컬 성능 고려)
      default:
        return 1.0;
    }
  }

  /**
   * Lambda 환경 타임아웃 조정
   */
  getLambdaTimeoutConstraint(): number {
    if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
      // Lambda 최대 실행 시간은 15분이지만, 안전을 위해 12분으로 제한
      return 720000; // 12분
    }
    return Infinity; // Lambda가 아닌 환경에서는 제한 없음
  }

  /**
   * 추천 타임아웃 계산
   */
  calculateRecommendedTimeout(
    engine: DatabaseEngine,
    complexity: QueryComplexity,
    customMultiplier = 1.0,
  ): number {
    const rule = this.getTimeoutConfig(engine, complexity);
    if (!rule) {
      this.logger.warn('No timeout rule found, using default', { engine, complexity });
      return 30000; // 기본 30초
    }

    let timeout = rule.baseTimeoutMs;

    // 환경별 조정
    timeout *= this.getEnvironmentMultiplier();

    // 커스텀 배수 적용
    timeout *= customMultiplier;

    // 최대값 제한
    timeout = Math.min(timeout, rule.maxTimeoutMs);

    // Lambda 환경 제한
    timeout = Math.min(timeout, this.getLambdaTimeoutConstraint());

    return Math.round(timeout);
  }

  /**
   * 데이터베이스별 기본 설정 조회
   */
  async getDatabaseDefaultConfig(databaseId: number): Promise<{
    engine: DatabaseEngine;
    defaultTimeoutMs: number;
    maxTimeoutMs: number;
  } | null> {
    try {
      const database = await this.databaseRepository.findOne({
        where: { id: databaseId },
      });

      if (!database) {
        return null;
      }

      const engine = database.engine as DatabaseEngine;
      const simpleRule = this.getTimeoutConfig(engine, QueryComplexity.SIMPLE);
      const batchRule = this.getTimeoutConfig(engine, QueryComplexity.BATCH);

      return {
        engine,
        defaultTimeoutMs: simpleRule?.baseTimeoutMs || 30000,
        maxTimeoutMs: batchRule?.maxTimeoutMs || 300000,
      };
    } catch (error) {
      this.logger.error('Failed to get database default config', {
        databaseId,
        error: error.message,
      });
      return null;
    }
  }

  /**
   * 타임아웃 규칙 업데이트 (런타임 설정)
   */
  updateTimeoutRule(
    engine: DatabaseEngine,
    complexity: QueryComplexity,
    config: Partial<TimeoutRule>,
  ): boolean {
    try {
      const key = `${engine}_${complexity}`;
      const existingRule = this.defaultTimeoutRules.get(key);

      if (!existingRule) {
        this.logger.warn('Timeout rule not found for update', { engine, complexity });
        return false;
      }

      const updatedRule: TimeoutRule = {
        ...existingRule,
        ...config,
        engine, // 엔진과 복잡도는 변경 불가
        complexity,
      };

      this.defaultTimeoutRules.set(key, updatedRule);

      this.logger.log('Timeout rule updated', {
        engine,
        complexity,
        oldTimeout: existingRule.baseTimeoutMs,
        newTimeout: updatedRule.baseTimeoutMs,
      });

      return true;
    } catch (error) {
      this.logger.error('Failed to update timeout rule', {
        engine,
        complexity,
        error: error.message,
      });
      return false;
    }
  }

  /**
   * 전체 시스템 타임아웃 통계
   */
  getSystemTimeoutStatistics(): {
    totalRules: number;
    byEngine: Record<string, number>;
    byComplexity: Record<string, number>;
    averageTimeout: number;
    maxTimeout: number;
    minTimeout: number;
  } {
    const rules = Array.from(this.defaultTimeoutRules.values());

    const byEngine: Record<string, number> = {};
    const byComplexity: Record<string, number> = {};
    let totalTimeout = 0;
    let maxTimeout = 0;
    let minTimeout = Infinity;

    rules.forEach(rule => {
      byEngine[rule.engine] = (byEngine[rule.engine] || 0) + 1;
      byComplexity[rule.complexity] = (byComplexity[rule.complexity] || 0) + 1;

      totalTimeout += rule.baseTimeoutMs;
      maxTimeout = Math.max(maxTimeout, rule.baseTimeoutMs);
      minTimeout = Math.min(minTimeout, rule.baseTimeoutMs);
    });

    return {
      totalRules: rules.length,
      byEngine,
      byComplexity,
      averageTimeout: totalTimeout / rules.length,
      maxTimeout,
      minTimeout: minTimeout === Infinity ? 0 : minTimeout,
    };
  }
}
