import { ApiResponseOptions } from '@nestjs/swagger';
import { HttpStatus } from '@nestjs/common';

// 공통 성공 응답
export const ApiSuccessResponse = (description: string): ApiResponseOptions => ({
  status: HttpStatus.OK,
  description,
  schema: {
    properties: {
      success: { type: 'boolean', example: true },
      message: { type: 'string', example: 'success' },
      data: { type: 'object' }
    }
  }
});

// 페이지네이션 응답
export const ApiPaginatedResponse = (itemType: any): ApiResponseOptions => ({
  status: HttpStatus.OK,
  description: '페이지네이션된 결과',
  schema: {
    properties: {
      success: { type: 'boolean', example: true },
      data: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: { $ref: `#/components/schemas/${itemType.name}` }
          },
          total: { type: 'number', example: 100 },
          page: { type: 'number', example: 1 },
          pageSize: { type: 'number', example: 20 },
          totalPages: { type: 'number', example: 5 }
        }
      }
    }
  }
});

// 공통 에러 응답 스키마
export const ErrorResponseSchema = {
  properties: {
    success: { type: 'boolean', example: false },
    error: {
      type: 'object',
      properties: {
        code: { type: 'string', example: 'INVALID_REQUEST' },
        message: { type: 'string', example: '잘못된 요청입니다.' },
        details: { type: 'object' }
      }
    },
    timestamp: { type: 'string', format: 'date-time', example: new Date().toISOString() },
    path: { type: 'string', example: '/v1/users/123' }
  }
};

// 공통 에러 응답 데코레이터
export const ApiErrorResponses = () => {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    const responses = {
      [HttpStatus.BAD_REQUEST]: {
        description: '잘못된 요청',
        schema: ErrorResponseSchema
      },
      [HttpStatus.UNAUTHORIZED]: {
        description: '인증 실패',
        schema: ErrorResponseSchema
      },
      [HttpStatus.FORBIDDEN]: {
        description: '권한 없음',
        schema: ErrorResponseSchema
      },
      [HttpStatus.NOT_FOUND]: {
        description: '리소스를 찾을 수 없음',
        schema: ErrorResponseSchema
      },
      [HttpStatus.INTERNAL_SERVER_ERROR]: {
        description: '서버 오류',
        schema: ErrorResponseSchema
      }
    };

    // 기존 메타데이터에 추가
    Reflect.defineMetadata('swagger/apiResponse', responses, target, propertyKey);
    
    return descriptor;
  };
};