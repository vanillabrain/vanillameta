import { Injectable, Logger } from '@nestjs/common';
import { SelectQueryBuilder } from 'typeorm';
import { Knex } from 'knex';

export interface FieldSelectionOptions {
  allowedFields?: string[]; // 허용된 필드 화이트리스트
  excludeFields?: string[]; // 제외할 필드 (민감한 정보)
  maxDepth?: number; // 중첩 객체 최대 깊이
  aliasMapping?: Record<string, string>; // 필드 별칭 매핑
}

@Injectable()
export class FieldSelectionService {
  private readonly logger = new Logger(FieldSelectionService.name);

  /**
   * 필드 선택 문자열을 파싱하여 배열로 변환
   * @param fieldsParam - "id,name,user.profile.name" 형태의 문자열
   * @param options - 필드 선택 옵션
   */
  parseFields(fieldsParam: string, options: FieldSelectionOptions = {}): string[] {
    if (!fieldsParam || typeof fieldsParam !== 'string') {
      return [];
    }

    // 쉼표로 분리하고 공백 제거
    const fields = fieldsParam
      .split(',')
      .map(field => field.trim())
      .filter(field => field.length > 0);

    // 유효성 검사
    const validatedFields = this.validateFields(fields, options);
    
    this.logger.debug(`Parsed fields: ${validatedFields.join(', ')}`);
    return validatedFields;
  }

  /**
   * 필드 유효성 검사 및 필터링
   */
  private validateFields(fields: string[], options: FieldSelectionOptions): string[] {
    const { allowedFields, excludeFields, maxDepth = 5 } = options;
    
    return fields.filter(field => {
      // 중첩 깊이 체크
      const depth = field.split('.').length;
      if (depth > maxDepth) {
        this.logger.warn(`Field depth exceeded: ${field} (max: ${maxDepth})`);
        return false;
      }

      // 금지된 필드 체크
      if (excludeFields && this.isFieldExcluded(field, excludeFields)) {
        this.logger.warn(`Excluded field requested: ${field}`);
        return false;
      }

      // 허용된 필드 체크 (화이트리스트가 있는 경우)
      if (allowedFields && !this.isFieldAllowed(field, allowedFields)) {
        this.logger.warn(`Unauthorized field requested: ${field}`);
        return false;
      }

      return true;
    });
  }

  /**
   * 필드가 제외 목록에 있는지 확인
   */
  private isFieldExcluded(field: string, excludeFields: string[]): boolean {
    return excludeFields.some(excluded => {
      // 정확한 매치 또는 하위 필드 매치
      return field === excluded || field.startsWith(excluded + '.');
    });
  }

  /**
   * 필드가 허용 목록에 있는지 확인
   */
  private isFieldAllowed(field: string, allowedFields: string[]): boolean {
    return allowedFields.some(allowed => {
      // 정확한 매치 또는 상위 필드 매치
      return field === allowed || field.startsWith(allowed + '.') || allowed.startsWith(field + '.');
    });
  }

  /**
   * 데이터 객체에서 선택된 필드만 추출
   */
  selectFields(data: any, fields: string[]): any {
    if (!data || fields.length === 0) {
      return data;
    }

    // 배열인 경우 각 요소에 재귀적으로 적용
    if (Array.isArray(data)) {
      return data.map(item => this.selectFields(item, fields));
    }

    // 객체가 아닌 경우 그대로 반환
    if (typeof data !== 'object' || data === null) {
      return data;
    }

    const result: any = {};
    
    // 각 필드별로 처리
    fields.forEach(field => {
      this.extractField(data, field, result);
    });

    return result;
  }

  /**
   * 특정 필드를 객체에서 추출하여 결과에 설정
   */
  private extractField(source: any, fieldPath: string, target: any): void {
    const parts = fieldPath.split('.');
    const firstPart = parts[0];

    if (parts.length === 1) {
      // 단일 필드
      if (source.hasOwnProperty(firstPart)) {
        target[firstPart] = source[firstPart];
      }
    } else {
      // 중첩 필드
      const remainingPath = parts.slice(1).join('.');
      
      if (source.hasOwnProperty(firstPart)) {
        const sourceValue = source[firstPart];
        
        if (sourceValue !== null && sourceValue !== undefined) {
          if (!target[firstPart]) {
            target[firstPart] = Array.isArray(sourceValue) ? [] : {};
          }
          
          if (Array.isArray(sourceValue)) {
            // 배열의 각 요소에 재귀적으로 적용
            target[firstPart] = sourceValue.map(item => {
              const itemResult = {};
              this.extractField(item, remainingPath, itemResult);
              return itemResult;
            });
          } else if (typeof sourceValue === 'object') {
            // 객체에 재귀적으로 적용
            this.extractField(sourceValue, remainingPath, target[firstPart]);
          }
        }
      }
    }
  }

  /**
   * TypeORM 쿼리 빌더 최적화
   */
  optimizeTypeOrmQuery(
    queryBuilder: SelectQueryBuilder<any>, 
    fields: string[], 
    alias?: string
  ): SelectQueryBuilder<any> {
    if (fields.length === 0) {
      return queryBuilder;
    }

    const mainAlias = alias || queryBuilder.alias;
    const mainFields: string[] = [];
    const relationFields: Record<string, string[]> = {};

    // 필드를 메인 엔티티와 관계 엔티티로 분류
    fields.forEach(field => {
      const parts = field.split('.');
      
      if (parts.length === 1) {
        // 메인 엔티티 필드
        mainFields.push(`${mainAlias}.${parts[0]}`);
      } else {
        // 관계 엔티티 필드
        const relationAlias = parts[0];
        const relationField = parts.slice(1).join('.');
        
        if (!relationFields[relationAlias]) {
          relationFields[relationAlias] = [];
        }
        
        if (parts.length === 2) {
          relationFields[relationAlias].push(`${relationAlias}.${parts[1]}`);
        } else {
          // 더 깊은 중첩은 현재 단순화
          relationFields[relationAlias].push(`${relationAlias}.${parts[1]}`);
        }
      }
    });

    // 메인 엔티티 필드 선택
    if (mainFields.length > 0) {
      queryBuilder.select(mainFields);
    }

    // 관계 엔티티 필드 추가
    Object.entries(relationFields).forEach(([relationAlias, relFields]) => {
      if (relFields.length > 0) {
        queryBuilder.addSelect(relFields);
      }
    });

    this.logger.debug(`Optimized TypeORM query with fields: ${fields.join(', ')}`);
    return queryBuilder;
  }

  /**
   * Knex 쿼리 빌더 최적화
   */
  optimizeKnexQuery(
    queryBuilder: Knex.QueryBuilder, 
    fields: string[],
    tableAlias?: string
  ): Knex.QueryBuilder {
    if (fields.length === 0) {
      return queryBuilder;
    }

    // 단순 필드만 처리 (관계는 별도 처리 필요)
    const simpleFields = fields
      .filter(field => !field.includes('.'))
      .map(field => tableAlias ? `${tableAlias}.${field}` : field);

    if (simpleFields.length > 0) {
      queryBuilder.select(simpleFields);
      this.logger.debug(`Optimized Knex query with fields: ${simpleFields.join(', ')}`);
    }

    return queryBuilder;
  }

  /**
   * 필드 선택 요약 정보 생성 (디버깅용)
   */
  getFieldSelectionSummary(originalData: any, selectedData: any, fields: string[]): any {
    const originalSize = JSON.stringify(originalData).length;
    const selectedSize = JSON.stringify(selectedData).length;
    const reduction = ((originalSize - selectedSize) / originalSize) * 100;

    return {
      fieldsRequested: fields,
      fieldsCount: fields.length,
      originalSize,
      selectedSize,
      reductionPercentage: reduction.toFixed(2),
      optimizationApplied: reduction > 0
    };
  }

  /**
   * 기본 제외 필드 목록 (보안상 중요한 필드들)
   */
  getDefaultExcludeFields(): string[] {
    return [
      'password',
      'passwordHash',
      'token',
      'accessToken',
      'refreshToken',
      'secret',
      'apiKey',
      'privateKey',
      'connectionString',
      'credentials'
    ];
  }

  /**
   * 자주 사용되는 필드 조합 사전 정의
   */
  getPredefinedFieldSets(): Record<string, string[]> {
    return {
      // 사용자 기본 정보
      userBasic: ['id', 'email', 'name', 'createdAt'],
      userWithProfile: ['id', 'email', 'name', 'profile.avatar', 'profile.bio'],
      
      // 대시보드 메타데이터
      dashboardMeta: ['id', 'title', 'description', 'createdAt', 'updatedAt'],
      dashboardWithWidgets: ['id', 'title', 'widgets.id', 'widgets.name', 'widgets.type'],
      
      // 위젯 기본 정보
      widgetBasic: ['id', 'name', 'type', 'order', 'createdAt'],
      widgetWithConfig: ['id', 'name', 'type', 'config.title', 'config.chartType'],
      
      // 데이터셋 스키마
      datasetSchema: ['id', 'name', 'description', 'columns.name', 'columns.type'],
      datasetMeta: ['id', 'name', 'description', 'rowCount', 'createdAt'],
      
      // 연결 정보 (민감한 정보 제외)
      connectionBasic: ['id', 'name', 'type', 'host', 'port', 'database', 'status']
    };
  }
}