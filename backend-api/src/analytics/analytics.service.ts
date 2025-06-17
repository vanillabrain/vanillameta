import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AnalyticsEvent } from './entities/analytics-event.entity';
import { EventDataDto } from './dto/create-event.dto';
import { CustomLoggerService } from '../common/logger/logger.service';
const UAParser = require('ua-parser-js');

interface EventContext {
  userId?: string;
  correlationId?: string;
  userAgent?: string;
  ipAddress?: string;
}

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(AnalyticsEvent)
    private analyticsEventRepository: Repository<AnalyticsEvent>,
    private readonly logger: CustomLoggerService,
  ) {}

  async collectEvents(events: EventDataDto[], context: EventContext): Promise<void> {
    try {
      const analyticsEvents = events.map(event => this.createAnalyticsEvent(event, context));
      
      // 배치 삽입으로 성능 최적화
      await this.analyticsEventRepository
        .createQueryBuilder()
        .insert()
        .into(AnalyticsEvent)
        .values(analyticsEvents)
        .execute();

      this.logger.info(`수집된 이벤트 수: ${events.length}`, 'AnalyticsService', {
        userId: context.userId,
        correlationId: context.correlationId,
        eventCount: events.length,
        categories: [...new Set(events.map(e => e.category))],
      });
    } catch (error) {
      this.logger.error('이벤트 수집 실패', error.stack, 'AnalyticsService', {
        userId: context.userId,
        correlationId: context.correlationId,
        error: error.message,
      });
      // 이벤트 수집 실패는 사용자에게 에러를 반환하지 않음
    }
  }

  private createAnalyticsEvent(event: EventDataDto, context: EventContext): Partial<AnalyticsEvent> {
    const { metadata = {} } = event;
    const userAgentData = this.parseUserAgent(context.userAgent);

    return {
      category: event.category,
      action: event.action,
      label: event.label,
      value: event.value,
      userId: context.userId || metadata.userId,
      sessionId: metadata.sessionId || 'unknown',
      correlationId: context.correlationId,
      metadata: this.sanitizeMetadata(metadata),
      userAgent: context.userAgent,
      screenResolution: metadata.screenResolution,
      viewport: metadata.viewport,
      url: metadata.url,
      referrer: metadata.referrer,
      ipAddress: this.anonymizeIp(context.ipAddress),
      eventTimestamp: metadata.timestamp ? new Date(metadata.timestamp) : new Date(),
      ...userAgentData,
    };
  }

  private parseUserAgent(userAgent?: string): Partial<AnalyticsEvent> {
    if (!userAgent) return {};

    try {
      const parser = new UAParser(userAgent);
      const result = parser.getResult();

      return {
        browser: result.browser.name,
        browserVersion: result.browser.version,
        os: result.os.name,
        osVersion: result.os.version,
        device: result.device.type || 'desktop',
      };
    } catch (error) {
      this.logger.warn('User-Agent 파싱 실패', 'AnalyticsService', {
        userAgent,
        error: error.message,
      });
      return {};
    }
  }

  private sanitizeMetadata(metadata: Record<string, any>): Record<string, any> {
    // 민감한 정보 제거
    const sensitiveKeys = ['password', 'token', 'secret', 'apikey', 'creditcard'];
    const sanitized = { ...metadata };

    Object.keys(sanitized).forEach(key => {
      if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive.toLowerCase()))) {
        sanitized[key] = '[REDACTED]';
      }
    });

    // 메타데이터 크기 제한 (10KB)
    const jsonString = JSON.stringify(sanitized);
    if (jsonString.length > 10240) {
      return { truncated: true, originalSize: jsonString.length };
    }

    return sanitized;
  }

  private anonymizeIp(ip?: string): string | undefined {
    if (!ip) return undefined;

    // IPv4 주소의 마지막 옥텟 제거
    if (ip.includes('.')) {
      const parts = ip.split('.');
      if (parts.length === 4) {
        parts[3] = '0';
        return parts.join('.');
      }
    }

    // IPv6 주소의 하위 64비트 제거
    if (ip.includes(':')) {
      const parts = ip.split(':');
      if (parts.length >= 4) {
        return parts.slice(0, 4).join(':') + '::';
      }
    }

    return ip;
  }

  // 분석 쿼리 메서드들
  async getUserEvents(userId: string, startDate?: Date, endDate?: Date): Promise<AnalyticsEvent[]> {
    const query = this.analyticsEventRepository
      .createQueryBuilder('event')
      .where('event.userId = :userId', { userId });

    if (startDate) {
      query.andWhere('event.createdAt >= :startDate', { startDate });
    }

    if (endDate) {
      query.andWhere('event.createdAt <= :endDate', { endDate });
    }

    return query.orderBy('event.createdAt', 'DESC').getMany();
  }

  async getEventStats(startDate: Date, endDate: Date): Promise<any> {
    const result = await this.analyticsEventRepository
      .createQueryBuilder('event')
      .select('event.category', 'category')
      .addSelect('event.action', 'action')
      .addSelect('COUNT(*)', 'count')
      .addSelect('COUNT(DISTINCT event.userId)', 'uniqueUsers')
      .addSelect('COUNT(DISTINCT event.sessionId)', 'uniqueSessions')
      .where('event.createdAt BETWEEN :startDate AND :endDate', { startDate, endDate })
      .groupBy('event.category')
      .addGroupBy('event.action')
      .orderBy('count', 'DESC')
      .getRawMany();

    return result;
  }

  async getUserJourney(sessionId: string): Promise<AnalyticsEvent[]> {
    return this.analyticsEventRepository
      .createQueryBuilder('event')
      .where('event.sessionId = :sessionId', { sessionId })
      .orderBy('event.eventTimestamp', 'ASC')
      .getMany();
  }

  async getPopularFeatures(limit: number = 10): Promise<any> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30); // 최근 30일

    return this.analyticsEventRepository
      .createQueryBuilder('event')
      .select('event.category', 'category')
      .addSelect('event.action', 'action')
      .addSelect('COUNT(*)', 'usageCount')
      .addSelect('COUNT(DISTINCT event.userId)', 'uniqueUsers')
      .where('event.createdAt BETWEEN :startDate AND :endDate', { startDate, endDate })
      .andWhere('event.category NOT IN (:...excludedCategories)', { 
        excludedCategories: ['performance', 'error'] 
      })
      .groupBy('event.category')
      .addGroupBy('event.action')
      .orderBy('usageCount', 'DESC')
      .limit(limit)
      .getRawMany();
  }

  async getErrorRate(startDate: Date, endDate: Date): Promise<any> {
    const [totalEvents, errorEvents] = await Promise.all([
      this.analyticsEventRepository
        .createQueryBuilder('event')
        .where('event.createdAt BETWEEN :startDate AND :endDate', { startDate, endDate })
        .getCount(),
      
      this.analyticsEventRepository
        .createQueryBuilder('event')
        .where('event.createdAt BETWEEN :startDate AND :endDate', { startDate, endDate })
        .andWhere('event.category = :category', { category: 'error' })
        .getCount(),
    ]);

    return {
      totalEvents,
      errorEvents,
      errorRate: totalEvents > 0 ? (errorEvents / totalEvents * 100).toFixed(2) : 0,
    };
  }

  async getPerformanceMetrics(startDate: Date, endDate: Date): Promise<any> {
    return this.analyticsEventRepository
      .createQueryBuilder('event')
      .select('event.action', 'metric')
      .addSelect('AVG(event.value)', 'avgValue')
      .addSelect('MIN(event.value)', 'minValue')
      .addSelect('MAX(event.value)', 'maxValue')
      .addSelect('COUNT(*)', 'count')
      .where('event.createdAt BETWEEN :startDate AND :endDate', { startDate, endDate })
      .andWhere('event.category = :category', { category: 'performance' })
      .andWhere('event.value IS NOT NULL')
      .groupBy('event.action')
      .getRawMany();
  }
}