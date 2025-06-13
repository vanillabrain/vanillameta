import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Request } from 'express';
import { FieldSelectionService, FieldSelectionOptions } from './field-selection.service';
import { FIELD_SELECTION_KEY } from './field-selection.decorator';

@Injectable()
export class FieldSelectionInterceptor implements NestInterceptor {
  private readonly logger = new Logger(FieldSelectionInterceptor.name);

  constructor(
    private readonly fieldSelectionService: FieldSelectionService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // 메타데이터에서 필드 선택 옵션 가져오기
    const fieldSelectionOptions = this.reflector.getAllAndOverride<FieldSelectionOptions>(
      FIELD_SELECTION_KEY,
      [context.getHandler(), context.getClass()],
    );

    // 필드 선택이 비활성화되어 있으면 원본 응답 반환
    if (!fieldSelectionOptions || fieldSelectionOptions.disabled) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();
    const fieldsParam = request.query.fields as string;

    // fields 쿼리 파라미터가 없으면 원본 응답 반환
    if (!fieldsParam) {
      return next.handle();
    }

    try {
      // 필드 파싱 및 유효성 검사
      const requestedFields = this.fieldSelectionService.parseFields(
        fieldsParam,
        fieldSelectionOptions,
      );

      if (requestedFields.length === 0) {
        this.logger.warn(`No valid fields found in: ${fieldsParam}`);
        return next.handle();
      }

      this.logger.debug(`Applying field selection: ${requestedFields.join(', ')}`);

      // 응답 데이터에 필드 선택 적용
      return next.handle().pipe(
        map(data => {
          if (!data) {
            return data;
          }

          const startTime = Date.now();
          const selectedData = this.fieldSelectionService.selectFields(data, requestedFields);
          const processingTime = Date.now() - startTime;

          // 성능 및 최적화 정보 로깅
          if (process.env.NODE_ENV !== 'prod') {
            const summary = this.fieldSelectionService.getFieldSelectionSummary(
              data,
              selectedData,
              requestedFields,
            );
            
            this.logger.debug(`Field selection applied`, {
              ...summary,
              processingTimeMs: processingTime,
              endpoint: `${request.method} ${request.path}`,
            });
          }

          return selectedData;
        }),
      );
    } catch (error) {
      this.logger.error(`Field selection failed: ${error.message}`, error.stack);
      // 에러 발생 시 원본 응답 반환 (graceful degradation)
      return next.handle();
    }
  }
}

/**
 * 요청 컨텍스트에서 필드 선택 정보를 추출하는 헬퍼 함수
 */
export function extractFieldSelectionFromRequest(request: Request): {
  fields: string[];
  hasFieldSelection: boolean;
} {
  const fieldsParam = request.query.fields as string;
  
  if (!fieldsParam) {
    return { fields: [], hasFieldSelection: false };
  }

  const fieldSelectionService = new FieldSelectionService();
  const fields = fieldSelectionService.parseFields(fieldsParam);
  
  return {
    fields,
    hasFieldSelection: fields.length > 0,
  };
}

/**
 * 응답 헤더에 필드 선택 정보를 추가하는 헬퍼 함수
 */
export function addFieldSelectionHeaders(
  response: any,
  originalSize: number,
  selectedSize: number,
  fields: string[],
): void {
  if (typeof response.header === 'function') {
    response.header('X-Field-Selection-Applied', 'true');
    response.header('X-Field-Selection-Fields', fields.join(','));
    response.header('X-Field-Selection-Reduction', 
      `${(((originalSize - selectedSize) / originalSize) * 100).toFixed(2)}%`);
    response.header('X-Original-Size', originalSize.toString());
    response.header('X-Selected-Size', selectedSize.toString());
  }
}