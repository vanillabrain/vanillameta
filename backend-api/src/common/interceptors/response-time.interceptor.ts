import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { CloudWatchMetricsService } from '../monitoring/cloudwatch-metrics.service';

@Injectable()
export class ResponseTimeInterceptor implements NestInterceptor {
  constructor(
    private readonly cloudWatchMetrics: CloudWatchMetricsService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const startTime = Date.now();
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    return next.handle().pipe(
      tap(async () => {
        const responseTime = Date.now() - startTime;
        const path = request.route?.path || request.url;
        const method = request.method;
        const statusCode = response.statusCode;

        // CloudWatch 메트릭 기록
        try {
          await this.cloudWatchMetrics.recordApiResponseTime(
            path,
            method,
            responseTime,
            statusCode,
          );
        } catch (error) {
          // 메트릭 전송 실패가 요청 처리를 방해하지 않도록 함
          console.error('Failed to record response time metric:', error);
        }
      }),
    );
  }
}