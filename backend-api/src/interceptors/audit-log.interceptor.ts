import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';
import { AuditLogService } from '../modules/audit/audit-log.service';
import { AuditConfig } from '../decorators/audit.decorator';
import { AuditLogLevel } from '../entities/audit-log.entity';

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
            category: auditConfig.category,
            level: AuditLogLevel.INFO,
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
            category: auditConfig.category,
            level: AuditLogLevel.ERROR,
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
    } = logData;

    const details: any = {
      method: request.method,
      url: request.url,
      duration,
      success,
    };

    if (request.body && Object.keys(request.body).length > 0) {
      details.requestBody = this.sanitizeData(request.body);
    }

    if (request.params && Object.keys(request.params).length > 0) {
      details.params = request.params;
    }

    if (response && typeof response === 'object') {
      details.responseSize = JSON.stringify(response).length;
    }

    if (error) {
      details.error = {
        message: error.message,
        statusCode: error.status || 500,
      };
    }

    this.auditLogService.log({
      action,
      resourceType,
      resourceId: request.params?.id,
      userId: user?.id,
      userName: user?.name,
      userEmail: user?.email,
      details,
      category,
      level,
      isSystem: false,
    });
  }

  private sanitizeData(data: any): any {
    const sanitized = { ...data };
    
    // 민감한 정보 제거
    const sensitiveFields = ['password', 'token', 'secret', 'key'];
    
    Object.keys(sanitized).forEach(key => {
      if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
        sanitized[key] = '[REDACTED]';
      }
    });

    return sanitized;
  }
}