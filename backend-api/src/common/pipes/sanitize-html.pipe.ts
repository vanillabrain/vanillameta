import { PipeTransform, Injectable, ArgumentMetadata } from '@nestjs/common';

@Injectable()
export class SanitizeHtmlPipe implements PipeTransform {
  transform(value: any, metadata: ArgumentMetadata) {
    // HTML 특수 문자를 이스케이프하는 함수
    const escapeHtml = (unsafe: string): string => {
      if (typeof unsafe !== 'string') return unsafe;
      
      return unsafe
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
        .replace(/\//g, '&#x2F;');
    };

    // 재귀적으로 객체의 모든 문자열 값을 이스케이프
    const sanitizeObject = (obj: any): any => {
      if (obj === null || obj === undefined) {
        return obj;
      }

      if (typeof obj === 'string') {
        return escapeHtml(obj);
      }

      if (Array.isArray(obj)) {
        return obj.map(item => sanitizeObject(item));
      }

      if (typeof obj === 'object') {
        const sanitized: any = {};
        for (const key in obj) {
          if (obj.hasOwnProperty(key)) {
            sanitized[key] = sanitizeObject(obj[key]);
          }
        }
        return sanitized;
      }

      return obj;
    };

    // body와 query 파라미터만 새니타이징
    if (metadata.type === 'body' || metadata.type === 'query') {
      return sanitizeObject(value);
    }

    return value;
  }
}