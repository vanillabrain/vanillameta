import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import { AnalyticsEvent } from './entities/analytics-event.entity';
import { EventSession } from './entities/event-session.entity';
import { PerformanceMetric } from './entities/performance-metric.entity';
import { TrackEventDto } from './dto/track-event.dto';
import { TrackMetricDto } from './dto/track-metric.dto';
import { AnalyticsQueryDto, TimeRange } from './dto/analytics-query.dto';
import { CustomLoggerService } from '../common/logger/logger.service';
import { UAParser } from 'ua-parser-js';

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    @InjectRepository(AnalyticsEvent)
    private analyticsEventRepository: Repository<AnalyticsEvent>,
    @InjectRepository(EventSession)
    private eventSessionRepository: Repository<EventSession>,
    @InjectRepository(PerformanceMetric)
    private performanceMetricRepository: Repository<PerformanceMetric>,
    private customLogger: CustomLoggerService,
  ) {}

  async trackEvents(
    trackEventDto: TrackEventDto,
    clientIp: string,
    userAgent: string,
  ): Promise<void> {
    try {
      const { events, sessionInfo } = trackEventDto;

      // IP 익명화 (마지막 옥텟 제거)
      const anonymizedIp = this.anonymizeIp(clientIp);

      // User-Agent 파싱
      const uaParser = new UAParser(userAgent);
      const uaResult = uaParser.getResult();

      // 세션 정보 업데이트 또는 생성
      if (sessionInfo) {
        await this.upsertSession(sessionInfo, anonymizedIp, uaResult);
      }

      // 이벤트 저장
      const eventEntities = events.map(event => {
        const eventEntity = this.analyticsEventRepository.create({
          action: event.action,
          category: event.category,
          label: event.label,
          value: event.value,
          userId: event.properties?.userId,
          sessionId: event.properties?.sessionId || sessionInfo?.sessionId,
          correlationId: event.properties?.correlationId,
          properties: this.sanitizeProperties(event.properties),
          userProperties: this.sanitizeUserProperties(event.userProperties),
          anonymizedIp,
          userAgent,
          pageUrl: event.properties?.url,
          referrer: event.properties?.referrer,
        });

        return eventEntity;
      });

      await this.analyticsEventRepository.save(eventEntities);

      this.logger.log(`Tracked ${events.length} events`);
    } catch (error) {
      this.logger.error('Failed to track events', error);
      // 에러 발생 시에도 프론트엔드에 영향을 주지 않도록 에러를 던지지 않음
    }
  }

  async trackMetrics(trackMetricDto: TrackMetricDto, userAgent: string): Promise<void> {
    try {
      const { metrics } = trackMetricDto;

      // User-Agent 파싱
      const uaParser = new UAParser(userAgent);
      const uaResult = uaParser.getResult();

      const metricEntities = metrics.map(metric => {
        return this.performanceMetricRepository.create({
          name: metric.name,
          value: metric.value,
          category: metric.category,
          tags: metric.tags,
          deviceType: uaResult.device.type || 'desktop',
        });
      });

      await this.performanceMetricRepository.save(metricEntities);

      this.logger.log(`Tracked ${metrics.length} performance metrics`);
    } catch (error) {
      this.logger.error('Failed to track metrics', error);
    }
  }

  async getAnalyticsSummary(query: AnalyticsQueryDto, userId?: string) {
    const dateRange = this.getDateRange(query);

    const [
      totalEvents,
      uniqueUsers,
      totalSessions,
      avgSessionDuration,
      topEvents,
      eventsByCategory,
    ] = await Promise.all([
      // 총 이벤트 수
      this.analyticsEventRepository.count({
        where: {
          createdAt: Between(dateRange.start, dateRange.end),
          ...(userId && { userId }),
        },
      }),

      // 고유 사용자 수
      this.analyticsEventRepository
        .createQueryBuilder('event')
        .select('COUNT(DISTINCT event.userId)', 'count')
        .where('event.createdAt BETWEEN :start AND :end', dateRange)
        .andWhere(userId ? 'event.userId = :userId' : '1=1', { userId })
        .getRawOne()
        .then(result => result.count),

      // 총 세션 수
      this.eventSessionRepository.count({
        where: {
          startTime: Between(dateRange.start, dateRange.end),
          ...(userId && { userId }),
        },
      }),

      // 평균 세션 시간
      this.eventSessionRepository
        .createQueryBuilder('session')
        .select('AVG(TIMESTAMPDIFF(SECOND, session.startTime, session.lastActivityTime))', 'avg')
        .where('session.startTime BETWEEN :start AND :end', dateRange)
        .andWhere(userId ? 'session.userId = :userId' : '1=1', { userId })
        .getRawOne()
        .then(result => result.avg || 0),

      // 상위 이벤트
      this.getTopEvents(dateRange, userId, 10),

      // 카테고리별 이벤트
      this.getEventsByCategory(dateRange, userId),
    ]);

    return {
      totalEvents,
      uniqueUsers: parseInt(uniqueUsers),
      totalSessions,
      avgSessionDuration: Math.round(avgSessionDuration),
      topEvents,
      eventsByCategory,
      dateRange,
    };
  }

  async getEvents(query: AnalyticsQueryDto, userId?: string) {
    const dateRange = this.getDateRange(query);
    const where: any = {
      createdAt: Between(dateRange.start, dateRange.end),
    };

    if (userId) where.userId = userId;
    if (query.category) where.category = query.category;
    if (query.action) where.action = query.action;
    if (query.sessionId) where.sessionId = query.sessionId;

    const [events, total] = await this.analyticsEventRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      take: query.limit,
      skip: query.offset,
      relations: ['session'],
    });

    return {
      events,
      total,
      limit: query.limit,
      offset: query.offset,
    };
  }

  async getMetrics(query: AnalyticsQueryDto, userId?: string) {
    const dateRange = this.getDateRange(query);
    const where: any = {
      createdAt: Between(dateRange.start, dateRange.end),
    };

    if (userId) where.userId = userId;
    if (query.category) where.category = query.category;

    const metrics = await this.performanceMetricRepository
      .createQueryBuilder('metric')
      .select([
        'metric.name',
        'metric.category',
        'AVG(metric.value) as avg',
        'MIN(metric.value) as min',
        'MAX(metric.value) as max',
        'COUNT(*) as count',
      ])
      .where('metric.createdAt BETWEEN :start AND :end', dateRange)
      .andWhere(userId ? 'metric.userId = :userId' : '1=1', { userId })
      .groupBy('metric.name, metric.category')
      .getRawMany();

    return metrics;
  }

  async getFunnelAnalysis(steps: string[], query: AnalyticsQueryDto, userId?: string) {
    const dateRange = this.getDateRange(query);

    // 각 단계별 사용자 수 계산
    const funnelData = await Promise.all(
      steps.map(async (step, index) => {
        const previousSteps = steps.slice(0, index);

        const queryBuilder = this.analyticsEventRepository
          .createQueryBuilder('event')
          .select('COUNT(DISTINCT event.userId)', 'count')
          .where('event.action = :action', { action: step })
          .andWhere('event.createdAt BETWEEN :start AND :end', dateRange);

        if (userId) {
          queryBuilder.andWhere('event.userId = :userId', { userId });
        }

        // 이전 단계들을 모두 거친 사용자만 카운트
        if (previousSteps.length > 0) {
          queryBuilder.andWhere(
            `event.userId IN (
              SELECT DISTINCT e2.userId 
              FROM analytics_events e2 
              WHERE e2.action IN (:...previousSteps)
              AND e2.createdAt BETWEEN :start AND :end
              GROUP BY e2.userId
              HAVING COUNT(DISTINCT e2.action) = :stepCount
            )`,
            { previousSteps, stepCount: previousSteps.length },
          );
        }

        const result = await queryBuilder.getRawOne();

        return {
          step,
          users: parseInt(result.count),
          index,
        };
      }),
    );

    // 전환율 계산
    const funnelWithConversion = funnelData.map((data, index) => ({
      ...data,
      conversionRate:
        index === 0 ? 100 : funnelData[0].users > 0 ? (data.users / funnelData[0].users) * 100 : 0,
      dropOffRate:
        index === 0
          ? 0
          : funnelData[index - 1].users > 0
          ? ((funnelData[index - 1].users - data.users) / funnelData[index - 1].users) * 100
          : 0,
    }));

    return {
      funnel: funnelWithConversion,
      dateRange,
    };
  }

  async getRetentionAnalysis(query: AnalyticsQueryDto, userId?: string) {
    const dateRange = this.getDateRange(query);
    const cohortSize = 7; // 7일 단위 코호트

    // 코호트별 리텐션 계산
    const retentionData = [];
    const startDate = new Date(dateRange.start);
    const endDate = new Date(dateRange.end);

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + cohortSize)) {
      const cohortStart = new Date(d);
      const cohortEnd = new Date(d);
      cohortEnd.setDate(cohortEnd.getDate() + cohortSize - 1);

      // 코호트 기간 동안 처음 활동한 사용자
      const cohortUsers = await this.analyticsEventRepository
        .createQueryBuilder('event')
        .select('DISTINCT event.userId', 'userId')
        .where('event.createdAt BETWEEN :start AND :end', {
          start: cohortStart,
          end: cohortEnd,
        })
        .andWhere(userId ? 'event.userId = :userId' : '1=1', { userId })
        .getRawMany();

      const cohortUserIds = cohortUsers.map(u => u.userId);

      // 이후 기간별 리텐션 계산
      const retentionPeriods = [];
      for (let period = 0; period <= 4; period++) {
        const periodStart = new Date(cohortEnd);
        periodStart.setDate(periodStart.getDate() + period * 7 + 1);
        const periodEnd = new Date(periodStart);
        periodEnd.setDate(periodEnd.getDate() + 6);

        if (periodEnd > new Date()) break;

        const activeUsers = await this.analyticsEventRepository
          .createQueryBuilder('event')
          .select('COUNT(DISTINCT event.userId)', 'count')
          .where('event.userId IN (:...userIds)', { userIds: cohortUserIds })
          .andWhere('event.createdAt BETWEEN :start AND :end', {
            start: periodStart,
            end: periodEnd,
          })
          .getRawOne();

        retentionPeriods.push({
          period: `Week ${period + 1}`,
          activeUsers: parseInt(activeUsers.count),
          retentionRate:
            cohortUserIds.length > 0
              ? (parseInt(activeUsers.count) / cohortUserIds.length) * 100
              : 0,
        });
      }

      retentionData.push({
        cohort: cohortStart.toISOString().split('T')[0],
        totalUsers: cohortUserIds.length,
        retention: retentionPeriods,
      });
    }

    return {
      retention: retentionData,
      dateRange,
    };
  }

  async getUserFlow(query: AnalyticsQueryDto, userId?: string) {
    const dateRange = this.getDateRange(query);

    // 사용자별 이벤트 시퀀스 가져오기
    const userFlows = await this.analyticsEventRepository
      .createQueryBuilder('event')
      .select([
        'event.sessionId',
        'event.userId',
        'event.action',
        'event.category',
        'event.createdAt',
      ])
      .where('event.createdAt BETWEEN :start AND :end', dateRange)
      .andWhere(userId ? 'event.userId = :userId' : '1=1', { userId })
      .orderBy('event.userId', 'ASC')
      .addOrderBy('event.createdAt', 'ASC')
      .limit(1000)
      .getMany();

    // 플로우 패턴 분석
    const flowPatterns = new Map<string, number>();
    const userSessions = new Map<string, typeof userFlows>();

    // 사용자별로 이벤트 그룹화
    userFlows.forEach(event => {
      const key = `${event.userId}-${event.sessionId}`;
      if (!userSessions.has(key)) {
        userSessions.set(key, []);
      }
      userSessions.get(key)!.push(event);
    });

    // 패턴 추출
    userSessions.forEach(events => {
      for (let i = 0; i < events.length - 1; i++) {
        const pattern = `${events[i].action} → ${events[i + 1].action}`;
        flowPatterns.set(pattern, (flowPatterns.get(pattern) || 0) + 1);
      }
    });

    // 상위 패턴 정렬
    const topPatterns = Array.from(flowPatterns.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([pattern, count]) => ({ pattern, count }));

    return {
      topPatterns,
      totalSessions: userSessions.size,
      dateRange,
    };
  }

  private async upsertSession(sessionInfo: any, anonymizedIp: string, uaResult: any) {
    const existingSession = await this.eventSessionRepository.findOne({
      where: { sessionId: sessionInfo.sessionId },
    });

    if (existingSession) {
      existingSession.lastActivityTime = new Date(sessionInfo.lastActivityTime);
      existingSession.pageViews = sessionInfo.pageViews;
      existingSession.eventCount = sessionInfo.eventCount;
      await this.eventSessionRepository.save(existingSession);
    } else {
      const newSession = this.eventSessionRepository.create({
        sessionId: sessionInfo.sessionId,
        startTime: new Date(sessionInfo.startTime),
        lastActivityTime: new Date(sessionInfo.lastActivityTime),
        pageViews: sessionInfo.pageViews,
        eventCount: sessionInfo.eventCount,
        anonymizedIp,
        userAgent: uaResult.ua,
        deviceType: uaResult.device.type || 'desktop',
        browser: uaResult.browser.name,
        os: uaResult.os.name,
      });
      await this.eventSessionRepository.save(newSession);
    }
  }

  private anonymizeIp(ip: string): string {
    // IPv4 주소의 마지막 옥텟을 0으로 변경
    if (ip.includes('.')) {
      const parts = ip.split('.');
      if (parts.length === 4) {
        parts[3] = '0';
        return parts.join('.');
      }
    }
    // IPv6 주소의 마지막 부분 익명화
    else if (ip.includes(':')) {
      const parts = ip.split(':');
      if (parts.length > 1) {
        parts[parts.length - 1] = '0';
        return parts.join(':');
      }
    }
    return ip;
  }

  private sanitizeProperties(properties: any): any {
    if (!properties) return properties;

    // PII 필드 제거
    const sanitized = { ...properties };
    const piiFields = ['email', 'phone', 'name', 'address', 'ssn', 'creditCard'];

    piiFields.forEach(field => {
      delete sanitized[field];
    });

    return sanitized;
  }

  private sanitizeUserProperties(userProperties: any): any {
    if (!userProperties) return userProperties;

    // 이메일은 해시화하여 저장
    const sanitized = { ...userProperties };
    if (sanitized.email) {
      // 실제 환경에서는 적절한 해시 함수 사용
      sanitized.emailHash = Buffer.from(sanitized.email).toString('base64');
      delete sanitized.email;
    }

    return sanitized;
  }

  private getDateRange(query: AnalyticsQueryDto): { start: Date; end: Date } {
    const now = new Date();
    let start: Date;
    let end: Date = now;

    if (query.startDate && query.endDate) {
      start = new Date(query.startDate);
      end = new Date(query.endDate);
    } else {
      switch (query.timeRange) {
        case TimeRange.LAST_HOUR:
          start = new Date(now.getTime() - 60 * 60 * 1000);
          break;
        case TimeRange.LAST_24_HOURS:
          start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case TimeRange.LAST_7_DAYS:
          start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case TimeRange.LAST_30_DAYS:
          start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case TimeRange.LAST_90_DAYS:
          start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        default:
          start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      }
    }

    return { start, end };
  }

  private async getTopEvents(dateRange: any, userId: string | undefined, limit: number) {
    const query = this.analyticsEventRepository
      .createQueryBuilder('event')
      .select(['event.action', 'event.category', 'COUNT(*) as count'])
      .where('event.createdAt BETWEEN :start AND :end', dateRange)
      .groupBy('event.action, event.category')
      .orderBy('count', 'DESC')
      .limit(limit);

    if (userId) {
      query.andWhere('event.userId = :userId', { userId });
    }

    return query.getRawMany();
  }

  private async getEventsByCategory(dateRange: any, userId: string | undefined) {
    const query = this.analyticsEventRepository
      .createQueryBuilder('event')
      .select(['event.category', 'COUNT(*) as count'])
      .where('event.createdAt BETWEEN :start AND :end', dateRange)
      .groupBy('event.category')
      .orderBy('count', 'DESC');

    if (userId) {
      query.andWhere('event.userId = :userId', { userId });
    }

    return query.getRawMany();
  }
}
