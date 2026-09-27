import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Observable } from 'rxjs';
import { catchError, concatMap } from 'rxjs/operators';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';

const MUTATING_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

/**
 * 쓰기 요청을 감사 로그로 기록한다.
 * 저장은 응답 직전에 완료되어(concatMap) 로그 순서가 보장된다.
 * 감사 로그 저장 실패가 본 요청을 막아서는 안 된다.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    @InjectRepository(AuditLog) private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    if (!MUTATING_METHODS.includes(request.method)) {
      return next.handle();
    }

    const response = context.switchToHttp().getResponse();
    const record = (statusCode?: number) =>
      this.save({
        actorId: request.user?.accessKeyData?.id ?? null,
        actorUserId: request.user?.accessKeyData?.userId ?? null,
        method: request.method,
        path: request.originalUrl || request.url,
        action: `${request.method} ${request.route?.path ?? request.path}`,
        statusCode: statusCode ?? null,
        ip: request.ip,
      });

    return next.handle().pipe(
      concatMap(async data => {
        await record(response.statusCode);
        return data;
      }),
      catchError(async error => {
        const status =
          typeof error?.getStatus === 'function'
            ? error.getStatus()
            : error?.status ?? response.statusCode ?? 500;
        await record(status);
        throw error;
      }),
    );
  }

  private async save(entry: Partial<AuditLog>): Promise<void> {
    try {
      await this.auditLogRepository.save(entry);
    } catch (error) {
      this.logger.error(`failed to write audit log: ${error?.message ?? error}`);
    }
  }
}
