/**
 * 페이지네이션 관련 인터페이스 정의
 */

/**
 * 커서 기반 페이지네이션 옵션
 */
export interface CursorPaginationOptions {
  /** 페이지 크기 (기본값: 20) */
  limit?: number;
  /** 다음 페이지 커서 */
  nextCursor?: string;
  /** 이전 페이지 커서 */
  previousCursor?: string;
  /** 정렬 방향 (기본값: DESC) */
  sortDirection?: 'ASC' | 'DESC';
  /** 정렬 필드 (기본값: id) */
  sortField?: string;
}

/**
 * 오프셋 기반 페이지네이션 옵션 (하위 호환성)
 */
export interface OffsetPaginationOptions {
  /** 페이지 번호 (1부터 시작) */
  page?: number;
  /** 페이지 크기 */
  limit?: number;
  /** 정렬 방향 */
  sortDirection?: 'ASC' | 'DESC';
  /** 정렬 필드 */
  sortField?: string;
}

/**
 * 커서 데이터 구조
 */
export interface CursorData {
  /** 주요 식별자 (보통 id) */
  id: number | string;
  /** 정렬 기준 값 (예: createdAt, updatedAt) */
  sortValue?: any;
  /** 추가 메타데이터 */
  metadata?: Record<string, any>;
}

/**
 * 페이지네이션 응답 메타데이터
 */
export interface PaginationMeta {
  /** 다음 페이지 존재 여부 */
  hasNext: boolean;
  /** 이전 페이지 존재 여부 */
  hasPrevious: boolean;
  /** 다음 페이지 커서 */
  nextCursor?: string;
  /** 이전 페이지 커서 */
  previousCursor?: string;
  /** 현재 페이지 아이템 수 */
  count: number;
  /** 전체 아이템 수 (선택적, 성능상 제공하지 않을 수 있음) */
  total?: number;
  /** 현재 페이지 번호 (오프셋 기반 호환용) */
  page?: number;
  /** 페이지 크기 */
  limit: number;
}

/**
 * 페이지네이션 응답 구조
 */
export interface PaginatedResponse<T> {
  /** 데이터 배열 */
  data: T[];
  /** 페이지네이션 메타데이터 */
  meta: PaginationMeta;
}

/**
 * 페이지네이션 쿼리 빌더 옵션
 */
export interface PaginationQueryOptions {
  /** 엔티티 별칭 */
  alias?: string;
  /** 기본 정렬 필드 */
  defaultSortField?: string;
  /** 기본 정렬 방향 */
  defaultSortDirection?: 'ASC' | 'DESC';
  /** 최대 페이지 크기 */
  maxLimit?: number;
  /** 기본 페이지 크기 */
  defaultLimit?: number;
  /** 커서에 포함할 필드들 */
  cursorFields?: string[];
  /** 전체 개수 포함 여부 */
  includeTotalCount?: boolean;
}

/**
 * 페이지네이션 타입 열거형
 */
export enum PaginationType {
  CURSOR = 'cursor',
  OFFSET = 'offset',
}

/**
 * 페이지네이션 설정
 */
export interface PaginationConfig {
  /** 사용할 페이지네이션 타입 */
  type?: PaginationType;
  /** 최대 페이지 크기 */
  maxLimit?: number;
  /** 기본 페이지 크기 */
  defaultLimit?: number;
  /** 커서 암호화 활성화 여부 */
  encryptCursor?: boolean;
  /** 커서 만료 시간 (초) */
  cursorTTL?: number;
}
