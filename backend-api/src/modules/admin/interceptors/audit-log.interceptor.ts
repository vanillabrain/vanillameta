import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditLogService } from '../audit-log.service';
import { AuditLogLevel, AuditLogCategory } from '../entities/audit-log.entity';
import { AuditConfig } from '../decorators/audit.decorator';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(
    private auditLogService: AuditLogService,
    private reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const auditConfig = this.reflector.get<AuditConfig>('audit', context.getHandler());
    
    if (!auditConfig) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const { user, body, params, query } = request;

    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: (response) => {
          this.logAction({
            action: auditConfig.action,
            user,
            request,
            response,
            success: true,
            duration: Date.now() - startTime,
            resourceType: auditConfig.resourceType,
            category: auditConfig.category || AuditLogCategory.GENERAL,
            level: AuditLogLevel.INFO,
            extractResourceId: auditConfig.extractResourceId,
          });
        },
        error: (error) => {
          this.logAction({
            action: `${auditConfig.action}_FAILED`,
            user,
            request,
            error,
            success: false,
            duration: Date.now() - startTime,
            resourceType: auditConfig.resourceType,
            category: auditConfig.category || AuditLogCategory.GENERAL,
            level: AuditLogLevel.ERROR,
            extractResourceId: auditConfig.extractResourceId,
          });
        },
      }),
    );
  }

  private logAction(logData: any): void {
    const {
      action,
      user,
      request,
      response,
      error,
      success,
      duration,
      resourceType,
      category,
      level,
      extractResourceId,
    } = logData;

    const details: any = {
      method: request.method,
      url: request.url,
      duration,
      success,
    };

    // 요청 본문 추가 (민감한 정보 제거)
    if (request.body && Object.keys(request.body).length > 0) {
      details.requestBody = this.sanitizeData(request.body);
    }

    // 파라미터 추가
    if (request.params && Object.keys(request.params).length > 0) {
      details.params = request.params;
    }

    // 쿼리 파라미터 추가
    if (request.query && Object.keys(request.query).length > 0) {
      details.query = request.query;
    }

    // 응답 크기 추가
    if (response && typeof response === 'object') {
      details.responseSize = JSON.stringify(response).length;
    }

    // 에러 정보 추가
    if (error) {
      details.error = {
        message: error.message,
        statusCode: error.status || 500,
      };
    }

    // 리소스 ID 추출
    let resourceId = request.params?.id;
    if (extractResourceId && typeof extractResourceId === 'function') {
      resourceId = extractResourceId(request, response);
    }

    // 감사 로그 생성
    this.auditLogService.log({
      action,
      resourceType,
      resourceId,
      userId: user?.id,
      userName: user?.name,
      userEmail: user?.email,
      details,
      category,
      level,
      isSystem: false,
      ipAddress: this.extractClientIp(request),
      userAgent: request.headers['user-agent'],
    });
  }

  private sanitizeData(data: any): any {
    const sanitized = { ...data };
    
    // 민감한 정보 제거
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'apiKey', 'accessToken', 'refreshToken'];
    
    Object.keys(sanitized).forEach(key => {
      if (sensitiveFields.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
        sanitized[key] = '[REDACTED]';
      }
    });

    return sanitized;
  }

  private extractClientIp(request: any): string {
    const forwarded = request.headers['x-forwarded-for'];
    if (forwarded) {
      return forwarded.toString().split(',')[0].trim();
    }
    return request.socket?.remoteAddress || 'unknown';
  }
}