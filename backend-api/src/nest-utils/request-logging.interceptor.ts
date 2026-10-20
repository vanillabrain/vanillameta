import { safeRouteTemplate } from '../common/utils/safe-route-template';
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const start = Date.now();
    return next.handle().pipe(
      tap({
        next: () => this.log(req, context, Date.now() - start),
        error: () => this.log(req, context, Date.now() - start),
      }),
    );
  }

  private log(req: any, context: ExecutionContext, durationMs: number) {
    const statusCode = context.switchToHttp().getResponse()?.statusCode;
    const userId = req.user?.id;
    console.log(
      JSON.stringify({
        level: 'info',
        msg: 'request',
        method: req.method,
        url: safeRouteTemplate(req),
        status: statusCode,
        durationMs,
        userId,
      }),
    );
  }
}
