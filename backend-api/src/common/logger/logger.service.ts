import { Injectable, LoggerService, LogLevel } from '@nestjs/common';
import * as winston from 'winston';
import { CorrelationIdService } from '../../middleware/correlation-id/correlation-id.service';

export interface LogContext {
  userId?: string;
  correlationId?: string;
  requestPath?: string;
  method?: string;
  userAgent?: string;
  ip?: string;
  executionTime?: number;
  [key: string]: any;
}

@Injectable()
export class CustomLoggerService implements LoggerService {
  private readonly winston: winston.Logger;

  constructor() {
    const logLevel = this.getLogLevel();
    
    // JSON formatter for structured logging
    const jsonFormat = winston.format.combine(
      winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss.SSS'
      }),
      winston.format.errors({ stack: true }),
      winston.format.json(),
      winston.format.printf((info) => {
        const log: any = {
          timestamp: info.timestamp,
          level: info.level.toUpperCase(),
          message: info.message,
          context: info.context || 'Application'
        };

        // Add metadata if present
        if (info.metadata && typeof info.metadata === 'object') {
          Object.assign(log, info.metadata);
        }

        // Add error details if present
        if (info.stack) {
          log.stack = info.stack;
        }

        return JSON.stringify(log);
      })
    );

    this.winston = winston.createLogger({
      level: logLevel,
      format: jsonFormat,
      transports: [
        new winston.transports.Console({
          handleExceptions: true,
          handleRejections: true
        })
      ],
      exitOnError: false
    });
  }

  /**
   * 환경별 로그 레벨 결정
   */
  private getLogLevel(): string {
    const env = process.env.NODE_ENV || 'local';
    const logLevel = process.env.LOG_LEVEL;
    
    if (logLevel) {
      return logLevel.toLowerCase();
    }

    // 환경별 기본 로그 레벨
    switch (env) {
      case 'prod':
        return 'warn';
      case 'dev':
        return 'info';
      case 'local':
      default:
        return 'debug';
    }
  }

  /**
   * 로그 메타데이터 생성
   */
  private createMetadata(context?: string, metadata?: LogContext): any {
    const baseMetadata = {
      environment: process.env.NODE_ENV || 'local',
      service: 'vanillameta-backend',
      version: process.env.APP_VERSION || '1.0.0'
    };

    // 자동으로 현재 요청의 correlation ID 포함
    const correlationId = CorrelationIdService.getCorrelationId();
    if (correlationId) {
      baseMetadata['correlationId'] = correlationId;
    }

    if (context) {
      baseMetadata['context'] = context;
    }

    if (metadata) {
      Object.assign(baseMetadata, metadata);
    }

    return { metadata: baseMetadata };
  }

  /**
   * 순환 참조 방지를 위한 객체 안전 변환
   */
  private safeStringify(obj: any): any {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    try {
      return JSON.parse(JSON.stringify(obj));
    } catch (error) {
      return '[Circular Reference or Invalid Object]';
    }
  }

  log(message: any, context?: string): void {
    this.info(message, context);
  }

  info(message: any, context?: string, metadata?: LogContext): void {
    const safeMessage = typeof message === 'object' ? this.safeStringify(message) : message;
    this.winston.info(safeMessage, this.createMetadata(context, metadata));
  }

  error(message: any, stack?: string, context?: string, metadata?: LogContext): void {
    const safeMessage = typeof message === 'object' ? this.safeStringify(message) : message;
    const logData = this.createMetadata(context, metadata);
    
    if (stack) {
      logData.stack = stack;
    }

    this.winston.error(safeMessage, logData);
  }

  warn(message: any, context?: string, metadata?: LogContext): void {
    const safeMessage = typeof message === 'object' ? this.safeStringify(message) : message;
    this.winston.warn(safeMessage, this.createMetadata(context, metadata));
  }

  debug(message: any, context?: string, metadata?: LogContext): void {
    const safeMessage = typeof message === 'object' ? this.safeStringify(message) : message;
    this.winston.debug(safeMessage, this.createMetadata(context, metadata));
  }

  verbose(message: any, context?: string, metadata?: LogContext): void {
    const safeMessage = typeof message === 'object' ? this.safeStringify(message) : message;
    this.winston.verbose(safeMessage, this.createMetadata(context, metadata));
  }

  /**
   * HTTP 요청 로깅을 위한 특별한 메서드
   */
  logRequest(req: any, res?: any, executionTime?: number): void {
    const metadata: LogContext = {
      method: req.method,
      requestPath: req.path,
      userAgent: req.get('user-agent'),
      ip: req.ip || req.connection?.remoteAddress,
      correlationId: req.correlationId,
      userId: req.user?.userId || req.body?.userId
    };

    if (executionTime) {
      metadata.executionTime = executionTime;
    }

    if (res) {
      metadata.statusCode = res.statusCode;
      metadata.responseSize = res.get('content-length');
    }

    this.info(`${req.method} ${req.path}`, 'HTTP', metadata);
  }

  /**
   * 데이터베이스 쿼리 로깅
   */
  logQuery(query: string, params?: any[], executionTime?: number, context?: string): void {
    const metadata: LogContext = {
      query: query.length > 1000 ? query.substring(0, 1000) + '...' : query,
      queryParams: params ? this.safeStringify(params) : undefined,
      executionTime
    };

    this.debug('Database Query Executed', context || 'Database', metadata);
  }

  /**
   * 비즈니스 로직 관련 로깅
   */
  logBusiness(event: string, data?: any, userId?: string, context?: string): void {
    const metadata: LogContext = {
      event,
      userId,
      businessData: data ? this.safeStringify(data) : undefined
    };

    this.info(`Business Event: ${event}`, context || 'Business', metadata);
  }
}