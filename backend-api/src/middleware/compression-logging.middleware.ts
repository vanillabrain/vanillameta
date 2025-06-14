import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { CustomLoggerService } from '../common/logger/logger.service';

@Injectable()
export class CompressionLoggingMiddleware implements NestMiddleware {
  constructor(private readonly logger: CustomLoggerService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    // 원본 응답 크기를 추적하기 위한 버퍼
    const originalWrite = res.write;
    const originalEnd = res.end;
    let responseBody = Buffer.from('');

    // logger 참조를 클로저로 유지
    const logger = this.logger;

    // write 메서드 오버라이드
    res.write = function (chunk: any, ...args: any[]): boolean {
      if (chunk) {
        responseBody = Buffer.concat([responseBody, Buffer.from(chunk)]);
      }
      return originalWrite.apply(res, [chunk, ...args]);
    };

    // end 메서드 오버라이드
    res.end = function (chunk: any, ...args: any[]): Response<any, Record<string, any>> {
      if (chunk) {
        responseBody = Buffer.concat([responseBody, Buffer.from(chunk)]);
      }

      // 압축 전 크기
      const uncompressedSize = responseBody.length;

      // 응답 완료 시 압축 정보 로깅
      res.on('finish', () => {
        const contentEncoding = res.getHeader('content-encoding') as string;
        const compressedSize = parseInt(res.getHeader('content-length') as string) || 0;

        // 압축이 적용된 경우에만 로깅
        if (contentEncoding && contentEncoding.includes('gzip')) {
          const compressionRatio =
            uncompressedSize > 0
              ? (((uncompressedSize - compressedSize) / uncompressedSize) * 100).toFixed(2)
              : '0';

          logger.info('Response compression applied', 'CompressionMiddleware', {
            method: req.method,
            path: req.path,
            contentType: res.getHeader('content-type') as string,
            encoding: contentEncoding,
            uncompressedSize,
            compressedSize,
            compressionRatio: `${compressionRatio}%`,
            saved: uncompressedSize - compressedSize,
          });
        } else if (uncompressedSize >= 1024) {
          // 1KB 이상인데 압축되지 않은 경우 디버그 로그
          logger.debug('Response not compressed', 'CompressionMiddleware', {
            method: req.method,
            path: req.path,
            contentType: res.getHeader('content-type') as string,
            size: uncompressedSize,
            reason: 'Check content-type or client Accept-Encoding header',
          });
        }
      });

      return originalEnd.apply(res, [chunk, ...args]);
    };

    next();
  }
}
