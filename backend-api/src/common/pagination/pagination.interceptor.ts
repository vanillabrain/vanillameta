import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { PaginatedResponse } from './pagination.interface';

/**
 * 페이지네이션 응답 인터셉터
 * 
 * 페이지네이션된 응답을 표준 형식으로 변환합니다.
 * 
 * @example
 * ```typescript
 * @UseInterceptors(PaginationInterceptor)
 * @Get()
 * async findAll(@CursorPagination() pagination: CursorPaginationOptions) {
 *   return this.service.findAll(pagination);
 * }
 * ```
 */
@Injectable()
export class PaginationInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map(response => {
        // 이미 PaginatedResponse 형식인 경우 그대로 반환
        if (this.isPaginatedResponse(response)) {
          return response;
        }

        // 레거시 응답 형식 변환
        if (this.isLegacyPaginatedResponse(response)) {
          return this.transformLegacyResponse(response);
        }

        // 배열인 경우 기본 페이지네이션 래핑
        if (Array.isArray(response)) {
          return this.wrapArrayResponse(response);
        }

        // 그 외의 경우 그대로 반환
        return response;
      }),
    );
  }

  /**
   * PaginatedResponse 타입인지 확인
   */
  private isPaginatedResponse(response: any): response is PaginatedResponse<any> {
    return (
      response &&
      typeof response === 'object' &&
      'data' in response &&
      'meta' in response &&
      typeof response.meta === 'object' &&
      'hasNext' in response.meta &&
      'hasPrevious' in response.meta
    );
  }

  /**
   * 레거시 페이지네이션 응답인지 확인
   */
  private isLegacyPaginatedResponse(response: any): boolean {
    return (
      response &&
      typeof response === 'object' &&
      'data' in response &&
      ('total' in response || 'page' in response || 'limit' in response)
    );
  }

  /**
   * 레거시 응답을 표준 형식으로 변환
   */
  private transformLegacyResponse(response: any): PaginatedResponse<any> {
    const { data, total, page, limit, ...rest } = response;

    const totalPages = total && limit ? Math.ceil(total / limit) : undefined;
    const hasNext = page && totalPages ? page < totalPages : false;
    const hasPrevious = page ? page > 1 : false;

    return {
      data: data || [],
      meta: {
        hasNext,
        hasPrevious,
        count: Array.isArray(data) ? data.length : 0,
        total,
        page,
        limit: limit || 20,
        ...rest, // 추가 메타데이터 보존
      },
    };
  }

  /**
   * 배열 응답을 기본 페이지네이션 형식으로 래핑
   */
  private wrapArrayResponse(data: any[]): PaginatedResponse<any> {
    return {
      data,
      meta: {
        hasNext: false,
        hasPrevious: false,
        count: data.length,
        limit: data.length,
      },
    };
  }
}

/**
 * 페이지네이션 변환 인터셉터
 * 
 * 서비스에서 반환된 데이터를 자동으로 페이지네이션 형식으로 변환합니다.
 * 
 * @example
 * ```typescript
 * @UseInterceptors(new PaginationTransformInterceptor({ defaultLimit: 50 }))
 * @Get()
 * async findAll() {
 *   return this.repository.find(); // 자동으로 페이지네이션 적용
 * }
 * ```
 */
@Injectable()
export class PaginationTransformInterceptor implements NestInterceptor {
  constructor(
    private readonly options: {
      defaultLimit?: number;
      maxLimit?: number;
      includeTotalCount?: boolean;
    } = {},
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { page = 1, limit = this.options.defaultLimit || 20 } = request.query;

    const pageNum = Math.max(parseInt(page) || 1, 1);
    const limitNum = Math.min(
      Math.max(parseInt(limit) || this.options.defaultLimit || 20, 1),
      this.options.maxLimit || 100,
    );

    return next.handle().pipe(
      map(data => {
        // 배열이 아닌 경우 그대로 반환
        if (!Array.isArray(data)) {
          return data;
        }

        // 배열을 페이지네이션
        const start = (pageNum - 1) * limitNum;
        const end = start + limitNum;
        const paginatedData = data.slice(start, end);
        const total = data.length;
        const totalPages = Math.ceil(total / limitNum);

        return {
          data: paginatedData,
          meta: {
            hasNext: pageNum < totalPages,
            hasPrevious: pageNum > 1,
            count: paginatedData.length,
            total: this.options.includeTotalCount !== false ? total : undefined,
            page: pageNum,
            limit: limitNum,
          },
        };
      }),
    );
  }
}