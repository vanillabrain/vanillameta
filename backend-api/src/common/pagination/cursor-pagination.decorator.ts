import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import {
  CursorPaginationOptions,
  OffsetPaginationOptions,
  PaginationType,
} from './pagination.interface';

/**
 * 커서 기반 페이지네이션 파라미터 데코레이터
 *
 * @example
 * ```typescript
 * @Get()
 * async findAll(@CursorPagination() pagination: CursorPaginationOptions) {
 *   return this.service.findAll(pagination);
 * }
 * ```
 */
export const CursorPagination = createParamDecorator(
  (
    options: { maxLimit?: number; defaultLimit?: number } = {},
    ctx: ExecutionContext,
  ): CursorPaginationOptions => {
    const request = ctx.switchToHttp().getRequest();
    const query = request.query;

    const maxLimit = options.maxLimit || 100;
    const defaultLimit = options.defaultLimit || 20;

    // limit 파싱 및 검증
    let limit = parseInt(query.limit) || defaultLimit;
    limit = Math.min(limit, maxLimit);
    limit = Math.max(limit, 1);

    // 정렬 옵션
    const sortDirection = (query.sortDirection?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC') as
      | 'ASC'
      | 'DESC';
    const sortField = query.sortField || 'id';

    return {
      limit,
      nextCursor: query.nextCursor || query.cursor,
      previousCursor: query.previousCursor,
      sortDirection,
      sortField,
    };
  },
);

/**
 * 오프셋 기반 페이지네이션 파라미터 데코레이터 (하위 호환성)
 *
 * @example
 * ```typescript
 * @Get()
 * async findAll(@OffsetPagination() pagination: OffsetPaginationOptions) {
 *   return this.service.findAll(pagination);
 * }
 * ```
 */
export const OffsetPagination = createParamDecorator(
  (
    options: { maxLimit?: number; defaultLimit?: number } = {},
    ctx: ExecutionContext,
  ): OffsetPaginationOptions => {
    const request = ctx.switchToHttp().getRequest();
    const query = request.query;

    const maxLimit = options.maxLimit || 100;
    const defaultLimit = options.defaultLimit || 20;

    // 페이지와 limit 파싱
    const page = Math.max(parseInt(query.page) || 1, 1);
    let limit = parseInt(query.limit) || parseInt(query.pageSize) || defaultLimit;
    limit = Math.min(limit, maxLimit);
    limit = Math.max(limit, 1);

    // 정렬 옵션
    const sortDirection = (query.sortDirection?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC') as
      | 'ASC'
      | 'DESC';
    const sortField = query.sortField || query.orderBy || 'id';

    return {
      page,
      limit,
      sortDirection,
      sortField,
    };
  },
);

/**
 * 통합 페이지네이션 데코레이터
 * 커서와 오프셋 기반 페이지네이션을 자동으로 감지하여 처리
 *
 * @example
 * ```typescript
 * @Get()
 * async findAll(@Pagination() pagination: CursorPaginationOptions | OffsetPaginationOptions) {
 *   return this.service.findAll(pagination);
 * }
 * ```
 */
export const Pagination = createParamDecorator(
  (
    options: {
      type?: PaginationType;
      maxLimit?: number;
      defaultLimit?: number;
      preferCursor?: boolean;
    } = {},
    ctx: ExecutionContext,
  ): CursorPaginationOptions | OffsetPaginationOptions => {
    const request = ctx.switchToHttp().getRequest();
    const query = request.query;

    // CursorPagination과 OffsetPagination 팩토리 함수 직접 호출
    const cursorFactory = (CursorPagination as any)();
    const offsetFactory = (OffsetPagination as any)();

    // 명시적 타입 지정이 있으면 해당 타입 사용
    if (options.type === PaginationType.CURSOR) {
      return cursorFactory(options, ctx);
    }
    if (options.type === PaginationType.OFFSET) {
      return offsetFactory(options, ctx);
    }

    // 자동 감지: 커서가 있으면 커서 기반, 페이지가 있으면 오프셋 기반
    const hasCursor = query.nextCursor || query.previousCursor || query.cursor;
    const hasPage = query.page;

    // preferCursor 옵션이 true이고 둘 다 없으면 커서 기반 사용
    if (options.preferCursor && !hasPage) {
      return cursorFactory(options, ctx);
    }

    // 커서가 있으면 커서 기반 사용
    if (hasCursor) {
      return cursorFactory(options, ctx);
    }

    // 기본값은 오프셋 기반 (하위 호환성)
    return offsetFactory(options, ctx);
  },
);
