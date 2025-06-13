import { Injectable } from '@nestjs/common';
import { SelectQueryBuilder } from 'typeorm';
import {
  CursorPaginationOptions,
  OffsetPaginationOptions,
  PaginatedResponse,
  PaginationMeta,
  PaginationQueryOptions,
} from './pagination.interface';
import { CursorUtils } from './cursor.utils';

/**
 * 페이지네이션 서비스
 * TypeORM QueryBuilder와 통합하여 커서/오프셋 기반 페이지네이션 제공
 */
@Injectable()
export class PaginationService {
  /**
   * 커서 기반 페이지네이션 적용
   * @param queryBuilder TypeORM 쿼리 빌더
   * @param options 커서 페이지네이션 옵션
   * @param queryOptions 쿼리 옵션
   * @returns 페이지네이션된 결과
   */
  async paginateCursor<T>(
    queryBuilder: SelectQueryBuilder<T>,
    options: CursorPaginationOptions,
    queryOptions: PaginationQueryOptions = {},
  ): Promise<PaginatedResponse<T>> {
    const {
      alias,
      defaultSortField = 'id',
      defaultSortDirection = 'DESC',
      maxLimit = 100,
      defaultLimit = 20,
      includeTotalCount = false,
    } = queryOptions;

    // 옵션 정규화
    const limit = Math.min(options.limit || defaultLimit, maxLimit);
    const sortField = options.sortField || defaultSortField;
    const sortDirection = options.sortDirection || defaultSortDirection;

    // 쿼리 복사 (원본 쿼리 보존)
    const paginatedQuery = queryBuilder.clone();

    // 커서 기반 WHERE 조건 적용
    if (options.nextCursor) {
      const { condition, parameters } = CursorUtils.buildCursorWhereClause(
        options.nextCursor,
        sortField,
        sortDirection,
        alias,
      );
      if (condition) {
        paginatedQuery.andWhere(condition, parameters);
      }
    } else if (options.previousCursor) {
      // 이전 페이지의 경우 정렬 방향을 반대로
      const oppositeDirection = sortDirection === 'ASC' ? 'DESC' : 'ASC';
      const { condition, parameters } = CursorUtils.buildCursorWhereClause(
        options.previousCursor,
        sortField,
        oppositeDirection,
        alias,
      );
      if (condition) {
        paginatedQuery.andWhere(condition, parameters);
      }
    }

    // 정렬 적용
    const sortFieldWithAlias = alias ? `${alias}.${sortField}` : sortField;
    const idFieldWithAlias = alias ? `${alias}.id` : 'id';

    paginatedQuery.orderBy(sortFieldWithAlias, sortDirection);
    if (sortField !== 'id') {
      paginatedQuery.addOrderBy(idFieldWithAlias, sortDirection);
    }

    // limit + 1개를 가져와서 다음 페이지 존재 여부 확인
    paginatedQuery.take(limit + 1);

    // 쿼리 실행
    const entities = await paginatedQuery.getMany();

    // 이전 페이지 요청의 경우 결과를 뒤집음
    if (options.previousCursor && entities.length > 0) {
      entities.reverse();
    }

    // 커서 생성
    const { nextCursor, previousCursor, hasNext, hasPrevious } = CursorUtils.createCursorsFromEntities(
      entities,
      limit,
      sortField,
      sortDirection,
    );

    // 실제 반환할 데이터 (limit + 1에서 limit만큼만)
    const data = hasNext ? entities.slice(0, limit) : entities;

    // 전체 개수 조회 (선택적)
    let total: number;
    if (includeTotalCount) {
      total = await queryBuilder.clone().getCount();
    }

    // 이전 페이지 존재 여부 확인
    let actualHasPrevious = hasPrevious;
    if (options.nextCursor && data.length > 0 && !options.previousCursor) {
      // 첫 번째 아이템보다 이전 데이터가 있는지 확인
      const firstItem = data[0];
      const checkPreviousQuery = queryBuilder.clone();
      const oppositeDirection = sortDirection === 'ASC' ? 'DESC' : 'ASC';
      const { condition, parameters } = CursorUtils.buildCursorWhereClause(
        CursorUtils.createCursorFromEntity(firstItem, sortField),
        sortField,
        oppositeDirection,
        alias,
      );
      
      if (condition) {
        checkPreviousQuery.andWhere(condition, parameters);
        const previousCount = await checkPreviousQuery.take(1).getCount();
        actualHasPrevious = previousCount > 0;
      }
    }

    const meta: PaginationMeta = {
      hasNext,
      hasPrevious: actualHasPrevious,
      nextCursor,
      previousCursor: actualHasPrevious ? previousCursor : undefined,
      count: data.length,
      limit,
      total,
    };

    return { data, meta };
  }

  /**
   * 오프셋 기반 페이지네이션 적용
   * @param queryBuilder TypeORM 쿼리 빌더
   * @param options 오프셋 페이지네이션 옵션
   * @param queryOptions 쿼리 옵션
   * @returns 페이지네이션된 결과
   */
  async paginateOffset<T>(
    queryBuilder: SelectQueryBuilder<T>,
    options: OffsetPaginationOptions,
    queryOptions: PaginationQueryOptions = {},
  ): Promise<PaginatedResponse<T>> {
    const {
      alias,
      defaultSortField = 'id',
      defaultSortDirection = 'DESC',
      maxLimit = 100,
      defaultLimit = 20,
      includeTotalCount = true,
    } = queryOptions;

    // 옵션 정규화
    const page = Math.max(options.page || 1, 1);
    const limit = Math.min(options.limit || defaultLimit, maxLimit);
    const sortField = options.sortField || defaultSortField;
    const sortDirection = options.sortDirection || defaultSortDirection;

    // 쿼리 복사
    const paginatedQuery = queryBuilder.clone();

    // 정렬 적용
    const sortFieldWithAlias = alias ? `${alias}.${sortField}` : sortField;
    paginatedQuery.orderBy(sortFieldWithAlias, sortDirection);

    // 오프셋과 limit 적용
    const skip = (page - 1) * limit;
    paginatedQuery.skip(skip).take(limit);

    // 쿼리 실행
    const [data, total] = includeTotalCount
      ? await paginatedQuery.getManyAndCount()
      : [await paginatedQuery.getMany(), undefined];

    // 총 페이지 수 계산
    const totalPages = total ? Math.ceil(total / limit) : undefined;

    // 커서 생성 (오프셋 기반에서도 커서 제공)
    let nextCursor: string;
    let previousCursor: string;
    
    if (data.length > 0) {
      nextCursor = CursorUtils.createCursorFromEntity(data[data.length - 1], sortField);
      previousCursor = CursorUtils.createCursorFromEntity(data[0], sortField);
    }

    const meta: PaginationMeta = {
      hasNext: totalPages ? page < totalPages : data.length === limit,
      hasPrevious: page > 1,
      nextCursor: totalPages && page < totalPages ? nextCursor : undefined,
      previousCursor: page > 1 ? previousCursor : undefined,
      count: data.length,
      total,
      page,
      limit,
    };

    return { data, meta };
  }

  /**
   * 통합 페이지네이션 메서드
   * 옵션 타입에 따라 자동으로 커서/오프셋 기반 선택
   * @param queryBuilder TypeORM 쿼리 빌더
   * @param options 페이지네이션 옵션
   * @param queryOptions 쿼리 옵션
   * @returns 페이지네이션된 결과
   */
  async paginate<T>(
    queryBuilder: SelectQueryBuilder<T>,
    options: CursorPaginationOptions | OffsetPaginationOptions,
    queryOptions: PaginationQueryOptions = {},
  ): Promise<PaginatedResponse<T>> {
    // 커서 기반인지 확인
    const isCursorBased = 'nextCursor' in options || 'previousCursor' in options;

    if (isCursorBased) {
      return this.paginateCursor(queryBuilder, options as CursorPaginationOptions, queryOptions);
    } else {
      return this.paginateOffset(queryBuilder, options as OffsetPaginationOptions, queryOptions);
    }
  }

  /**
   * 간단한 배열 페이지네이션
   * 메모리에 있는 배열을 페이지네이션
   * @param items 전체 아이템 배열
   * @param options 페이지네이션 옵션
   * @returns 페이지네이션된 결과
   */
  paginateArray<T>(
    items: T[],
    options: OffsetPaginationOptions,
  ): PaginatedResponse<T> {
    const page = Math.max(options.page || 1, 1);
    const limit = Math.max(options.limit || 20, 1);
    const skip = (page - 1) * limit;
    
    const data = items.slice(skip, skip + limit);
    const total = items.length;
    const totalPages = Math.ceil(total / limit);

    const meta: PaginationMeta = {
      hasNext: page < totalPages,
      hasPrevious: page > 1,
      count: data.length,
      total,
      page,
      limit,
    };

    return { data, meta };
  }
}