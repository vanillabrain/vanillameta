import { Injectable } from '@nestjs/common';
import { Request } from 'express';
import * as crypto from 'crypto';
import { CacheConfig } from '../decorators/cache-config.decorator';

@Injectable()
export class CacheKeyService {
  /**
   * API 요청에 대한 캐시 키 생성
   */
  generateKey(request: Request, config: CacheConfig): string {
    const parts: string[] = [];

    // 접두사 추가
    if (config.prefix) {
      parts.push(config.prefix);
    }

    // 버전 추가
    if (config.version !== undefined) {
      parts.push(`v${config.version}`);
    }

    // 사용자별 캐싱
    if (config.userSpecific) {
      const userId = request.user ? (request.user as any).id : 'anonymous';
      parts.push(`user:${userId}`);
    }

    // HTTP 메서드
    parts.push(request.method.toLowerCase());

    // URL 경로
    parts.push(this.normalizePath(request.path));

    // 쿼리 파라미터 처리
    if (config.includeQuery) {
      const queryKey = this.generateQueryKey(request.query, config.includeQuery);
      if (queryKey) {
        parts.push(`query:${queryKey}`);
      }
    }

    // 헤더 처리
    if (config.includeHeaders && config.includeHeaders.length > 0) {
      const headerKey = this.generateHeaderKey(request.headers, config.includeHeaders);
      if (headerKey) {
        parts.push(`headers:${headerKey}`);
      }
    }

    // 최종 키 생성
    const key = parts.join(':');
    
    // 키가 너무 길면 해시 처리
    if (key.length > 200) {
      const hash = this.hashKey(key);
      return `${parts[0]}:${parts[1]}:hash:${hash}`;
    }

    return key;
  }

  /**
   * 경로 정규화
   */
  private normalizePath(path: string): string {
    // 슬래시 중복 제거
    let normalized = path.replace(/\/+/g, '/');
    
    // 마지막 슬래시 제거
    if (normalized.length > 1 && normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1);
    }

    return normalized;
  }

  /**
   * 쿼리 파라미터 키 생성
   */
  private generateQueryKey(
    query: any,
    includeQuery: string[] | boolean,
  ): string {
    if (!query || Object.keys(query).length === 0) {
      return '';
    }

    let filteredQuery: any = {};

    if (includeQuery === true) {
      // 모든 쿼리 파라미터 포함
      filteredQuery = query;
    } else if (Array.isArray(includeQuery)) {
      // 특정 쿼리 파라미터만 포함
      includeQuery.forEach(key => {
        if (query[key] !== undefined) {
          filteredQuery[key] = query[key];
        }
      });
    }

    // 쿼리 파라미터 정렬 및 문자열화
    const sortedKeys = Object.keys(filteredQuery).sort();
    const queryParts = sortedKeys.map(key => {
      const value = Array.isArray(filteredQuery[key])
        ? filteredQuery[key].sort().join(',')
        : filteredQuery[key];
      return `${key}=${value}`;
    });

    return queryParts.join('&');
  }

  /**
   * 헤더 키 생성
   */
  private generateHeaderKey(
    headers: any,
    includeHeaders: string[],
  ): string {
    const headerParts: string[] = [];

    includeHeaders.forEach(headerName => {
      const value = headers[headerName.toLowerCase()];
      if (value) {
        headerParts.push(`${headerName}=${value}`);
      }
    });

    return headerParts.join('&');
  }

  /**
   * 키 해시 생성
   */
  private hashKey(key: string): string {
    return crypto
      .createHash('sha256')
      .update(key)
      .digest('hex')
      .substring(0, 16);
  }

  /**
   * 패턴 기반 캐시 키 생성 (무효화용)
   */
  generatePattern(pattern: string, params: Record<string, any> = {}): string {
    let result = pattern;

    // 파라미터 치환
    Object.entries(params).forEach(([key, value]) => {
      result = result.replace(`{${key}}`, value);
    });

    // 와일드카드 처리
    result = result.replace(/{[^}]+}/g, '*');

    return result;
  }

  /**
   * 대시보드 관련 캐시 키 생성
   */
  generateDashboardKey(dashboardId: number, type: string = 'metadata'): string {
    return `dashboard:${dashboardId}:${type}`;
  }

  /**
   * 데이터셋 관련 캐시 키 생성
   */
  generateDatasetKey(datasetId: number, queryHash?: string): string {
    const parts = ['dataset', datasetId];
    
    if (queryHash) {
      parts.push('query', queryHash);
    }

    return parts.join(':');
  }

  /**
   * 위젯 관련 캐시 키 생성
   */
  generateWidgetKey(dashboardId: number, widgetId: number): string {
    return `dashboard:${dashboardId}:widget:${widgetId}`;
  }

  /**
   * 사용자 관련 캐시 키 생성
   */
  generateUserKey(userId: number, resource: string): string {
    return `user:${userId}:${resource}`;
  }
}