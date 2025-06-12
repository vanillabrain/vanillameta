import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { CustomLoggerService } from '../common/logger/logger.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class LoggingMiddleware implements NestMiddleware {
  constructor(private readonly logger: CustomLoggerService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    // Correlation ID 생성 (요청 추적용)
    const correlationId = (req.headers['x-correlation-id'] as string) || uuidv4();
    req['correlationId'] = correlationId;
    res.setHeader('X-Correlation-ID', correlationId);

    const startTime = Date.now();

    // 요청 로깅
    this.logger.logRequest(req);

    // 응답 완료 시 로깅
    res.on('finish', () => {
      const executionTime = Date.now() - startTime;
      this.logger.logRequest(req, res, executionTime);
    });

    next();
  }
}
