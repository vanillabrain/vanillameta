import { BadRequestException } from '@nestjs/common';
import { CursorData } from './pagination.interface';

/**
 * 커서 인코딩/디코딩 유틸리티
 */
export class CursorUtils {
  /**
   * 커서 데이터를 Base64 문자열로 인코딩
   * @param cursorData 커서 데이터
   * @returns Base64 인코딩된 커서 문자열
   */
  static encodeCursor(cursorData: CursorData): string {
    try {
      const jsonString = JSON.stringify(cursorData);
      return Buffer.from(jsonString).toString('base64url');
    } catch (error) {
      throw new BadRequestException('커서 인코딩 실패');
    }
  }

  /**
   * Base64 커서 문자열을 디코딩
   * @param cursor Base64 인코딩된 커서 문자열
   * @returns 디코딩된 커서 데이터
   */
  static decodeCursor(cursor: string): CursorData {
    try {
      if (!cursor) {
        return null;
      }

      const jsonString = Buffer.from(cursor, 'base64url').toString('utf-8');
      const cursorData = JSON.parse(jsonString) as CursorData;

      // 필수 필드 검증
      if (!cursorData.id) {
        throw new Error('Invalid cursor: missing id');
      }

      return cursorData;
    } catch (error) {
      throw new BadRequestException('유효하지 않은 커서');
    }
  }

  /**
   * 엔티티에서 커서 생성
   * @param entity 엔티티 객체
   * @param sortField 정렬 필드명
   * @param additionalFields 추가로 포함할 필드들
   * @returns Base64 인코딩된 커서 문자열
   */
  static createCursorFromEntity(
    entity: any,
    sortField = 'id',
    additionalFields: string[] = [],
  ): string {
    if (!entity) {
      return null;
    }

    const cursorData: CursorData = {
      id: entity.id,
      sortValue: entity[sortField],
    };

    // 추가 필드가 있으면 메타데이터에 포함
    if (additionalFields.length > 0) {
      cursorData.metadata = {};
      additionalFields.forEach(field => {
        if (entity[field] !== undefined) {
          cursorData.metadata[field] = entity[field];
        }
      });
    }

    return CursorUtils.encodeCursor(cursorData);
  }

  /**
   * 여러 엔티티에서 다음/이전 커서 생성
   * @param entities 엔티티 배열
   * @param limit 페이지 크기
   * @param sortField 정렬 필드
   * @param sortDirection 정렬 방향
   * @returns 다음/이전 커서
   */
  static createCursorsFromEntities(
    entities: any[],
    limit: number,
    sortField = 'id',
    sortDirection: 'ASC' | 'DESC' = 'DESC',
  ): { nextCursor?: string; previousCursor?: string; hasNext: boolean; hasPrevious: boolean } {
    if (!entities || entities.length === 0) {
      return {
        hasNext: false,
        hasPrevious: false,
      };
    }

    // limit + 1개를 가져왔다면 다음 페이지가 있음
    const hasNext = entities.length > limit;
    const actualEntities = hasNext ? entities.slice(0, limit) : entities;

    // 정렬 방향에 따라 커서 생성
    const nextCursor = hasNext
      ? CursorUtils.createCursorFromEntity(
          actualEntities[actualEntities.length - 1],
          sortField,
        )
      : undefined;

    // 이전 페이지 커서는 첫 번째 엔티티 기준
    const previousCursor =
      actualEntities.length > 0
        ? CursorUtils.createCursorFromEntity(actualEntities[0], sortField)
        : undefined;

    return {
      nextCursor,
      previousCursor,
      hasNext,
      hasPrevious: false, // 이전 페이지 존재 여부는 별도 로직 필요
    };
  }

  /**
   * 커서 유효성 검증
   * @param cursor 커서 문자열
   * @param maxAge 최대 유효 시간 (초)
   * @returns 유효 여부
   */
  static validateCursor(cursor: string, maxAge?: number): boolean {
    try {
      const cursorData = CursorUtils.decodeCursor(cursor);
      
      if (!cursorData) {
        return false;
      }

      // 최대 유효 시간이 설정되어 있고, 타임스탬프가 있는 경우 검증
      if (maxAge && cursorData.metadata?.timestamp) {
        const cursorTime = new Date(cursorData.metadata.timestamp).getTime();
        const currentTime = new Date().getTime();
        const ageInSeconds = (currentTime - cursorTime) / 1000;

        if (ageInSeconds > maxAge) {
          return false;
        }
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * 커서 기반 WHERE 조건 생성
   * @param cursor 커서 문자열
   * @param sortField 정렬 필드
   * @param sortDirection 정렬 방향
   * @param alias 테이블 별칭
   * @returns WHERE 조건 객체
   */
  static buildCursorWhereClause(
    cursor: string,
    sortField = 'id',
    sortDirection: 'ASC' | 'DESC' = 'DESC',
    alias = '',
  ): { condition: string; parameters: Record<string, any> } {
    if (!cursor) {
      return { condition: '', parameters: {} };
    }

    const cursorData = CursorUtils.decodeCursor(cursor);
    const fieldPrefix = alias ? `${alias}.` : '';
    const operator = sortDirection === 'DESC' ? '<' : '>';

    // 복합 정렬 조건 생성
    if (cursorData.sortValue !== undefined && sortField !== 'id') {
      return {
        condition: `(${fieldPrefix}${sortField} ${operator} :sortValue OR (${fieldPrefix}${sortField} = :sortValue AND ${fieldPrefix}id ${operator} :cursorId))`,
        parameters: {
          sortValue: cursorData.sortValue,
          cursorId: cursorData.id,
        },
      };
    }

    // 단순 ID 기반 조건
    return {
      condition: `${fieldPrefix}id ${operator} :cursorId`,
      parameters: { cursorId: cursorData.id },
    };
  }
}