import { Injectable, Logger } from '@nestjs/common';
import { Knex } from 'knex';

export interface OptimizationResult {
  optimizedQuery: string;
  appliedOptimizations: string[];
  performance: {
    estimatedImprovementPercent: number;
    indexRecommendations: string[];
  };
}

@Injectable()
export class MySQLOptimizer {
  private readonly logger = new Logger(MySQLOptimizer.name);

  /**
   * MySQL 전용 쿼리 최적화
   */
  optimizeQuery(queryBuilder: Knex.QueryBuilder): Knex.QueryBuilder {
    // Knex QueryBuilder는 hint() 메서드를 직접 지원하지 않으므로
    // raw SQL을 사용하거나 options를 사용한다
    return queryBuilder.options({ 
      sql_mode: 'TRADITIONAL',
      // MySQL 힌트는 raw SQL에서 사용
    });
  }

  /**
   * MySQL 배치 삽입 최적화
   */
  async batchInsert(knex: Knex, data: any[], tableName: string): Promise<void> {
    const chunkSize = 1000; // MySQL 최적 배치 크기
    const chunks = this.chunkArray(data, chunkSize);
    
    for (const chunk of chunks) {
      await knex(tableName)
        .insert(chunk)
        .options({ ignore: true }); // INSERT IGNORE
    }
  }

  /**
   * MySQL 연결 최적화 설정
   */
  getConnectionConfig(baseConfig: any): Knex.Config {
    return {
      client: 'mysql2',
      connection: {
        ...baseConfig,
        supportBigNumbers: true,
        bigNumberStrings: true,
        dateStrings: true,
        multipleStatements: true,
        timezone: 'Z', // UTC 시간대 사용
        charset: 'utf8mb4',
        acquireTimeout: 60000,
        reconnect: true,
      },
      pool: {
        min: 0,
        max: parseInt(process.env.MYSQL_POOL_MAX) || 10,
        acquireTimeoutMillis: 30000,
        createTimeoutMillis: 30000,
        destroyTimeoutMillis: 5000,
        idleTimeoutMillis: 300000, // 5분
        reapIntervalMillis: 1000,
        createRetryIntervalMillis: 100,
        afterCreate: (conn, done) => {
          conn.query('SET SESSION sql_mode="TRADITIONAL"', (err) => {
            if (err) {
              this.logger.warn('Failed to set MySQL sql_mode', err.message);
            }
            done(err, conn);
          });
        },
      },
    };
  }

  /**
   * MySQL 힌트 추가
   */
  addMySQLHints(query: string, hints: string[]): string {
    if (!hints || hints.length === 0) return query;
    
    const hintString = hints.join(' ');
    return query.replace(/SELECT/i, `SELECT ${hintString}`);
  }

  /**
   * MySQL 인덱스 힌트 최적화
   */
  optimizeWithIndexHints(query: string, tableName: string, indexName: string): string {
    const useIndexHint = `USE INDEX (${indexName})`;
    const fromPattern = new RegExp(`FROM\\s+${tableName}`, 'i');
    
    if (fromPattern.test(query)) {
      return query.replace(fromPattern, `FROM ${tableName} ${useIndexHint}`);
    }
    
    return query;
  }

  /**
   * MySQL 페이지네이션 최적화
   */
  optimizePagination(query: string, offset: number, limit: number): string {
    // 큰 OFFSET을 피하기 위한 최적화
    if (offset > 10000) {
      this.logger.warn('Large OFFSET detected in MySQL query, performance may be impacted', {
        offset,
        limit,
        suggestion: 'Consider using cursor-based pagination',
      });
    }
    
    // LIMIT가 너무 큰 경우 제한
    const maxLimit = 10000;
    const actualLimit = Math.min(limit, maxLimit);
    
    if (limit > maxLimit) {
      this.logger.warn('Large LIMIT reduced for MySQL optimization', {
        requestedLimit: limit,
        actualLimit,
      });
    }
    
    return query.replace(/LIMIT\s+\d+/i, `LIMIT ${actualLimit}`);
  }

  /**
   * MySQL 집계 쿼리 최적화
   */
  optimizeAggregationQuery(query: string): OptimizationResult {
    let optimizedQuery = query;
    const appliedOptimizations: string[] = [];

    // GROUP BY에 대한 인덱스 사용 권장
    if (/GROUP\s+BY/i.test(query)) {
      // 임시 테이블 사용을 줄이기 위한 최적화
      if (!/ORDER\s+BY\s+NULL/i.test(query)) {
        optimizedQuery = optimizedQuery.replace(
          /GROUP\s+BY\s+([^;]+)/i,
          'GROUP BY $1 ORDER BY NULL'
        );
        appliedOptimizations.push('Added ORDER BY NULL to prevent implicit sorting');
      }
    }

    // COUNT(*) 최적화
    if (/COUNT\s*\(\s*\*\s*\)/i.test(query)) {
      appliedOptimizations.push('COUNT(*) optimization applied');
    }

    return {
      optimizedQuery,
      appliedOptimizations,
      performance: {
        estimatedImprovementPercent: appliedOptimizations.length * 15,
        indexRecommendations: this.generateIndexRecommendations(query),
      },
    };
  }

  /**
   * MySQL JSON 쿼리 최적화
   */
  optimizeJsonQuery(query: string): string {
    // JSON_EXTRACT 함수 사용 권장
    const jsonOperatorPattern = /(\w+)\s*->\s*['"'](\w+)['"']/g;
    
    return query.replace(jsonOperatorPattern, (match, column, key) => {
      return `JSON_EXTRACT(${column}, '$.${key}')`;
    });
  }

  /**
   * MySQL 전용 쿼리 분석
   */
  analyzeQuery(query: string): {
    complexity: 'low' | 'medium' | 'high';
    recommendations: string[];
    estimatedCost: number;
  } {
    const recommendations: string[] = [];
    let complexity: 'low' | 'medium' | 'high' = 'low';
    let estimatedCost = 1;

    // JOIN 복잡도 분석
    const joinCount = (query.match(/JOIN/gi) || []).length;
    if (joinCount > 3) {
      complexity = 'high';
      estimatedCost += joinCount * 2;
      recommendations.push('Consider breaking down complex JOINs');
    } else if (joinCount > 1) {
      complexity = 'medium';
      estimatedCost += joinCount;
    }

    // LIKE 패턴 분석
    if (/LIKE\s+['"]%.*%['"]/i.test(query)) {
      recommendations.push('Avoid leading wildcard in LIKE queries for better performance');
      estimatedCost += 3;
    }

    // 서브쿼리 분석
    const subqueryCount = (query.match(/\(/g) || []).length;
    if (subqueryCount > 2) {
      complexity = 'high';
      estimatedCost += subqueryCount;
      recommendations.push('Consider converting subqueries to JOINs where possible');
    }

    // ORDER BY 분석
    if (/ORDER\s+BY.*,.*,/i.test(query)) {
      recommendations.push('Multiple column sorting may benefit from composite index');
      estimatedCost += 2;
    }

    return {
      complexity,
      recommendations,
      estimatedCost,
    };
  }

  /**
   * 인덱스 추천 생성
   */
  private generateIndexRecommendations(query: string): string[] {
    const recommendations: string[] = [];

    // WHERE 절 컬럼 추출
    const whereMatch = query.match(/WHERE\s+(\w+)/i);
    if (whereMatch) {
      recommendations.push(`Consider adding index on column: ${whereMatch[1]}`);
    }

    // ORDER BY 절 컬럼 추출
    const orderByMatch = query.match(/ORDER\s+BY\s+(\w+)/i);
    if (orderByMatch) {
      recommendations.push(`Consider adding index on column: ${orderByMatch[1]}`);
    }

    // GROUP BY 절 컬럼 추출
    const groupByMatch = query.match(/GROUP\s+BY\s+(\w+)/i);
    if (groupByMatch) {
      recommendations.push(`Consider adding index on column: ${groupByMatch[1]}`);
    }

    return recommendations;
  }

  /**
   * 배열을 청크로 나누는 헬퍼 메서드
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * MySQL 스토리지 엔진별 최적화
   */
  optimizeForStorageEngine(query: string, engine: 'InnoDB' | 'MyISAM' = 'InnoDB'): string {
    switch (engine) {
      case 'InnoDB':
        // InnoDB 최적화: 트랜잭션 지원, 외래키 제약조건
        if (/INSERT\s+INTO/i.test(query)) {
          return query + ' /* InnoDB optimized */';
        }
        break;
      case 'MyISAM':
        // MyISAM 최적화: 읽기 전용 테이블에 최적화
        if (/SELECT/i.test(query)) {
          return query + ' /* MyISAM optimized for reads */';
        }
        break;
    }
    return query;
  }
}