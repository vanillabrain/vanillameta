import { Injectable, Logger } from '@nestjs/common';
import { EventBridge } from 'aws-sdk';
import { CloudWatchMetricsService } from '../common/monitoring/cloudwatch-metrics.service';
import { CustomLoggerService } from '../common/logger/logger.service';
import { BusinessMetricsService } from '../common/monitoring/business-metrics.service';
import { 
  CollectEventsDto, 
  AnalyticsEventDto, 
  EventAction, 
  EventCategory 
} from './dto/analytics-event.dto';

interface EnrichedEvent extends AnalyticsEventDto {
  sessionId: string;
  correlationId?: string;
  userId?: string;
  isAnonymous?: boolean;
  metadata?: any;
  serverTimestamp: string;
}

interface EventProcessingResult {
  processed: number;
  failed: number;
  errors: string[];
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);
  private eventBridge: EventBridge;
  private eventBuffer: EnrichedEvent[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private readonly BATCH_SIZE = 50;
  private readonly FLUSH_INTERVAL = 10000; // 10초

  constructor(
    private readonly cloudWatchMetrics: CloudWatchMetricsService,
    private readonly customLogger: CustomLoggerService,
    private readonly businessMetrics: BusinessMetricsService,
  ) {
    this.eventBridge = new EventBridge({
      region: process.env.AWS_REGION || 'ap-northeast-2',
    });
    this.startBatchProcessor();
  }

  /**
   * 이벤트 수집
   */
  async collectEvents(params: CollectEventsDto & {
    sessionId: string;
    correlationId?: string;
    userId?: string;
    isAnonymous?: boolean;
  }): Promise<void> {
    const { events, metadata, sessionId, correlationId, userId, isAnonymous } = params;
    
    try {
      // 이벤트 검증 및 보강
      const enrichedEvents = events.map(event => this.enrichEvent(event, {
        sessionId,
        correlationId,
        userId,
        isAnonymous,
        metadata,
      }));

      // 버퍼에 추가
      this.eventBuffer.push(...enrichedEvents);

      // 실시간 메트릭 업데이트
      await this.updateRealTimeMetrics(enrichedEvents);

      // 비즈니스 메트릭 업데이트
      await this.updateBusinessMetrics(enrichedEvents);

      // 배치 크기 도달 시 즉시 처리
      if (this.eventBuffer.length >= this.BATCH_SIZE) {
        await this.flushEvents();
      }

      this.customLogger.debug('Events collected', 'AnalyticsService', {
        eventCount: events.length,
        sessionId,
        userId: userId ? 'USER_***' : null,
      });
    } catch (error) {
      this.logger.error('Failed to collect events:', error);
      throw error;
    }
  }

  /**
   * 페이지뷰 추적
   */
  async trackPageView(params: {
    path: string;
    title?: string;
    referrer?: string;
    sessionId: string;
    userId?: string;
  }): Promise<void> {
    const event: AnalyticsEventDto = {
      action: EventAction.DASHBOARD_VIEWED,
      category: EventCategory.USER,
      data: {
        timestamp: new Date().toISOString(),
        sessionId: params.sessionId,
        userId: params.userId,
        properties: {
          path: params.path,
          title: params.title,
          referrer: params.referrer,
        },
      },
    };

    await this.collectEvents({
      events: [event],
      metadata: {} as any,
      sessionId: params.sessionId,
      userId: params.userId,
    });
  }

  /**
   * 성능 메트릭 수집
   */
  async collectPerformanceMetrics(params: {
    metrics: Array<{
      name: string;
      value: number;
      unit: string;
      tags?: Record<string, string>;
    }>;
    sessionId: string;
  }): Promise<void> {
    try {
      // CloudWatch 커스텀 메트릭으로 전송
      for (const metric of params.metrics) {
        await this.cloudWatchMetrics.putMetric(
          metric.name,
          metric.value,
          metric.unit as any,
          Object.entries(metric.tags || {}).map(([Name, Value]) => ({ Name, Value })),
        );
      }

      // 성능 이벤트로도 기록
      const events = params.metrics.map(metric => ({
        action: EventAction.PAGE_LOAD_TIME,
        category: EventCategory.PERFORMANCE,
        data: {
          timestamp: new Date().toISOString(),
          sessionId: params.sessionId,
          properties: metric,
        },
      }));

      await this.collectEvents({
        events,
        metadata: {} as any,
        sessionId: params.sessionId,
      });
    } catch (error) {
      this.logger.error('Failed to collect performance metrics:', error);
    }
  }

  /**
   * 이벤트 보강
   */
  private enrichEvent(
    event: AnalyticsEventDto, 
    context: {
      sessionId: string;
      correlationId?: string;
      userId?: string;
      isAnonymous?: boolean;
      metadata?: any;
    }
  ): EnrichedEvent {
    return {
      ...event,
      sessionId: context.sessionId,
      correlationId: context.correlationId,
      userId: context.userId,
      isAnonymous: context.isAnonymous || false,
      metadata: context.metadata,
      serverTimestamp: new Date().toISOString(),
      data: {
        ...event.data,
        sessionId: context.sessionId,
        userId: context.userId,
        correlationId: context.correlationId,
      },
    };
  }

  /**
   * 실시간 메트릭 업데이트
   */
  private async updateRealTimeMetrics(events: EnrichedEvent[]): Promise<void> {
    try {
      // 이벤트 카테고리별 카운트
      const categoryCounts = new Map<string, number>();
      events.forEach(event => {
        const count = categoryCounts.get(event.category) || 0;
        categoryCounts.set(event.category, count + 1);
      });

      // CloudWatch 메트릭 전송
      for (const [category, count] of categoryCounts) {
        await this.cloudWatchMetrics.putMetric(
          'UserEvents',
          count,
          'Count',
          [{ Name: 'Category', Value: category }],
        );
      }

      // 활성 사용자 추적
      const uniqueUsers = new Set(events.filter(e => e.userId).map(e => e.userId));
      if (uniqueUsers.size > 0) {
        await this.cloudWatchMetrics.putMetric(
          'ActiveUsers',
          uniqueUsers.size,
          'Count',
          [{ Name: 'Type', Value: 'Realtime' }],
        );
      }
    } catch (error) {
      this.logger.error('Failed to update real-time metrics:', error);
    }
  }

  /**
   * 비즈니스 메트릭 업데이트
   */
  private async updateBusinessMetrics(events: EnrichedEvent[]): Promise<void> {
    try {
      for (const event of events) {
        if (!event.userId) continue;

        // 사용자 활동 기록
        await this.businessMetrics.recordUserActivity(
          event.userId,
          event.action,
          event.category,
          event.data.properties,
        );

        // 특정 이벤트별 비즈니스 메트릭
        switch (event.action) {
          case EventAction.DASHBOARD_CREATED:
            await this.businessMetrics.recordDashboardCreation(
              event.data.properties?.templateUsed || 'custom',
            );
            break;

          case EventAction.WIDGET_CREATED:
            await this.businessMetrics.recordWidgetUsage(
              event.data.properties?.widgetType || 'unknown',
              event.data.properties?.chartType || 'unknown',
            );
            break;

          case EventAction.QUERY_EXECUTED:
          case EventAction.QUERY_FAILED:
            const success = event.action === EventAction.QUERY_EXECUTED;
            if (event.data.properties?.queryDuration) {
              await this.businessMetrics.recordQueryPerformance(
                event.data.properties.databaseId || 'unknown',
                event.data.properties.queryType || 'SELECT',
                event.data.properties.queryDuration,
                event.data.properties.rowCount || 0,
              );
            }
            break;
        }
      }
    } catch (error) {
      this.logger.error('Failed to update business metrics:', error);
    }
  }

  /**
   * 배치 처리 시작
   */
  private startBatchProcessor(): void {
    this.flushTimer = setInterval(() => {
      if (this.eventBuffer.length > 0) {
        this.flushEvents().catch(error => {
          this.logger.error('Batch processor error:', error);
        });
      }
    }, this.FLUSH_INTERVAL);
  }

  /**
   * 이벤트 플러시
   */
  private async flushEvents(): Promise<void> {
    if (this.eventBuffer.length === 0) return;

    const events = [...this.eventBuffer];
    this.eventBuffer = [];

    try {
      // EventBridge로 전송
      await this.sendToEventBridge(events);

      // S3에 백업 (대용량 이벤트)
      if (events.length > 100) {
        await this.backupToS3(events);
      }

      this.customLogger.info('Events flushed', 'AnalyticsService', {
        eventCount: events.length,
      });
    } catch (error) {
      this.logger.error('Failed to flush events:', error);
      // 실패한 이벤트는 다시 버퍼에 추가
      this.eventBuffer.unshift(...events);
    }
  }

  /**
   * EventBridge로 이벤트 전송
   */
  private async sendToEventBridge(events: EnrichedEvent[]): Promise<void> {
    const eventBusName = process.env.EVENT_BUS_NAME || 'default';
    
    // EventBridge는 한 번에 10개 이벤트만 전송 가능
    const chunks = this.chunkArray(events, 10);
    
    for (const chunk of chunks) {
      const entries = chunk.map(event => ({
        Source: 'vanillameta.analytics',
        DetailType: `${event.category}.${event.action}`,
        Detail: JSON.stringify({
          ...event,
          environment: process.env.NODE_ENV,
        }),
        EventBusName: eventBusName,
      }));

      try {
        const result = await this.eventBridge.putEvents({ Entries: entries }).promise();
        
        if (result.FailedEntryCount && result.FailedEntryCount > 0) {
          this.logger.error('Some events failed to send to EventBridge:', result.Entries);
        }
      } catch (error) {
        this.logger.error('Failed to send events to EventBridge:', error);
        throw error;
      }
    }
  }

  /**
   * S3 백업
   */
  private async backupToS3(events: EnrichedEvent[]): Promise<void> {
    // S3 백업 로직 구현
    // 실제 구현 시 AWS S3 SDK 사용
    this.logger.log(`Would backup ${events.length} events to S3`);
  }

  /**
   * 배열 청크 분할
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * 서비스 종료 시 정리
   */
  async onModuleDestroy(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    
    // 남은 이벤트 플러시
    await this.flushEvents();
  }
}