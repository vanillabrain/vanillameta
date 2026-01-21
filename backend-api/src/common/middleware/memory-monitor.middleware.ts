import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { BusinessMetricsService } from '../monitoring/business-metrics.service';

@Injectable()
export class MemoryMonitorMiddleware implements NestMiddleware {
  private readonly logger = new Logger(MemoryMonitorMiddleware.name);
  private lastMemoryCheck = 0;
  private readonly checkInterval = 60000; // 1분마다 체크

  constructor(private readonly businessMetrics: BusinessMetricsService) {
    // Lambda 콜드스타트 감지 및 기록
    this.detectAndRecordColdStart();
  }

  async use(req: Request, res: Response, next: NextFunction) {
    // 주기적으로 메모리 사용률 체크
    const now = Date.now();
    if (now - this.lastMemoryCheck > this.checkInterval) {
      this.lastMemoryCheck = now;
      await this.recordMemoryUsage();
    }

    next();
  }

  private async recordMemoryUsage(): Promise<void> {
    try {
      const memoryUsage = process.memoryUsage();
      const maxMemory = parseInt(process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE || '1024', 10) * 1024 * 1024;

      // 메모리 사용률 기록
      await this.businessMetrics.recordMemoryUsage(memoryUsage.heapUsed, maxMemory);

      // 높은 메모리 사용률 경고
      const utilizationPercent = (memoryUsage.heapUsed / maxMemory) * 100;
      if (utilizationPercent > 85) {
        this.logger.warn('High memory utilization detected', {
          utilizationPercent: utilizationPercent.toFixed(2),
          heapUsed: (memoryUsage.heapUsed / 1024 / 1024).toFixed(2) + 'MB',
          maxMemory: (maxMemory / 1024 / 1024).toFixed(2) + 'MB',
        });
      }

      this.logger.debug('Memory usage recorded', {
        heapUsed: (memoryUsage.heapUsed / 1024 / 1024).toFixed(2) + 'MB',
        heapTotal: (memoryUsage.heapTotal / 1024 / 1024).toFixed(2) + 'MB',
        external: (memoryUsage.external / 1024 / 1024).toFixed(2) + 'MB',
        utilizationPercent: utilizationPercent.toFixed(2) + '%',
      });
    } catch (error) {
      this.logger.error('Failed to record memory usage', error);
    }
  }

  private async detectAndRecordColdStart(): Promise<void> {
    // Lambda 환경 변수로 콜드스타트 감지
    const isColdStart = !global['__lambda_warm__'];
    
    if (isColdStart && process.env.AWS_LAMBDA_FUNCTION_NAME) {
      const startTime = parseInt(process.env.LAMBDA_INIT_START_TIME || '0', 10);
      const currentTime = Date.now();
      
      if (startTime > 0) {
        const coldStartDuration = currentTime - startTime;
        
        this.logger.log('Lambda cold start detected', {
          duration: coldStartDuration + 'ms',
          functionName: process.env.AWS_LAMBDA_FUNCTION_NAME,
        });

        await this.businessMetrics.recordLambdaColdStart(coldStartDuration);
      }
      
      // 웜 상태로 표시
      global['__lambda_warm__'] = true;
    }
  }
}