import { Injectable } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { EventDataDto } from './dto/create-event.dto';

/**
 * 서버사이드에서 이벤트를 추적하기 위한 헬퍼 클래스
 */
@Injectable()
export class AnalyticsHelper {
  constructor(private readonly analyticsService: AnalyticsService) {}

  /**
   * 데이터베이스 연결 이벤트 추적
   */
  async trackDatabaseConnection(
    userId: string,
    databaseType: string,
    success: boolean,
    connectionId?: string,
    correlationId?: string,
  ) {
    const event: EventDataDto = {
      category: 'data',
      action: 'database_connected',
      label: databaseType,
      value: success ? 1 : 0,
      metadata: {
        databaseType,
        success,
        connectionId,
      },
    };

    await this.analyticsService.collectEvents([event], {
      userId,
      correlationId,
      userAgent: 'Server-Side',
      ipAddress: 'Internal',
    });
  }

  /**
   * 쿼리 실행 이벤트 추적
   */
  async trackQueryExecution(
    userId: string,
    datasetId: string,
    executionTime: number,
    rowCount?: number,
    correlationId?: string,
  ) {
    const event: EventDataDto = {
      category: 'data',
      action: 'query_executed',
      label: datasetId,
      value: executionTime,
      metadata: {
        datasetId,
        executionTime,
        rowCount,
      },
    };

    await this.analyticsService.collectEvents([event], {
      userId,
      correlationId,
      userAgent: 'Server-Side',
      ipAddress: 'Internal',
    });
  }

  /**
   * API 에러 이벤트 추적
   */
  async trackApiError(
    userId: string | undefined,
    endpoint: string,
    statusCode: number,
    errorMessage: string,
    correlationId?: string,
  ) {
    const event: EventDataDto = {
      category: 'error',
      action: 'api_error',
      label: `${statusCode} - ${endpoint}`,
      value: statusCode,
      metadata: {
        endpoint,
        statusCode,
        errorMessage,
      },
    };

    await this.analyticsService.collectEvents([event], {
      userId,
      correlationId,
      userAgent: 'Server-Side',
      ipAddress: 'Internal',
    });
  }

  /**
   * 백그라운드 작업 이벤트 추적
   */
  async trackBackgroundJob(
    jobName: string,
    status: 'started' | 'completed' | 'failed',
    duration?: number,
    metadata?: Record<string, any>,
  ) {
    const event: EventDataDto = {
      category: 'background_job',
      action: `job_${status}`,
      label: jobName,
      value: duration,
      metadata: {
        jobName,
        status,
        duration,
        ...metadata,
      },
    };

    await this.analyticsService.collectEvents([event], {
      userAgent: 'Server-Side',
      ipAddress: 'Internal',
    });
  }

  /**
   * 대시보드 접근 권한 이벤트 추적
   */
  async trackDashboardAccess(
    userId: string,
    dashboardId: string,
    action: 'granted' | 'denied',
    reason?: string,
    correlationId?: string,
  ) {
    const event: EventDataDto = {
      category: 'security',
      action: `access_${action}`,
      label: dashboardId,
      metadata: {
        dashboardId,
        reason,
      },
    };

    await this.analyticsService.collectEvents([event], {
      userId,
      correlationId,
      userAgent: 'Server-Side',
      ipAddress: 'Internal',
    });
  }

  /**
   * 성능 메트릭 이벤트 추적
   */
  async trackPerformanceMetric(metricName: string, value: number, metadata?: Record<string, any>) {
    const event: EventDataDto = {
      category: 'performance',
      action: metricName,
      value: Math.round(value),
      metadata: {
        metricName,
        value,
        ...metadata,
      },
    };

    await this.analyticsService.collectEvents([event], {
      userAgent: 'Server-Side',
      ipAddress: 'Internal',
    });
  }

  /**
   * 배치 이벤트 추적
   */
  async trackBatchEvents(events: EventDataDto[], userId?: string, correlationId?: string) {
    await this.analyticsService.collectEvents(events, {
      userId,
      correlationId,
      userAgent: 'Server-Side',
      ipAddress: 'Internal',
    });
  }
}
