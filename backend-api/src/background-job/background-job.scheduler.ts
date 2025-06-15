import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BackgroundJobService } from './background-job.service';
import { CustomLoggerService as LoggerService } from '../common/logger/logger.service';

@Injectable()
export class BackgroundJobScheduler {
  constructor(
    private readonly backgroundJobService: BackgroundJobService,
    private readonly logger: LoggerService,
  ) {}

  // 매일 새벽 2시에 만료된 작업 결과 정리
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async cleanupExpiredResults() {
    try {
      this.logger.log('Starting cleanup of expired job results...');
      const cleanedCount = await this.backgroundJobService.cleanupExpiredResults();
      this.logger.log(`Cleanup completed. Removed ${cleanedCount} expired results.`);
    } catch (error) {
      this.logger.error('Failed to cleanup expired results', error.stack);
    }
  }

  // 30분마다 작업 상태 모니터링 (옵션)
  @Cron(CronExpression.EVERY_30_MINUTES)
  async monitorJobHealth() {
    try {
      // 장시간 처리 중인 작업 확인
      // 실패한 작업 재시도 트리거
      // 메트릭 수집 등
      this.logger.log('Job health monitoring completed');
    } catch (error) {
      this.logger.error('Failed to monitor job health', error.stack);
    }
  }
}
