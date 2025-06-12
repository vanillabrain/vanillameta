import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { CorrelationIdService } from './correlation-id.service';

// Request 객체 확장을 위한 인터페이스
export interface RequestWithCorrelationId extends Request {
  correlationId: string;
}

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: RequestWithCorrelationId, res: Response, next: NextFunction) {
    // 프론트엔드에서 전송한 Correlation ID가 있으면 사용, 없으면 새로 생성
    const correlationId = 
      req.headers['x-correlation-id'] as string || 
      req.headers['X-Correlation-ID'] as string ||
      uuidv4();

    // Request 객체에 correlation ID 저장
    req.correlationId = correlationId;

    // 응답 헤더에 correlation ID 추가
    res.setHeader('X-Correlation-ID', correlationId);

    // AsyncLocalStorage에 correlation ID 설정하여 전체 요청 생명주기에서 사용 가능하게 함
    CorrelationIdService.run(correlationId, () => {
      next();
    });
  }
}