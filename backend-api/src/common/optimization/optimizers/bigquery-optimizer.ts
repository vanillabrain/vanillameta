import { Injectable, Logger } from '@nestjs/common';
import { Knex } from 'knex';

export interface BigQueryOptimizationResult {
  optimizedQuery: string;
  appliedOptimizations: string[];
  costEstimate: {
    estimatedBytesProcessed: number;
    estimatedCostUSD: number;
    recommendations: string[];
  };
  performance: {
    estimatedImprovementPercent: number;
    partitioningRecommendations: string[];
    clusteringRecommendations: string[];
  };
}

@Injectable()
export class BigQueryOptimizer {
  private readonly logger = new Logger(BigQueryOptimizer.name);
  private readonly BYTES_PER_GB = 1024 * 1024 * 1024;
  private readonly COST_PER_TB = 5.0; // BigQuery 온디맨드 가격 (USD per TB)

  /**
   * BigQuery 파티션 테이블 생성 최적화
   */
  async createPartitionedTable(dataset: string, table: string, knex?: Knex): Promise<string> {
    const query = `
      CREATE TABLE IF NOT EXISTS \`${dataset}.${table}\`
      PARTITION BY DATE(created_at)
      CLUSTER BY user_id, status
      AS SELECT * FROM \`${dataset}.${table}_temp\`
    `;
    
    this.logger.log('Creating partitioned table for BigQuery optimization', {
      dataset,
      table,
      partitionField: 'created_at',
      clusterFields: ['user_id', 'status'],
    });
    
    return query;
  }

  /**
   * BigQuery 비용 제어 쿼리 실행
   */
  async queryWithCostControl(knex: Knex, query: string, maxCostUSD: number = 1.0): Promise<any> {
    const maxBytes = Math.floor((maxCostUSD / this.COST_PER_TB) * this.BYTES_PER_GB * 1024);
    
    return knex.raw(query)
      .options({
        maximumBytesBilled: maxBytes.toString(),
        useQueryCache: true,
        priority: 'INTERACTIVE',
        useLegacySql: false,
      });
  }

  /**
   * BigQuery 연결 최적화 설정
   */
  getConnectionConfig(baseConfig: any): Knex.Config {
    const config: any = {
      client: require('../../../connection/knex-dialects/bigquery'),
      connection: {
        ...baseConfig,
        projectId: process.env.BIGQUERY_PROJECT_ID || baseConfig.projectId,
        keyFilename: process.env.BIGQUERY_KEY_FILE || baseConfig.keyFilename,
        location: process.env.BIGQUERY_LOCATION || 'US',
        dataset: baseConfig.dataset,
      },
      pool: {
        min: 0,
        max: parseInt(process.env.BIGQUERY_POOL_MAX) || 5, // BigQuery API 제한 고려
        acquireTimeoutMillis: 30000,
        createTimeoutMillis: 60000, // BigQuery 연결은 시간이 오래 걸림
        destroyTimeoutMillis: 5000,
        idleTimeoutMillis: 1800000, // 30분
        reapIntervalMillis: 1000,
        createRetryIntervalMillis: 500,
      },
      // BigQuery 전용 옵션
      options: {
        useLegacySql: false,
        useQueryCache: true,
        maximumBillingTier: 1,
        priority: 'INTERACTIVE',
      },
    };
    
    return config;
  }

  /**
   * BigQuery SELECT * 최적화
   */
  optimizeSelectStar(query: string): BigQueryOptimizationResult {
    let optimizedQuery = query;
    const appliedOptimizations: string[] = [];
    const recommendations: string[] = [];

    // SELECT * 패턴 감지
    const selectStarPattern = /SELECT\s+\*\s+FROM/i;
    
    if (selectStarPattern.test(query)) {
      recommendations.push('Avoid SELECT * in BigQuery - specify only needed columns to reduce costs');
      recommendations.push('BigQuery charges based on data processed, not rows returned');
      
      // 실제 최적화는 수동으로 수행해야 함
      appliedOptimizations.push('SELECT * detected - manual column selection recommended');
    }

    return {
      optimizedQuery,
      appliedOptimizations,
      costEstimate: {
        estimatedBytesProcessed: 0, // 실제 분석 필요
        estimatedCostUSD: 0,
        recommendations,
      },
      performance: {
        estimatedImprovementPercent: 0,
        partitioningRecommendations: [],
        clusteringRecommendations: [],
      },
    };
  }

  /**
   * BigQuery 파티션 프루닝 최적화
   */
  optimizePartitionPruning(query: string, partitionColumn: string = '_PARTITIONTIME'): BigQueryOptimizationResult {
    let optimizedQuery = query;
    const appliedOptimizations: string[] = [];
    const recommendations: string[] = [];

    // 파티션 필터 검사
    const partitionFilterPattern = new RegExp(`WHERE.*${partitionColumn}`, 'i');
    
    if (!partitionFilterPattern.test(query)) {
      recommendations.push(`Add WHERE clause with ${partitionColumn} for partition pruning`);
      recommendations.push('Partition pruning can reduce costs by 90%+ in BigQuery');
      
      // 예시 필터 제안
      const suggestedFilter = `WHERE ${partitionColumn} >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)`;
      recommendations.push(`Example: ${suggestedFilter}`);
      
      appliedOptimizations.push('Partition pruning optimization suggested');
    } else {
      appliedOptimizations.push('Partition pruning filter detected');
    }

    return {
      optimizedQuery,
      appliedOptimizations,
      costEstimate: {
        estimatedBytesProcessed: 0,
        estimatedCostUSD: 0,
        recommendations,
      },
      performance: {
        estimatedImprovementPercent: partitionFilterPattern.test(query) ? 0 : 80,
        partitioningRecommendations: recommendations,
        clusteringRecommendations: [],
      },
    };
  }

  /**
   * BigQuery 중복 제거 최적화
   */
  optimizeDeduplication(query: string): string {
    // ROW_NUMBER() 대신 QUALIFY 사용 권장 (BigQuery 표준 SQL)
    const rowNumberPattern = /ROW_NUMBER\(\)\s+OVER\s*\([^)]+\)\s*=\s*1/i;
    
    if (rowNumberPattern.test(query)) {
      // QUALIFY 구문으로 변환 제안
      this.logger.log('ROW_NUMBER() pattern detected, consider using QUALIFY for better performance', {
        suggestion: 'Use QUALIFY ROW_NUMBER() OVER (...) = 1 instead of subquery',
      });
    }

    return query;
  }

  /**
   * BigQuery 집계 최적화
   */
  optimizeAggregation(query: string): BigQueryOptimizationResult {
    let optimizedQuery = query;
    const appliedOptimizations: string[] = [];
    const clusteringRecommendations: string[] = [];

    // GROUP BY 절 분석
    const groupByMatch = query.match(/GROUP\s+BY\s+([^ORDER|HAVING|LIMIT]+)/i);
    if (groupByMatch) {
      const groupByColumns = groupByMatch[1].split(',').map(col => col.trim());
      clusteringRecommendations.push(`Consider clustering table by: ${groupByColumns.join(', ')}`);
      appliedOptimizations.push('GROUP BY optimization analysis performed');
    }

    // DISTINCT 최적화
    if (/SELECT\s+DISTINCT/i.test(query)) {
      appliedOptimizations.push('DISTINCT operation detected - consider if GROUP BY would be more efficient');
    }

    return {
      optimizedQuery,
      appliedOptimizations,
      costEstimate: {
        estimatedBytesProcessed: 0,
        estimatedCostUSD: 0,
        recommendations: [],
      },
      performance: {
        estimatedImprovementPercent: 15,
        partitioningRecommendations: [],
        clusteringRecommendations,
      },
    };
  }

  /**
   * BigQuery JOIN 최적화
   */
  optimizeJoins(query: string): BigQueryOptimizationResult {
    let optimizedQuery = query;
    const appliedOptimizations: string[] = [];
    const recommendations: string[] = [];

    // 큰 테이블과 작은 테이블 JOIN 패턴
    const joinPattern = /(\w+)\s+JOIN\s+(\w+)/gi;
    let match;
    
    while ((match = joinPattern.exec(query)) !== null) {
      const [, leftTable, rightTable] = match;
      recommendations.push(`Ensure smaller table is on the right side of JOIN for ${leftTable} JOIN ${rightTable}`);
      appliedOptimizations.push('JOIN order optimization suggested');
    }

    // CROSS JOIN 경고
    if (/CROSS\s+JOIN/i.test(query)) {
      recommendations.push('CROSS JOIN detected - this can be very expensive in BigQuery');
      appliedOptimizations.push('CROSS JOIN warning added');
    }

    return {
      optimizedQuery,
      appliedOptimizations,
      costEstimate: {
        estimatedBytesProcessed: 0,
        estimatedCostUSD: 0,
        recommendations,
      },
      performance: {
        estimatedImprovementPercent: 20,
        partitioningRecommendations: [],
        clusteringRecommendations: [],
      },
    };
  }

  /**
   * BigQuery 날짜 함수 최적화
   */
  optimizeDateFunctions(query: string): string {
    let optimizedQuery = query;

    // 레거시 날짜 함수를 표준 SQL로 변환
    const legacyPatterns = [
      { legacy: /DATEDIFF\(/g, standard: 'DATE_DIFF(' },
      { legacy: /DATEADD\(/g, standard: 'DATE_ADD(' },
      { legacy: /YEAR\(/g, standard: 'EXTRACT(YEAR FROM ' },
      { legacy: /MONTH\(/g, standard: 'EXTRACT(MONTH FROM ' },
    ];

    legacyPatterns.forEach(({ legacy, standard }) => {
      if (legacy.test(optimizedQuery)) {
        optimizedQuery = optimizedQuery.replace(legacy, standard);
        this.logger.log('Legacy date function converted to standard SQL', {
          pattern: legacy.source,
          replacement: standard,
        });
      }
    });

    return optimizedQuery;
  }

  /**
   * BigQuery 비용 추정
   */
  estimateQueryCost(query: string, tableStats?: any): {
    estimatedBytesProcessed: number;
    estimatedCostUSD: number;
    costBreakdown: any;
  } {
    // 실제 구현에서는 BigQuery Information Schema를 사용해야 함
    let estimatedBytesProcessed = 0;

    // 간단한 추정 로직 (실제로는 테이블 메타데이터 필요)
    if (/SELECT\s+\*/i.test(query)) {
      estimatedBytesProcessed = tableStats?.totalBytes || 1000000000; // 1GB 기본값
    } else {
      // 선택된 컬럼 수에 따른 추정
      const columnCount = (query.match(/SELECT\s+([^FROM]+)/i)?.[1]?.split(',') || []).length;
      estimatedBytesProcessed = Math.floor((tableStats?.totalBytes || 1000000000) * (columnCount / 10));
    }

    const estimatedCostUSD = (estimatedBytesProcessed / this.BYTES_PER_GB / 1024) * this.COST_PER_TB;

    return {
      estimatedBytesProcessed,
      estimatedCostUSD,
      costBreakdown: {
        bytesPerGB: this.BYTES_PER_GB,
        costPerTB: this.COST_PER_TB,
        query: query.substring(0, 100) + '...',
      },
    };
  }

  /**
   * BigQuery 슬롯 사용량 최적화
   */
  optimizeSlotUsage(query: string): string[] {
    const recommendations: string[] = [];

    // 복잡한 쿼리 패턴 감지
    const complexPatterns = [
      { pattern: /WITH\s+RECURSIVE/i, message: 'Recursive CTEs consume many slots' },
      { pattern: /WINDOW\s+/i, message: 'Window functions may require more slots' },
      { pattern: /\bUNNEST\b/i, message: 'UNNEST operations can be slot-intensive' },
    ];

    complexPatterns.forEach(({ pattern, message }) => {
      if (pattern.test(query)) {
        recommendations.push(message);
      }
    });

    // 병렬 처리 권장사항
    if (/GROUP\s+BY/i.test(query) && /ORDER\s+BY/i.test(query)) {
      recommendations.push('Consider removing ORDER BY if not necessary to improve parallelism');
    }

    return recommendations;
  }

  /**
   * BigQuery DML 최적화
   */
  optimizeDML(query: string): BigQueryOptimizationResult {
    let optimizedQuery = query;
    const appliedOptimizations: string[] = [];
    const recommendations: string[] = [];

    // INSERT 최적화
    if (/INSERT\s+INTO/i.test(query)) {
      recommendations.push('Use streaming inserts for real-time data, batch inserts for bulk loads');
      appliedOptimizations.push('INSERT optimization guidance provided');
    }

    // UPDATE/DELETE 최적화
    if (/UPDATE|DELETE/i.test(query)) {
      recommendations.push('DML operations in BigQuery can be expensive - consider batch processing');
      recommendations.push('Use MERGE statement for upsert operations');
      appliedOptimizations.push('DML optimization guidance provided');
    }

    return {
      optimizedQuery,
      appliedOptimizations,
      costEstimate: {
        estimatedBytesProcessed: 0,
        estimatedCostUSD: 0,
        recommendations,
      },
      performance: {
        estimatedImprovementPercent: 0,
        partitioningRecommendations: [],
        clusteringRecommendations: [],
      },
    };
  }

  /**
   * BigQuery 쿼리 복잡도 분석
   */
  analyzeQueryComplexity(query: string): {
    complexity: 'low' | 'medium' | 'high';
    factors: string[];
    slotRecommendations: string[];
  } {
    const factors: string[] = [];
    const slotRecommendations: string[] = [];
    let complexity: 'low' | 'medium' | 'high' = 'low';

    // 복잡도 요소 분석
    const joinCount = (query.match(/JOIN/gi) || []).length;
    if (joinCount > 0) {
      factors.push(`${joinCount} JOINs`);
      if (joinCount > 5) {
        complexity = 'high';
        slotRecommendations.push('Consider breaking down complex JOINs into multiple queries');
      } else if (joinCount > 2) {
        complexity = 'medium';
      }
    }

    // 서브쿼리 분석
    const subqueryCount = (query.match(/\(/g) || []).length;
    if (subqueryCount > 3) {
      factors.push(`${subqueryCount} subqueries`);
      complexity = 'high';
      slotRecommendations.push('Use CTEs instead of nested subqueries');
    }

    // 윈도우 함수
    if (/OVER\s*\(/i.test(query)) {
      factors.push('Window functions');
      complexity = 'high';
      slotRecommendations.push('Window functions require additional slots');
    }

    // UNNEST 연산
    if (/UNNEST/i.test(query)) {
      factors.push('UNNEST operations');
      complexity = 'high';
      slotRecommendations.push('UNNEST can be memory intensive');
    }

    return {
      complexity,
      factors,
      slotRecommendations,
    };
  }
}