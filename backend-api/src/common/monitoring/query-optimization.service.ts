import { Injectable, Logger } from '@nestjs/common';
import { QueryAnalyzerService, QueryAnalysis } from './query-analyzer.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Dashboard } from '../../dashboard/entities/dashboard.entity';
import { Widget } from '../../widget/entities/widget.entity';
import { Dataset } from '../../dataset/entities/dataset.entity';
import { TableQuery } from '../../widget/table-query/entity/table-query.entity';

export interface OptimizationStrategy {
  queryPattern: string;
  issue: string;
  solution: string;
  expectedImprovement: string;
  implementation: string;
  priority: 'high' | 'medium' | 'low';
}

export interface QueryOptimizationPlan {
  totalQueries: number;
  optimizableQueries: number;
  estimatedImprovementPercent: number;
  strategies: OptimizationStrategy[];
  indexRecommendations: IndexRecommendation[];
  queryRewriteSuggestions: QueryRewriteSuggestion[];
}

export interface IndexRecommendation {
  table: string;
  columns: string[];
  type: 'BTREE' | 'HASH' | 'FULLTEXT' | 'SPATIAL';
  reason: string;
  expectedBenefit: string;
  createStatement: string;
}

export interface QueryRewriteSuggestion {
  originalQuery: string;
  optimizedQuery: string;
  reason: string;
  expectedImprovement: string;
}

@Injectable()
export class QueryOptimizationService {
  private readonly logger = new Logger(QueryOptimizationService.name);

  constructor(
    private readonly queryAnalyzer: QueryAnalyzerService,
    @InjectRepository(Dashboard) private dashboardRepository: Repository<Dashboard>,
    @InjectRepository(Widget) private widgetRepository: Repository<Widget>,
    @InjectRepository(Dataset) private datasetRepository: Repository<Dataset>,
    @InjectRepository(TableQuery) private tableQueryRepository: Repository<TableQuery>,
  ) {}

  /**
   * 주요 쿼리 수집 및 식별
   */
  async collectCriticalQueries(): Promise<string[]> {
    const queries: string[] = [];

    try {
      // 1. Dashboard 관련 쿼리
      const dashboardQueries = this.dashboardRepository
        .createQueryBuilder('dashboard')
        .leftJoinAndSelect('dashboard.widgets', 'widgets')
        .leftJoinAndSelect('widgets.dataset', 'dataset')
        .getQuery();
      queries.push(dashboardQueries);

      // 2. Widget 데이터 조회 쿼리
      const widgetQueries = this.widgetRepository
        .createQueryBuilder('widget')
        .leftJoinAndSelect('widget.dataset', 'dataset')
        .leftJoinAndSelect('widget.dashboard', 'dashboard')
        .where('widget.deletedAt IS NULL')
        .getQuery();
      queries.push(widgetQueries);

      // 3. Dataset 실행 쿼리
      const datasetQueries = await this.datasetRepository
        .createQueryBuilder('dataset')
        .select(['dataset.id', 'dataset.query'])
        .where('dataset.type = :type', { type: 'query' })
        .getMany();
      
      datasetQueries.forEach(ds => {
        if (ds.query) {
          queries.push(ds.query);
        }
      });

      // 4. Table Query 쿼리
      const tableQueries = await this.tableQueryRepository
        .createQueryBuilder('tableQuery')
        .select(['tableQuery.id', 'tableQuery.query'])
        .getMany();
      
      tableQueries.forEach(tq => {
        if (tq.query) {
          queries.push(tq.query);
        }
      });

      // 5. 통계 및 집계 쿼리
      const statsQuery = `
        SELECT 
          d.id,
          d.name,
          COUNT(DISTINCT w.id) as widget_count,
          COUNT(DISTINCT ds.id) as dataset_count,
          MAX(d.updatedAt) as last_updated
        FROM dashboard d
        LEFT JOIN widget w ON w.dashboardId = d.id
        LEFT JOIN dataset ds ON w.datasetId = ds.id
        WHERE d.deletedAt IS NULL
        GROUP BY d.id
        ORDER BY widget_count DESC
        LIMIT 10
      `;
      queries.push(statsQuery);

      return queries;
    } catch (error) {
      this.logger.error(`Failed to collect queries: ${error.message}`, error.stack);
      return queries;
    }
  }

  /**
   * 쿼리 최적화 계획 생성
   */
  async generateOptimizationPlan(): Promise<QueryOptimizationPlan> {
    const queries = await this.collectCriticalQueries();
    const analyses: QueryAnalysis[] = [];
    
    // 모든 쿼리 분석
    for (const query of queries) {
      try {
        const analysis = await this.queryAnalyzer.analyzeQuery(query);
        analyses.push(analysis);
      } catch (error) {
        this.logger.error(`Failed to analyze query: ${error.message}`);
      }
    }

    // 최적화 가능한 쿼리 식별
    const optimizableAnalyses = analyses.filter(
      a => a.optimizationSuggestions && a.optimizationSuggestions.length > 0
    );

    const plan: QueryOptimizationPlan = {
      totalQueries: queries.length,
      optimizableQueries: optimizableAnalyses.length,
      estimatedImprovementPercent: this.calculateEstimatedImprovement(analyses),
      strategies: this.generateStrategies(optimizableAnalyses),
      indexRecommendations: this.generateIndexRecommendations(analyses),
      queryRewriteSuggestions: this.generateRewriteSuggestions(analyses),
    };

    return plan;
  }

  /**
   * 예상 개선율 계산
   */
  private calculateEstimatedImprovement(analyses: QueryAnalysis[]): number {
    let totalTime = 0;
    let optimizableTime = 0;

    for (const analysis of analyses) {
      if (analysis.executionTime) {
        totalTime += analysis.executionTime;
        
        // Full table scan이나 인덱스 미사용 시 50% 개선 예상
        if (analysis.scanType === 'ALL' || !analysis.indexUsed) {
          optimizableTime += analysis.executionTime * 0.5;
        }
        // 임시 테이블이나 filesort 사용 시 30% 개선 예상
        else if (analysis.temporaryTable || analysis.filesort) {
          optimizableTime += analysis.executionTime * 0.3;
        }
      }
    }

    return totalTime > 0 ? Math.round((optimizableTime / totalTime) * 100) : 0;
  }

  /**
   * 최적화 전략 생성
   */
  private generateStrategies(analyses: QueryAnalysis[]): OptimizationStrategy[] {
    const strategies: OptimizationStrategy[] = [];
    const strategyMap = new Map<string, OptimizationStrategy>();

    for (const analysis of analyses) {
      // Full Table Scan 최적화
      if (analysis.scanType === 'ALL' || analysis.scanType === 'Seq Scan') {
        const key = 'full-table-scan';
        if (!strategyMap.has(key)) {
          strategyMap.set(key, {
            queryPattern: 'Full Table Scan Queries',
            issue: '인덱스 없이 전체 테이블을 스캔하여 성능 저하',
            solution: 'WHERE 절에 사용되는 컬럼에 인덱스 추가',
            expectedImprovement: '50-90% 실행 시간 감소',
            implementation: '1. 자주 사용되는 검색 조건 파악\n2. 복합 인덱스 고려\n3. 인덱스 영향도 테스트',
            priority: 'high',
          });
        }
      }

      // 임시 테이블 사용 최적화
      if (analysis.temporaryTable) {
        const key = 'temporary-table';
        if (!strategyMap.has(key)) {
          strategyMap.set(key, {
            queryPattern: 'Temporary Table Usage',
            issue: 'GROUP BY나 ORDER BY에서 임시 테이블 생성으로 메모리/디스크 사용',
            solution: '커버링 인덱스 생성 또는 쿼리 구조 개선',
            expectedImprovement: '30-50% 실행 시간 감소',
            implementation: '1. GROUP BY/ORDER BY 컬럼에 인덱스 생성\n2. 불필요한 정렬 제거\n3. 서브쿼리를 JOIN으로 변경',
            priority: 'medium',
          });
        }
      }

      // Filesort 최적화
      if (analysis.filesort) {
        const key = 'filesort';
        if (!strategyMap.has(key)) {
          strategyMap.set(key, {
            queryPattern: 'Filesort Operations',
            issue: 'ORDER BY 절이 인덱스를 활용하지 못해 추가 정렬 수행',
            solution: 'ORDER BY 컬럼에 맞는 인덱스 생성',
            expectedImprovement: '20-40% 실행 시간 감소',
            implementation: '1. ORDER BY 컬럼 순서대로 인덱스 생성\n2. WHERE + ORDER BY 복합 인덱스 고려',
            priority: 'medium',
          });
        }
      }

      // 느린 쿼리 최적화
      if (analysis.executionTime && analysis.executionTime > 1000) {
        const key = 'slow-query';
        if (!strategyMap.has(key)) {
          strategyMap.set(key, {
            queryPattern: 'Slow Queries (>1s)',
            issue: '실행 시간이 1초를 초과하는 느린 쿼리',
            solution: '쿼리 구조 개선 및 적절한 인덱싱',
            expectedImprovement: '40-70% 실행 시간 감소',
            implementation: '1. 쿼리 실행 계획 분석\n2. 병목 구간 식별\n3. 단계별 최적화 적용',
            priority: 'high',
          });
        }
      }
    }

    return Array.from(strategyMap.values());
  }

  /**
   * 인덱스 추천 생성
   */
  private generateIndexRecommendations(analyses: QueryAnalysis[]): IndexRecommendation[] {
    const recommendations: IndexRecommendation[] = [];
    const processedTables = new Set<string>();

    // 실제 쿼리 분석을 통한 인덱스 추천
    for (const analysis of analyses) {
      if (!analysis.indexUsed && analysis.query) {
        // WHERE 절 분석을 통한 인덱스 추천
        const whereMatch = analysis.query.match(/WHERE\s+(\w+)\.?(\w+)?\s*=|WHERE\s+(\w+)\s*=/i);
        if (whereMatch) {
          const table = this.extractTableName(analysis.query);
          const column = whereMatch[2] || whereMatch[1] || whereMatch[3];
          
          if (table && column && !processedTables.has(`${table}.${column}`)) {
            processedTables.add(`${table}.${column}`);
            recommendations.push({
              table,
              columns: [column],
              type: 'BTREE',
              reason: 'WHERE 절에서 자주 사용되는 컬럼',
              expectedBenefit: 'Full table scan 제거, 50-90% 성능 향상',
              createStatement: `CREATE INDEX idx_${table}_${column} ON ${table}(${column});`,
            });
          }
        }

        // JOIN 조건 분석
        const joinMatch = analysis.query.match(/JOIN\s+\w+\s+\w+\s+ON\s+(\w+)\.(\w+)\s*=\s*(\w+)\.(\w+)/gi);
        if (joinMatch) {
          joinMatch.forEach(match => {
            const parts = match.match(/ON\s+(\w+)\.(\w+)\s*=\s*(\w+)\.(\w+)/i);
            if (parts) {
              const table1 = parts[1];
              const column1 = parts[2];
              const table2 = parts[3];
              const column2 = parts[4];
              
              // 외래 키 컬럼에 대한 인덱스 추천
              if (!processedTables.has(`${table2}.${column2}`)) {
                processedTables.add(`${table2}.${column2}`);
                recommendations.push({
                  table: table2,
                  columns: [column2],
                  type: 'BTREE',
                  reason: 'JOIN 조건에서 사용되는 외래 키 컬럼',
                  expectedBenefit: 'JOIN 성능 향상, 30-60% 성능 개선',
                  createStatement: `CREATE INDEX idx_${table2}_${column2} ON ${table2}(${column2});`,
                });
              }
            }
          });
        }
      }

      // GROUP BY 최적화를 위한 인덱스
      if (analysis.temporaryTable && analysis.query) {
        const groupByMatch = analysis.query.match(/GROUP\s+BY\s+([\w,.\s]+)/i);
        if (groupByMatch) {
          const table = this.extractTableName(analysis.query);
          const columns = groupByMatch[1].split(',').map(c => c.trim().split('.').pop());
          
          if (table && columns.length > 0) {
            const key = `${table}.group_${columns.join('_')}`;
            if (!processedTables.has(key)) {
              processedTables.add(key);
              recommendations.push({
                table,
                columns,
                type: 'BTREE',
                reason: 'GROUP BY 절 최적화를 위한 복합 인덱스',
                expectedBenefit: '임시 테이블 생성 방지, 30-50% 성능 향상',
                createStatement: `CREATE INDEX idx_${table}_group ON ${table}(${columns.join(', ')});`,
              });
            }
          }
        }
      }

      // ORDER BY 최적화를 위한 인덱스
      if (analysis.filesort && analysis.query) {
        const orderByMatch = analysis.query.match(/ORDER\s+BY\s+([\w,.\s]+)/i);
        if (orderByMatch) {
          const table = this.extractTableName(analysis.query);
          const columns = orderByMatch[1].split(',').map(c => c.trim().split('.').pop());
          
          if (table && columns.length > 0) {
            const key = `${table}.order_${columns.join('_')}`;
            if (!processedTables.has(key)) {
              processedTables.add(key);
              recommendations.push({
                table,
                columns,
                type: 'BTREE',
                reason: 'ORDER BY 절 최적화를 위한 인덱스',
                expectedBenefit: 'Filesort 제거, 20-40% 성능 향상',
                createStatement: `CREATE INDEX idx_${table}_order ON ${table}(${columns.join(', ')});`,
              });
            }
          }
        }
      }
    }

    return recommendations;
  }

  /**
   * 쿼리 재작성 제안 생성
   */
  private generateRewriteSuggestions(analyses: QueryAnalysis[]): QueryRewriteSuggestion[] {
    const suggestions: QueryRewriteSuggestion[] = [];

    for (const analysis of analyses) {
      if (!analysis.query) continue;

      // 서브쿼리를 JOIN으로 변환
      if (analysis.query.includes('SELECT') && analysis.query.includes('WHERE') && analysis.query.includes('IN (SELECT')) {
        const original = analysis.query.substring(0, 200) + '...';
        suggestions.push({
          originalQuery: original,
          optimizedQuery: '-- 서브쿼리를 JOIN으로 변환\n' + this.convertSubqueryToJoin(analysis.query),
          reason: '서브쿼리는 각 행마다 실행되므로 JOIN이 더 효율적',
          expectedImprovement: '30-70% 성능 향상',
        });
      }

      // SELECT * 제거
      if (analysis.query.match(/SELECT\s+\*/i)) {
        suggestions.push({
          originalQuery: analysis.query.substring(0, 200) + '...',
          optimizedQuery: '-- 필요한 컬럼만 명시적으로 선택\n' + analysis.query.replace(/SELECT\s+\*/i, 'SELECT id, name, created_at'),
          reason: 'SELECT *는 불필요한 데이터 전송을 유발',
          expectedImprovement: '10-30% 네트워크 트래픽 감소',
        });
      }

      // DISTINCT 최적화
      if (analysis.query.includes('DISTINCT') && !analysis.query.includes('GROUP BY')) {
        suggestions.push({
          originalQuery: analysis.query.substring(0, 200) + '...',
          optimizedQuery: '-- DISTINCT 대신 GROUP BY 사용 고려\n' + analysis.query.replace('DISTINCT', ''),
          reason: 'GROUP BY가 인덱스를 더 효율적으로 활용할 수 있음',
          expectedImprovement: '20-40% 성능 향상 (인덱스 존재 시)',
        });
      }

      // LIMIT 없는 쿼리
      if (!analysis.query.match(/LIMIT\s+\d+/i) && analysis.rowsReturned && analysis.rowsReturned > 1000) {
        suggestions.push({
          originalQuery: analysis.query.substring(0, 200) + '...',
          optimizedQuery: analysis.query + '\nLIMIT 1000',
          reason: '대량 데이터 반환 시 LIMIT으로 제한 필요',
          expectedImprovement: '결과 셋 크기 제한으로 메모리 사용량 감소',
        });
      }
    }

    return suggestions;
  }

  /**
   * 테이블명 추출
   */
  private extractTableName(query: string): string {
    const fromMatch = query.match(/FROM\s+(\w+)/i);
    if (fromMatch) {
      return fromMatch[1];
    }
    
    const updateMatch = query.match(/UPDATE\s+(\w+)/i);
    if (updateMatch) {
      return updateMatch[1];
    }
    
    const insertMatch = query.match(/INSERT\s+INTO\s+(\w+)/i);
    if (insertMatch) {
      return insertMatch[1];
    }
    
    return '';
  }

  /**
   * 서브쿼리를 JOIN으로 변환 (예시)
   */
  private convertSubqueryToJoin(query: string): string {
    // 간단한 IN 서브쿼리 변환 예시
    if (query.includes('IN (SELECT')) {
      return query.replace(
        /WHERE\s+(\w+)\s+IN\s*\(SELECT\s+(\w+)\s+FROM\s+(\w+)\s+WHERE\s+(.+?)\)/i,
        'JOIN $3 ON $1 = $3.$2 WHERE $4'
      );
    }
    return query;
  }

  /**
   * 최적화 가이드라인 생성
   */
  async generateOptimizationGuidelines(): Promise<string> {
    const plan = await this.generateOptimizationPlan();
    
    let guidelines = `# VanillaMeta 쿼리 최적화 가이드라인\n\n`;
    guidelines += `## 분석 요약\n`;
    guidelines += `- 총 분석 쿼리 수: ${plan.totalQueries}\n`;
    guidelines += `- 최적화 가능 쿼리: ${plan.optimizableQueries}\n`;
    guidelines += `- 예상 성능 개선: ${plan.estimatedImprovementPercent}%\n\n`;
    
    guidelines += `## 최적화 전략\n`;
    for (const strategy of plan.strategies) {
      guidelines += `\n### ${strategy.queryPattern}\n`;
      guidelines += `- **문제**: ${strategy.issue}\n`;
      guidelines += `- **해결책**: ${strategy.solution}\n`;
      guidelines += `- **예상 개선**: ${strategy.expectedImprovement}\n`;
      guidelines += `- **구현 방법**:\n${strategy.implementation}\n`;
      guidelines += `- **우선순위**: ${strategy.priority}\n`;
    }
    
    guidelines += `\n## 인덱스 추천\n`;
    for (const idx of plan.indexRecommendations) {
      guidelines += `\n### ${idx.table} 테이블\n`;
      guidelines += `- **컬럼**: ${idx.columns.join(', ')}\n`;
      guidelines += `- **타입**: ${idx.type}\n`;
      guidelines += `- **이유**: ${idx.reason}\n`;
      guidelines += `- **예상 효과**: ${idx.expectedBenefit}\n`;
      guidelines += `- **생성 SQL**:\n\`\`\`sql\n${idx.createStatement}\n\`\`\`\n`;
    }
    
    guidelines += `\n## 쿼리 재작성 제안\n`;
    for (const suggestion of plan.queryRewriteSuggestions) {
      guidelines += `\n### 최적화 제안\n`;
      guidelines += `- **원본 쿼리**:\n\`\`\`sql\n${suggestion.originalQuery}\n\`\`\`\n`;
      guidelines += `- **최적화된 쿼리**:\n\`\`\`sql\n${suggestion.optimizedQuery}\n\`\`\`\n`;
      guidelines += `- **이유**: ${suggestion.reason}\n`;
      guidelines += `- **예상 개선**: ${suggestion.expectedImprovement}\n`;
    }
    
    guidelines += `\n## 일반 권장사항\n`;
    guidelines += `1. **인덱스 관리**\n`;
    guidelines += `   - 자주 사용되는 WHERE, JOIN, ORDER BY 컬럼에 인덱스 생성\n`;
    guidelines += `   - 복합 인덱스는 컬럼 순서가 중요 (선택도가 높은 컬럼을 앞에)\n`;
    guidelines += `   - 과도한 인덱스는 INSERT/UPDATE 성능 저하 유발\n\n`;
    
    guidelines += `2. **쿼리 작성**\n`;
    guidelines += `   - SELECT *보다 필요한 컬럼만 명시\n`;
    guidelines += `   - 서브쿼리보다 JOIN 선호\n`;
    guidelines += `   - LIMIT으로 결과 셋 크기 제한\n`;
    guidelines += `   - OR 조건보다 IN 절 사용\n\n`;
    
    guidelines += `3. **모니터링**\n`;
    guidelines += `   - 정기적인 쿼리 성능 모니터링\n`;
    guidelines += `   - 느린 쿼리 로그 분석\n`;
    guidelines += `   - 인덱스 사용률 확인\n`;
    
    return guidelines;
  }
}